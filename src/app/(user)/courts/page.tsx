'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Calendar, MapPin, Clock, ChevronLeft, ChevronRight,
    CheckCircle2, Loader2, X, Zap, Shield, Star, History, Plus, ShieldAlert
} from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const SHIFTS_FIXED = [
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

function getToday() {
    return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];
}

export default function CourtsPage() {
    const router = useRouter();
    const todayStr = getToday();
    const [currentDate, setCurrentDate] = useState(todayStr);
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
        const interval = setInterval(fetchAvailability, 45000); 
        return () => clearInterval(interval);
    }, [fetchAvailability]);

    const changeDate = (days: number) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + days);
        const newDate = d.toISOString().split('T')[0];
        if (newDate >= todayStr) {
            setCurrentDate(newDate);
            setSelectedShifts([]);
        }
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
            const shift = SHIFTS_FIXED.find(s => s.id === sid);
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
            sessionStorage.setItem('pendingBooking', JSON.stringify(res));
            router.push(`/courts/payment/${res.booking_id}`);
        } catch (err: any) {
            toast.error(err.message || 'Đặt sân thất bại, vui lòng thử lại');
        } finally {
            setSubmitting(false);
        }
    };

    const courtShifts = selectedCourt?.shifts || [];

    return (
        <div className="flex flex-col gap-6 relative pb-10 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Đặt Lịch Sân Online</h2>
                    <div className="text-slate-500 mt-1 flex items-center gap-3 text-sm font-medium">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Trống</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-500"></span> Đang giữ</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Đã đặt</span>
                        <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-full text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Tự làm mới sau 45s
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => changeDate(-1)} disabled={currentDate <= todayStr} className="p-2 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-30"><ChevronLeft size={18} /></button>
                    <input type="date" value={currentDate} min={todayStr} onChange={e => {setCurrentDate(e.target.value); setSelectedShifts([]);}} className="bg-transparent border-none text-sm font-bold text-slate-700 mx-2 focus:outline-none focus:ring-0 cursor-pointer" />
                    <button onClick={() => changeDate(1)} className="p-2 text-slate-600 hover:text-slate-900 transition-colors"><ChevronRight size={18} /></button>
                    <Button onClick={() => router.push('/courts/my-bookings')} variant="outline" className="px-3 bg-white ml-2 gap-2 text-indigo-700 border-slate-200 hover:bg-slate-50">
                        <History size={15}/> Lịch sử đặt
                    </Button>
                </div>
            </div>

            {/* Court Selector */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {courts.map(c => (
                    <button 
                        key={c.id} 
                        onClick={() => {setSelectedCourt(c); setSelectedShifts([]);}} 
                        className={`px-6 py-3 rounded-lg font-bold border transition-all whitespace-nowrap min-w-[120px] ${selectedCourt?.id === c.id ? 'border-none bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        {c.name}
                        <span className={`ml-2 text-[10px] font-medium ${selectedCourt?.id === c.id ? 'text-white/70' : 'text-slate-400'}`}>
                            {c.type}
                        </span>
                    </button>
                ))}
            </div>

            {/* Shift Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl p-4 min-h-[140px] border border-slate-100 bg-slate-50/50 animate-pulse flex flex-col justify-between">
                            <div className="h-4 w-20 bg-slate-200 rounded" />
                            <div className="h-6 w-32 bg-slate-200 rounded mt-4" />
                            <div className="h-4 w-24 bg-slate-200 rounded mt-2" />
                        </div>
                    ))
                ) : selectedCourt ? SHIFTS_FIXED.map(shift => {
                    const shiftData = courtShifts.find((s: any) => s.shift_id === shift.id);
                    const isSelected = selectedShifts.includes(shift.id);

                    if (!shiftData || shiftData.status === 'blocked') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[140px] border border-slate-200 bg-slate-50 opacity-90 flex flex-col justify-between relative overflow-hidden shadow-sm">
                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                                <div className="flex justify-between items-start w-full ml-1">
                                    <span className="font-bold text-slate-400 text-[15px]">{shift.start} - {shift.end}</span>
                                    <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                                        <Shield size={12}/> Bảo Trì
                                    </span>
                                </div>
                                <div className="flex flex-col items-center justify-center flex-1 gap-1 text-slate-400 mt-2">
                                    <ShieldAlert size={20} className="opacity-20 mb-1"/>
                                    <div className="text-[10px] font-bold uppercase tracking-tight opacity-40">Bảo trì sân</div>
                                </div>
                            </div>
                        );
                    }
                    
                    if (shiftData.status === 'past') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[140px] border border-slate-200 bg-slate-50 opacity-90 flex flex-col justify-between relative overflow-hidden shadow-sm">
                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                                <div className="flex justify-between items-start w-full ml-1">
                                    <span className="font-bold text-slate-400 text-[15px]">{shift.start} - {shift.end}</span>
                                    <span className="bg-slate-100 text-slate-400 px-2.5 py-0.5 rounded text-xs font-semibold">Hết giờ</span>
                                </div>
                                <div className="flex flex-col items-center justify-center flex-1 gap-1 text-slate-400 mt-2">
                                    <Clock size={20} className="opacity-10 mb-1"/>
                                    <div className="text-xs font-medium italic opacity-40">Ca đã kết thúc</div>
                                </div>
                            </div>
                        );
                    }

                    if (shiftData.status === 'booked') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[140px] border border-slate-200 bg-slate-50 opacity-90 flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                                <div className="flex justify-between items-start w-full ml-1">
                                    <span className="font-bold text-slate-400 text-[15px]">{shift.start} - {shift.end}</span>
                                    <span className="bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded text-xs font-semibold">Đã đặt</span>
                                </div>
                                <div className="flex flex-col items-center justify-center flex-1 gap-1 text-slate-400 mt-2">
                                    <ShieldAlert size={20} className="opacity-20 mb-1"/>
                                    <div className="text-xs font-medium italic">Không còn trống</div>
                                </div>
                            </div>
                        );
                    }

                    if (shiftData.status === 'holding') {
                        return (
                            <div key={shift.id} className="rounded-xl p-4 min-h-[140px] border border-slate-200 bg-slate-50 opacity-90 flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                                <div className="flex justify-between items-start w-full ml-1">
                                    <span className="font-bold text-slate-400 text-[15px]">{shift.start} - {shift.end}</span>
                                    <span className="bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded text-xs font-semibold">Đang giữ</span>
                                </div>
                                <div className="flex flex-col items-center justify-center flex-1 gap-1 text-slate-400 mt-2">
                                    <Clock size={20} className="opacity-20 mb-1"/>
                                    <div className="text-xs font-medium italic">Đang chờ thanh toán</div>
                                </div>
                            </div>
                        );
                    }

                    // Available
                    return (
                        <div 
                            key={shift.id} 
                            className={`rounded-xl p-4 min-h-[140px] flex flex-col justify-between border-2 transition-all group ${
                                isSelected 
                                ? 'border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md scale-[1.02]' 
                                : 'border-slate-200 border-dashed bg-white hover:bg-slate-50'
                            } cursor-pointer`}
                            onClick={() => toggleShift(shift.id)}
                        >
                            <div className="flex justify-between items-start w-full">
                                <span className={`font-bold text-[15px] ${isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                    {shift.start} - {shift.end}
                                </span>
                            </div>
                            <div className="flex flex-col items-center justify-center flex-1 my-2">
                                {isSelected ? (
                                    <span className="text-emerald-600 font-bold text-xs uppercase tracking-tight bg-emerald-100 px-2 py-1 rounded">Đang chọn</span>
                                ) : (
                                    <>
                                        <Plus size={24} className="mb-1 text-slate-300 group-hover:text-slate-400" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 group-hover:text-slate-400">Đặt Ca Mới</span>
                                    </>
                                )}
                            </div>
                            <div className={`text-xs font-bold ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {(shiftData.price ?? selectedCourt.price_per_hour).toLocaleString()}đ/h
                            </div>
                        </div>
                    );
                }) : (
                    <div className="col-span-full p-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="text-slate-400 font-medium">Vui lòng chọn sân để xem lịch khả dụng.</div>
                    </div>
                )}
            </div>

            {/* Floating CTA */}
            {selectedShifts.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Button 
                        onClick={() => setShowBookingModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-full shadow-2xl flex items-center gap-3 font-bold text-lg border-4 border-white"
                    >
                        <Plus size={24}/> Tiếp tục đặt {selectedShifts.length} ca đã chọn
                    </Button>
                </div>
            )}

            {/* Booking Form Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <Card className="w-full max-w-md shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh] rounded-xl border border-slate-200">
                        <div className="bg-white text-slate-800 p-5 flex justify-between border-b border-slate-200 items-center">
                            <h3 className="font-bold text-lg">Xác Nhận Đặt Sân</h3>
                            <button onClick={()=>setShowBookingModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                        </div>
                        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col gap-3 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-slate-500 text-sm">Sân</div>
                                        <div className="font-bold text-slate-800">{selectedCourt?.name}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-slate-500 text-sm">Ngày đặt</div>
                                        <div className="font-bold text-slate-800">{new Date(currentDate).toLocaleDateString('vi-VN')}</div>
                                    </div>
                                    <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                                        <div className="font-semibold text-slate-500 text-sm">Ca đã chọn</div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                            {selectedShifts.sort((a,b)=>a-b).map(id => {
                                                const s = SHIFTS_FIXED.find(x => x.id === id);
                                                return <span key={id} className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{s?.start}</span>
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col gap-2 shadow-sm text-sm">
                                    <div className="flex justify-between pt-1 uppercase">
                                        <span className="text-emerald-900 font-black">Tổng Tiền Thanh Toán:</span>
                                        <span className="text-emerald-900 font-black text-xl">{calcTotal().toLocaleString()}đ</span>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4">
                                    <div className="font-semibold text-sm text-slate-700">Thông Tin Liên Hệ</div>
                                    <div className="flex flex-col gap-3">
                                        <input 
                                            value={form.guest_name} 
                                            onChange={e=>setForm({...form, guest_name: e.target.value})} 
                                            className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm transition-colors focus:outline-none" 
                                            placeholder="Tên Khách Hàng (Họ và Tên)"
                                            required
                                        />
                                        <input 
                                            type="tel" 
                                            value={form.guest_phone} 
                                            onChange={e=>setForm({...form, guest_phone: e.target.value})} 
                                            className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm transition-colors focus:outline-none" 
                                            placeholder="Số Điện Thoại Liên Hệ"
                                            required
                                        />
                                        <textarea 
                                            value={form.note} 
                                            onChange={e=>setForm({...form, note: e.target.value})} 
                                            className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm bg-white transition-colors resize-none h-20 focus:outline-none" 
                                            placeholder="Ghi chú thêm (tùy chọn)..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start shadow-sm">
                                    <Clock size={16} className="text-amber-600 mt-0.5 shrink-0"/>
                                    <div className="text-[11px] text-amber-700 leading-relaxed">
                                        <strong>Lưu ý:</strong> Sau khi xác nhận, bạn sẽ có <strong>15 phút</strong> để hoàn tất thanh toán QR. Hệ thống sẽ tự động hủy nếu quá hạn để đảm bảo công bằng cho người khác.
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <Button type="button" variant="ghost" onClick={() => setShowBookingModal(false)} className="font-semibold text-slate-600 flex-1 hover:bg-slate-200">Hủy Bỏ</Button>
                                    <Button type="submit" disabled={submitting} className="flex-2 font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all py-6">
                                        {submitting ? <Loader2 className="animate-spin mr-2"/> : null}
                                        Xác Nhận & Thanh Toán
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
