import logging
from services.notifications import send_owner_notification

logger = logging.getLogger(__name__)

def get_action_tools(bot_actions: list) -> list:
    """
    Convert bot_actions DB rows into Gemini function declarations.
    Only called if bot has active actions — keeps prompts lean 
    for bots without actions.
    """
    tools = []
    
    for action in bot_actions:
        action_type = action.get("action_type")
        config = action.get("config", {})
        
        if action_type == "notify_owner":
            tools.append({
                "name": "notify_owner",
                "description": "Notify the business owner on WhatsApp when customer needs urgent help or has a specific request that needs human attention",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "reason": {
                            "type": "STRING", 
                            "description": "Why owner needs to be notified"
                        },
                        "customer_message": {
                            "type": "STRING",
                            "description": "Customer's exact message"
                        }
                    },
                    "required": ["reason", "customer_message"]
                }
            })
        
        elif action_type == "calculate_quote":
            items = config.get("items", [])
            items_desc = ", ".join([
                f"{item.get('name')} at ₹{item.get('rate')} per {item.get('unit')}"
                for item in items
            ])
            tools.append({
                "name": "calculate_quote",
                "description": f"Calculate price quote for services. Available: {items_desc}",
                "parameters": {
                    "type": "OBJECT", 
                    "properties": {
                        "item_name": {
                            "type": "STRING",
                            "description": "Name of service/product"
                        },
                        "quantity": {
                            "type": "NUMBER",
                            "description": "Amount/quantity needed"
                        }
                    },
                    "required": ["item_name", "quantity"]
                }
            })
        
        elif action_type == "check_availability":
            tools.append({
                "name": "check_availability",
                "description": "Check if a product or service is currently available",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "item_name": {
                            "type": "STRING",
                            "description": "Product or service to check"
                        }
                    },
                    "required": ["item_name"]
                }
            })
            
    return tools

async def execute_action(
    action_type: str,
    parameters: dict,
    bot_id: str,
    bot_actions: list,
    db,
    redis
) -> str:
    """
    Execute the action and return a string result 
    that gets injected back into the conversation.
    """
    action = next((a for a in bot_actions if a.get("action_type") == action_type), None)
    if not action: 
        return "Action not available"
    
    # Increment trigger_count
    try:
        current_trigger_count = action.get("trigger_count", 0)
        await db.table("bot_actions").update(
            {"trigger_count": current_trigger_count + 1}
        ).eq("id", action.get("id")).execute()
    except Exception as e:
        logger.error(f"Failed to bump action trigger_count: {e}")
    
    if action_type == "notify_owner":
        notif_res = await db.table("notification_settings").select("*").eq("bot_id", bot_id).single().execute()
        if notif_res and notif_res.data:
            await send_owner_notification(
                owner_whatsapp=notif_res.data.get("owner_whatsapp"),
                notification_type="escalation_requested",
                data={
                    "bot_name": "Bot",
                    "reason": parameters.get("reason", ""),
                    "last_message": parameters.get("customer_message", "")
                },
                bot_id=bot_id, 
                db=db, 
                redis=redis
            )
        return "I've notified our team. Someone will reach out to you on WhatsApp shortly."
    
    elif action_type == "calculate_quote":
        item_name = parameters.get("item_name", "").lower()
        quantity = float(parameters.get("quantity", 0))
        config = action.get("config", {})
        items = config.get("items", [])
        
        matched = next((i for i in items if item_name in i.get("name", "").lower()), None)
        
        if not matched:
            return f"Sorry, I don't have pricing for {item_name}. Please contact us directly."
            
        rate = float(matched.get("rate", 0))
        total = rate * quantity
        return f"{matched.get('name')}: ₹{rate} per {matched.get('unit')} × {quantity} = ₹{total:,.0f}"
    
    elif action_type == "check_availability":
        item_name = parameters.get("item_name", "").lower()
        config = action.get("config", {})
        items = config.get("items", [])
        
        matched = next((i for i in items if item_name in i.get("name", "").lower()), None)
        
        if not matched:
            return f"I don't have availability info for {item_name}."
            
        status = "available" if matched.get("available") else "out of stock"
        return f"{matched.get('name')} is currently {status}"
    
    return "Action completed"
