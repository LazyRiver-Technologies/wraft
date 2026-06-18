from datetime import datetime, timezone, timedelta
import logging
import json

logger = logging.getLogger(__name__)

async def get_business_metrics(db, redis=None) -> dict:
    """Core business health numbers for Command Center"""
    
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
        .select("id, full_name, phone, monthly_message_count, trial_started_at, plans!inner(name)")\
        .eq("plans.name", "trial")\
        .lte("trial_started_at", at_risk_date)\
        .limit(10)\
        .execute()
    at_risk_users = []
    for u in (at_risk_query.data or []):
        started_at = datetime.fromisoformat(u.get("trial_started_at").replace('Z', '+00:00')) if u.get("trial_started_at") else now
        days_left = max(0, 30 - (now - started_at).days)
        at_risk_users.append({
            "id": u.get("id"),
            "name": u.get("full_name") or "Unknown",
            "phone": u.get("phone") or "N/A",
            "messages_used": u.get("monthly_message_count", 0),
            "days_left": days_left
        })
    at_risk = len(at_risk_query.data or [])
    
    # Queues
    ingestion_waiting = 0
    ingestion_active = 0
    ingestion_failed = 0
    if redis:
        try:
            ingestion_waiting = await redis.llen("bull:ingestion:wait")
            ingestion_active = await redis.llen("bull:ingestion:active")
            ingestion_failed = await redis.llen("bull:ingestion:failed")
        except Exception:
            pass

    # Recent Signups
    recent_signups_res = await db.table("profiles").select("id, full_name, created_at, plans(name)").order("created_at", desc=True).limit(5).execute()
    recent_signups = []
    for r in (recent_signups_res.data or []):
        ct = datetime.fromisoformat(r["created_at"].replace('Z', '+00:00')) if r.get("created_at") else now
        diff = now - ct
        if diff.days > 0:
            rel = f"{diff.days}d ago"
        else:
            rel = f"{diff.seconds // 3600}h ago" if diff.seconds >= 3600 else f"{diff.seconds // 60}m ago"
        recent_signups.append({
            "id": r["id"],
            "name": r.get("full_name") or "Unknown",
            "plan_name": r.get("plans", {}).get("name", "trial") if isinstance(r.get("plans"), dict) else "trial",
            "created_at_relative": rel
        })

    # Recent Errors
    recent_errors_res = await db.table("admin_audit_log").select("*").eq("action", "error").order("performed_at", desc=True).limit(5).execute()
    recent_errors = []
    for r in (recent_errors_res.data or []):
        pt = datetime.fromisoformat(r["performed_at"].replace('Z', '+00:00')) if r.get("performed_at") else now
        diff = now - pt
        if diff.days > 0:
            rel = f"{diff.days}d ago"
        else:
            rel = f"{diff.seconds // 3600}h ago" if diff.seconds >= 3600 else f"{diff.seconds // 60}m ago"
        details = r.get("details", {})
        recent_errors.append({
            "id": r["id"],
            "error_type": details.get("error_type", "System Error"),
            "bot_id": r.get("target_id", ""),
            "created_at_relative": rel
        })
        
    mrr_history = await get_mrr_history(db, 30)
    dist = await get_plan_distribution(db)
    
    return {
        "mrr": mrr,
        "arr": mrr * 12,
        "mrr_growth": 0, # Placeholder
        "total_users": total_users,
        "trial_users": trial_users,
        "paid_users": paid_users_count,
        "today_signups": today_signups,
        "today_messages": today_messages,
        "today_conversations": today_conversations,
        "trial_conversion_rate": round(conversion_rate, 1),
        "trials_at_risk": at_risk,
        "queue_waiting": ingestion_waiting,
        "queue_active": ingestion_active,
        "queue_failed": ingestion_failed,
        "mrr_history": mrr_history,
        "plan_distribution": dist,
        "recent_signups": recent_signups,
        "recent_payments": [], # Placeholder
        "recent_errors": recent_errors,
        "at_risk_users": at_risk_users
    }

async def get_revenue_stats(db) -> dict:
    """Full revenue intelligence report"""
    # Base MRR
    plan_prices = {'starter': 999, 'growth': 1999, 'scale': 4999}
    paid_users_res = await db.table("profiles").select("plan_id, plans!inner(name)").neq("plans.name", "trial").execute()
    paid_users_data = paid_users_res.data or []
    
    mrr = sum(plan_prices.get(u.get("plans", {}).get("name"), 0) for u in paid_users_data)
    paid_users = len(paid_users_data)
    
    total_users_res = await db.table("profiles").select("id", count="exact").execute()
    total_users = total_users_res.count if total_users_res.count is not None else 0
    paid_pct = round((paid_users / total_users * 100), 1) if total_users > 0 else 0
    
    mrr_history = await get_mrr_history(db, 90)
    
    # Calculate funnel
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).isoformat()
    
    signups_res = await db.table("profiles").select("id", count="exact").gte("created_at", month_ago).execute()
    signups = signups_res.count or 0
    
    # Active = >10 messages
    active_res = await db.table("profiles").select("id", count="exact").gte("created_at", month_ago).gte("monthly_message_count", 10).execute()
    active = active_res.count or 0
    
    # Converted = non-trial created this month
    converted_res = await db.table("profiles").select("id, plans!inner(name)", count="exact").gte("created_at", month_ago).neq("plans.name", "trial").execute()
    converted = len(converted_res.data or [])
    
    funnel = {
        "signups": signups,
        "onboarded": signups, # Assuming all signups are onboarded for now
        "onboarded_pct": 100,
        "active": active,
        "active_pct": round((active / signups * 100), 1) if signups > 0 else 0,
        "converted": converted,
        "converted_pct": round((converted / signups * 100), 1) if signups > 0 else 0
    }
    
    feed = await get_revenue_feed(db, 20)
    dist = await get_plan_distribution(db)
    
    # Map dist to economics format
    economics = []
    for d in dist:
        p_name = d["plan"]
        p_count = d["count"]
        p_mrr = p_count * plan_prices.get(p_name, 0)
        economics.append({
            "name": p_name.capitalize(),
            "users": p_count,
            "mrr": p_mrr,
            "percentage": round((p_mrr / mrr * 100), 1) if mrr > 0 else 0
        })
    economics.sort(key=lambda x: x["mrr"], reverse=True)
    
    # Upcoming renewals (Mock based on billing cycle)
    upcoming_res = await db.table("profiles").select("full_name, billing_cycle_start, plans!inner(name, price_inr)").neq("plans.name", "trial").execute()
    upcoming = []
    for u in (upcoming_res.data or []):
        try:
            # Assumes billing_cycle_start is roughly YYYY-MM-DD
            cycle_start = datetime.fromisoformat(str(u.get("billing_cycle_start"))).replace(tzinfo=timezone.utc)
            # Find next renewal date
            months_passed = (now.year - cycle_start.year) * 12 + now.month - cycle_start.month
            if now.day > cycle_start.day:
                months_passed += 1
            
            # Rough next renewal date
            next_renewal = cycle_start + timedelta(days=30 * months_passed)
            days_to_renewal = (next_renewal - now).days
            
            if 0 <= days_to_renewal <= 7:
                upcoming.append({
                    "user_name": u.get("full_name") or "Unknown User",
                    "plan": u.get("plans", {}).get("name", "none"),
                    "amount": u.get("plans", {}).get("price_inr", 0),
                    "renewal_date": f"in {days_to_renewal} days"
                })
        except Exception:
            continue
            
    upcoming.sort(key=lambda x: x.get("renewal_date"))
    
    return {
        "mrr": mrr,
        "paid_users": paid_users,
        "paid_percentage": paid_pct,
        "conversion_rate": funnel["converted_pct"],
        "mrr_history": mrr_history,
        "plan_economics": economics,
        "funnel": funnel,
        "recent_payments": feed,
        "upcoming_renewals": upcoming
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
    """System health indicators mapped to UI requirements"""
    now = datetime.now(timezone.utc)
    
    # 1. Services Health Status
    services = {
        "api": "online",
        "db": "online" if db else "down",
        "redis": "online" if redis else "down",
        "queue": "online" if redis else "down", # Assuming BullMQ runs on Redis
        "gemini": "online", # Mock check or add actual Google AI ping
        "meta": "online" # Mock check or add Meta webhook ping
    }
    
    # 2. Cache / Redis Stats
    cache = {
        "hit_rate": 0.0,
        "total_hits": 0,
        "memory_used": "0M",
        "oldest_key_age": "N/A"
    }
    
    # 3. Queue (BullMQ) Status
    queue = {
        "waiting": 0,
        "active": 0,
        "failed": 0
    }
    
    if redis:
        try:
            redis_info = await redis.info()
            cache_hits = int(redis_info.get("keyspace_hits", 0))
            cache_misses = int(redis_info.get("keyspace_misses", 0))
            
            cache["total_hits"] = cache_hits
            if cache_hits + cache_misses > 0:
                cache["hit_rate"] = round(cache_hits / (cache_hits + cache_misses) * 100, 1)
            cache["memory_used"] = redis_info.get("used_memory_human", "0M")
            
            # Queue depths
            queue["waiting"] = await redis.llen("bull:ingestion:wait")
            queue["active"] = await redis.llen("bull:ingestion:active")
            queue["failed"] = await redis.llen("bull:ingestion:failed")
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            
    # Mock failed jobs list for the UI queue panel
    failed_jobs = []
    if queue["failed"] > 0:
        failed_jobs = [
            {"id": "job-101", "error": "Document ingestion timeout (PDF > 50MB)", "failed_at_relative": "10m ago"},
            {"id": "job-102", "error": "Invalid vector dimension from embedder", "failed_at_relative": "1h ago"}
        ]
        
    # 4. Guardrails Stats (Calls get_guardrail_stats internally)
    guardrails = {
        "total": 0,
        "history": [],
        "top_bots": []
    }
    g_stats = await get_guardrail_stats(db)
    if g_stats:
        guardrails["total"] = g_stats.get("total_last_7_days", 0)
        guardrails["top_bots"] = g_stats.get("top_bots_triggering", [])
        
        # Mock History Chart Data mapping
        guardrails["history"] = [
            {"date": (now - timedelta(days=d)).strftime("%a"), "injection": 0, "harmful": 0, "offtopic": 0, "low_confidence": 0}
            for d in range(6, -1, -1)
        ]
        
    # 5. Global Error Terminal (System Errors)
    system_errors_res = await db.table("admin_audit_log").select("*").eq("action", "error").order("performed_at", desc=True).limit(20).execute()
    system_errors = []
    
    for e in (system_errors_res.data or []):
        pt = datetime.fromisoformat(e["performed_at"].replace('Z', '+00:00')) if e.get("performed_at") else now
        diff = now - pt
        if diff.days > 0:
            rel = f"{diff.days}d ago"
        else:
            rel = f"{diff.seconds // 3600}h ago" if diff.seconds >= 3600 else f"{diff.seconds // 60}m ago"
            
        details = e.get("details", {})
        system_errors.append({
            "class": details.get("error_type", "SystemException"),
            "subsystem": details.get("subsystem", "Core"),
            "payload": details,
            "at_relative": rel
        })
    
    return {
        "services": services,
        "cache": cache,
        "queue": queue,
        "failed_jobs": failed_jobs,
        "guardrails": guardrails,
        "system_errors": system_errors
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
    query = db.table("profiles").select("id, full_name, phone, created_at, monthly_message_count, is_banned, trial_started_at, trial_extended_days, plans!inner(name, price_inr, max_messages_per_month), bots(id)", count="exact")
    
    if search:
        query = query.ilike("full_name", f"%{search}%")
    if plan and plan != 'all':
        query = query.eq("plans.name", plan)
    
    query = query.order(sort_by, desc=(sort_dir=="desc"))
    query = query.range((page-1)*per_page, page*per_page-1)
    
    result = await query.execute()
    
    now = datetime.now(timezone.utc)
    formatted_users = []
    
    for u in (result.data or []):
        ct = datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) if u.get("created_at") else now
        diff = now - ct
        
        if diff.days > 0:
            rel = f"{diff.days}d ago"
        else:
            rel = f"{diff.seconds // 3600}h ago" if diff.seconds >= 3600 else f"{diff.seconds // 60}m ago"
            
        trial_days_remaining = 0
        if u.get("plans", {}).get("name") == "trial":
            started_at = datetime.fromisoformat(u.get("trial_started_at").replace('Z', '+00:00')) if u.get("trial_started_at") else now
            trial_days_remaining = max(0, 30 + u.get("trial_extended_days", 0) - (now - started_at).days)
            
        formatted_users.append({
            "id": u["id"],
            "name": u.get("full_name") or "Unknown",
            "phone": u.get("phone") or "N/A",
            "plan_name": u.get("plans", {}).get("name", "trial"),
            "bots_count": len(u.get("bots", [])),
            "messages_used": u.get("monthly_message_count", 0),
            "message_limit": u.get("plans", {}).get("max_messages_per_month", 50),
            "created_at_relative": rel,
            "trial_days_remaining": trial_days_remaining,
            "is_banned": u.get("is_banned", False)
        })
        
    return {
        "data": formatted_users,
        "total": result.count if result.count is not None else 0,
        "page": page,
        "per_page": per_page
    }

async def get_bot_health_table(db, search=None, health_filter="all", whatsapp_filter="all") -> list:
    """All bots with health indicators and health_score"""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # This is a heavy query, in prod we would materialize these stats
    query = db.table("bots").select("""
        id, name, slug, owner_id,
        profiles:owner_id(full_name, email),
        data_sources(status),
        conversations(created_at, message_count),
        whatsapp_configs(is_connected)
    """)
    
    if search:
        query = query.ilike("name", f"%{search}%") # simplified search
        
    res = await query.execute()
    
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
        
        if whatsapp_filter == "connected" and not has_whatsapp:
            continue
        if whatsapp_filter == "disconnected" and has_whatsapp:
            continue
        
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
            
        if health_filter == "healthy" and score != 3:
            continue
        if health_filter == "idle" and score != 2:
            continue
        if health_filter == "dead" and score != 1:
            continue
        if health_filter == "broken" and score != 0:
            continue
            
        health_data.append({
            "id": b["id"],
            "name": b["name"],
            "slug": b["slug"],
            "owner_id": b["owner_id"],
            "owner_name": b.get("profiles", {}).get("full_name") or b.get("profiles", {}).get("email"),
            "sources_count": len(sources),
            "ready_sources": len(ready_sources),
            "conversations_7d": len(recent_convs),
            "messages_7d": msg_count_7d,
            "last_activity": last_activity,
            "whatsapp_connected": has_whatsapp,
            "health_score": score
        })
        
    return {"data": health_data}

async def get_revenue_feed(db, limit=20) -> list:
    """Recent payment events from plan_changes"""
    res = await db.table("plan_changes").select("id, owner_id, changed_at, profiles(full_name), new_plan:new_plan_id(name, price_inr), old_plan:old_plan_id(name, price_inr)").order("changed_at", desc=True).limit(limit).execute()
    
    feed = []
    for r in (res.data or []):
        old_price = r.get("old_plan", {}).get("price_inr", 0) if isinstance(r.get("old_plan"), dict) else 0
        new_price = r.get("new_plan", {}).get("price_inr", 0) if isinstance(r.get("new_plan"), dict) else 0
        amount = new_price - old_price
        feed.append({
            "id": r["id"],
            "user_name": r.get("profiles", {}).get("full_name") or "Unknown User",
            "old_plan": r.get("old_plan", {}).get("name", "none") if isinstance(r.get("old_plan"), dict) else "none",
            "new_plan": r.get("new_plan", {}).get("name", "none") if isinstance(r.get("new_plan"), dict) else "none",
            "amount": abs(amount),
            "type": "upgrade" if amount > 0 else "downgrade"
        })
    return feed

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
