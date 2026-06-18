from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import Optional
import urllib.parse
from datetime import datetime, timezone
from database import get_db
from middleware.auth import get_current_user
from redis_client import get_redis
from ingestion.pipeline import run_ingestion_pipeline
from routers.bots import verify_bot_ownership
from services.limits import check_data_source_limit, check_feature_access

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

class SourceUpdate(BaseModel):
    auto_retrain: Optional[bool] = None
    retrain_frequency: Optional[str] = None


@router.post("/{bot_id}/sources/text")
async def create_text_source(bot_id: str, body: TextSourceCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(user.id, bot_id, db)
    
    insert_res = await db.table("data_sources").insert({
        "bot_id": bot_id,
        "type": "text",
        "name": body.name,
        "raw_text": body.content,
        "status": "pending"
    }).execute()
    
    if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to create source')
    new_source = insert_res.data[0]
    background_tasks.add_task(run_ingestion_pipeline, new_source["id"], db, redis)
    
    return new_source


@router.post("/{bot_id}/sources/url")
async def create_url_source(bot_id: str, body: UrlSourceCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(user.id, bot_id, db)
    
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
    
    if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to create source')
    new_source = insert_res.data[0]
    background_tasks.add_task(run_ingestion_pipeline, new_source["id"], db, redis)
    
    return new_source


@router.post("/{bot_id}/sources/sitemap")
async def create_sitemap_source(bot_id: str, body: SitemapSourceCreate, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_feature_access(user.id, "sitemap_source", db)
    await check_data_source_limit(user.id, bot_id, db)

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
    
    if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to create source')
    new_source = insert_res.data[0]
    background_tasks.add_task(run_ingestion_pipeline, new_source["id"], db, redis)
    
    return new_source

@router.post("/{bot_id}/sources/pdf")
async def create_pdf_source(bot_id: str, background_tasks: BackgroundTasks, file: UploadFile = File(...), user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)
    await check_data_source_limit(user.id, bot_id, db)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
        
    file_bytes = await file.read()
    
    # Check max size 20MB
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit")
        
    # Check PDF magic bytes (%PDF)
    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    import uuid
    source_id = str(uuid.uuid4())
    storage_path = f"{user.id}/{bot_id}/{source_id}.pdf"
    
    try:
        # 1. Upload to Storage cluster first securely
        await db.storage.from_("documents").upload(storage_path, file_bytes)
        
        # 2. Map strictly wrapped execution dynamically (single insert)
        insert_res = await db.table("data_sources").insert({
            "id": source_id,
            "bot_id": bot_id,
            "type": "pdf",
            "name": file.filename,
            "storage_path": storage_path,
            "file_size_bytes": len(file_bytes),
            "status": "pending"
        }).execute()
        
        background_tasks.add_task(run_ingestion_pipeline, source_id, db, redis)
        if not insert_res.data: raise HTTPException(status_code=500, detail='Failed to insert data')
        return insert_res.data[0]
        
    except Exception as e:
        # Zero-Zombie Clean Architecture Database Rollback - Ensure storage is cleaned if DB fails
        try:
            await db.storage.from_("documents").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Storage cluster failed. Rollback complete. ({str(e)})")

@router.get("/{bot_id}/sources")
async def list_sources(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("data_sources").select("*").eq("bot_id", bot_id).is_("deleted_at", "null").execute()
    return res.data

@router.delete("/{bot_id}/sources/{source_id}", status_code=204)
async def delete_source(bot_id: str, source_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    # Fetch embedding_dim
    bot_settings_res = await db.table("bot_settings").select("embedding_dim").eq("bot_id", bot_id).single().execute()
    embedding_dim = 768
    if bot_settings_res.data and bot_settings_res.data.get("embedding_dim"):
        embedding_dim = bot_settings_res.data["embedding_dim"]

    # Invalidate cache locally
    from services.cache import invalidate_bot_cache
    await invalidate_bot_cache(bot_id, embedding_dim, db)
    
    await db.table(f"document_chunks_{embedding_dim}").delete().eq("source_id", source_id).execute()
    await db.table("data_sources").update({
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "status": "failed",
        "error_msg": "deleted_by_user"
    }).eq("bot_id", bot_id).eq("id", source_id).execute()
    return None

@router.get("/{bot_id}/sources/{source_id}/status")
async def get_source_status(bot_id: str, source_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("data_sources").select("status, chunk_count, error_msg").eq("bot_id", bot_id).eq("id", source_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Source not found")
        
    return res.data

@router.patch("/{bot_id}/sources/{source_id}")
async def update_source(bot_id: str, source_id: str, body: SourceUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        return {"status": "ok"}
        
    # Standard DB structure constraints securely pushing boolean configurations
    upd_res = await db.table("data_sources").update(update_data).eq("bot_id", bot_id).eq("id", source_id).execute()
    if not upd_res.data:
        raise HTTPException(status_code=404, detail="Source not found")
        
    if not upd_res.data: raise HTTPException(status_code=404, detail='Not found')
    return upd_res.data[0]

@router.post("/{bot_id}/sources/{source_id}/retrain")
async def retrain_source(bot_id: str, source_id: str, background_tasks: BackgroundTasks, user=Depends(get_current_user), db=Depends(get_db), redis=Depends(get_redis)):
    await verify_bot_ownership(bot_id, user, db)

    res = await db.table("data_sources").select("*").eq("bot_id", bot_id).eq("id", source_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Source not found")

    source = res.data
    if source.get("type") not in ["url", "sitemap"]:
        raise HTTPException(status_code=400, detail="Only URL and Sitemap sources can be automatically retrained")

    if source.get("status") in ["pending", "processing"]:
        raise HTTPException(status_code=400, detail="Source is currently processing")

    try:
        await db.table("data_sources").update({
            "status": "pending",
            "error_msg": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", source_id).execute()
        background_tasks.add_task(run_ingestion_pipeline, source_id, db, redis)
        return {"message": "Retraining started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue structural block natively: {str(e)}")
