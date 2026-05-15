'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
    Phone, Search, Clock, CheckCircle2, XCircle, AlertTriangle,
    Loader2, ChevronLeft, Calendar, QrCode, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatusBadge({ status, isDeleted, expiresAt }: { status: string; isDeleted: boolean; expiresAt: string | null }) {
    const ps = status.replace('PaymentStatus.', '');
    if (isDeleted) return <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-bold px-2.5 py-1 rounded-full"><XCircle size={11}/> Đã hủy</span>;
    if (ps === 'Fully_Paid') return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full"><CheckCircle2 size={11}/> Đã thanh toán</span>;
    if (ps === 'Deposit') return <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full"><Clock size={11}/> Chờ xác nhận</span>;
    if (ps === 'Unpaid') {
        if (expiresAt && new Date(expiresAt) > new Date()) {
            return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-full"><Clock size={11}/> Chờ thanh toán</span>;
        }
        return <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[11px] font-bold px-2.5 py-1 rounded-full"><XCircle size={11}/> Hết hạn</span>;
    }
    return <span className="text-[11px] text-slate-400">{ps}</span>;
}

function formatDateTime(isoStr: string) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function MyBookingsPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Auto-search if phone in session
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('pendingBooking');
            if (raw) {
                const meta = JSON.parse(raw);
                if (meta.guest_phone) {
                    setPhone(meta.guest_phone);
                    handleSearch(meta.guest_phone);
                }
            }
        } catch {}
    }, []);

    const handleSearch = async (phoneOverride?: string) => {
        const p = (phoneOverride ?? phone).trim();
        if (!p) return toast.error('Vui lòng nhập số điện thoại');
        setLoading(true);
        try {
            const data = await api.onlineBookings.getByPhone(p);
            setBookings(data);
            setSearched(true);
        } catch {
            toast.error('Không thể tìm kiếm. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const isPendingPayment = (b: any) => {
        const ps = (b.payment_status || '').replace('PaymentStatus.', '');
        return !b.is_deleted && ps === 'Unpaid' && b.expires_at && new Date(b.expires_at) > new Date();
    };

    return (
        <div className="flex flex-col gap-5 pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/courts')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronLeft size={20} className="text-slate-600"/>
                </button>
                <div>
                    <h1 className="text-lg font-black text-slate-800">Lịch sử đặt sân</h1>
                    <p className="text-xs text-slate-500">Tra cứu theo số điện thoại</p>
                </div>
            </div>

            {/* Hero image */}
            <div className="relative rounded-2xl overflow-hidden h-32">
                <img
                    src="https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&auto=format&fit=crop"
                    alt="Sân thể thao"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 to-slate-900/20 flex items-center px-5">
                    <div>
                        <div className="text-white font-black text-base">Theo dõi đặt sân của bạn</div>
                        <p className="text-white/70 text-xs mt-0.5">Kiểm tra trạng thái & lịch sử đặt sân</p>
                    </div>
                </div>
            </div>

            {/* Search box */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                        placeholder="Nhập số điện thoại đã đặt..."
                    />
                </div>
                <button
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-60"
                >
                    {loading ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                </button>
            </div>

            {/* Results */}
            {searched && !loading && (
                <>
                    {bookings.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 py-10 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                <Calendar size={32} className="text-slate-400"/>
                            </div>
                            <div>
                                <p className="font-bold text-slate-700">Không tìm thấy lịch đặt sân</p>
                                <p className="text-sm text-slate-400 mt-1">Thử với số điện thoại khác hoặc đặt sân ngay</p>
                            </div>
                            <button
                                onClick={() => router.push('/courts')}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                            >
                                Đặt sân ngay
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 mb-3">Tìm thấy {bookings.length} lịch đặt</p>
                            <div className="flex flex-col gap-3">
                                {bookings.map(b => (
                                    <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{b.court_name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <Calendar size={11}/>
                                                    {formatDateTime(b.start_time)} – {new Date(b.end_time).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'})}
                                                </div>
                                            </div>
                                            <StatusBadge status={b.payment_status} isDeleted={b.is_deleted} expiresAt={b.expires_at}/>
                                        </div>

                                        {b.payment_ref && (
                                            <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                                                <div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Mã đặt</div>
                                                    <div className="font-mono text-xs font-bold text-slate-700 mt-0.5">{b.payment_ref}</div>
                                                </div>
                                                {b.proof_image_url && (
                                                    <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-semibold">
                                                        <CheckCircle2 size={11}/> Đã gửi minh chứng
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* CTA for pending payment */}
                                        {isPendingPayment(b) && (
                                            <button
                                                onClick={() => router.push(`/courts/payment/${b.id}`)}
                                                className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-all"
                                            >
                                                <QrCode size={15}/> Tiếp tục thanh toán <ArrowRight size={14}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {!searched && !loading && (
                <div className="flex flex-col items-center gap-3 py-8 text-center text-slate-400">
                    <Search size={36} className="opacity-30"/>
                    <p className="text-sm">Nhập số điện thoại để xem lịch đặt sân của bạn</p>
                </div>
            )}
        </div>
    );
}
