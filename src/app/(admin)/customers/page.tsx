'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
    Users, Search, X, Edit2, Trash2, Wallet, RefreshCw,
    Phone, Mail, CalendarDays, BadgeCheck, Crown, UserCog, Plus, User as UserIcon
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
    const [activeTab, setActiveTab] = useState<'list' | 'requests'>('list');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [detailUser, setDetailUser] = useState<any | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Modals
    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: 'User' });
    const [topupModal, setTopupModal] = useState(false);
    const [topupAmount, setTopupAmount] = useState('');

    // Pending requests
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [activeRequest, setActiveRequest] = useState<any | null>(null);
    const [processing, setProcessing] = useState(false);

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

    const fetchPendingRequests = useCallback(async () => {
        try {
            const data = await api.customers.getPendingTopups();
            setPendingRequests(data);
        } catch (err) {
            console.error("Failed to fetch pending topups:", err);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchPendingRequests();
        
        // Polling for new requests every 30s
        const interval = setInterval(fetchPendingRequests, 30000);
        return () => clearInterval(interval);
    }, [fetchUsers, fetchPendingRequests, activeTab]);

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

    const handleApproveTopup = async (req: any) => {
        setProcessing(true);
        try {
            await api.customers.approveTopup(req.id);
            toast.success(`Đã nạp ${req.amount.toLocaleString()}đ cho ${req.user_name}`);
            fetchPendingRequests();
            fetchUsers();
            setActiveRequest(null);
        } catch (err: any) {
            toast.error(err.message || 'Duyệt thất bại');
        } finally {
            setProcessing(false);
        }
    };

    const handleRejectTopup = async (req: any) => {
        if (!confirm("Từ chối yêu cầu nạp tiền này?")) return;
        setProcessing(true);
        try {
            await api.customers.rejectTopup(req.id);
            toast.success('Đã từ chối yêu cầu');
            fetchPendingRequests();
            setActiveRequest(null);
        } catch (err: any) {
            toast.error(err.message || 'Từ chối thất bại');
        } finally {
            setProcessing(false);
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
                    <p className="text-slate-500 text-sm mt-1">Quản lý tài khoản và yêu cầu nạp tiền</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => { fetchUsers(); fetchPendingRequests(); }} variant="outline" className="gap-2 text-slate-600 border-slate-200">
                        <RefreshCw size={15} /> Làm mới
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 gap-8">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'list' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Danh sách tài khoản
                    {activeTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 animate-in fade-in duration-300"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'requests' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Yêu cầu nạp tiền
                    {pendingRequests.length > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                            {pendingRequests.length}
                        </span>
                    )}
                    {activeTab === 'requests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 animate-in fade-in duration-300"></div>}
                </button>
            </div>

            {activeTab === 'list' ? (
                <>
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
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <Wallet size={20} className="text-amber-500" /> Các yêu cầu nạp tiền đang chờ duyệt
                        </h3>
                    </div>
                    
                    {pendingRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                                <Wallet size={40} className="text-slate-200" />
                            </div>
                            <p className="font-medium">Hiện không có yêu cầu nạp tiền nào mới</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingRequests.map(req => (
                                <div key={req.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-bold text-sm uppercase">
                                                {req.user_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{req.user_name}</div>
                                                <div className="text-[10px] text-slate-500 font-medium">{new Date(req.timestamp).toLocaleString('vi-VN')}</div>
                                            </div>
                                        </div>
                                        <div className="text-emerald-600 font-black text-xl">+{req.amount.toLocaleString()}đ</div>
                                    </div>
                                    
                                    {req.proof_url && (
                                        <div className="relative h-40 rounded-xl overflow-hidden border border-slate-200 group cursor-zoom-in shadow-inner" onClick={() => setActiveRequest(req)}>
                                            <img src={req.proof_url} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity gap-2">
                                                <Search size={20}/>
                                                Bấm để xem biên lai
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2 mt-auto">
                                        <button 
                                            onClick={() => handleRejectTopup(req)}
                                            className="flex-1 py-3 rounded-xl bg-white text-rose-500 text-xs font-bold border border-rose-100 hover:bg-rose-50 transition-colors"
                                        >
                                            Từ chối
                                        </button>
                                        <button 
                                            onClick={() => handleApproveTopup(req)}
                                            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                                        >
                                            <BadgeCheck size={16}/> Duyệt & Nạp
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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

            {/* Request Detail Modal (Zoom proof) */}
            {activeRequest && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl uppercase">
                                    {activeRequest.user_name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Chi tiết yêu cầu nạp tiền</h3>
                                    <p className="text-slate-500 text-xs font-medium">{activeRequest.user_name} · {activeRequest.user_email}</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveRequest(null)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"><X size={24}/></button>
                        </div>
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-900">
                                {activeRequest.proof_url ? (
                                    <img src={activeRequest.proof_url} alt="Proof Large" className="max-h-[50vh] object-contain rounded-xl shadow-2xl" />
                                ) : (
                                    <div className="text-white/40 flex flex-col items-center gap-2">
                                        <Wallet size={64}/>
                                        <span>Không có ảnh minh chứng</span>
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-72 p-6 flex flex-col gap-6 bg-white">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Số tiền yêu cầu</div>
                                    <div className="text-3xl font-black text-emerald-600 tracking-tighter">{activeRequest.amount.toLocaleString()}đ</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thời gian gửi</div>
                                    <div className="text-sm font-semibold text-slate-700">{new Date(activeRequest.timestamp).toLocaleString('vi-VN')}</div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ghi chú từ khách</div>
                                    <p className="text-xs text-slate-600 italic">"{activeRequest.note || 'Không có ghi chú'}"</p>
                                </div>
                                
                                <div className="mt-auto flex flex-col gap-2">
                                    <button 
                                        onClick={() => handleApproveTopup(activeRequest)}
                                        disabled={processing}
                                        className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {processing ? 'Đang duyệt...' : <><BadgeCheck size={18}/> Duyệt & Nạp</>}
                                    </button>
                                    <button 
                                        onClick={() => handleRejectTopup(activeRequest)}
                                        disabled={processing}
                                        className="w-full py-3 rounded-2xl bg-slate-100 text-rose-500 font-bold hover:bg-rose-50 transition-colors"
                                    >
                                        Từ chối yêu cầu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
