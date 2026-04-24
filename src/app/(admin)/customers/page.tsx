'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    Users, Search, X, Edit2, Trash2, Wallet, RefreshCw,
    Phone, Mail, ShieldCheck, User as UserIcon, CalendarDays,
    ChevronDown, BadgeCheck, Crown, UserCog, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    Admin:  { label: 'Quản trị', color: 'text-purple-700', bg: 'bg-purple-100', icon: <Crown size={12}/> },
    Staff:  { label: 'Nhân viên', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <UserCog size={12}/> },
    User:   { label: 'Khách hàng', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <UserIcon size={12}/> },
};

const PAYMENT_LABELS: Record<string, { label: string; color: string }> = {
    Fully_Paid: { label: 'Đã thanh toán', color: 'text-emerald-600 bg-emerald-50' },
    Deposit:    { label: 'Đặt cọc',       color: 'text-yellow-600 bg-yellow-50' },
    Unpaid:     { label: 'Chưa thanh toán', color: 'text-rose-600 bg-rose-50' },
};

export default function CustomersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [detailUser, setDetailUser] = useState<any | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Edit modal
    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'User' });

    // Topup modal
    const [topupModal, setTopupModal] = useState(false);
    const [topupAmount, setTopupAmount] = useState('');

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.customers.getAll({
                role: roleFilter !== 'all' ? roleFilter : undefined,
                search: search || undefined
            });
            setUsers(data);
        } catch {
            toast.error('Không thể tải danh sách khách hàng');
        } finally {
            setLoading(false);
        }
    }, [roleFilter, search]);

    useEffect(() => {
        const timer = setTimeout(() => fetchUsers(), 300);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const openDetail = async (user: any) => {
        setSelectedUser(user);
        setLoadingDetail(true);
        try {
            const detail = await api.customers.getById(user.id);
            setDetailUser(detail);
        } catch {
            toast.error('Không thể tải chi tiết');
        } finally {
            setLoadingDetail(false);
        }
    };

    const openEdit = (user: any) => {
        setEditForm({ name: user.name, email: user.email, phone: user.phone || '', role: user.role });
        setEditModal(true);
    };

    const saveEdit = async () => {
        if (!selectedUser) return;
        try {
            await api.customers.update(selectedUser.id, editForm);
            toast.success('Cập nhật thông tin thành công!');
            setEditModal(false);
            fetchUsers();
            // update selectedUser
            setSelectedUser((prev: any) => ({ ...prev, ...editForm }));
        } catch {
            toast.error('Cập nhật thất bại');
        }
    };

    const handleTopup = async () => {
        if (!selectedUser) return;
        const amount = parseFloat(topupAmount);
        if (!amount || amount <= 0) { toast.error('Số tiền không hợp lệ'); return; }
        try {
            const res = await api.customers.topup(selectedUser.id, amount);
            toast.success(`Nạp ${amount.toLocaleString()}đ thành công!`);
            setTopupModal(false);
            setTopupAmount('');
            setSelectedUser((prev: any) => ({ ...prev, wallet_balance: res.new_balance }));
            fetchUsers();
        } catch {
            toast.error('Nạp tiền thất bại');
        }
    };

    const handleDelete = async (user: any) => {
        if (!confirm(`Xác nhận xóa tài khoản "${user.name}"? Hành động này không thể khôi phục!`)) return;
        try {
            await api.customers.delete(user.id);
            toast.success('Đã xóa tài khoản');
            setSelectedUser(null);
            setDetailUser(null);
            fetchUsers();
        } catch {
            toast.error('Xóa thất bại');
        }
    };

    // Stats
    const totalUsers = users.filter(u => u.role === 'User').length;
    const totalStaff = users.filter(u => u.role === 'Staff').length;
    const totalAdmin = users.filter(u => u.role === 'Admin').length;

    const RoleBadge = ({ role }: { role: string }) => {
        const cfg = ROLE_CONFIG[role] || ROLE_CONFIG['User'];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                {cfg.icon} {cfg.label}
            </span>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users size={24} className="text-emerald-600" /> Khách Hàng & Cộng Đồng
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Quản lý tài khoản người dùng trong hệ thống</p>
                </div>
                <Button onClick={fetchUsers} variant="outline" className="gap-2 text-slate-600 border-slate-200">
                    <RefreshCw size={15} /> Làm mới
                </Button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Khách hàng', value: totalUsers, color: 'emerald', icon: <UserIcon size={18}/> },
                    { label: 'Nhân viên',  value: totalStaff, color: 'blue',    icon: <UserCog size={18}/> },
                    { label: 'Quản trị',   value: totalAdmin, color: 'purple',  icon: <Crown size={18}/> },
                ].map(s => (
                    <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4 flex items-center gap-3`}>
                        <div className={`w-10 h-10 rounded-lg bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center`}>{s.icon}</div>
                        <div>
                            <div className={`text-2xl font-black text-${s.color}-700`}>{s.value}</div>
                            <div className={`text-xs font-semibold text-${s.color}-500`}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-5">
                {/* Left panel: list */}
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* Filters */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm theo tên, email, số điện thoại..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                        >
                            <option value="all">Tất cả vai trò</option>
                            <option value="User">Khách hàng</option>
                            <option value="Staff">Nhân viên</option>
                            <option value="Admin">Quản trị</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <div className="text-slate-500 text-sm font-medium">Đang tải...</div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                                <div className="text-slate-500 font-medium">Không tìm thấy tài khoản nào</div>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Tên</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Liên hệ</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase">Vai trò</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase text-right">Số lần đặt</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase text-right">Số dư ví</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr
                                            key={u.id}
                                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
                                            onClick={() => openDetail(u)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                        {u.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{u.name}</div>
                                                        {u.google_id && <div className="text-[10px] text-blue-500 font-medium">Google Account</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-600">{u.email}</div>
                                                {u.phone && <div className="text-slate-400 text-xs mt-0.5">{u.phone}</div>}
                                            </td>
                                            <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-700">{u.booking_count}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold text-emerald-700">{(u.wallet_balance || 0).toLocaleString()}đ</span>
                                            </td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5 justify-center">
                                                    <button onClick={() => { openDetail(u); openEdit(u); }} title="Chỉnh sửa" className="p-1.5 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"><Edit2 size={14}/></button>
                                                    <button onClick={() => handleDelete(u)} title="Xóa" className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400 font-medium">
                            Tổng cộng: {users.length} tài khoản
                        </div>
                    </div>
                </div>

                {/* Right panel: detail */}
                {selectedUser && (
                    <div className="w-80 shrink-0 flex flex-col gap-3">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {/* Profile header */}
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 relative">
                                <button onClick={() => { setSelectedUser(null); setDetailUser(null); }} className="absolute top-3 right-3 text-white/70 hover:text-white">
                                    <X size={18}/>
                                </button>
                                <div className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center font-black text-2xl uppercase mb-3">
                                    {selectedUser.name?.charAt(0) || '?'}
                                </div>
                                <div className="text-white font-bold text-lg leading-tight">{selectedUser.name}</div>
                                <div className="mt-1.5"><RoleBadge role={selectedUser.role} /></div>
                            </div>

                            {/* Info */}
                            <div className="p-4 flex flex-col gap-3 text-sm">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Mail size={14} className="text-slate-400 shrink-0"/>
                                    <span className="truncate">{selectedUser.email}</span>
                                </div>
                                {selectedUser.phone && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Phone size={14} className="text-slate-400 shrink-0"/>
                                        <span>{selectedUser.phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600">
                                    <CalendarDays size={14} className="text-slate-400 shrink-0"/>
                                    <span>{selectedUser.booking_count} lần đặt sân</span>
                                </div>

                                {/* Wallet */}
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-semibold text-emerald-600 mb-0.5">Số dư ví</div>
                                        <div className="text-xl font-black text-emerald-700">{(selectedUser.wallet_balance || 0).toLocaleString()}đ</div>
                                    </div>
                                    <button
                                        onClick={() => setTopupModal(true)}
                                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                                    >
                                        <Plus size={13}/> Nạp tiền
                                    </button>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => openEdit(selectedUser)}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={13}/> Chỉnh sửa
                                    </button>
                                    <button
                                        onClick={() => handleDelete(selectedUser)}
                                        className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-3 py-2.5 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={13}/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Booking history */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 text-sm flex items-center gap-2">
                                <CalendarDays size={15} className="text-slate-400"/> Lịch sử đặt sân
                            </div>
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                {loadingDetail ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">Đang tải...</div>
                                ) : detailUser?.bookings?.length > 0 ? (
                                    detailUser.bookings.map((b: any) => {
                                        const ps = PAYMENT_LABELS[b.payment_status] || { label: b.payment_status, color: 'text-slate-600 bg-slate-100' };
                                        return (
                                            <div key={b.id} className="px-4 py-3 text-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{b.court_name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {new Date(b.start_time).toLocaleDateString('vi-VN')} · {new Date(b.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'})}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ps.color}`}>{ps.label}</span>
                                                </div>
                                                {b.note && <div className="text-xs text-slate-400 mt-1 truncate">{b.note}</div>}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 text-center text-slate-400 text-sm">Chưa có lịch sử đặt sân</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editModal && selectedUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">Chỉnh sửa tài khoản</h3>
                                <p className="text-slate-400 text-sm mt-0.5">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setEditModal(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Họ và tên</label>
                                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
                                <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số điện thoại</label>
                                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" placeholder="Chưa có" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vai trò</label>
                                <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white cursor-pointer">
                                    <option value="User">Khách hàng</option>
                                    <option value="Staff">Nhân viên</option>
                                    <option value="Admin">Quản trị</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">Hủy</button>
                                <button onClick={saveEdit} className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Lưu thay đổi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Topup Modal */}
            {topupModal && selectedUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
                        <div className="bg-emerald-600 text-white p-5 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2"><Wallet size={18}/> Nạp tiền ví</h3>
                                <p className="text-emerald-100 text-sm mt-0.5">{selectedUser.name}</p>
                            </div>
                            <button onClick={() => { setTopupModal(false); setTopupAmount(''); }} className="text-emerald-200 hover:text-white"><X size={18}/></button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="bg-emerald-50 p-3 rounded-lg text-center">
                                <div className="text-xs text-emerald-600 font-semibold mb-1">Số dư hiện tại</div>
                                <div className="text-2xl font-black text-emerald-700">{(selectedUser.wallet_balance || 0).toLocaleString()}đ</div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Số tiền nạp (VNĐ)</label>
                                <input
                                    type="number"
                                    value={topupAmount}
                                    onChange={e => setTopupAmount(e.target.value)}
                                    placeholder="Nhập số tiền..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 font-semibold"
                                    min="0"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {[50000, 100000, 200000, 500000].map(amt => (
                                    <button key={amt} onClick={() => setTopupAmount(String(amt))}
                                        className="flex-1 min-w-[70px] py-1.5 text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors border border-slate-200">
                                        +{(amt/1000).toFixed(0)}K
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setTopupModal(false); setTopupAmount(''); }} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Hủy</button>
                                <button onClick={handleTopup} className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Xác nhận nạp</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
