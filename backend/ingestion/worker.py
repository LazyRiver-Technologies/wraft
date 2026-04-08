import asyncio
import logging
from bullmq import Worker, Queue, Job
from config import settings
from database import get_db
from redis_client import redis_pool
from ingestion.pipeline import run_ingestion_pipeline

logger = logging.getLogger(__name__)

# Global reference to keep worker alive
_worker: Worker | None = None

async def process_ingestion_job(job: Job, job_token: str):
    """
    The processor function that BullMQ calls for each job.
    """
    source_id = job.data.get("source_id")
    if not source_id:
        raise ValueError("Job missing source_id in data")
        
    db = await get_db()
    
    # Passing redis manually to match the prompt's `redis` parameter requirement,
    # though BullMQ manages its own redis connection under the hood using pool.
    import redis.asyncio as redis
    redis_client = redis.Redis(connection_pool=redis_pool)
    
    try:
        await run_ingestion_pipeline(source_id, db, redis_client)
    finally:
        await redis_client.close()

async def start_worker():
    """
    Initializes and starts the ingestion BullMQ Worker.
    """
    global _worker
    
    # In BullMQ python, we pass a host/port or a redis connection. 
    # Usually we can pass a redis connection object or dict.
    # The standard way to configure in BullMQ Python 2.x is with redis options dict
    u = settings.REDIS_URL
    # We parse the redis url simply to pass to bullmq
    # (Assuming standard redis://host:port/db)
    
    import redis.asyncio as redis
    from redis_client import redis_pool
    redis_conn = redis.Redis(connection_pool=redis_pool)

    _worker = Worker(
        "ingestion",
        process_ingestion_job,
        {"connection": redis_conn, "concurrency": 3}
    )

    def on_completed(job: Job, result: any):
        logger.info(f"Ingestion job completed successfully. Source ID: {job.data.get('source_id')}")

    def on_failed(job: Job, error: Exception):
        logger.error(f"Ingestion job failed. Source ID: {job.data.get('source_id')}. Error: {error}")

    _worker.on("completed", on_completed)
    _worker.on("failed", on_failed)

    logger.info("Ingestion BullMQ Worker started.")

async def stop_worker():
    """
    Gracefully close the worker on shutdown.
    """
    global _worker
    if _worker:
        await _worker.close()
        logger.info("Ingestion BullMQ Worker stopped.")

async def enqueue_ingestion(source_id: str, redis_client=None) -> Job:
    """
    Adds a new job to the 'ingestion' queue.
    """
    import redis.asyncio as redis
    from redis_client import redis_pool
    redis_conn = redis.Redis(connection_pool=redis_pool)

    queue = Queue("ingestion", {"connection": redis_conn})
    job = await queue.add("process_source", {"source_id": source_id})
    await queue.close()
    return job
