'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const router = useRouter();

  const loginAs = (role: string, path: string) => {
    // Set a simple cookie to simulate login
    document.cookie = `role=${role}; path=/`;
    router.push(path);
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen gap-10 p-8 overflow-hidden"
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')" }}
      />
      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-slate-900/60 backdrop-blur-[2px]" />

      <div className="relative z-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h1 className="text-6xl font-black text-white tracking-tight drop-shadow-md">
          Quan<span className="text-emerald-400">Li</span>San
        </h1>
        <p className="text-xl text-slate-200 mt-4 font-semibold max-w-xl mx-auto drop-shadow">
          Hệ thống Quản lý Sân Thể thao & Kết nối Người chơi hiện đại nhất
        </p>
      </div>
      
      <div className="relative z-10 flex flex-wrap gap-8 justify-center max-w-5xl mt-6">
        
        {/* ADMIN OPTION */}
        <Card className="flex flex-col w-80 bg-white/95 backdrop-blur shadow-2xl border-0 overflow-hidden hover:-translate-y-2 transition-transform duration-300">
          <div className="p-6 text-center border-b border-slate-100 bg-white">
            <h2 className="text-2xl font-bold text-slate-800">Chủ Sân</h2>
            <p className="text-sm font-semibold text-emerald-600 mt-1 uppercase tracking-wider">Toàn quyền hệ thống</p>
          </div>
          <div className="p-6 flex flex-col flex-1">
            <ul className="text-sm text-slate-600 space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2">✅ <span className="font-medium">Quản lý doanh thu, báo cáo</span></li>
              <li className="flex items-center gap-2">✅ <span className="font-medium">Cấu hình giá sân, kho hàng</span></li>
              <li className="flex items-center gap-2">✅ <span className="font-medium">Cài đặt Webhook thanh toán</span></li>
            </ul>
            <Button fullWidth onClick={() => loginAs('ADMIN', '/dashboard')} className="py-6 text-base font-bold shadow-lg shadow-emerald-500/30">
              Vào quyền Chủ Sân
            </Button>
          </div>
        </Card>

        {/* STAFF OPTION */}
        <Card className="flex flex-col w-80 bg-white/95 backdrop-blur shadow-2xl border-0 overflow-hidden hover:-translate-y-2 transition-transform duration-300">
          <div className="p-6 text-center border-b border-slate-100 bg-white">
            <h2 className="text-2xl font-bold text-slate-800">Nhân Viên</h2>
            <p className="text-sm font-semibold text-amber-500 mt-1 uppercase tracking-wider">Vận hành tại quầy</p>
          </div>
          <div className="p-6 flex flex-col flex-1">
            <ul className="text-sm text-slate-600 space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2">⚡ <span className="font-medium">Xem lịch đặt sân, xếp lịch</span></li>
              <li className="flex items-center gap-2">⚡ <span className="font-medium">Bán hàng tại quầy (POS)</span></li>
              <li className="flex items-center gap-2">⚡ <span className="font-medium">Duyệt minh chứng thanh toán</span></li>
            </ul>
            <Button fullWidth variant="secondary" onClick={() => loginAs('STAFF', '/bookings')} className="py-6 text-base font-bold text-slate-800 shadow-lg">
              Vào quyền Nhân Viên
            </Button>
          </div>
        </Card>

        {/* CUSTOMER OPTION */}
        <Card className="flex flex-col w-80 bg-white/95 backdrop-blur shadow-2xl border-0 overflow-hidden hover:-translate-y-2 transition-transform duration-300">
          <div className="p-6 text-center border-b border-slate-100 bg-emerald-600 text-white">
            <h2 className="text-2xl font-bold">Khách Hàng</h2>
            <p className="text-sm font-semibold text-emerald-100 mt-1 uppercase tracking-wider">Khám phá & Đặt sân</p>
          </div>
          <div className="p-6 flex flex-col flex-1 bg-white">
             <ul className="text-sm text-slate-700 space-y-3 mb-8 flex-1">
              <li className="flex items-center gap-2">🏆 <span className="font-medium">Tìm sân trống thời gian thực</span></li>
              <li className="flex items-center gap-2">💳 <span className="font-medium">QRPay Thanh toán tự động</span></li>
              <li className="flex items-center gap-2">🤝 <span className="font-medium">Ghép kèo, thi đấu (Sắp ra mắt)</span></li>
            </ul>
            <Button fullWidth variant="outline" onClick={() => loginAs('CUSTOMER', '/courts')} className="py-6 text-base font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              Đi Đặt Sân Ngay
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}
