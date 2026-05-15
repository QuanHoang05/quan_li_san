'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Building2, Save, CheckCircle2, QrCode, Webhook, Copy, CheckCheck, Activity, RefreshCw, Trash2, Power } from 'lucide-react';
import { api, BankSettings } from '@/lib/api';
import toast from 'react-hot-toast';

const BANKS = [
    { code: 'VCB',   name: 'Vietcombank' },
    { code: 'TCB',   name: 'Techcombank' },
    { code: 'MB',    name: 'MB Bank' },
    { code: 'BIDV',  name: 'BIDV' },
    { code: 'ICB',   name: 'Vietinbank' },
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
    { code: 'VBA',   name: 'Agribank' },
    { code: 'VIB',   name: 'VIB' },
];

const WEBHOOK_URL = 'http://localhost:8000/api/v1/webhooks/casso';

export default function SettingsPage() {
    const [current, setCurrent] = useState<BankSettings | null>(null);
    const [banks, setBanks] = useState<BankSettings[]>([]);
    const [form, setForm] = useState({
        bank_code: 'VCB',
        bank_name: 'Vietcombank',
        account_number: '',
        account_name: '',
    });
    const [saving, setSaving] = useState(false);
    const [previewAmount] = useState(100000);
    const [webhookCopied, setWebhookCopied] = useState(false);
    const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'bank' | 'webhook'>('bank');

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const data = await api.bank.getAll();
            setBanks(data);
            const active = data.find(b => b.is_active);
            setCurrent(active || null);
        } catch { /* no settings yet */ }
    };

    const loadWebhookLogs = async () => {
        setLogsLoading(true);
        try {
            const logs = await api.onlineBookings.getWebhookLogs();
            setWebhookLogs(logs);
        } catch {}
        finally { setLogsLoading(false); }
    };

    useEffect(() => {
        if (activeTab === 'webhook') loadWebhookLogs();
    }, [activeTab]);

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
            toast.success('Đã thêm/cập nhật tài khoản ngân hàng!');
            setForm({
                bank_code: 'VCB',
                bank_name: 'Vietcombank',
                account_number: '',
                account_name: '',
            });
            loadSettings();
        } catch { toast.error('Lưu thất bại!'); }
        finally { setSaving(false); }
    };

    const copyWebhookUrl = async () => {
        try {
            await navigator.clipboard.writeText(WEBHOOK_URL);
            setWebhookCopied(true);
            setTimeout(() => setWebhookCopied(false), 2000);
            toast.success('Đã copy URL webhook!');
        } catch {}
    };

    const qrUrl = form.account_number
        ? `https://img.vietqr.io/image/${form.bank_code}-${form.account_number}-compact2.png?amount=${previewAmount}&addInfo=Preview+QR&accountName=${encodeURIComponent(form.account_name)}`
        : null;

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Thiết Lập Hệ Thống</h2>
                    <p className="text-slate-500 mt-1">Cài đặt tài khoản ngân hàng và webhook tự động.</p>
                </div>
            </div>

            {/* Tab selector */}
            <div className="flex bg-white shadow-sm border border-slate-200 p-1 rounded-lg w-max">
                <button
                    onClick={() => setActiveTab('bank')}
                    className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'bank' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Building2 size={15}/> Ngân Hàng
                </button>
                <button
                    onClick={() => setActiveTab('webhook')}
                    className={`px-5 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'webhook' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Webhook size={15}/> Webhook Tự Động
                </button>
            </div>

            {/* ======= BANK TAB ======= */}
            {activeTab === 'bank' && (
                <>
                    <div className="flex flex-col gap-4">
                        {banks.length > 0 && (
                            <Card className="bg-white shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 flex items-center gap-2">
                                    <Building2 size={18} className="text-indigo-500"/> Danh sách tài khoản nhận tiền
                                </div>
                                <div>
                                    {banks.map(bank => (
                                        <div key={bank.id} className={`flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${bank.is_active ? 'bg-emerald-50/50' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${bank.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Building2 size={16}/>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                                        {bank.bank_name}
                                                        {bank.is_active && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-500 text-white shadow-sm">Đang Dùng</span>}
                                                    </div>
                                                    <div className="text-sm text-slate-500 font-mono mt-0.5">
                                                        {bank.account_number} — {bank.account_name}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant={bank.is_active ? 'outline' : 'secondary'}
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            await api.bank.toggle(bank.id, !bank.is_active);
                                                            toast.success(bank.is_active ? 'Đã tắt nhận tiền' : 'Đã bật nhận tiền');
                                                            loadSettings();
                                                        } catch { toast.error('Sự cố khi lưu!'); }
                                                    }}
                                                    className={bank.is_active ? 'text-emerald-700 border-emerald-200 bg-white hover:bg-emerald-50' : ''}
                                                >
                                                    <Power size={14} className="mr-1.5"/> {bank.is_active ? 'Đang bật' : 'Bật (Set Active)'}
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    className="text-red-500 border-red-200 hover:bg-red-50"
                                                    onClick={async () => {
                                                        if(confirm('Bạn có chắc chắn muốn xóa?')) {
                                                            try {
                                                                await api.bank.delete(bank.id);
                                                                toast.success('Đã xóa ngân hàng');
                                                                loadSettings();
                                                            } catch { toast.error('Không thể xóa'); }
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={14}/>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
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
                </>
            )}

            {/* ======= WEBHOOK TAB ======= */}
            {activeTab === 'webhook' && (
                <div className="flex flex-col gap-5">
                    <Card className="bg-white shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                            <Webhook size={18} className="text-indigo-500"/>
                            <h3 className="font-bold text-slate-800">URL Webhook nhận tiền</h3>
                        </div>
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Endpoint URL (copy vào Casso/SePay)</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-slate-900 text-emerald-400 text-xs font-mono px-4 py-3 rounded-lg border border-slate-700 select-all overflow-x-auto whitespace-nowrap">
                                    {WEBHOOK_URL}
                                </code>
                                <button
                                    onClick={copyWebhookUrl}
                                    className={`flex items-center gap-1.5 px-3 py-3 rounded-lg text-xs font-bold transition-all shrink-0 ${webhookCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                >
                                    {webhookCopied ? <><CheckCheck size={14}/> Copied</> : <><Copy size={14}/> Copy</>}
                                </button>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">Hướng dẫn tích hợp Casso</p>
                            <ol className="space-y-2">
                                {[
                                    'Đăng ký tài khoản tại casso.vn',
                                    'Thêm tài khoản ngân hàng đã cài ở tab "Ngân Hàng"',
                                    'Vào Cài đặt → Webhook → Thêm URL ở trên',
                                    'Chọn sự kiện: Biến động số dư (nhận tiền)',
                                    'Khi có chuyển khoản đúng nội dung, hệ thống sẽ tự xác nhận',
                                ].map((step, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </Card>

                    <Card className="bg-white shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-slate-500"/>
                                <h3 className="font-bold text-slate-800">Lịch Sử Webhook</h3>
                            </div>
                            <button
                                onClick={loadWebhookLogs}
                                disabled={logsLoading}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''}/> Tải lại
                            </button>
                        </div>
                        {webhookLogs.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">
                                {logsLoading ? 'Đang tải...' : 'Chưa có webhook nào. Tích hợp Casso/SePay để bắt đầu.'}
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Thời gian</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Nguồn</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Mã đặt</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Số tiền</th>
                                            <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {webhookLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="p-3 text-slate-500 text-xs whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '—'}</td>
                                                <td className="p-3"><span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{log.source}</span></td>
                                                <td className="p-3 font-mono text-xs text-slate-700">{log.payment_ref || '—'}</td>
                                                <td className="p-3 text-right font-semibold text-slate-800">{log.amount ? `${Number(log.amount).toLocaleString()}đ` : '—'}</td>
                                                <td className="p-3 text-center">
                                                    {log.matched
                                                        ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded">✓ Matched</span>
                                                        : <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded">Không match</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
