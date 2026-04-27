from datetime import datetime, timezone
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

async def get_profile_with_plan(owner_id: str, db):
    try:
        result = await db.table("profiles")\
            .select("*, plans!inner(*)")\
            .eq("id", owner_id)\
            .single()\
            .execute()
        return result.data
    except Exception as e:
        logger.error(f"Error fetching profile for user {owner_id}: {e}")
        raise HTTPException(
            status_code=403, 
            detail="Your account profile or subscription plan was not found. Please ensure your account is properly initialized."
        )

async def check_trial_expiry(profile: dict) -> None:
    plan = profile["plans"]
    if plan["name"] != "trial":
        return
    
    trial_start = datetime.fromisoformat(
        profile["trial_started_at"].replace("Z", "+00:00")
    )
    now = datetime.now(timezone.utc)
    days_elapsed = (now - trial_start).days
    
    if days_elapsed > 30 or profile.get("trial_expired"):
        raise HTTPException(
            status_code=402,
            detail={
                "error": "trial_expired",
                "message": "Your 30-day free trial has ended.",
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
    
    current_count = await db.table("qa_pairs")\
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

# Maintain increment_usage for rag.py imports
async def increment_usage(owner_id: str, bot_id: str, tokens: int, channel: str, db) -> None:
    try:
        # We need an RPC to handle this atomically, similar to current increment logic
        await db.rpc("increment_usage_metrics", {
            "p_owner_id": owner_id,
            "p_bot_id": bot_id,
            "p_tokens": tokens,
            "p_channel": channel
        }).execute()
    except Exception as e:
        logger.error(f"Failed to increment usage: {e}")
