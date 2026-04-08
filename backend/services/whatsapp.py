import hmac
import hashlib
import json
import httpx

class WhatsAppError(Exception):
    pass

BASE_URL = "https://graph.facebook.com/v19.0"

async def send_whatsapp_message(phone_number_id: str, access_token: str, to: str, message: str) -> None:
    """
    Sends a text message using the Meta WhatsApp Cloud API.
    Truncates message to 4096 characters.
    """
    if len(message) > 4096:
        message = message[:4093] + "..."
        
    url = f"{BASE_URL}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=15.0)
        
        if response.status_code != 200:
            err_msg = response.text
            try:
                err_data = response.json()
                err_msg = err_data.get("error", {}).get("message", err_msg)
            except:
                pass
            raise WhatsAppError(f"Meta API Error ({response.status_code}): {err_msg}")

async def verify_meta_signature(payload: bytes, signature: str, app_secret: str) -> bool:
    """
    Timing-safe HMAC-SHA256 signature verification for Meta webhooks.
    """
    if not signature or not signature.startswith("sha256="):
        return False
        
    signature_hash = signature.split("sha256=", 1)[1]
    
    expected_hmac = hmac.new(
        app_secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_hmac, signature_hash)

def parse_whatsapp_message(payload: dict) -> tuple[str, str, str] | None:
    """
    Extracts purely text WhatsApp messages from the Meta webhook payload.
    Returns (from_number, message_text, message_id) or None.
    """
    try:
        entries = payload.get("entry", [])
        if not entries:
            return None
            
        changes = entries[0].get("changes", [])
        if not changes:
            return None
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            return None
            
        message_obj = messages[0]
        
        # We ignore non-text messages for now
        if message_obj.get("type") != "text":
            return None
            
        from_number = message_obj.get("from")
        message_id = message_obj.get("id")
        message_text = message_obj.get("text", {}).get("body")
        
        if not from_number or not message_id or not message_text:
            return None
            
        return from_number, message_text, message_id
        
    except (IndexError, KeyError):
        return None
