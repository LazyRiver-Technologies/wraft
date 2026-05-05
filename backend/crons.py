import asyncio
import logging
from datetime import datetime, timezone, timedelta
from database import get_db
from utils.limits import get_strict_plan
from services.intelligence import compute_suggestions
from ingestion.pipeline import run_ingestion_pipeline

logger = logging.getLogger(__name__)

async def recover_crashed_jobs(redis_client):
    """
    On boot, scans for sources that were stuck in 'processing' or 'pending' state
    due to an unexpected server crash, and re-dispatches them locally natively.
    """
    logger.info("Running Recovery sequence for crashed data sources...")
    try:
        db = await get_db()
        # Find stuck sources
        stuck_res = await db.table("data_sources")\
            .select("id")\
            .in_("status", ["pending", "processing"])\
            .execute()
            
        stuck_sources = stuck_res.data or []
        if stuck_sources:
            logger.info(f"Auto-Recovering {len(stuck_sources)} crashed sources dynamically.")
            for src in stuck_sources:
                asyncio.create_task(run_ingestion_pipeline(src["id"], db, redis_client))
        else:
            logger.info("No crashed jobs found. Recovery clear.")
    except Exception as e:
        logger.error(f"Failed to run recovery loop natively: {e}")

async def retrain_due_sources(redis_client):
    """
    Find URL/sitemap sources due for retraining and re-ingest them into local tasks natively.
    """
    db = await get_db()
    now = datetime.now(timezone.utc)
    
    results = await db.table("data_sources")\
      .select("*, bots!inner(owner_id)")\
      .eq("auto_retrain", True)\
      .eq("status", "ready")\
      .in_("type", ["url", "sitemap"])\
      .execute()
    
    sources = results.data or []
    if not sources:
        return
        
    # Pre-fetch all owner plans in a single batched query to eliminate N+1 DB roundtrips
    owner_ids = list({s.get("bots", {}).get("owner_id") for s in sources if s.get("bots", {}).get("owner_id")})
    plans_dict = {}
    if owner_ids:
        plans_res = await db.table("profiles").select("id, plans(name)").in_("id", owner_ids).execute()
        plans_dict = {p["id"]: p.get("plans", {}).get("name") if p.get("plans") else "free" for p in (plans_res.data or [])}

    for source in sources:
      try:
          last = source.get("last_retrained_at") or source.get("updated_at")
          if not last:
              continue
              
          last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
          
          frequency = source.get("retrain_frequency", "weekly")
          if frequency == "daily":
            due = last_dt + timedelta(days=1)
          elif frequency == "weekly":
            due = last_dt + timedelta(weeks=1)
          else:  # monthly
            due = last_dt + timedelta(days=30)
          
          if now < due: 
              continue
          
          owner_id = source.get("bots", {}).get("owner_id")
          if not owner_id:
              continue
              
          owner_plan_name = plans_dict.get(owner_id, "free")
          if owner_plan_name == "free": 
              continue
          
          # Dynamically dispatch to background loop instead of BullMQ queue
          asyncio.create_task(run_ingestion_pipeline(source["id"], db, redis_client))
          
          await db.table("data_sources").update({
            "last_retrained_at": now.isoformat(),
            "status": "pending"
          }).eq("id", source["id"]).execute()
          
          logger.info(f"Auto-retrain dispatched dynamically: {source['id']}")
      except Exception as e:
          logger.error(f"Auto-retrain failed structurally: {source.get('id')}: {e}")

async def run_daily_jobs(redis_client):
    """Daily offline topics intelligence processing mapped to 2:00 AM IST."""
    db = await get_db()
    ist_offset = timezone(timedelta(hours=5, minutes=30))
    while True:
        now = datetime.now(ist_offset)
        next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
        if next_run < now:
            next_run += timedelta(days=1)
        
        sleep_seconds = (next_run - now).total_seconds()
        logger.info(f"Daily topics intelligence node sleeping for {sleep_seconds} seconds.")
        await asyncio.sleep(sleep_seconds)
        
        try:
            bots_res = await db.table("bots").select("id").eq("is_active", True).execute()
            
            # Use gather with a semaphore to prevent crashing the DB pool if there are 1000s of bots
            sem = asyncio.Semaphore(10)
            async def bounded_compute(bot_id):
                pass # Replaced Topics compute with pass, daily job only retrains now.
                        
            tasks = [bounded_compute(bot["id"]) for bot in (bots_res.data or [])]
            if tasks:
                await asyncio.gather(*tasks)
                
            await retrain_due_sources(redis_client)
        except Exception as e:
            logger.error(f"Intelligence cron fatal loop drop on daily: {e}")

async def run_weekly_jobs():
    """Weekly offline suggestions clustering mapped to Monday 3:00 AM IST."""
    db = await get_db()
    ist_offset = timezone(timedelta(hours=5, minutes=30))
    while True:
        now = datetime.now(ist_offset)
        days_until_monday = (7 - now.weekday()) % 7
        next_run = (now + timedelta(days=days_until_monday)).replace(hour=3, minute=0, second=0, microsecond=0)
        
        sleep_seconds = (next_run - now).total_seconds()
        logger.info(f"Weekly suggestions intelligence node sleeping for {sleep_seconds} seconds.")
        await asyncio.sleep(sleep_seconds)
        
        try:
            bots_res = await db.table("bots").select("id").eq("is_active", True).execute()
            
            # Batched concurrent execution
            sem = asyncio.Semaphore(10)
            async def bounded_compute(bot_id):
                async with sem:
                    try:
                        await compute_suggestions(bot_id, db, redis)
                    except Exception as e:
                        logger.error(f"Failed to compute suggestions for {bot_id}: {e}")
                        
            tasks = [bounded_compute(bot["id"]) for bot in (bots_res.data or [])]
            if tasks:
                await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Intelligence cron fatal loop drop on weekly: {e}")
