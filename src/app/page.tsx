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
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8 bg-slate-50">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold text-emerald-500 tracking-tight">QuanLiSan</h1>
        <p className="text-lg text-slate-500 mt-3 font-medium">
          Hệ thống Quản lý Sân Thể thao & Kết nối Người chơi
        </p>
      </div>
      
      <div className="flex flex-wrap gap-8 justify-center max-w-5xl">
        
        {/* ADMIN OPTION */}
        <Card className="flex flex-col w-80">
          <div className="p-6 text-center border-b border-slate-200 bg-white">
            <h2 className="text-xl font-bold text-slate-800">Chủ Sân (Admin)</h2>
            <p className="text-sm text-slate-500 mt-1">Toàn quyền hệ thống</p>
          </div>
          <div className="p-6 flex flex-col flex-1 bg-slate-50/50">
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 mb-8 flex-1">
              <li>Quản lý doanh thu, báo cáo</li>
              <li>Cấu hình giá sân, kho hàng</li>
              <li>Quản lý nhân viên (Approve ca làm)</li>
            </ul>
            <Button fullWidth onClick={() => loginAs('ADMIN', '/dashboard')}>
              Vào quyền Chủ Sân
            </Button>
          </div>
        </Card>

        {/* STAFF OPTION */}
        <Card className="flex flex-col w-80">
          <div className="p-6 text-center border-b border-slate-200 bg-white">
            <h2 className="text-xl font-bold text-slate-800">Nhân Viên (Staff)</h2>
            <p className="text-sm text-slate-500 mt-1">Vận hành tại quầy</p>
          </div>
          <div className="p-6 flex flex-col flex-1 bg-slate-50/50">
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 mb-8 flex-1">
              <li>Xem lịch đặt sân, xếp lịch</li>
              <li>Bán hàng tại quầy (POS)</li>
              <li>Xem kho, lịch làm việc cá nhân</li>
            </ul>
            <Button fullWidth variant="secondary" onClick={() => loginAs('STAFF', '/pos')}>
              Vào quyền Nhân Viên
            </Button>
          </div>
        </Card>

        {/* CUSTOMER OPTION */}
        <Card className="flex flex-col w-80">
          <div className="p-6 text-center border-b border-slate-200 bg-white">
            <h2 className="text-xl font-bold text-slate-800">Khách Hàng (Customer)</h2>
            <p className="text-sm text-slate-500 mt-1">Mua sắm & Đặt sân</p>
          </div>
          <div className="p-6 flex flex-col flex-1 bg-slate-50/50">
             <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5 mb-8 flex-1">
              <li>Tìm trận đấu, ghép kèo</li>
              <li>Mua sắm online (Shop)</li>
              <li>Quản lý Ví (Membership Wallet)</li>
            </ul>
            <Button fullWidth variant="outline" onClick={() => loginAs('CUSTOMER', '/matchmaking')}>
              Vào quyền Khách Hàng
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
}
