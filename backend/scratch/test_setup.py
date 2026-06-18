import asyncio
import json
import uuid
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # We need an admin token or we need to hit the api directly... wait, setup requires auth!
        pass
