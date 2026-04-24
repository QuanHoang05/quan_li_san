'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, ShoppingCart, User as UserIcon, QrCode, Wallet, Banknote, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, Product, BankSettings } from '@/lib/api';

const MOCK_CUSTOMER = {
  phone: '0901234567',
  name: 'Nguyễn Văn A',
  walletBalance: 50000,
  tier: 'Gold'
};

const VAT_RATE = 0.08; // 8%

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankSettings, setBankSettings] = useState<BankSettings | null>(null);

  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [customer, setCustomer] = useState<any>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR' | 'WALLET' | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    fetchProducts();
    api.bank.get().then(b => setBankSettings(b)).catch(() => { });
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.products.getAll();
      setProducts(data);
    } catch {
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }

  // Cart actions
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      return toast.error('Sản phẩm đã hết hàng trong kho!');
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error('Không đủ số lượng trong kho!');
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const decrementCart = (productId: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity - 1) }
      }
      return item;
    }));
  }

  const searchCustomer = () => {
    if (phoneSearch === MOCK_CUSTOMER.phone) {
      setCustomer(MOCK_CUSTOMER);
      toast.success(`Đã gán khách hàng: ${MOCK_CUSTOMER.name}`);
    } else {
      toast('Không tìm thấy khách hàng. Bán khách lẻ.', { icon: 'ℹ️' });
      setCustomer(null);
    }
  };

  // Calculations
  const subTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  const vatAmount = subTotal * VAT_RATE;
  const grandTotal = subTotal + vatAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return toast.error("Giỏ hàng rỗng!");
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'WALLET') {
      if (!customer) return toast.error("Vui lòng gán khách hàng để dùng ví!");
      if (customer.walletBalance < grandTotal) return toast.error("Số dư ví không đủ thanh toán!");
      if (!otpSent) {
        setOtpSent(true);
        return toast.success("Đã gửi OTP về Zalo khách hàng!");
      }
      if (otpCode !== '123456') return toast.error("Mã OTP không hợp lệ!");
    }

    try {
      const payload = {
        items: cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
        payment_method: paymentMethod || 'CASH',
        total_amount: grandTotal,
        customer_id: customer ? 1 : undefined
      };
      await api.orders.checkout(payload);
      toast.success(`Thanh toán ${grandTotal.toLocaleString()}đ thành công! KHO ĐÃ BỊ TRỪ.`);

      // Reset state
      setCart([]);
      setShowPaymentModal(false);
      setPaymentMethod(null);
      setOtpSent(false);
      setOtpCode('');

      // Refresh products
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Thanh toán có lỗi xảy ra');
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 antialiased">
      {/* LEFT: PRODUCTS LIST */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-20">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Quầy Hàng (POS)</h2>
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-xl overflow-hidden animate-pulse">
                <div className="h-32 bg-slate-200"></div>
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">Không có sản phẩm nào. Hãy Thêm sản phẩm bên quản lý Kho.</div>
          ) : products.map(p => (
            <div
              key={p.id}
              className={`group bg-white border rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${p.stock_quantity <= 0 ? 'opacity-50 border-red-200 cursor-not-allowed' : 'border-slate-200 hover:border-emerald-500'}`}
              onClick={() => addToCart(p)}
            >
              <div className="h-32 bg-slate-50 flex items-center justify-center overflow-hidden group-hover:bg-emerald-50 transition-colors">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  : <span className="text-4xl font-bold text-slate-300 group-hover:text-emerald-200 transition-colors">{p.name.charAt(0)}</span>
                }
              </div>
              <div className="p-3 text-center border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-700 truncate">{p.name}</h4>
                <div className="text-xs text-slate-500 my-1">Tồn kho: <span className={p.stock_quantity <= 0 ? 'text-red-500 font-bold' : ''}>{p.stock_quantity}</span></div>
                <div className="text-emerald-600 font-bold">{p.price.toLocaleString()} đ</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: CART PANEL */}
      <div className="w-[400px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Customer Target */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg p-1 pr-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <UserIcon size={18} className="text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="09xx..."
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchCustomer()}
              className="flex-1 bg-transparent border-none text-sm outline-none px-2 py-1.5"
            />
            <Button size="sm" variant="ghost" onClick={searchCustomer} className="px-3">Tìm</Button>
          </div>

          {customer ? (
            <div className="mt-3 flex justify-between items-center bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-sm">
              <div>
                <span className="font-semibold text-slate-800">{customer.name}</span>
                <span className="bg-emerald-200 text-emerald-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ml-2">{customer.tier}</span>
              </div>
              <div className="font-bold text-emerald-600">Ví: {customer.walletBalance.toLocaleString()}đ</div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-400 text-center uppercase tracking-wider font-semibold">Khách Lẻ (Walk-in)</div>
          )}
        </div>

        {/* Cart Listing */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="m-auto text-center flex flex-col items-center gap-3 text-slate-400">
              <ShoppingCart size={48} className="opacity-20" />
              <p>Chưa có sản phẩm nào</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex justify-between items-center py-2 border-b border-dashed border-slate-200 last:border-0">
                <div className="flex-1 pr-3">
                  <div className="text-sm font-semibold text-slate-800 line-clamp-1">{item.product.name}</div>
                  <div className="text-sm text-emerald-600 font-medium">{item.product.price.toLocaleString()} đ</div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-full border border-slate-200 p-0.5">
                  <button onClick={() => decrementCart(item.product.id)} className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:text-emerald-600 hover:border-emerald-500 transition-colors">-</button>
                  <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => addToCart(item.product)} className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:text-emerald-600 hover:border-emerald-500 transition-colors">+</button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="ml-3 text-slate-300 hover:text-red-500 transition-colors">
                  <ShieldAlert size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checkout Summary */}
        <div className="border-t border-slate-200 bg-slate-50 p-5 shrink-0">
          <div className="flex justify-between text-sm text-slate-500 mb-2">
            <span>Tạm tính</span>
            <span>{subTotal.toLocaleString()} đ</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500 mb-4 pb-4 border-b border-slate-200 border-dashed">
            <span>Thuế GTGT (VAT 8%)</span>
            <span>{vatAmount.toLocaleString()} đ</span>
          </div>
          <div className="flex justify-between items-end mb-5">
            <span className="text-slate-700 font-semibold uppercase tracking-wider text-sm">Thanh toán</span>
            <span className="text-2xl font-bold text-emerald-600 leading-none">{grandTotal.toLocaleString()} đ</span>
          </div>
          <Button size="lg" fullWidth onClick={handleCheckout} disabled={cart.length === 0} className="shadow-emerald-500/20 shadow-lg">
            Thanh Toán Đơn Hàng
          </Button>
        </div>
      </div>

      {/* PAYMENT MODAL LAYER */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 text-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Chọn phương thức thanh toán</h3>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div className="text-center">
                <div className="text-sm text-slate-500 uppercase tracking-widest font-semibold mb-1">CẦN THU</div>
                <div className="text-4xl font-extrabold text-emerald-500 drop-shadow-sm">{grandTotal.toLocaleString()} <span className="text-2xl">đ</span></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500 hover:border-emerald-200'}`}
                  onClick={() => setPaymentMethod('CASH')}
                >
                  <Banknote size={28} /> <span className="font-semibold text-sm">Tiền mặt</span>
                </button>
                <button
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'VIETQR' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500 hover:border-emerald-200'}`}
                  onClick={() => setPaymentMethod('VIETQR')}
                >
                  <QrCode size={28} /> <span className="font-semibold text-sm">VietQR</span>
                </button>
                <button
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all disabled:opacity-40 disabled:bg-slate-50 ${paymentMethod === 'WALLET' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500 hover:border-emerald-200'}`}
                  onClick={() => setPaymentMethod('WALLET')}
                  disabled={!customer}
                >
                  <Wallet size={28} /> <span className="font-semibold text-sm leading-tight text-center">Trừ Ví<br />Cá Nhân</span>
                </button>
              </div>

              {/* Sub-flows based on Payment Method */}
              <div className="min-h-[140px] flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
                {paymentMethod === 'CASH' && (
                  <div className="text-slate-500 text-center font-medium">✨ Thu đủ tiền mặt trước khi xác nhận đơn.</div>
                )}

                {paymentMethod === 'VIETQR' && (() => {
                  const orderRef = `POS-${Date.now().toString().slice(-6)}`;
                  const note = `${orderRef} ${cart.map(i => i.product.name).join(',')}`.slice(0, 50);
                  if (!bankSettings) {
                    return (
                      <div className="text-center text-amber-600 font-semibold p-4 bg-amber-50 rounded-lg text-sm">
                        ⚠️ Chưa cài tài khoản ngân hàng. Vào <strong>Thiết Lập Hệ Thống</strong> để cài đặt.
                      </div>
                    );
                  }
                  const safeBankCode = bankSettings.bank_code === 'MBB' ? 'MB' : (bankSettings.bank_code === 'VTB' ? 'ICB' : bankSettings.bank_code);
                  const qrUrl = `https://img.vietqr.io/image/${safeBankCode}-${bankSettings.account_number}-compact2.png?amount=${Math.round(grandTotal)}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(bankSettings.account_name)}`;
                  return (
                    <div className="flex flex-col items-center gap-2">
                      <img src={qrUrl} alt="VietQR" className="w-36 h-36 object-contain border border-slate-200 rounded-lg bg-white p-1" />
                      <div className="text-center text-xs text-slate-500 space-y-0.5">
                        <div className="font-bold text-slate-700">{bankSettings.bank_name} — {bankSettings.account_number}</div>
                        <div>{bankSettings.account_name}</div>
                        <div className="text-emerald-600 font-semibold">{grandTotal.toLocaleString()}đ</div>
                        <div className="text-slate-400">Ghi chú: {note}</div>
                      </div>
                    </div>
                  );
                })()}

                {paymentMethod === 'WALLET' && (
                  <div className="w-full">
                    {customer?.walletBalance < grandTotal ? (
                      <div className="text-center text-red-500 font-semibold p-4 bg-red-50 rounded-lg">Không đủ số dư ví. (Hiện có: {customer?.walletBalance.toLocaleString()}đ)</div>
                    ) : !otpSent ? (
                      <div className="text-center text-slate-500 text-sm">Cần gửi mã OTP về Zalo Khách hàng để xác nhận lệnh trừ ví. <br /><span className="font-semibold text-emerald-600 block mt-2">Ví hiện tại: {customer?.walletBalance.toLocaleString()}đ</span></div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Nhập OTP khách gửi</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value)}
                          className="w-full text-center tracking-[1em] font-bold text-2xl py-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {!paymentMethod && <div className="text-slate-400 text-sm">Vui lòng chọn 1 hình thức thu tiền</div>}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-xl">
              <Button variant="ghost" onClick={() => { setShowPaymentModal(false); setOtpSent(false); }}>Hủy bỏ</Button>
              <Button onClick={handleConfirmPayment} disabled={!paymentMethod || (paymentMethod === 'WALLET' && customer?.walletBalance < grandTotal && !otpSent)}>
                {paymentMethod === 'WALLET' && !otpSent ? 'Lấy mã OTP' : 'Xác nhận Thu Tiền'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
