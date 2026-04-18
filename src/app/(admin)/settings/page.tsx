'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Building2, Save, CheckCircle2, QrCode } from 'lucide-react';
import { api, BankSettings } from '@/lib/api';
import toast from 'react-hot-toast';

const BANKS = [
    { code: 'VCB',   name: 'Vietcombank' },
    { code: 'TCB',   name: 'Techcombank' },
    { code: 'MBB',   name: 'MB Bank' },
    { code: 'BIDV',  name: 'BIDV' },
    { code: 'VTB',   name: 'Vietinbank' },
    { code: 'ACB',   name: 'ACB' },
    { code: 'TPB',   name: 'TPBank' },
    { code: 'VPB',   name: 'VPBank' },
    { code: 'OCB',   name: 'OCB' },
    { code: 'SHB',   name: 'SHB' },
    { code: 'HDB',   name: 'HDBank' },
    { code: 'MSB',   name: 'MSB' },
    { code: 'NAB',   name: 'Nam A Bank' },
    { code: 'LPB',   name: 'LienVietPostBank' },
    { code: 'STB',   name: 'Sacombank' },
    { code: 'EIB',   name: 'Eximbank' },
    { code: 'CAKE',  name: 'CAKE' },
    { code: 'TIMO',  name: 'Timo' },
    { code: 'MOMO',  name: 'MoMo (Ví điện tử)' },
    { code: 'ZALOPAY', name: 'ZaloPay (Ví điện tử)' },
];

export default function SettingsPage() {
    const [current, setCurrent] = useState<BankSettings | null>(null);
    const [form, setForm] = useState({
        bank_code: 'VCB',
        bank_name: 'Vietcombank',
        account_number: '',
        account_name: '',
    });
    const [saving, setSaving] = useState(false);
    const [previewAmount] = useState(100000);

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const data = await api.bank.get();
            if (data) {
                setCurrent(data);
                setForm({
                    bank_code: data.bank_code,
                    bank_name: data.bank_name,
                    account_number: data.account_number,
                    account_name: data.account_name,
                });
            }
        } catch { /* no settings yet */ }
    };

    const handleBankChange = (code: string) => {
        const bank = BANKS.find(b => b.code === code);
        setForm(f => ({ ...f, bank_code: code, bank_name: bank?.name || code }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.account_number.trim() || !form.account_name.trim()) {
            return toast.error('Vui lòng điền đầy đủ thông tin tài khoản!');
        }
        setSaving(true);
        try {
            await api.bank.update(form);
            toast.success('Đã lưu tài khoản ngân hàng!');
            loadSettings();
        } catch { toast.error('Lưu thất bại!'); }
        finally { setSaving(false); }
    };

    // Tạo URL QR preview
    const qrUrl = form.account_number
        ? `https://img.vietqr.io/image/${form.bank_code}-${form.account_number}-compact2.png?amount=${previewAmount}&addInfo=Preview+QR&accountName=${encodeURIComponent(form.account_name)}`
        : null;

    return (
        <div className="flex flex-col gap-6 max-w-2xl">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Thiết Lập Hệ Thống</h2>
                    <p className="text-slate-500 mt-1">Cài đặt tài khoản ngân hàng để nhận thanh toán VietQR.</p>
                </div>
            </div>

            {/* Current bank display */}
            {current && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                    <CheckCircle2 size={20} className="text-emerald-500 shrink-0"/>
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-emerald-800">Tài khoản đang nhận tiền</div>
                        <div className="text-sm text-emerald-700 mt-0.5">
                            <span className="font-bold">{current.bank_name}</span> — STK: <span className="font-mono font-bold">{current.account_number}</span> — {current.account_name}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
                {/* Form */}
                <Card className="bg-white shadow-sm border border-slate-200">
                    <form onSubmit={handleSave} className="p-6 flex flex-col gap-5">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                            <Building2 size={18} className="text-indigo-500"/>
                            <h3 className="font-bold text-slate-800">Cài Đặt Tài Khoản Nhận Tiền</h3>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ngân Hàng</label>
                            <select
                                value={form.bank_code}
                                onChange={e => handleBankChange(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-400"
                            >
                                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Số Tài Khoản / ID Ví</label>
                            <input
                                type="text"
                                required
                                value={form.account_number}
                                onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 font-mono"
                                placeholder="Vd: 1234567890"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tên Chủ Tài Khoản</label>
                            <input
                                type="text"
                                required
                                value={form.account_name}
                                onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                                placeholder="Vd: NGUYEN VAN A"
                            />
                            <p className="text-xs text-slate-400 mt-1">← Nhập IN HOA, không dấu để hiển thị đúng trên QR</p>
                        </div>

                        <Button type="submit" disabled={saving} className="gap-2 mt-2">
                            <Save size={16}/> {saving ? 'Đang lưu...' : 'Lưu Cài Đặt'}
                        </Button>
                    </form>
                </Card>

                {/* QR Preview */}
                <Card className="bg-white shadow-sm border border-slate-200 p-5 flex flex-col items-center gap-3 min-w-[180px]">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                        <QrCode size={16}/> Preview QR
                    </div>
                    {qrUrl ? (
                        <img
                            src={qrUrl}
                            alt="VietQR Preview"
                            className="w-40 h-40 object-contain rounded-lg border border-slate-200"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-40 h-40 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-300">
                            <QrCode size={48}/>
                        </div>
                    )}
                    <div className="text-center">
                        <div className="text-xs text-slate-500 font-semibold">{form.bank_name}</div>
                        <div className="text-xs font-mono text-slate-700 font-bold">{form.account_number || '—'}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Mẫu: {previewAmount.toLocaleString()}đ</div>
                    </div>
                </Card>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
                💡 <strong>Lưu ý:</strong> Khi khách quét mã QR trong POS hoặc đặt sân, số tiền và ghi chú sẽ được tự động điền. Khách chỉ cần quét và xác nhận chuyển khoản.
            </div>
        </div>
    );
}
