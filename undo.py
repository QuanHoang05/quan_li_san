import re

with open('src/app/(admin)/inventory/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Reverse 1: Update form state
code = code.replace(
    "unit: 'cái',\n        image_url: '',",
    "unit: 'cái',"
)

# Reverse 2: isImportModalOpen
code = code.replace(
    "const [isProductModalOpen, setIsProductModalOpen] = useState(false);\n    const [isImportModalOpen, setIsImportModalOpen] = useState(false);",
    "const [isProductModalOpen, setIsProductModalOpen] = useState(false);"
)

# Reverse 3: handleImportSubmit function
handleImport_new = """    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setImporting(true);
            const req = { 
                ...importForm, 
                user_name: isAdmin ? 'Chủ Sân' : 'Nhân Viên',
                is_admin: isAdmin 
            };
            if (Number(req.product_id) !== -1) {
                req.product_name = undefined;
                req.selling_price = undefined;
            }
            const res = await api.inventory.import(req);
            toast.success(res.status === 'APPROVED' ? `Nhập kho thành công! Tồn mới: ${res.new_stock}` : 'Nhập kho thành công! Đang chờ chủ sân duyệt.');
            fetchData();
            setIsImportModalOpen(false);
            setImportStep('category');
            setImportCategory('');
            setImportForm({ product_id: 0, quantity: 1, unit_cost: 0, supplier_name: '', note: '', selling_price: 0, product_name: '', category: '', unit: 'cái', image_url: '' });
        } catch (err: any) {
            toast.error(err.message || 'Nhập kho thất bại!');
        } finally {
            setImporting(false);
        }
    };

    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        try {
            setIsUploading(true);
            const res = await api.uploadFile(file);
            setImportForm(prev => ({ ...prev, image_url: res.url }));
            toast.success("Tải ảnh chứng từ thành công!");
        } catch (error) {
            toast.error("Lỗi khi tải ảnh");
        } finally {
            setIsUploading(false);
        }
    };

    const handleEditLog = async (log: any) => {
        const newReason = prompt("Lý do chi tiết (VD: Ghi chú mới...)", log.note || "");
        if (newReason === null) return;
        try {
            await api.inventory.updateLog(log.id, { note: newReason, is_admin: isAdmin });
            toast.success("Cập nhật ghi chú thành công");
            fetchData();
        } catch(e) { toast.error("Lỗi cập nhật"); }
    };

    const handleDeleteLog = async (log: any) => {
        if (!confirm("Bạn chắc chắn muốn xoá phiếu nhập/xuất này? Nếu đã duyệt, tồn kho sẽ bị phục hồi.")) return;
        try {
            await api.inventory.deleteLog(log.id, isAdmin);
            toast.success("Xoá phiếu thành công");
            fetchData();
        } catch(e: any) { toast.error(e.message || "Báo lỗi phân quyền: Bạn chỉ có thể sửa phiếu chờ duyệt!"); }
    };
"""

handleImport_old = """    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setImporting(true);
            const req = { ...importForm };
            if (Number(req.product_id) !== -1) {
                req.product_name = undefined;
                req.selling_price = undefined;
            }
            const res = await api.inventory.import(req);
            toast.success(`Nhập kho thành công! Tồn mới: ${res.new_stock}`);
            fetchData();
            setImportStep('category');
            setImportCategory('');
            setImportForm({ product_id: 0, quantity: 1, unit_cost: 0, supplier_name: '', note: '', selling_price: 0, product_name: '', category: '', unit: 'cái' });
        } catch (err: any) {
            toast.error(err.message || 'Nhập kho thất bại!');
        } finally {
            setImporting(false);
        }
    };"""

code = code.replace(handleImport_new, handleImport_old)

# Reverse 4: Buttons and Tabs
btn_new = """                <div className="flex gap-2">
                    <Button onClick={() => setIsImportModalOpen(true)} className="gap-2 shadow-sm bg-sky-600 hover:bg-sky-700">
                        <PackagePlus size={18} /> Nhập Hàng Vào Kho
                    </Button>
                    {isAdmin && (
                        <Button onClick={openCreateModal} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                            <Plus size={18} /> Thêm Sản Phẩm Mới
                        </Button>
                    )}
                </div>"""
btn_old = """                {isAdmin && (
                    <Button onClick={openCreateModal} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Plus size={18} /> Thêm Sản Phẩm Mới
                    </Button>
                )}"""
code = code.replace(btn_new, btn_old)

code = code.replace(
    "{['Tất cả', ...CATEGORIES, 'Thống Kê', 'Lịch sử Kho'].map(cat => (",
    "{['Tất cả', ...CATEGORIES, 'Nhập Kho', 'Thống Kê', 'Lịch sử lỗi'].map(cat => ("
)
code = code.replace("cat === 'Lịch sử Kho'", "cat === 'Lịch sử lỗi'")
code = code.replace("activeTab === 'Lịch sử Kho'", "activeTab === 'Lịch sử lỗi'")

# Reverse 6: Lịch sử Table Headers
th_new = """                                    <th className="p-4">Thời gian / CN</th>
                                    <th className="p-4">Sản Phẩm</th>
                                    <th className="p-4 text-center">Biến động</th>
                                    <th className="p-4">Lý Do / Ghi Chú</th>
                                    <th className="p-4">Chứng Từ</th>
                                    <th className="p-4 text-center">Trạng Thái</th>
                                    <th className="p-4 text-right">Tiền Đền Bù</th>
                                    <th className="p-4 text-center">Xét Duyệt / Hành động</th>"""
th_old = """                                    <th className="p-4">Thời gian</th>
                                    <th className="p-4">Sản Phẩm</th>
                                    <th className="p-4 text-center">Biến động</th>
                                    <th className="p-4">Lý Do</th>
                                    <th className="p-4 text-center">Trạng Thái</th>
                                    <th className="p-4 text-right">Tiền Đền Bù</th>
                                    {isAdmin && <th className="p-4 text-center">Xét Duyệt</th>}"""
code = code.replace(th_new, th_old)

td_new = """                                        <td className="p-4 text-sm text-slate-500">
                                            <div>{log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '—'}</div>
                                            <div className="text-xs font-bold text-emerald-600 mt-0.5">👤 {log.user_name || 'Hệ thống'}</div>
                                        </td>
                                        <td className="p-4 font-medium text-slate-800">{log.product_name}</td>
                                        <td className="p-4 text-center">
                                            <span className={`font-bold ${log.change_amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600">{log.reason}</span>
                                            {log.note && <div className="text-xs text-slate-400 mt-1 uppercase max-w-[150px] truncate" title={log.note}>{log.note}</div>}
                                        </td>
                                        <td className="p-4">
                                            {log.image_url ? <a href={log.image_url} target="_blank" className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><ImageIcon size={14}/> Xem HĐ</a> : <span className="text-xs text-slate-300">—</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            {(log.status === 'PENDING' || log.status === 'Pending') && <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full w-max mx-auto"><Clock size={11}/> Chờ duyệt</span>}
                                            {(log.status === 'APPROVED' || log.status === 'Approved') && <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full w-max mx-auto"><CheckCircle size={11}/> Đã duyệt</span>}
                                            {(log.status === 'REJECTED' || log.status === 'Rejected') && <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full w-max mx-auto"><XCircle size={11}/> Từ chối</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-emerald-600">
                                            {log.compensation_amount > 0 ? `${log.compensation_amount.toLocaleString()} đ` : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex gap-1 justify-center">
                                                {isAdmin && (log.status === 'PENDING' || log.status === 'Pending') && (
                                                    <>
                                                        <button onClick={() => {api.inventory.approveLog(log.id).then(()=>{toast.success('Duyệt thành công'); fetchData();}).catch((e:any)=>toast.error('Lỗi duyệt'))}} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Phê duyệt"><CheckCircle size={16}/></button>
                                                    </>
                                                )}
                                                {(isAdmin || log.status === 'PENDING' || log.status === 'Pending') && (
                                                    <button onClick={() => handleEditLog(log)} className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors" title="Sửa ghi chú">
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {(isAdmin || log.status === 'PENDING' || log.status === 'Pending') && (
                                                    <button onClick={() => handleDeleteLog(log)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>"""
td_old = """                                        <td className="p-4 text-sm text-slate-500">{log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '—'}</td>
                                        <td className="p-4 font-medium text-slate-800">{log.product_name}</td>
                                        <td className="p-4 text-center">
                                            <span className={`font-bold ${log.change_amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600">{log.reason}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {log.status === 'Pending' && <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full w-max mx-auto"><Clock size={11}/> Chờ duyệt</span>}
                                            {log.status === 'Approved' && <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full w-max mx-auto"><CheckCircle size={11}/> Đã duyệt</span>}
                                            {log.status === 'Rejected' && <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full w-max mx-auto"><XCircle size={11}/> Từ chối</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-emerald-600">
                                            {log.compensation_amount > 0 ? `${log.compensation_amount.toLocaleString()} đ` : '-'}
                                        </td>
                                        {isAdmin && (
                                            <td className="p-4 text-center">
                                                {log.status === 'Pending' ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <button onClick={() => handleApproveDamage(log.id)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Phê duyệt"><CheckCircle size={16}/></button>
                                                        <button onClick={() => handleRejectDamage(log.id)} className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Từ chối"><XCircle size={16}/></button>
                                                    </div>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                        )}"""
code = code.replace(td_new, td_old)

# Reverse 5: Restore Nhập Kho into activeTabs block
modal_pat_re = re.search(r"\{\/\* IMPORT MODAL \*\/\}.*?\{\/\* PRODUCT MODAL \(ADD \/ EDIT\) \*\/\}", code, re.DOTALL)
if modal_pat_re:
    modal_html_full = modal_pat_re.group(0)
    # the modal content minus the html wrappers
    import_content_re = re.search(r'<div className="p-4 sm:p-6 bg-white">\s+(.*?)\s+</div>\s+</Card>', modal_html_full, re.DOTALL)
    if import_content_re:
        import_content = import_content_re.group(1)
        # remove image uploader
        image_uploader = """
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Hóa đơn / Bằng chứng nhập kho</label>
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                                    {importForm.image_url ? <img src={importForm.image_url} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300"/>}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-sm cursor-pointer inline-flex items-center justify-center gap-2 py-2 px-4 rounded-full border-0 font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                                                        <ImageIcon size={16} /> Chọn ảnh chứng từ...
                                                        <input type="file" accept="image/*" onChange={handleImportFileChange} className="hidden" />
                                                    </label>
                                                    {isUploading && <span className="text-xs font-semibold text-sky-500 block mt-1 animate-pulse">Đang tải ảnh...</span>}
                                                </div>
                                            </div>
                                        </div>
    """
        import_content = import_content.replace(image_uploader, '')
        import_content = import_content.replace('<form onSubmit={handleImport} className="flex flex-col gap-4">\\n', '<form onSubmit={handleImport} className="flex flex-col gap-4">')
        
        # inject back to activeTab
        inject_old = """                    {/* ============ NHẬP KHO ============ */}
                    {activeTab === 'Nhập Kho' ? (
                        """ + import_content + """
                    ) : activeTab === 'Lịch sử lỗi' ? ("""
        code = code.replace("{activeTab === 'Lịch sử lỗi' ? (", inject_old)

        # fully remove the modal from code
        code = code.replace(modal_html_full, "{/* PRODUCT MODAL (ADD / EDIT) */}")

with open('src/app/(admin)/inventory/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
    print("Undo applied successfully.")
