import json
import logging
from bullmq import Queue
from config import settings

logger = logging.getLogger(__name__)

# Initialize BullMQ queue for onboarding followups
onboarding_queue = Queue("onboarding_nudge", {"connection": {"host": settings.REDIS_HOST, "port": settings.REDIS_PORT, "password": settings.REDIS_PASSWORD}})

async def enqueue_onboarding_nudge(bot_id: str, bot_slug: str, owner_whatsapp: str, delay_ms: int, nudge_type: str, is_trial: bool = False):
    """
    Enqueue a delayed job in BullMQ to send a WhatsApp nudge.
    """
    try:
        await onboarding_queue.add(
            name=nudge_type,
            data={
                "bot_id": bot_id,
                "bot_slug": bot_slug,
                "owner_whatsapp": owner_whatsapp,
                "nudge_type": nudge_type,
                "is_trial": is_trial
            },
            opts={
                "delay": delay_ms
            }
        )
        logger.info(f"Enqueued {nudge_type} job for bot {bot_id} with delay {delay_ms}ms")
    except Exception as e:
        logger.error(f"Failed to enqueue onboarding nudge: {e}")
