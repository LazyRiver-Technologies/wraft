import asyncio
import httpx
import json

async def main():
    payload = {
        "business_type": "other",
        "business_name": "Test's Business",
        "display_name": "Test Business",
        "theme_color": "#000000",
        "owner_name": "Test",
        "phone": "+919999999999",
        "suggested_questions": ["Q1", "Q2"]
    }
    async with httpx.AsyncClient() as client:
        # We need a valid user token if auth is required, or bypass it if possible.
        # Wait, get_current_user requires a valid JWT token. We can't bypass easily.
        # Let's just look at the server logs again.
        pass

if __name__ == "__main__":
    asyncio.run(main())
