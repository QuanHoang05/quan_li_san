import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { 
  LayoutDashboard, 
  CalendarDays, 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp, 
  Settings,
  Menu,
  Search,
  LogOut
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Read the simulated role from HTTP cookies
    const cookieStore = await cookies();
    const userRole = cookieStore.get('role')?.value || 'STAFF';
    const isAdmin = userRole === 'ADMIN';

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[260px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-20">
                <div className="h-16 flex items-center px-6 border-b border-slate-200">
                    <div className="flex items-center gap-3 text-emerald-500">
                        <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-orange-500 rounded-lg"></div>
                        <h2 className="text-xl font-bold tracking-tight m-0 text-slate-800">QuanLiSan</h2>
                    </div>
                </div>
                
                <div className="px-4 pt-6">
                    <p className="text-xs font-semibold text-slate-400 mb-3 px-3 tracking-wider">QUẢN LÝ CHÍNH</p>
                    <nav className="flex flex-col gap-1">
                        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-600">
                            <LayoutDashboard size={20} />
                            <span>Tổng quan</span>
                        </Link>
                        <Link href="/bookings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                            <CalendarDays size={20} />
                            <span>Lịch đặt sân</span>
                        </Link>
                        <Link href="/pos" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                            <ShoppingCart size={20} />
                            <span>Bán hàng (POS)</span>
                        </Link>
                    </nav>
                </div>

                <div className="px-4 pt-6">
                    <p className="text-xs font-semibold text-slate-400 mb-3 px-3 tracking-wider">VẬN HÀNH</p>
                    <nav className="flex flex-col gap-1">
                        <Link href="/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                            <Package size={20} />
                            <span>Kho hàng</span>
                        </Link>
                        <Link href="/customers" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                            <Users size={20} />
                            <span>Khách hàng & Cộng đồng</span>
                        </Link>
                        {isAdmin && (
                            <Link href="/reports" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                                <TrendingUp size={20} />
                                <span>Báo cáo doanh thu</span>
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="px-4 pt-6 mt-auto pb-4">
                    <nav className="flex flex-col gap-1">
                        {isAdmin && (
                            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 font-medium text-sm transition-colors hover:bg-slate-100 hover:text-slate-900">
                                <Settings size={20} />
                                <span>Thiết lập hệ thống</span>
                            </Link>
                        )}
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header / Topbar */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <Menu size={20} />
                        </button>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 h-9 w-[300px] transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                            <Search size={16} className="text-slate-400 mr-2" />
                            <input type="text" placeholder="Tìm kiếm sđt khách, lịch đặt..." className="bg-transparent border-none w-full text-sm text-slate-900 outline-none" />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <NotificationBell userRole={userRole} />
                        <div className="flex items-center gap-3 px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold">
                                {isAdmin ? 'A' : 'S'}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900">{isAdmin ? 'Chủ Sân' : 'Nhân Viên'}</span>
                                <span className="text-xs text-slate-500">{isAdmin ? 'Quản trị viên' : 'Nhân viên quầy'}</span>
                            </div>
                        </div>
                        <Link href="/" title="Đổi quyền (Logout)" className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors ml-2">
                            <LogOut size={20} />
                        </Link>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-6xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
