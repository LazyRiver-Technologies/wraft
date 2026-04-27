from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from middleware.auth import get_current_user
from routers.bots import verify_bot_ownership
from services.limits import check_qa_limit
from ingestion.embedder import embed_chunks

router = APIRouter()

class QAPairCreate(BaseModel):
    question: str
    answer: str

class QAPairUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    is_active: Optional[bool] = None

class QAPairBulkCreate(BaseModel):
    pairs: List[QAPairCreate]

@router.post("/{bot_id}/qa")
async def create_qa_pair(bot_id: str, payload: QAPairCreate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_qa_limit(user.id, bot_id, db)
    
    # 1. Embed the question
    embeddings = await embed_chunks([payload.question])
    if not embeddings or len(embeddings) == 0:
        raise HTTPException(status_code=500, detail="Failed to embed question.")
        
    query_embedding = embeddings[0]
    
    # 2. Insert into DB
    insert_res = await db.table("qa_pairs").insert({
        "bot_id": bot_id,
        "question": payload.question,
        "answer": payload.answer,
        "embedding": query_embedding
    }).execute()
    
    # Exclude embedding from response
    data = insert_res.data[0]
    data.pop("embedding", None)
    return data

@router.get("/{bot_id}/qa")
async def list_qa_pairs(bot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    res = await db.table("qa_pairs").select("id, bot_id, question, answer, is_active, hit_count, created_at, updated_at").eq("bot_id", bot_id).eq("is_active", True).order("hit_count", desc=True).execute()
    return res.data

@router.patch("/{bot_id}/qa/{qa_id}")
async def update_qa_pair(bot_id: str, qa_id: str, payload: QAPairUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    
    if not update_data:
        return {"status": "ok"}
        
    # Re-embed if question changes
    if "question" in update_data:
        embeddings = await embed_chunks([update_data["question"]])
        if not embeddings or len(embeddings) == 0:
            raise HTTPException(status_code=500, detail="Failed to embed new question.")
        update_data["embedding"] = embeddings[0]
        
    res = await db.table("qa_pairs").update(update_data).eq("id", qa_id).eq("bot_id", bot_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Q&A pair not found")
        
    data = res.data[0]
    data.pop("embedding", None)
    return data

@router.delete("/{bot_id}/qa/{qa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_qa_pair(bot_id: str, qa_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    
    # Soft delete
    await db.table("qa_pairs").update({"is_active": False}).eq("id", qa_id).eq("bot_id", bot_id).execute()
    return None

@router.post("/{bot_id}/qa/bulk")
async def bulk_create_qa_pairs(bot_id: str, payload: QAPairBulkCreate, user=Depends(get_current_user), db=Depends(get_db)):
    await verify_bot_ownership(bot_id, user, db)
    await check_qa_limit(user.id, bot_id, db)
    
    if not payload.pairs:
        return {"status": "ok", "inserted": 0}
        
    questions = [p.question for p in payload.pairs]
    
    # Batch embed everything natively
    embeddings = await embed_chunks(questions)
    
    if not embeddings or len(embeddings) != len(payload.pairs):
        raise HTTPException(status_code=500, detail="Failed to embed all questions properly.")
        
    insert_data = []
    for i, pair in enumerate(payload.pairs):
        insert_data.append({
            "bot_id": bot_id,
            "question": pair.question,
            "answer": pair.answer,
            "embedding": embeddings[i]
        })
        
    res = await db.table("qa_pairs").insert(insert_data).execute()
    
    return {"status": "ok", "inserted": len(res.data)}
