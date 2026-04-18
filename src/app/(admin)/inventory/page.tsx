'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, Package, AlertTriangle, X, Edit, Image as ImageIcon, History, PackagePlus, BarChart2, CheckCircle, XCircle, Clock, ArrowLeft, Droplets, UtensilsCrossed, Wrench, Tag, MoreHorizontal } from 'lucide-react';
import { api, Product } from '@/lib/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Nước uống', 'Thức ăn', 'Dụng cụ bán', 'Dụng cụ cho thuê', 'Khác'];
const UNITS = ['cái', 'chai', 'đôi', 'gói', 'lộ', 'hộp', 'giờ', 'tuần', 'tháng'];
const REASONS = ['Hết hạn', 'Hư hỏng tự nhiên', 'Khách làm hỏng'];

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
    'Nước uống':     { icon: <Droplets size={28}/>,        color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-300' },
    'Thức ăn':       { icon: <UtensilsCrossed size={28}/>,  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-300' },
    'Dụng cụ bán':   { icon: <Tag size={28}/>,              color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-300' },
    'Dụng cụ cho thuê': { icon: <Wrench size={28}/>,        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300' },
    'Khác':          { icon: <MoreHorizontal size={28}/>,   color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-300' },
};

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Tất cả');
    const [isAdmin, setIsAdmin] = useState(true);

    // Import kho: step 1 = chọn category, step 2 = form nhập
    const [importStep, setImportStep] = useState<'category' | 'form'>('category');
    const [importCategory, setImportCategory] = useState<string>('');
    const [importForm, setImportForm] = useState({
        product_id: 0,
        quantity: 1,
        unit_cost: 0,
        supplier_name: '',
        note: '',
        selling_price: 0,
        product_name: '',
        category: '',
        unit: 'cái',
        image_url: '',
    });
    const [importing, setImporting] = useState(false);

    // Stats state
    const [statsPeriod, setStatsPeriod] = useState<'day'|'range'|'month'|'year'>('month');
    const [statsValue, setStatsValue] = useState(() => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    });
    const [statsExtraFilter, setStatsExtraFilter] = useState<{date_from?: string; date_to?: string; category?: string}>({});
    const [statsData, setStatsData] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Modals state
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editModeId, setEditModeId] = useState<number | null>(null);
    const [damageProduct, setDamageProduct] = useState<Product | null>(null);

    // Upload state
    const [isUploading, setIsUploading] = useState(false);

    // Form state
    const initialFormState = { name: '', category: CATEGORIES[0], price: '', cost_price: '', stock_quantity: '', image_url: '', unit: 'cái', min_stock: '5'};
    const [formData, setFormData] = useState(initialFormState);

    // Log history filter
    const [logFilter, setLogFilter] = useState({ from: '', to: '', reason: 'all' });

    // Damage form state
    const [damageData, setDamageData] = useState({ reason: REASONS[0], amount: 1, compensation_amount: 0 });

    useEffect(() => {
        const role = document.cookie.includes('role=ADMIN') ? true : false;
        setIsAdmin(role);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [data, logsData] = await Promise.all([
                api.products.getAll(),
                api.inventory.getLogs()
            ]);
            setProducts(data);
            setLogs(logsData);
        } catch (error) {
            toast.error('Lỗi khi tải dữ liệu!');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!isAdmin) return toast.error('Bạn không có quyền thao tác này!');
        if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
        try {
            await api.products.delete(id);
            toast.success('Xóa sản phẩm thành công!');
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            toast.error('Xóa thất bại!');
        }
    };

    const openEditModal = (product: Product) => {
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            cost_price: product.cost_price.toString(),
            stock_quantity: product.stock_quantity.toString(),
            image_url: product.image_url || '',
            unit: (product as any).unit || 'cái',
            min_stock: String((product as any).min_stock ?? 5),
        });
        setEditModeId(product.id);
        setIsProductModalOpen(true);
    }

    const openCreateModal = () => {
        setFormData(initialFormState);
        setEditModeId(null);
        setIsProductModalOpen(true);
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        try {
            setIsUploading(true);
            const res = await api.uploadFile(file);
            setFormData(prev => ({ ...prev, image_url: res.url }));
            toast.success("Tải ảnh thành công!");
        } catch (error) {
            toast.error("Lỗi khi tải ảnh");
        } finally {
            setIsUploading(false);
        }
    }

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                category: formData.category,
                price: parseFloat(formData.price) || 0,
                cost_price: parseFloat(formData.cost_price) || 0,
                stock_quantity: parseInt(formData.stock_quantity) || 0,
                image_url: formData.image_url || '',
                unit: formData.unit || 'cái',
                min_stock: parseInt(formData.min_stock) || 5,
            };

            if (editModeId) {
                const updated = await api.products.update(editModeId, payload);
                setProducts(products.map(p => p.id === editModeId ? updated : p));
                toast.success('Cập nhật sản phẩm thành công!');
            } else {
                const newProduct = await api.products.create(payload);
                setProducts([...products, newProduct]);
                toast.success('Thêm sản phẩm thành công!');
            }

            setIsProductModalOpen(false);
        } catch (err) {
            toast.error('Lưu thất bại!');
        }
    };

    const handleDamageSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!damageProduct) return;
        try {
            if (damageData.amount <= 0 || damageData.amount > damageProduct.stock_quantity) {
                return toast.error("Số lượng hỏng không hợp lệ");
            }
            await api.products.reportDamage({
                product_id: damageProduct.id,
                reason: damageData.reason,
                amount: damageData.amount,
                compensation_amount: damageData.reason === 'Khách làm hỏng' ? damageData.compensation_amount : 0
            });
            toast.success('Báo cáo hỏng thành công!');
            fetchData();
            setDamageProduct(null);
            setDamageData({ reason: REASONS[0], amount: 1, compensation_amount: 0 });
        } catch (error: any) {
            toast.error(error.message || 'Báo hỏng thất bại!');
        }
    };

    const filteredProducts = useMemo(() => {
        if (activeTab === 'Tất cả') return products;
        return products.filter(p => p.category === activeTab);
    }, [products, activeTab]);

    // Lọc sản phẩm theo category đang nhập kho
    const filteredImportProducts = useMemo(() => {
        if (!importCategory) return products;
        return products.filter(p => p.category === importCategory);
    }, [products, importCategory]);

    const handleSelectImportCategory = (cat: string) => {
        setImportCategory(cat);
        setImportForm({
            product_id: 0,
            quantity: 1,
            unit_cost: 0,
            supplier_name: '',
            note: '',
            selling_price: 0,
            product_name: '',
            category: cat,
            unit: 'cái',
        image_url: '',
        });
        setImportStep('form');
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        try {
            setIsUploading(true);
            const res = await api.uploadFile(file);
            setImportForm(prev => ({ ...prev, image_url: res.url }));
            toast.success('Tải ảnh chứng từ thành công!');
        } catch { toast.error('Lỗi khi tải ảnh'); }
        finally { setIsUploading(false); }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        const pid = Number(importForm.product_id);
        if (pid === 0) return toast.error('Vui lòng chọn sản phẩm hoặc chọn Tạo mới!');
        if (pid === -1 && !importForm.product_name.trim()) return toast.error('Vui lòng nhập tên sản phẩm mới!');

        setImporting(true);
        try {
            const payload: any = {
                product_id: pid,
                quantity: importForm.quantity,
                unit_cost: importForm.unit_cost,
                supplier_name: importForm.supplier_name,
                note: importForm.note,
                selling_price: importForm.selling_price || undefined,
                product_name: pid === -1 ? importForm.product_name : undefined,
                category: pid === -1 ? importForm.category : undefined,
                image_url: importForm.image_url || undefined,
                user_name: isAdmin ? 'Chủ Sân' : 'Nhân Viên',
                is_admin: isAdmin,
            };
            const res = await api.inventory.import(payload);
            const msg = res.status === 'PENDING'
                ? 'Gửi yêu cầu thành công, chờ chủ duyệt!'
                : `Nhập kho thành công! Tồn mới: ${res.new_stock}`;
            toast.success(msg);
            fetchData();
            setImportStep('category');
            setImportCategory('');
            setImportForm({ product_id: 0, quantity: 1, unit_cost: 0, supplier_name: '', note: '', selling_price: 0, product_name: '', category: '', unit: 'cái', image_url: '' });
        } catch (err: any) {
            toast.error(err.message || 'Nhập kho thất bại!');
        } finally {
            setImporting(false);
        }
    };

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const params: any = { period: statsPeriod };
            if (statsPeriod === 'day') params.value = statsValue;
            else if (statsPeriod === 'range') {
                params.date_from = statsExtraFilter.date_from;
                params.date_to = statsExtraFilter.date_to;
            } else if (statsPeriod === 'month') params.value = statsValue;
            else if (statsPeriod === 'year') params.value = statsValue.split('-')[0];
            if (statsExtraFilter.category) params.category = statsExtraFilter.category;
            const data = await api.stats.products(params);
            setStatsData(data);
        } catch { toast.error('Lỗi tải thống kê'); }
        finally { setStatsLoading(false); }
    };

    const handleApproveDamage = async (logId: number) => {
        try {
            const res = await api.inventory.approveDamage(logId);
            toast.success(`Phê duyệt! Tồn mới: ${res.new_stock}`);
            fetchData();
        } catch (e: any) { toast.error(e.message || 'Lỗi duyệt'); }
    };

    const handleRejectDamage = async (logId: number) => {
        if (!confirm('Từ chối yêu cầu báo hỏng này?')) return;
        try {
            await api.inventory.rejectDamage(logId);
            toast.success('Từ chối báo hỏng');
            fetchData();
        } catch { toast.error('Lỗi từ chối'); }
    };

    // Reset import step khi chuyển tab khác
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab !== 'Nhập Kho') {
            setImportStep('category');
            setImportCategory('');
        }
    };

    const catMeta = CATEGORY_META[importCategory] || CATEGORY_META['Khác'];

    return (
        <div className="flex flex-col gap-6 relative pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Quản lý Kho hàng</h2>
                    <p className="text-slate-500 mt-1">Phân loại, kiểm kê, chỉnh sửa và xử lý rủi ro xuất kho.</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-max overflow-hidden flex-wrap">
                {['Tất cả', ...CATEGORIES, 'Nhập Kho', 'Thống Kê', 'Lịch sử lỗi'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => handleTabChange(cat)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                            activeTab === cat
                                ? (cat === 'Lịch sử lỗi' ? 'bg-orange-500 text-white shadow-sm'
                                    : cat === 'Nhập Kho' ? 'bg-sky-600 text-white shadow-sm'
                                    : cat === 'Thống Kê' ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white text-emerald-600 shadow-sm')
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        {cat === 'Lịch sử lỗi' && <History size={16} />}
                        {cat === 'Nhập Kho' && <PackagePlus size={16} />}
                        {cat === 'Thống Kê' && <BarChart2 size={16} />}
                        {cat}
                    </button>
                ))}
            </div>

            <Card className="overflow-hidden bg-white shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                                        {/* ============ NHẬP KHO ============ */}
                    {activeTab === 'Nhập Kho' ? (
                        <div className="p-6">
                            {importStep === 'category' ? (
                                /* BƯỚC 1: Chọn danh mục */
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-lg">
                                        <PackagePlus size={20} className="text-sky-500"/> Nhập Hàng Vào Kho
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-6">Chọn nhóm hàng bạn muốn nhập vào kho:</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {CATEGORIES.map(cat => {
                                            const meta = CATEGORY_META[cat];
                                            const count = products.filter(p => p.category === cat).length;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => handleSelectImportCategory(cat)}
                                                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${meta.bg} ${meta.border} cursor-pointer`}
                                                >
                                                    <div className={`${meta.color}`}>{meta.icon}</div>
                                                    <div className="text-center">
                                                        <div className={`font-bold text-sm ${meta.color}`}>{cat}</div>
                                                        <div className="text-xs text-slate-400 mt-0.5">{count} sản phẩm</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                /* BƯỚC 2: Form nhập */
                                <div className="max-w-xl">
                                    {/* Header với nút quay lại */}
                                    <div className="flex items-center gap-3 mb-6">
                                        <button
                                            onClick={() => { setImportStep('category'); setImportCategory(''); }}
                                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors"
                                        >
                                            <ArrowLeft size={16}/> Quay lại
                                        </button>
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${catMeta.bg} ${catMeta.color} border ${catMeta.border}`}>
                                            {catMeta.icon && <span className="scale-75">{catMeta.icon}</span>}
                                            {importCategory}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                                        <PackagePlus size={18} className="text-sky-500"/> Nhập Hàng — {importCategory}
                                    </h3>

                                    <form onSubmit={handleImport} className="flex flex-col gap-4">

                                        {/* Chọn sản phẩm */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Chọn Sản Phẩm</label>
                                            <select
                                                value={importForm.product_id}
                                                onChange={e => {
                                                    const pid = Number(e.target.value);
                                                    const p = products.find(x => x.id === pid);
                                                    setImportForm(prev => ({
                                                        ...prev,
                                                        product_id: pid,
                                                        unit_cost: p ? p.cost_price : prev.unit_cost,
                                                        selling_price: p ? p.price : prev.selling_price,
                                                        product_name: pid === -1 ? '' : (p ? p.name : ''),
                                                        unit: p ? ((p as any).unit || 'cái') : 'cái',
                                                    }));
                                                }}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-sky-400 font-semibold"
                                            >
                                                <option value={0}>-- Chọn sản phẩm có sẵn --</option>
                                                <option value={-1} className="text-emerald-600 font-bold">+ TẠO SẢN PHẨM MỚI</option>
                                                {filteredImportProducts.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} (Tồn: {p.stock_quantity} {(p as any).unit})</option>
                                                ))}
                                                {filteredImportProducts.length === 0 && products.filter(p => p.category !== importCategory).map(p => (
                                                    <option key={p.id} value={p.id} disabled style={{color: '#999'}}>
                                                        [{p.category}] {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {filteredImportProducts.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1">⚠ Chưa có sản phẩm nào thuộc nhóm &quot;{importCategory}&quot;. Chọn &quot;Tạo sản phẩm mới&quot;.</p>
                                            )}
                                        </div>

                                        {/* Tên sản phẩm mới (chỉ hiện khi pid = -1) */}
                                        {Number(importForm.product_id) === -1 && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                <div>
                                                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1.5 block">Tên Sản Phẩm Mới *</label>
                                                    <input
                                                        type="text"
                                                        value={importForm.product_name}
                                                        onChange={e => setImportForm({...importForm, product_name: e.target.value})}
                                                        className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white"
                                                        placeholder="Nhập tên sản phẩm mới..."
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1.5 block">Danh Mục</label>
                                                        <select
                                                            value={importForm.category}
                                                            onChange={e => setImportForm({...importForm, category: e.target.value})}
                                                            className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                                                        >
                                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1.5 block">Đơn Vị Tính</label>
                                                        <select
                                                            value={importForm.unit}
                                                            onChange={e => setImportForm({...importForm, unit: e.target.value})}
                                                            className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                                                        >
                                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Số lượng + đơn vị */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Số Lượng Nhập</label>
                                                <input type="number" min={1} value={importForm.quantity} onChange={e => setImportForm({...importForm, quantity: Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" required/>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Đơn vị tính</label>
                                                <div className="flex items-center h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic">
                                                    {Number(importForm.product_id) > 0 ? ((products.find(p => p.id === Number(importForm.product_id)) as any)?.unit || 'cái') : (Number(importForm.product_id) === -1 ? importForm.unit : 'Mặc định: cái')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Giá nhập + giá bán */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1.5 block">Giá Nhập / Đơn Vị</label>
                                                <div className="relative">
                                                    <input type="number" min={0} value={importForm.unit_cost} onChange={e => setImportForm({...importForm, unit_cost: Number(e.target.value)})} className="w-full border border-orange-200 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:border-orange-400 font-bold text-orange-600"/>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">VND</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1.5 block">Giá Bán Niêm Yết</label>
                                                <div className="relative">
                                                    <input type="number" min={0} value={importForm.selling_price} onChange={e => setImportForm({...importForm, selling_price: Number(e.target.value)})} className="w-full border border-sky-200 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:border-sky-400 font-bold text-sky-600"/>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">VND</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nhà cung cấp + ghi chú */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Nhà Cung Cấp</label>
                                            <input list="suppliers-list" type="text" value={importForm.supplier_name} onChange={e => setImportForm({...importForm, supplier_name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" placeholder="Chọn có sẵn hoặc nhập mới..."/>
                                            <datalist id="suppliers-list">
                                                {Array.from(new Set(products.map(p => (p as any).supplier_name).filter(Boolean))).map((s: any) => <option key={s} value={s} />)}
                                            </datalist>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ghi Chú</label>
                                            <input type="text" value={importForm.note} onChange={e => setImportForm({...importForm, note: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" placeholder="Ghi chú..."/>
                                        </div>

                                        {/* Ảnh chứng từ */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ảnh hóa đơn / Chứng từ</label>
                                            <div className="flex items-center gap-3">
                                                <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                                    {importForm.image_url ? <img src={importForm.image_url} className="w-full h-full object-cover" alt="proof" /> : <ImageIcon size={20} className="text-slate-300"/>}
                                                </div>
                                                <label className="cursor-pointer inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                                    <ImageIcon size={15} /> Chọn ảnh...
                                                    <input type="file" accept="image/*" onChange={handleImportFileChange} className="hidden" />
                                                </label>
                                                {isUploading && <span className="text-xs text-sky-500 animate-pulse">Đang tải...</span>}
                                            </div>
                                        </div>

                                        <Button type="submit" disabled={importing} className="gap-2 bg-sky-600 hover:bg-sky-700 h-12 shadow-lg shadow-sky-100">
                                            <PackagePlus size={18}/>
                                            {importing ? 'Đang thực hiện...' : (
                                                Number(importForm.product_id) === -1
                                                    ? 'Tạo Mới & Nhập Kho'
                                                    : (isAdmin ? 'Xác Nhận Nhập Kho' : 'Gửi Yêu Cầu Nhập Kho')
                                            )}
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'Lịch sử lỗi' ? (
                        <div className="flex flex-col">
                            {/* Filter bar */}
                            <div className="flex flex-wrap gap-3 items-center p-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Từ ngày</label>
                                    <input type="date" value={logFilter.from} onChange={e => setLogFilter(p => ({...p, from: e.target.value}))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"/>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Đến ngày</label>
                                    <input type="date" value={logFilter.to} onChange={e => setLogFilter(p => ({...p, to: e.target.value}))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"/>
                                </div>
                                <div className="flex bg-slate-200/50 p-1 rounded-lg">
                                    <button onClick={() => setLogFilter(p => ({...p, reason: 'all'}))} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${logFilter.reason === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả</button>
                                    <button onClick={() => setLogFilter(p => ({...p, reason: 'STOCK_IN'}))} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${logFilter.reason === 'STOCK_IN' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Nhập kho</button>
                                    <button onClick={() => setLogFilter(p => ({...p, reason: 'SALE'}))} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${logFilter.reason === 'SALE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Xuất bán</button>
                                    <button onClick={() => setLogFilter(p => ({...p, reason: 'DAMAGE'}))} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${logFilter.reason === 'DAMAGE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Lỗi/Hỏng</button>
                                </div>
                                {(logFilter.from || logFilter.to || logFilter.reason !== 'all') && (
                                    <button onClick={() => setLogFilter({ from: '', to: '', reason: 'all' })} className="text-xs text-rose-500 hover:underline font-semibold">✕ Bỏ lọc</button>
                                )}
                                <span className="ml-auto text-xs text-slate-400">{
                                    logs.filter(l => {
                                        if (logFilter.reason !== 'all') {
                                            if (logFilter.reason === 'STOCK_IN' && l.type !== 'IMPORT') return false;
                                            if (logFilter.reason === 'SALE' && l.type !== 'SALE') return false;
                                            if (logFilter.reason === 'DAMAGE' && l.type !== 'DAMAGE') return false;
                                        }
                                        if (logFilter.from && l.timestamp && new Date(l.timestamp) < new Date(logFilter.from)) return false;
                                        if (logFilter.to && l.timestamp && new Date(l.timestamp) > new Date(logFilter.to + 'T23:59:59')) return false;
                                        return true;
                                    }).length
                                } bản ghi</span>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-semibold text-sm tracking-wider uppercase border-b border-slate-200">
                                    <th className="p-4">Thời gian</th>
                                    <th className="p-4">Nhân Viên</th>
                                    <th className="p-4">Sản Phẩm</th>
                                    <th className="p-4 text-center">Số lượng</th>
                                    <th className="p-4">Loại</th>
                                    <th className="p-4 text-center">Trạng Thái</th>
                                    <th className="p-4">Chứng từ</th>
                                    {isAdmin && <th className="p-4 text-center">Hành động</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const filtered = logs.filter((l: any) => {
                                        if (logFilter.reason !== 'all') {
                                            if (logFilter.reason === 'STOCK_IN' && l.type !== 'IMPORT') return false;
                                            if (logFilter.reason === 'SALE' && l.type !== 'SALE') return false;
                                            if (logFilter.reason === 'DAMAGE' && l.type !== 'DAMAGE') return false;
                                        }
                                        if (logFilter.from && l.timestamp && new Date(l.timestamp) < new Date(logFilter.from)) return false;
                                        if (logFilter.to && l.timestamp && new Date(l.timestamp) > new Date(logFilter.to + 'T23:59:59')) return false;
                                        return true;
                                    });
                                    if (filtered.length === 0) return (
                                        <tr><td colSpan={8} className="p-12 text-center text-slate-400">Không có dữ liệu phù hợp.</td></tr>
                                    );
                                    return filtered.map((log: any) => {
                                        const isPending = log.status === 'PENDING' || log.status === 'Pending';
                                        const isApproved = log.status === 'APPROVED' || log.status === 'Approved';
                                        const isRejected = log.status === 'REJECTED' || log.status === 'Rejected';
                                        return (
                                        <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isPending ? 'bg-amber-50/40' : ''}`}>
                                            <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                                {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '—'}
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-emerald-700">
                                                👤 {log.user_name || 'Hệ thống'}
                                            </td>
                                            <td className="p-4 font-medium text-slate-800">{log.product_name}</td>
                                            <td className="p-4 text-center">
                                                <span className={`font-bold text-sm ${log.change_amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-slate-100 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600">{log.reason_label || log.reason}</span>
                                                {log.note && <div className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate" title={log.note}>{log.note}</div>}
                                            </td>
                                            <td className="p-4 text-center">
                                                {isPending && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full"><Clock size={10}/> Chờ duyệt</span>}
                                                {isApproved && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full"><CheckCircle size={10}/> Đã duyệt</span>}
                                                {isRejected && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full"><XCircle size={10}/> Từ chối</span>}
                                            </td>
                                            <td className="p-4">
                                                {log.image_url ? <a href={log.image_url} target="_blank" className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-semibold"><ImageIcon size={13}/> Xem HĐ</a> : <span className="text-xs text-slate-300">—</span>}
                                            </td>
                                            {isAdmin && (
                                                <td className="p-4 text-center">
                                                    <div className="flex gap-1 justify-center">
                                                        {isPending && <>
                                                            <button onClick={() => api.inventory.approveLog(log.id).then(() => { toast.success('Đã duyệt nhập kho'); fetchData(); }).catch(() => toast.error('Lỗi duyệt'))} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Phê duyệt"><CheckCircle size={15}/></button>
                                                            <button onClick={() => { if(confirm('Từ chối phiếu này?')) api.inventory.rejectLog(log.id).then(() => { toast.success('Đã từ chối'); fetchData(); }).catch(() => toast.error('Lỗi')) }} className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Từ chối"><XCircle size={15}/></button>
                                                        </>}
                                                        <button onClick={() => { if(confirm('Xoá phiếu này? Nếu đã duyệt tồn kho sẽ bị trừ lại.')) api.inventory.deleteLog(log.id, true).then(() => { toast.success('Đã xoá'); fetchData(); }).catch(() => toast.error('Lỗi xoá')) }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xoá"><Trash2 size={15}/></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                        </div>
                        </div>

                    ) : activeTab === 'Thống Kê' ? (
                        <div className="p-6 flex flex-col gap-5">
                            {/* ===== FILTER CONTROLS ===== */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex flex-wrap gap-3 items-end">
                                    {/* Period type selector */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kiểu kỳ</label>
                                        <select
                                            value={statsPeriod}
                                            onChange={e => {
                                                setStatsPeriod(e.target.value as any);
                                                setStatsData(null);
                                            }}
                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400 font-semibold"
                                        >
                                            <option value="day">Theo Ngày</option>
                                            <option value="range">Khoảng Ngày</option>
                                            <option value="month">Theo Tháng</option>
                                            <option value="year">Theo Năm</option>
                                        </select>
                                    </div>

                                    {/* Value inputs based on period */}
                                    {statsPeriod === 'day' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ngày</label>
                                            <input type="date" value={statsValue}
                                                onChange={e => setStatsValue(e.target.value)}
                                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                            />
                                        </div>
                                    )}
                                    {statsPeriod === 'range' && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Từ ngày</label>
                                                <input type="date" value={(statsExtraFilter as any).date_from || ''}
                                                    onChange={e => setStatsExtraFilter((p: any) => ({...p, date_from: e.target.value}))}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Đến ngày</label>
                                                <input type="date" value={(statsExtraFilter as any).date_to || ''}
                                                    onChange={e => setStatsExtraFilter((p: any) => ({...p, date_to: e.target.value}))}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {statsPeriod === 'month' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tháng</label>
                                            <input type="month" value={statsValue}
                                                onChange={e => setStatsValue(e.target.value)}
                                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                            />
                                        </div>
                                    )}
                                    {statsPeriod === 'year' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Năm</label>
                                            <input type="number" min="2020" max="2099" value={statsValue.split('-')[0]}
                                                onChange={e => setStatsValue(e.target.value)}
                                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 w-28"
                                                placeholder="2026"
                                            />
                                        </div>
                                    )}

                                    {/* Category filter */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Danh mục</label>
                                        <select
                                            value={(statsExtraFilter as any).category || ''}
                                            onChange={e => setStatsExtraFilter((p: any) => ({...p, category: e.target.value || undefined}))}
                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-400"
                                        >
                                            <option value="">Tất cả danh mục</option>
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <button
                                        onClick={fetchStats}
                                        disabled={statsLoading}
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-60 flex items-center gap-2 self-end"
                                    >
                                        <BarChart2 size={15}/>
                                        {statsLoading ? 'Đang tải...' : 'Xem Thống Kê'}
                                    </button>

                                    {statsData && (
                                        <button
                                            onClick={() => { setStatsData(null); setStatsExtraFilter({}); }}
                                            className="text-xs text-rose-500 hover:underline font-semibold self-end pb-2"
                                        >✕ Xóa kết quả</button>
                                    )}
                                </div>
                            </div>

                            {/* ===== STATS RESULTS ===== */}
                            {statsData ? (
                                <div className="flex flex-col gap-5">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                            <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mb-1">Tổng SL Bán</div>
                                            <div className="text-2xl font-extrabold text-indigo-700">{statsData.total_qty.toLocaleString()}</div>
                                            <div className="text-xs text-indigo-400 mt-0.5">sản phẩm</div>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                            <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Doanh Thu</div>
                                            <div className="text-xl font-extrabold text-emerald-700">{(statsData.total_revenue || 0).toLocaleString()}</div>
                                            <div className="text-xs text-emerald-400 mt-0.5">đồng</div>
                                        </div>
                                        {statsData.by_category.slice(0, 2).map((cat: any) => (
                                            <div key={cat.category} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 truncate">{cat.category}</div>
                                                <div className="text-xl font-extrabold text-slate-700">{cat.qty_sold.toLocaleString()}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{(cat.revenue || 0).toLocaleString()}đ</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* By category breakdown */}
                                    {statsData.by_category.length > 0 && (
                                        <div>
                                            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-widest">Theo Danh Mục</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                                {statsData.by_category.map((cat: any) => {
                                                    const pct = statsData.total_qty > 0 ? (cat.qty_sold / statsData.total_qty) * 100 : 0;
                                                    const meta = CATEGORY_META[cat.category] || CATEGORY_META['Khác'];
                                                    return (
                                                        <div key={cat.category} className={`${meta.bg} ${meta.border} border rounded-xl p-3 flex flex-col gap-1`}>
                                                            <div className={`flex items-center gap-1.5 ${meta.color} font-bold text-xs`}>{meta.icon} {cat.category}</div>
                                                            <div className="text-lg font-extrabold text-slate-800">{cat.qty_sold.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-1">sp</span></div>
                                                            <div className="text-xs text-slate-500">{(cat.revenue || 0).toLocaleString()}đ</div>
                                                            <div className="w-full bg-white/60 rounded-full h-1.5 mt-1">
                                                                <div className={`h-full ${meta.color.replace('text-', 'bg-')} rounded-full`} style={{width: `${pct}%`}}/>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">{pct.toFixed(1)}%</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Product table */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-widest">
                                            Chi Tiết Theo Sản Phẩm
                                            {(statsExtraFilter as any).category && <span className="ml-2 text-indigo-500">({(statsExtraFilter as any).category})</span>}
                                        </h4>
                                        {statsData.by_product.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                <BarChart2 size={32} className="mx-auto mb-2 opacity-30"/>
                                                Không có dữ liệu bán hàng trong kỳ này.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-500 font-semibold text-xs tracking-widest uppercase border-b border-slate-200">
                                                            <th className="p-3 w-8">#</th>
                                                            <th className="p-3">Sản Phẩm</th>
                                                            <th className="p-3">Danh Mục</th>
                                                            <th className="p-3 text-right">Giá Bán</th>
                                                            <th className="p-3 text-right">SL Bán</th>
                                                            <th className="p-3 text-right">Doanh Thu</th>
                                                            <th className="p-3 text-right">GD</th>
                                                            <th className="p-3">Tỷ Lệ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {statsData.by_product.map((p: any, i: number) => {
                                                            const pct = statsData.total_qty > 0 ? (p.qty_sold / statsData.total_qty) * 100 : 0;
                                                            return (
                                                                <tr key={p.product_id} className="hover:bg-indigo-50/30 transition-colors">
                                                                    <td className="p-3 text-xs font-bold text-slate-400">{i+1}</td>
                                                                    <td className="p-3 font-semibold text-slate-800">{p.product_name}</td>
                                                                    <td className="p-3"><span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-semibold text-slate-500">{p.category}</span></td>
                                                                    <td className="p-3 text-right text-sm text-slate-500">{(p.price || 0).toLocaleString()}đ</td>
                                                                    <td className="p-3 text-right font-bold text-indigo-600">{p.qty_sold} <span className="text-xs font-normal text-slate-400">{p.unit}</span></td>
                                                                    <td className="p-3 text-right font-bold text-emerald-600">{(p.revenue || 0).toLocaleString()}đ</td>
                                                                    <td className="p-3 text-right text-slate-500 text-sm">{p.transactions}</td>
                                                                    <td className="p-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[50px]">
                                                                                <div className="h-full bg-indigo-400 rounded-full" style={{width:`${pct}%`}}/>
                                                                            </div>
                                                                            <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-slate-400">
                                    <BarChart2 size={56} className="mx-auto opacity-10 mb-4"/>
                                    <p className="text-base">Chọn kỳ báo cáo và nhấn <strong className="text-indigo-500">Xem Thống Kê</strong></p>
                                    <p className="text-sm mt-1 text-slate-300">Hỗ trợ: theo ngày, khoảng ngày, tháng, năm và lọc theo danh mục</p>
                                </div>
                            )}
                        </div>

                    ) : (
                        /* Bảng danh sách sản phẩm */
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-semibold text-sm tracking-wider uppercase border-b border-slate-200">
                                    <th className="p-4 w-16">Ảnh</th>
                                    <th className="p-4">Sản Phẩm</th>
                                    <th className="p-4">Danh Mục</th>
                                    <th className="p-4 text-right">Tồn Kho</th>
                                    <th className="p-4 text-right">Giá Bán</th>
                                    {isAdmin && <th className="p-4 text-right text-orange-500">Giá Vốn</th>}
                                    <th className="p-4 text-center">Hành Động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-400">
                                            <Package size={48} className="mx-auto mb-3 opacity-20" />
                                            <p>Kho hàng danh mục [{activeTab}] đang trống.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 text-slate-400">
                                                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-slate-800 leading-tight">{product.name}</td>
                                            <td className="p-4 text-slate-500 text-sm">
                                                <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold">{product.category}</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`font-semibold ${product.stock_quantity < 5 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {product.stock_quantity}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-700">{product.price.toLocaleString()} đ</td>
                                            {isAdmin && (
                                                <td className="p-4 text-right text-orange-500 font-medium">{product.cost_price.toLocaleString()} đ</td>
                                            )}
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setDamageProduct(product)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                                                        disabled={product.stock_quantity <= 0}
                                                    >
                                                        <AlertTriangle size={16} /> Báo hỏng
                                                    </button>
                                                    {isAdmin && (
                                                        <div className="flex items-center ml-2 border-l pl-2 border-slate-200 gap-1">
                                                            <button onClick={() => openEditModal(product)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100" title="Sửa">
                                                                <Edit size={16} />
                                                            </button>
                                                            <button onClick={() => handleDelete(product.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Xóa vĩnh viễn">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            
            {/* PRODUCT MODAL (ADD / EDIT) */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <Card className="w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editModeId ? 'Sửa thông tin sản phẩm' : 'Thêm Sản Phẩm Mới'}</h3>
                            <button type="button" onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleProductSubmit} className="p-6 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Ảnh minh họa</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                            {formData.image_url ? <img src={formData.image_url} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300"/>}
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-sm cursor-pointer inline-flex items-center justify-center gap-2 py-2 px-4 rounded-full border-0 font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                                <ImageIcon size={16} /> Chọn ảnh mới...
                                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                            </label>
                                            <p className="text-xs text-slate-400 mt-1 italic">
                                                {formData.image_url && editModeId ? '(Bỏ trống nếu giữ ảnh cũ)' : '(Không bắt buộc)'}
                                            </p>
                                            {isUploading && <span className="text-xs font-semibold text-emerald-500 block mt-1 animate-pulse">Đang tải ảnh lên máy chủ...</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tên mặt hàng</label>
                                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-emerald-500" placeholder="Vd: Nước khoáng Aquafina" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Phân loại</label>
                                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-emerald-500 bg-white">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Đơn vị tính</label>
                                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-emerald-500 bg-white">
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">SL Tồn Kho</label>
                                    <input required value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} type="number" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1.5 block">Giá vốn (Nhập)</label>
                                    <input required value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} type="number" min="0" className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-orange-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1.5 block">Giá Bán Niêm yết</label>
                                    <input required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="number" min="0" className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-emerald-500" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                                <Button type="button" variant="ghost" onClick={() => setIsProductModalOpen(false)}>Hủy</Button>
                                <Button type="submit" disabled={isUploading}>{editModeId ? 'Cập nhật Sản Phẩm' : 'Lưu Sản Phẩm'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* REPORT DAMAGE MODAL */}
            {damageProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <Card className="w-full max-md shadow-2xl border-rose-500 border-t-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-rose-50/50">
                            <div>
                                <h3 className="font-bold text-lg text-rose-700 flex items-center gap-2"><AlertTriangle size={20} /> Báo Cáo Hỏng / Mất Hàng</h3>
                                <p className="text-sm text-slate-500 mt-0.5 font-medium">{damageProduct.name} - Kho: {damageProduct.stock_quantity}</p>
                            </div>
                            <button onClick={() => setDamageProduct(null)} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleDamageSubmit} className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Nguyên nhân xuất kho / Ghi nhận</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {REASONS.map(r => (
                                        <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${damageData.reason === r ? 'border-rose-500 bg-rose-50/50' : 'border-slate-100 hover:border-slate-300'}`}>
                                            <input type="radio" name="reason" value={r} checked={damageData.reason === r} onChange={() => setDamageData({...damageData, reason: r})} className="accent-rose-500 w-4 h-4"/>
                                            <span className="text-sm font-semibold text-slate-700">{r}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Số lượng báo hỏng</label>
                                    <input type="number" min="1" max={damageProduct.stock_quantity} value={damageData.amount} onChange={e => setDamageData({...damageData, amount: parseInt(e.target.value) || 1})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-rose-500"/>
                                </div>
                                {damageData.reason === 'Khách làm hỏng' ? (
                                    <div className="animate-in slide-in-from-right-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tiền Bồi Thường (VND)</label>
                                        <input type="number" min="0" value={damageData.compensation_amount} onChange={e => setDamageData({...damageData, compensation_amount: parseFloat(e.target.value) || 0})} className="w-full border-2 border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2 text-sm text-emerald-700 font-bold focus:outline-emerald-500 shadow-inner"/>
                                    </div>
                                ) : (
                                    <div className="flex flex-col justify-end pb-2 opacity-50">
                                        <div className="text-xs text-slate-400 font-medium italic">Không yêu cầu đền bù. Cập nhật vào Chi Phí Hao Mòn.</div>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button type="button" variant="ghost" onClick={() => setDamageProduct(null)}>Hủy bỏ</Button>
                                <Button type="submit" className="bg-rose-600 hover:bg-rose-700">Xác Nhận Trừ Kho</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
