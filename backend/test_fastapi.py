import httpx
import asyncio
import json

async def test_fastapi():
    async with httpx.AsyncClient() as client:
        # Create a new bot for testing or query existing
        # I don't have auth for the API, but I can add an unauthenticated endpoint!
        pass

asyncio.run(test_fastapi())
