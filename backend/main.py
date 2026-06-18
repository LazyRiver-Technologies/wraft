from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
import logging
from postgrest.exceptions import APIError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from config import settings
from database import get_db
import asyncio
from redis_client import init_redis, get_redis, close_redis
from services.intelligence import init_topic_embeddings
from crons import run_daily_jobs, run_weekly_jobs, recover_crashed_jobs
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

from routers import auth, bots, sources, chat, webhook, analytics, billing, qa, leads, usage, admin, onboarding, profiles, setup

@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: initialize connection hooks natively
    await init_redis()
    redis_conn = await get_redis()
    FastAPICache.init(RedisBackend(redis_conn), prefix="fastapi-cache")
    
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
app.include_router(qa.router, prefix="/api/v1/bots")
app.include_router(leads.router, prefix="/api/v1/bots")
app.include_router(sources.router, prefix="/api/v1/bots")
app.include_router(bots.router, prefix="/api/v1/bots")
app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(webhook.router, prefix="/api/v1/webhook")
app.include_router(analytics.router, prefix="/api/v1/analytics")
app.include_router(billing.router, prefix="/api/v1/billing")
app.include_router(usage.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1/onboarding")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(setup.router, prefix="/api/v1/setup")
app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}

# Global Exception Handler
logger = logging.getLogger("uvicorn.error")

@app.exception_handler(APIError)
async def postgrest_api_error_handler(request: Request, exc: APIError):
    err_data = exc.json() if hasattr(exc, "json") and callable(exc.json) else {}
    if not err_data and hasattr(exc, "args") and len(exc.args) > 0 and isinstance(exc.args[0], dict):
        err_data = exc.args[0]
        
    code = err_data.get("code")
    
    if code == "22P02":
        import traceback
        with open('error_log.txt', 'a') as ef:
            ef.write(f"22P02 ERROR on {request.method} {request.url}: {err_data}\n")
            ef.write(traceback.format_exc() + "\n")
        return JSONResponse(status_code=400, content={"detail": f"Invalid identifier format (e.g. invalid UUID): {err_data}"})
    if code == "23505":
        return JSONResponse(status_code=409, content={"detail": "A record with this unique value already exists."})
    if code == "23503":
        return JSONResponse(status_code=400, content={"detail": "Referenced record does not exist."})
    
    logger.error(f"Database APIError processing {request.method} {request.url}: {err_data}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Our team has been notified."},
    )
