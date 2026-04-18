import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey, Boolean, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# ==============================
# ENUMS
# ==============================
class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    STAFF = "Staff"
    USER = "User"

class CourtType(str, enum.Enum):
    BADMINTON = "Badminton"
    PICKLEBALL = "Pickleball"
    TENNIS = "Tennis"

class PaymentStatus(str, enum.Enum):
    UNPAID = "Unpaid"
    DEPOSIT = "Deposit"
    FULLY_PAID = "Fully_Paid"

class BookingStatus(str, enum.Enum):
    PENDING = "Pending"
    PAID = "Paid"
    CANCELLED = "Cancelled"

class PaymentType(str, enum.Enum):
    WALLET = "Wallet"
    VIETQR = "VietQR"
    CASH = "Cash"

class TransactionType(str, enum.Enum):
    TOP_UP = "Top-up"
    BOOKING = "Booking"
    PURCHASE = "Purchase"

class ShiftStatus(str, enum.Enum):
    SCHEDULED = "Scheduled"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class SwapRequestStatus(str, enum.Enum):
    WAITING_PARTNER = "Waiting_Partner"
    WAITING_ADMIN = "Waiting_Admin"
    APPROVED = "Approved"
    REJECTED = "Rejected"

class LogType(str, enum.Enum):
    IMPORT = "IMPORT"
    SALE = "SALE"
    DAMAGE = "DAMAGE"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"

class LogReason(str, enum.Enum):
    # Values MUST match the PostgreSQL native enum 'logreason'
    SALE = "SALE"
    EXPIRED = "EXPIRED"
    NATURAL_DAMAGE = "NATURAL_DAMAGE"
    CUSTOMER_DAMAGE = "CUSTOMER_DAMAGE"
    STOCK_IN = "STOCK_IN"

# Vietnamese display labels for each reason
LOG_REASON_LABELS = {
    "SALE": "Xuất bán",
    "EXPIRED": "Hết hạn",
    "NATURAL_DAMAGE": "Hư hỏng tự nhiên",
    "CUSTOMER_DAMAGE": "Khách làm hỏng",
    "STOCK_IN": "Nhập kho",
}

class LogStatus(str, enum.Enum):
    PENDING = "Pending"    # Chờ Admin duyệt (chỉ đối với Damage)
    APPROVED = "Approved"  # Đã duyệt / Tự động (Sale/Import)
    REJECTED = "Rejected"  # Admin từ chối

# ==============================
# MODELS
# ==============================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    role = Column(Enum(UserRole, native_enum=False, length=50), default=UserRole.USER, nullable=False)
    password_hash = Column(String(255), nullable=True)
    wallet_balance = Column(Float, default=0.0)
    google_id = Column(String(255), unique=True, index=True, nullable=True)

    # Relationships
    bookings = relationship("Booking", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    work_shifts = relationship("WorkShift", back_populates="staff")


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    type = Column(String, nullable=False)
    price_per_hour = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    deposit_price = Column(Float, default=0)

    bookings = relationship("Booking", back_populates="court")
    blocks = relationship("CourtBlock", back_populates="court", cascade="all, delete")
    pricing_rules = relationship("CourtPricingRule", back_populates="court", cascade="all, delete")


class CourtBlock(Base):
    __tablename__ = "court_blocks"

    id = Column(Integer, primary_key=True, index=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    reason = Column(String(255), nullable=True)
    
    court = relationship("Court", back_populates="blocks")


class CourtPricingRule(Base):
    """Giá override cho từng ca (shift) của sân. Nếu không có rule -> dùng price_per_hour mặc định."""
    __tablename__ = "court_pricing_rules"

    id = Column(Integer, primary_key=True, index=True)
    court_id = Column(Integer, ForeignKey("courts.id", ondelete="CASCADE"), nullable=False)
    shift_id = Column(Integer, nullable=False)  # 1-12 tương ứng SHIFTS list
    tier = Column(String(20), default="normal")  # 'low' | 'normal' | 'peak'
    price_override = Column(Float, nullable=True)  # None = dùng giá mặc định

    court = relationship("Court", back_populates="pricing_rules")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_name = Column(String(100), nullable=True)
    guest_phone = Column(String(20), nullable=True)
    court_id = Column(Integer, ForeignKey("courts.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(BookingStatus, native_enum=False, length=50), default=BookingStatus.PENDING)
    payment_type = Column(Enum(PaymentType, native_enum=False, length=50), nullable=True)
    payment_status = Column(Enum(PaymentStatus, native_enum=False, length=50), default=PaymentStatus.UNPAID)
    note = Column(String(500), nullable=True)
    is_deleted = Column(Boolean, default=False)

    user = relationship("User", back_populates="bookings")
    court = relationship("Court", back_populates="bookings")
    logs = relationship("BookingLog", back_populates="booking", cascade="all, delete")


class BookingLog(Base):
    __tablename__ = "booking_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False) # Create, Update, Reassign, Delete
    details = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    booking = relationship("Booking", back_populates="logs")
    user = relationship("User")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0)
    image_url = Column(String(255), nullable=True)
    unit = Column(String(30), default="cái")          # đơn vị tính
    min_stock = Column(Integer, default=5)             # ngưỡng cảnh báo tồn kho thấp
    supplier_name = Column(String(150), nullable=True) # tên nhà cung cấp

    logs = relationship("InventoryLog", back_populates="product", cascade="all, delete")


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    change_amount = Column(Integer, nullable=False)
    # type: VARCHAR - new column added via migration, not a PG native enum
    type = Column(String(50), nullable=True, default="ADJUSTMENT")
    # reason: PostgreSQL native enum - use native_enum=True
    reason = Column(Enum(LogReason, native_enum=True), nullable=False)
    compensation_amount = Column(Float, default=0.0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    # status: VARCHAR in DB, not a PG native enum
    status = Column(String(50), default=LogStatus.APPROVED.value)
    note = Column(Text, nullable=True)                              # ghi chú (nhà cung cấp, ...)
    image_url = Column(String(255), nullable=True)                  # ảnh hóa đơn / bằng chứng
    user_name = Column(String(100), nullable=True)                  # tên nhân viên thao tác

    product = relationship("Product", back_populates="logs")
    user = relationship("User")


class BankSettings(Base):
    """Lưu thông tin tài khoản ngân hàng nhận tiền (cho QR VietQR)."""
    __tablename__ = "bank_settings"

    id = Column(Integer, primary_key=True, index=True)
    bank_code = Column(String(50), nullable=False)       # Mã NH ví dụ: "vietcombank"
    bank_name = Column(String(100), nullable=False)      # Tên hiển thị: "Vietcombank"
    account_number = Column(String(50), nullable=False)  # Số tài khoản
    account_name = Column(String(100), nullable=False)   # Tên chủ TK
    is_active = Column(Boolean, default=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType, native_enum=False, length=50), nullable=False)
    status = Column(String(50), default="Completed") # Completed/Failed
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")


class WorkShift(Base):
    __tablename__ = "work_shifts"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(ShiftStatus, native_enum=False, length=50), default=ShiftStatus.SCHEDULED)

    staff = relationship("User", back_populates="work_shifts")
    swap_requests = relationship("ShiftSwapRequest", back_populates="shift", foreign_keys="ShiftSwapRequest.shift_id")


class ShiftSwapRequest(Base):
    __tablename__ = "shift_swap_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("work_shifts.id"), nullable=False)
    status = Column(Enum(SwapRequestStatus, native_enum=False, length=50), default=SwapRequestStatus.WAITING_PARTNER)

    # Note: Explicit declaration of relationships if needed
    requester = relationship("User", foreign_keys=[requester_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    shift = relationship("WorkShift", back_populates="swap_requests", foreign_keys=[shift_id])
