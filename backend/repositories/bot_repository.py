from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
import re

class BotRepository:
    def __init__(self, db):
        self.db = db

    async def verify_ownership(self, bot_id: str, user_id: str) -> dict:
        bot_res = await self.db.table("bots").select("*").eq("id", bot_id).eq("owner_id", user_id).is_("deleted_at", "null").limit(1).execute()
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found or not owned by user")
        return bot_res.data[0]

    async def create(self, owner_id: str, name: str, slug: str) -> dict:
        try:
            insert_res = await self.db.table("bots").insert({
                "owner_id": owner_id,
                "name": name,
                "slug": slug
            }).execute()
            if not insert_res.data:
                raise HTTPException(status_code=500, detail="Failed to create bot.")
            return insert_res.data[0]
        except Exception as e:
            if "23505" in str(e) or "duplicate key" in str(e).lower():
                raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
            raise HTTPException(status_code=500, detail="Database error creating bot. Please try again.")

    async def get_full_bot(self, bot_id: str) -> dict:
        bot_res = await self.db.table("bots").select(
            "*, bot_settings(*), bot_appearance(*), whatsapp_configs(*), data_sources(*)"
        ).eq("id", bot_id).is_("deleted_at", "null").limit(1).execute()
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        return bot_res.data[0]

    async def list_with_stats(self, owner_id: str) -> List[dict]:
        bots_res = await self.db.table("bots").select("*").eq("owner_id", owner_id).is_("deleted_at", "null").execute()
        bots = bots_res.data
        if not bots:
            return []

        bot_ids = [b["id"] for b in bots]
        
        sources_res = await self.db.table("data_sources").select("bot_id, chunk_count").in_("bot_id", bot_ids).execute()
        chunk_counts = {}
        for s in sources_res.data:
            bid = s["bot_id"]
            chunk_counts[bid] = chunk_counts.get(bid, 0) + (s["chunk_count"] or 0)
            
        start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        conv_res = await self.db.table("conversations").select("bot_id, message_count").in_("bot_id", bot_ids).gte("created_at", start_of_month).execute()
        msg_counts = {}
        for conv in conv_res.data:
            bid = conv["bot_id"]
            msg_counts[bid] = msg_counts.get(bid, 0) + (conv.get("message_count", 0))
            
        leads_res = await self.db.table("leads").select("bot_id").in_("bot_id", bot_ids).execute()
        lead_counts = {}
        for lead in (leads_res.data or []):
            bid = lead["bot_id"]
            lead_counts[bid] = lead_counts.get(bid, 0) + 1
            
        for b in bots:
            b["chunk_count"] = chunk_counts.get(b["id"], 0)
            b["message_count"] = msg_counts.get(b["id"], 0)
            b["lead_count"] = lead_counts.get(b["id"], 0)
            
        return bots

    async def update(self, bot_id: str, owner_id: str, update_data: Dict[str, Any]) -> dict:
        if not update_data:
            return {"status": "ok"}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            res = await self.db.table("bots").update(update_data).eq("id", bot_id).eq("owner_id", owner_id).is_("deleted_at", "null").execute()
        except Exception as e:
            if "23505" in str(e) or "duplicate key" in str(e).lower():
                raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
            raise HTTPException(status_code=500, detail="Database error updating bot. Please try again.")
        return res.data[0] if res.data else {"status": "updated"}

    async def delete(self, bot_id: str):
        await self.db.table("bots").update({
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", bot_id).execute()

    async def upsert_settings(self, bot_id: str, update_data: Dict[str, Any]):
        await self.db.table("bot_settings").upsert({
            "bot_id": bot_id,
            **update_data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()

    async def upsert_appearance(self, bot_id: str, update_data: Dict[str, Any]):
        await self.db.table("bot_appearance").upsert({
            "bot_id": bot_id,
            **update_data
        }).execute()

    async def upsert_notifications(self, bot_id: str, update_data: Dict[str, Any]):
        await self.db.table("notification_settings").upsert({
            "bot_id": bot_id,
            **update_data
        }).execute()
