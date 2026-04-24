'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    Calendar, MapPin, Clock, ChevronLeft, ChevronRight,
    CheckCircle2, Loader2, X, Zap, Shield, Star, History
} from 'lucide-react';

const SHIFTS = [
    { id: 1,  start: '06:00', end: '07:30' },
    { id: 2,  start: '07:30', end: '09:00' },
    { id: 3,  start: '09:00', end: '10:30' },
    { id: 4,  start: '10:30', end: '12:00' },
    { id: 5,  start: '12:00', end: '13:30' },
    { id: 6,  start: '13:30', end: '15:00' },
    { id: 7,  start: '15:00', end: '16:30' },
    { id: 8,  start: '16:30', end: '18:00' },
    { id: 9,  start: '18:00', end: '19:30' },
    { id: 10, start: '19:30', end: '21:00' },
    { id: 11, start: '21:00', end: '22:30' },
    { id: 12, start: '22:30', end: '23:59' },
];

const COURT_IMAGES: Record<string, string> = {
    default: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop',
    cầu_lông: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop',
    tennis: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop',
    pickleball: 'https://images.unsplash.com/photo-1583786342766-c34bab1aba85?w=800&auto=format&fit=crop',
    bóng_đá: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&auto=format&fit=crop',
};

function getToday() {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

function getDayRange(centerDate: string, count = 7) {
    const result = [];
    const base = new Date(centerDate + 'T00:00:00');
    for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        result.push(d.toISOString().split('T')[0]);
    }
    return result;
}

export default function CourtsPage() {
    const router = useRouter();
    const todayStr = getToday();
    const [currentDate, setCurrentDate] = useState(todayStr);
    const [dayRange, setDayRange] = useState<string[]>(getDayRange(todayStr));
    const [courts, setCourts] = useState<any[]>([]);
    const [selectedCourt, setSelectedCourt] = useState<any | null>(null);
    const [selectedShifts, setSelectedShifts] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [form, setForm] = useState({ guest_name: '', guest_phone: '', note: '' });

    const fetchAvailability = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.onlineBookings.getAvailability(currentDate);
            setCourts(data.courts || []);
            if (!selectedCourt && data.courts?.length > 0) {
                setSelectedCourt(data.courts[0]);
            } else if (selectedCourt) {
                const updated = data.courts.find((c: any) => c.id === selectedCourt.id);
                if (updated) setSelectedCourt(updated);
            }
        } catch {
            toast.error('Không thể tải lịch sân');
        } finally {
            setLoading(false);
        }
    }, [currentDate]);

    useEffect(() => {
        fetchAvailability();
        setSelectedShifts([]);
        const interval = setInterval(fetchAvailability, 30000);
        return () => clearInterval(interval);
    }, [fetchAvailability]);

    useEffect(() => {
        setDayRange(getDayRange(currentDate));
    }, [currentDate]);

    const handleDateChange = (d: string) => {
        setCurrentDate(d);
        setSelectedShifts([]);
    };

    const handlePrevWeek = () => {
        const d = new Date(dayRange[0] + 'T00:00:00');
        d.setDate(d.getDate() - 7);
        const newDate = d.toISOString().split('T')[0];
        if (newDate >= todayStr) {
            setCurrentDate(newDate);
        } else {
            setCurrentDate(todayStr);
        }
    };

    const handleNextWeek = () => {
        const d = new Date(dayRange[dayRange.length - 1] + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        setCurrentDate(d.toISOString().split('T')[0]);
    };

    const toggleShift = (shiftId: number) => {
        setSelectedShifts(prev =>
            prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
        );
    };

    const calcTotal = () => {
        if (!selectedCourt) return 0;
        return selectedShifts.reduce((sum, sid) => {
            const shiftInfo = selectedCourt.shifts?.find((s: any) => s.shift_id === sid);
            const shift = SHIFTS.find(s => s.id === sid);
            if (!shift || !shiftInfo) return sum;
            const start = new Date(`2000-01-01T${shift.start}:00`);
            const endStr = shift.end === '23:59' ? '23:59' : shift.end;
            const end = new Date(`2000-01-01T${endStr}:00`);
            const hours = (end.getTime() - start.getTime()) / 3600000;
            return sum + hours * (shiftInfo.price ?? selectedCourt.price_per_hour);
        }, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.guest_name.trim() || !form.guest_phone.trim()) {
            return toast.error('Vui lòng nhập đầy đủ họ tên và số điện thoại');
        }
        if (selectedShifts.length === 0) {
            return toast.error('Vui lòng chọn ít nhất 1 ca');
        }
        setSubmitting(true);
        try {
            const res = await api.onlineBookings.create({
                court_id: selectedCourt!.id,
                date: currentDate,
                shift_ids: selectedShifts,
                guest_name: form.guest_name.trim(),
                guest_phone: form.guest_phone.trim(),
                note: form.note.trim(),
            });
            toast.success('Đặt sân thành công! Đang chuyển đến trang thanh toán...');
            setShowBookingModal(false);
            // Store booking info in sessionStorage for payment page
            sessionStorage.setItem('pendingBooking', JSON.stringify(res));
            router.push(`/courts/payment/${res.booking_id}`);
        } catch (err: any) {
            toast.error(err.message || 'Đặt sân thất bại, vui lòng thử lại');
        } finally {
            setSubmitting(false);
        }
    };

    const courtShifts = selectedCourt?.shifts || [];

    const getShiftStyle = (status: string, isSelected: boolean) => {
        if (isSelected) return 'border-2 border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md scale-[1.02]';
        if (status === 'available') return 'border-2 border-dashed border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 cursor-pointer';
        if (status === 'holding') return 'border border-amber-200 bg-amber-50/60 cursor-not-allowed';
        if (status === 'booked') return 'border border-slate-200 bg-slate-100 cursor-not-allowed opacity-70';
        return 'border border-slate-200 bg-slate-100 cursor-not-allowed opacity-50';
    };

    const heroImage = selectedCourt
        ? (COURT_IMAGES[(selectedCourt.type || '').toLowerCase().replace(' ', '_')] || COURT_IMAGES.default)
        : COURT_IMAGES.default;

    return (
        <div className="flex flex-col gap-0 pb-8">
            {/* Hero Banner */}
            <div className="relative -mx-4 -mt-4 h-48 overflow-hidden">
                <img
                    src={heroImage}
                    alt="Sân thể thao"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-slate-50" />
                <div className="absolute inset-x-0 bottom-4 px-4">
                    <h1 className="text-2xl font-black text-white drop-shadow-lg">Đặt Sân Online</h1>
                    <p className="text-white/80 text-sm font-medium mt-0.5 drop-shadow">Chọn ca & thanh toán nhanh · Xác nhận tức thì</p>
                </div>
                <div className="absolute top-3 right-4 flex gap-2">
                    <button
                        onClick={() => router.push('/courts/my-bookings')}
                        className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition-colors"
                    >
                        <History size={13}/> Lịch sử đặt
                    </button>
                </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {[
                    { icon: <Zap size={12}/>, label: 'Giữ chỗ 15 phút' },
                    { icon: <Shield size={12}/>, label: 'Thanh toán an toàn' },
                    { icon: <Star size={12}/>, label: 'Xác nhận tức thì' },
                ].map(item => (
                    <span key={item.label} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                        {item.icon} {item.label}
                    </span>
                ))}
            </div>

            {/* Court Selector */}
            <div className="mt-5">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Chọn Sân</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {courts.map(court => (
                        <button
                            key={court.id}
                            onClick={() => { setSelectedCourt(court); setSelectedShifts([]); }}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                selectedCourt?.id === court.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                            {court.name}
                            <span className={`ml-1.5 text-[10px] font-medium ${selectedCourt?.id === court.id ? 'opacity-70' : 'text-slate-400'}`}>
                                {court.type}
                            </span>
                        </button>
                    ))}
                    {loading && courts.length === 0 && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 size={16} className="animate-spin"/> Đang tải...
                        </div>
                    )}
                </div>
            </div>

            {/* Date Picker */}
            <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chọn Ngày</div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handlePrevWeek}
                            disabled={dayRange[0] <= todayStr}
                            className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={16}/>
                        </button>
                        <button onClick={handleNextWeek} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {dayRange.map(d => {
                        const isToday = d === todayStr;
                        const isSelected = d === currentDate;
                        const isPast = d < todayStr;
                        return (
                            <button
                                key={d}
                                disabled={isPast}
                                onClick={() => handleDateChange(d)}
                                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-sm font-bold transition-all border ${
                                    isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                        : isPast
                                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                                }`}
                            >
                                <span className="text-[10px] font-medium opacity-75 mb-0.5">
                                    {isToday ? 'Hôm nay' : ['CN','T2','T3','T4','T5','T6','T7'][new Date(d+'T00:00:00').getDay()]}
                                </span>
                                <span>{new Date(d+'T00:00:00').getDate()}</span>
                                <span className="text-[10px] font-normal opacity-75">/{new Date(d+'T00:00:00').getMonth()+1}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Shift Grid */}
            <div className="mt-5">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Khung Giờ — {formatDate(currentDate)}</div>
                    <div className="flex gap-3 text-[10px] font-semibold">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-50 inline-block"/>&nbsp;Trống</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-200 rounded-sm inline-block"/>&nbsp;Đang giữ</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-300 rounded-sm inline-block"/>&nbsp;Đã đặt</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-40 text-slate-400">
                        <Loader2 size={28} className="animate-spin"/>
                    </div>
                ) : !selectedCourt ? (
                    <div className="text-center text-slate-500 py-10">Vui lòng chọn sân ở trên</div>
                ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                        {courtShifts.map((shiftData: any) => {
                            const shift = SHIFTS.find(s => s.id === shiftData.shift_id);
                            if (!shift) return null;
                            const isSelected = selectedShifts.includes(shiftData.shift_id);
                            const canSelect = shiftData.status === 'available';
                            return (
                                <div
                                    key={shiftData.shift_id}
                                    onClick={() => canSelect && toggleShift(shiftData.shift_id)}
                                    className={`rounded-xl p-3 transition-all ${getShiftStyle(shiftData.status, isSelected)}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-[13px] font-bold ${isSelected ? 'text-emerald-700' : shiftData.status === 'available' ? 'text-slate-700' : 'text-slate-400'}`}>
                                            {shift.start} - {shift.end}
                                        </span>
                                        {isSelected && <CheckCircle2 size={16} className="text-emerald-600 shrink-0"/>}
                                        {shiftData.status === 'holding' && (
                                            <span className="text-[10px] text-amber-600 font-semibold bg-amber-100 px-1.5 py-0.5 rounded">Đang giữ</span>
                                        )}
                                        {shiftData.status === 'booked' && (
                                            <span className="text-[10px] text-slate-500 font-semibold bg-slate-200 px-1.5 py-0.5 rounded">Đã đặt</span>
                                        )}
                                    </div>
                                    <div className={`text-xs mt-1.5 font-semibold ${isSelected ? 'text-emerald-600' : shiftData.status === 'available' ? 'text-slate-500' : 'text-slate-300'}`}>
                                        {(shiftData.price ?? selectedCourt.price_per_hour).toLocaleString()}đ/h
                                    </div>
                                    {isSelected && (
                                        <div className="text-[10px] text-emerald-600 font-bold mt-1 uppercase tracking-tight">✓ Đang chọn</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating CTA */}
            {selectedShifts.length > 0 && (
                <div className="fixed bottom-[76px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
                    <button
                        onClick={() => setShowBookingModal(true)}
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-base border-2 border-white/30 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-[0.98]"
                    >
                        <div className="flex flex-col items-start">
                            <span className="text-white/80 text-xs font-medium">{selectedShifts.length} ca · {selectedCourt?.name}</span>
                            <span className="text-lg font-black">{Math.round(calcTotal()).toLocaleString()}đ</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 px-4 py-2 rounded-xl">
                            <CheckCircle2 size={18}/>
                            <span>Đặt ngay</span>
                        </div>
                    </button>
                </div>
            )}

            {/* Booking Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end">
                    <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto">
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-slate-200 rounded-full"/>
                        </div>
                        <div className="px-5 pb-8">
                            <div className="flex justify-between items-center py-4 border-b border-slate-100">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Xác nhận đặt sân</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{selectedCourt?.name} · {formatDate(currentDate)}</p>
                                </div>
                                <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                    <X size={20} className="text-slate-500"/>
                                </button>
                            </div>

                            {/* Summary */}
                            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Tóm tắt đặt sân</div>
                                <div className="space-y-1.5">
                                    {selectedShifts.sort((a, b) => a - b).map(sid => {
                                        const s = SHIFTS.find(x => x.id === sid);
                                        const shiftData = courtShifts.find((x: any) => x.shift_id === sid);
                                        const price = shiftData?.price ?? selectedCourt?.price_per_hour ?? 0;
                                        const start = new Date(`2000-01-01T${s?.start}:00`);
                                        const end = new Date(`2000-01-01T${s?.end === '23:59' ? '23:59' : s?.end}:00`);
                                        const hours = (end.getTime() - start.getTime()) / 3600000;
                                        return (
                                            <div key={sid} className="flex justify-between text-sm">
                                                <span className="text-emerald-800">{s?.start} – {s?.end}</span>
                                                <span className="font-semibold text-emerald-900">{Math.round(hours * price).toLocaleString()}đ</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="border-t border-emerald-200 mt-2.5 pt-2.5 flex justify-between">
                                    <span className="font-black text-emerald-900 text-sm uppercase">Tổng cộng</span>
                                    <span className="font-black text-emerald-900 text-lg">{Math.round(calcTotal()).toLocaleString()}đ</span>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Họ và tên *</label>
                                    <input
                                        value={form.guest_name}
                                        onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                                        className="w-full border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                                        placeholder="Nguyễn Văn A"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Số điện thoại *</label>
                                    <input
                                        type="tel"
                                        value={form.guest_phone}
                                        onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                                        className="w-full border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                                        placeholder="0901234567"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Ghi chú (tùy chọn)</label>
                                    <input
                                        value={form.note}
                                        onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                        className="w-full border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                                        placeholder="Yêu cầu đặc biệt..."
                                    />
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                                    <Clock size={14} className="mt-0.5 shrink-0"/>
                                    <span><strong>Lưu ý:</strong> Sau khi đặt, bạn có <strong>15 phút</strong> để hoàn tất thanh toán. Hệ thống sẽ tự động hủy nếu quá hạn.</span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-2xl font-black text-base shadow-lg hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <><Loader2 size={20} className="animate-spin"/> Đang xử lý...</> : <>Xác Nhận & Đặt Sân</>}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
