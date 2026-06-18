from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

class ChatRepository:
    def __init__(self, db):
        self.db = db

    async def get_bot_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        res = await self.db.table("bots").select(
            "id, is_active, name, owner_id, bot_settings(*), notification_settings(*)"
        ).eq("slug", slug).limit(1).execute()
        return res.data[0] if res.data else None

    async def get_bot_basic(self, slug: str) -> Optional[Dict[str, Any]]:
        res = await self.db.table("bots").select("id").eq("slug", slug).limit(1).execute()
        return res.data[0] if res.data else None

    async def get_bot_appearance(self, slug: str) -> Optional[Dict[str, Any]]:
        res = await self.db.table("bots").select("id, name, owner_id, bot_appearance(*)").eq("slug", slug).limit(1).execute()
        return res.data[0] if res.data else None

    async def get_profile_watermark(self, owner_id: str) -> bool:
        try:
            res = await self.db.table("profiles").select("plans(show_watermark)").eq("id", owner_id).limit(1).execute()
            if res.data and res.data[0].get("plans"):
                return res.data[0]["plans"].get("show_watermark", True)
        except Exception:
            pass
        return True

    async def get_or_create_conversation(self, bot_id: str, session_id: str, channel: str) -> Dict[str, Any]:
        res = await self.db.table("conversations").select("*").eq("bot_id", bot_id).eq("session_id", session_id).execute()
        if res.data:
            return res.data[0]
            
        new_conv = await self.db.table("conversations").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "channel": channel,
            "message_count": 0
        }).execute()
        return new_conv.data[0] if new_conv.data else {}

    async def get_conversation_by_session(self, bot_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        res = await self.db.table("conversations").select("id").eq("bot_id", bot_id).eq("session_id", session_id).limit(1).execute()
        return res.data[0] if res.data else None

    async def get_history(self, conversation_id: str, limit: int = 6) -> List[Dict[str, Any]]:
        res = await self.db.table("messages").select("role, content").eq("conversation_id", conversation_id).order("created_at", desc=True).limit(limit).execute()
        raw_history = res.data or []
        return raw_history[::-1]
        
    async def get_full_history(self, conversation_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        res = await self.db.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=True).limit(limit).execute()
        data = res.data or []
        return data[::-1]

    async def check_lead_exists(self, conversation_id: str) -> bool:
        res = await self.db.table("leads").select("id").eq("conversation_id", conversation_id).execute()
        return bool(res.data and len(res.data) > 0)

    async def insert_messages(self, messages: List[Dict[str, Any]]):
        await self.db.table("messages").insert(messages).execute()

    async def insert_lead(self, lead_data: Dict[str, Any]):
        await self.db.table("leads").insert(lead_data).execute()

    async def update_conversation_stats(self, conversation_id: str, new_count: int):
        await self.db.table("conversations").update({
            "message_count": new_count,
            "last_active_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", conversation_id).execute()

    async def increment_owner_message_count(self, owner_id: str, current_count: int):
        try:
            await self.db.rpc("increment_profile_message_count", {
                "p_owner_id": owner_id,
                "p_increment": 1
            }).execute()
        except Exception:
            await self.db.table("profiles").update({
                "monthly_message_count": current_count + 1
            }).eq("id", owner_id).execute()

    async def insert_analytics_events(self, events: List[Dict[str, Any]]):
        await self.db.table("analytics_events").insert(events).execute()
