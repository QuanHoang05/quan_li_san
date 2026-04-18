'use client';
import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

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
    { id: 12, start: '22:30', end: '23:59' },
];

const TIERS = [
    { value: 'low', label: 'Ít khách', color: 'text-sky-600 bg-sky-50 border-sky-200' },
    { value: 'normal', label: 'Trung bình', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 'peak', label: 'Cao điểm', color: 'text-rose-600 bg-rose-50 border-rose-200' },
];

interface Props {
    court: any;
    onClose: () => void;
}

export default function PricingModal({ court, onClose }: Props) {
    // rules[shiftId] = { tier, price_override }
    const [rules, setRules] = useState<Record<number, { tier: string; price_override: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);

    useEffect(() => {
        loadPricing();
    }, [court.id]);

    const loadPricing = async () => {
        setLoading(true);
        try {
            const data = await api.courts.getPricing(court.id);
            const map: Record<number, { tier: string; price_override: string }> = {};
            data.forEach((r: any) => {
                map[r.shift_id] = { tier: r.tier, price_override: r.price_override != null ? String(r.price_override) : '' };
            });
            setRules(map);
        } catch { toast.error('Không thể tải cài đặt giá'); }
        finally { setLoading(false); }
    };

    const getRule = (shiftId: number) => rules[shiftId] || { tier: 'normal', price_override: '' };

    const updateLocal = (shiftId: number, field: 'tier' | 'price_override', val: string) => {
        setRules(prev => ({ ...prev, [shiftId]: { ...getRule(shiftId), [field]: val } }));
    };

    const saveShift = async (shiftId: number) => {
        setSaving(shiftId);
        try {
            const r = getRule(shiftId);
            const price = r.price_override === '' ? null : Number(r.price_override);
            await api.courts.upsertPricing(court.id, shiftId, { tier: r.tier, price_override: price });
            toast.success(`Đã lưu ca ${SHIFTS.find(s => s.id === shiftId)?.start}`);
        } catch { toast.error('Lỗi lưu giá ca'); }
        finally { setSaving(null); }
    };

    const resetShift = async (shiftId: number) => {
        try {
            await api.courts.deletePricing(court.id, shiftId);
            setRules(prev => { const n = { ...prev }; delete n[shiftId]; return n; });
            toast.success('Đã xóa giá tùy chỉnh, sử dụng giá mặc định');
        } catch { toast.error('Lỗi xóa giá ca'); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <Card className="w-full max-w-2xl shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <DollarSign size={20} className="text-emerald-500"/>
                        Cài Giá Theo Ca — {court.name}
                        <span className="text-xs font-normal text-slate-400">(Mặc định: {court.price_per_hour?.toLocaleString()}đ/giờ)</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                </div>
                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Đang tải...</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto_auto] gap-2 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                <span>Ca</span><span>Khung giờ</span><span>Phân loại</span><span>Giá (đ/giờ)</span><span></span><span></span>
                            </div>
                            {SHIFTS.map(shift => {
                                const rule = getRule(shift.id);
                                const tierInfo = TIERS.find(t => t.value === rule.tier) || TIERS[1];
                                const hasOverride = rules[shift.id] !== undefined;
                                const effectivePrice = hasOverride && rule.price_override !== '' ? Number(rule.price_override) : court.price_per_hour;
                                return (
                                    <div key={shift.id} className={`grid grid-cols-[80px_1fr_1fr_1fr_auto_auto] gap-2 items-center bg-white border rounded-lg px-3 py-2.5 ${hasOverride ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                                        <span className="text-xs font-bold text-slate-500">Ca {shift.id}</span>
                                        <span className="text-sm font-semibold text-slate-700">{shift.start} – {shift.end}</span>
                                        <select
                                            value={rule.tier}
                                            onChange={e => updateLocal(shift.id, 'tier', e.target.value)}
                                            className={`text-xs font-semibold border rounded px-2 py-1.5 focus:outline-none cursor-pointer ${tierInfo.color}`}
                                        >
                                            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={rule.price_override}
                                                onChange={e => updateLocal(shift.id, 'price_override', e.target.value)}
                                                placeholder={`${court.price_per_hour?.toLocaleString()} (mặc định)`}
                                                className="w-full text-sm border border-slate-200 focus:border-indigo-400 rounded px-2 py-1.5 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => saveShift(shift.id)}
                                            disabled={saving === shift.id}
                                            className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                                            title="Lưu ca này"
                                        >
                                            <Save size={14}/>
                                        </button>
                                        <button
                                            onClick={() => resetShift(shift.id)}
                                            disabled={!hasOverride}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded transition-colors disabled:opacity-30"
                                            title="Xóa giá tùy chỉnh (dùng mặc định)"
                                        >
                                            <RotateCcw size={14}/>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                    <p className="text-xs text-slate-400">💡 Để trống ô giá = dùng giá mặc định của sân. Nhấn 💾 để lưu từng ca.</p>
                </div>
            </Card>
        </div>
    );
}
