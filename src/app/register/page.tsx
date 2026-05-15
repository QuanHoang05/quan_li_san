'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { User, Lock, Mail, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import Link from 'next/link';

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect');

    const [form, setForm] = useState({ email: '', pass: '', name: '' });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const newUserPayload = {
                email: form.email,
                password: form.pass,
                name: form.name || 'Người dùng mới',
                role: 'User'
            };

            // Lưu vào database qua backend
            const res = await api.customers.create(newUserPayload);

            // Clear old data
            localStorage.removeItem('wallet_balance');
            localStorage.removeItem('wallet_pin');
            localStorage.removeItem('wallet_history');
            localStorage.removeItem('profile_name');
            localStorage.removeItem('profile_phone');

            toast.success("Đăng ký thành công vào hệ thống! Đang đăng nhập...");

            // Tự động đăng nhập sau khi đăng ký
            document.cookie = `role=User; path=/`;
            document.cookie = `userName=${newUserPayload.name}; path=/`;
            if (res && res.user_id) {
                document.cookie = `user_id=${res.user_id}; path=/`;
            }

            if (redirectUrl) router.push(redirectUrl);
            else router.push('/matchmaking');

        } catch (err: any) {
            toast.error(err.message || "Đăng ký thất bại!");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

                {/* Left Panel - Branding */}
                <div className="w-full md:w-5/12 bg-emerald-600 p-8 flex flex-col justify-between text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-800/50 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl font-extrabold tracking-tight mb-2">QuanLiSan</h1>
                        <p className="text-emerald-100 opacity-90">Nền tảng Quản lý & Kết nối Thể thao</p>
                    </div>

                    <div className="relative z-10 mt-12 mb-4 space-y-3">
                        <div className="p-4 bg-emerald-700/30 backdrop-blur-sm rounded-xl border border-emerald-500/30">
                            <h3 className="font-bold text-emerald-50 flex items-center gap-2 mb-2"><ShieldAlert size={16} /> Tạo tài khoản</h3>
                            <p className="text-sm text-emerald-100">
                                Đăng ký ngay để trải nghiệm các tính năng tuyệt vời của hệ thống như đặt sân, tìm kèo, và quản lý lịch chơi.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white relative">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Tạo Tài Khoản Mới</h2>
                        <p className="text-slate-500 mt-2">
                            Tham gia cộng đồng thể thao ngay hôm nay!
                        </p>
                    </div>

                    <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Họ và Tên</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl font-medium text-slate-800 transition-all outline-none bg-slate-50/50"
                                    placeholder="Nhập họ và tên..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl font-medium text-slate-800 transition-all outline-none bg-slate-50/50"
                                    placeholder="your-email@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Mật khẩu</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={form.pass}
                                    onChange={e => setForm({ ...form, pass: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl font-medium text-slate-800 transition-all outline-none bg-slate-50/50"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full py-4 mt-2 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/30">
                            Tạo Tài Khoản
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium text-slate-500">
                        Đã có tài khoản?{" "}
                        <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline">
                            Đăng nhập
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-emerald-600">Loading...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
