'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { pushNotification } from '@/components/NotificationBell';
import { ChevronLeft, ChevronRight, X, User as UserIcon, Phone, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const SHIFTS = [
    { id: 1, start: '06:00', end: '07:30' },
    { id: 2, start: '07:30', end: '09:00' },
    { id: 3, start: '09:00', end: '10:30' },
    { id: 4, start: '10:30', end: '12:00' },
    { id: 5, start: '12:00', end: '13:30' },
    { id: 6, start: '13:30', end: '15:00' },
    { id: 7, start: '15:00', end: '16:30' },
    { id: 8, start: '16:30', end: '18:00' },
    { id: 9, start: '18:00', end: '19:30' },
    { id: 10, start: '19:30', end: '21:00' },
    { id: 11, start: '21:00', end: '22:30' },
    { id: 12, start: '22:30', end: '23:59' }
];

export default function CourtsPage() {
    const getVietnamDateString = (dateObj: Date) => {
        // GMT+7
        return new Date(dateObj.getTime() + 7 * 3600 * 1000).toISOString().split('T')[0];
    };

    const todayObj = new Date();
    const todayStr = getVietnamDateString(todayObj);

    const [currentDate, setCurrentDate] = useState(todayStr);
    const [loading, setLoading] = useState(true);

    // Data
    const [courts, setCourts] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [blocks, setBlocks] = useState<any[]>([]);

    // UI
    const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
    const [bookingModal, setBookingModal] = useState<{ open: boolean, shift: any | null }>({ open: false, shift: null });

    // Form
    const [bookingForm, setBookingForm] = useState({
        guest_name: '',
        guest_phone: '',
        note: '',
        payment_status: 'Fully_Paid' // Default
    });

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await api.scheduler.getDaily(currentDate);
            setCourts(data.courts);
            setBookings(data.bookings);
            setBlocks(data.blocks);
            if (data.courts.length > 0 && selectedCourtId === null) {
                setSelectedCourtId(data.courts[0].id);
            }
        } catch (err) {
            toast.error("Không thể tải thông tin sân!");
        } finally {
            setLoading(false);
        }
    };

    const changeDate = (days: number) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + days);
        const newDateStr = d.toISOString().split('T')[0];
        if (newDateStr < todayStr) {
            toast.error("Không thể xem lịch của ngày đã qua.");
            return;
        }
        setCurrentDate(newDateStr);
    };

    const getShiftStatus = (shift: any) => {
        if (!selectedCourtId) return { type: 'empty' };

        const shiftStart = `${currentDate}T${shift.start}:00`;
        const shiftEnd = shift.end === '23:59' ? `${currentDate}T23:59:59` : `${currentDate}T${shift.end}:00`;
        const sTime = new Date(shiftStart).getTime();
        const eTime = new Date(shiftEnd).getTime();

        const booking = bookings.find(b =>
            b.court_id === selectedCourtId &&
            new Date(b.start_time).getTime() < eTime &&
            new Date(b.end_time).getTime() > sTime
        );
        if (booking) return { type: 'booked', data: booking };

        const block = blocks.find(b =>
            b.court_id === selectedCourtId &&
            new Date(b.start_time).getTime() < eTime &&
            new Date(b.end_time).getTime() > sTime
        );
        if (block) return { type: 'block', data: block };

        return { type: 'empty' };
    };

    const calculatePrice = (courtId: number, shiftId: number) => {
        const court = courts.find(c => c.id === courtId);
        if (!court) return 0;

        const shift = SHIFTS.find(s => s.id === shiftId);
        if (!shift) return 0;

        const rule = (court.pricing_rules || []).find((r: any) => r.shift_id === shiftId);
        const pricePerHour = rule?.price_override ?? court.price_per_hour;

        const sStr = shift.start.includes(':') ? shift.start : '00:00';
        const eStr = shift.end.includes(':') ? shift.end : '00:00';
        const start = new Date(`2000-01-01T${sStr}:00`);
        const end = eStr === '23:59' ? new Date(`2000-01-01T23:59:59`) : new Date(`2000-01-01T${eStr}:00`);

        const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return (minutes / 60) * pricePerHour;
    };

    const handleShiftClick = (shift: any, status: any) => {
        const hasRole = document.cookie.includes('role=');
        if (!hasRole) {
            toast.error("Vui lòng đăng nhập để đặt sân.");
            window.location.href = '/login?redirect=/courts';
            return;
        }

        if (status.type === 'empty') {
            setBookingForm({ guest_name: '', guest_phone: '', note: '', payment_status: 'Fully_Paid' });
            setBookingModal({ open: true, shift });
        } else if (status.type === 'booked') {
            toast.error("Khung giờ này đã có người đặt.");
        } else {
            toast.error("Khung giờ này đang bảo trì.");
        }
    };

    const submitBooking = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!bookingForm.guest_name || !bookingForm.guest_phone) {
            toast.error("Vui lòng nhập tên và số điện thoại.");
            return;
        }

        try {
            const shift = bookingModal.shift;
            if (!shift || !selectedCourtId) return;

            const startDateTime = `${currentDate}T${shift.start}:00`;
            const endDateTime = shift.end === '23:59' ? `${currentDate}T23:59:59` : `${currentDate}T${shift.end}:00`;

            // Ghi hình thức thanh toán vào note, luôn đặt Unpaid để nhân viên xác nhận
            const paymentLabel = bookingForm.payment_status === 'Fully_Paid' ? 'Chuyển toàn bộ' : 'Đặt cọc';
            const prependedNote = `[Web Booking] [${paymentLabel}] ` + bookingForm.note;

            await api.bookings.create({
                court_id: selectedCourtId,
                start_time: startDateTime,
                end_time: endDateTime,
                user_id: null,
                guest_name: bookingForm.guest_name,
                guest_phone: bookingForm.guest_phone,
                // Luôn gửi Unpaid - nhân viên phải xác nhận mọi đặt sân từ web
                payment_status: 'Unpaid',
                note: prependedNote,
                is_recurring: false,
                recurring_weeks: 1
            });

            toast.success("Gửi yêu cầu đặt sân thành công!");
            
            // Gửi thông báo
            pushNotification(`Khách hàng ${bookingForm.guest_name} vừa yêu cầu đặt sân vào ${shift.start}`, 'ADMIN');
            pushNotification(`Khách hàng ${bookingForm.guest_name} vừa yêu cầu đặt sân vào ${shift.start}`, 'STAFF');
            pushNotification(`Yêu cầu đặt sân của bạn đã được gửi. Chúng tôi sẽ phản hồi sớm.`, 'CUSTOMER');

            setBookingModal({ open: false, shift: null });
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Lỗi khi đặt sân. Vui lòng thử lại.");
        }
    };

    // Tạo danh sách các ngày sắp tới (7 ngày)
    const nextDays = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(todayObj);
        d.setDate(d.getDate() + i);
        return {
            dateStr: getVietnamDateString(d),
            dayOfWeek: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
            dayOfMonth: d.getDate()
        };
    });

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header / Date Selection */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">Đặt Sân</h1>

                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {nextDays.map((day) => {
                        const isSelected = currentDate === day.dateStr;
                        return (
                            <button
                                key={day.dateStr}
                                onClick={() => setCurrentDate(day.dateStr)}
                                className={`flex flex-col items-center min-w-[70px] p-3 rounded-xl border transition-all ${isSelected
                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-md transform scale-105'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span className={`text-xs font-medium uppercase ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>{day.dayOfWeek}</span>
                                <span className="text-xl font-bold mt-1">{day.dayOfMonth}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Court Selection */}
            {courts.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {courts.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedCourtId(c.id)}
                            className={`px-6 py-3 rounded-xl font-bold border transition-all whitespace-nowrap min-w-[120px] ${selectedCourtId === c.id
                                    ? 'border-none bg-slate-800 text-white shadow-md'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Shifts Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedCourtId && SHIFTS.map(shift => {
                    const status = getShiftStatus(shift);
                    const price = calculatePrice(selectedCourtId, shift.id);

                    if (status.type === 'booked') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[120px] bg-rose-50 border border-rose-200 flex flex-col justify-between opacity-80 cursor-not-allowed">
                                <div className="font-bold text-rose-800 text-lg">{shift.start} - {shift.end}</div>
                                <div className="mt-2 text-rose-600 font-semibold text-sm">Đã được đặt</div>
                            </div>
                        );
                    } else if (status.type === 'block') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[120px] bg-slate-100 border border-slate-200 flex flex-col justify-between opacity-80 cursor-not-allowed">
                                <div className="font-bold text-slate-600 text-lg">{shift.start} - {shift.end}</div>
                                <div className="mt-2 text-slate-500 font-semibold text-sm">Bảo trì sân</div>
                            </div>
                        );
                    } else {
                        // Trống (Green)
                        return (
                            <button
                                key={shift.id}
                                onClick={() => handleShiftClick(shift, status)}
                                className="rounded-xl p-4 min-h-[120px] bg-emerald-50 border-2 border-emerald-500 hover:bg-emerald-100 transition-colors flex flex-col justify-between text-left cursor-pointer group"
                            >
                                <div className="font-bold text-emerald-900 text-lg group-hover:scale-105 transition-transform">{shift.start} - {shift.end}</div>
                                <div className="mt-2">
                                    <div className="text-emerald-700 font-semibold text-sm mb-1">Còn trống</div>
                                    <div className="text-emerald-900 font-black text-lg">{price.toLocaleString()}đ</div>
                                </div>
                            </button>
                        );
                    }
                })}
                {courts.length === 0 && !loading && (
                    <div className="col-span-full p-10 text-center bg-white rounded-xl border border-slate-200">
                        <div className="text-slate-500 font-medium">Hệ thống chưa có sân nào được cấu hình.</div>
                    </div>
                )}
            </div>

            {/* Booking Modal */}
            {bookingModal.open && bookingModal.shift && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-end md:items-center p-0 md:p-4">
                    <div className="w-full max-w-md bg-white md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
                        <div className="bg-emerald-600 text-white p-5 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl">Xác nhận đặt sân</h3>
                                <p className="text-emerald-100 text-sm mt-1">{courts.find(c => c.id === selectedCourtId)?.name} • {bookingModal.shift.start} - {bookingModal.shift.end}</p>
                            </div>
                            <button onClick={() => setBookingModal({ open: false, shift: null })} className="text-emerald-200 hover:text-white bg-emerald-700/50 hover:bg-emerald-700 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                            {/* Order Summary */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex justify-between items-center">
                                <span className="font-semibold text-slate-600">Tổng tiền dự kiến</span>
                                <span className="font-black text-2xl text-emerald-600">{calculatePrice(selectedCourtId!, bookingModal.shift.id).toLocaleString()}đ</span>
                            </div>

                            <form onSubmit={submitBooking} className="flex flex-col gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><UserIcon size={16} className="text-slate-400" /> Họ và Tên <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={bookingForm.guest_name}
                                        onChange={e => setBookingForm({ ...bookingForm, guest_name: e.target.value })}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                        placeholder="Nhập tên của bạn"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><Phone size={16} className="text-slate-400" /> Số Điện Thoại <span className="text-rose-500">*</span></label>
                                    <input
                                        type="tel"
                                        value={bookingForm.guest_phone}
                                        onChange={e => setBookingForm({ ...bookingForm, guest_phone: e.target.value })}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                        placeholder="Nhập số điện thoại"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">Hình Thức Thanh Toán <span className="text-rose-500">*</span></label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 hover:bg-slate-50 transition-colors">
                                            <input 
                                                type="radio" 
                                                name="payment_status" 
                                                value="Fully_Paid" 
                                                checked={bookingForm.payment_status === 'Fully_Paid'}
                                                onChange={e => setBookingForm({...bookingForm, payment_status: e.target.value})}
                                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="font-medium text-slate-700 text-sm">Chuyển toàn bộ</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 hover:bg-slate-50 transition-colors">
                                            <input 
                                                type="radio" 
                                                name="payment_status" 
                                                value="Deposit" 
                                                checked={bookingForm.payment_status === 'Deposit'}
                                                onChange={e => setBookingForm({...bookingForm, payment_status: e.target.value})}
                                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="font-medium text-slate-700 text-sm">Đặt cọc</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><FileText size={16} className="text-slate-400" /> Ghi Chú (Tùy chọn)</label>
                                    <textarea
                                        value={bookingForm.note}
                                        onChange={e => setBookingForm({ ...bookingForm, note: e.target.value })}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none min-h-[100px] resize-none"
                                        placeholder="Yêu cầu thêm..."
                                    />
                                </div>

                                <div className="mt-4 pb-4 md:pb-0">
                                    <Button type="submit" className="w-full py-4 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/30">
                                        Gửi Yêu Cầu Đặt Sân
                                    </Button>
                                    <p className="text-center text-xs text-slate-500 mt-3">Yêu cầu của bạn sẽ được nhân viên xác nhận.</p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
