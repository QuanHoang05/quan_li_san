import React from 'react';
import Link from 'next/link';
import { Target, Search, Calendar, User as UserIcon } from 'lucide-react';

export default function UserLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-[70px]">
            {/* Topbar for Mobile */}
            <header className="fixed top-0 inset-x-0 h-14 bg-white shadow-sm flex items-center justify-between px-4 z-40">
                <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-emerald-700 tracking-tight">QuanLiSan</div>
                <div className="flex gap-4">
                    <button className="text-slate-500 hover:text-emerald-500 transition-colors">
                        <Search size={24} />
                    </button>
                    <button className="text-slate-500 hover:text-emerald-500 transition-colors relative">
                        <Target size={24} />
                        <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full"></span>
                    </button>
                </div>
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
                    <span>Sân bãi</span>
                </Link>
                <Link href="/shop" className="flex flex-col items-center gap-1 w-16 transition-colors hover:text-emerald-500 active:text-emerald-600 focus:text-emerald-500">
                    <ShoppingCart size={24} className="mb-0.5" />
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

// Ensure ShoppingCart is imported for the Shop link
import { ShoppingCart } from 'lucide-react';
