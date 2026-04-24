'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    Clock, CheckCircle2, XCircle, Upload, Camera, Image as ImageIcon,
    QrCode, Copy, AlertTriangle, Loader2, RefreshCw, ChevronLeft
} from 'lucide-react';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TOTAL_SECONDS = 15 * 60; // 15 phút

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
    const progress = secondsLeft / TOTAL_SECONDS;
    const dashOffset = CIRCUMFERENCE * (1 - progress);
    const isUrgent = secondsLeft < 120;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return (
        <div className="relative flex items-center justify-center w-32 h-32">
            <svg className="-rotate-90" width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                <circle
                    cx="64" cy="64" r={RADIUS} fill="none"
                    stroke={isUrgent ? '#ef4444' : '#10b981'}
                    strokeWidth="8"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-2xl font-black tabular-nums ${isUrgent ? 'text-red-600' : 'text-slate-800'}`}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">còn lại</span>
            </div>
        </div>
    );
}

type PageState = 'loading' | 'paying' | 'uploading' | 'waiting' | 'paid' | 'expired' | 'error';

export default function PaymentPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const bookingId = parseInt(id);

    const [pageState, setPageState] = useState<PageState>('loading');
    const [booking, setBooking] = useState<any>(null);
    const [bankSettings, setBankSettings] = useState<any>(null);
    const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
    const [pendingMeta, setPendingMeta] = useState<any>(null); // From sessionStorage
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [copied, setCopied] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load from sessionStorage for first render (better UX before polling data arrives)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('pendingBooking');
            if (raw) {
                const meta = JSON.parse(raw);
                if (meta.booking_id === bookingId || meta.booking_ids?.includes(bookingId)) {
                    setPendingMeta(meta);
                }
            }
        } catch {}
    }, [bookingId]);

    const fetchBooking = useCallback(async () => {
        try {
            const data = await api.onlineBookings.getById(bookingId);
            setBooking(data);
            const ps = (data.payment_status || '').replace('PaymentStatus.', '');
            if (ps === 'Fully_Paid' || data.status === 'Paid') {
                setPageState('paid');
                clearPolling();
            } else if (data.is_expired || data.is_deleted) {
                setPageState('expired');
                clearPolling();
            } else if (ps === 'Deposit') {
                // Có ảnh minh chứng, đang chờ
                setPageState('waiting');
            } else {
                setPageState('paying');
            }
            return data;
        } catch {
            setPageState('error');
        }
    }, [bookingId]);

    const clearPolling = () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    // Initial load
    useEffect(() => {
        const init = async () => {
            const [data, bank] = await Promise.all([
                fetchBooking(),
                api.bank.get().catch(() => null),
            ]);
            setBankSettings(bank);
            if (data && data.expires_at) {
                const exp = new Date(data.expires_at).getTime();
                const nowMs = Date.now();
                const remaining = Math.max(0, Math.round((exp - nowMs) / 1000));
                setSecondsLeft(remaining);
            }
        };
        init();
        return clearPolling;
    }, [fetchBooking]);

    // Countdown timer
    useEffect(() => {
        if (pageState !== 'paying') return;
        timerRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    setPageState('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [pageState]);

    // Polling every 5s for payment confirmation
    useEffect(() => {
        if (pageState !== 'paying' && pageState !== 'waiting') return;
        pollingRef.current = setInterval(fetchBooking, 5000);
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [pageState, fetchBooking]);

    const handleFileChange = (file: File) => {
        setProofFile(file);
        const reader = new FileReader();
        reader.onload = e => setProofPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) handleFileChange(file);
    };

    const handleUpload = async () => {
        if (!proofFile) return toast.error('Vui lòng chọn ảnh minh chứng');
        setUploading(true);
        try {
            await api.onlineBookings.uploadProof(bookingId, proofFile);
            toast.success('Đã gửi minh chứng! Đang chờ xác nhận từ hệ thống...');
            setPageState('waiting');
            await fetchBooking();
        } catch {
            toast.error('Gửi ảnh thất bại, vui lòng thử lại');
        } finally {
            setUploading(false);
        }
    };

    const copyRef = async () => {
        const ref = booking?.payment_ref || pendingMeta?.payment_ref;
        if (!ref) return;
        try {
            await navigator.clipboard.writeText(ref);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Đã copy nội dung chuyển khoản!');
        } catch {}
    };

    // Derived values
    const paymentRef = booking?.payment_ref || pendingMeta?.payment_ref || '';
    const totalAmount = pendingMeta?.total_amount || 0;
    const courtName = booking?.court_name || pendingMeta?.court_name || '';
    const guestName = booking?.guest_name || pendingMeta?.guest_name || '';
    const shifts = pendingMeta?.shifts || [];

    const safeBankCode = bankSettings?.bank_code === 'MBB' ? 'MB' : (bankSettings?.bank_code === 'VTB' ? 'ICB' : bankSettings?.bank_code);
    const qrUrl = (bankSettings && paymentRef && totalAmount)
        ? `https://img.vietqr.io/image/${safeBankCode}-${bankSettings.account_number}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(paymentRef)}&accountName=${encodeURIComponent(bankSettings.account_name)}`
        : null;

    // ---- Render States ----
    if (pageState === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 size={40} className="text-emerald-500 animate-spin"/>
                <p className="text-slate-500 font-medium">Đang tải thông tin đặt sân...</p>
            </div>
        );
    }

    if (pageState === 'paid') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={52} className="text-emerald-500"/>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Thanh toán thành công! 🎉</h2>
                    <p className="text-slate-500 mt-2">Sân <strong>{courtName}</strong> đã được xác nhận cho bạn.</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 w-full max-w-sm">
                    <div className="text-sm text-emerald-800 font-semibold space-y-1">
                        <div className="flex justify-between"><span>Khách hàng</span><span>{guestName}</span></div>
                        <div className="flex justify-between"><span>Sân</span><span>{courtName}</span></div>
                        <div className="flex justify-between"><span>Mã đặt</span><span className="font-mono text-xs">{paymentRef}</span></div>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/courts')}
                    className="w-full max-w-sm bg-emerald-600 text-white py-4 rounded-2xl font-black text-base hover:bg-emerald-700 transition-all"
                >
                    Đặt sân khác
                </button>
                <button onClick={() => router.push('/courts/my-bookings')} className="text-sm text-slate-500 underline">
                    Xem lịch sử đặt sân
                </button>
            </div>
        );
    }

    if (pageState === 'expired') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 px-4 text-center">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle size={52} className="text-red-500"/>
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800">Đơn đặt đã hết hạn</h2>
                    <p className="text-slate-500 mt-2 text-sm">15 phút giữ chỗ đã qua. Vui lòng đặt lại để chọn ca khác.</p>
                </div>
                <button
                    onClick={() => router.push('/courts')}
                    className="w-full max-w-sm bg-slate-800 text-white py-4 rounded-2xl font-black text-base hover:bg-slate-900 transition-all"
                >
                    ← Quay lại đặt sân
                </button>
            </div>
        );
    }

    if (pageState === 'error') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
                <AlertTriangle size={48} className="text-amber-500"/>
                <p className="text-slate-700 font-semibold">Không tìm thấy thông tin đặt sân.</p>
                <button onClick={() => router.push('/courts')} className="text-emerald-600 underline font-medium">Quay về trang đặt sân</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/courts')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronLeft size={20} className="text-slate-600"/>
                </button>
                <div>
                    <h1 className="text-lg font-black text-slate-800">Thanh toán đặt sân</h1>
                    <p className="text-xs text-slate-500">Sân {courtName} · {guestName}</p>
                </div>
            </div>

            {/* Countdown Section */}
            {pageState === 'paying' && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 flex items-center gap-5 shadow-xl">
                    <CountdownRing secondsLeft={secondsLeft}/>
                    <div className="flex-1">
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Thời gian giữ chỗ</p>
                        <p className="text-white font-bold text-base mt-1">
                            {secondsLeft < 120
                                ? '⚠️ Sắp hết hạn! Hãy thanh toán ngay'
                                : 'Vui lòng hoàn tất thanh toán'}
                        </p>
                        <p className="text-white/50 text-xs mt-1">Sân sẽ tự động giải phóng khi hết giờ</p>
                        {shifts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2.5">
                                {shifts.map((s: any) => (
                                    <span key={s.shift_id} className="bg-white/15 text-white/90 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                        {s.start}–{s.end}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Waiting State Banner */}
            {pageState === 'waiting' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <RefreshCw size={16} className="text-amber-600 animate-spin"/>
                    </div>
                    <div>
                        <p className="font-bold text-amber-800 text-sm">Đang chờ xác nhận thanh toán</p>
                        <p className="text-amber-700 text-xs mt-0.5">Hệ thống đang kiểm tra giao dịch. Trang sẽ tự động cập nhật khi nhận được tiền.</p>
                    </div>
                </div>
            )}

            {/* Amount Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Số tiền cần thanh toán</div>
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{shifts.length} ca</span>
                </div>
                <div className="text-3xl font-black text-slate-900 tabular-nums">{totalAmount.toLocaleString()}<span className="text-lg ml-1">đ</span></div>
                <div className="mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Nội dung chuyển khoản</div>
                        <div className="font-mono font-black text-slate-800 text-sm mt-0.5">{paymentRef || '...'}</div>
                    </div>
                    <button onClick={copyRef} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                        {copied ? <><CheckCircle2 size={13}/> Đã copy</> : <><Copy size={13}/> Copy</>}
                    </button>
                </div>
            </div>

            {/* VietQR Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <QrCode size={18} className="text-emerald-600"/>
                    <h3 className="font-bold text-slate-800">Quét mã QR thanh toán</h3>
                </div>
                {qrUrl ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                            <img src={qrUrl} alt="VietQR" className="w-52 h-52 object-contain" />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-slate-700 text-sm">{bankSettings?.bank_name}</div>
                            <div className="font-mono text-slate-600 text-sm">{bankSettings?.account_number}</div>
                            <div className="text-slate-500 text-xs">{bankSettings?.account_name}</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 text-center">
                            📱 Dùng app ngân hàng bất kỳ để quét QR.<br/>
                            Số tiền và nội dung <strong>{paymentRef}</strong> sẽ được điền tự động.
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 py-6 text-slate-400">
                        <QrCode size={48} className="opacity-30"/>
                        {!bankSettings ? (
                            <p className="text-sm text-amber-600 font-semibold text-center">⚠️ Chưa cài đặt tài khoản ngân hàng. Liên hệ quản lý!</p>
                        ) : (
                            <p className="text-sm">Đang tạo mã QR...</p>
                        )}
                    </div>
                )}
            </div>

            {/* Upload Proof Section */}
            {(pageState === 'paying' || pageState === 'waiting') && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <Upload size={18} className="text-indigo-500"/>
                        Gửi ảnh minh chứng chuyển khoản
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Chụp màn hình giao dịch thành công và gửi lên để xác nhận nhanh hơn.</p>

                    {/* Drop Zone */}
                    {!proofPreview ? (
                        <div
                            ref={dropRef}
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('proof-input')?.click()}
                            className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all hover:bg-emerald-50/30 active:bg-emerald-50"
                        >
                            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
                                <Camera size={28} className="text-slate-400"/>
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-slate-700 text-sm">Chọn ảnh hoặc kéo vào đây</p>
                                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP tối đa 10MB</p>
                            </div>
                            <input
                                id="proof-input"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                                <img src={proofPreview} alt="Minh chứng" className="w-full max-h-64 object-contain bg-slate-50"/>
                                <button
                                    onClick={() => { setProofFile(null); setProofPreview(null); }}
                                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 p-1.5 rounded-full shadow transition-colors"
                                >
                                    <XCircle size={18}/>
                                </button>
                            </div>
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                            >
                                {uploading
                                    ? <><Loader2 size={18} className="animate-spin"/> Đang gửi...</>
                                    : <><Upload size={18}/> Gửi minh chứng</>
                                }
                            </button>
                        </div>
                    )}

                    {pageState === 'waiting' && booking?.proof_image_url && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                            <CheckCircle2 size={14} className="shrink-0"/>
                            Ảnh đã được gửi! Đang chờ hệ thống xác nhận tự động...
                        </div>
                    )}
                </div>
            )}

            {/* Manual refresh button */}
            {(pageState === 'paying' || pageState === 'waiting') && (
                <button
                    onClick={fetchBooking}
                    className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 py-2 transition-colors"
                >
                    <RefreshCw size={14}/> Kiểm tra trạng thái thanh toán
                </button>
            )}

            {/* How it works */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Hướng dẫn thanh toán</p>
                <ol className="space-y-2">
                    {[
                        'Mở app ngân hàng và quét mã QR ở trên',
                        'Kiểm tra số tiền và nội dung chuyển khoản',
                        'Xác nhận chuyển khoản',
                        'Trang này sẽ tự động cập nhật trong vài giây',
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                            <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
