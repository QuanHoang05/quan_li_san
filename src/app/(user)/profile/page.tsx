'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, QrCode, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  
  const mockWalletBalance = 50000;

  const handleLogout = () => {
    document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Cá Nhân & Ví</h2>
          <Button variant="outline" size="sm" onClick={handleLogout}>Đăng xuất</Button>
      </div>

      <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white' }}>
         <div style={{ fontSize: '1rem', opacity: 0.9 }}>Số dư Ví Thành Viên</div>
         <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{mockWalletBalance.toLocaleString()} đ</div>
         <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
             <Button style={{ backgroundColor: 'white', color: 'var(--primary)' }} onClick={() => setShowTopUp(true)}>
                 <Wallet size={16} style={{ marginRight: '8px' }} /> Nạp tiền
             </Button>
             <Button variant="outline" style={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>
                 <TrendingUp size={16} style={{ marginRight: '8px' }} /> Lịch sử ví
             </Button>
         </div>
      </Card>

      <div>
          <h3 style={{ marginBottom: '1rem' }}>Đơn hàng gần đây</h3>
          <Card style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                  <div style={{ fontWeight: 'bold' }}>Thuê sân cầu lông - Sân 2</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Hôm nay, 19:30 - 21:00</div>
              </div>
              <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Đã xác nhận</div>
          </Card>
      </div>

      {showTopUp && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <Card style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
                  <h3 style={{ textAlign: 'center' }}>Nạp tiền vào Ví</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[100000, 200000, 500000, 1000000].map(amount => (
                          <button 
                            key={amount}
                            onClick={() => setTopUpAmount(amount)}
                            style={{ 
                                padding: '1rem', 
                                border: `1px solid ${topUpAmount === amount ? 'var(--primary)' : 'var(--border)'}`, 
                                backgroundColor: topUpAmount === amount ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--surface)', 
                                borderRadius: 'var(--radius)',
                                fontWeight: topUpAmount === amount ? 'bold' : 'normal',
                                color: topUpAmount === amount ? 'var(--primary)' : 'var(--foreground)'
                            }}
                          >
                              {amount.toLocaleString()} đ
                          </button>
                      ))}
                  </div>

                  {topUpAmount && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)' }}>
                          <p>Quét mã VietQR để nạp <strong>{topUpAmount.toLocaleString()}đ</strong></p>
                          <div style={{ width: '200px', height: '200px', backgroundColor: 'white', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <QrCode size={48} color="var(--primary)" />
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Số dư sẽ tự cập nhật sau khi chuyển khoản thành công từ 1-3 phút qua hệ thống Webhook.</p>
                      </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <Button variant="outline" onClick={() => {setShowTopUp(false); setTopUpAmount(null)}}>Đóng</Button>
                      <Button disabled={!topUpAmount} onClick={() => alert('Nạp thành công! (Mô phỏng Webhook)')}>Hoàn tất</Button>
                  </div>
              </Card>
          </div>
      )}

    </div>
  );
}
