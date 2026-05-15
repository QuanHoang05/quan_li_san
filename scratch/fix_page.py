
import os

path = r"c:\Users\ACER\OneDrive\Máy tính\quanlisan\quan_li_san\src\app\(admin)\bookings\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The broken part starts after {/* PAYMENT CONFIRMATION MODAL */}
marker = "{/* PAYMENT CONFIRMATION MODAL */}"
if marker in content:
    parts = content.split(marker)
    # The part after marker is broken. 
    # We need to find where the component return ends or where the next part starts.
    # Actually, we can just replace everything from the marker to the end of that specific logic.
    # The next part is probably "{pricingModal.open &&" or similar.
    
    # Let's find the end of the broken part.
    # The broken part currently ends with the large block I inserted.
    
    new_modal_code = """
            {/* PAYMENT CONFIRMATION MODAL */}
            {paymentModal.open && paymentModal.data && (() => {
                const b = paymentModal.data;
                const court = courts.find(c => c.id === b.court_id);
                const isOnline = !!b.isOnline;
                const proofUrl = b.proof_url;

                // Tìm các ca cùng khách chưa thanh toán để gộp (chỉ cho booking thường)
                const related = isOnline ? [] : bookings.filter(x =>
                    x.guest_name === b.guest_name &&
                    (b.guest_phone ? x.guest_phone === b.guest_phone : true) &&
                    x.payment_status !== 'Fully_Paid'
                );

                const totalGroupPrice = related.reduce((sum, item) => {
                    const c = courts.find(ct => ct.id === item.court_id);
                    const h = (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / (1000 * 3600);
                    return sum + (h * (c?.price_per_hour || 0));
                }, 0);

                const totalGroupDeposit = related.reduce((sum, item) => {
                    const c = courts.find(ct => ct.id === item.court_id);
                    return sum + (item.payment_status === 'Deposit' ? (c?.deposit_price || 0) : 0);
                }, 0);

                const groupRemaining = Math.max(0, totalGroupPrice - totalGroupDeposit);

                // Build QR URL
                const orderRef = isOnline ? b.payment_ref : `SAN-${b.id}-${Date.now().toString().slice(-4)}`;
                const qrNote = `${orderRef} ${b.guest_name || 'Khach vang lai'} ${court?.name || ''}`.slice(0, 50);
                const qrUrl = bankSettings
                    ? `https://img.vietqr.io/image/${bankSettings.bank_code}-${bankSettings.account_number}-compact2.png?amount=${Math.round(isOnline ? b.total_amount : groupRemaining)}&addInfo=${encodeURIComponent(qrNote)}&accountName=${encodeURIComponent(bankSettings.account_name)}`
                    : null;

                const handleConfirmPayment = async () => {
                    try {
                        if (isOnline) {
                            await api.onlineBookings.manualApprove(b.id);
                            toast.success(`Đã xác nhận đặt sân Online cho ${b.guest_name}!`);
                        } else {
                            const related2 = bookings.filter(x =>
                                x.guest_name === b.guest_name &&
                                (b.guest_phone ? x.guest_phone === b.guest_phone : true) &&
                                x.payment_status !== 'Fully_Paid'
                            );
                            await Promise.all(related2.map(item => api.bookings.update(item.id, { payment_status: 'Fully_Paid' })));
                            toast.success(`Đã thu tiền gộp cho ${related2.length} ca!`);
                        }
                        setPaymentModal({open: false, data: null});
                        setPaymentTab('cash');
                        fetchData();
                    } catch { toast.error('Lỗi xác nhận thanh toán'); }
                };

                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                        <Card className="w-full max-w-md shadow-2xl p-0 overflow-hidden rounded-xl border border-slate-200">
                            <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CheckCircle size={20} className="text-emerald-500"/> Xác Nhận Thanh Toán</h3>
                                <button onClick={() => { setPaymentModal({open: false, data: null}); setPaymentTab('cash'); }} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-1.5 rounded transition-colors"><X size={18}/></button>
                            </div>

                            <div className="p-5 bg-slate-50 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                                {/* Customer info */}
                                <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col gap-1.5 text-sm shadow-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Khách hàng</span><span className="font-bold text-slate-800">{b.guest_name || 'Khách Vãng Lai'}</span></div>
                                    {b.guest_phone && <div className="flex justify-between"><span className="text-slate-500">Số điện thoại</span><span className="font-semibold">{b.guest_phone}</span></div>}
                                    <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span className="text-slate-500">Sân</span><span className="font-semibold text-slate-700">{court?.name}</span></div>
                                </div>

                                {/* Amount breakdown */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col gap-2">
                                    <div className="flex justify-between text-xs uppercase tracking-wider text-emerald-600 font-bold">
                                        <span>Chi tiết {isOnline ? "(Online)" : `(${related.length} ca)`}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {isOnline ? (
                                            <div className="flex justify-between text-[11px] text-emerald-800/70 italic">
                                                <span>Ca đặt Online</span>
                                                <span>{(b.total_amount || 0).toLocaleString()}đ</span>
                                            </div>
                                        ) : related.map(r => (
                                            <div key={r.id} className="flex justify-between text-[11px] text-emerald-800/70 italic">
                                                <span>Ca {new Date(r.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                                                <span>{((new Date(r.end_time).getTime() - new Date(r.start_time).getTime())/(1000*3600) * (courts.find(ct=>ct.id===r.court_id)?.price_per_hour||0)).toLocaleString()}đ</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-emerald-100"><span className="text-emerald-700 font-medium">Tổng:</span><span className="font-bold text-emerald-800">{(isOnline ? b.total_amount : totalGroupPrice).toLocaleString()}đ</span></div>
                                    {!isOnline && totalGroupDeposit > 0 && <div className="flex justify-between"><span className="text-emerald-700 font-medium">Đã cọc:</span><span className="font-semibold text-emerald-700">- {totalGroupDeposit.toLocaleString()}đ</span></div>}
                                    <div className="flex justify-between pt-2 border-t-2 border-emerald-300">
                                        <span className="font-black text-emerald-900 uppercase text-sm">Cần Thu</span>
                                        <span className="font-black text-emerald-900 text-2xl">{(isOnline ? b.total_amount : groupRemaining).toLocaleString()}đ</span>
                                    </div>
                                </div>

                                {/* Payment method tabs */}
                                <div>
                                    <div className="flex bg-slate-200/50 p-1 rounded-lg mb-3">
                                        <button
                                            onClick={() => setPaymentTab('cash')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${paymentTab === 'cash' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <Banknote size={16}/> Tiền Mặt
                                        </button>
                                        <button
                                            onClick={() => setPaymentTab('qr')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${paymentTab === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <QrCode size={16}/> VietQR
                                        </button>
                                    </div>

                                    {paymentTab === 'cash' ? (
                                        <div className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-sm text-slate-600 flex items-start gap-2">
                                                <input type="checkbox" id="confirm-cash" className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                                <label htmlFor="confirm-cash" className="cursor-pointer font-medium">
                                                    Thu đủ <strong className="text-slate-800">{(isOnline ? b.total_amount : groupRemaining).toLocaleString()}đ</strong> tiền mặt rồi xác nhận.
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-3 bg-white rounded-lg border border-slate-200">
                                            {qrUrl || isOnline ? (
                                                <>
                                                    {isOnline && proofUrl ? (
                                                        <div className="w-full px-4 mb-2">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                                                                <Zap size={10}/> Ảnh minh chứng của khách
                                                            </div>
                                                            <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                                                                <img src={proofUrl} alt="Proof" className="w-full h-full object-contain"/>
                                                                <a href={proofUrl} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                                                    Xem ảnh đầy đủ
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <img src={qrUrl} alt="VietQR" className="w-40 h-40 object-contain border border-slate-200 rounded-lg bg-white p-1"/>
                                                    )}
                                                    <div className="text-center text-xs text-slate-500 space-y-0.5">
                                                        <div className="font-bold text-slate-700">{bankSettings?.bank_name || "Ngân hàng"} — {bankSettings?.account_number || "..."}</div>
                                                        <div>{bankSettings?.account_name}</div>
                                                        <div className="text-emerald-600 font-semibold text-sm">{(isOnline ? b.total_amount : groupRemaining).toLocaleString()}đ</div>
                                                        {!isOnline && <div className="text-slate-400 text-[10px]">Nội dung: {qrNote}</div>}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-amber-600 text-sm font-semibold p-4 bg-amber-50 rounded-lg text-center">
                                                    ⚠️ Chưa cài tài khoản ngân hàng.<br/>
                                                    <span className="text-xs font-normal">Vào <strong>Thiết Lập Hệ Thống</strong> để cài đặt.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={() => { setPaymentModal({open: false, data: null}); setPaymentTab('cash'); }} className="font-semibold text-slate-600 flex-1 hover:bg-slate-200 border border-slate-300">Đóng</Button>
                                    
                                    {isOnline ? (
                                        <>
                                            <Button type="button" onClick={handleConfirmPayment} className="flex-1 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg gap-2 h-12">
                                                <History size={18}/> Duyệt
                                            </Button>
                                            <Button type="button" onClick={handleConfirmPayment} className="flex-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg gap-2 h-12">
                                                <CheckCircle size={18}/> Xác Nhận Đã Thu
                                            </Button>
                                        </>
                                    ) : (
                                        <Button type="button" onClick={handleConfirmPayment} className="flex-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg gap-2 h-12">
                                            <CheckCircle size={18}/> Xác Nhận Đã Thu
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}
    """
    
    # We need to find where the broken block ends. 
    # It ends before "{pricingModal.open &&" or something similar.
    end_marker = "{pricingModal.open &&"
    if end_marker in content:
        head = content.split(marker)[0]
        tail = content.split(end_marker)[1]
        new_content = head + new_modal_code + "            " + end_marker + tail
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Fixed page.tsx")
    else:
        print("Could not find end marker")
else:
    print("Could not find start marker")
