import asyncio
import asyncpg
import os

async def main():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    # Check triggers on auth.users
    triggers = await conn.fetch('''
        SELECT t.tgname, p.proname, p.prosrc
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'auth' AND c.relname = 'users';
    ''')
    
    if triggers:
        for t in triggers:
            print(f"Trigger: {t['tgname']}, Function: {t['proname']}")
            print(f"Source:\n{t['prosrc']}")
            print("-" * 50)
    else:
        print("No triggers found on auth.users.")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
