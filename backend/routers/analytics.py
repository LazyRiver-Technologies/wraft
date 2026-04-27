from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import string
import asyncio

from database import get_db
from middleware.auth import get_current_user
from routers.bots import verify_bot_ownership
from services.limits import check_feature_access

router = APIRouter()

# --- Helper logic for date parsing ---
def get_date_bounds(start_date: Optional[str], end_date: Optional[str]):
    try:
        end = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
        start = datetime.fromisoformat(start_date) if start_date else (end - timedelta(days=30))
        return start, end
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

async def apply_date_and_channel_filters(query, start: datetime, end: datetime, channel: str):
    query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
    if channel != "all":
        query = query.eq("channel", channel)
    return query

async def stream_messages_in_batches(db, conv_ids: list[str], select_str: str, start: datetime, end: datetime, batch_size=500):
    """
    Streams messages from the database in safe batches to prevent URL length limits 
    and Out-of-Memory (OOM) crashes by yielding rows one-by-one.
    """
    for i in range(0, len(conv_ids), batch_size):
        batch = conv_ids[i:i+batch_size]
        query = db.table("messages").select(select_str).in_("conversation_id", batch)
        query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
        res = await query.execute()
        for msg in (res.data or []):
            yield msg


# --- Endpoints ---

@router.get("/overview")
async def get_global_overview(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    # Fetch all bots owned by user
    bots_res = await db.table("bots").select("id").eq("owner_id", user.id).execute()
    bot_ids = [b["id"] for b in (bots_res.data or [])]
    
    if not bot_ids:
        return {
            "total_conversations": 0,
            "total_messages": 0,
            "avg_messages_per_conversation": 0.0,
            "cache_hit_rate": 0.0,
            "avg_response_latency_ms": 0.0,
            "web_vs_whatsapp": {"web": 0, "whatsapp": 0},
            "tokens_used_this_month": 0,
            "messages_remaining_this_month": 0,
            "total_leads": 0
        }

    start, end = get_date_bounds(start_date, end_date)

    # 1. Conversations
    conv_query = db.table("conversations").select("id, message_count, channel").in_("bot_id", bot_ids)
    conv_query = await apply_date_and_channel_filters(conv_query, start, end, channel)
    conv_res = await conv_query.execute()
    conversations = conv_res.data or []
    
    total_convs = len(conversations)
    total_msgs = sum(c.get("message_count", 0) for c in conversations)
    avg_msgs = total_msgs / total_convs if total_convs > 0 else 0.0
    
    web_count = sum(1 for c in conversations if c.get("channel") == "web")
    wa_count = sum(1 for c in conversations if c.get("channel") == "whatsapp")

    # 2. Messages (Processed via streaming memory-safe generator)
    cache_hits = 0
    total_messages_actual = 0
    total_latency = 0.0
    latency_count = 0
    tokens_used = 0

    if conversations:
        conv_ids = [c["id"] for c in conversations]
        async for m in stream_messages_in_batches(db, conv_ids, "cache_hit, latency_ms, tokens_used", start, end):
            total_messages_actual += 1
            if m.get("cache_hit"):
                cache_hits += 1
            if m.get("latency_ms") is not None:
                total_latency += m["latency_ms"]
                latency_count += 1
            tokens_used += m.get("tokens_used", 0)
        
    cache_hit_rate = cache_hits / total_messages_actual if total_messages_actual > 0 else 0.0
    avg_latency = total_latency / latency_count if latency_count > 0 else 0.0

    # 3. Leads
    leads_res = await db.table("leads").select("id", count="exact").in_("bot_id", bot_ids).execute()
    total_leads = leads_res.count if leads_res.count is not None else 0

    # 4. Plan limits
    plan_res = await db.table("profiles").select("monthly_message_count, plans(max_messages_per_month)").eq("id", user.id).single().execute()
    profile = plan_res.data or {}
    
    messages_remaining = 0
    if profile.get("plans"):
        max_messages = profile["plans"].get("max_messages_per_month")
        used_messages = profile.get("monthly_message_count") or 0
        if max_messages is not None:
             messages_remaining = max_messages - used_messages

    return {
        "total_conversations": total_convs,
        "total_messages": total_msgs,
        "avg_messages_per_conversation": avg_msgs,
        "cache_hit_rate": cache_hit_rate,
        "avg_response_latency_ms": avg_latency,
        "web_vs_whatsapp": {"web": web_count, "whatsapp": wa_count},
        "tokens_used_this_month": tokens_used,
        "messages_remaining_this_month": messages_remaining,
        "total_leads": total_leads
    }

@router.get("/conversations-over-time")
async def get_global_conversations_over_time(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    bots_res = await db.table("bots").select("id").eq("owner_id", user.id).execute()
    bot_ids = [b["id"] for b in (bots_res.data or [])]
    if not bot_ids: return {"data": []}

    start, end = get_date_bounds(start_date, end_date)
    query = db.table("conversations").select("created_at").in_("bot_id", bot_ids)
    query = await apply_date_and_channel_filters(query, start, end, channel)
    res = await query.execute()

    counts: dict[str, int] = defaultdict(int)
    for c in (res.data or []):
        day_str = c["created_at"].split("T")[0]
        counts[day_str] += 1
        
    data = [{"date": k, "count": v} for k, v in sorted(counts.items())]
    return {"data": data}

@router.get("/{bot_id}/overview")
async def get_overview(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    start, end = get_date_bounds(start_date, end_date)

    # Note: To exactly match schema, we pull conversations and messages.
    # In Supabase REST without rpc, we fetch necessary aggregations or pull data natively.
    # For robust analytical overviews under light-load environments, we fetch and process if RPC is unavailable.
    
    # 1. Conversations
    conv_query = db.table("conversations").select("id, message_count, channel").eq("bot_id", bot_id)
    conv_query = await apply_date_and_channel_filters(conv_query, start, end, channel)
    conv_res = await conv_query.execute()
    conversations = conv_res.data or []
    
    total_convs = len(conversations)
    total_msgs = sum(c.get("message_count", 0) for c in conversations)
    avg_msgs = total_msgs / total_convs if total_convs > 0 else 0.0
    
    web_count = sum(1 for c in conversations if c.get("channel") == "web")
    wa_count = sum(1 for c in conversations if c.get("channel") == "whatsapp")

    # 2. Messages (Processed via streaming memory-safe generator)
    cache_hits = 0
    total_messages_actual = 0
    total_latency = 0.0
    latency_count = 0
    tokens_used = 0

    if conversations:
        conv_ids = [c["id"] for c in conversations]
        async for m in stream_messages_in_batches(db, conv_ids, "cache_hit, latency_ms, tokens_used", start, end):
            total_messages_actual += 1
            if m.get("cache_hit"):
                cache_hits += 1
            if m.get("latency_ms") is not None:
                total_latency += m["latency_ms"]
                latency_count += 1
            tokens_used += m.get("tokens_used", 0)
        
    cache_hit_rate = cache_hits / total_messages_actual if total_messages_actual > 0 else 0.0
    avg_latency = total_latency / latency_count if latency_count > 0 else 0.0
    
    # 3. Monthly token & Plan limits execution simultaneously using Asyncio Gathering natively
    plan_future = db.table("profiles").select("monthly_message_count, plans(max_messages_per_month)").eq("id", user.id).single().execute()
    
    # Because plan isn't structurally parallel safe inside Postgrest wrapper if sharing session, we must await explicitly,
    # but we can do it asynchronously alongside heavy ops earlier if refactored.
    # Note: I'll leave the profile gathering synced because native gather requires separate DB pool sessions conceptually,
    # but I'll optimize list slicing above.
    
    plan_res = await plan_future
    profile = plan_res.data or {}
    
    messages_remaining = 0
    if profile.get("plans"):
        max_messages = profile["plans"].get("max_messages_per_month")
        used_messages = profile.get("monthly_message_count") or 0
        if max_messages is not None:
             messages_remaining = max_messages - used_messages

    return {
        "total_conversations": total_convs,
        "total_messages": total_msgs,
        "avg_messages_per_conversation": avg_msgs,
        "cache_hit_rate": cache_hit_rate,
        "avg_response_latency_ms": avg_latency,
        "web_vs_whatsapp": {"web": web_count, "whatsapp": wa_count},
        "tokens_used_this_month": tokens_used,
        "messages_remaining_this_month": messages_remaining
    }


@router.get("/{bot_id}/conversations-over-time")
async def get_conversations_over_time(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    start, end = get_date_bounds(start_date, end_date)

    query = db.table("conversations").select("created_at").eq("bot_id", bot_id)
    query = await apply_date_and_channel_filters(query, start, end, channel)
    res = await query.execute()

    counts: dict[str, int] = defaultdict(int)
    for c in (res.data or []):
        day_str = c["created_at"].split("T")[0]
        counts[day_str] += 1
        
    data = [{"date": k, "count": v} for k, v in sorted(counts.items())]
    return {"data": data}


@router.get("/{bot_id}/drop-off")
async def get_drop_off(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    start, end = get_date_bounds(start_date, end_date)

    query = db.table("conversations").select("message_count").eq("bot_id", bot_id)
    query = await apply_date_and_channel_filters(query, start, end, channel)
    res = await query.execute()
    
    conversations = res.data or []
    
    dropoff_1 = 0
    dropoff_2 = 0
    dropoff_3 = 0
    dropoff_4_plus = 0
    
    total_messages = 0
    for c in conversations:
        mc = c.get("message_count", 0)
        total_messages += mc
        if mc == 1:
            dropoff_1 += 1
        elif mc == 2:
            dropoff_2 += 1
        elif mc == 3:
            dropoff_3 += 1
        elif mc >= 4:
            dropoff_4_plus += 1
            
    avg_len = total_messages / len(conversations) if conversations else 0.0
    
    return {
        "drop_off_at_message_1": dropoff_1,
        "drop_off_at_message_2": dropoff_2,
        "drop_off_at_message_3": dropoff_3,
        "drop_off_at_message_4_plus": dropoff_4_plus,
        "avg_conversation_length": avg_len
    }


@router.get("/{bot_id}/sentiment")
async def get_sentiment(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    start, end = get_date_bounds(start_date, end_date)

    # Normally channel filtering requires join with conversations.
    # We fetch conversation ids first to filter properly
    conv_query = db.table("conversations").select("id").eq("bot_id", bot_id)
    conv_query = await apply_date_and_channel_filters(conv_query, start, end, channel)
    conv_res = await conv_query.execute()
    conv_ids = [c["id"] for c in (conv_res.data or [])]

    if not conv_ids:
        return {"data": []}

    date_groups: dict[str, dict[str, float]] = defaultdict(lambda: {"total": 0.0, "count": 0, "pos": 0, "neg": 0, "neut": 0})
    
    if conv_ids:
        async for m in stream_messages_in_batches(db, conv_ids, "created_at, sentiment_score", start, end):
            score = m.get("sentiment_score", 0.0)
            if score is None: score = 0.0
                
            day_str = m["created_at"].split("T")[0]
            
            grp = date_groups[day_str]
            grp["total"] += score
            grp["count"] += 1
            
            if score > 0.2: grp["pos"] += 1
            elif score < -0.2: grp["neg"] += 1
            else: grp["neut"] += 1
        
    data = []
    for date_str, grp in sorted(date_groups.items()):
        avg_score = grp["total"] / grp["count"] if grp["count"] > 0 else 0.0
        data.append({
            "date": date_str,
            "avg_sentiment": round(avg_score, 2),
            "positive": grp["pos"],
            "negative": grp["neg"],
            "neutral": grp["neut"]
        })
        
    return {"data": data}


@router.get("/{bot_id}/sources-performance")
async def get_sources_performance(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    start, end = get_date_bounds(start_date, end_date)

    conv_query = db.table("conversations").select("id").eq("bot_id", bot_id)
    conv_query = await apply_date_and_channel_filters(conv_query, start, end, channel)
    conv_res = await conv_query.execute()
    conv_ids = [c["id"] for c in (conv_res.data or [])]

    if not conv_ids:
        return {"data": []}

    source_counts: dict[str, int] = defaultdict(int)
    
    if conv_ids:
        async for m in stream_messages_in_batches(db, conv_ids, "sources", start, end):
            sources = m.get("sources", [])
            if sources and isinstance(sources, list):
                for s_id in sources:
                    source_counts[s_id] += 1
                
    if not source_counts:
        return {"data": []}
        
    s_ids = list(source_counts.keys())
    
    # Resolve names
    sources_req = db.table("data_sources").select("id, name").in_("id", s_ids)
    sources_res = await sources_req.execute()
    db_sources = {x["id"]: x.get("name", "Unknown") for x in (sources_res.data or [])}
    
    # In case a source was deleted but message retains ID, fallback to "Deleted Source"
    data = []
    for sid, count in source_counts.items():
        data.append({
            "source_id": sid,
            "source_name": db_sources.get(sid, f"Deleted Source ({sid})"),
            "citation_count": count
        })
        
    data.sort(key=lambda x: x["citation_count"], reverse=True)
    return {"data": data}

@router.get("/{bot_id}/suggestions")
async def get_suggestions(bot_id: str, status: str = Query("pending"), user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "advanced_analytics", db)
    res = await db.table("suggestions").select("*").eq("bot_id", bot_id).eq("status", status).order("frequency", desc=True).execute()
    return {"data": res.data or []}

@router.patch("/{bot_id}/suggestions/{suggestion_id}")
async def patch_suggestion(bot_id: str, suggestion_id: str, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    s_val = payload.get("status")
    if s_val not in ("added_qa", "dismissed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.table("suggestions").update({"status": s_val}).eq("id", suggestion_id).eq("bot_id", bot_id).execute()
    return {"status": "ok"}
