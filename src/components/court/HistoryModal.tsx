'use client';
import React, { useState, useEffect } from 'react';
import { X, History, Trash2, Trash } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
    court: any;
    onClose: () => void;
}

type FilterMode = 'all' | 'day' | 'range';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    Fully_Paid: { label: 'Đã TT', cls: 'bg-emerald-100 text-emerald-700' },
    Deposit: { label: 'Đặt cọc', cls: 'bg-yellow-100 text-yellow-700' },
    Unpaid: { label: 'Chưa TT', cls: 'bg-rose-100 text-rose-700' },
};

export default function HistoryModal({ court, onClose }: Props) {
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [singleDate, setSingleDate] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchHistory(); }, [filterMode, singleDate, dateFrom, dateTo]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params: any = { court_id: court.id };
            if (filterMode === 'day' && singleDate) {
                params.date_from = singleDate;
                params.date_to = singleDate;
            } else if (filterMode === 'range') {
                if (dateFrom) params.date_from = dateFrom;
                if (dateTo) params.date_to = dateTo;
            }
            const data = await api.bookings.getHistory(params);
            setRows(data);
        } catch { toast.error('Không thể tải lịch sử'); }
        finally { setLoading(false); }
    };

    const deleteOne = async (id: number) => {
        if (!confirm('Xóa lịch sử này khỏi database?')) return;
        try {
            await api.bookings.hardDelete(id);
            setRows(prev => prev.filter(r => r.id !== id));
            toast.success('Đã xóa');
        } catch { toast.error('Lỗi xóa'); }
    };

    const deleteAll = async () => {
        if (!confirm(`Xóa TOÀN BỘ ${rows.length} bản ghi lịch sử đang hiển thị? Không thể hoàn tác!`)) return;
        try {
            const params: any = { court_id: court.id };
            if (filterMode === 'day' && singleDate) { params.date_from = singleDate; params.date_to = singleDate; }
            else if (filterMode === 'range') { if (dateFrom) params.date_from = dateFrom; if (dateTo) params.date_to = dateTo; }
            await api.bookings.hardDeleteAll(params);
            setRows([]);
            toast.success('Đã xóa toàn bộ lịch sử');
        } catch { toast.error('Lỗi xóa toàn bộ'); }
    };

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusInfo = (s: any) => {
        const key = String(s).replace('PaymentStatus.', '');
        return STATUS_LABEL[key] || { label: key, cls: 'bg-slate-100 text-slate-600' };
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <Card className="w-full max-w-4xl shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <History size={20} className="text-sky-500"/> Lịch Sử Đặt — {court.name}
                        <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{rows.length} lịch sử</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                </div>

                {/* Filters */}
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5">
                        {(['all', 'day', 'range'] as FilterMode[]).map(m => (
                            <button key={m} onClick={() => setFilterMode(m)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${filterMode === m ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                {m === 'all' ? 'Tất cả' : m === 'day' ? 'Theo ngày' : 'Khoảng ngày'}
                            </button>
                        ))}
                    </div>
                    {filterMode === 'day' && (
                        <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)}
                            className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"/>
                    )}
                    {filterMode === 'range' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"/>
                            <span className="text-slate-400 text-sm">→</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"/>
                        </div>
                    )}
                    {rows.length > 0 && (
                        <button onClick={deleteAll}
                            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors">
                            <Trash size={13}/> Xóa Tất Cả ({rows.length})
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-auto flex-1">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Đang tải...</div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-medium">Không có dữ liệu lịch sử.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Ngày</th>
                                    <th className="px-4 py-3">Ca Giờ</th>
                                    <th className="px-4 py-3">Khách Hàng</th>
                                    <th className="px-4 py-3">SĐT</th>
                                    <th className="px-4 py-3">Thanh Toán</th>
                                    <th className="px-4 py-3">Ghi Chú</th>
                                    <th className="px-4 py-3 text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map(r => {
                                    const si = statusInfo(r.payment_status);
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-slate-700">{fmtDate(r.start_time)}</td>
                                            <td className="px-4 py-3 text-slate-600">{fmtTime(r.start_time)} – {fmtTime(r.end_time)}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{r.guest_name || '—'}</td>
                                            <td className="px-4 py-3 text-slate-500">{r.guest_phone || '—'}</td>
                                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${si.cls}`}>{si.label}</span></td>
                                            <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={r.note}>{r.note || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => deleteOne(r.id)} className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded transition-colors">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
