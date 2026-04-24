# Nhật Ký Phát Triển: Module Thanh toán & Đặt sân thông minh

## Theo dõi tiến độ

- [x] **[Feature] Cấu hình ngân hàng & Set-off**
  - Tạo bảng `BankSettings` trong Database.
  - Xây dựng giao diện cho phép Admin cấu hình (danh sách ngân hàng lấy từ Napas/VietQR).
  - Có thể kích hoạt (Enable) tài khoản nhận tiền mặc định hiện tại.

- [x] **[Logic] Sinh QR động & Countdown 15p**
  - Tích hợp chuẩn VietQR vào quy trình Bán hàng tại quầy (POS) và luồng Đặt Sân Online.
  - Tự động sinh `payment_ref` theo chuẩn `SAN...` và `POS...`
  - Thêm đồng hồ đếm ngược 15 phút tại màn hình chờ thanh toán.
  - Tự động khóa sân/hủy trạng thái "holding" khi hết 15 phút.

- [x] **[Logic] Webhook xử lý thanh toán tự động**
  - Tích hợp endpoint API `/api/v1/webhooks/casso` để lắng nghe biến động.
  - Bắt chuẩn xác mã regex đơn hàng (cả `SAN` và `POS`).
  - Gạch nợ tự động (thay đổi trạng thái `payment_status` thành `Fully_Paid`).
  - Cập nhật màu sân (UI) cho khách báo hoàn thành ngay lập tức.

- [x] **[UI] Form Upload & Duyệt minh chứng (Manual check)**
  - Thêm nút upload ảnh hóa đơn tại màn chờ thanh toán (người dùng).
  - Tích hợp Modal xem ảnh cho Nhân viên / Chủ sân tại trang Quản lý Lịch Đặt Sân.
  - Thêm nút duyệt thủ công bằng tay trường hợp ngân hàng delay hoặc rớt mạng.

## Yêu cầu bổ sung đã hoàn thành
- [x] Nâng cấp giao diện trang chủ (`src/app/page.tsx`) theo phong cách Sporty UI với ảnh nền từ Unsplash (`https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80`).
- [x] Cập nhật điều hướng trang chủ đến thẳng các trang quản lý cho Nhân viên và Cửa hàng.
- [x] Bảo toàn tuyệt đối database cũ bằng cơ chế `IF NOT EXISTS` và SQLAlchemy migration động.
