import asyncio
import json
from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models import OnlineBooking, Booking, BookingStatus, PaymentStatus
from app.main import sync_online_booking_to_booking

async def fix_stuck_bookings():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(OnlineBooking).where(OnlineBooking.status == "confirmed"))
        obs = res.scalars().all()
        print(f"Found {len(obs)} confirmed online bookings. Checking sync status...")
        
        for ob in obs:
            # sync_online_booking_to_booking checks for duplicates internally
            await sync_online_booking_to_booking(db, ob)
            print(f"Synced {ob.payment_ref}")
        
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(fix_stuck_bookings())
