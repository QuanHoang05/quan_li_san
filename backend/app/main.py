from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from contextlib import asynccontextmanager
from pydantic import BaseModel
from datetime import datetime, timedelta, date, timezone
import shutil
import os

from app.db import engine, get_db, AsyncSessionLocal
from app.models import (
    Base, Product, Court, CourtType, InventoryLog, LogReason, LogStatus, LogType, LOG_REASON_LABELS,
    Booking, BookingStatus, CourtBlock, BookingLog, PaymentStatus, CourtPricingRule, BankSettings,
    OnlineBooking, WebhookLog, UserRole, User as UserModel,
    Match, MatchParticipant, MatchRequest, Notification, MatchStatus, MatchRequestStatus
)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

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

# Matchmaking Schemas
class MatchCreate(BaseModel):
    sport: str
    level: str
    time: datetime
    courts: str
    max_slots: int
    author_id: int

class MatchResponse(BaseModel):
    id: int
    author_id: int
    author_name: str
    sport: str
    level: str
    time: datetime
    courts: str
    max_slots: int
    current_slots: int
    status: str
    participants: List[str] = []
    class Config:
        from_attributes = True

class MatchJoinRequest(BaseModel):
    requester_id: int

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime
    match_request_id: Optional[int]
    class Config:
        from_attributes = True

# Lifecycle: create tables + PostgreSQL migration
@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # --- Auto-Migration: add 'type' column if missing (PostgreSQL only) ---
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'ADJUSTMENT'"))
            # Backfill type for existing records
            await conn.execute(text("""
                UPDATE inventory_logs SET type = CASE
                    WHEN reason = 'STOCK_IN' THEN 'IMPORT'
                    WHEN reason = 'SALE' THEN 'SALE'
                    WHEN reason IN ('EXPIRED', 'NATURAL_DAMAGE', 'CUSTOMER_DAMAGE') THEN 'DAMAGE'
                    ELSE 'ADJUSTMENT'
                END
                WHERE type IS NULL OR type = 'ADJUSTMENT'
            """))
            print("[Migration] 'type' column ready.")
            
            # --- Auto-Migration: transactions table ---
            await conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS proof_url VARCHAR(500)"))
            await conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note VARCHAR(200)"))
            await conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Completed'"))
            print("[Migration] 'transactions' columns ready.")

            # --- Auto-Migration: webhook_logs table ---
            await conn.execute(text("ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(200)"))
            await conn.execute(text("ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS amount FLOAT"))
            await conn.execute(text("ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS matched BOOLEAN DEFAULT FALSE"))
            await conn.execute(text("ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS raw TEXT"))
            print("[Migration] 'webhook_logs' columns ready.")
        except Exception as e:
            print(f"[Migration] info: {e}")

    # --- Seed Admin ---
    async with AsyncSessionLocal() as session:
        try:
            from app.models import User as UserModel
            res = await session.execute(select(UserModel).where(UserModel.email == "admin@example.com"))
            if not res.scalar_one_or_none():
                admin = UserModel(
                    name="Quản trị viên",
                    email="admin@example.com",
                    role=UserRole.ADMIN,
                    password_hash=pwd_context.hash("123"),
                    wallet_balance=1000000.0
                )
                session.add(admin)
                await session.commit()
                print("[Seed] Created Admin")
        except Exception as e:
            print(f"[Seed] Error: {e}")

    yield

app = FastAPI(title="QuanLiSan API", lifespan=lifespan)

# Mount uploads dir
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Setup CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
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
    return {"url": f"http://127.0.0.1:8000/uploads/{file.filename}"}

# --- SHIFT UTILS ---
SHIFTS_DEF = [
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

def _shift_to_datetime(date_str: str, time_str: str):
    """date_str: YYYY-MM-DD, time_str: HH:MM"""
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")

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
    # Nhập kho luôn tự động duyệt (Approved) để cập nhật tồn kho ngay lập tức
    # Chế độ PENDING chỉ dành cho Báo hỏng (Damage)
    status_val = LogStatus.APPROVED.value

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

    online_res = await db.execute(
        select(OnlineBooking).where(
            OnlineBooking.date == date,
            OnlineBooking.status == "holding"
        )
    )
    online_bookings = online_res.scalars().all()
    
    return {
        "courts": courts,
        "bookings": bookings,
        "blocks": blocks,
        "online_bookings": online_bookings
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
    return {"id": bank.id, "bank_code": bank.bank_code, "bank_name": bank.bank_name,
            "account_number": bank.account_number, "account_name": bank.account_name, "is_active": bank.is_active}

@app.put("/api/v1/bank-settings")
async def upsert_bank_settings(req: BankSettingsRequest, db: AsyncSession = Depends(get_db)):
    # Tìm hoặc tạo mới (không tắt các nhà bank khác)
    result2 = await db.execute(select(BankSettings).where(
        BankSettings.account_number == req.account_number,
        BankSettings.bank_code == req.bank_code
    ))
    existing = result2.scalar_one_or_none()
    if existing:
        existing.bank_name = req.bank_name
        existing.account_name = req.account_name
        existing.is_active = True
        await db.commit()
        return {"ok": True, "id": existing.id}
    else:
        bank = BankSettings(**req.dict(), is_active=True)
        db.add(bank)
        await db.commit()
        await db.refresh(bank)
        return {"ok": True, "id": bank.id}


@app.get("/api/v1/bank-settings/all", response_model=List[BankSettingsResponse])
async def get_all_bank_settings(db: AsyncSession = Depends(get_db)):
    """Trả về tất cả tài khoản ngân hàng."""
    result = await db.execute(select(BankSettings).order_by(BankSettings.id))
    return result.scalars().all()


class BankToggleRequest(BaseModel):
    is_active: Optional[bool] = None

@app.put("/api/v1/bank-settings/{bank_id}/toggle")
async def toggle_bank_settings(bank_id: int, req: BankToggleRequest = BankToggleRequest(), db: AsyncSession = Depends(get_db)):
    """Bật/Tắt tài khoản ngân hàng."""
    result = await db.execute(select(BankSettings).where(BankSettings.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank settings not found")
    # Nếu frontend gửi is_active thì dùng giá trị đó, không thì toggle
    bank.is_active = req.is_active if req.is_active is not None else (not bank.is_active)
    await db.commit()
    return {"ok": True, "is_active": bank.is_active}


@app.delete("/api/v1/bank-settings/{bank_id}")
async def delete_bank_settings(bank_id: int, db: AsyncSession = Depends(get_db)):
    """Xóa tài khoản ngân hàng."""
    result = await db.execute(select(BankSettings).where(BankSettings.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank settings not found")
    await db.delete(bank)
    await db.commit()
    return {"ok": True}


# ===========================
# ONLINE BOOKING SYSTEM
# ===========================
SHIFTS_DEF = [
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


def _shift_to_datetime(date_str: str, time_str: str) -> datetime:
    """Convert YYYY-MM-DD + HH:MM to datetime."""
    h, m = map(int, time_str.split(":"))
    base = datetime.strptime(date_str, "%Y-%m-%d")
    return base.replace(hour=h, minute=m, second=0, microsecond=0)


@app.get("/api/v1/courts/availability")
async def get_court_availability(date: str = Query(...), db: AsyncSession = Depends(get_db)):
    """
    Trả về danh sách sân + trạng thái từng ca cho ngày chỉ định.
    status: 'available' | 'holding' | 'booked'
    """
    import json
    now_utc = datetime.utcnow()
    now_vn = now_utc + timedelta(hours=7)

    # 1. Lấy các sân hoạt động + pricing rules
    courts_res = await db.execute(
        select(Court).options(selectinload(Court.pricing_rules)).where(Court.is_active == True)
    )
    courts = courts_res.scalars().all()

    # 2. Lấy bookings admin (đã xác nhận) trong ngày
    start_of_day = datetime.strptime(date, "%Y-%m-%d")
    end_of_day = start_of_day + timedelta(days=1)
    bookings_res = await db.execute(
        select(Booking).where(
            Booking.is_deleted == False,
            Booking.start_time >= start_of_day,
            Booking.start_time < end_of_day,
        )
    )
    admin_bookings = bookings_res.scalars().all()

    # 3. Lấy online bookings (holding) trong ngày
    online_res = await db.execute(
        select(OnlineBooking).where(
            OnlineBooking.date == date,
            OnlineBooking.status == "holding",
        )
    )
    online_bookings = online_res.scalars().all()

    # 4. Lấy court blocks (bảo trì) trong ngày
    blocks_res = await db.execute(
        select(CourtBlock).where(
            CourtBlock.start_time >= start_of_day,
            CourtBlock.start_time < end_of_day,
        )
    )
    blocks = blocks_res.scalars().all()

    # Xây dựng set (court_id, shift_id) đã bị có 
    booked_slots: set = set()
    holding_slots: set = set()
    blocked_slots: set = set()

    for bl in blocks:
        b_start = bl.start_time.strftime("%H:%M")
        b_end = bl.end_time.strftime("%H:%M")
        if bl.end_time.date() > bl.start_time.date():
            b_end = "23:59" # Cap at end of day
            
        for s in SHIFTS_DEF:
            s_start = s["start"]
            s_end = s["end"]
            # Overlap if max(start) < min(end)
            if max(s_start, b_start) < min(s_end, b_end):
                blocked_slots.add((bl.court_id, s["id"]))

    for b in admin_bookings:
        b_start = b.start_time.strftime("%H:%M")
        for s in SHIFTS_DEF:
            if s["start"] <= b_start < s["end"]:
                booked_slots.add((b.court_id, s["id"]))

    for ob in online_bookings:
        try:
            shift_ids = json.loads(ob.shift_ids)
        except Exception:
            shift_ids = []
        is_expired = ob.expires_at and ob.expires_at < now_utc
        for sid in shift_ids:
            if ob.status == "confirmed":
                booked_slots.add((ob.court_id, sid))
            elif ob.status == "holding" and not is_expired:
                holding_slots.add((ob.court_id, sid))

    result_courts = []
    for court in courts:
        pricing_map = {r.shift_id: r for r in (court.pricing_rules or [])}
        shifts_info = []
        for s in SHIFTS_DEF:
            # Kiểm tra ca đã qua chưa (so sánh với giờ hiện tại VN)
            shift_end_dt = _shift_to_datetime(date, s["end"] if s["end"] != "23:59" else "23:59")
            is_past = date < now_vn.strftime("%Y-%m-%d") or (
                date == now_vn.strftime("%Y-%m-%d") and shift_end_dt.time() <= now_vn.time()
            )

            key = (court.id, s["id"])
            if key in blocked_slots:
                status = "blocked"
            elif key in booked_slots:
                status = "booked"
            elif is_past:
                status = "past"
            elif key in holding_slots:
                status = "holding"
            else:
                status = "available"

            rule = pricing_map.get(s["id"])
            price = rule.price_override if (rule and rule.price_override is not None) else court.price_per_hour

            shifts_info.append({
                "shift_id": s["id"],
                "start": s["start"],
                "end": s["end"],
                "status": status,
                "price": price,
                "tier": rule.tier if rule else "normal",
            })

        result_courts.append({
            "id": court.id,
            "name": court.name,
            "type": court.type,
            "price_per_hour": court.price_per_hour,
            "shifts": shifts_info,
        })

    return {"courts": result_courts, "date": date}


class OnlineBookingCreateRequest(BaseModel):
    court_id: int
    date: str
    shift_ids: List[int]
    guest_name: str
    guest_phone: str
    note: Optional[str] = ""


@app.post("/api/v1/online-bookings")
async def create_online_booking(req: OnlineBookingCreateRequest, db: AsyncSession = Depends(get_db)):
    import json, random, string
    from datetime import timezone

    if not req.shift_ids:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 ca")

    # 1. Lấy dữ liệu ngày mục tiêu
    target_date = datetime.strptime(req.date, "%Y-%m-%d").date()
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = start_of_day + timedelta(days=1)

    # 2. Tìm các ca đã bị chiếm (Taken shifts)
    now_utc = datetime.now(timezone.utc)
    taken_shifts: set = set()

    # A. Check OnlineBookings (chỉ lấy holding chưa hết hạn)
    online_res = await db.execute(
        select(OnlineBooking).where(
            OnlineBooking.date == req.date,
            OnlineBooking.court_id == req.court_id,
            OnlineBooking.status == "holding",
        )
    )
    for ob in online_res.scalars().all():
        is_ob_expired = ob.expires_at and ob.expires_at.replace(tzinfo=timezone.utc) < now_utc
        if not is_ob_expired:
            try:
                taken_shifts.update(json.loads(ob.shift_ids))
            except: pass

    # B. Check Bookings (thực tế) & CourtBlocks
    books_res = await db.execute(
        select(Booking).where(
            Booking.court_id == req.court_id,
            Booking.is_deleted == False,
            Booking.start_time >= start_of_day,
            Booking.start_time < end_of_day
        )
    )
    existing_books = books_res.scalars().all()

    blocks_res = await db.execute(
        select(CourtBlock).where(
            CourtBlock.court_id == req.court_id,
            CourtBlock.start_time >= start_of_day,
            CourtBlock.start_time < end_of_day
        )
    )
    existing_blocks = blocks_res.scalars().all()

    for s in SHIFTS_DEF:
        s_start = _shift_to_datetime(req.date, s["start"])
        s_end_str = s["end"] if s["end"] != "23:59" else "23:59"
        s_end = _shift_to_datetime(req.date, s_end_str)
        if s["end"] == "23:59":
            s_end = s_end.replace(hour=23, minute=59, second=59)

        # Check overlap với Booking
        for b in existing_books:
            if b.start_time < s_end and b.end_time > s_start:
                taken_shifts.add(s["id"])
                break
        
        # Check overlap với Block
        if s["id"] not in taken_shifts:
            for bl in existing_blocks:
                if bl.start_time < s_end and bl.end_time > s_start:
                    taken_shifts.add(s["id"])
                    break

    # 3. Kiểm tra conflict
    conflict = set(req.shift_ids) & taken_shifts
    if conflict:
        raise HTTPException(status_code=409, detail=f"Ca {sorted(conflict)} đã có người đặt")

    # Tính tiền
    court_res = await db.execute(select(Court).options(selectinload(Court.pricing_rules)).where(Court.id == req.court_id))
    court = court_res.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Sân không tồn tại")

    pricing_map = {r.shift_id: r for r in (court.pricing_rules or [])}
    total = 0.0
    for sid in req.shift_ids:
        s = next((x for x in SHIFTS_DEF if x["id"] == sid), None)
        if not s:
            continue
        rule = pricing_map.get(sid)
        price = rule.price_override if (rule and rule.price_override is not None) else court.price_per_hour
        start_t = datetime.strptime(s["start"], "%H:%M")
        end_t = datetime.strptime(s["end"] if s["end"] != "23:59" else "23:59", "%H:%M")
        hours = (end_t - start_t).seconds / 3600
        total += hours * price

    # Tạo mã chuyển khoản unique
    ref = "DAT" + "".join(random.choices(string.digits, k=6))

    now_utc_naive = datetime.utcnow()
    ob = OnlineBooking(
        court_id=req.court_id,
        date=req.date,
        shift_ids=json.dumps(req.shift_ids),
        guest_name=req.guest_name,
        guest_phone=req.guest_phone,
        note=req.note,
        total_amount=round(total),
        payment_ref=ref,
        status="holding",
        created_at=now_utc_naive,
        expires_at=now_utc_naive + timedelta(minutes=15),
    )
    db.add(ob)
    await db.commit()
    await db.refresh(ob)

    # Lấy bank active
    bank_res = await db.execute(select(BankSettings).where(BankSettings.is_active == True).limit(1))
    bank = bank_res.scalar_one_or_none()

    expires_at_utc = ob.expires_at.replace(tzinfo=timezone.utc)
    seconds_left = max(0, int((expires_at_utc - datetime.now(timezone.utc)).total_seconds()))

    return {
        "booking_id": ob.id,
        "payment_ref": ob.payment_ref,
        "total_amount": ob.total_amount,
        "expires_at": ob.expires_at.isoformat() + "Z" if ob.expires_at else None,
        "seconds_left": seconds_left,
        "is_expired": seconds_left <= 0,
        "status": ob.status,
        "bank": {
            "bank_code": bank.bank_code,
            "bank_name": bank.bank_name,
            "account_number": bank.account_number,
            "account_name": bank.account_name,
        } if bank else None,
    }


@app.get("/api/v1/online-bookings/{booking_id}")
async def get_online_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    import json
    res = await db.execute(
        select(OnlineBooking).options(selectinload(OnlineBooking.court)).where(OnlineBooking.id == booking_id)
    )
    ob = res.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Booking not found")

    bank_res = await db.execute(select(BankSettings).where(BankSettings.is_active == True).limit(1))
    bank = bank_res.scalar_one_or_none()

    try:
        shift_ids = json.loads(ob.shift_ids)
    except Exception:
        shift_ids = []

    expires_at_utc = ob.expires_at.replace(tzinfo=timezone.utc) if ob.expires_at else None
    seconds_left = max(0, int((expires_at_utc - datetime.now(timezone.utc)).total_seconds())) if expires_at_utc else 0

    return {
        "id": ob.id,
        "court_id": ob.court_id,
        "court_name": ob.court.name if ob.court else "",
        "date": ob.date,
        "shift_ids": shift_ids,
        "guest_name": ob.guest_name,
        "guest_phone": ob.guest_phone,
        "note": ob.note or "",
        "total_amount": ob.total_amount,
        "payment_ref": ob.payment_ref,
        "status": ob.status,
        "proof_url": ob.proof_url,
        "created_at": ob.created_at.isoformat() + "Z" if ob.created_at else None,
        "expires_at": ob.expires_at.isoformat() + "Z" if ob.expires_at else None,
        "seconds_left": seconds_left,
        "is_expired": (seconds_left <= 0 and ob.status == "holding"),
        "bank": {
            "bank_code": bank.bank_code,
            "bank_name": bank.bank_name,
            "account_number": bank.account_number,
            "account_name": bank.account_name,
        } if bank else None,
    }


@app.get("/api/v1/online-bookings/by-phone/{phone}")
async def get_online_bookings_by_phone(phone: str, db: AsyncSession = Depends(get_db)):
    import json
    res = await db.execute(
        select(OnlineBooking).options(selectinload(OnlineBooking.court))
        .where(OnlineBooking.guest_phone == phone)
        .order_by(OnlineBooking.created_at.desc())
        .limit(20)
    )
    bookings = res.scalars().all()
    result = []
    for ob in bookings:
        try:
            shift_ids = json.loads(ob.shift_ids)
        except Exception:
            shift_ids = []
            
        start_time_str = "00:00"
        end_time_str = "23:59"
        if shift_ids:
            shifts = [s for s in SHIFTS_DEF if s["id"] in shift_ids]
            if shifts:
                start_time_str = min(s["start"] for s in shifts)
                end_time_str = max(s["end"] for s in shifts)
                
        start_dt = _shift_to_datetime(ob.date, start_time_str)
        end_dt = _shift_to_datetime(ob.date, end_time_str if end_time_str != "23:59" else "23:59")
        if end_time_str == "23:59":
            end_dt = end_dt.replace(hour=23, minute=59, second=59)

        payment_status = "Unpaid"
        if ob.status == "confirmed":
            payment_status = "Fully_Paid"
            
        result.append({
            "id": ob.id,
            "court_name": ob.court.name if ob.court else "",
            "date": ob.date,
            "shift_ids": shift_ids,
            "start_time": start_dt.isoformat() + "Z",
            "end_time": end_dt.isoformat() + "Z",
            "total_amount": ob.total_amount,
            "payment_ref": ob.payment_ref,
            "payment_status": payment_status,
            "status": ob.status,
            "is_deleted": ob.status == "cancelled",
            "expires_at": ob.expires_at.isoformat() + "Z" if ob.expires_at else None,
            "proof_image_url": ob.proof_url,
            "created_at": ob.created_at.isoformat() + "Z" if ob.created_at else None,
        })
    return result


@app.post("/api/v1/online-bookings/{booking_id}/upload-proof")
async def upload_proof(booking_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OnlineBooking).where(OnlineBooking.id == booking_id))
    ob = res.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Booking not found")

    file_location = f"uploads/proof_{booking_id}_{file.filename}"
    with open(file_location, "wb+") as f:
        shutil.copyfileobj(file.file, f)
    proof_url = f"http://127.0.0.1:8000/uploads/proof_{booking_id}_{file.filename}"
    ob.proof_url = proof_url
    await db.commit()
    return {"ok": True, "proof_url": proof_url}


async def sync_online_booking_to_booking(db: AsyncSession, ob: OnlineBooking):
    import json, sys
    try:
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

            # Check if already exists to prevent duplicate syncs
            res = await db.execute(select(Booking).where(
                Booking.court_id == ob.court_id,
                Booking.start_time == start_time,
                Booking.is_deleted == False
            ))
            if res.scalar_one_or_none():
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
    except Exception as e:
        print(f"[SYNC ERROR] {e}", file=sys.stderr)
        raise e


@app.post("/api/v1/online-bookings/{booking_id}/manual-approve")
async def manual_approve_booking(booking_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OnlineBooking).where(OnlineBooking.id == booking_id))
    ob = res.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Booking not found")
    ob.status = "confirmed"
    await sync_online_booking_to_booking(db, ob)
    await db.commit()
    return {"ok": True, "status": "confirmed"}


# ===========================
# WEBHOOK ENDPOINTS
# ===========================
class WebhookCassoPayload(BaseModel):
    data: Optional[List[dict]] = None


@app.post("/api/v1/webhooks/casso")
async def webhook_casso(request: dict, db: AsyncSession = Depends(get_db)):
    """Nhận webhook từ Casso khi có chuyển khoản."""
    import json
    transactions = request.get("data", [])
    if not isinstance(transactions, list):
        transactions = [transactions]

    matched_count = 0
    for txn in transactions:
        desc = str(txn.get("description", "") or txn.get("memo", ""))
        amount = float(txn.get("amount", 0))

        # Tìm booking khớp mã
        online_res = await db.execute(
            select(OnlineBooking).where(
                OnlineBooking.status == "holding",
            )
        )
        obs = online_res.scalars().all()
        matched = False
        for ob in obs:
            if ob.payment_ref and ob.payment_ref.upper() in desc.upper():
                ob.status = "confirmed"
                matched = True
                matched_count += 1
                await sync_online_booking_to_booking(db, ob)
                break

        log = WebhookLog(
            source="casso",
            payment_ref=desc[:200],
            amount=amount,
            matched=matched,
            raw=json.dumps(txn, ensure_ascii=False)[:2000],
        )
        db.add(log)

    await db.commit()
    return {"ok": True, "matched": matched_count}


@app.post("/api/v1/webhooks/confirm-test")
async def webhook_confirm_test(
    payment_ref: str,
    amount: float,
    source: str = "test",
    db: AsyncSession = Depends(get_db)
):
    """Test endpoint: xác nhận booking theo mã chuyển khoản."""
    import json
    res = await db.execute(
        select(OnlineBooking).where(
            OnlineBooking.payment_ref == payment_ref,
            OnlineBooking.status == "holding",
        )
    )
    ob = res.scalar_one_or_none()
    matched = False
    if ob:
        ob.status = "confirmed"
        matched = True
        await sync_online_booking_to_booking(db, ob)

    log = WebhookLog(
        source=source,
        payment_ref=payment_ref,
        amount=amount,
        matched=matched,
        raw=json.dumps({"payment_ref": payment_ref, "amount": amount}),
    )
    db.add(log)
    await db.commit()
    return {"ok": True, "matched": matched}


@app.get("/api/v1/webhook-logs")
async def get_webhook_logs(db: AsyncSession = Depends(get_db)):
    """Lấy lịch sử webhook."""
    result = await db.execute(
        select(WebhookLog).order_by(WebhookLog.timestamp.desc()).limit(100)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "source": log.source,
            "payment_ref": log.payment_ref,
            "amount": log.amount,
            "matched": log.matched,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]


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


# ===========================
# USERS / CUSTOMERS MANAGEMENT
# ===========================
class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    wallet_balance: Optional[float] = None

class TopUpRequest(BaseModel):
    amount: float
    proof_url: Optional[str] = None
    note: Optional[str] = None

class UserCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    role: str = "User"

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    wallet_balance: float
    booking_count: int = 0
    class Config:
        from_attributes = True

@app.get("/api/v1/users")
async def get_users(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách tất cả user (có thể lọc theo role và search)"""
    from app.models import User as UserModel
    filters = []
    if role and role != "all":
        filters.append(UserModel.role == role)
    if search:
        filters.append(
            or_(
                UserModel.name.ilike(f"%{search}%"),
                UserModel.email.ilike(f"%{search}%"),
                UserModel.phone.ilike(f"%{search}%")
            )
        )
    
    query = select(UserModel)
    if filters:
        query = query.where(and_(*filters))
    query = query.order_by(UserModel.id.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Count bookings for each user
    user_list = []
    for u in users:
        booking_res = await db.execute(
            select(func.count(Booking.id)).where(
                Booking.user_id == u.id,
                Booking.is_deleted == False
            )
        )
        booking_count = booking_res.scalar() or 0
        user_list.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone or "",
            "role": u.role if isinstance(u.role, str) else u.role.value,
            "wallet_balance": u.wallet_balance or 0.0,
            "booking_count": booking_count,
            "google_id": u.google_id
        })
    
    return user_list

import hashlib

@app.post("/api/v1/users")
async def create_user(req: UserCreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        # Check if email exists
        res = await db.execute(select(UserModel).where(UserModel.email == req.email))
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
            
        new_user = UserModel(
            name=req.name,
            email=req.email,
            phone=req.phone,
            role=req.role,
            password_hash=pwd_context.hash(req.password),
            wallet_balance=0.0
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return {"ok": True, "user_id": new_user.id}
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/auth/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(UserModel).where(UserModel.email == req.email))
        user = res.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        if not user.password_hash or not pwd_context.verify(req.password, user.password_hash):
            # Fallback for old/legacy users who might have plain text
            if user.password_hash == req.password:
                # Migrate to hashed password
                user.password_hash = pwd_context.hash(req.password)
                await db.commit()
            else:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
        return {
            "ok": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role if isinstance(user.role, str) else user.role.value
            }
        }
    except Exception as e:
        print(f"Error during login: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    from app.models import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get bookings
    booking_res = await db.execute(
        select(Booking).options(selectinload(Booking.court)).where(
            Booking.user_id == user_id,
            Booking.is_deleted == False
        ).order_by(Booking.start_time.desc()).limit(20)
    )
    bookings = booking_res.scalars().all()
    
    # Get transactions
    from app.models import Transaction
    tx_res = await db.execute(
        select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.timestamp.desc()).limit(50)
    )
    transactions = tx_res.scalars().all()
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone or "",
        "role": user.role if isinstance(user.role, str) else user.role.value,
        "wallet_balance": user.wallet_balance or 0.0,
        "google_id": user.google_id,
        "bookings": [
            {
                "id": b.id,
                "court_name": b.court.name if b.court else "",
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "payment_status": b.payment_status if isinstance(b.payment_status, str) else b.payment_status.value,
                "note": b.note or ""
            }
            for b in bookings
        ],
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type if isinstance(t.type, str) else t.type.value,
                "status": t.status,
                "timestamp": t.timestamp.isoformat() + "Z"
            }
            for t in transactions
        ]
    }

@app.put("/api/v1/users/{user_id}")
async def update_user(user_id: int, req: UserUpdateRequest, db: AsyncSession = Depends(get_db)):
    from app.models import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if req.name is not None: user.name = req.name
    if req.email is not None: user.email = req.email
    if req.phone is not None: user.phone = req.phone
    if req.role is not None: user.role = req.role
    if req.wallet_balance is not None: user.wallet_balance = req.wallet_balance
    
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    from app.models import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"ok": True}

@app.post("/api/v1/users/{user_id}/topup")
async def topup_wallet(user_id: int, amount: float = Query(...), db: AsyncSession = Depends(get_db)):
    """Nạp tiền vào ví khách hàng"""
    from app.models import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    user.wallet_balance = (user.wallet_balance or 0) + amount
    
    # Create transaction record
    from app.models import Transaction, TransactionType
    new_tx = Transaction(
        user_id=user_id,
        amount=amount,
        type=TransactionType.TOP_UP,
        status="Completed"
    )
    db.add(new_tx)
    
    await db.commit()
    return {"ok": True, "new_balance": user.wallet_balance}

@app.post("/api/v1/users/{user_id}/topup-request")
async def topup_request(user_id: int, req: TopUpRequest, db: AsyncSession = Depends(get_db)):
    """Khách gửi yêu cầu nạp tiền kèm minh chứng"""
    from app.models import Transaction, TransactionType
    new_tx = Transaction(
        user_id=user_id,
        amount=req.amount,
        type=TransactionType.TOP_UP,
        status="Pending",
        proof_url=req.proof_url,
        note=req.note or "Yêu cầu nạp tiền từ người dùng"
    )
    db.add(new_tx)
    await db.commit()
    return {"ok": True, "tx_id": new_tx.id}

@app.get("/api/v1/admin/topup-requests")
async def get_pending_topups(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách yêu cầu nạp tiền chờ duyệt"""
    from app.models import Transaction, User as UserModel
    result = await db.execute(
        select(Transaction, UserModel.name, UserModel.email)
        .join(UserModel, Transaction.user_id == UserModel.id)
        .where(Transaction.status == "Pending")
        .order_by(Transaction.timestamp.desc())
    )
    rows = result.all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "user_name": name,
            "user_email": email,
            "amount": t.amount,
            "proof_url": t.proof_url,
            "note": t.note,
            "timestamp": t.timestamp.isoformat() + "Z"
        }
        for t, name, email in rows
    ]

@app.post("/api/v1/admin/topup-requests/{tx_id}/approve")
async def approve_topup(tx_id: int, db: AsyncSession = Depends(get_db)):
    """Duyệt nạp tiền"""
    from app.models import Transaction, User as UserModel
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.status != "Pending":
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    # Update user balance
    res_u = await db.execute(select(UserModel).where(UserModel.id == tx.user_id))
    user = res_u.scalar_one_or_none()
    if user:
        user.wallet_balance = (user.wallet_balance or 0) + tx.amount
        tx.status = "Completed"
        await db.commit()
        return {"ok": True, "new_balance": user.wallet_balance}
    
    raise HTTPException(status_code=404, detail="User not found")

@app.post("/api/v1/admin/topup-requests/{tx_id}/reject")
async def reject_topup(tx_id: int, db: AsyncSession = Depends(get_db)):
    """Từ chối nạp tiền"""
    from app.models import Transaction
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id))
    tx = result.scalar_one_or_none()
    if not tx or tx.status != "Pending":
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    tx.status = "Failed"
    await db.commit()
    return {"ok": True}

# ===========================
# MATCHMAKING & NOTIFICATIONS
# ===========================
@app.post("/api/v1/matches", response_model=MatchResponse)
async def create_match(req: MatchCreate, db: AsyncSession = Depends(get_db)):
    res_u = await db.execute(select(UserModel).where(UserModel.id == req.author_id))
    author = res_u.scalar_one_or_none()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    new_match = Match(
        author_id=req.author_id,
        sport=req.sport,
        level=req.level,
        time=req.time.replace(tzinfo=None),
        courts=req.courts,
        max_slots=req.max_slots,
        status=MatchStatus.OPEN
    )
    db.add(new_match)
    await db.commit()
    await db.refresh(new_match)

    # Add author as first participant
    participant = MatchParticipant(match_id=new_match.id, user_id=req.author_id)
    db.add(participant)
    await db.commit()

    return MatchResponse(
        id=new_match.id,
        author_id=author.id,
        author_name=author.name,
        sport=new_match.sport,
        level=new_match.level,
        time=new_match.time,
        courts=new_match.courts,
        max_slots=new_match.max_slots,
        current_slots=1,
        status=new_match.status.value,
        participants=[author.name]
    )

@app.get("/api/v1/matches", response_model=List[MatchResponse])
async def get_matches(db: AsyncSession = Depends(get_db)):
    now_vn = datetime.utcnow() + timedelta(hours=7)
    
    # Auto delete expired matches (tự động xóa khi hết giờ)
    from sqlalchemy import delete
    await db.execute(delete(Match).where(Match.time <= now_vn))
    await db.commit()

    # Lấy các trận đấu OPEN
    res = await db.execute(
        select(Match).options(
            selectinload(Match.author),
            selectinload(Match.participants).selectinload(MatchParticipant.user)
        ).where(
            Match.status == MatchStatus.OPEN
        ).order_by(Match.time.asc())
    )
    matches = res.scalars().all()
    
    result = []
    for m in matches:
        part_names = [p.user.name for p in m.participants if p.user]
        result.append(MatchResponse(
            id=m.id,
            author_id=m.author_id,
            author_name=m.author.name if m.author else "Unknown",
            sport=m.sport,
            level=m.level,
            time=m.time,
            courts=m.courts,
            max_slots=m.max_slots,
            current_slots=len(m.participants),
            status=m.status.value,
            participants=part_names
        ))
    return result

@app.post("/api/v1/matches/{match_id}/join")
async def join_match(match_id: int, req: MatchJoinRequest, db: AsyncSession = Depends(get_db)):
    # 1. Kiểm tra trận đấu
    res_m = await db.execute(select(Match).options(selectinload(Match.participants)).where(Match.id == match_id))
    match = res_m.scalar_one_or_none()
    if not match or match.status != MatchStatus.OPEN:
        raise HTTPException(status_code=400, detail="Match not available")
        
    if len(match.participants) >= match.max_slots:
        raise HTTPException(status_code=400, detail="Match is full")
        
    # 2. Kiểm tra người gửi yêu cầu
    res_u = await db.execute(select(UserModel).where(UserModel.id == req.requester_id))
    requester = res_u.scalar_one_or_none()
    if not requester:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Đã tham gia chưa?
    if any(p.user_id == req.requester_id for p in match.participants):
        raise HTTPException(status_code=400, detail="You already joined this match")
        
    # Đã gửi yêu cầu chưa?
    res_req = await db.execute(select(MatchRequest).where(
        MatchRequest.match_id == match_id,
        MatchRequest.requester_id == req.requester_id,
        MatchRequest.status == MatchRequestStatus.PENDING
    ))
    if res_req.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Request already sent")
        
    # Tạo request
    join_req = MatchRequest(match_id=match_id, requester_id=req.requester_id, status=MatchRequestStatus.PENDING)
    db.add(join_req)
    await db.commit()
    await db.refresh(join_req)
    
    # Tạo notification cho người tạo trận
    notif = Notification(
        user_id=match.author_id,
        title="Yêu cầu tham gia trận đấu",
        message=f"{requester.name} muốn tham gia trận {match.sport} của bạn vào lúc {match.time.strftime('%H:%M %d/%m/%Y')}",
        match_request_id=join_req.id
    )
    db.add(notif)
    await db.commit()
    
    return {"ok": True, "message": "Request sent"}

@app.post("/api/v1/match-requests/{request_id}/approve")
async def approve_match_request(request_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(MatchRequest).options(selectinload(MatchRequest.match)).where(MatchRequest.id == request_id))
    req = res.scalar_one_or_none()
    
    if not req or req.status != MatchRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invalid request")
        
    match = req.match
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Kiểm tra slot
    res_parts = await db.execute(select(MatchParticipant).where(MatchParticipant.match_id == match.id))
    parts = res_parts.scalars().all()
    if len(parts) >= match.max_slots:
        raise HTTPException(status_code=400, detail="Match is full")
        
    # Approve
    req.status = MatchRequestStatus.APPROVED
    
    # Add participant
    part = MatchParticipant(match_id=match.id, user_id=req.requester_id)
    db.add(part)
    
    # Tạo notification cho requester
    notif = Notification(
        user_id=req.requester_id,
        title="Yêu cầu được chấp nhận",
        message=f"Yêu cầu tham gia trận {match.sport} vào lúc {match.time.strftime('%H:%M %d/%m/%Y')} đã được chủ phòng chấp nhận!",
        match_request_id=req.id
    )
    db.add(notif)
    
    await db.commit()
    return {"ok": True}

@app.post("/api/v1/match-requests/{request_id}/reject")
async def reject_match_request(request_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(MatchRequest).options(selectinload(MatchRequest.match)).where(MatchRequest.id == request_id))
    req = res.scalar_one_or_none()
    
    if not req or req.status != MatchRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invalid request")
        
    match = req.match
    
    # Reject
    req.status = MatchRequestStatus.REJECTED
    
    # Tạo notification cho requester
    if match:
        notif = Notification(
            user_id=req.requester_id,
            title="Yêu cầu bị từ chối",
            message=f"Chủ phòng đã từ chối yêu cầu tham gia trận {match.sport} vào lúc {match.time.strftime('%H:%M %d/%m/%Y')} của bạn.",
            match_request_id=req.id
        )
        db.add(notif)
    
    await db.commit()
    return {"ok": True}

@app.get("/api/v1/notifications/{user_id}", response_model=List[NotificationResponse])
async def get_notifications(user_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return res.scalars().all()

@app.put("/api/v1/notifications/{notif_id}/read")
async def read_notification(notif_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"ok": True}

@app.post("/api/v1/matches/{match_id}/leave")
async def leave_match(match_id: int, req: MatchJoinRequest, db: AsyncSession = Depends(get_db)):
    res_m = await db.execute(select(Match).where(Match.id == match_id))
    match = res_m.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    now_vn = datetime.utcnow() + timedelta(hours=7)
    time_diff = match.time - now_vn
    if time_diff.total_seconds() < 3600 and time_diff.total_seconds() > 0:
        raise HTTPException(status_code=400, detail="Không thể rời phòng khi trận đấu sẽ bắt đầu trong vòng 1 tiếng tới.")
        
    if match.author_id == req.requester_id:
        raise HTTPException(status_code=400, detail="Chủ phòng không thể rời trận (bạn chỉ có thể hủy trận).")
        
    res_p = await db.execute(select(MatchParticipant).where(MatchParticipant.match_id == match_id, MatchParticipant.user_id == req.requester_id))
    part = res_p.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=400, detail="Bạn chưa tham gia trận này.")
        
    await db.delete(part)
    
    # Notify author
    res_u = await db.execute(select(UserModel).where(UserModel.id == req.requester_id))
    user = res_u.scalar_one_or_none()
    user_name = user.name if user else "Một người"
    
    notif = Notification(
        user_id=match.author_id,
        title="Người chơi rời phòng",
        message=f"{user_name} đã rời khỏi trận {match.sport} của bạn vào lúc {match.time.strftime('%H:%M %d/%m/%Y')}",
    )
    db.add(notif)
    
    await db.commit()
    return {"ok": True}

@app.delete("/api/v1/matches/{match_id}")
async def cancel_match(match_id: int, user_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    res_m = await db.execute(select(Match).options(selectinload(Match.participants)).where(Match.id == match_id))
    match = res_m.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if match.author_id != user_id:
        raise HTTPException(status_code=403, detail="Chỉ chủ phòng mới có thể hủy trận.")
        
    # Notify participants
    for p in match.participants:
        if p.user_id != user_id:
            notif = Notification(
                user_id=p.user_id,
                title="Trận đấu bị hủy",
                message=f"Chủ phòng đã hủy trận {match.sport} vào lúc {match.time.strftime('%H:%M %d/%m/%Y')}",
            )
            db.add(notif)
            
    await db.delete(match)
    await db.commit()
    return {"ok": True}

