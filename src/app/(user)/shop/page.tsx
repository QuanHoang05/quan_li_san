'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, QrCode, Banknote, ShoppingCart, Plus, Minus, Trash2, X, Lock } from 'lucide-react';
import { api, Product } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function ShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartSidebar, setShowCartSidebar] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR' | 'WALLET' | null>(null);
  
  // Wallet State
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletPin, setWalletPin] = useState<string | null>(null);
  const [showPinAuth, setShowPinAuth] = useState(false);
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    fetchProducts();
    
    // Load wallet state
    const storedBalance = localStorage.getItem('wallet_balance');
    if (storedBalance) setWalletBalance(parseInt(storedBalance));
    else {
        localStorage.setItem('wallet_balance', '500000');
        setWalletBalance(500000);
    }

    const storedPin = localStorage.getItem('wallet_pin');
    if (storedPin) setWalletPin(storedPin);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.products.getAll();
      setProducts(data);
    } catch (err) {
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`Đã thêm ${product.name} vào giỏ`);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePayment = async () => {
    if (paymentMethod === 'WALLET') {
        if (walletBalance < total) return toast.error('Số dư ví không đủ!');
        if (!walletPin) {
            toast.error('Vui lòng vào trang Cá nhân để thiết lập mã PIN bảo mật trước khi dùng ví!');
            return;
        }
        if (!showPinAuth) {
            setShowPinAuth(true);
            return;
        }
        if (pinInput !== walletPin) {
            return toast.error('Mã PIN không chính xác!');
        }
    }
    
    try {
        await api.orders.checkout({
            items: cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
            payment_method: paymentMethod || 'CASH',
            total_amount: total
        });

        // Deduct from wallet if WALLET was used
        if (paymentMethod === 'WALLET') {
            const newBalance = walletBalance - total;
            setWalletBalance(newBalance);
            localStorage.setItem('wallet_balance', newBalance.toString());

            const historyStr = localStorage.getItem('wallet_history');
            const history = historyStr ? JSON.parse(historyStr) : [];
            const newHistoryItem = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: 'payment',
                amount: total,
                note: `Thanh toán ${totalItems} sản phẩm tại Cửa hàng`
            };
            localStorage.setItem('wallet_history', JSON.stringify([newHistoryItem, ...history]));
        }

        toast.success(`Thanh toán ${total.toLocaleString()} đ thành công! Đơn hàng đã được lưu.`);
        setCart([]);
        setShowCheckout(false);
        setShowCartSidebar(false);
        setPaymentMethod(null);
        setShowPinAuth(false);
        setPinInput('');
    } catch (err: any) {
        toast.error(err.message || "Lỗi khi thanh toán!");
    }
  };

  return (
    <div className="flex flex-col gap-6 relative min-h-full pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Cửa Hàng</h2>
            <p className="text-slate-500 mt-1">Mua nước uống, đồ ăn nhẹ, thuê dụng cụ ngay tại sân.</p>
        </div>
        <button 
            onClick={() => setShowCartSidebar(true)}
            className="relative p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
        >
            <ShoppingCart size={24} />
            {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md">
                    {totalItems}
                </span>
            )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-emerald-600">Đang tải sản phẩm...</div>
      ) : products.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
          Chưa có sản phẩm nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(p => (
            <Card key={p.id} className="flex flex-col hover:shadow-lg transition-all duration-300 border-slate-200 overflow-hidden group">
               <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {p.image_url ? (
                     <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                     <span className="text-5xl text-slate-300 font-bold group-hover:scale-110 transition-transform duration-500">{p.name.charAt(0)}</span>
                  )}
                  <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur text-xs font-bold text-slate-600 rounded-md shadow-sm">
                      {p.category}
                  </div>
               </div>
               <div className="p-5 flex flex-col flex-1 bg-white">
                  <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{p.name}</h3>
                  <div className="text-sm text-slate-500 mt-1">Còn lại: {p.stock_quantity} {p.unit}</div>
                  <div className="mt-auto pt-4 flex items-center justify-between">
                      <div className="text-emerald-600 font-black text-xl">{p.price.toLocaleString()} đ</div>
                      <Button size="sm" onClick={() => addToCart(p)} className="rounded-xl shadow-md shadow-emerald-500/20" disabled={p.stock_quantity <= 0}>
                        <Plus size={18} />
                      </Button>
                  </div>
               </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cart Sidebar (Drawer) */}
      {showCartSidebar && (
          <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCartSidebar(false)}></div>
              <div className="w-full max-w-md bg-white h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="text-emerald-500"/> Giỏ hàng của bạn</h3>
                      <button onClick={() => setShowCartSidebar(false)} className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-2 rounded-full shadow-sm">
                          <X size={20} />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                      {cart.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                              <ShoppingCart size={64} className="opacity-20" />
                              <p>Giỏ hàng đang trống</p>
                          </div>
                      ) : (
                          cart.map(item => (
                              <div key={item.product.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                                      {item.product.image_url ? (
                                        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover rounded-xl" />
                                      ) : (
                                        <span className="text-xl text-slate-400 font-bold">{item.product.name.charAt(0)}</span>
                                      )}
                                  </div>
                                  <div className="flex-1 flex flex-col justify-between">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-slate-800 line-clamp-1">{item.product.name}</h4>
                                          <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                              <Trash2 size={18} />
                                          </button>
                                      </div>
                                      <div className="flex justify-between items-center mt-2">
                                          <span className="font-semibold text-emerald-600">{(item.product.price * item.quantity).toLocaleString()} đ</span>
                                          <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                              <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-600"><Minus size={14}/></button>
                                              <span className="font-bold text-slate-800 min-w-[20px] text-center text-sm">{item.quantity}</span>
                                              <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-600"><Plus size={14}/></button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>

                  {cart.length > 0 && (
                      <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                          <div className="flex justify-between items-center mb-6">
                              <span className="text-slate-500 font-medium">Tổng tiền ({totalItems} món)</span>
                              <span className="text-2xl font-black text-emerald-600">{total.toLocaleString()} đ</span>
                          </div>
                          <Button fullWidth onClick={() => { setShowCheckout(true); setShowCartSidebar(false); setShowPinAuth(false); setPinInput(''); }} className="py-4 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20">
                              Tiến hành thanh toán
                          </Button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-6 bg-emerald-600 text-white text-center relative">
                    <h3 className="text-xl font-bold">Thanh Toán Đơn Hàng</h3>
                    <button onClick={() => setShowCheckout(false)} className="absolute top-6 right-6 text-emerald-200 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-8 flex flex-col gap-6">
                    <div className="text-center">
                        <p className="text-slate-500 text-sm mb-2">Số tiền cần thanh toán</p>
                        <div className="text-4xl font-black text-emerald-600">{total.toLocaleString()} <span className="text-2xl">đ</span></div>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                        <p className="font-semibold text-slate-700 mb-4">Chọn phương thức thanh toán:</p>
                        
                        <button 
                            onClick={() => { setPaymentMethod('CASH'); setShowPinAuth(false); setPinInput(''); }}
                            className={`w-full p-4 flex items-center gap-4 rounded-xl border-2 transition-all ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                        >
                            <div className={`p-2 rounded-lg ${paymentMethod === 'CASH' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Banknote size={20} /></div>
                            <span className="font-semibold text-slate-800">Tiền mặt tại quầy</span>
                        </button>
                        
                        <button 
                            onClick={() => { setPaymentMethod('VIETQR'); setShowPinAuth(false); setPinInput(''); }}
                            className={`w-full p-4 flex items-center gap-4 rounded-xl border-2 transition-all ${paymentMethod === 'VIETQR' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                        >
                            <div className={`p-2 rounded-lg ${paymentMethod === 'VIETQR' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}><QrCode size={20} /></div>
                            <span className="font-semibold text-slate-800">Chuyển khoản VietQR</span>
                        </button>
                        
                        <button 
                            onClick={() => { setPaymentMethod('WALLET'); setShowPinAuth(false); setPinInput(''); }}
                            className={`w-full p-4 flex items-center gap-4 rounded-xl border-2 transition-all ${paymentMethod === 'WALLET' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
                        >
                            <div className={`p-2 rounded-lg ${paymentMethod === 'WALLET' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Wallet size={20} /></div>
                            <div className="flex flex-col items-start">
                                <span className="font-semibold text-slate-800">Ví Hội Viên QuanLiSan</span>
                                <span className="text-xs text-slate-500">Số dư: {walletBalance.toLocaleString()} đ</span>
                            </div>
                        </button>
                    </div>

                    {paymentMethod === 'WALLET' && walletBalance < total && (
                        <div className="p-3 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl text-center border border-rose-200">
                            Số dư ví không đủ! Vui lòng nạp thêm hoặc chọn phương thức khác.
                        </div>
                    )}
                    
                    {paymentMethod === 'WALLET' && !walletPin && walletBalance >= total && (
                        <div className="p-3 bg-amber-50 text-amber-700 text-sm font-semibold rounded-xl text-center border border-amber-200">
                            Bạn chưa thiết lập mã PIN bảo mật. <a href="/profile" className="underline font-bold">Tạo ngay</a>.
                        </div>
                    )}

                    {paymentMethod === 'WALLET' && showPinAuth && walletBalance >= total && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                            <span className="text-sm font-bold text-emerald-700 flex items-center gap-2"><Lock size={16}/> Nhập mã PIN để thanh toán</span>
                            <input 
                                type="password" 
                                placeholder="••••••" 
                                className="w-full max-w-[200px] p-4 text-center tracking-[1em] text-xl font-bold border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 bg-white" 
                                maxLength={6}
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <Button variant="outline" fullWidth onClick={() => {setShowCheckout(false); setShowPinAuth(false); setPinInput('');}} className="py-4 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none">Hủy</Button>
                        <Button 
                            fullWidth 
                            onClick={handlePayment} 
                            disabled={!paymentMethod || (paymentMethod === 'WALLET' && walletBalance < total) || (paymentMethod === 'WALLET' && showPinAuth && pinInput.length !== 6) || (paymentMethod === 'WALLET' && !walletPin)}
                            className="py-4 font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30"
                        >
                            {paymentMethod === 'WALLET' && !showPinAuth ? 'Xác thực PIN' : 'Thanh Toán Ngay'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
