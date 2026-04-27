from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

async def get_business_metrics(db) -> dict:
    """Core business health numbers"""
    
    # MRR calculation
    plan_prices = {'starter': 999, 'growth': 1999, 'scale': 4999}
    
    paid_users_res = await db.table("profiles").select("plan_id, plans!inner(name, price_inr)").neq("plans.name", "trial").execute()
    paid_users_data = paid_users_res.data or []
    
    mrr = sum(
        plan_prices.get(u.get("plans", {}).get("name"), 0) 
        for u in paid_users_data
    )
    
    # User counts
    total_users_res = await db.table("profiles").select("id", count="exact").execute()
    total_users = total_users_res.count if total_users_res.count is not None else 0
    
    trial_users_res = await db.table("profiles").select("id", count="exact").eq("plans.name", "trial").execute()
    # Note: Depending on Supabase setup, eq("plans.name", "trial") on a profile might need a join or separate fetch if plans isn't embedded
    # A safer way without inner join count:
    trial_users_query = await db.table("profiles").select("id, plans!inner(name)").eq("plans.name", "trial").execute()
    trial_users = len(trial_users_query.data or [])
    
    paid_users_count = total_users - trial_users
    
    # Today's activity
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    today_signups_res = await db.table("profiles").select("id", count="exact").gte("created_at", today_start).execute()
    today_signups = today_signups_res.count if today_signups_res.count is not None else 0
    
    today_messages_res = await db.table("conversations").select("message_count").gte("updated_at", today_start).execute()
    today_messages = sum(c.get("message_count", 0) for c in (today_messages_res.data or []))
    
    today_conversations_res = await db.table("conversations").select("id", count="exact").gte("created_at", today_start).execute()
    today_conversations = today_conversations_res.count if today_conversations_res.count is not None else 0
    
    # Trial conversion (Simple approximation since plan_changes isn't fully robust here yet)
    week_ago = (now - timedelta(days=7)).isoformat()
    trials_this_week_res = await db.table("profiles").select("id", count="exact").gte("created_at", week_ago).execute()
    trials_this_week = trials_this_week_res.count if trials_this_week_res.count is not None else 0
    
    # Placeholder for actual conversion logic
    conversion_rate = 0.0
    
    # Trials expiring soon (at risk)
    # trial_started_at <= now - 25 days
    at_risk_date = (now - timedelta(days=25)).isoformat()
    at_risk_query = await db.table("profiles")\
        .select("id, plans!inner(name)")\
        .eq("plans.name", "trial")\
        .lte("trial_started_at", at_risk_date)\
        .gte("monthly_message_count", 10)\
        .execute()
    at_risk = len(at_risk_query.data or [])
    
    return {
        "mrr": mrr,
        "arr": mrr * 12,
        "total_users": total_users,
        "trial_users": trial_users,
        "paid_users": paid_users_count,
        "today_signups": today_signups,
        "today_messages": today_messages,
        "today_conversations": today_conversations,
        "trial_conversion_rate": round(conversion_rate, 1),
        "trials_at_risk": at_risk,
    }

async def get_system_health(redis, db) -> dict:
    """System health indicators"""
    cache_hit_rate = 0.0
    redis_memory_mb = "0M"
    if redis:
        try:
            redis_info = await redis.info()
            cache_hits = redis_info.get("keyspace_hits", 0)
            cache_misses = redis_info.get("keyspace_misses", 0)
            if cache_hits + cache_misses > 0:
                cache_hit_rate = cache_hits / (cache_hits + cache_misses) * 100
            redis_memory_mb = redis_info.get("used_memory_human", "0M")
        except Exception as e:
            logger.error(f"Redis info failed: {e}")
            
    # Ingestion success rate (last 100 sources)
    recent_sources_res = await db.table("data_sources").select("status").order("created_at", desc=True).limit(100).execute()
    recent_sources = recent_sources_res.data or []
    
    success_count = sum(1 for s in recent_sources if s.get("status") == "ready")
    success_rate = (success_count / len(recent_sources) * 100) if recent_sources else 100.0
    
    # Recent errors
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_errors_res = await db.table("admin_audit_log")\
        .select("id", count="exact")\
        .eq("action", "error")\
        .gte("performed_at", yesterday)\
        .execute()
    recent_errors = recent_errors_res.count if recent_errors_res.count is not None else 0
    
    return {
        "redis_connected": bool(redis),
        "cache_hit_rate": round(cache_hit_rate, 1),
        "redis_memory_mb": redis_memory_mb,
        "queue_waiting": 0, # BullMQ omitted for simplicity
        "queue_active": 0,
        "queue_failed": 0,
        "ingestion_success_rate": round(success_rate, 1),
        "recent_errors_24h": recent_errors,
    }

async def get_users_table(
    db,
    page=1,
    per_page=20,
    search=None,
    plan=None,
    sort_by="created_at",
    sort_dir="desc"
) -> dict:
    """Paginated user list with all details"""
    query = db.table("profiles")\
        .select("*, plans!inner(name, price_inr), bots(count)")
    
    if search:
        query = query.ilike("email", f"%{search}%") # Fallback to email as full_name might not exist
    if plan:
        query = query.eq("plans.name", plan)
    
    query = query.order(sort_by, desc=(sort_dir=="desc"))
    query = query.range((page-1)*per_page, page*per_page-1)
    
    result = await query.execute()
    
    count_query = db.table("profiles").select("id", count="exact")
    if search:
        count_query = count_query.ilike("email", f"%{search}%")
    if plan:
        count_query = count_query.eq("plans.name", plan)
        
    count_res = await count_query.execute()
    total = count_res.count if count_res.count is not None else 0
    
    return {
        "users": result.data or [],
        "total": total,
        "page": page,
        "per_page": per_page
    }

async def get_bot_health_table(db, limit=50, offset=0) -> dict:
    """All bots with health indicators"""
    res = await db.table("bots")\
        .select("*, profiles:owner_id(email)")\
        .is_("deleted_at", "null")\
        .order("created_at", desc=True)\
        .range(offset, offset + limit - 1)\
        .execute()

    count_res = await db.table("bots").select("id", count="exact").is_("deleted_at", "null").execute()
    total_count = count_res.count if count_res.count is not None else 0
    
    return {
        "bots": res.data or [],
        "total": total_count,
        "limit": limit,
        "offset": offset
    }

async def get_guardrail_stats(db) -> dict:
    """How often guardrails fire"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    res = await db.table("analytics_events")\
        .select("properties, bot_id")\
        .eq("event_type", "guardrail_triggered")\
        .gte("created_at", week_ago)\
        .execute()
        
    events = res.data or []
    
    by_type = {"injection": 0, "harmful": 0, "offtopic": 0, "low_confidence": 0}
    bot_counts = {}
    
    for e in events:
        props = e.get("properties", {})
        gtype = props.get("guardrail_type", "").replace("guardrail_", "")
        if gtype in by_type:
            by_type[gtype] += 1
            
        bid = e.get("bot_id")
        if bid:
            bot_counts[bid] = bot_counts.get(bid, 0) + 1
            
    # resolve bot names
    top_bots = []
    if bot_counts:
        sorted_bids = sorted(bot_counts.keys(), key=lambda k: bot_counts[k], reverse=True)[:5]
        bots_res = await db.table("bots").select("id, name").in_("id", sorted_bids).execute()
        b_map = {b["id"]: b["name"] for b in (bots_res.data or [])}
        for bid in sorted_bids:
            top_bots.append({"bot_name": b_map.get(bid, bid), "count": bot_counts[bid]})
            
    return {
        "total_last_7_days": len(events),
        "by_type": by_type,
        "top_bots_triggering": top_bots
    }
