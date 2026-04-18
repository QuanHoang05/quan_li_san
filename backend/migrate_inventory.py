import asyncio
import os
from sqlalchemy import text
from app.db import engine

async def update_schema():
    print("Updating database schema...")
    async with engine.begin() as conn:
        # Check if 'type' column exists in 'inventory_logs'
        result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='inventory_logs' AND column_name='type';"))
        column_exists = result.scalar() is not None
        
        if not column_exists:
            print("Adding 'type' column to 'inventory_logs' table...")
            # We add it as a string column first to avoid Enum issues during migration
            await conn.execute(text("ALTER TABLE inventory_logs ADD COLUMN type VARCHAR(50) DEFAULT 'ADJUSTMENT' NOT_NULL;"))
            # Update existing records based on change_amount and current reason (which is still in Vietnamese in DB)
            # This is tricky because I changed the Enum values in code too.
            # But the DB still has the old strings.
            await conn.execute(text("UPDATE inventory_logs SET type='IMPORT' WHERE reason='Nhập kho';"))
            await conn.execute(text("UPDATE inventory_logs SET type='SALE' WHERE reason='Bán hàng';"))
            await conn.execute(text("UPDATE inventory_logs SET type='DAMAGE' WHERE reason IN ('Hết hạn', 'Hư hỏng tự nhiên', 'Khách làm hỏng');"))
            
            # Now update the reason strings to English keys to match the new Enum
            await conn.execute(text("UPDATE inventory_logs SET reason='STOCK_IN' WHERE reason='Nhập kho';"))
            await conn.execute(text("UPDATE inventory_logs SET reason='SALE' WHERE reason='Bán hàng';"))
            await conn.execute(text("UPDATE inventory_logs SET reason='EXPIRED' WHERE reason='Hết hạn';"))
            await conn.execute(text("UPDATE inventory_logs SET reason='DAMAGE_NATURAL' WHERE reason='Hư hỏng tự nhiên';"))
            await conn.execute(text("UPDATE inventory_logs SET reason='DAMAGE_CUSTOMER' WHERE reason='Khách làm hỏng';"))
            
            print("Schema updated successfully.")
        else:
            print("Column 'type' already exists.")

if __name__ == "__main__":
    asyncio.run(update_schema())
