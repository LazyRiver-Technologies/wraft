import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Use a valid bot_slug/bot_id from the user's logs
        res = await client.post(
            "http://localhost:8000/api/v1/chat/bot1",
            json={"message": "hello", "session_id": "test", "channel": "web"}
        )
        print(res.status_code)
        print(res.text)

asyncio.run(main())
