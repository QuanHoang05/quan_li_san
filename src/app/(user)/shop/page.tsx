'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, QrCode, Banknote } from 'lucide-react';
import styles from '../user.module.css';

const PRODUCTS = [
  { id: 1, name: 'Nước Suối Aquafina', price: 10000, category: 'Đồ Uống' },
  { id: 2, name: 'Thuê Vợt Pickleball', price: 50000, category: 'Dịch vụ' },
  { id: 5, name: 'Bóng Pickleball x3', price: 120000, category: 'Dụng cụ' },
];

export default function ShopPage() {
  const [cart, setCart] = useState<{product: any, quantity: number}[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR' | 'WALLET' | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  
  // Wallet simulator directly from the Client for UX demo
  const mockWalletBalance = 50000; 

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handlePayment = () => {
    if (paymentMethod === 'WALLET') {
        if (mockWalletBalance < total) return alert('Số dư ví không đủ!');
        if (!otpSent) {
            setOtpSent(true);
            return alert('Mã OTP đã gửi về Zalo của bạn!');
        }
    }
    alert(`Thanh toán ${total.toLocaleString()} đ qua phương thức ${paymentMethod} thành công! Đơn hàng đang chờ xử lý.`);
    setCart([]);
    setShowCheckout(false);
    setPaymentMethod(null);
    setOtpSent(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2>Cửa hàng trực tuyến</h2>
        <p style={{ color: 'var(--text-muted)' }}>Mua nước uống, thuê đồ bơi, vợt thể thao nhanh chóng.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {PRODUCTS.map(p => (
          <Card key={p.id}>
             <div style={{ height: '140px', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>{p.name.charAt(0)}</span>
             </div>
             <div style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category}</div>
                <h3 style={{ fontSize: '1rem', margin: '0.25rem 0' }}>{p.name}</h3>
                <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '1rem' }}>{p.price.toLocaleString()} đ</div>
                <Button fullWidth onClick={() => addToCart(p)}>Thêm vào Giỏ</Button>
             </div>
          </Card>
        ))}
      </div>

      {cart.length > 0 && (
         <div style={{ position: 'fixed', bottom: '80px', left: '1rem', right: '1rem', maxWidth: '600px', margin: '0 auto', zIndex: 50 }}>
            <Card style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary)', color: 'white' }}>
                <div>
                   <div style={{ fontWeight: 'bold' }}>{cart.length} sản phẩm</div>
                   <div>Tổng: {total.toLocaleString()} đ</div>
                </div>
                <Button variant="secondary" onClick={() => setShowCheckout(true)}>Tiến hành Thanh toán</Button>
            </Card>
         </div>
      )}

      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <Card style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ textAlign: 'center' }}>Thanh toán Shop</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>{total.toLocaleString()} đ</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    <button 
                        onClick={() => setPaymentMethod('CASH')}
                        style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${paymentMethod === 'CASH' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', backgroundColor: paymentMethod === 'CASH' ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--background)' }}
                    >
                        <Banknote /> Nhận hàng & Trả tiền quầy
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('VIETQR')}
                        style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${paymentMethod === 'VIETQR' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', backgroundColor: paymentMethod === 'VIETQR' ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--background)' }}
                    >
                        <QrCode /> Chuyển khoản VietQR
                    </button>
                    <button 
                        onClick={() => setPaymentMethod('WALLET')}
                        style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${paymentMethod === 'WALLET' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', backgroundColor: paymentMethod === 'WALLET' ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--background)' }}
                    >
                        <Wallet /> Trừ Ví Thành Viên (Số dư: {mockWalletBalance.toLocaleString()})
                    </button>
                </div>

                {paymentMethod === 'WALLET' && !otpSent && mockWalletBalance >= total && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>Hệ thống sẽ gửi mã OTP về Zalo để xác nhận thanh toán.</div>
                )}
                {paymentMethod === 'WALLET' && otpSent && mockWalletBalance >= total && (
                    <div>
                        <input type="text" placeholder="Nhập OTP (123456)" style={{ width: '100%', padding: '0.75rem', textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                    </div>
                )}
                {paymentMethod === 'WALLET' && mockWalletBalance < total && (
                    <div style={{ color: 'var(--secondary)', fontSize: '0.875rem', textAlign: 'center', fontWeight: 'bold' }}>Số dư ví của bạn không đủ! Xin hãy nạp thêm.</div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button variant="outline" onClick={() => {setShowCheckout(false); setOtpSent(false);}}>Đóng</Button>
                    <Button onClick={handlePayment} disabled={!paymentMethod || (paymentMethod === 'WALLET' && mockWalletBalance < total && !otpSent)}>
                        {paymentMethod === 'WALLET' && !otpSent ? 'Lấy mã OTP' : 'Xác nhận Đặt Hàng'}
                    </Button>
                </div>
            </Card>
        </div>
      )}
    </div>
  );
}
