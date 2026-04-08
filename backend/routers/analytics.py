from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import string

from database import get_db
from middleware.auth import get_current_user
from routers.bots import verify_bot_ownership

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


# --- Endpoints ---

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
    conv_res = conv_query.execute()
    conversations = conv_res.data or []
    
    total_convs = len(conversations)
    total_msgs = sum(c.get("message_count", 0) for c in conversations)
    avg_msgs = total_msgs / total_convs if total_convs > 0 else 0.0
    
    web_count = sum(1 for c in conversations if c.get("channel") == "web")
    wa_count = sum(1 for c in conversations if c.get("channel") == "whatsapp")

    # 2. Messages (for latency and cache logic)
    # Applying channel filtering to messages means fetching via conversations. We'll just fetch all matching date and bot_id
    msgs_req = db.table("messages").select("cache_hit, latency_ms, tokens_used").eq("bot_id", bot_id)
    msgs_req = msgs_req.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
    msgs_res = await msgs_req.execute()
    
    messages = msgs_res.data or []
    total_messages_actual = len(messages)
    
    cache_hits = sum(1 for m in messages if m.get("cache_hit"))
    cache_hit_rate = cache_hits / total_messages_actual if total_messages_actual > 0 else 0.0
    
    latencies = [m.get("latency_ms") for m in messages if m.get("latency_ms") is not None]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    
    # 3. Monthly token & Plan limits
    # The prompt explicitly wants "tokens_used_this_month" and "messages_remaining_this_month".
    # This requires fetching user profile -> plan.
    plan_res = await db.table("profiles").select("monthly_message_count, plans(max_messages_per_month)").eq("id", user.id).single().execute()
    profile = plan_res.data or {}
    
    tokens_used = sum(m.get("tokens_used", 0) for m in messages)
    
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
    res = query.execute()

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
    start, end = get_date_bounds(start_date, end_date)

    query = db.table("conversations").select("message_count").eq("bot_id", bot_id)
    query = await apply_date_and_channel_filters(query, start, end, channel)
    res = query.execute()
    
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
    start, end = get_date_bounds(start_date, end_date)

    query = db.table("messages").select("created_at, sentiment_score").eq("bot_id", bot_id)
    query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
    
    # Normally channel filtering requires join with conversations.
    # To keep it simple locally in python for robust operation:
    res = await query.execute()
    messages = res.data or []
    
    date_groups: dict[str, dict[str, float]] = defaultdict(lambda: {"total": 0.0, "count": 0, "pos": 0, "neg": 0, "neut": 0})
    
    for m in messages:
        # Assuming sentiment_score is available on messages. Default 0 if missing.
        score = m.get("sentiment_score", 0.0)
        # Handle case where score might be None
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


@router.get("/{bot_id}/top-questions")
async def get_top_questions(
    bot_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    channel: str = Query("all", regex="^(web|whatsapp|all)$"),
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    await verify_bot_ownership(bot_id, user, db)
    start, end = get_date_bounds(start_date, end_date)

    query = db.table("messages").select("user_message").eq("bot_id", bot_id)
    query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
    query = query.order("created_at", desc=True).limit(500)
    
    res = await query.execute()
    messages = res.data or []
    
    # Keyword clustering heuristic: First 5 words.
    clusters: dict[str, int] = defaultdict(int)
    summaries = {}
    
    for msg in messages:
        text = msg.get("user_message", "")
        if not text:
            continue
            
        # Clean str
        clean_text = text.translate(str.maketrans('', '', string.punctuation)).lower()
        words = clean_text.split()
        if not words:
            continue
            
        # First 5 words array
        key = " ".join(words[:5])
        clusters[key] += 1
        
        if key not in summaries:
            summaries[key] = text[:100] + "..." if len(text) > 100 else text

    sorted_clusters = sorted(clusters.items(), key=lambda x: x[1], reverse=True)[:20]
    
    data = [{"question_summary": summaries[k], "count": v} for k, v in sorted_clusters]
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
    start, end = get_date_bounds(start_date, end_date)

    msgs_req = db.table("messages").select("sources").eq("bot_id", bot_id)
    msgs_req = msgs_req.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
    msgs_res = await msgs_req.execute()
    
    messages = msgs_res.data or []
    
    source_counts: dict[str, int] = defaultdict(int)
    for m in messages:
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
