'use client';
import React, { useState, useEffect } from 'react';
import { X, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
    courts: any[];
    onClose: () => void;
}

export default function StatsModal({ courts, onClose }: Props) {
    const today = new Date();
    const [period, setPeriod] = useState<'month' | 'year'>('month');
    const [monthVal, setMonthVal] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    const [yearVal, setYearVal] = useState(String(today.getFullYear()));
    const [courtId, setCourtId] = useState<number | undefined>(undefined);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchStats(); }, [period, monthVal, yearVal, courtId]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const value = period === 'month' ? monthVal : yearVal;
            const res = await api.stats.byShift({ period, value, court_id: courtId });
            setData(res);
        } catch { toast.error('Không thể tải thống kê'); }
        finally { setLoading(false); }
    };

    const maxCount = data ? Math.max(...data.stats.map((s: any) => s.count), 1) : 1;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <Card className="w-full max-w-3xl shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <BarChart2 size={20} className="text-indigo-500"/> Thống Kê Khung Giờ Đặt Sân
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                </div>

                {/* Controls */}
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5">
                        {(['month', 'year'] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${period === p ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                {p === 'month' ? 'Theo Tháng' : 'Theo Năm'}
                            </button>
                        ))}
                    </div>
                    {period === 'month' ? (
                        <input type="month" value={monthVal} onChange={e => setMonthVal(e.target.value)}
                            className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"/>
                    ) : (
                        <input type="number" value={yearVal} onChange={e => setYearVal(e.target.value)}
                            min={2020} max={2050} className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 w-24 focus:outline-none focus:border-indigo-400"/>
                    )}
                    <select value={courtId ?? ''} onChange={e => setCourtId(e.target.value ? Number(e.target.value) : undefined)}
                        className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-indigo-400">
                        <option value="">Tất cả sân</option>
                        {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {data && (
                        <span className="text-xs text-slate-400 ml-auto">Tổng: <span className="font-bold text-slate-700">{data.total_bookings} lịch đặt</span></span>
                    )}
                </div>

                {/* Chart */}
                <div className="overflow-y-auto flex-1 p-5">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Đang tải...</div>
                    ) : !data ? null : (
                        <div className="flex flex-col gap-2">
                            {/* Summary badges */}
                            <div className="flex gap-3 mb-3 flex-wrap">
                                {data.stats.filter((s: any) => s.is_peak).map((s: any) => (
                                    <div key={s.shift_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
                                        <TrendingUp size={13}/> Ca đông nhất: {s.shift_label} ({s.count} lượt)
                                    </div>
                                ))}
                                {data.stats.filter((s: any) => s.is_low).map((s: any) => (
                                    <div key={s.shift_id} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-700">
                                        <TrendingDown size={13}/> Ca ít nhất: {s.shift_label} ({s.count} lượt)
                                    </div>
                                ))}
                                {data.total_bookings === 0 && (
                                    <div className="text-slate-400 text-sm">Không có dữ liệu trong khoảng thời gian này.</div>
                                )}
                            </div>

                            {data.stats.map((s: any) => {
                                const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                                const barColor = s.is_peak ? 'bg-rose-500' : s.is_low ? 'bg-sky-400' : s.count === 0 ? 'bg-slate-200' : 'bg-indigo-400';
                                const rowBg = s.is_peak ? 'border-rose-200 bg-rose-50/30' : s.is_low ? 'border-sky-200 bg-sky-50/30' : 'border-slate-100 bg-white';
                                return (
                                    <div key={s.shift_id} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${rowBg}`}>
                                        <span className="text-xs font-bold text-slate-400 w-5 shrink-0">C{s.shift_id}</span>
                                        <span className="text-xs font-semibold text-slate-600 w-[110px] shrink-0">{s.shift_label}</span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }}/>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 w-8 text-right shrink-0">{s.count}</span>
                                        <div className="flex gap-1 shrink-0 w-[110px] justify-end">
                                            {s.paid > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">{s.paid} TT</span>}
                                            {s.deposit > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-semibold">{s.deposit} cọc</span>}
                                            {s.unpaid > 0 && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold">{s.unpaid} nợ</span>}
                                        </div>
                                    </div>
                                );
                            })}

                            {data.total_bookings > 0 && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                    💡 <strong>Gợi ý:</strong> Ca đông nhất nên set tier <strong>Cao điểm</strong> để tối ưu doanh thu. Ca ít khách nên set tier <strong>Ít khách</strong> để thu hút thêm lượt đặt.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
