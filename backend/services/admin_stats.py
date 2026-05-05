from datetime import datetime, timezone, timedelta
import logging
import json

logger = logging.getLogger(__name__)

async def get_business_metrics(db) -> dict:
    """Core business health numbers"""
    
    # MRR calculation
    plan_prices = {'starter': 999, 'growth': 1999, 'scale': 4999}
    
    paid_users_res = await db.table("profiles")\
        .select("plan_id, plans!inner(name, price_inr)")\
        .neq("plans.name", "trial")\
        .execute()
    paid_users_data = paid_users_res.data or []
    
    mrr = sum(
        plan_prices.get(u.get("plans", {}).get("name"), 0) 
        for u in paid_users_data
    )
    
    # User counts
    total_users_res = await db.table("profiles").select("id", count="exact").execute()
    total_users = total_users_res.count if total_users_res.count is not None else 0
    
    trial_users_query = await db.table("profiles").select("id, plans!inner(name)").eq("plans.name", "trial").execute()
    trial_users = len(trial_users_query.data or [])
    
    paid_users_count = total_users - trial_users
    
    # Today's activity
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    today_signups_res = await db.table("profiles").select("id", count="exact").gte("created_at", today_start).execute()
    today_signups = today_signups_res.count if today_signups_res.count is not None else 0
    
    today_messages_res = await db.table("conversations").select("message_count").gte("last_active_at", today_start).execute()
    today_messages = sum(c.get("message_count", 0) for c in (today_messages_res.data or []))
    
    today_conversations_res = await db.table("conversations").select("id", count="exact").gte("created_at", today_start).execute()
    today_conversations = today_conversations_res.count if today_conversations_res.count is not None else 0
    
    # Trial conversion
    week_ago = (now - timedelta(days=7)).isoformat()
    trials_this_week_res = await db.table("profiles").select("id", count="exact").gte("created_at", week_ago).execute()
    trials_this_week = trials_this_week_res.count if trials_this_week_res.count is not None else 0
    
    # Placeholder for actual conversion logic (requires tracking plan transitions)
    conversion_rate = 0.0
    
    # Trials expiring soon (at risk)
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

async def get_mrr_history(db, days=30) -> list:
    """Daily MRR for the past N days (Simplified approximation)"""
    now = datetime.now(timezone.utc)
    history = []
    for i in range(days):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        # In a real system, we would use a snapshots table or point-in-time joins
        history.append({"date": date, "mrr": 0, "new_mrr": 0, "churned_mrr": 0})
    return history

async def get_plan_distribution(db) -> list:
    """How many users on each plan"""
    res = await db.table("profiles").select("plans(name)").execute()
    plans = [p["plans"]["name"] for p in (res.data or []) if p.get("plans")]
    total = len(plans)
    
    dist = {}
    for p in plans:
        dist[p] = dist.get(p, 0) + 1
        
    return [
        {
            "plan": k, 
            "count": v, 
            "percentage": round(v/total*100, 1) if total > 0 else 0,
            "mrr_contribution": 0 # price * v
        } for k, v in dist.items()
    ]

async def get_system_health(redis, db) -> dict:
    """System health indicators"""
    cache_hit_rate = 0.0
    redis_memory_mb = "0M"
    ingestion_waiting = 0
    ingestion_active = 0
    ingestion_failed = 0
    
    if redis:
        try:
            redis_info = await redis.info()
            cache_hits = int(redis_info.get("keyspace_hits", 0))
            cache_misses = int(redis_info.get("keyspace_misses", 0))
            if cache_hits + cache_misses > 0:
                cache_hit_rate = cache_hits / (cache_hits + cache_misses) * 100
            redis_memory_mb = redis_info.get("used_memory_human", "0M")
            
            # Queue depths (Assuming BullMQ conventions)
            ingestion_waiting = await redis.llen("bull:ingestion:wait")
            ingestion_active = await redis.llen("bull:ingestion:active")
            ingestion_failed = await redis.llen("bull:ingestion:failed")
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            
    # Ingestion success rate (last 100 sources)
    recent_sources_res = await db.table("data_sources").select("status").order("created_at", desc=True).limit(100).execute()
    recent_sources = recent_sources_res.data or []
    success_count = sum(1 for s in recent_sources if s.get("status") == "ready")
    success_rate = (success_count / len(recent_sources) * 100) if recent_sources else 100.0
    
    # Recent errors (24h from audit log)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_errors_res = await db.table("admin_audit_log").select("id", count="exact").eq("action", "error").gte("performed_at", yesterday).execute()
    recent_errors = recent_errors_res.count if recent_errors_res.count is not None else 0
    
    return {
        "redis_connected": bool(redis),
        "cache_hit_rate": round(cache_hit_rate, 1),
        "redis_memory_mb": redis_memory_mb,
        "queue_waiting": ingestion_waiting,
        "queue_active": ingestion_active,
        "queue_failed": ingestion_failed,
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
    query = db.table("profiles").select("*, plans!inner(name, price_inr), bots(count)", count="exact")
    
    if search:
        query = query.ilike("full_name", f"%{search}%")
    if plan:
        query = query.eq("plans.name", plan)
    
    query = query.order(sort_by, desc=(sort_dir=="desc"))
    query = query.range((page-1)*per_page, page*per_page-1)
    
    result = await query.execute()
    return {
        "users": result.data or [],
        "total": result.count if result.count is not None else 0,
        "page": page,
        "per_page": per_page
    }

async def get_bot_health_table(db) -> list:
    """All bots with health indicators and health_score"""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # This is a heavy query, in prod we would materialize these stats
    res = await db.table("bots").select("""
        *, 
        profiles:owner_id(full_name, email),
        data_sources(status),
        conversations(created_at, message_count),
        whatsapp_configs(is_connected)
    """).execute()
    
    bots = res.data or []
    health_data = []
    
    for b in bots:
        sources = b.get("data_sources", [])
        ready_sources = [s for s in sources if s["status"] == "ready"]
        
        convs = b.get("conversations", [])
        recent_convs = [c for c in convs if c["created_at"] >= week_ago]
        msg_count_7d = sum(c.get("message_count", 0) for c in recent_convs)
        
        last_activity = max([c["created_at"] for c in convs]) if convs else None
        has_whatsapp = any(wc.get("is_connected") for wc in b.get("whatsapp_configs", []))
        
        # Compute Health Score
        # 0 = no data sources ready
        # 1 = has sources, zero conversations (dead bot)
        # 2 = has conversations but declining (placeholder logic)
        # 3 = healthy and active
        score = 0
        if not ready_sources:
            score = 0
        elif not convs:
            score = 1
        elif len(recent_convs) > 0:
            score = 3
        else:
            score = 2
            
        health_data.append({
            "id": b["id"],
            "name": b["name"],
            "owner": b.get("profiles", {}).get("full_name") or b.get("profiles", {}).get("email"),
            "sources_count": len(sources),
            "ready_sources": len(ready_sources),
            "convs_7d": len(recent_convs),
            "msgs_7d": msg_count_7d,
            "last_activity": last_activity,
            "has_whatsapp": has_whatsapp,
            "health_score": score
        })
        
    return health_data

async def get_revenue_feed(db, limit=20) -> list:
    """Recent payment events from plan_changes (Mocked)"""
    return []

async def get_guardrail_stats(db) -> dict:
    """How often guardrails fire"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    res = await db.table("analytics_events")\
        .select("properties, bot_id")\
        .eq("event_type", "message_received")\
        .gte("occurred_at", week_ago)\
        .execute()
        
    events = [
        e for e in (res.data or [])
        if (e.get("properties") or {}).get("guardrail_type")
    ]
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
