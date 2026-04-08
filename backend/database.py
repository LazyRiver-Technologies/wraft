from supabase import acreate_client, AClient
from config import settings

_db_client: AClient | None = None

async def get_db() -> AClient:
    global _db_client
    if _db_client is None:
        _db_client = await acreate_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _db_client
