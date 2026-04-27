import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "http://localhost:8000/api/v1/chat/bot1",
            json={"message": "tell me about your services and pricing details", "session_id": "test", "channel": "web"}
        )
        print(res.status_code)
        print(res.text)

asyncio.run(main())
