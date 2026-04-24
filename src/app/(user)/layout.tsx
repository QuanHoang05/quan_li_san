import React from 'react';
import Link from 'next/link';
import { Target, Calendar, User as UserIcon, Clock, ShoppingBag } from 'lucide-react';

export default function UserLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-[70px]">
            {/* Topbar for Mobile */}
            <header className="fixed top-0 inset-x-0 h-14 bg-white shadow-sm flex items-center justify-between px-4 z-40">
                <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-emerald-700 tracking-tight">QuanLiSan</div>
                <Link href="/courts/my-bookings" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 rounded-full transition-colors">
                    <Clock size={13}/> Lịch sử đặt sân
                </Link>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 mt-14 p-4 max-w-xl mx-auto w-full">
                {children}
            </main>

            {/* Bottom Navigation for Mobile */}
            <nav className="fixed bottom-0 inset-x-0 h-[70px] bg-white border-t border-slate-200 flex items-center justify-around z-50 text-xs font-medium text-slate-500 px-2 pb-safe">
                <Link href="/matchmaking" className="flex flex-col items-center gap-1 w-16 transition-colors hover:text-emerald-500 active:text-emerald-600 focus:text-emerald-500">
                    <Target size={24} className="mb-0.5" />
                    <span>Tìm trận</span>
                </Link>
                <Link href="/courts" className="flex flex-col items-center gap-1 w-16 transition-colors hover:text-emerald-500 active:text-emerald-600 focus:text-emerald-500">
                    <Calendar size={24} className="mb-0.5" />
                    <span>Đặt sân</span>
                </Link>
                <Link href="/shop" className="flex flex-col items-center gap-1 w-16 transition-colors hover:text-emerald-500 active:text-emerald-600 focus:text-emerald-500">
                    <ShoppingBag size={24} className="mb-0.5" />
                    <span>Cửa hàng</span>
                </Link>
                <Link href="/profile" className="flex flex-col items-center gap-1 w-16 transition-colors hover:text-emerald-500 active:text-emerald-600 focus:text-emerald-500">
                    <UserIcon size={24} className="mb-0.5" />
                    <span>Cá nhân</span>
                </Link>
            </nav>
        </div>
    );
}
