from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, HttpUrl
from typing import Optional
import urllib.parse
from database import get_db
from middleware.auth import get_current_user
from redis_client import get_redis
from ingestion.worker import enqueue_ingestion
from routers.bots import verify_bot_ownership

router = APIRouter()

class TextSourceCreate(BaseModel):
    name: str
    content: str
    
class UrlSourceCreate(BaseModel):
    name: str
    url: str

class SitemapSourceCreate(BaseModel):
    name: str
    url: str


async def check_data_source_limit(bot_id: str, user, db):
    # Fetch user plan to check limits
    plan_res = await db.table("profiles").select("plans(*)").eq("id", user.id).single().execute()
    profile = plan_res.data
    plan = profile.get("plans") if profile else None
    
    if plan and plan.get("max_sources") is not None:
        source_count_res = await db.table("data_sources").select("id", count="exact").eq("bot_id", bot_id).execute()
        current_sources = source_count_res.count if source_count_res.count is not None else 0
        if current_sources >= plan.get("max_sources"):
            raise HTTPException(status_code=403, detail="Data source limit reached for your plan")


@router.post("/{bot_id}/sources/text")
async def create_text_source(bot_id: str, body: TextSourceCreate, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(bot_id, user, db)
    
    insert_res = await db.table("data_sources").insert({
        "bot_id": bot_id,
        "type": "text",
        "name": body.name,
        "raw_text": body.content,
        "status": "pending"
    }).execute()
    
    new_source = insert_res.data[0]
    await enqueue_ingestion(new_source["id"], redis)
    
    return new_source


@router.post("/{bot_id}/sources/url")
async def create_url_source(bot_id: str, body: UrlSourceCreate, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(bot_id, user, db)
    
    # Validate url
    parsed = urllib.parse.urlparse(body.url)
    if not parsed.scheme or not parsed.netloc:
         raise HTTPException(status_code=400, detail="Invalid URL format")

    insert_res = await db.table("data_sources").insert({
        "bot_id": bot_id,
        "type": "url",
        "name": body.name,
        "source_url": body.url,
        "status": "pending"
    }).execute()
    
    new_source = insert_res.data[0]
    await enqueue_ingestion(new_source["id"], redis)
    
    return new_source


@router.post("/{bot_id}/sources/sitemap")
async def create_sitemap_source(bot_id: str, body: SitemapSourceCreate, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(bot_id, user, db)

    parsed = urllib.parse.urlparse(body.url)
    if not parsed.scheme or not parsed.netloc:
         raise HTTPException(status_code=400, detail="Invalid URL format")

    insert_res = await db.table("data_sources").insert({
        "bot_id": bot_id,
        "type": "sitemap",
        "name": body.name,
        "source_url": body.url,
        "status": "pending"
    }).execute()
    
    new_source = insert_res.data[0]
    await enqueue_ingestion(new_source["id"], redis)
    
    return new_source

@router.post("/{bot_id}/sources/pdf")
async def create_pdf_source(bot_id: str, file: UploadFile = File(...), user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(bot_id, user, db)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
        
    file_bytes = await file.read()
    
    # Check max size 20MB
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit")
        
    # Check PDF magic bytes (%PDF)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    # Insert data_source first to get an ID. Using dummy storage_path until we have the ID,
    # but wait, we need the ID to name the file!
    # Let's insert first, then update storage path, or we can use a UUID for the file if we wanted.
    # Better: insert with temporary or predicted path.
    insert_res = await db.table("data_sources").insert({
        "bot_id": bot_id,
        "type": "pdf",
        "name": file.filename,
        "status": "pending"
    }).execute()
    
    source_id = insert_res.data[0]["id"]
    storage_path = f"{user.id}/{bot_id}/{source_id}.pdf"
    
    # Upload to Supabase Storage. Use generic bucket "documents"
    await db.storage.from_("documents").upload(storage_path, file_bytes)
    
    # Update data_source with storage path
    source_upd_res = await db.table("data_sources").update({
        "storage_path": storage_path
    }).eq("id", source_id).execute()

    await enqueue_ingestion(source_id, redis)
    
    return source_upd_res.data[0]

@router.get("/{bot_id}/sources")
async def list_sources(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("data_sources").select("*").eq("bot_id", bot_id).execute()
    return res.data

@router.delete("/{bot_id}/sources/{source_id}", status_code=204)
async def delete_source(bot_id: str, source_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    # Deleting the source handles cascade to chunks via DB schema constraints
    await db.table("data_sources").delete().eq("bot_id", bot_id).eq("id", source_id).execute()
    return None

@router.get("/{bot_id}/sources/{source_id}/status")
async def get_source_status(bot_id: str, source_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("data_sources").select("status, chunk_count, error_msg").eq("bot_id", bot_id).eq("id", source_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Source not found")
        
    return res.data
