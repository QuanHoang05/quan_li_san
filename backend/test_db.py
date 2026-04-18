import asyncio
from sqlalchemy import select
from app.db import get_db
from app.models import InventoryLog

async def test():
    async for db in get_db():
        result = await db.execute(select(InventoryLog))
        print(len(result.scalars().all()))

asyncio.run(test())
