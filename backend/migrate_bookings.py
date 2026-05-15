import asyncio
import json
from sqlalchemy.future import select
from app.db import AsyncSessionLocal
from app.models import OnlineBooking, Booking, BookingStatus, PaymentStatus
from app.main import _shift_to_datetime, SHIFTS_DEF

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(OnlineBooking).where(OnlineBooking.status == "confirmed"))
        obs = res.scalars().all()
        count = 0
        for ob in obs:
            try:
                shift_ids = json.loads(ob.shift_ids)
            except Exception:
                shift_ids = []
            
            for sid in shift_ids:
                s = next((x for x in SHIFTS_DEF if x["id"] == sid), None)
                if not s: continue
                
                start_time = _shift_to_datetime(ob.date, s["start"])
                end_time_str = s["end"] if s["end"] != "23:59" else "23:59"
                end_time = _shift_to_datetime(ob.date, end_time_str)
                if s["end"] == "23:59":
                    end_time = end_time.replace(hour=23, minute=59, second=59)

                # Check if exists
                res_exist = await db.execute(select(Booking).where(
                    Booking.court_id == ob.court_id,
                    Booking.start_time == start_time
                ))
                if res_exist.scalar_one_or_none():
                    continue
                
                note_str = ob.note or ""
                if ob.payment_ref:
                    note_str = f"[Online Booking: {ob.payment_ref}] {note_str}"

                booking = Booking(
                    court_id=ob.court_id,
                    start_time=start_time,
                    end_time=end_time,
                    guest_name=ob.guest_name,
                    guest_phone=ob.guest_phone,
                    note=note_str.strip(),
                    payment_status=PaymentStatus.FULLY_PAID,
                    status=BookingStatus.PAID
                )
                db.add(booking)
                count += 1
        
        await db.commit()
        print(f"Migrated {count} bookings")

if __name__ == "__main__":
    asyncio.run(main())
