import json
from datetime import datetime, timezone
from typing import Any, Dict

async def publish_admin_event(
    event_type: str,
    data: Dict[str, Any],
    redis
):
    """
    Publish an event to the admin realtime feed.
    Called from various parts of the codebase.
    Never raises — silently fails if Redis is down.
    """
    try:
        if redis is None:
            return
        payload = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        # Standard channel for general notifications
        await redis.publish("admin:feed", payload)
        
        # Also broadcast stats_update for automatic UI refetching if it's a data change
        if event_type in ["new_signup", "new_payment", "new_bot", "plan_change", "trial_extension", "user_banned"]:
            await redis.publish("admin:feed", json.dumps({
                "type": "stats_update",
                "data": {"message": f"Auto-refresh triggered by {event_type}"},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            
    except Exception:
        pass  # Never crash main flow for admin events
