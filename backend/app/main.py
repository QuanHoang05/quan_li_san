from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_, or_, update
from sqlalchemy.orm import selectinload
from typing import List, Optional
from contextlib import asynccontextmanager
from pydantic import BaseModel
from datetime import datetime, timedelta, date
import shutil
import os
import json
import random
import string

from app.db import engine, get_db
from app.models import (
    Base, Product, Court, CourtType, InventoryLog, LogReason, LogStatus, LogType, LOG_REASON_LABELS,
    Booking, BookingStatus, CourtBlock, BookingLog, PaymentStatus, CourtPricingRule, BankSettings,
    WebhookLog
)

# Define Pydantic schemas for requests/responses
class ProductBase(BaseModel):
    name: str
    category: str
    price: float
    cost_price: float
    stock_quantity: int = 0
    image_url: Optional[str] = None
    unit: str = "cái"
    min_stock: int = 5
    supplier_name: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    class Config:
        from_attributes = True

class ReportDamageRequest(BaseModel):
    product_id: int
    reason: str  # Can be a LogReason string or key
    amount: int
    compensation_amount: Optional[float] = 0.0

class CourtBase(BaseModel):
    name: str
    type: str
    price_per_hour: float
    deposit_price: float = 0.0

class CourtCreate(CourtBase):
    pass

class CourtResponse(CourtBase):
    id: int
    class Config:
        from_attributes = True

class CheckoutItem(BaseModel):
    product_id: int
    quantity: int

class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    payment_method: str
    total_amount: float
    customer_id: Optional[int] = None

class InventoryLogResponse(BaseModel):
    id: int
    product_id: int
    change_amount: int
    type: str
    reason: str
    reason_label: str
    compensation_amount: float
    status: str
    product_name: str
    note: Optional[str] = None
    image_url: Optional[str] = None
    user_name: Optional[str] = None
    timestamp: Optional[datetime] = None
    class Config:
        from_attributes = True

class ImportRequest(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float = 0.0
    supplier_name: Optional[str] = ""
    note: Optional[str] = ""
    selling_price: Optional[float] = None
    product_name: Optional[str] = None
    category: Optional[str] = "Khác"
    unit: Optional[str] = "cái"
    image_url: Optional[str] = None
    user_name: Optional[str] = None
    is_admin: bool = False

class BankSettingsRequest(BaseModel):
    bank_code: str
    bank_name: str
    account_number: str
    account_name: str

class BankToggleRequest(BaseModel):
    is_active: bool

class BankSettingsResponse(BaseModel):
    id: int
    bank_code: str
    bank_name: str
    account_number: str
    account_name: str
    is_active: bool
    class Config:
        from_attributes = True

class BookingCreateRequest(BaseModel):
    court_id: int
    start_time: datetime
    end_time: datetime
    user_id: Optional[int] = None
    guest_name: Optional[str] = ""
    guest_phone: Optional[str] = ""
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    note: Optional[str] = ""
    is_recurring: bool = False
    recurring_weeks: int = 1

class ReassignRequest(BaseModel):
    court_id: int
    start_time: datetime
    end_time: datetime

class CourtBlockRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    reason: str

class CourtPricingRuleRequest(BaseModel):
    tier: str = "normal"          # 'low' | 'normal' | 'peak'
    price_override: Optional[float] = None  # None = dùng giá mặc định

class CourtPricingRuleResponse(BaseModel):
    id: int
    court_id: int
    shift_id: int
    tier: str
    price_override: Optional[float]
    class Config:
        from_attributes = True

# Lifecycle: create tables + PostgreSQL/SQLite migration
@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        from sqlalchemy import text
        # --- Migration: inventory_logs.type ---
        try:
            await conn.execute(text("ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'ADJUSTMENT'"))
            await conn.execute(text("""
                UPDATE inventory_logs SET type = CASE
                    WHEN reason = 'STOCK_IN' THEN 'IMPORT'
                    WHEN reason = 'SALE' THEN 'SALE'
                    WHEN reason IN ('EXPIRED', 'NATURAL_DAMAGE', 'CUSTOMER_DAMAGE') THEN 'DAMAGE'
                    ELSE 'ADJUSTMENT'
                END
                WHERE type IS NULL OR type = 'ADJUSTMENT'
            """))
            print("[Migration] inventory_logs.type ready.")
        except Exception as e:
            print(f"[Migration] inventory_logs.type: {e}")

        # --- Migration: bookings online columns ---
        is_postgres = "postgresql" in str(engine.url)
        for col_def in [
            ("expires_at",       "TIMESTAMP" if is_postgres else "DATETIME"),
            ("payment_ref",      "VARCHAR(50)"),
            ("proof_image_url",  "VARCHAR(255)"),
            ("is_online",        "BOOLEAN DEFAULT FALSE" if is_postgres else "BOOLEAN DEFAULT 0"),
            ("price",            "FLOAT"),
        ]:
            col_name, col_type = col_def
            try:
                if is_postgres:
                    await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                else:
                    await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col_name} {col_type}"))
                print(f"[Migration] bookings.{col_name} added.")
            except Exception as e:
                # If IF NOT EXISTS is not supported or other issue, just log and pass
                print(f"[Migration] bookings.{col_name} error: {e}")
                pass

        # --- Migration: webhook_logs table ---
        try:
            if is_postgres:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS webhook_logs (
                        id SERIAL PRIMARY KEY,
                        source VARCHAR(50) DEFAULT 'casso',
                        payment_ref VARCHAR(100),
                        amount FLOAT,
                        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
                        matched BOOLEAN DEFAULT FALSE,
                        raw_data TEXT,
                        timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            else:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS webhook_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source VARCHAR(50) DEFAULT 'casso',
                        payment_ref VARCHAR(100),
                        amount FLOAT,
                        booking_id INTEGER,
                        matched BOOLEAN DEFAULT 0,
                        raw_data TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            print("[Migration] webhook_logs ready.")
        except Exception as e:
            print(f"[Migration] webhook_logs error: {e}")

    yield

app = FastAPI(title="QuanLiSan API", lifespan=lifespan)

# Mount uploads dir
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Setup CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to QuanLiSan Backend API"}

@app.post("/api/v1/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    return {"url": f"http://localhost:8000/uploads/{file.filename}"}

# ===========================
# PRODUCTS CRUD
# ===========================
@app.get("/api/v1/products", response_model=List[ProductResponse])
async def get_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product))
    return result.scalars().all()

@app.post("/api/v1/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, db: AsyncSession = Depends(get_db)):
    db_product = Product(**product.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product

@app.put("/api/v1/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, product: ProductCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalar_one_or_none()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    for key, value in product.model_dump().items():
        setattr(db_product, key, value)
        
    await db.commit()
    await db.refresh(db_product)
    return db_product

@app.delete("/api/v1/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
    return {"ok": True}

# ===========================
# COURTS CRUD
# ===========================
@app.get("/api/v1/courts", response_model=List[CourtResponse])
async def get_courts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Court).where(Court.is_active == True))
    return result.scalars().all()

@app.post("/api/v1/courts", response_model=CourtResponse)
async def create_court(court: CourtCreate, db: AsyncSession = Depends(get_db)):
    db_court = Court(**court.model_dump())
    db.add(db_court)
    await db.commit()
    await db.refresh(db_court)
    return db_court

@app.put("/api/v1/courts/{court_id}", response_model=CourtResponse)
async def update_court(court_id: int, court: CourtCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Court).where(Court.id == court_id))
    db_court = result.scalar_one_or_none()
    if not db_court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    db_court.name = court.name
    db_court.type = court.type
    db_court.price_per_hour = court.price_per_hour
    db_court.deposit_price = court.deposit_price
    
    await db.commit()
    await db.refresh(db_court)
    return db_court

@app.delete("/api/v1/courts/{court_id}")
async def delete_court(court_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Court).where(Court.id == court_id))
    court = result.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    # Soft delete
    court.is_active = False
    await db.commit()
    return {"ok": True}

# ===========================
# COURT PRICING RULES
# ===========================
@app.get("/api/v1/courts/{court_id}/pricing", response_model=List[CourtPricingRuleResponse])
async def get_court_pricing(court_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CourtPricingRule).where(CourtPricingRule.court_id == court_id).order_by(CourtPricingRule.shift_id)
    )
    return result.scalars().all()

@app.put("/api/v1/courts/{court_id}/pricing/{shift_id}", response_model=CourtPricingRuleResponse)
async def upsert_court_pricing(court_id: int, shift_id: int, req: CourtPricingRuleRequest, db: AsyncSession = Depends(get_db)):
    # Tìm rule hiện tại
    result = await db.execute(
        select(CourtPricingRule).where(
            CourtPricingRule.court_id == court_id,
            CourtPricingRule.shift_id == shift_id
        )
    )
    rule = result.scalar_one_or_none()
    if rule:
        rule.tier = req.tier
        rule.price_override = req.price_override
    else:
        rule = CourtPricingRule(court_id=court_id, shift_id=shift_id, tier=req.tier, price_override=req.price_override)
        db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@app.delete("/api/v1/courts/{court_id}/pricing/{shift_id}")
async def delete_court_pricing(court_id: int, shift_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CourtPricingRule).where(
            CourtPricingRule.court_id == court_id,
            CourtPricingRule.shift_id == shift_id
        )
    )
    rule = result.scalar_one_or_none()
    if rule:
        await db.delete(rule)
        await db.commit()
    return {"ok": True}

# ===========================
# INVENTORY OPERATIONS
# ===========================
@app.post("/api/v1/inventory/report-damage")
async def report_damage(req: ReportDamageRequest, db: AsyncSession = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
        
    result = await db.execute(select(Product).where(Product.id == req.product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if product.stock_quantity < req.amount:
        raise HTTPException(status_code=400, detail="Not enough stock to report damage")
    
    # Map reason string to enum (support both Vietnamese labels and English keys)
    _reason_map = {
        "Hết hạn": LogReason.EXPIRED, "EXPIRED": LogReason.EXPIRED,
        "Hư hỏng tự nhiên": LogReason.NATURAL_DAMAGE, "NATURAL_DAMAGE": LogReason.NATURAL_DAMAGE,
        "Khách làm hỏng": LogReason.CUSTOMER_DAMAGE, "CUSTOMER_DAMAGE": LogReason.CUSTOMER_DAMAGE,
    }
    reason_enum = _reason_map.get(req.reason, LogReason.NATURAL_DAMAGE)

    log = InventoryLog(
        product_id=req.product_id,
        change_amount=-req.amount,
        type=LogType.DAMAGE.value,
        reason=reason_enum,
        compensation_amount=req.compensation_amount,
        status=LogStatus.PENDING.value
    )
    db.add(log)
    await db.commit()
    return {"ok": True, "message": "Ghi nhận báo hỏng, chờ Admin duyệt"}

@app.post("/api/v1/inventory/approve-damage/{log_id}")
async def approve_damage(log_id: int, db: AsyncSession = Depends(get_db)):
    """Admin duyệt báo hỏng -> trừ kho"""
    res = await db.execute(select(InventoryLog).options(selectinload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    if log.status != LogStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Log is not pending")
    # Trừ kho
    log.product.stock_quantity += log.change_amount  # change_amount âm nên cộng vào là trừ
    log.status = LogStatus.APPROVED.value
    await db.commit()
    return {"ok": True, "new_stock": log.product.stock_quantity}

@app.post("/api/v1/inventory/reject-damage/{log_id}")
async def reject_damage(log_id: int, db: AsyncSession = Depends(get_db)):
    """Admin từ chối báo hỏng"""
    res = await db.execute(select(InventoryLog).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log or log.status != LogStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Invalid log")
    log.status = LogStatus.REJECTED.value
    await db.commit()
    return {"ok": True}

@app.get("/api/v1/inventory/logs", response_model=List[InventoryLogResponse])
async def get_inventory_logs(
    log_type: Optional[str] = Query(None),   # STOCK_IN | SALE | DAMAGE | all
    date_from: Optional[str] = Query(None),  # YYYY-MM-DD
    date_to: Optional[str] = Query(None),    # YYYY-MM-DD
    product_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    filters = []

    # Filter by type (stored as VARCHAR in DB)
    if log_type and log_type.lower() != "all":
        type_map = {
            "STOCK_IN": "IMPORT",
            "IMPORT": "IMPORT",
            "SALE": "SALE",
            "DAMAGE": "DAMAGE",
        }
        db_type = type_map.get(log_type.upper())
        if db_type:
            filters.append(InventoryLog.type == db_type)

    if product_id:
        filters.append(InventoryLog.product_id == product_id)

    if date_from:
        try:
            filters.append(InventoryLog.timestamp >= datetime.strptime(date_from, "%Y-%m-%d"))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(InventoryLog.timestamp < datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            pass

    query = select(InventoryLog).options(selectinload(InventoryLog.product))
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(InventoryLog.timestamp.desc())

    result = await db.execute(query)
    logs = result.scalars().all()

    formatted_logs = []
    for log in logs:
        try:
            # reason is PostgreSQL native enum -> comes back as LogReason or string
            raw_reason = log.reason
            reason_key = raw_reason.value if isinstance(raw_reason, LogReason) else str(raw_reason)
            reason_label = LOG_REASON_LABELS.get(reason_key, reason_key)

            # type is VARCHAR
            log_type_val = str(log.type) if log.type else "ADJUSTMENT"

            # status is VARCHAR
            status_val = str(log.status) if log.status else LogStatus.APPROVED.value

            formatted_logs.append(InventoryLogResponse(
                id=log.id,
                product_id=log.product_id,
                change_amount=log.change_amount,
                type=log_type_val,
                reason=reason_key,
                reason_label=reason_label,
                compensation_amount=log.compensation_amount or 0.0,
                status=status_val,
                product_name=log.product.name if log.product else "Sản phẩm bị xóa",
                note=log.note,
                image_url=getattr(log, 'image_url', None),
                user_name=getattr(log, 'user_name', None),
                timestamp=log.timestamp
            ))
        except Exception as e:
            print(f"[get_inventory_logs] skip log id={getattr(log, 'id', '?')}: {e}")
            continue

    return formatted_logs

@app.post("/api/v1/inventory/import")
async def import_stock(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    """Nhập kho: tăng tồn và ghi log, cập nhật giá hoặc tạo mới"""
    status_val = LogStatus.APPROVED.value if req.is_admin else LogStatus.PENDING.value

    if req.product_id > 0:
        res = await db.execute(select(Product).where(Product.id == req.product_id))
        product = res.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if status_val == LogStatus.APPROVED.value:
            product.stock_quantity += req.quantity
            if req.unit_cost > 0:
                product.cost_price = req.unit_cost
            if req.selling_price is not None:
                product.price = req.selling_price
            if req.supplier_name:
                product.supplier_name = req.supplier_name
        
        log = InventoryLog(
            product_id=req.product_id,
            change_amount=req.quantity,
            type=LogType.IMPORT.value,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=status_val,
            note=f"NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note,
            image_url=req.image_url,
            user_name=req.user_name
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": product.stock_quantity, "product_id": product.id, "status": status_val}
    else:
        # Create new product
        if not req.product_name:
            raise HTTPException(status_code=400, detail="Product name is required for new product")
            
        new_p = Product(
            name=req.product_name,
            category=req.category or "Khác",
            price=req.selling_price or 0,
            cost_price=req.unit_cost,
            stock_quantity=req.quantity if status_val == LogStatus.APPROVED.value else 0,
            unit=req.unit or "cái",
            min_stock=5,
            supplier_name=req.supplier_name
        )
        db.add(new_p)
        await db.flush()
        
        log = InventoryLog(
            product_id=new_p.id,
            change_amount=req.quantity,
            type=LogType.IMPORT.value,
            reason=LogReason.STOCK_IN,
            compensation_amount=req.unit_cost * req.quantity,
            status=status_val,
            note=f"Tạo mới & Nhập kho. NCC: {req.supplier_name} | {req.note}" if req.supplier_name else req.note,
            image_url=req.image_url,
            user_name=req.user_name
        )
        db.add(log)
        await db.commit()
        return {"ok": True, "new_stock": new_p.stock_quantity, "product_id": new_p.id, "status": status_val}

# ===========================
# ORDERS / POS
# ===========================
@app.post("/api/v1/orders/checkout")
async def checkout(req: CheckoutRequest, db: AsyncSession = Depends(get_db)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
        
    for item in req.items:
        res = await db.execute(select(Product).where(Product.id == item.product_id))
        product = res.scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            
        if product.stock_quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")
            
        product.stock_quantity -= item.quantity
        
        log = InventoryLog(
            product_id=product.id,
            change_amount=-item.quantity,
            type=LogType.SALE.value,
            reason=LogReason.SALE,
            status=LogStatus.APPROVED.value,
            compensation_amount=0
        )
        db.add(log)
        
    await db.commit()
    return {"ok": True, "message": "Thanh toán thành công và đã trừ kho"}

# ===========================
# SCHEDULER & BOOKINGS
# ===========================
@app.get("/api/v1/scheduler")
async def get_scheduler(date: str, db: AsyncSession = Depends(get_db)):
    # date format YYYY-MM-DD. Fetch bookings strictly inside that day.
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)
    
    # 1. Fetch active courts
    courts_res = await db.execute(
        select(Court).options(selectinload(Court.pricing_rules)).where(Court.is_active == True)
    )
    courts = courts_res.scalars().all()
    
    # 2. Fetch bookings
    books_res = await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(
            Booking.is_deleted == False,
            Booking.start_time >= start_of_day,
            Booking.start_time < end_of_day
        )
    )
    bookings = books_res.scalars().all()
    
    # 3. Fetch blocks
    blocks_res = await db.execute(
        select(CourtBlock).where(
            CourtBlock.start_time >= start_of_day,
            CourtBlock.start_time < end_of_day
        )
    )
    blocks = blocks_res.scalars().all()
    
    return {
        "courts": courts,
        "bookings": bookings,
        "blocks": blocks
    }

@app.post("/api/v1/courts/{court_id}/block")
async def block_court(court_id: int, req: CourtBlockRequest, db: AsyncSession = Depends(get_db)):
    block = CourtBlock(
        court_id=court_id,
        start_time=req.start_time,
        end_time=req.end_time,
        reason=req.reason
    )
    db.add(block)
    await db.commit()
    return {"ok": True}

@app.post("/api/v1/bookings")
async def create_booking(req: BookingCreateRequest, db: AsyncSession = Depends(get_db)):
    # Ngăn đặt sân trong quá khứ (trước ngày hôm nay)
    now_vn = datetime.utcnow() + timedelta(hours=7)
    today_vn = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if req.start_time < today_vn:
        raise HTTPException(status_code=400, detail="Không thể đặt sân cho ngày đã qua.")

    weeks = req.recurring_weeks if req.is_recurring else 1
    
    created_bookings = []
    
    for w in range(weeks):
        # Shift start and end time by weeks
        st = req.start_time + timedelta(weeks=w)
        et = req.end_time + timedelta(weeks=w)
        
        # In a real app we'd check overlap specifically: 
        # select Booking where start_time < et AND end_time > st AND court=court_id AND is_deleted=False
        
        booking = Booking(
            user_id=req.user_id,
            guest_name=req.guest_name,
            guest_phone=req.guest_phone,
            court_id=req.court_id,
            start_time=st,
            end_time=et,
            status=BookingStatus.PENDING,
            payment_status=req.payment_status,
            note=req.note
        )
        db.add(booking)
        created_bookings.append(booking)
        
    await db.commit()
    
    # Create logs
    for b in created_bookings:
        log = BookingLog(booking_id=b.id, user_id=req.user_id, action="Create", details="Tạo lịch đặt")
        db.add(log)
    await db.commit()
    
    return {"ok": True, "count": len(created_bookings)}

@app.delete("/api/v1/blocks/{block_id}")
async def unblock_court(block_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CourtBlock).where(CourtBlock.id == block_id))
    block = res.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    await db.delete(block)
    await db.commit()
    return {"ok": True}

class BookingUpdateRequest(BaseModel):
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None
    note: Optional[str] = None
    court_id: Optional[int] = None

@app.put("/api/v1/bookings/{booking_id}")
async def update_booking(booking_id: int, req: BookingUpdateRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if req.guest_name is not None: booking.guest_name = req.guest_name
    if req.guest_phone is not None: booking.guest_phone = req.guest_phone
    if req.payment_status is not None: booking.payment_status = req.payment_status
    if req.note is not None: booking.note = req.note
    if req.court_id is not None: booking.court_id = req.court_id
    
    log = BookingLog(booking_id=booking.id, user_id=booking.user_id, action="Update", details="Cập nhật chi tiết lịch")
    db.add(log)
    
    await db.commit()
    return {"ok": True}

@app.put("/api/v1/bookings/{booking_id}/reassign")
async def reassign_booking(booking_id: int, req: ReassignRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booking.court_id = req.court_id
    booking.start_time = req.start_time
    booking.end_time = req.end_time
    
    log = BookingLog(booking_id=booking.id, user_id=booking.user_id, action="Reassign", details="Đổi sân / Giờ (Kéo Thả)")
    db.add(log)
    
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/bookings/{booking_id}")
async def delete_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.is_deleted = True
    
    log = BookingLog(booking_id=booking.id, user_id=booking.user_id, action="Delete", details="Xóa lịch (Soft Delete)")
    db.add(log)
    
    await db.commit()
    return {"ok": True}

# ===========================
# BOOKING HISTORY (for courts management)
# ===========================
@app.get("/api/v1/bookings/history")
async def get_booking_history(
    court_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    filters = [Booking.is_deleted == False]
    if court_id:
        filters.append(Booking.court_id == court_id)
    if date_from:
        dt_from = datetime.strptime(date_from, "%Y-%m-%d")
        filters.append(Booking.start_time >= dt_from)
    if date_to:
        dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        filters.append(Booking.start_time < dt_to)

    result = await db.execute(
        select(Booking).options(selectinload(Booking.court)).where(*filters).order_by(Booking.start_time.desc())
    )
    bookings = result.scalars().all()
    return [
        {
            "id": b.id,
            "court_id": b.court_id,
            "court_name": b.court.name if b.court else "",
            "guest_name": b.guest_name,
            "guest_phone": b.guest_phone,
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "payment_status": b.payment_status,
            "note": b.note
        }
        for b in bookings
    ]

@app.delete("/api/v1/bookings/history/{booking_id}")
async def hard_delete_booking_history(booking_id: int, db: AsyncSession = Depends(get_db)):
    """Hard delete - xóa khỏi database hoàn toàn (chỉ dùng ở phần quản lý)"""
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.delete(booking)
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/bookings/history")
async def hard_delete_all_history(
    court_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Hard delete nhiều booking theo filter"""
    filters = []
    if court_id:
        filters.append(Booking.court_id == court_id)
    if date_from:
        dt_from = datetime.strptime(date_from, "%Y-%m-%d")
        filters.append(Booking.start_time >= dt_from)
    if date_to:
        dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        filters.append(Booking.start_time < dt_to)

    result = await db.execute(select(Booking).where(*filters) if filters else select(Booking))
    bookings = result.scalars().all()
    count = len(bookings)
    for b in bookings:
        await db.delete(b)
    await db.commit()
    return {"ok": True, "deleted": count}

# ===========================
# STATS BY SHIFT
# ===========================
@app.get("/api/v1/stats/by-shift")
async def get_stats_by_shift(
    period: str = Query("month"),  # 'month' | 'year'
    value: str = Query(...),       # '2026-04' or '2026'
    court_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Thống kê số lượt booking theo ca (shift) trong tháng hoặc năm.
    Kết quả: [{shift_id, count, payment_statuses}]
    """
    import calendar

    filters = [Booking.is_deleted == False]
    if court_id:
        filters.append(Booking.court_id == court_id)

    if period == "month":
        year, month = int(value.split("-")[0]), int(value.split("-")[1])
        start = datetime(year, month, 1)
        _, last_day = calendar.monthrange(year, month)
        end = datetime(year, month, last_day, 23, 59, 59)
    else:  # year
        year = int(value)
        start = datetime(year, 1, 1)
        end = datetime(year, 12, 31, 23, 59, 59)

    filters.append(Booking.start_time >= start)
    filters.append(Booking.start_time <= end)

    result = await db.execute(select(Booking).where(*filters).order_by(Booking.start_time))
    bookings = result.scalars().all()

    # Bản định nghĩa ca (shifts) - phải match với SHIFTS trong frontend
    SHIFTS = [
        {"id": 1, "start": "06:00", "end": "07:30"},
        {"id": 2, "start": "07:30", "end": "09:00"},
        {"id": 3, "start": "09:00", "end": "10:30"},
        {"id": 4, "start": "10:30", "end": "12:00"},
        {"id": 5, "start": "12:00", "end": "13:30"},
        {"id": 6, "start": "13:30", "end": "15:00"},
        {"id": 7, "start": "15:00", "end": "16:30"},
        {"id": 8, "start": "16:30", "end": "18:00"},
        {"id": 9, "start": "18:00", "end": "19:30"},
        {"id": 10, "start": "19:30", "end": "21:00"},
        {"id": 11, "start": "21:00", "end": "22:30"},
        {"id": 12, "start": "22:30", "end": "23:59"}
    ]

    # Tính toán shift_id dựa theo giờ bắt đầu của booking
    stats: dict[int, dict] = {s["id"]: {"shift_id": s["id"], "shift_label": f"{s['start']}-{s['end']}", "count": 0, "paid": 0, "deposit": 0, "unpaid": 0} for s in SHIFTS}
    
    for b in bookings:
        booking_hour = b.start_time.strftime("%H:%M")
        matched_shift = None
        for s in SHIFTS:
            if s["start"] <= booking_hour < s["end"]:
                matched_shift = s["id"]
                break
        if matched_shift and matched_shift in stats:
            stats[matched_shift]["count"] += 1
            ps = str(b.payment_status).replace("PaymentStatus.", "")
            if ps == "Fully_Paid":
                stats[matched_shift]["paid"] += 1
            elif ps == "Deposit":
                stats[matched_shift]["deposit"] += 1
            else:
                stats[matched_shift]["unpaid"] += 1

    result_list = list(stats.values())
    if result_list:
        max_count = max(r["count"] for r in result_list)
        min_count = min(r["count"] for r in result_list if r["count"] > 0) if any(r["count"] > 0 for r in result_list) else 0
        for r in result_list:
            r["is_peak"] = r["count"] == max_count and max_count > 0
            r["is_low"] = r["count"] == min_count and r["count"] > 0 and min_count < max_count

    return {"stats": result_list, "period": period, "value": value, "total_bookings": len(bookings)}


# ===========================
# BANK SETTINGS
# ===========================
@app.get("/api/v1/bank-settings")
async def get_bank_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankSettings).where(BankSettings.is_active == True).limit(1))
    bank = result.scalar_one_or_none()
    if not bank:
        return None
    return bank

@app.get("/api/v1/bank-settings/all")
async def get_all_bank_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankSettings).order_by(BankSettings.id.desc()))
    return result.scalars().all()

@app.put("/api/v1/bank-settings")
async def upsert_bank_settings(req: BankSettingsRequest, db: AsyncSession = Depends(get_db)):
    # Đặt tất cả cũ là inactive
    await db.execute(update(BankSettings).values(is_active=False))
    
    # Tìm hoặc tạo mới
    result2 = await db.execute(select(BankSettings).where(
        BankSettings.account_number == req.account_number,
        BankSettings.bank_code == req.bank_code
    ))
    existing = result2.scalar_one_or_none()

    if existing:
        existing.is_active = True
        existing.account_name = req.account_name
        existing.bank_name = req.bank_name
        await db.commit()
        return {"ok": True, "id": existing.id}
    else:
        bank = BankSettings(**req.dict(), is_active=True)
        db.add(bank)
        await db.commit()
        return {"ok": True, "id": bank.id}

@app.put("/api/v1/bank-settings/{bank_id}/toggle")
async def toggle_bank_setting(bank_id: int, req: BankToggleRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankSettings).where(BankSettings.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank setting not found")
        
    if req.is_active:
        # Deactivate all others first
        await db.execute(update(BankSettings).values(is_active=False))
    
    bank.is_active = req.is_active
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/bank-settings/{bank_id}")
async def delete_bank_setting(bank_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankSettings).where(BankSettings.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank setting not found")
    
    await db.delete(bank)
    await db.commit()
    return {"ok": True}


# ===========================
# PRODUCT SALES STATISTICS
# ===========================
@app.get("/api/v1/stats/products")
async def get_product_stats(
    period: str = Query("month"),   # "day" | "range" | "month" | "year"
    value: str = Query(""),         # "2026-04-13" | "2026-04" | "2026"
    date_from: Optional[str] = Query(None),  # YYYY-MM-DD (for range mode)
    date_to: Optional[str] = Query(None),    # YYYY-MM-DD (for range mode)
    category: Optional[str] = Query(None),   # filter by product category
    db: AsyncSession = Depends(get_db)
):
    """Thống kê số lượng bán + doanh thu theo ngày/tháng/năm/khoảng ngày"""
    from sqlalchemy import extract, func as sqlfunc
    
    # Base: only SALE type & APPROVED status
    base_filters = [
        InventoryLog.type == LogType.SALE.value,
        InventoryLog.status == LogStatus.APPROVED.value,
    ]
    
    # Period filters
    try:
        if period == "day" and value:
            day_dt = datetime.strptime(value, "%Y-%m-%d")
            next_day = day_dt + timedelta(days=1)
            base_filters += [
                InventoryLog.timestamp >= day_dt,
                InventoryLog.timestamp < next_day,
            ]
        elif period == "range" and date_from and date_to:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            base_filters += [
                InventoryLog.timestamp >= dt_from,
                InventoryLog.timestamp < dt_to,
            ]
        elif period == "month" and value:
            yr, mo = value.split("-")
            base_filters += [
                extract('year', InventoryLog.timestamp) == int(yr),
                extract('month', InventoryLog.timestamp) == int(mo),
            ]
        elif period == "year" and value:
            base_filters.append(extract('year', InventoryLog.timestamp) == int(value))
    except Exception as e:
        print(f"[stats] filter error: {e}")

    query = select(
        InventoryLog.product_id,
        sqlfunc.sum(InventoryLog.change_amount * -1).label("qty_sold"),
        sqlfunc.count(InventoryLog.id).label("transactions"),
    ).where(*base_filters).group_by(InventoryLog.product_id).order_by(
        sqlfunc.sum(InventoryLog.change_amount * -1).desc()
    )

    result = await db.execute(query)
    rows = result.all()

    # Load product info
    if not rows:
        return {"period": period, "value": value, "by_category": [], "by_product": [], "total_qty": 0, "total_revenue": 0}

    product_ids = [r[0] for r in rows]
    products_res = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products_map = {p.id: p for p in products_res.scalars().all()}

    stats_by_category: dict = {}
    stats_by_product = []

    for row in rows:
        pid, qty, txn = row
        p = products_map.get(pid)
        if not p:
            continue
        
        # Apply category filter if provided
        if category and p.category != category:
            continue
        
        cat = p.category
        qty_val = int(qty or 0)
        revenue = qty_val * (p.price or 0)

        if cat not in stats_by_category:
            stats_by_category[cat] = {"category": cat, "qty_sold": 0, "transactions": 0, "revenue": 0}
        stats_by_category[cat]["qty_sold"] += qty_val
        stats_by_category[cat]["transactions"] += int(txn or 0)
        stats_by_category[cat]["revenue"] += revenue

        stats_by_product.append({
            "product_id": pid,
            "product_name": p.name,
            "category": cat,
            "unit": p.unit or "cái",
            "price": p.price or 0,
            "qty_sold": qty_val,
            "transactions": int(txn or 0),
            "revenue": revenue,
        })

    total_qty = sum(s["qty_sold"] for s in stats_by_product)
    total_revenue = sum(s["revenue"] for s in stats_by_product)

    return {
        "period": period,
        "value": value,
        "date_from": date_from,
        "date_to": date_to,
        "category": category,
        "by_category": sorted(list(stats_by_category.values()), key=lambda x: x["qty_sold"], reverse=True),
        "by_product": stats_by_product,
        "total_qty": total_qty,
        "total_revenue": total_revenue,
    }

class InventoryLogEditRequest(BaseModel):
    is_admin: bool = False
    change_amount: Optional[int] = None
    note: Optional[str] = None
    image_url: Optional[str] = None
    supplier_name: Optional[str] = None
    unit_cost: Optional[float] = None

@app.put("/api/v1/inventory/logs/{log_id}/approve")
async def approve_inventory_log(log_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(selectinload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if log.status == LogStatus.APPROVED.value:
        return {"ok": True, "message": "Already approved"}
        
    log.status = LogStatus.APPROVED.value
    
    # Increase stock if this was an import
    if str(log.reason) == LogReason.STOCK_IN.value or str(log.type) == LogType.IMPORT.value:
        log.product.stock_quantity += log.change_amount

    await db.commit()
    return {"ok": True, "new_stock": log.product.stock_quantity}

@app.put("/api/v1/inventory/logs/{log_id}/reject")
async def reject_inventory_log(log_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if log.status == LogStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Cannot reject an already approved log")
        
    log.status = LogStatus.REJECTED.value
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/inventory/logs/{log_id}")
async def delete_inventory_log(log_id: int, is_admin: bool = False, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(selectinload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if not is_admin and log.status != LogStatus.PENDING.value:
        raise HTTPException(status_code=403, detail="Staff can only delete pending logs")
        
    if log.status == LogStatus.APPROVED.value and str(log.reason) == LogReason.STOCK_IN.value:
        log.product.stock_quantity -= log.change_amount
        if log.product.stock_quantity < 0:
            log.product.stock_quantity = 0
            
    await db.delete(log)
    await db.commit()
    return {"ok": True}

@app.put("/api/v1/inventory/logs/{log_id}")
async def update_inventory_log(log_id: int, req: InventoryLogEditRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryLog).options(selectinload(InventoryLog.product)).where(InventoryLog.id == log_id))
    log = res.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if not req.is_admin and log.status != LogStatus.PENDING.value:
        raise HTTPException(status_code=403, detail="Staff can only edit pending logs")
        
    if req.note is not None:
        log.note = req.note
    if req.image_url is not None:
        log.image_url = req.image_url
        
    if req.change_amount is not None and req.change_amount != log.change_amount:
        if log.status == LogStatus.APPROVED.value and str(log.reason) == LogReason.STOCK_IN.value:
            diff = req.change_amount - log.change_amount
            log.product.stock_quantity += diff
        log.change_amount = req.change_amount
        
    if req.unit_cost is not None:
        log.compensation_amount = req.unit_cost * log.change_amount
        
    await db.commit()
    return {"ok": True}


# ==================================
# HELPERS
# ==================================
def _gen_payment_ref(booking_id: int) -> str:
    """Tạo mã nội dung chuyển khoản duy nhất, ngắn gọn."""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"SAN{booking_id}{suffix}"


async def _auto_cancel_expired():
    """Background: tự động hủy booking hết hạn chưa thanh toán."""
    from app.db import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        res = await db.execute(
            select(Booking).where(
                Booking.is_online == True,
                Booking.payment_status == PaymentStatus.UNPAID,
                Booking.is_deleted == False,
                Booking.expires_at != None,
                Booking.expires_at < now
            )
        )
        expired = res.scalars().all()
        for b in expired:
            b.is_deleted = True
            b.status = BookingStatus.CANCELLED
        if expired:
            await db.commit()
            print(f"[AutoCancel] {len(expired)} booking(s) expired & cancelled.")


# ==================================
# ONLINE BOOKING — PUBLIC ENDPOINTS
# ==================================

class OnlineBookingRequest(BaseModel):
    court_id: int
    date: str             # YYYY-MM-DD
    shift_ids: List[int]  # Danh sách ca ID muốn đặt
    guest_name: str
    guest_phone: str
    note: Optional[str] = ""

class OnlineBookingResponse(BaseModel):
    booking_id: int
    payment_ref: str
    expires_at: str       # ISO string
    total_amount: float
    court_name: str
    shifts: List[dict]

class ProofUploadResponse(BaseModel):
    ok: bool
    message: str

class WebhookConfirmRequest(BaseModel):
    payment_ref: str
    amount: float
    source: Optional[str] = "manual"

# Bản định nghĩa ca (phải đồng bộ với frontend)
SHIFTS = [
    {"id": 1,  "start": "06:00", "end": "07:30"},
    {"id": 2,  "start": "07:30", "end": "09:00"},
    {"id": 3,  "start": "09:00", "end": "10:30"},
    {"id": 4,  "start": "10:30", "end": "12:00"},
    {"id": 5,  "start": "12:00", "end": "13:30"},
    {"id": 6,  "start": "13:30", "end": "15:00"},
    {"id": 7,  "start": "15:00", "end": "16:30"},
    {"id": 8,  "start": "16:30", "end": "18:00"},
    {"id": 9,  "start": "18:00", "end": "19:30"},
    {"id": 10, "start": "19:30", "end": "21:00"},
    {"id": 11, "start": "21:00", "end": "22:30"},
    {"id": 12, "start": "22:30", "end": "23:59"},
]


@app.get("/api/v1/courts/availability")
async def get_court_availability(date: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint công khai: trả về danh sách sân và trạng thái từng ca theo ngày.
    Dùng để hiển thị lịch đặt sân cho khách hàng.
    """
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Ngày không hợp lệ (YYYY-MM-DD)")

    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)

    courts_res = await db.execute(select(Court).where(Court.is_active == True))
    courts_list = courts_res.scalars().all()

    court_ids = [c.id for c in courts_list]

    books_res = await db.execute(
        select(Booking).where(
            Booking.is_deleted == False,
            Booking.court_id.in_(court_ids),
            Booking.start_time >= start_of_day,
            Booking.start_time < end_of_day,
        )
    )
    bookings = books_res.scalars().all()

    blocks_res = await db.execute(
        select(CourtBlock).where(
            CourtBlock.court_id.in_(court_ids),
            CourtBlock.start_time >= start_of_day,
            CourtBlock.start_time < end_of_day,
        )
    )
    blocks = blocks_res.scalars().all()

    # Pre-load ALL pricing rules for all courts in ONE query
    rules_res = await db.execute(
        select(CourtPricingRule).where(CourtPricingRule.court_id.in_(court_ids))
    )
    all_rules = rules_res.scalars().all()
    # Index: {(court_id, shift_id): price_override}
    rules_map: dict = {}
    for r in all_rules:
        if r.price_override:
            rules_map[(r.court_id, r.shift_id)] = r.price_override

    now_utc = datetime.utcnow()

    result_courts = []
    for court in courts_list:
        shift_statuses = []
        for shift in SHIFTS:
            sh_start = datetime.combine(target_date, datetime.strptime(shift["start"], "%H:%M").time())
            sh_end_str = shift["end"]
            if sh_end_str == "23:59":
                sh_end = datetime.combine(target_date, datetime.strptime("23:59", "%H:%M").time())
            else:
                sh_end = datetime.combine(target_date, datetime.strptime(sh_end_str, "%H:%M").time())

            s_ts = sh_start.timestamp()
            e_ts = sh_end.timestamp()

            booking_hit = next(
                (b for b in bookings
                 if b.court_id == court.id
                 and b.start_time.timestamp() < e_ts
                 and b.end_time.timestamp() > s_ts),
                None
            )

            block_hit = next(
                (bl for bl in blocks
                 if bl.court_id == court.id
                 and bl.start_time.timestamp() < e_ts
                 and bl.end_time.timestamp() > s_ts),
                None
            )

            if block_hit:
                shift_status = "blocked"
            elif booking_hit:
                is_online_hold = (
                    getattr(booking_hit, 'is_online', False) and
                    str(booking_hit.payment_status).replace("PaymentStatus.", "") == "Unpaid" and
                    booking_hit.expires_at is not None and
                    booking_hit.expires_at > now_utc
                )
                shift_status = "holding" if is_online_hold else "booked"
            else:
                shift_status = "available"

            price = rules_map.get((court.id, shift["id"]), court.price_per_hour)

            shift_statuses.append({
                "shift_id": shift["id"],
                "start": shift["start"],
                "end": shift["end"],
                "status": shift_status,
                "price": price,
            })

        result_courts.append({
            "id": court.id,
            "name": court.name,
            "type": court.type,
            "price_per_hour": court.price_per_hour,
            "deposit_price": court.deposit_price,
            "shifts": shift_statuses,
        })

    return {"courts": result_courts, "date": date}



@app.post("/api/v1/online-bookings")
async def create_online_booking(
    req: OnlineBookingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Tạo đặt sân online kèm giữ chỗ 15 phút."""
    # Validate court
    court_res = await db.execute(select(Court).where(Court.id == req.court_id, Court.is_active == True))
    court = court_res.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Sân không tồn tại")

    try:
        target_date = datetime.strptime(req.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Ngày không hợp lệ")

    now_utc = datetime.utcnow()
    now_vn = now_utc + timedelta(hours=7)
    today_vn = now_vn.replace(hour=0, minute=0, second=0, microsecond=0).date()
    if target_date < today_vn:
        raise HTTPException(status_code=400, detail="Không thể đặt sân cho ngày đã qua")

    # Validate shifts
    valid_shift_ids = {s["id"] for s in SHIFTS}
    for sid in req.shift_ids:
        if sid not in valid_shift_ids:
            raise HTTPException(status_code=400, detail=f"Ca {sid} không hợp lệ")

    # Kiểm tra từng ca xem có bị trùng không
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)
    existing_res = await db.execute(
        select(Booking).where(
            Booking.court_id == req.court_id,
            Booking.is_deleted == False,
            Booking.start_time >= start_of_day,
            Booking.start_time < end_of_day,
        )
    )
    existing_bookings = existing_res.scalars().all()

    expires_at = now_utc + timedelta(minutes=15)
    created_ids = []
    shift_info_list = []
    total_amount = 0.0
    common_payment_ref = None

    for sid in req.shift_ids:
        shift = next(s for s in SHIFTS if s["id"] == sid)
        sh_start = datetime.combine(target_date, datetime.strptime(shift["start"], "%H:%M").time())
        sh_end_str = shift["end"]
        sh_end = datetime.combine(target_date, datetime.strptime("23:59" if sh_end_str == "23:59" else sh_end_str, "%H:%M").time())

        # Kiểm tra trùng lịch (bỏ qua booking đã hết hạn giữ chỗ)
        conflict = next(
            (b for b in existing_bookings
             if b.start_time.timestamp() < sh_end.timestamp()
             and b.end_time.timestamp() > sh_start.timestamp()
             and not (b.is_online and str(b.payment_status).replace("PaymentStatus.", "") == "Unpaid"
                     and b.expires_at and b.expires_at <= now_utc)),
            None
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Ca {shift['start']}-{shift['end']} đã được đặt. Vui lòng chọn ca khác."
            )

        # Tính giá
        rule_res = await db.execute(
            select(CourtPricingRule).where(
                CourtPricingRule.court_id == req.court_id,
                CourtPricingRule.shift_id == sid
            )
        )
        rule = rule_res.scalar_one_or_none()
        price_per_hour = rule.price_override if rule and rule.price_override else court.price_per_hour
        duration_h = (sh_end.timestamp() - sh_start.timestamp()) / 3600
        shift_price = duration_h * price_per_hour
        total_amount += shift_price

        booking = Booking(
            court_id=req.court_id,
            guest_name=req.guest_name,
            guest_phone=req.guest_phone,
            start_time=sh_start,
            end_time=sh_end,
            status=BookingStatus.PENDING,
            payment_status=PaymentStatus.UNPAID,
            note=req.note,
            expires_at=expires_at,
            is_online=True,
            price=shift_price,
        )
        db.add(booking)
        await db.flush()  # Lấy ID

        if common_payment_ref is None:
            # Tạo payment_ref từ ID của booking đầu tiên
            common_payment_ref = _gen_payment_ref(booking.id)
        
        booking.payment_ref = common_payment_ref
        created_ids.append(booking.id)
        shift_info_list.append({
            "shift_id": sid,
            "start": shift["start"],
            "end": shift["end"],
            "price": shift_price
        })

    await db.commit()

    # Cleanup background
    background_tasks.add_task(_auto_cancel_expired)

    # Trả về thông tin booking đầu tiên (chủ yếu để frontend redirect)
    first_booking_res = await db.execute(select(Booking).where(Booking.id == created_ids[0]))
    first_booking = first_booking_res.scalar_one()

    return {
        "ok": True,
        "booking_id": first_booking.id,
        "booking_ids": created_ids,
        "payment_ref": first_booking.payment_ref,
        "expires_at": first_booking.expires_at.isoformat() + "Z",
        "total_amount": round(total_amount),
        "court_name": court.name,
        "shifts": shift_info_list,
        "date": req.date,
        "guest_name": req.guest_name,
        "guest_phone": req.guest_phone,
    }


@app.get("/api/v1/online-bookings/{booking_id}")
async def get_online_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    """Tra cứu trạng thái booking (dùng để polling ở trang thanh toán)."""
    res = await db.execute(
        select(Booking).options(selectinload(Booking.court)).where(Booking.id == booking_id)
    )
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking không tồn tại")

    now_utc = datetime.utcnow()
    is_expired = (
        b.is_online and
        b.payment_status == PaymentStatus.UNPAID and
        b.expires_at is not None and
        b.expires_at <= now_utc
    )

    # Tính tổng tiền (từ nhóm booking cùng payment_ref gốc)
    # Lấy booking đầu tiên trong nhóm (có ID gốc là phần sau SAN)
    group_query = select(Booking).where(
        Booking.guest_phone == b.guest_phone,
        Booking.is_deleted == False,
    )
    if b.payment_ref:
        # Tìm các booking có cùng tiền tố SAN + ID của đơn đầu tiên
        # Ví dụ: SAN123ABC -> tìm SAN123...
        import re
        m = re.match(r'(SAN\d+)', b.payment_ref)
        if m:
            prefix = m.group(1)
            group_query = group_query.where(Booking.payment_ref.like(f"{prefix}%"))
    
    group_res = await db.execute(group_query)
    group_bookings = group_res.scalars().all()
    total_amount = sum(gb.price or 0.0 for gb in group_bookings)

    return {
        "id": b.id,
        "court_name": b.court.name if b.court else "",
        "court_id": b.court_id,
        "guest_name": b.guest_name,
        "guest_phone": b.guest_phone,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "payment_status": str(b.payment_status).replace("PaymentStatus.", ""),
        "status": str(b.status).replace("BookingStatus.", ""),
        "payment_ref": b.payment_ref,
        "expires_at": b.expires_at.isoformat() + "Z" if b.expires_at else None,
        "is_expired": is_expired,
        "is_deleted": b.is_deleted,
        "proof_image_url": b.proof_image_url,
        "total_amount": round(total_amount),
        "note": b.note,
    }


@app.get("/api/v1/online-bookings/by-phone/{phone}")
async def get_bookings_by_phone(phone: str, db: AsyncSession = Depends(get_db)):
    """Tra cứu lịch sử đặt sân theo số điện thoại."""
    res = await db.execute(
        select(Booking).options(selectinload(Booking.court)).where(
            Booking.guest_phone == phone,
            Booking.is_online == True,
        ).order_by(Booking.start_time.desc()).limit(50)
    )
    bookings = res.scalars().all()
    return [
        {
            "id": b.id,
            "court_name": b.court.name if b.court else "",
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "payment_status": str(b.payment_status).replace("PaymentStatus.", ""),
            "status": str(b.status).replace("BookingStatus.", ""),
            "payment_ref": b.payment_ref,
            "expires_at": b.expires_at.isoformat() + "Z" if b.expires_at else None,
            "proof_image_url": b.proof_image_url,
            "is_deleted": b.is_deleted,
        }
        for b in bookings
    ]


@app.post("/api/v1/online-bookings/{booking_id}/upload-proof")
async def upload_proof(
    booking_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload ảnh minh chứng chuyển khoản của khách."""
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking không tồn tại")

    # Lưu file
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"proof_{booking_id}_{int(datetime.utcnow().timestamp())}{ext}"
    file_path = f"uploads/{filename}"
    with open(file_path, "wb+") as f:
        shutil.copyfileobj(file.file, f)

    proof_url = f"http://localhost:8000/uploads/{filename}"
    booking.proof_image_url = proof_url
    # Đánh dấu chờ xác nhận thủ công nếu chưa được webhook xác nhận
    if str(booking.payment_status).replace("PaymentStatus.", "") == "Unpaid":
        booking.payment_status = PaymentStatus.DEPOSIT  # Tạm dùng Deposit = "đang chờ"

    log = BookingLog(
        booking_id=booking.id,
        user_id=None,
        action="UploadProof",
        details=f"Khách upload minh chứng: {proof_url}"
    )
    db.add(log)
    await db.commit()

    return {"ok": True, "proof_url": proof_url, "message": "Minh chứng đã được gửi, đang chờ xác nhận."}


@app.post("/api/v1/webhooks/casso")
async def webhook_casso(request_data: dict, db: AsyncSession = Depends(get_db)):
    """
    Webhook nhận callback từ Casso/SePay khi có biến động số dư.
    Casso gửi: {"data": [{"description": "...", "amount": 150000, ...}]}
    """
    raw = json.dumps(request_data, ensure_ascii=False)
    transactions = request_data.get("data", [request_data])  # Casso gửi list hoặc single

    matched_count = 0
    for txn in transactions:
        description = str(txn.get("description", "") or txn.get("content", "")).upper()
        amount = float(txn.get("amount", 0) or 0)

        # Tìm payment_ref trong nội dung (pattern SAN + digits + 6chars)
        import re
        matches = re.findall(r'SAN\d+[A-Z0-9]{6}', description)

        for ref in matches:
            # Tìm TẤT CẢ booking có cùng payment_ref
            booking_res = await db.execute(
                select(Booking).where(
                    Booking.payment_ref == ref,
                    Booking.is_deleted == False,
                )
            )
            matched_bookings = booking_res.scalars().all()

            if matched_bookings:
                # Lấy booking đầu tiên để log info
                first_b = matched_bookings[0]
                
                wlog = WebhookLog(
                    source="casso",
                    payment_ref=ref,
                    amount=amount,
                    booking_id=first_b.id,
                    matched=True,
                    raw_data=raw[:2000],
                )
                db.add(wlog)

                for b in matched_bookings:
                    b.payment_status = PaymentStatus.FULLY_PAID
                    b.status = BookingStatus.PAID
                    b.expires_at = None

                log = BookingLog(
                    booking_id=first_b.id,
                    user_id=None,
                    action="WebhookPaid",
                    details=f"Tự động xác nhận qua Casso ({len(matched_bookings)} ca). Ref: {ref}, Số tiền: {amount:,.0f}đ"
                )
                db.add(log)
                matched_count += 1
            else:
                # Log phụ cho trường hợp không khớp
                wlog = WebhookLog(
                    source="casso",
                    payment_ref=ref,
                    amount=amount,
                    matched=False,
                    raw_data=raw[:2000],
                )
                db.add(wlog)

    await db.commit()
    return {"ok": True, "matched": matched_count}


@app.post("/api/v1/webhooks/confirm-test")
async def webhook_confirm_test(req: WebhookConfirmRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint giả lập xác nhận thanh toán (dùng để test nội bộ, không cần tài khoản Casso).
    Production: bỏ hoặc bảo vệ bằng API key.
    """
    booking_res = await db.execute(
        select(Booking).where(
            Booking.payment_ref == req.payment_ref,
            Booking.is_deleted == False,
        )
    )
    matched_bookings = booking_res.scalars().all()
    if not matched_bookings:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy booking với ref: {req.payment_ref}")

    for b in matched_bookings:
        b.payment_status = PaymentStatus.FULLY_PAID
        b.status = BookingStatus.PAID
        b.expires_at = None

    first_b = matched_bookings[0]


    wlog = WebhookLog(
        source=req.source or "manual",
        payment_ref=req.payment_ref,
        amount=req.amount,
        booking_id=first_b.id,
        matched=True,
        raw_data=json.dumps(req.model_dump(), ensure_ascii=False),
    )
    db.add(wlog)

    log = BookingLog(
        booking_id=first_b.id,
        user_id=None,
        action="ManualConfirm",
        details=f"Xác nhận thủ công/test ({len(matched_bookings)} ca). Số tiền: {req.amount:,.0f}đ"
    )
    db.add(log)
    await db.commit()

    return {"ok": True, "booking_id": booking.id, "payment_status": "Fully_Paid"}


@app.post("/api/v1/online-bookings/{booking_id}/manual-approve")
async def manual_approve_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    """Admin duyệt thủ công booking online khi có ảnh minh chứng."""
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking không tồn tại")

    booking.payment_status = PaymentStatus.FULLY_PAID
    booking.status = BookingStatus.PAID
    booking.expires_at = None

    log = BookingLog(
        booking_id=booking.id,
        user_id=None,
        action="AdminApprove",
        details="Admin duyệt thủ công qua ảnh minh chứng"
    )
    db.add(log)
    await db.commit()
    return {"ok": True}


@app.get("/api/v1/webhook-logs")
async def get_webhook_logs(limit: int = Query(50), db: AsyncSession = Depends(get_db)):
    """Admin: xem lịch sử webhook."""
    res = await db.execute(
        select(WebhookLog).order_by(WebhookLog.timestamp.desc()).limit(limit)
    )
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "source": l.source,
            "payment_ref": l.payment_ref,
            "amount": l.amount,
            "booking_id": l.booking_id,
            "matched": l.matched,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in logs
    ]
