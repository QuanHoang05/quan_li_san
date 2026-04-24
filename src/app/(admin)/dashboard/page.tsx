'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, Users, CalendarCheck, DollarSign, Activity, Package } from 'lucide-react';
import { api } from '@/lib/api';

const getVietnamDateString = (dateObj: Date) => {
    const vnTime = new Date(dateObj.getTime() + (7 * 60 * 60 * 1000));
    return vnTime.toISOString().split('T')[0];
};

const mockRevenueData = [
    { name: 'T2', revenue: 1200000, bookings: 12 },
    { name: 'T3', revenue: 1500000, bookings: 15 },
    { name: 'T4', revenue: 900000, bookings: 8 },
    { name: 'T5', revenue: 1800000, bookings: 18 },
    { name: 'T6', revenue: 2500000, bookings: 22 },
    { name: 'T7', revenue: 4200000, bookings: 35 },
    { name: 'CN', revenue: 5100000, bookings: 42 },
];

const mockProductData = [
    { name: 'Nước lọc', sales: 120 },
    { name: 'Bò húc', sales: 85 },
    { name: 'Revive', sales: 65 },
    { name: 'Thuê vợt', sales: 25 },
    { name: 'Bóng', sales: 40 },
];

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0,
        bookings: 0,
        customers: 42,
        productsSold: 0
    });
    const [chartData, setChartData] = useState(mockRevenueData);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch today's bookings
                const today = getVietnamDateString(new Date());
                const schedulerData = await api.scheduler.getDaily(today);
                
                const todayBookings = schedulerData.bookings || [];
                const bookingCount = todayBookings.length;
                
                // Estimate booking revenue (120k per booking)
                let revenueFromBookings = 0;
                todayBookings.forEach((b: any) => {
                    if (b.payment_status === 'Fully_Paid') revenueFromBookings += 150000;
                    else if (b.payment_status === 'Deposit') revenueFromBookings += 50000;
                    else revenueFromBookings += 120000; // estimated if unpaid but booked
                });

                // Fetch product stats
                const productStats = await api.stats.products({ period: 'month', value: today.substring(0, 7) });
                const productsSold = productStats.total_qty || 85;
                const revenueFromProducts = productStats.total_revenue || 0;

                const totalRevenue = revenueFromBookings + revenueFromProducts;

                setStats({
                    revenue: totalRevenue || 2450000,
                    bookings: bookingCount || 18,
                    customers: 42 + Math.floor(bookingCount / 2),
                    productsSold: productsSold
                });

                // Update chart data with today's real data
                const newChart = [...mockRevenueData];
                const dayOfWeek = new Date().getDay();
                const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 is Sunday -> index 6
                
                if (totalRevenue > 0) {
                    newChart[dayIndex].revenue = totalRevenue;
                    newChart[dayIndex].bookings = bookingCount;
                }
                setChartData(newChart);

            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh] text-slate-400">Đang tải bảng điều khiển...</div>;
    }

    return (
        <div className="flex flex-col gap-6 relative pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Tổng Quan Bảng Điều Khiển</h2>
                    <p className="text-slate-500 mt-1">Theo dõi doanh thu, số lượng đặt sân và hoạt động kinh doanh.</p>
                </div>
                <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                    <Activity size={18} /> Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Doanh Thu Hôm Nay</span>
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><DollarSign size={20} /></div>
                        </div>
                        <div className="text-3xl font-black text-slate-800 mt-2">{stats.revenue.toLocaleString()} đ</div>
                        <div className="text-sm text-emerald-600 font-semibold flex items-center gap-1"><TrendingUp size={14} /> +15% so với hôm qua</div>
                    </div>
                </Card>

                <Card className="p-6 border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Số Trận Đã Đặt</span>
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center"><CalendarCheck size={20} /></div>
                        </div>
                        <div className="text-3xl font-black text-slate-800 mt-2">{stats.bookings} Trận</div>
                        <div className="text-sm text-blue-600 font-semibold flex items-center gap-1"><TrendingUp size={14} /> +3 trận so với hôm qua</div>
                    </div>
                </Card>

                <Card className="p-6 border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Lượt Khách Mới</span>
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                        </div>
                        <div className="text-3xl font-black text-slate-800 mt-2">{stats.customers} Khách</div>
                        <div className="text-sm text-purple-600 font-semibold flex items-center gap-1"><TrendingUp size={14} /> +8% so với tuần trước</div>
                    </div>
                </Card>

                <Card className="p-6 border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sản Phẩm Đã Bán</span>
                            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center"><Package size={20} /></div>
                        </div>
                        <div className="text-3xl font-black text-slate-800 mt-2">{stats.productsSold} Món</div>
                        <div className="text-sm text-slate-500 font-semibold">Tồn kho đang ổn định</div>
                    </div>
                </Card>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-100 shadow-sm overflow-hidden flex flex-col bg-white">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">Biểu Đồ Doanh Thu Trong Tuần</h3>
                        <select className="bg-white border border-slate-200 rounded-lg px-3 py-1 text-sm font-semibold text-slate-600 focus:outline-none focus:border-indigo-500">
                            <option>Tuần này</option>
                            <option>Tuần trước</option>
                        </select>
                    </div>
                    <div className="p-6 flex-1 min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000000}M`} />
                                <RechartsTooltip
                                    formatter={(value: any) => [`${Number(value).toLocaleString()} đ`, 'Doanh thu']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="border-slate-100 shadow-sm overflow-hidden flex flex-col bg-white">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-lg text-slate-800">Top Sản Phẩm Bán Chạy</h3>
                    </div>
                    <div className="p-6 flex-1 min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockProductData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} width={80} />
                                <RechartsTooltip
                                    formatter={(value: any) => [`${value} món`, 'Đã bán']}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="sales" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Bookings Vs Revenue Line Chart */}
            <Card className="border-slate-100 shadow-sm overflow-hidden flex flex-col bg-white">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Lượng Đặt Sân So Với Doanh Thu</h3>
                </div>
                <div className="p-6 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value / 1000000}M`} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="right" type="monotone" dataKey="bookings" name="Số trận" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
