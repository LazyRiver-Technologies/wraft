from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from config import settings
from database import get_db
from redis_client import _redis_client
from ingestion.worker import start_worker, stop_worker
from services.whatsapp_worker import start_wa_worker, stop_wa_worker

from routers import auth, bots, sources, chat, webhook, analytics, billing

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: initialize BullMQ workers
    await start_worker()
    await start_wa_worker()
    
    yield
    
    # On shutdown: close connections and workers
    await _redis_client.close()
    await stop_worker()
    await stop_wa_worker()
    
    # Supabase connection close 
    # Supabase AsyncClient currently creates connections to HTTPX client and closes them internally
    # when the instance goes out of scope, but we can do a dummy evaluation just for representation
    db = await get_db()

app = FastAPI(title="Chatbase India API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(bots.router, prefix="/api/v1/bots")
app.include_router(sources.router, prefix="/api/v1/bots")
app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(webhook.router, prefix="/api/v1/webhook")
app.include_router(analytics.router, prefix="/api/v1/analytics")
app.include_router(billing.router, prefix="/api/v1/billing")

@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
