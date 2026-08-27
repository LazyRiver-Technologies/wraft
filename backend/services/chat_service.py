import re
import asyncio
from datetime import datetime, timezone
from fastapi import HTTPException
from typing import Dict, Any

from repositories.chat_repository import ChatRepository
from services.rag import get_rag_response
from services.notifications import send_owner_notification
from utils.limits import get_strict_plan

class ChatService:
    def __init__(self, repo: ChatRepository, db, redis):
        self.repo = repo
        self.db = db
        self.redis = redis

    async def process_message(self, bot_slug: str, session_id: str, channel: str, message: str, background_tasks) -> Dict[str, Any]:
        # 1. Fetch Bot Configuration
        bot = await self.repo.get_bot_by_slug(bot_slug)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if not bot.get("is_active", True):
            raise HTTPException(status_code=404, detail="Bot is disabled")

        bot_id = bot["id"]
        owner_id = bot["owner_id"]
        bot_name = bot.get("name", "AI Bot")
        bot_settings = bot.get("bot_settings") or {}
        
        raw_notifs = bot.get("notification_settings")
        if isinstance(raw_notifs, list):
            ns = raw_notifs[0] if raw_notifs else {}
        elif isinstance(raw_notifs, dict):
            ns = raw_notifs
        else:
            ns = {}
        owner_whatsapp = ns.get("owner_whatsapp")

        # 2. Check Strict Plan Limits
        strict_data = await get_strict_plan(owner_id, self.db)
        plan = strict_data["plan"]
        current_msg_count = strict_data["monthly_message_count"]
        
        max_messages = plan.get("max_messages_per_month")
        if max_messages is not None and current_msg_count >= max_messages:
            return {
                "response": "This bot has reached its monthly message limit. Please upgrade your plan to continue.",
                "session_id": session_id,
                "sources": [],
                "cache_hit": False
            }

        # 3. Conversation & History
        conversation = await self.repo.get_or_create_conversation(bot_id, session_id, channel)
        conversation_id = conversation["id"]
        history = await self.repo.get_history(conversation_id, limit=6)
        
        # 4. Pre-RAG Lead Capture Evaluation
        lead_capture_enabled = bot_settings.get("lead_capture_enabled", False)
        lead_trigger = bot_settings.get("lead_capture_trigger", 2)
        new_message_count = conversation.get("message_count", 0) + 1
        
        has_lead = False
        if lead_capture_enabled:
            has_lead = await self.repo.check_lead_exists(conversation_id)

        if lead_capture_enabled and not has_lead and new_message_count == lead_trigger:
            trigger_msg = bot_settings.get("lead_capture_message", "May I have your name and WhatsApp number so we can follow up with you?")
            sys_prompt = bot_settings.get("system_prompt", "You are a helpful assistant.")
            bot_settings["system_prompt"] = f"{sys_prompt}\n\n[LEAD CAPTURE DIRECTIVE: You must politely ask for their contact details exactly stating: '{trigger_msg}']"

        # 5. Core NLP pipeline
        rag_result = await get_rag_response(
            question=message,
            bot_id=bot_id,
            bot_settings=bot_settings,
            conversation_history=history,
            owner_id=owner_id,
            channel=channel,
            db=self.db,
            redis=self.redis,
            bot_name=bot_name,
            background_tasks=background_tasks,
            conversation_id=conversation_id
        )

        # 6. Save Messages
        await self.repo.insert_messages([
            {
                "conversation_id": conversation_id,
                "bot_id": bot_id,
                "role": "user",
                "content": message,
                "tokens_in": len(message) // 4,  # Simple approximation
                "tokens_out": 0,
                "cost_paise": 0,
                "cache_hit": False,
                "sources": [],
                "latency_ms": 0
            },
            {
                "conversation_id": conversation_id,
                "bot_id": bot_id,
                "role": "assistant",
                "content": rag_result["response"],
                "tokens_in": 0,
                "tokens_out": rag_result.get("tokens_used", 0),
                "cost_paise": 0,
                "cache_hit": rag_result.get("cache_hit", False),
                "latency_ms": rag_result.get("latency_ms", 0),
                "sources": rag_result.get("sources", [])
            }
        ])

        # 7. Post-RAG Lead Capture Processing
        await self._evaluate_lead_capture(
            message=message,
            channel=channel,
            bot_id=bot_id,
            bot_name=bot_name,
            conversation_id=conversation_id,
            history=history,
            lead_capture_enabled=lead_capture_enabled,
            has_lead=has_lead,
            owner_whatsapp=owner_whatsapp
        )

        # 8. Non-Blocking Triggers (Notifications & Stats)
        self._dispatch_background_triggers(
            message=message,
            rag_result=rag_result,
            bot_id=bot_id,
            bot_name=bot_name,
            bot_settings=bot_settings,
            owner_whatsapp=owner_whatsapp,
            background_tasks=background_tasks
        )

        await self.repo.update_conversation_stats(conversation_id, new_message_count)
        await self.repo.increment_owner_message_count(owner_id, current_msg_count)
        
        # 9. Analytics Logging
        await self._log_analytics_events(bot_id, session_id, channel, message, rag_result)

        return {
            "response": rag_result["response"],
            "session_id": session_id,
            "sources": rag_result["sources"],
            "cache_hit": rag_result["cache_hit"],
            "confidence_score": rag_result.get("confidence_score", 0.0)
        }

    async def _evaluate_lead_capture(self, message: str, channel: str, bot_id: str, bot_name: str, conversation_id: str, history: list, lead_capture_enabled: bool, has_lead: bool, owner_whatsapp: str):
        if not lead_capture_enabled or has_lead:
            return

        phone_match = re.search(r'((\+91|91|0)?[6-9]\d{9})', message)
        if not phone_match:
            return

        phone_num = phone_match.group(1)
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', message)
        name_match = re.search(r'(?:my name is|name is|i am|i\'m|mera naam|ನನ್ನ ಹೆಸರು)\s+([A-Za-z\u0900-\u097F\u0C80-\u0CFF ]{2,60})', message, re.IGNORECASE)

        context_list = [{"role": m["role"], "content": m["content"]} for m in history[-2:]]
        context_list.append({"role": "user", "content": message})

        name = name_match.group(1).strip() if name_match else None
        
        await self.repo.insert_lead({
            "bot_id": bot_id,
            "conversation_id": conversation_id,
            "name": name,
            "phone": phone_num,
            "email": email_match.group(0) if email_match else None,
            "channel": channel,
            "context": context_list
        })

        if owner_whatsapp:
            background_tasks.add_task(
                send_owner_notification,
                owner_whatsapp=owner_whatsapp,
                notification_type="new_lead",
                data={
                    "bot_name": bot_name,
                    "name": name or "Anonymous",
                    "phone": phone_num,
                    "last_user_message": message[:100]
                },
                bot_id=bot_id, db=self.db, redis=self.redis
            )

    def _dispatch_background_triggers(self, message: str, rag_result: dict, bot_id: str, bot_name: str, bot_settings: dict, owner_whatsapp: str, background_tasks):
        """Dispatch notifications and async triggers based on responses safely isolated from main block"""
        
        if not owner_whatsapp:
            return
        
        # Determine sentiment or semantic guardrail trigger
        if rag_result.get("source") in ["guardrail_harmful", "guardrail_injection"]:
            background_tasks.add_task(
                send_owner_notification,
                owner_whatsapp=owner_whatsapp,
                notification_type="escalation",
                data={"bot_name": bot_name, "reason": "Guardrail triggered: " + rag_result.get("source")},
                bot_id=bot_id,
                db=self.db,
                redis=self.redis
            )
            
        elif rag_result.get("confidence_score", 1.0) < 0.45:
            background_tasks.add_task(
                send_owner_notification,
                owner_whatsapp=owner_whatsapp,
                notification_type="fallback",
                data={"bot_name": bot_name, "question": message[:100]},
                bot_id=bot_id,
                db=self.db,
                redis=self.redis
            )

        # Escalation Trigger
        ESCALATION_KEYWORDS = [
            "human", "agent", "person", "staff", "insaan", "banda", "koi", "manager",
            "ಮನುಷ್ಯ", "ಸಿಬ್ಬಂದಿ", "मनुष्य", "इंसान", "कोई आदमी"
        ]
        if any(kw in message.lower() for kw in ESCALATION_KEYWORDS):
            background_tasks.add_task(
                send_owner_notification,
                owner_whatsapp=owner_whatsapp,
                notification_type="escalation_requested",
                data={"bot_name": bot_name, "last_message": message[:150]},
                bot_id=bot_id, db=self.db, redis=self.redis
            )

    async def _log_analytics_events(self, bot_id: str, session_id: str, channel: str, message: str, rag_result: dict):
        events = [
            {"bot_id": bot_id, "event_type": "message_sent", "session_id": session_id, "properties": {"channel": channel}},
            {"bot_id": bot_id, "event_type": "message_received", "session_id": session_id, "properties": {"channel": channel}}
        ]
        
        source = rag_result.get("source", "")
        if source and source.startswith("guardrail_"):
            events.append({
                "bot_id": bot_id, 
                "event_type": "message_received", 
                "session_id": session_id,
                "properties": {
                    "channel": channel,
                    "guardrail_type": source,
                    "question_preview": message[:50]
                }
            })
            
        await self.repo.insert_analytics_events(events)
