from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from fastapi import HTTPException

from repositories.analytics_repository import AnalyticsRepository

class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository):
        self.repo = repo

    def get_date_bounds(self, start_date: Optional[str], end_date: Optional[str]) -> tuple[datetime, datetime]:
        try:
            end = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
            start = datetime.fromisoformat(start_date) if start_date else (end - timedelta(days=30))
            return start, end
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")

    async def get_overview(self, user_id: str, bot_ids: List[str], start_date: Optional[str], end_date: Optional[str], channel: str) -> Dict[str, Any]:
        if not bot_ids:
            return self._empty_overview()

        start, end = self.get_date_bounds(start_date, end_date)
        conversations = await self.repo.get_conversations(bot_ids, start, end, channel)
        
        total_convs = len(conversations)
        total_msgs = sum(c.get("message_count", 0) for c in conversations)
        avg_msgs = total_msgs / total_convs if total_convs > 0 else 0.0
        
        web_count = sum(1 for c in conversations if c.get("channel") == "web")
        wa_count = sum(1 for c in conversations if c.get("channel") == "whatsapp")

        cache_hits = 0
        total_messages_actual = 0
        total_latency = 0.0
        latency_count = 0
        tokens_used = 0

        if conversations:
            conv_ids = [c["id"] for c in conversations]
            async for m in self.repo.stream_messages_in_batches(conv_ids, "cache_hit, latency_ms, tokens_in, tokens_out", start, end):
                total_messages_actual += 1
                if m.get("cache_hit"):
                    cache_hits += 1
                if m.get("latency_ms") is not None:
                    total_latency += m["latency_ms"]
                    latency_count += 1
                tokens_used += (m.get("tokens_in", 0) + m.get("tokens_out", 0))
            
        cache_hit_rate = cache_hits / total_messages_actual if total_messages_actual > 0 else 0.0
        avg_latency = total_latency / latency_count if latency_count > 0 else 0.0

        total_leads = await self.repo.get_total_leads(bot_ids)
        profile = await self.repo.get_profile_plan(user_id)
        
        messages_remaining = 0
        max_messages = 5000
        if profile.get("plans"):
            max_messages = profile["plans"].get("max_messages_per_month", 5000)
            used_messages = profile.get("monthly_message_count", 0)
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
            "max_messages_per_month": max_messages,
            "total_leads": total_leads
        }

    async def get_conversations_over_time(self, bot_ids: List[str], start_date: Optional[str], end_date: Optional[str], channel: str) -> Dict[str, List[Dict[str, Any]]]:
        if not bot_ids: return {"data": []}

        start, end = self.get_date_bounds(start_date, end_date)
        conversations = await self.repo.get_conversations(bot_ids, start, end, channel, select="created_at")

        counts: Dict[str, int] = defaultdict(int)
        for c in conversations:
            day_str = c["created_at"].split("T")[0]
            counts[day_str] += 1
            
        data = [{"date": k, "count": v} for k, v in sorted(counts.items())]
        return {"data": data}

    async def get_drop_off(self, bot_id: str, start_date: Optional[str], end_date: Optional[str], channel: str) -> Dict[str, Any]:
        start, end = self.get_date_bounds(start_date, end_date)
        conversations = await self.repo.get_conversations_for_bot(bot_id, start, end, channel, select="message_count")
        
        dropoff_1 = dropoff_2 = dropoff_3 = dropoff_4_plus = total_messages = 0
        
        for c in conversations:
            mc = c.get("message_count", 0)
            total_messages += mc
            if mc == 1: dropoff_1 += 1
            elif mc == 2: dropoff_2 += 1
            elif mc == 3: dropoff_3 += 1
            elif mc >= 4: dropoff_4_plus += 1
                
        avg_len = total_messages / len(conversations) if conversations else 0.0
        
        return {
            "drop_off_at_message_1": dropoff_1,
            "drop_off_at_message_2": dropoff_2,
            "drop_off_at_message_3": dropoff_3,
            "drop_off_at_message_4_plus": dropoff_4_plus,
            "avg_conversation_length": avg_len
        }

    async def get_sentiment(self, bot_id: str, start_date: Optional[str], end_date: Optional[str], channel: str) -> Dict[str, List[Dict[str, Any]]]:
        start, end = self.get_date_bounds(start_date, end_date)
        conversations = await self.repo.get_conversations_for_bot(bot_id, start, end, channel, select="id")
        conv_ids = [c["id"] for c in conversations]

        if not conv_ids:
            return {"data": []}

        date_groups: Dict[str, Dict[str, float]] = defaultdict(lambda: {"total": 0.0, "count": 0, "pos": 0, "neg": 0, "neut": 0})
        
        async for m in self.repo.stream_messages_in_batches(conv_ids, "created_at, sentiment_score", start, end):
            score = m.get("sentiment_score", 0.0) or 0.0
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

    async def get_sources_performance(self, bot_id: str, start_date: Optional[str], end_date: Optional[str], channel: str) -> Dict[str, List[Dict[str, Any]]]:
        start, end = self.get_date_bounds(start_date, end_date)
        conversations = await self.repo.get_conversations_for_bot(bot_id, start, end, channel, select="id")
        conv_ids = [c["id"] for c in conversations]

        if not conv_ids:
            return {"data": []}

        source_counts: Dict[str, int] = defaultdict(int)
        
        async for m in self.repo.stream_messages_in_batches(conv_ids, "sources", start, end):
            sources = m.get("sources", [])
            if sources and isinstance(sources, list):
                for s_id in sources:
                    source_counts[s_id] += 1
                    
        if not source_counts:
            return {"data": []}
            
        s_ids = list(source_counts.keys())
        db_sources = await self.repo.get_data_sources_map(s_ids)
        
        data = [
            {
                "source_id": sid,
                "source_name": db_sources.get(sid, f"Deleted Source ({sid})"),
                "citation_count": count
            }
            for sid, count in source_counts.items()
        ]
            
        data.sort(key=lambda x: x["citation_count"], reverse=True)
        return {"data": data}

    def _empty_overview(self) -> Dict[str, Any]:
        return {
            "total_conversations": 0, "total_messages": 0, "avg_messages_per_conversation": 0.0,
            "cache_hit_rate": 0.0, "avg_response_latency_ms": 0.0,
            "web_vs_whatsapp": {"web": 0, "whatsapp": 0},
            "tokens_used_this_month": 0, "messages_remaining_this_month": 0, "total_leads": 0,
            "max_messages_per_month": 5000
        }
