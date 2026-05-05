import json
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

# Local In-Memory Cache (Free, No Upstash Quota used)
_LOCAL_CACHE = {}
_LOCAL_CACHE_TTL = 300  # 5 minutes for settings
_TIMEZONE_CACHE = {"data": None, "expiry": 0}

async def get_bot_settings_cached(bot_id: str, db, redis) -> Dict[str, Any]:
    """
    Hybrid Cache: Local RAM -> Redis -> DB.
    Optimized for Upstash Free Tier limits.
    """
    now = time.time()
    cache_key = f"bot_settings:{bot_id}"

    # 1. Try Local RAM first (Cost: 0)
    if cache_key in _LOCAL_CACHE:
        entry = _LOCAL_CACHE[cache_key]
        if now < entry["expiry"]:
            return entry["data"]

    # 2. Try Redis (Optional, only if you want cross-instance sync)
    # To save Upstash quota, we can skip Redis for settings and go straight to DB
    # since we have the 5-min Local RAM cache.
    
    # 3. Try DB
    try:
        res = await db.table("bot_settings").select("*").eq("bot_id", bot_id).single().execute()
        settings = res.data if res.data else {}
        
        # Save to Local RAM
        _LOCAL_CACHE[cache_key] = {
            "data": settings,
            "expiry": now + _LOCAL_CACHE_TTL
        }
        return settings
    except Exception as e:
        print(f"DB Error in get_bot_settings_cached: {e}")
        return {}

async def invalidate_bot_settings(bot_id: str, redis):
    """Purge local cache. If using multiple workers, this would need a Redis PubSub signal."""
    cache_key = f"bot_settings:{bot_id}"
    if cache_key in _LOCAL_CACHE:
        del _LOCAL_CACHE[cache_key]
    # Also delete from Redis if we used it
    if redis is not None:
        await redis.delete(cache_key)

async def get_system_timezones_cached(db, redis) -> List[str]:
    """
    Caches in Local RAM for 24 hours. 
    Completely eliminates the 35% DB load at zero Upstash cost.
    """
    now = time.time()
    if _TIMEZONE_CACHE["data"] and now < _TIMEZONE_CACHE["expiry"]:
        return _TIMEZONE_CACHE["data"]

    # Expensive view lookup
    res = await db.table("pg_timezone_names").select("name").execute()
    zones = [r["name"] for r in res.data] if res.data else []

    _TIMEZONE_CACHE["data"] = zones
    _TIMEZONE_CACHE["expiry"] = now + 86400 # 24 hours
        
    return zones

async def get_admin_metrics_cached(db, redis) -> Dict[str, Any]:
    """Caches business metrics for 60s to prevent dashboard DB hammering."""
    cache_key = "admin:metrics:overview"
    if redis is not None:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

    from services.admin_stats import get_business_metrics
    data = await get_business_metrics(db)
    if redis is not None:
        await redis.setex(cache_key, 60, json.dumps(data))
    return data

async def get_revenue_stats_cached(db, redis) -> Dict[str, Any]:
    """Caches revenue economics for 5 minutes. High cost, low frequency change."""
    cache_key = "admin:metrics:revenue"
    if redis is not None:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

    from services.admin_stats import get_mrr_history, get_plan_distribution, get_revenue_feed
    # Combine the revenue-related lookups
    mrr = await get_mrr_history(db, 90)
    dist = await get_plan_distribution(db)
    feed = await get_revenue_feed(db, 20)
    
    data = {
        "mrr": sum(d['total_mrr'] for d in mrr[-1:]) if mrr else 0,
        "mrr_history": mrr,
        "plan_economics": dist,
        "recent_payments": feed
    }
    if redis is not None:
        await redis.setex(cache_key, 300, json.dumps(data))
    return data

async def get_user_details_cached(user_id: str, db, redis) -> Dict[str, Any]:
    """Caches full user intelligence profile for 5 mins."""
    cache_key = f"admin:user_details:{user_id}"
    if redis is not None:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

    profile_res = await db.table("profiles").select("*, plans!inner(*)").eq("id", user_id).single().execute()
    if not profile_res.data:
        return {}
        
    bots_res = await db.table("bots").select("*").eq("owner_id", user_id).execute()
    
    # Placeholder for history logic
    data = {
        "profile": profile_res.data,
        "bots": bots_res.data or [],
        "plan_history": [], 
        "usage_history": [],
        "audit_logs": [] 
    }
    if redis is not None:
        await redis.setex(cache_key, 300, json.dumps(data))
    return data

async def invalidate_user_details(user_id: str, redis):
    """Bust specific user cache on mutation."""
    if redis is not None:
        await redis.delete(f"admin:user_details:{user_id}")

async def invalidate_admin_metrics(redis):
    """Bust all metric caches when a significant event (new user/payment) occurs."""
    if redis is None:
        return
    keys = ["admin:metrics:overview", "admin:metrics:revenue"]
    for k in keys:
        await redis.delete(k)
