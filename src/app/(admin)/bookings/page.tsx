'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, X, Ban, ChevronLeft, ChevronRight, List, Edit, Trash2, ShieldAlert, DollarSign, History, BarChart2, CheckCircle, Trash, QrCode, Banknote } from 'lucide-react';
import { api, BankSettings } from '@/lib/api';
import toast from 'react-hot-toast';
import PricingModal from '@/components/court/PricingModal';
import HistoryModal from '@/components/court/HistoryModal';
import StatsModal from '@/components/court/StatsModal';

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

export default function BookingsShiftPage() {
    const todayStr = new Date(new Date().getTime() + 7*3600*1000).toISOString().split('T')[0];
    const [currentDate, setCurrentDate] = useState(todayStr);
    const [loading, setLoading] = useState(true);
    
    // Data
    const [courts, setCourts] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [blocks, setBlocks] = useState<any[]>([]);
    
    // UI State
    const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
    const [isManageCourts, setIsManageCourts] = useState(false);
    const [showListView, setShowListView] = useState(false); 
    const [selectedShiftIds, setSelectedShiftIds] = useState<number[]>([]);

    // Modals
    const [bookingModal, setBookingModal] = useState<{open: boolean, data: any | null, defaultShift?: any}>({open: false, data: null});
    const [courtModal, setCourtModal] = useState<{open: boolean, data: any | null}>({open: false, data: null});
    const [blockModal, setBlockModal] = useState<{open: boolean, shift?: any}>({open: false});
    // New modals
    const [paymentModal, setPaymentModal] = useState<{open: boolean, data: any | null}>({open: false, data: null});
    const [paymentTab, setPaymentTab] = useState<'cash' | 'qr'>('cash');
    const [pricingModal, setPricingModal] = useState<{open: boolean, court: any | null}>({open: false, court: null});
    const [historyModal, setHistoryModal] = useState<{open: boolean, court: any | null}>({open: false, court: null});
    const [statsModal, setStatsModal] = useState(false);
    const [bankSettings, setBankSettings] = useState<BankSettings | null>(null);
    
    // Forms
    const [bookingForm, setBookingForm] = useState({
        guest_name: '', guest_phone: '', payment_status: 'Unpaid', note: '',
        is_recurring: false, recurring_weeks: 1, start_time: '', end_time: ''
    });

    const [courtForm, setCourtForm] = useState({
        name: '', type: 'Cầu lông', price_per_hour: 100000, deposit_price: 30000
    });

    const [blockForm, setBlockForm] = useState({
        reason: 'Bảo trì sân', start_time:'', end_time:''
    });

    // Auto-reload countdown
    const [countdown, setCountdown] = useState(60);

    useEffect(() => { 
        fetchData();
        setSelectedShiftIds([]);
        api.bank.get().then(b => setBankSettings(b)).catch(() => {});
    }, [currentDate, selectedCourtId]);

    // Auto-reload mỗi 60 giây
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    fetchData();
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [currentDate, selectedCourtId]);


    // Tự động chuyển sang Thanh toán hết nếu là khách vãng lai (không tên, không SĐT)
    useEffect(() => {
        const isGuest = !bookingForm.guest_name.trim() && !bookingForm.guest_phone.trim();
        if (isGuest && bookingForm.payment_status !== 'Fully_Paid') {
            setBookingForm(prev => ({ ...prev, payment_status: 'Fully_Paid' }));
        }
    }, [bookingForm.guest_name, bookingForm.guest_phone]);

    const calculateBookingDetails = () => {
        if (!selectedCourtId || selectedShiftIds.length === 0) return { totalHours: 0, totalPrice: 0, deposit: 0, balance: 0, amountPaid: 0 };
        
        const court = courts.find(c => c.id === selectedCourtId);
        if (!court) return { totalHours: 0, totalPrice: 0, deposit: 0, balance: 0, amountPaid: 0 };

        let totalVal = 0;
        let totalMin = 0;
        
        selectedShiftIds.forEach(id => {
            const shift = SHIFTS.find(s => s.id === id);
            if (shift) {
                // Tìm rule giá cho ca này
                const rule = (court.pricing_rules || []).find((r: any) => r.shift_id === id);
                const pricePerHour = rule?.price_override ?? court.price_per_hour;
                
                const sStr = shift.start.includes(':') ? shift.start : '00:00';
                const eStr = shift.end.includes(':') ? shift.end : '00:00';
                const start = new Date(`${currentDate}T${sStr}:00`);
                const end = eStr === '23:59' ? new Date(`${currentDate}T23:59:59`) : new Date(`${currentDate}T${eStr}:00`);
                
                const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
                totalMin += minutes;
                totalVal += (minutes / 60) * pricePerHour;
            }
        });

        const totalHours = totalMin / 60;
        const totalPrice = totalVal;
        const depositPerShift = court.deposit_price || 0;
        const totalDeposit = depositPerShift * selectedShiftIds.length;

        let amountPaid = 0;
        if (bookingForm.payment_status === 'Deposit') amountPaid = totalDeposit;
        else if (bookingForm.payment_status === 'Fully_Paid') amountPaid = totalPrice;

        const balance = totalPrice - amountPaid;

        return { totalHours, totalPrice, deposit: totalDeposit, balance, amountPaid };
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await api.scheduler.getDaily(currentDate);
            setCourts(data.courts);
            setBookings(data.bookings);
            setBlocks(data.blocks);
            if (data.courts.length > 0 && selectedCourtId === null) setSelectedCourtId(data.courts[0].id);
        } catch (err) { toast.error("Không thể tải Lịch Sân!"); } 
        finally { setLoading(false); }
    };

    const changeDate = (days: number) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + days);
        setCurrentDate(d.toISOString().split('T')[0]);
    };

    const submitBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (bookingModal.data) {
                // Sửa lịch đặt
                await api.bookings.update(bookingModal.data.id, {
                    guest_name: bookingForm.guest_name,
                    guest_phone: bookingForm.guest_phone,
                    payment_status: bookingForm.payment_status,
                    note: bookingForm.note
                });
                toast.success("Cập nhật thông tin thành công!");
            } else {
                // Tạo mới lịch cho từng ca đã chọn
                const promises = selectedShiftIds.map(id => {
                    const shift = SHIFTS.find(s => s.id === id);
                    if (!shift) return Promise.resolve();
                    
                    const startDateTime = `${currentDate}T${shift.start}:00`;
                    let endDateTime = shift.end === '23:59' ? `${currentDate}T23:59:59` : `${currentDate}T${shift.end}:00`;

                    return api.bookings.create({
                        court_id: selectedCourtId,
                        start_time: startDateTime,
                        end_time: endDateTime,
                        user_id: null,
                        guest_name: bookingForm.guest_name,
                        guest_phone: bookingForm.guest_phone,
                        payment_status: bookingForm.payment_status,
                        note: bookingForm.note,
                        is_recurring: bookingForm.is_recurring,
                        recurring_weeks: bookingForm.recurring_weeks
                    });
                });
                
                await Promise.all(promises);
                toast.success(`Đặt sân thành công cho ${selectedShiftIds.length} ca!`);
            }
            setBookingModal({open: false, data: null});
            setSelectedShiftIds([]); 
            fetchData();
        } catch (err: any) { toast.error(err.message || "Lỗi cập nhật lịch"); }
    };

    const submitCourt = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (courtModal.data) await api.courts.update(courtModal.data.id, courtForm);
            else await api.courts.create(courtForm);
            toast.success("Đã lưu thông tin sân thành công!");
            setCourtModal({open: false, data: null});
            fetchData();
        } catch (err: any) { 
            console.error("Court Save Error:", err);
            toast.error(err.message || "Lỗi lưu thông tin sân. Vui lòng kiểm tra lại!"); 
        }
    };

    const submitBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.courts.block(selectedCourtId!, {
                start_time: `${currentDate}T${blockForm.start_time}:00`,
                end_time: `${currentDate}T${blockForm.end_time}:00`,
                reason: blockForm.reason
            });
            toast.success("Thiết lập bảo trì thành công");
            setBlockModal({open: false});
            fetchData();
        } catch (err) { toast.error("Lỗi cài đặt bảo trì"); }
    };

    const unblockCourt = async (blockId: number) => {
        if(!confirm('Xác nhận mở khóa bảo trì ca này?')) return;
        try {
            await api.courts.unblock(blockId);
            toast.success("Khóa sân đã được gỡ!");
            fetchData();
        } catch(err) { toast.error("Mở khóa thất bại!"); }
    };

    const deleteCourt = async (courtId: number) => {
        if(!confirm('CẢNH BÁO: Xóa sân sẽ khiến dữ liệu sân bị ẩn đi. Bạn có chắc chắn?')) return;
        try {
            await api.courts.delete(courtId);
            toast.success("Xóa sân thành công");
            fetchData();
        } catch (err: any) { 
            toast.error(err.message || "Lỗi khi xóa sân. Vui lòng thử lại!"); 
        }
    };

    const deleteBooking = async (id: number) => {
        if(confirm('Xác nhận hủy phiếu đặt sân này?')) {
            try {
                await api.bookings.delete(id);
                setBookingModal({open: false, data: null});
                fetchData();
                toast.success("Đã hủy lịch đặt");
            } catch(e) { toast.error('Lỗi khi hủy lịch'); }
        }
    };

    // Chuẩn bị form sửa lịch cho Modal
    const openEditBooking = (bookingData: any, shift: any) => {
        setBookingForm({
            guest_name: bookingData.guest_name || '',
            guest_phone: bookingData.guest_phone || '',
            payment_status: bookingData.payment_status,
            note: bookingData.note || '',
            is_recurring: false, recurring_weeks: 1, 
            start_time: shift?.start || new Date(bookingData.start_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), 
            end_time: shift?.end || new Date(bookingData.end_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
        });
        setBookingModal({open: true, data: bookingData, defaultShift: shift});
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

    const StatusBadge = ({status}: {status: string}) => {
        if(status==='Fully_Paid') return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded text-xs font-semibold">Đã thanh toán</span>
        if(status==='Deposit') return <span className="bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded text-xs font-semibold">Đã đặt cọc</span>
        return <span className="bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded text-xs font-semibold">Chưa thanh toán</span>
    };

    return (
        <div className="flex flex-col gap-6 relative pb-10 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Quản lý Lịch Nhận Sân</h2>
                    <p className="text-slate-500 mt-1 flex items-center gap-3 text-sm font-medium">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Đã thanh toán 
                        <span className="w-2.5 h-2.5 rounded bg-yellow-500"></span> Đã đặt cọc 
                        <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Chưa thanh toán
                        <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-full text-slate-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${countdown <= 10 ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                            Tự làm mới sau {countdown}s
                        </span>
                    </p>
                </div>

                {!isManageCourts ? (
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
                        <button onClick={() => changeDate(-1)} className="p-2 text-slate-600 hover:text-slate-900 transition-colors"><ChevronLeft size={18} /></button>
                        <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 mx-2 focus:outline-none focus:ring-0 cursor-pointer" />
                        <button onClick={() => changeDate(1)} className="p-2 text-slate-600 hover:text-slate-900 transition-colors"><ChevronRight size={18} /></button>
                        <Button onClick={() => setShowListView(true)} variant="outline" className="px-3 bg-white ml-2 gap-2 text-indigo-700 border-slate-200 hover:bg-slate-50"><List size={15}/> Xem Chi Tiết</Button>
                    </div>
                ) : (
                    <Button onClick={() => { setCourtForm({name: '', type: 'Cầu lông', price_per_hour: 100000, deposit_price: 30000}); setCourtModal({open: true, data: null}); }} className="gap-2 px-4 shadow-sm">
                        <Plus size={16}/> Thêm Sân Mới
                    </Button>
                )}
            </div>

            <div className="flex bg-white shadow-sm border border-slate-200 p-1 rounded-lg w-max">
                <button onClick={() => setIsManageCourts(false)} className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all ${!isManageCourts ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Hệ Thống Lưới Ca</button>
                <button onClick={() => setIsManageCourts(true)} className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all ${isManageCourts ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Danh Sách Sân Bãi</button>
            </div>

            {/* Quản lý danh sách sân */}
            {isManageCourts ? (
                <Card className="bg-white shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-end">
                        <Button onClick={() => setStatsModal(true)} variant="outline" className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                            <BarChart2 size={16}/> Thống Kê Khung Giờ
                        </Button>
                    </div>
                    <table className="w-full text-left border-collapse min-w-full">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[13px] font-semibold uppercase border-b border-slate-200">
                                <th className="p-4">Tên Sân</th>
                                <th className="p-4">Loại Sân</th>
                                <th className="p-4 text-right">Phí / Giờ</th>
                                <th className="p-4 text-right">Tiền Cọc</th>
                                <th className="p-4 text-center">Tùy Chọn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {courts.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{c.name}</td>
                                    <td className="p-4 text-slate-600">{c.type}</td>
                                    <td className="p-4 text-right font-semibold text-slate-800">{c.price_per_hour.toLocaleString()}đ</td>
                                    <td className="p-4 text-right font-semibold text-slate-800">{c.deposit_price?.toLocaleString() || 0}đ</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button title="Cài giá theo ca" onClick={() => setPricingModal({open: true, court: c})} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"><DollarSign size={16}/></button>
                                        <button title="Lịch sử đặt" onClick={() => setHistoryModal({open: true, court: c})} className="p-2 text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors"><History size={16}/></button>
                                        <button title="Sửa sân" onClick={() => { setCourtForm({name: c.name, type: c.type, price_per_hour: c.price_per_hour, deposit_price: c.deposit_price || 0}); setCourtModal({open: true, data: c}); }} className="p-2 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"><Edit size={16}/></button>
                                        <button title="Xóa sân" onClick={() => deleteCourt(c.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                            {courts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Chưa có sân nào. Vui lòng thêm sân mới.</td></tr>}
                        </tbody>
                    </table>
                </Card>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {courts.map(c => (
                            <button key={c.id} onClick={() => setSelectedCourtId(c.id)} className={`px-6 py-3 rounded-lg font-bold border transition-all whitespace-nowrap min-w-[120px] ${selectedCourtId === c.id ? 'border-none bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                {c.name}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                        {selectedCourtId ? SHIFTS.map(shift => {
                            const status = getShiftStatus(shift);
                            let boxClass = "border border-slate-200 bg-white hover:border-indigo-300 cursor-pointer shadow-sm relative transition-all group overflow-hidden";
                            
                            if (status.type === 'booked') {
                                const p = status.data.payment_status;
                                let pColor = 'bg-rose-500';
                                if(p === 'Fully_Paid') pColor = 'bg-emerald-500';
                                if(p === 'Deposit') pColor = 'bg-yellow-500';
                                
                                boxClass = `border border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer cursor-pointer`;
                                
                                return (
                                    <div 
                                        key={shift.id} 
                                        className={`rounded-xl p-4 min-h-[140px] flex flex-col justify-between ${boxClass}`}
                                        title={status.data.payment_status !== 'Fully_Paid' ? 'Click để xác nhận thanh toán / Nhấp đúp để sửa chi tiết' : 'Nhấp đúp để sửa chi tiết'}
                                        onClick={() => {
                                            // Single click: mở PaymentModal cho chưa thanh toán/đặt cọc
                                            if (status.data.payment_status !== 'Fully_Paid') {
                                                setPaymentModal({open: true, data: status.data});
                                            }
                                        }}
                                        onDoubleClick={() => openEditBooking(status.data, shift)}
                                    >
                                        <div className={`absolute top-0 left-0 w-1 h-full ${pColor}`}></div>
                                        <div className="flex justify-between items-start w-full ml-1">
                                            <span className="font-bold text-slate-800 text-[15px]">{shift.start} - {shift.end}</span>
                                            <StatusBadge status={status.data.payment_status}/>
                                        </div>
                                        <div className="flex flex-col mt-3 gap-1.5 ml-1">
                                            <div className="font-bold text-slate-900 text-base">{status.data.guest_name || "Khách Vãng Lai"}</div>
                                            {status.data.guest_phone && <div className="text-sm text-slate-500">{status.data.guest_phone}</div>}
                                            {status.data.note && <div className="text-[13px] text-slate-600 mt-1 line-clamp-2 bg-white px-2 py-1 rounded border border-slate-100">{status.data.note}</div>}
                                        </div>
                                    </div>
                                );
                            } else if (status.type === 'block') {
                                return (
                                    <div key={shift.id} className="rounded-xl p-4 min-h-[140px] border border-slate-200 bg-slate-100 opacity-90 flex flex-col justify-between">
                                        <div className="font-bold text-slate-600 text-[15px]">{shift.start} - {shift.end}</div>
                                        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-500 mt-2">
                                            <div className="flex items-center gap-1 font-semibold text-sm"><ShieldAlert size={16}/> Bảo Trì</div>
                                            <div className="text-xs text-center line-clamp-2 px-2">{status.data.reason}</div>
                                        </div>
                                        <Button onClick={() => unblockCourt(status.data.id)} variant="outline" className="w-full mt-2 bg-white hover:bg-slate-50 text-slate-700 h-8 text-xs font-semibold">
                                            Mở Khóa Lại
                                        </Button>
                                    </div>
                                );
                            } else {
                                const isSelected = selectedShiftIds.includes(shift.id);
                                return (
                                    <div 
                                        key={shift.id} 
                                        className={`rounded-xl p-4 min-h-[140px] flex flex-col justify-between border-2 transition-all group ${
                                            isSelected 
                                            ? 'border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md scale-[1.02]' 
                                            : 'border-slate-200 border-dashed bg-white hover:bg-slate-50'
                                        } cursor-pointer`}
                                        onClick={() => {
                                            if (currentDate < todayStr) {
                                                toast.error("Không thể thao tác đặt sân cho ngày đã qua!");
                                                return;
                                            }
                                            setSelectedShiftIds(prev => 
                                                prev.includes(shift.id) ? prev.filter(id => id !== shift.id) : [...prev, shift.id]
                                            );
                                        }}
                                        onDoubleClick={() => {
                                            if (currentDate < todayStr) return;
                                            const newSelection = isSelected ? selectedShiftIds : [...selectedShiftIds, shift.id];
                                            if (!isSelected) setSelectedShiftIds(newSelection);
                                            setBookingForm({...bookingForm, guest_name: '', guest_phone: '', note: '', payment_status: 'Unpaid', is_recurring: false});
                                            setBookingModal({open: true, data: null, defaultShift: shift});
                                        }}
                                    >
                                        <div className="flex justify-between items-start w-full">
                                            <span className={`font-bold text-[15px] ${isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                                {shift.start} - {shift.end}
                                            </span>
                                            {!isSelected && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setBlockForm({...blockForm, start_time: shift.start, end_time: shift.end}); setBlockModal({open: true, shift}); }}
                                                    className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-200 rounded transition-colors" title="Bảo Trì"
                                                ><Ban size={15} /></button>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-center flex-1 my-2 flex-col">
                                            {isSelected ? (
                                                <span className="text-emerald-600 font-bold text-xs uppercase tracking-tight bg-emerald-100 px-2 py-1 rounded">Đang chọn</span>
                                            ) : (
                                                <>
                                                    <Plus size={24} className="mb-1 text-slate-300 group-hover:text-slate-400" />
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 group-hover:text-slate-400">Đặt Ca Mới</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        }) : (
                            <div className="col-span-full p-10 text-center">
                                <div className="text-slate-500 font-medium">Vui lòng chọn Sân ở phía trên để xem lịch.</div>
                            </div>
                        )}
                    </div>
                    {selectedShiftIds.length > 0 && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <Button 
                                onClick={() => {
                                    setBookingForm({...bookingForm, guest_name: '', guest_phone: '', note: '', payment_status: 'Unpaid', is_recurring: false});
                                    setBookingModal({open: true, data: null});
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-full shadow-2xl flex items-center gap-3 font-bold text-lg border-4 border-white"
                            >
                                <Plus size={24}/> Tiếp tục đặt {selectedShiftIds.length} ca đã chọn
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* FULL LIST VIEW MODAL */}
            {showListView && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <Card className="w-full max-w-5xl shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85vh] rounded-xl border border-slate-200 bg-slate-50">
                        <div className="bg-white p-5 flex justify-between border-b border-slate-200 items-center shrink-0">
                            <h3 className="font-bold text-lg text-slate-800">Danh Sách Lịch Đặt (Ngày {currentDate})</h3>
                            <button onClick={()=>setShowListView(false)} className="p-2 rounded hover:bg-slate-100 text-slate-500"><X size={18}/></button>
                        </div>
                        <div className="overflow-auto flex-1 p-5">
                            {bookings.length === 0 ? <div className="p-10 text-center font-medium text-slate-500 bg-white rounded-lg border border-slate-200">Không có lịch đặt nào trong ngày hôm nay.</div> : (
                                <table className="w-full text-left bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden text-sm">
                                    <thead className="bg-slate-50">
                                        <tr className="border-b border-slate-200">
                                            <th className="p-4 font-semibold text-slate-600">Thời Gian</th>
                                            <th className="p-4 font-semibold text-slate-600">Sân</th>
                                            <th className="p-4 font-semibold text-slate-600">Khách Hàng</th>
                                            <th className="p-4 font-semibold text-slate-600">Thanh Toán</th>
                                            <th className="p-4 font-semibold text-slate-600">Thông Tin Khác</th>
                                            <th className="p-4 font-semibold text-slate-600 text-center">Tùy Chọn</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {bookings.map(b => (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-semibold text-slate-700">{new Date(b.start_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} - {new Date(b.end_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                                                <td className="p-4 font-semibold text-slate-800">{courts.find(c=>c.id===b.court_id)?.name}</td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-slate-800">{b.guest_name||'---'}</div>
                                                    {b.guest_phone && <div className="text-xs text-slate-500 mt-1">{b.guest_phone}</div>}
                                                </td>
                                                <td className="p-4"><StatusBadge status={b.payment_status}/></td>
                                                <td className="p-4 text-slate-600 text-sm max-w-[200px] truncate" title={b.note}>{b.note}</td>
                                                <td className="p-4 flex gap-2 justify-center">
                                                    <button onClick={() => {
                                                        const shift = {start: new Date(b.start_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), end: new Date(b.end_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
                                                        openEditBooking(b, shift);
                                                        setShowListView(false);
                                                    }} className="p-2 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors" title="Sửa Lịch Đặt"><Edit size={16}/></button>
                                                    <button onClick={() => deleteBooking(b.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors" title="Xóa Lịch Đặt"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* CREATE / EDIT BOOKING MODAL */}
            {bookingModal.open && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <Card className="w-full max-w-md shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh] rounded-xl border border-slate-200">
                        <div className="bg-white text-slate-800 p-5 flex justify-between border-b border-slate-200 items-center">
                            <h3 className="font-bold text-lg">{bookingModal.data ? 'Chỉnh Sửa Lịch Đặt' : `Thêm Lịch Đặt Mới`}</h3>
                            <button onClick={()=>setBookingModal({open: false, data: null})} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                        </div>
                        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
                            <form onSubmit={submitBooking} className="flex flex-col gap-4">
                                <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col gap-3 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-slate-500 text-sm">Sân</div>
                                        <div className="font-bold text-slate-800">{courts.find(c => c.id === selectedCourtId)?.name}</div>
                                    </div>
                                    <div className="flex justify-between items-start pt-2 border-t border-slate-100">
                                        <div className="font-semibold text-slate-500 text-sm">Số ca đã chọn</div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                            {bookingModal.data ? (
                                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{bookingModal.defaultShift?.start} - {bookingModal.defaultShift?.end}</span>
                                            ) : selectedShiftIds.sort((a,b)=>a-b).map(id => {
                                                const s = SHIFTS.find(x => x.id === id);
                                                return <span key={id} className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{s?.start}</span>
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {!bookingModal.data && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col gap-2 shadow-sm text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-emerald-700 font-medium">Tổng thời gian:</span>
                                            <span className="text-emerald-800 font-bold">{calculateBookingDetails().totalHours.toFixed(1)} giờ ({selectedShiftIds.length} ca)</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-emerald-700 font-medium">Tổng tiền sân:</span>
                                            <span className="text-emerald-800 font-bold">{calculateBookingDetails().totalPrice.toLocaleString()}đ</span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t border-emerald-100">
                                            <span className="text-emerald-700 font-medium whitespace-nowrap">Đã thu ({bookingForm.payment_status}):</span>
                                            <span className="text-emerald-700 font-bold">+{(calculateBookingDetails().amountPaid ?? 0).toLocaleString()}đ</span>
                                        </div>
                                        <div className="flex justify-between pt-1 border-t-2 border-emerald-200 mt-1 uppercase">
                                            <span className="text-emerald-900 font-black">Còn lại (Cần thu):</span>
                                            <span className="text-emerald-900 font-black text-lg">{calculateBookingDetails().balance.toLocaleString()}đ</span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4">
                                    <div className="font-semibold text-sm text-slate-700">Thông Tin Khách Hàng</div>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <input value={bookingForm.guest_name} onChange={e=>setBookingForm({...bookingForm, guest_name: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm transition-colors focus:outline-none" placeholder="Tên Khách Hàng"/>
                                        </div>
                                        <div className="flex-[0.8]">
                                            <input type="tel" value={bookingForm.guest_phone} onChange={e=>setBookingForm({...bookingForm, guest_phone: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm transition-colors focus:outline-none" placeholder="Số Điện Thoại"/>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-4">
                                    <div className="font-semibold text-sm text-slate-700">Thanh Toán & Ghi Chú</div>
                                    <select value={bookingForm.payment_status} onChange={e=>setBookingForm({...bookingForm, payment_status: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm bg-white cursor-pointer transition-colors focus:outline-none">
                                        {!(!bookingForm.guest_name.trim() && !bookingForm.guest_phone.trim()) && (
                                            <>
                                                <option value="Unpaid">Chưa Thanh Toán (Ghi nợ)</option>
                                                <option value="Deposit">Đã Đặt Cọc (Giữ chỗ)</option>
                                            </>
                                        )}
                                        <option value="Fully_Paid">Đã Thanh Toán (Hết)</option>
                                    </select>
                                    <textarea value={bookingForm.note} onChange={e=>setBookingForm({...bookingForm, note: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md text-sm bg-white transition-colors resize-none h-20 focus:outline-none" placeholder="Ghi chú thêm..."></textarea>
                                </div>

                                {!bookingModal.data && (
                                    <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 shadow-sm rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input type="checkbox" checked={bookingForm.is_recurring} onChange={e=>setBookingForm({...bookingForm, is_recurring: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"/>
                                        <span className="font-semibold text-slate-700 text-sm">Lặp lại lịch cố định hàng tuần</span>
                                    </label>
                                )}

                                {bookingForm.is_recurring && !bookingModal.data && (
                                    <div className="flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-lg shadow-sm">
                                        <span className="font-semibold text-sm text-slate-700">Số tuần tiếp theo:</span>
                                        <input type="number" value={bookingForm.recurring_weeks} onChange={e=>setBookingForm({...bookingForm, recurring_weeks: Number(e.target.value)})} className="w-20 text-center border border-slate-200 p-2 rounded-md font-bold text-slate-800 focus:outline-none focus:border-indigo-400" min="1" max="52"/>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-2">
                                    <Button type="button" variant="ghost" onClick={() => setBookingModal({open: false, data: null})} className="font-semibold text-slate-600 flex-1 hover:bg-slate-200 border border-transparent">Hủy Bỏ</Button>
                                    {bookingModal.data && (
                                         <Button type="button" onClick={() => deleteBooking(bookingModal.data.id)} className="flex-[0.5] font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-sm">
                                            Xóa Lịch
                                        </Button>
                                    )}
                                    <Button type="submit" className="flex-1 font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all focus:ring-2 focus:ring-slate-400 focus:ring-offset-1">
                                        {bookingModal.data ? 'Lưu Thông Tin' : 'Xác Nhận Đặt Sân'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* COURT MANAGE MODAL */}
            {courtModal.open && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <Card className="w-full max-w-sm shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200">
                        <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">{courtModal.data ? 'Chỉnh Sửa Sân' : 'Thêm Sân Mới'}</h3>
                            <button onClick={() => setCourtModal({open: false, data: null})} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                        </div>
                        <form onSubmit={submitCourt} className="flex flex-col gap-5 p-6 bg-slate-50">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tên Sân / Ký Hiệu</label>
                                <input value={courtForm.name} onChange={e=>setCourtForm({...courtForm, name: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md font-medium text-slate-800 shadow-sm focus:outline-none" required/>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Loại Sân Thể Thao</label>
                                <select value={courtForm.type} onChange={e=>setCourtForm({...courtForm, type: e.target.value})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md font-medium text-slate-800 shadow-sm focus:outline-none bg-white">
                                    <option value="Cầu lông">Cầu lông</option>
                                    <option value="Bóng đá">Bóng đá</option>
                                    <option value="Tennis">Tennis</option>
                                    <option value="Pickleball">Pickleball</option>
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Giá Thuê / Giờ</label>
                                    <input type="number" value={courtForm.price_per_hour} onChange={e=>setCourtForm({...courtForm, price_per_hour: Number(e.target.value)})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md font-semibold text-slate-800 shadow-sm focus:outline-none" required/>
                                </div>
                                <div className="flex-[0.8]">
                                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Mức Đặt Cọc</label>
                                    <input type="number" value={courtForm.deposit_price} onChange={e=>setCourtForm({...courtForm, deposit_price: Number(e.target.value)})} className="w-full border border-slate-200 focus:border-indigo-400 p-2.5 rounded-md font-semibold text-slate-800 shadow-sm focus:outline-none" required/>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <Button type="button" variant="ghost" onClick={() => setCourtModal({open: false, data: null})} className="font-semibold text-slate-600 flex-[0.8] hover:bg-slate-200 border border-transparent">Hủy Bỏ</Button>
                                <Button type="submit" className="font-semibold bg-slate-800 hover:bg-slate-900 text-white flex-1 shadow-sm transition-all focus:ring-2 focus:ring-slate-400 focus:ring-offset-1">Lưu Thông Tin</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {blockModal.open && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <Card className="w-full max-w-sm shadow-xl p-0 overflow-hidden rounded-xl border border-slate-200">
                        <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ShieldAlert size={20} className="text-orange-500"/> Khóa Bảo Trì Sân</h3>
                            <button onClick={() => setBlockModal({open: false})} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                        </div>
                        <form onSubmit={submitBlock} className="flex flex-col gap-5 p-6 bg-slate-50">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Lý Do Đóng Ca Này</label>
                                <input value={blockForm.reason} onChange={e=>setBlockForm({...blockForm, reason: e.target.value})} className="w-full border border-slate-200 focus:border-orange-500 p-2.5 rounded-md font-medium text-slate-800 shadow-sm focus:outline-none" placeholder="Vd: Sửa đèn, lau sàn..." required/>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <Button type="button" variant="ghost" onClick={() => setBlockModal({open: false})} className="font-semibold text-slate-600 flex-[0.8] hover:bg-slate-200 border border-transparent">Hủy Lệnh</Button>
                                <Button type="submit" className="font-semibold bg-orange-600 hover:bg-orange-700 text-white flex-1 shadow-sm transition-all focus:ring-2 focus:ring-orange-400 focus:ring-offset-1">Xác Nhận Khóa Ca</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
            
            {/* PAYMENT CONFIRMATION MODAL */}
            {paymentModal.open && paymentModal.data && (() => {
                const b = paymentModal.data;
                const court = courts.find(c => c.id === b.court_id);

                // Tìm các ca cùng khách chưa thanh toán để gộp
                const related = bookings.filter(x =>
                    x.guest_name === b.guest_name &&
                    (b.guest_phone ? x.guest_phone === b.guest_phone : true) &&
                    x.payment_status !== 'Fully_Paid'
                );

                const totalGroupPrice = related.reduce((sum, item) => {
                    const c = courts.find(ct => ct.id === item.court_id);
                    const h = (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / (1000 * 3600);
                    return sum + (h * (c?.price_per_hour || 0));
                }, 0);

                const totalGroupDeposit = related.reduce((sum, item) => {
                    const c = courts.find(ct => ct.id === item.court_id);
                    return sum + (item.payment_status === 'Deposit' ? (c?.deposit_price || 0) : 0);
                }, 0);

                const groupRemaining = Math.max(0, totalGroupPrice - totalGroupDeposit);

                // Build QR URL
                const orderRef = `SAN-${b.id}-${Date.now().toString().slice(-4)}`;
                const qrNote = `${orderRef} ${b.guest_name || 'Khach vang lai'} ${court?.name || ''}`.slice(0, 50);
                const qrUrl = bankSettings
                    ? `https://img.vietqr.io/image/${bankSettings.bank_code}-${bankSettings.account_number}-compact2.png?amount=${Math.round(groupRemaining)}&addInfo=${encodeURIComponent(qrNote)}&accountName=${encodeURIComponent(bankSettings.account_name)}`
                    : null;

                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                        <Card className="w-full max-w-md shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200">
                            <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CheckCircle size={20} className="text-emerald-500"/> Xác Nhận Thanh Toán</h3>
                                <button onClick={() => { setPaymentModal({open: false, data: null}); setPaymentTab('cash'); }} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                            </div>

                            <div className="p-5 bg-slate-50 flex flex-col gap-4">
                                {/* Customer info */}
                                <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-1.5 text-sm shadow-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Khách hàng</span><span className="font-bold text-slate-800">{b.guest_name || 'Khách Vãng Lai'}</span></div>
                                    {b.guest_phone && <div className="flex justify-between"><span className="text-slate-500">Số điện thoại</span><span className="font-semibold">{b.guest_phone}</span></div>}
                                    <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span className="text-slate-500">Sân</span><span className="font-semibold text-slate-700">{court?.name}</span></div>
                                </div>

                                {/* Amount breakdown */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col gap-2">
                                    <div className="flex justify-between text-xs uppercase tracking-wider text-emerald-600 font-bold">
                                        <span>Chi tiết ({related.length} ca)</span>
                                    </div>
                                    <div className="space-y-1">
                                        {related.map(r => (
                                            <div key={r.id} className="flex justify-between text-[11px] text-emerald-800/70 italic">
                                                <span>Ca {new Date(r.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                                <span>{((new Date(r.end_time).getTime() - new Date(r.start_time).getTime())/(1000*3600) * (courts.find(ct=>ct.id===r.court_id)?.price_per_hour||0)).toLocaleString()}đ</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-emerald-100"><span className="text-emerald-700 font-medium">Tổng:</span><span className="font-bold text-emerald-800">{totalGroupPrice.toLocaleString()}đ</span></div>
                                    {totalGroupDeposit > 0 && <div className="flex justify-between"><span className="text-emerald-700 font-medium">Đã cọc:</span><span className="font-semibold text-emerald-700">- {totalGroupDeposit.toLocaleString()}đ</span></div>}
                                    <div className="flex justify-between pt-2 border-t-2 border-emerald-300">
                                        <span className="font-black text-emerald-900 uppercase text-sm">Cần Thu</span>
                                        <span className="font-black text-emerald-900 text-2xl">{groupRemaining.toLocaleString()}đ</span>
                                    </div>
                                </div>

                                {/* Payment method tabs */}
                                <div>
                                    <div className="flex bg-slate-200/50 p-1 rounded-lg mb-3">
                                        <button
                                            onClick={() => setPaymentTab('cash')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${paymentTab === 'cash' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <Banknote size={16}/> Tiền Mặt
                                        </button>
                                        <button
                                            onClick={() => setPaymentTab('qr')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${paymentTab === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <QrCode size={16}/> VietQR
                                        </button>
                                    </div>

                                    {paymentTab === 'cash' ? (
                                        <div className="text-center py-3 text-slate-500 text-sm bg-white rounded-lg border border-slate-200">
                                            ✅ Thu đủ <strong className="text-slate-800">{groupRemaining.toLocaleString()}đ</strong> tiền mặt rồi xác nhận.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-3 bg-white rounded-lg border border-slate-200">
                                            {qrUrl ? (
                                                <>
                                                    <img src={qrUrl} alt="VietQR" className="w-40 h-40 object-contain border border-slate-200 rounded-lg bg-white p-1"/>
                                                    <div className="text-center text-xs text-slate-500 space-y-0.5">
                                                        <div className="font-bold text-slate-700">{bankSettings?.bank_name} — {bankSettings?.account_number}</div>
                                                        <div>{bankSettings?.account_name}</div>
                                                        <div className="text-emerald-600 font-semibold text-sm">{groupRemaining.toLocaleString()}đ</div>
                                                        <div className="text-slate-400 text-[10px]">Nội dung: {qrNote}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-amber-600 text-sm font-semibold p-4 bg-amber-50 rounded-lg text-center">
                                                    ⚠️ Chưa cài tài khoản ngân hàng.<br/>
                                                    <span className="text-xs font-normal">Vào <strong>Thiết Lập Hệ Thống</strong> để cài đặt.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={() => { setPaymentModal({open: false, data: null}); setPaymentTab('cash'); }} className="font-semibold text-slate-600 flex-1 hover:bg-slate-200 border border-slate-300">Đóng</Button>
                                    <Button type="button" onClick={async () => {
                                        try {
                                            const related2 = bookings.filter(x =>
                                                x.guest_name === b.guest_name &&
                                                (b.guest_phone ? x.guest_phone === b.guest_phone : true) &&
                                                x.payment_status !== 'Fully_Paid'
                                            );
                                            await Promise.all(related2.map(item => api.bookings.update(item.id, { payment_status: 'Fully_Paid' })));
                                            toast.success(`Đã thu tiền gộp cho ${related2.length} ca!`);
                                            setPaymentModal({open: false, data: null});
                                            setPaymentTab('cash');
                                            fetchData();
                                        } catch { toast.error('Lỗi xác nhận thanh toán gộp'); }
                                    }} className="flex-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg gap-2 h-12">
                                        <CheckCircle size={18}/> Xác Nhận Đã Thu
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}
            {/* PRICING MODAL */}
            {pricingModal.open && pricingModal.court && (
                <PricingModal court={pricingModal.court} onClose={() => setPricingModal({open: false, court: null})} />
            )}

            {/* HISTORY MODAL */}
            {historyModal.open && historyModal.court && (
                <HistoryModal court={historyModal.court} onClose={() => setHistoryModal({open: false, court: null})} />
            )}

            {/* STATS MODAL */}
            {statsModal && (
                <StatsModal courts={courts} onClose={() => setStatsModal(false)} />
            )}
        </div>
    );
}
