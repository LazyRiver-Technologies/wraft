import asyncio
from database import get_db

async def update_limits():
    db = await get_db()
    
    # 1. Fetch plans
    res = await db.table("plans").select("id, name").execute()
    plans = {p["name"]: p["id"] for p in res.data}
    
    # The names might be: free, starter, growth, scale. Let's print them.
    print("Available plans:", plans)
    
    # Mapping to correct values based on pricing doc
    limits = {
        # trial/free
        "free": {
            "max_messages_per_month": 50,
            "max_bots": 1,
            "max_data_sources_per_bot": 2,
            "max_qa_pairs": 5,
            "auto_retrain_frequency": None,
            "languages_supported": "english_only",
            "remove_watermark": False,
            "wa_notifications": False,
            "lead_capture": False,
            "advanced_analytics": False,
            "leads_export": False,
            "api_access": False,
            "webhook_access": False,
            "check_availability": False,
            "calculate_quote": False,
            "custom_actions": False,
            "shareable_playground": False,
            "custom_branding": False,
            "custom_domain": False,
            "white_label": False,
            "sitemap_source": False
        },
        "trial": {
            "max_messages_per_month": 50,
            "max_bots": 1,
            "max_data_sources_per_bot": 2,
            "max_qa_pairs": 5,
            "auto_retrain_frequency": None,
            "languages_supported": "english_only",
            "remove_watermark": False,
            "wa_notifications": False,
            "lead_capture": False,
            "advanced_analytics": False,
            "leads_export": False,
            "api_access": False,
            "webhook_access": False,
            "check_availability": False,
            "calculate_quote": False,
            "custom_actions": False,
            "shareable_playground": False,
            "custom_branding": False,
            "custom_domain": False,
            "white_label": False,
            "sitemap_source": False
        },
        "starter": {
            "max_messages_per_month": 2000,
            "max_bots": 1,
            "max_data_sources_per_bot": 10,
            "max_qa_pairs": 30,
            "auto_retrain_frequency": None,
            "languages_supported": "hindi_kannada_english", # Based on doc "Hindi+Kannada+English"
            "remove_watermark": False,
            "wa_notifications": False,
            "lead_capture": True,
            "advanced_analytics": True,
            "leads_export": False,
            "api_access": False,
            "webhook_access": False,
            "check_availability": False,
            "calculate_quote": False,
            "custom_actions": False,
            "shareable_playground": True,
            "custom_branding": False,
            "custom_domain": False,
            "white_label": False,
            "sitemap_source": True
        },
        "pro": {
            "max_messages_per_month": 5000,
            "max_bots": 5,
            "max_data_sources_per_bot": 50,
            "max_qa_pairs": 80,
            "auto_retrain_frequency": "weekly",
            "languages_supported": "50_plus",
            "remove_watermark": True,
            "wa_notifications": True,
            "lead_capture": True,
            "advanced_analytics": True,
            "leads_export": True,
            "api_access": False,
            "webhook_access": False,
            "check_availability": True,
            "calculate_quote": False,
            "custom_actions": False,
            "shareable_playground": True,
            "custom_branding": False,
            "custom_domain": False,
            "white_label": False,
            "sitemap_source": True
        },
        "scale": {
            "max_messages_per_month": 15000,
            "max_bots": 999, # Customizable
            "max_data_sources_per_bot": 999,
            "max_qa_pairs": 9999,
            "auto_retrain_frequency": "daily",
            "languages_supported": "100_plus",
            "remove_watermark": True,
            "wa_notifications": True,
            "lead_capture": True,
            "advanced_analytics": True,
            "leads_export": True,
            "api_access": True,
            "webhook_access": True,
            "check_availability": True,
            "calculate_quote": True,
            "custom_actions": True,
            "shareable_playground": True,
            "custom_branding": True,
            "custom_domain": True,
            "white_label": True,
            "sitemap_source": True
        }
    }
    
    for plan_name, plan_id in plans.items():
        if plan_name.lower() in limits:
            plan_limits = limits[plan_name.lower()]
            for key, value in plan_limits.items():
                if value is None:
                    continue
                # upsert feature
                # checking if it exists
                res = await db.table("plan_features").select("*").eq("plan_id", plan_id).eq("feature_key", key).execute()
                if res.data:
                    await db.table("plan_features").update({"feature_value": value}).eq("plan_id", plan_id).eq("feature_key", key).execute()
                else:
                    await db.table("plan_features").insert({"plan_id": plan_id, "feature_key": key, "feature_value": value}).execute()
            print(f"Updated {plan_name}")
            
    # clear redis cache if any
    try:
        from redis_client import redis_client
        if redis_client:
            await redis_client.flushall()
            print("Flushed redis cache")
    except Exception as e:
        pass
        
    print("Done")

asyncio.run(update_limits())
