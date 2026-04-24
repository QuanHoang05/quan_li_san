'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Lock, Mail, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

// Define standard mock users
const MOCK_USERS = [
    { email: 'admin@example.com', pass: '123', role: 'ADMIN', name: 'Quản trị viên' },
    { email: 'staff@example.com', pass: '123', role: 'STAFF', name: 'Nhân viên quầy' },
    { email: 'user@example.com', pass: '123', role: 'CUSTOMER', name: 'Khách hàng mẫu' },
];

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect');

    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ email: '', pass: '', name: '' });

    // Manage dynamic users in localStorage
    const [users, setUsers] = useState<typeof MOCK_USERS>([]);

    useEffect(() => {
        const stored = localStorage.getItem('app_mock_users');
        if (stored) {
            setUsers(JSON.parse(stored));
        } else {
            setUsers(MOCK_USERS);
            localStorage.setItem('app_mock_users', JSON.stringify(MOCK_USERS));
        }
    }, []);

    const saveUsers = (newUsers: typeof MOCK_USERS) => {
        setUsers(newUsers);
        localStorage.setItem('app_mock_users', JSON.stringify(newUsers));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Attempting login for:", form.email);

        let backendSuccess = false;
        try {
            // Thử đăng nhập qua backend với timeout 3s
            const loginPromise = api.auth.login({ email: form.email, password: form.pass });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 3000)
            );

            const res = await Promise.race([loginPromise, timeoutPromise]) as any;

            if (res && res.ok) {
                const user = res.user;
                console.log("Backend login success:", user.role);
                toast.success(`Đăng nhập thành công với vai trò ${user.role}!`);
                document.cookie = `role=${user.role}; path=/`;
                document.cookie = `userName=${user.name}; path=/`;
                document.cookie = `user_id=${user.id}; path=/`;

                if (redirectUrl) { router.push(redirectUrl); }
                else {
                    const roleUpper = user.role.toUpperCase();
                    if (roleUpper === 'ADMIN') router.push('/dashboard');
                    else if (roleUpper === 'STAFF') router.push('/pos');
                    else router.push('/matchmaking');
                }
                backendSuccess = true;
                return;
            }
        } catch (err: any) {
            console.error("Backend login error:", err);
        }

        if (backendSuccess) return;
        console.log("Proceeding to mock fallback...");

        // Fallback sang mock users (localStorage)
        const user = users.find(u => u.email === form.email && u.pass === form.pass);
        if (user) {
            toast.success(`Đăng nhập thành công (Mock) với vai trò ${user.role}!`);
            document.cookie = `role=${user.role}; path=/`;
            document.cookie = `userName=${user.name}; path=/`;

            if (redirectUrl) router.push(redirectUrl);
            else {
                const roleUpper = user.role.toUpperCase();
                if (roleUpper === 'ADMIN') router.push('/dashboard');
                else if (roleUpper === 'STAFF') router.push('/pos');
                else router.push('/matchmaking');
            }
        } else {
            toast.error("Sai email hoặc mật khẩu!");
        }
    };

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
            await api.customers.create(newUserPayload);

            toast.success("Đăng ký thành công vào hệ thống! Đang đăng nhập...");

            // Tự động đăng nhập sau khi đăng ký
            document.cookie = `role=User; path=/`;
            document.cookie = `userName=${newUserPayload.name}; path=/`;

            if (redirectUrl) router.push(redirectUrl);
            else router.push('/matchmaking');

        } catch (err: any) {
            toast.error(err.message || "Đăng ký thất bại!");
        }
    };

    const fillTestAccount = (email: string) => {
        setForm({ ...form, email, pass: '123' });
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
                            <h3 className="font-bold text-emerald-50 flex items-center gap-2 mb-2"><ShieldAlert size={16} /> Tài khoản Test</h3>
                            <ul className="text-sm text-emerald-100 space-y-2">
                                <li>
                                    <button onClick={() => fillTestAccount('admin@example.com')} className="hover:text-white hover:underline text-left transition-colors">
                                        <span className="font-bold">Admin:</span> admin@example.com
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => fillTestAccount('staff@example.com')} className="hover:text-white hover:underline text-left transition-colors">
                                        <span className="font-bold">Staff:</span> staff@example.com
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => fillTestAccount('user@example.com')} className="hover:text-white hover:underline text-left transition-colors">
                                        <span className="font-bold">User:</span> user@example.com
                                    </button>
                                </li>
                                <li className="pt-2 border-t border-emerald-500/30 text-xs italic opacity-80 text-emerald-200">
                                    Mật khẩu chung: 123
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white relative">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản Mới'}</h2>
                        <p className="text-slate-500 mt-2">
                            {isLogin ? 'Chào mừng bạn quay lại hệ thống' : 'Tham gia cộng đồng thể thao ngay hôm nay!'}
                        </p>
                    </div>

                    <form onSubmit={isLogin ? handleLogin : handleRegister} className="flex flex-col gap-5">
                        {!isLogin && (
                            <div>
                                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Họ và Tên</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required={!isLogin}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl font-medium text-slate-800 transition-all outline-none bg-slate-50/50"
                                        placeholder="Nhập họ và tên..."
                                    />
                                </div>
                            </div>
                        )}

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
                            {isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
                        </Button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium text-slate-500">
                        {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                        <button onClick={() => { setIsLogin(!isLogin); setForm({ email: '', pass: '', name: '' }); }} className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline">
                            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-emerald-600">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
