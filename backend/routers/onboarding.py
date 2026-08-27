from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
import google.generativeai as genai
import json
import re
import secrets
import random
import asyncio
from database import get_db
from middleware.auth import get_current_user
from redis_client import get_redis
from config import settings
from services.notifications import send_owner_notification
from ingestion.pipeline import run_ingestion_pipeline
from ingestion.embedder import embed_chunks
from services.onboarding_queue import enqueue_onboarding_nudge

router = APIRouter()

SYSTEM_PROMPTS = {
  "healthcare": "You are a helpful assistant for {name}, a healthcare provider. Help patients with appointments, timings, fees, and general queries. Never give medical advice or diagnose conditions. Always recommend consulting the doctor for medical questions.",
  "education": "You are an admissions assistant for {name}. Help students and parents with course details, fees, batch timings, and enrollment. Be encouraging and informative.",
  "retail": "You are a helpful shopping assistant for {name}. Help customers find products, check prices and availability. Be friendly and suggest alternatives when items are unavailable.",
  "food": "You are a helpful assistant for {name}. Help customers with the menu, timings, delivery information, and orders. Be warm and descriptive about food.",
  "real_estate": "You are a property assistant for {name}. Help clients find properties, understand pricing, and schedule site visits. Ask about budget and requirements to give better recommendations.",
  "local_services": "You are a helpful assistant for {name}. Help customers with service inquiries, pricing, availability, and booking. Be friendly and practical.",
  "professional_services": "You are a professional assistant for {name}. Help clients understand services, fees, and processes. Be clear and professional.",
  "saas_tech": "You are a product support assistant for {name}. Help users with features, pricing, and technical questions. Be clear and solution-focused.",
  "hospitality": "You are a concierge assistant for {name}. Help guests with availability, pricing, amenities, and bookings. Be warm and welcoming.",
  "other": "You are a helpful assistant for {name}. Answer customer questions accurately and helpfully. Be friendly and professional."
}

# --- Pydantic Models ---
class ClassifyRequest(BaseModel):
    description: str

class SetupRequest(BaseModel):
    business_type: str
    business_name: str
    display_name: str
    theme_color: str
    owner_name: str
    phone: str
    suggested_questions: List[str]

class TrainRequest(BaseModel):
    bot_id: str
    question: str
    answer: str

class CompleteRequest(BaseModel):
    bot_id: str

# --- Endpoints ---

@router.post("/classify")
async def classify_business(req: ClassifyRequest, user=Depends(get_current_user)):
    prompt = f"""
You are classifying an Indian business description.
Classify into exactly one of these types:
healthcare, education, retail, food, real_estate, 
local_services, professional_services, saas_tech, hospitality, other

Also provide:
1. display_name: clean English name (e.g. "Dental Clinic", "Tuition Center")
2. theme_color: best hex color for this business type
3. suggested_questions: array of 3 questions in English
   that customers of this business type ask most often

Business description: {req.description}

Return ONLY valid JSON, no markdown, no explanation:
{{
  "business_type": "healthcare",
  "display_name": "Dental Clinic", 
  "theme_color": "#00A86B",
  "suggested_questions": [
    "What is the consultation fee?",
    "What are the clinic timings?",
    "How do I book an appointment?"
  ]
}}
"""
    fallback_response = {
        "business_type": "other",
        "display_name": "Business",
        "theme_color": "#6366f1",
        "suggested_questions": ["What are your business hours?", "Where are you located?", "How can I contact you?"]
    }
    
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        # Clean up possible markdown wrappers
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        parsed_json = json.loads(text)
        
        # Verify required keys exist
        required_keys = ["business_type", "display_name", "theme_color", "suggested_questions"]
        if not all(key in parsed_json for key in required_keys):
             return fallback_response
             
        if parsed_json["business_type"] not in SYSTEM_PROMPTS:
             parsed_json["business_type"] = "other"
             
        return parsed_json
    except Exception as e:
        return fallback_response

@router.post("/setup")
async def setup_workspace(req: SetupRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    try:
        # 1. Upsert profiles table (in case auth trigger missed creating it)
        await db.table("profiles").upsert({
            "id": user.id,
            "full_name": req.owner_name,
            "phone": req.phone,
            "business_name": req.business_name,
            "business_type": req.business_type
        }).execute()

        # 2. Generate bot slug
        slug_base = re.sub(r'[^a-z0-9]+', '-', req.business_name.lower()).strip('-')[:30]
        if not slug_base:
             slug_base = "bot"
             
        # Check slug existence
        slug = slug_base
        existing_bot = await db.table("bots").select("id").eq("slug", slug).execute()
        if existing_bot.data:
             slug = f"{slug_base}-{random.randint(1000, 9999)}"

        # 3. Insert into bots
        bot_res = await db.table("bots").insert({
            "owner_id": user.id,
            "name": f"{req.business_name} Assistant",
            "slug": slug
        }).execute()
        if not bot_res.data: raise HTTPException(status_code=500, detail='Failed to fetch bot')
        new_bot = bot_res.data[0]
        bot_id = new_bot["id"]

        # 4. DB trigger auto-creates child records. (handled by handle_new_bot DB trigger)

        # 5. Update bot_appearance
        await db.table("bot_appearance").update({
            "theme_color": req.theme_color,
            "welcome_message": f"Hi! How can I help you with {req.business_name}?"
        }).eq("bot_id", bot_id).execute()

        # 6. Update bot_settings system_prompt and embedding model
        sys_prompt_template = SYSTEM_PROMPTS.get(req.business_type, SYSTEM_PROMPTS["other"])
        formatted_sys_prompt = sys_prompt_template.format(name=req.business_name)
        await db.table("bot_settings").update({
            "system_prompt": formatted_sys_prompt,
            "embedding_provider": "gemini",
            "embedding_model": "text-embedding-004",
            "embedding_dim": 768,
        }).eq("bot_id", bot_id).execute()

        # 7. Update notification_settings
        await db.table("notification_settings").update({
            "owner_whatsapp": req.phone
        }).eq("bot_id", bot_id).execute()

        # 8. Create pre-filled Q&A pairs (unanswered)
        # Fetch embedding_dim safely
        bot_settings_res = await db.table("bot_settings").select("embedding_dim").eq("bot_id", bot_id).limit(1).execute()
        embedding_dim = 768
        if bot_settings_res.data and len(bot_settings_res.data) > 0 and bot_settings_res.data[0].get("embedding_dim"):
            embedding_dim = bot_settings_res.data[0]["embedding_dim"]

        if embedding_dim not in [768, 1024, 1536, 3072]:
            raise HTTPException(status_code=400, detail=f"Invalid embedding dimension: {embedding_dim}")

        qa_inserts = []
        for q in req.suggested_questions:
            qa_inserts.append({
                "bot_id": bot_id,
                "question": q,
                "answer": "",
                "is_active": False
            })
        
        if qa_inserts:
            inserted_qa = await db.table(f"qa_pairs_{embedding_dim}").insert(qa_inserts).execute()
            # Embed questions asynchronously
            async def embed_qa_pairs(qa_data):
                try:
                    questions = [q["question"] for q in qa_data]
                    embeddings = await embed_chunks(questions)
                    for idx, q_row in enumerate(qa_data):
                        if embeddings and embeddings[idx]:
                            await db.table(f"qa_pairs_{embedding_dim}").update({"embedding": embeddings[idx]}).eq("id", q_row["id"]).execute()
                except Exception as e:
                     print(f"Failed to embed qa pairs: {e}")
            
            background_tasks.add_task(embed_qa_pairs, inserted_qa.data)

        # 9. Create one text data_source with placeholder
        import uuid
        source_id = str(uuid.uuid4())
        await db.table("data_sources").insert({
            "id": source_id,
            "bot_id": bot_id,
            "type": "text",
            "name": "Business Info",
            "status": "pending",
            "raw_text": f"Business: {req.business_name}\nType: {req.display_name}\n"
        }).execute()

        # Enqueue ingestion job
        background_tasks.add_task(run_ingestion_pipeline, source_id, db, redis)

        return {
            "bot_id": bot_id,
            "bot_slug": slug,
            "suggested_questions": req.suggested_questions
        }
    except Exception as e:
        import traceback
        with open('error_log.txt', 'a') as ef:
            ef.write(traceback.format_exc() + "\n")
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="A bot with this URL slug already exists. Please choose another.")
        raise HTTPException(status_code=500, detail=f"An error occurred during setup: {str(e)}")

@router.post("/train")
async def train_bot(req: TrainRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    try:
        # 1. Check ownership
        bot_res = await db.table("bots").select("id").eq("id", req.bot_id).eq("owner_id", user.id).single().execute()
        if not bot_res.data:
            return {"success": True}  # fail silently as requested

        # Fetch embedding_dim safely
        bot_settings_res = await db.table("bot_settings").select("embedding_dim").eq("bot_id", req.bot_id).limit(1).execute()
        embedding_dim = 768
        if bot_settings_res.data and len(bot_settings_res.data) > 0 and bot_settings_res.data[0].get("embedding_dim"):
            embedding_dim = bot_settings_res.data[0]["embedding_dim"]

        if embedding_dim not in [768, 1024, 1536, 3072]:
            return {"success": False, "error": f"Invalid embedding dimension: {embedding_dim}"}

        # 2 & 3 & 4. Upsert QA Pair
        existing_qa = await db.table(f"qa_pairs_{embedding_dim}").select("id").eq("bot_id", req.bot_id).eq("question", req.question).execute()
        qa_id = None
        if existing_qa.data:
            qa_id = existing_qa.data[0]["id"]
            await db.table(f"qa_pairs_{embedding_dim}").update({
                "answer": req.answer,
                "is_active": True
            }).eq("id", qa_id).execute()
        else:
            inserted_qa = await db.table(f"qa_pairs_{embedding_dim}").insert({
                "bot_id": req.bot_id,
                "question": req.question,
                "answer": req.answer,
                "is_active": True
            }).execute()
            if not inserted_qa.data: raise HTTPException(status_code=500, detail='Failed to insert QA')
            qa_id = inserted_qa.data[0]["id"]

        # 5. Embed the question
        async def embed_single_qa():
             try:
                 embeddings = await embed_chunks([req.question])
                 if embeddings and embeddings[0]:
                      await db.table(f"qa_pairs_{embedding_dim}").update({"embedding": embeddings[0]}).eq("id", qa_id).execute()
             except Exception:
                 pass
        background_tasks.add_task(embed_single_qa)

        # 6. Update data_source
        source_res = await db.table("data_sources").select("id, raw_text").eq("bot_id", req.bot_id).eq("name", "Business Info").execute()
        if source_res.data:
            source = source_res.data[0]
            new_text = source.get("raw_text", "") + f"\nQ: {req.question}\nA: {req.answer}\n"
            await db.table("data_sources").update({
                "raw_text": new_text,
                "status": "pending"
            }).eq("id", source["id"]).execute()
            
            # 7. Re-enqueue ingestion
            background_tasks.add_task(run_ingestion_pipeline, source["id"], db, redis)
            
    except Exception as e:
        # Never block UI
        print(f"Error in /train: {e}")
        pass
        
    return {"success": True}

@router.post("/complete")
async def complete_onboarding(req: CompleteRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    import uuid
    try:
        uuid_obj = uuid.UUID(req.bot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid bot_id format received: '{req.bot_id}'")

    try:
        with open('error_log.txt', 'a') as ef:
            ef.write(f"DEBUG: Executing bot ownership check with bot_id={req.bot_id}, user.id={user.id}\n")
        bot_res = await db.table("bots").select("slug, name").eq("id", req.bot_id).eq("owner_id", user.id).single().execute()
        if not bot_res.data:
            raise HTTPException(status_code=403, detail="Bot not found or unauthorized")
            
        bot_slug = bot_res.data["slug"]
        bot_name = bot_res.data["name"]

        with open('error_log.txt', 'a') as ef:
            ef.write(f"DEBUG: Executing profiles update with user.id={user.id}\n")
        await db.table("profiles").update({
            "onboarding_completed": True
        }).eq("id", user.id).execute()

        token = secrets.token_urlsafe(16)
        with open('error_log.txt', 'a') as ef:
            ef.write(f"DEBUG: Executing playground_shares insert with bot_id={req.bot_id}\n")
        await db.table("playground_shares").insert({
            "bot_id": req.bot_id,
            "token": token
        }).execute()
        
        playground_url = f"https://wraft.com/share/{token}"
        dashboard_url = "https://wraft.com/dashboard"

        with open('error_log.txt', 'a') as ef:
            ef.write(f"DEBUG: Executing notification_settings select with bot_id={req.bot_id}\n")
        notif_res = await db.table("notification_settings").select("owner_whatsapp").eq("bot_id", req.bot_id).single().execute()
    except Exception as e:
        import traceback
        with open('error_log.txt', 'a') as ef:
            ef.write(f"DEBUG: Exception in complete_onboarding! {repr(e)}\n")
            ef.write(traceback.format_exc() + "\n")
        raise e
    owner_whatsapp = None
    if notif_res.data and notif_res.data.get("owner_whatsapp"):
        owner_whatsapp = notif_res.data.get("owner_whatsapp")

    # 4. Send WhatsApp notification
    if owner_whatsapp:
        async def send_welcome_notif():
             await send_owner_notification(
                 owner_whatsapp=owner_whatsapp,
                 notification_type="new_lead", # map to generic fallback natively if no welcome template
                 data={
                     "bot_name": bot_name,
                     "name": "Wraft Team",
                     "phone": "System",
                     "last_user_message": f"Welcome to Wraft! Your bot {bot_name} is live.\nTest it here: {playground_url}\nDashboard: {dashboard_url}"
                 },
                 bot_id=req.bot_id,
                 db=db,
                 redis=redis
             )
        background_tasks.add_task(send_welcome_notif)

        # 5. Enqueue followup WhatsApp jobs in BullMQ
        # +4 hours = 14400000 ms
        background_tasks.add_task(enqueue_onboarding_nudge, req.bot_id, bot_slug, owner_whatsapp, 14400000, "nudge_4h", False)
        
        # +48 hours = 172800000 ms
        background_tasks.add_task(enqueue_onboarding_nudge, req.bot_id, bot_slug, owner_whatsapp, 172800000, "nudge_48h", False)
        
        # Check if trial user
        profile_res = await db.table("profiles").select("plan_id").eq("id", user.id).single().execute()
        is_trial = False
        if profile_res.data and profile_res.data.get("plan_id"):
            plan_res = await db.table("plans").select("name").eq("id", profile_res.data["plan_id"]).single().execute()
            if plan_res.data and plan_res.data["name"] == "trial":
                is_trial = True
                
        # +7 days = 604800000 ms
        if is_trial:
             background_tasks.add_task(enqueue_onboarding_nudge, req.bot_id, bot_slug, owner_whatsapp, 604800000, "upgrade_7d", True)

    return {
        "playground_url": playground_url,
        "dashboard_url": "/dashboard"
    }
