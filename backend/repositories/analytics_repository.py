from typing import List, Dict, Any, Optional, AsyncGenerator
from datetime import datetime

class AnalyticsRepository:
    def __init__(self, db):
        self.db = db

    async def apply_date_channel_filters(self, query, start: datetime, end: datetime, channel: str):
        query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
        if channel != "all":
            query = query.eq("channel", channel)
        return query

    async def get_bot_ids_for_owner(self, owner_id: str) -> List[str]:
        res = await self.db.table("bots").select("id").eq("owner_id", owner_id).execute()
        return [b["id"] for b in (res.data or [])]

    async def get_conversations(self, bot_ids: List[str], start: datetime, end: datetime, channel: str, select: str = "id, message_count, channel") -> List[Dict[str, Any]]:
        if not bot_ids: return []
        query = self.db.table("conversations").select(select).in_("bot_id", bot_ids)
        query = await self.apply_date_channel_filters(query, start, end, channel)
        res = await query.execute()
        return res.data or []
        
    async def get_conversations_for_bot(self, bot_id: str, start: datetime, end: datetime, channel: str, select: str = "id, message_count, channel") -> List[Dict[str, Any]]:
        query = self.db.table("conversations").select(select).eq("bot_id", bot_id)
        query = await self.apply_date_channel_filters(query, start, end, channel)
        res = await query.execute()
        return res.data or []

    async def stream_messages_in_batches(self, conv_ids: List[str], select_str: str, start: datetime, end: datetime, batch_size=500) -> AsyncGenerator[Dict[str, Any], None]:
        for i in range(0, len(conv_ids), batch_size):
            batch = conv_ids[i:i+batch_size]
            query = self.db.table("messages").select(select_str).in_("conversation_id", batch)
            query = query.gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
            res = await query.execute()
            for msg in (res.data or []):
                yield msg

    async def get_total_leads(self, bot_ids: List[str]) -> int:
        if not bot_ids: return 0
        res = await self.db.table("leads").select("id", count="exact").in_("bot_id", bot_ids).execute()
        return res.count if res.count is not None else 0

    async def get_profile_plan(self, user_id: str) -> Dict[str, Any]:
        res = await self.db.table("profiles").select("monthly_message_count, plans(*, plan_features(*))").eq("id", user_id).single().execute()
        data = res.data or {}
        
        if not data.get("plans"):
            plan_res = await self.db.table("plans").select("*, plan_features(*)").in_("name", ["free", "trial"]).limit(1).execute()
            if plan_res.data:
                data["plans"] = plan_res.data[0]
                
        if data.get("plans") and data["plans"].get("plan_features"):
            for f in data["plans"]["plan_features"]:
                data["plans"][f["feature_key"]] = f["feature_value"]
            del data["plans"]["plan_features"]
        return data

    async def get_data_sources_map(self, source_ids: List[str]) -> Dict[str, str]:
        if not source_ids: return {}
        res = await self.db.table("data_sources").select("id, name").in_("id", source_ids).execute()
        return {x["id"]: x.get("name", "Unknown") for x in (res.data or [])}

    async def get_suggestions(self, bot_id: str, status: str) -> List[Dict[str, Any]]:
        res = await self.db.table("suggestions").select("*").eq("bot_id", bot_id).eq("status", status).order("frequency", desc=True).execute()
        return res.data or []

    async def update_suggestion_status(self, bot_id: str, suggestion_id: str, status: str):
        await self.db.table("suggestions").update({"status": status}).eq("id", suggestion_id).eq("bot_id", bot_id).execute()
