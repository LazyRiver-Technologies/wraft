from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from config import settings
from database import get_db
import asyncio
from redis_client import init_redis, get_redis, close_redis
from services.intelligence import init_topic_embeddings
from crons import run_daily_jobs, run_weekly_jobs, recover_crashed_jobs

from routers import auth, bots, sources, chat, webhook, analytics, billing, qa, leads, usage, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: initialize connection hooks natively
    await init_redis()
    redis_conn = await get_redis()
    
    # Supabase auto-recovery hook + Pre-computation embeddings loader
    await init_topic_embeddings()
    await recover_crashed_jobs(redis_conn)
    
    # Deploy lightweight local asynchronous intelligence routines
    asyncio.create_task(run_daily_jobs(redis_conn))
    asyncio.create_task(run_weekly_jobs())
    
    yield
    
    # On shutdown: cleanly close mappings natively
    await close_redis()
    
    # Supabase connection close 
    # Supabase AsyncClient currently creates connections to HTTPX client and closes them internally
    # when the instance goes out of scope, but we can do a dummy evaluation just for representation
    db = await get_db()

app = FastAPI(title="Chatbase India API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.ENVIRONMENT == "production" else [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(bots.router, prefix="/api/v1/bots")
app.include_router(qa.router, prefix="/api/v1/bots")
app.include_router(leads.router, prefix="/api/v1/bots")
app.include_router(sources.router, prefix="/api/v1/bots")
app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(webhook.router, prefix="/api/v1/webhook")
app.include_router(analytics.router, prefix="/api/v1/analytics")
app.include_router(billing.router, prefix="/api/v1/billing")
app.include_router(usage.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
