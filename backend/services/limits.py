from datetime import datetime, timezone, date
from fastapi import HTTPException
import logging
import json

logger = logging.getLogger(__name__)

async def get_profile_with_plan(owner_id: str, db):
    try:
        result = await db.table("profiles")\
            .select("*, plans(*, plan_features(*))")\
            .eq("id", owner_id)\
            .limit(1)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=403, detail="Profile not found.")
            
        profile = result.data[0]
        
        # Mathematical fallback if plan is missing
        if not profile.get("plans"):
            plan_res = await db.table("plans").select("*, plan_features(*)").in_("name", ["free", "trial"]).limit(1).execute()
            if plan_res.data:
                plan_data = plan_res.data[0]
                if plan_data.get("plan_features"):
                    for f in plan_data["plan_features"]:
                        plan_data[f["feature_key"]] = f["feature_value"]
                    del plan_data["plan_features"]
                profile["plans"] = plan_data
            else:
                profile["plans"] = {
                    "name": "trial",
                    "max_bots": 1,
                    "max_chunks_per_bot": 50,
                    "max_messages_per_month": 50,
                    "max_data_sources_per_bot": 2,
                    "price_inr": 0,
                    "overage_price_paise": 0,
                    "max_actions": 0,
                    "max_qa_pairs": 5
                }
                
        if profile.get("plans") and profile["plans"].get("plan_features"):
            for f in profile["plans"]["plan_features"]:
                profile["plans"][f["feature_key"]] = f["feature_value"]
            del profile["plans"]["plan_features"]

        if profile:
            today = date.today()
            cycle_start_raw = profile.get("billing_cycle_start")
            if cycle_start_raw:
                try:
                    cycle_start = date.fromisoformat(cycle_start_raw)
                    if cycle_start.year != today.year or cycle_start.month != today.month:
                        await db.table("profiles").update({
                            "monthly_message_count": 0,
                            "billing_cycle_start": today.isoformat()
                        }).eq("id", owner_id).execute()
                        profile["monthly_message_count"] = 0
                        profile["billing_cycle_start"] = today.isoformat()
                except Exception:
                    logger.warning("Failed to evaluate billing cycle reset for owner %s", owner_id)
        return profile
    except Exception as e:
        logger.error(f"Error fetching profile for user {owner_id}: {e}")
        raise HTTPException(
            status_code=403, 
            detail="Your account profile or subscription plan was not found. Please ensure your account is properly initialized via the database auth trigger."
        )

async def check_trial_expiry(profile: dict) -> None:
    plan = profile["plans"]
    if plan["name"] != "trial":
        return
    
    trial_days = 30 + profile.get("trial_extended_days", 0)
    
    if not profile.get("trial_started_at"):
        days_elapsed = 0
    else:
        trial_start = datetime.fromisoformat(
            profile["trial_started_at"].replace("Z", "+00:00")
        )
        now = datetime.now(timezone.utc)
        days_elapsed = (now - trial_start).days
    
    if days_elapsed > trial_days or profile.get("trial_expired"):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "trial_expired",
                "message": f"Your {trial_days}-day free trial has ended.",
                "upgrade_url": "/pricing"
            }
        )

async def check_message_limit(
    owner_id: str, db
) -> None:
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    
    # trial expiry check first
    await check_trial_expiry(profile)
    
    # message limit check
    current = profile["monthly_message_count"]
    limit = plan["max_messages_per_month"]
    
    if current >= limit:
        overage_price = plan["overage_price_paise"]
        if overage_price > 0:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "message_limit_reached",
                    "limit": limit,
                    "plan": plan["name"],
                    "overage_available": True,
                    "overage_price": "₹1 per message",
                    "message": f"You have used all {limit} messages. Additional messages cost ₹1 each.",
                    "upgrade_url": "/pricing"
                }
            )
        else:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "message_limit_reached",
                    "limit": limit,
                    "plan": plan["name"],
                    "overage_available": False,
                    "message": f"You have used all {limit} messages this month.",
                    "upgrade_url": "/pricing"
                }
            )

async def check_bot_limit(
    owner_id: str, db
) -> None:
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    max_bots = plan["max_bots"]
    
    current_count = await db.table("bots")\
        .select("id", count="exact")\
        .eq("owner_id", owner_id)\
        .is_("deleted_at", "null")\
        .execute()
    
    if current_count.count >= max_bots:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "bot_limit_reached",
                "limit": max_bots,
                "plan": plan["name"],
                "message": f"Your plan allows {max_bots} bot(s). Upgrade to create more.",
                "upgrade_url": "/pricing"
            }
        )

async def check_data_source_limit(
    owner_id: str, bot_id: str, db
) -> None:
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    max_sources = plan["max_data_sources_per_bot"]
    
    current_count = await db.table("data_sources")\
        .select("id", count="exact")\
        .eq("bot_id", bot_id)\
        .neq("status", "failed")\
        .execute()
    
    if current_count.count >= max_sources:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "data_source_limit_reached",
                "limit": max_sources,
                "plan": plan["name"],
                "message": f"Your plan allows {max_sources} data sources per bot.",
                "upgrade_url": "/pricing"
            }
        )

async def check_qa_limit(
    owner_id: str, bot_id: str, db
) -> None:
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    max_qa = plan["max_qa_pairs"]
    if max_qa is None:
        return
    
    # Fetch embedding_dim safely
    bot_settings_res = await db.table("bot_settings").select("embedding_dim").eq("bot_id", bot_id).limit(1).execute()
    embedding_dim = 768
    if bot_settings_res.data and len(bot_settings_res.data) > 0 and bot_settings_res.data[0].get("embedding_dim"):
        embedding_dim = bot_settings_res.data[0]["embedding_dim"]

    current_count = await db.table(f"qa_pairs_{embedding_dim}")\
        .select("id", count="exact")\
        .eq("bot_id", bot_id)\
        .eq("is_active", True)\
        .execute()
    
    if current_count.count >= max_qa:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "qa_limit_reached",
                "limit": max_qa,
                "plan": plan["name"],
                "message": f"Your plan allows {max_qa} Q&A pairs. Upgrade for more.",
                "upgrade_url": "/pricing"
            }
        )

async def check_feature_access(
    owner_id: str,
    feature: str,
    db
) -> None:
    """
    Generic feature gate check.
    feature must match a boolean column name in plans table.
    """
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    
    has_access = plan.get(feature, False)
    if has_access:
        return
        
    FEATURE_NAMES = {
        "lead_capture": "Lead Capture",
        "wa_notifications": "WhatsApp Notifications",
        "advanced_analytics": "Advanced Analytics",
        "leads_export": "Leads CSV Export",
        "check_availability": "Check Availability Action",
        "calculate_quote": "Calculate Quote Action",
        "custom_actions": "Custom AI Actions",
        "shareable_playground": "Shareable Playground",
        "custom_branding": "Custom Widget Branding",
        "custom_domain": "Custom Domain",
        "white_label": "White Label",
        "api_access": "API Access",
        "webhook_access": "Webhook Access",
        "sitemap_source": "Sitemap Data Source",
    }
    
    feature_name = FEATURE_NAMES.get(feature, feature)
    
    PLAN_REQUIRED = {
        "lead_capture": "Starter",
        "wa_notifications": "Growth",
        "advanced_analytics": "Growth",
        "leads_export": "Growth",
        "check_availability": "Growth",
        "calculate_quote": "Scale",
        "custom_actions": "Scale",
        "shareable_playground": "Starter",
        "custom_branding": "Scale",
        "custom_domain": "Scale",
        "white_label": "Scale",
        "api_access": "Scale",
        "webhook_access": "Scale",
        "sitemap_source": "Starter",
    }
    
    required_plan = PLAN_REQUIRED.get(feature, "a higher plan")
    
    raise HTTPException(
        status_code=403,
        detail={
            "error": "feature_not_available",
            "feature": feature_name,
            "required_plan": required_plan,
            "current_plan": plan["name"],
            "message": f"{feature_name} requires {required_plan} plan or above.",
            "upgrade_url": "/pricing"
        }
    )

async def check_actions_limit(
    owner_id: str, bot_id: str, db
) -> None:
    profile = await get_profile_with_plan(owner_id, db)
    plan = profile["plans"]
    max_actions = plan["max_actions"]
    
    if max_actions == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "actions_not_available",
                "message": "AI Actions are available on Growth plan and above.",
                "upgrade_url": "/pricing"
            }
        )
    
    if max_actions >= 999:
        return  # scale plan, effectively unlimited
    
    current_count = await db.table("bot_actions")\
        .select("id", count="exact")\
        .eq("bot_id", bot_id)\
        .eq("is_active", True)\
        .execute()
    
    if current_count.count >= max_actions:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "actions_limit_reached",
                "limit": max_actions,
                "plan": plan["name"],
                "message": f"Upgrade to Scale for unlimited AI Actions.",
                "upgrade_url": "/pricing"
            }
        )

async def check_feature_flag(
    flag_name: str,
    owner_id: str,
    plan_name: str,
    db,
    redis
) -> bool:
    """
    Check if a feature flag is enabled for this user.
    Cached in Redis for 60 seconds to avoid DB hammering.
    """
    cache_key = f"flag:{flag_name}"
    try:
        if redis is not None:
            cached = await redis.get(cache_key)
            if cached:
                flag_data = json.loads(cached)
            else:
                res = await db.table("feature_flags").select("*").eq("flag_name", flag_name).limit(1).execute()
                flag_data = res.data[0] if res.data else None
                if flag_data:
                    await redis.setex(cache_key, 60, json.dumps(flag_data))
        else:
            res = await db.table("feature_flags").select("*").eq("flag_name", flag_name).limit(1).execute()
            flag_data = res.data[0] if res.data else None
    except Exception:
        flag_data = None

    if not flag_data:
        return True  # Flag not found = enabled by default
    
    if not flag_data["is_enabled"]:
        return False  # Globally disabled
    
    enabled_for = flag_data["enabled_for"]
    
    if enabled_for == "all":
        return True
    if enabled_for == "paid":
        return plan_name != "trial"
    if enabled_for == "pro_above":
        return plan_name in ["growth", "scale"]
    if enabled_for == "scale":
        return plan_name == "scale"
    if enabled_for == "specific":
        return owner_id in (flag_data.get("specific_user_ids") or [])
    
    return False

# Maintain increment_usage for rag.py imports
async def increment_usage(owner_id: str, bot_id: str, tokens: int, channel: str, db) -> None:
    try:
        # We need an RPC to handle this atomically, similar to current increment logic
        await db.rpc("increment_usage", {
            "p_owner_id": owner_id,
            "p_bot_id": bot_id,
            "p_tokens": tokens,
            "p_channel": channel
        }).execute()
    except Exception as e:
        logger.error(f"Failed to increment usage: {e}")
