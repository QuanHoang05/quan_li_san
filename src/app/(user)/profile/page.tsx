'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, QrCode, TrendingUp, Lock, X, CheckCircle, PlusCircle, MinusCircle, User, Phone, Edit2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

type HistoryItem = {
    id: string;
    date: string;
    type: 'deposit' | 'payment';
    amount: number;
    note: string;
};

export default function ProfilePage() {
  const router = useRouter();
  
  const [balance, setBalance] = useState<number>(0);
  const [pin, setPin] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Profile info
  const [profileName, setProfileName] = useState('Khách Hàng');
  const [profilePhone, setProfilePhone] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Modals
  const [showTopUp, setShowTopUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinAuth, setShowPinAuth] = useState(false);
  
  // Forms
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  useEffect(() => {
      // Load wallet data
      const storedBalance = localStorage.getItem('wallet_balance');
      if (storedBalance) setBalance(parseInt(storedBalance));
      else localStorage.setItem('wallet_balance', '0'); // init 0

      const storedPin = localStorage.getItem('wallet_pin');
      if (storedPin) setPin(storedPin);

      const storedHistory = localStorage.getItem('wallet_history');
      if (storedHistory) setHistory(JSON.parse(storedHistory));

      // Load profile info from cookie/localStorage
      const storedName = localStorage.getItem('profile_name') || getCookieValue('userName') || 'Khách Hàng';
      const storedPhone = localStorage.getItem('profile_phone') || getCookieValue('user_phone') || '';
      setProfileName(storedName);
      setProfilePhone(storedPhone);
  }, []);

  const getCookieValue = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : '';
  };

  const startEditProfile = () => {
      setEditName(profileName);
      setEditPhone(profilePhone);
      setEditingProfile(true);
  };

  const saveProfile = async () => {
      if (!editName.trim()) { toast.error('Tên không được để trống'); return; }
      setSavingProfile(true);
      try {
          // Lưu local
          localStorage.setItem('profile_name', editName.trim());
          localStorage.setItem('profile_phone', editPhone.trim());
          document.cookie = `userName=${editName.trim()}; path=/`; // Sync header
          setProfileName(editName.trim());
          setProfilePhone(editPhone.trim());

          // Đồng bộ lên backend nếu có user_id trong cookie
          const userId = getCookieValue('user_id');
          if (userId) {
              await api.customers.update(parseInt(userId), {
                  name: editName.trim(),
                  phone: editPhone.trim() || undefined
              });
          }

          toast.success('Cập nhật thông tin thành công!');
          setEditingProfile(false);
      } catch {
          toast.error('Có lỗi khi lưu thông tin, đã cập nhật tạm thời.');
          setEditingProfile(false);
      } finally {
          setSavingProfile(false);
      }
  };



  const saveWalletState = (newBalance: number, newHistory: HistoryItem[]) => {
      setBalance(newBalance);
      setHistory(newHistory);
      localStorage.setItem('wallet_balance', newBalance.toString());
      localStorage.setItem('wallet_history', JSON.stringify(newHistory));
  };

  const handleLogout = () => {
    document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/');
  };

  const handleCreatePin = () => {
      if (pinInput.length !== 6 || !/^\d+$/.test(pinInput)) {
          return toast.error("Mã PIN phải bao gồm đúng 6 chữ số!");
      }
      if (pinInput !== pinConfirm) {
          return toast.error("Mã PIN xác nhận không khớp!");
      }
      setPin(pinInput);
      localStorage.setItem('wallet_pin', pinInput);
      toast.success("Tạo mã PIN thành công!");
      setShowPinSetup(false);
      setPinInput('');
      setPinConfirm('');
  };

  const handleTopUpRequest = () => {
      if (!topUpAmount) return;
      if (!pin) {
          toast.error("Bạn cần thiết lập mã PIN trước khi giao dịch!");
          setShowTopUp(false);
          setShowPinSetup(true);
          return;
      }
      setShowPinAuth(true);
  };

  const executeTopUp = () => {
      if (pinInput !== pin) {
          toast.error("Mã PIN không chính xác!");
          return;
      }
      
      const newBalance = balance + (topUpAmount || 0);
      const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          type: 'deposit',
          amount: topUpAmount || 0,
          note: 'Nạp tiền vào ví qua VietQR'
      };

      saveWalletState(newBalance, [newHistoryItem, ...history]);
      
      toast.success(`Nạp thành công ${topUpAmount?.toLocaleString()}đ vào ví!`);
      setShowPinAuth(false);
      setShowTopUp(false);
      setTopUpAmount(null);
      setPinInput('');
  };

  return (
    <div className="flex flex-col gap-6 relative pb-20">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
              <h2 className="text-2xl font-bold text-slate-800">Cá Nhân & Ví</h2>
              <p className="text-slate-500 mt-1">Quản lý tài khoản, số dư và lịch sử giao dịch.</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300">
              Đăng xuất
          </Button>
      </div>

      <Card className="p-8 flex flex-col items-center gap-4 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl shadow-emerald-600/20 rounded-3xl border-none relative overflow-hidden">
         {/* Background Decor */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full mix-blend-overlay filter blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full mix-blend-overlay filter blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>

         <div className="text-emerald-50 font-medium tracking-wide z-10">SỐ DƯ VÍ QUANLISAN</div>
         <div className="text-5xl font-black tracking-tight z-10">{balance.toLocaleString()} <span className="text-2xl text-emerald-200">đ</span></div>
         
         {!pin && (
             <div className="mt-2 p-3 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-50 flex items-center gap-2 text-sm z-10 cursor-pointer hover:bg-amber-500/30 transition-colors" onClick={() => setShowPinSetup(true)}>
                 <Lock size={16} /> Bạn chưa thiết lập mã PIN giao dịch. Bấm để tạo.
             </div>
         )}

         <div className="flex gap-4 mt-4 z-10">
             <Button className="bg-white text-emerald-700 hover:bg-emerald-50 px-6 py-6 rounded-2xl shadow-lg" onClick={() => setShowTopUp(true)}>
                 <Wallet size={20} className="mr-2" /> Nạp tiền
             </Button>
             <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 px-6 py-6 rounded-2xl backdrop-blur-sm" onClick={() => setShowHistory(true)}>
                 <TrendingUp size={20} className="mr-2" /> Lịch sử ví
             </Button>
         </div>
      </Card>

      {/* PROFILE INFO CARD */}
      <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <User size={18} className="text-emerald-500" /> Thông Tin Cá Nhân
              </h3>
              {!editingProfile ? (
                  <button
                      onClick={startEditProfile}
                      className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                      <Edit2 size={14} /> Chỉnh sửa
                  </button>
              ) : (
                  <div className="flex gap-2">
                      <button
                          onClick={() => setEditingProfile(false)}
                          className="text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                          Hủy
                      </button>
                      <button
                          onClick={saveProfile}
                          disabled={savingProfile}
                          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                      >
                          <Save size={14} /> {savingProfile ? 'Đang lưu...' : 'Lưu'}
                      </button>
                  </div>
              )}
          </div>

          <div className="p-5 flex flex-col gap-4">
              {/* Tên */}
              <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <User size={16} />
                  </div>
                  <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Họ và tên</div>
                      {editingProfile ? (
                          <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all"
                              placeholder="Nhập họ và tên..."
                              autoFocus
                          />
                      ) : (
                          <div className="text-slate-800 font-semibold">{profileName}</div>
                      )}
                  </div>
              </div>

              {/* SĐT */}
              <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Phone size={16} />
                  </div>
                  <div className="flex-1">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Số điện thoại</div>
                      {editingProfile ? (
                          <input
                              type="tel"
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              className="w-full border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-all"
                              placeholder="Nhập số điện thoại..."
                          />
                      ) : (
                          <div className="text-slate-800 font-semibold">
                              {profilePhone || <span className="text-slate-400 font-normal italic">Chưa cập nhật</span>}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </Card>

      <div className="mt-2">
          <h3 className="font-bold text-lg text-slate-800 mb-4 px-2">Đơn hàng gần đây</h3>
          <Card className="p-5 flex justify-between items-center border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div>
                  <div className="font-bold text-slate-800 text-lg">Thuê sân cầu lông - Sân 2</div>
                  <div className="text-slate-500 text-sm mt-1">Hôm nay, 19:30 - 21:00</div>
              </div>
              <div className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full text-sm">Đã xác nhận</div>
          </Card>
      </div>



      {/* TOP UP MODAL */}
      {showTopUp && !showPinAuth && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-xl text-slate-800">Nạp tiền vào Ví</h3>
                      <button onClick={() => {setShowTopUp(false); setTopUpAmount(null)}} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-6">
                      <div>
                          <p className="text-sm font-semibold text-slate-600 mb-3">Chọn mệnh giá nạp:</p>
                          <div className="grid grid-cols-2 gap-3">
                              {[50000, 100000, 200000, 500000].map(amount => (
                                  <button 
                                    key={amount}
                                    onClick={() => setTopUpAmount(amount)}
                                    className={`p-4 border-2 rounded-2xl font-bold transition-all ${topUpAmount === amount ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-600 hover:border-emerald-200'}`}
                                  >
                                      {amount.toLocaleString()} đ
                                  </button>
                              ))}
                          </div>
                      </div>

                      {topUpAmount && (
                          <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in">
                              <p className="text-slate-600">Quét mã VietQR để nạp <strong className="text-emerald-600 text-lg">{topUpAmount.toLocaleString()}đ</strong></p>
                              <div className="w-48 h-48 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center p-2">
                                  <QrCode size={64} className="text-emerald-500" />
                                  <span className="absolute text-slate-400 font-medium text-sm">Mã QR Demo</span>
                              </div>
                              <p className="text-xs text-slate-500 text-center px-4">Sau khi chuyển khoản, nhấn "Hoàn tất" và nhập mã PIN để xác nhận (Mô phỏng).</p>
                          </div>
                      )}

                      <div className="flex gap-3 pt-2">
                          <Button variant="outline" fullWidth onClick={() => {setShowTopUp(false); setTopUpAmount(null)}} className="py-6 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none">Hủy</Button>
                          <Button fullWidth disabled={!topUpAmount} onClick={handleTopUpRequest} className="py-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30">Hoàn tất nạp</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* PIN AUTH MODAL (for Top up) */}
      {showPinAuth && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center pt-8">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock size={32} />
                      </div>
                      <h3 className="font-bold text-xl text-slate-800">Xác thực giao dịch</h3>
                      <p className="text-slate-500 mt-2 text-sm">Vui lòng nhập mã PIN 6 số để xác nhận nạp {topUpAmount?.toLocaleString()}đ.</p>
                  </div>
                  
                  <div className="p-6 pt-0 flex flex-col gap-6">
                      <input 
                          type="password" 
                          maxLength={6}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="w-full text-center tracking-[1em] text-3xl font-bold p-4 border-2 border-emerald-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 bg-emerald-50"
                          autoFocus
                      />

                      <div className="flex gap-3">
                          <Button variant="outline" fullWidth onClick={() => {setShowPinAuth(false); setPinInput('');}} className="py-6 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none">Hủy</Button>
                          <Button fullWidth disabled={pinInput.length !== 6} onClick={executeTopUp} className="py-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30">Xác nhận</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* PIN SETUP MODAL */}
      {showPinSetup && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center pt-8 bg-slate-800 text-white">
                      <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                          <Lock size={32} />
                      </div>
                      <h3 className="font-bold text-xl">Thiết lập Mã PIN</h3>
                      <p className="text-slate-300 mt-2 text-sm">Tạo mã PIN 6 số để bảo vệ ví của bạn.</p>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-5">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nhập mã PIN mới</label>
                          <input 
                              type="password" 
                              maxLength={6}
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              className="w-full text-center tracking-[1em] text-2xl font-bold p-4 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Xác nhận lại mã PIN</label>
                          <input 
                              type="password" 
                              maxLength={6}
                              value={pinConfirm}
                              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              className="w-full text-center tracking-[1em] text-2xl font-bold p-4 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                          />
                      </div>

                      <div className="flex gap-3 mt-2">
                          <Button variant="outline" fullWidth onClick={() => {setShowPinSetup(false); setPinInput(''); setPinConfirm('')}} className="py-6 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none">Hủy bỏ</Button>
                          <Button fullWidth disabled={pinInput.length !== 6 || pinConfirm.length !== 6} onClick={handleCreatePin} className="py-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30">Lưu Mã PIN</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* HISTORY MODAL (Drawer style) */}
      {showHistory && (
          <div className="fixed inset-0 z-[100] flex justify-end">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
              <div className="w-full max-w-md bg-slate-50 h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><TrendingUp className="text-emerald-500"/> Lịch sử giao dịch ví</h3>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                      {history.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                              <Wallet size={64} className="opacity-20" />
                              <p>Chưa có giao dịch nào.</p>
                          </div>
                      ) : (
                          history.map((item) => (
                              <div key={item.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm items-center">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${item.type === 'deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                      {item.type === 'deposit' ? <PlusCircle size={24} /> : <MinusCircle size={24} />}
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{item.note}</h4>
                                          <span className={`font-black whitespace-nowrap ml-2 ${item.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {item.type === 'deposit' ? '+' : '-'}{item.amount.toLocaleString()} đ
                                          </span>
                                      </div>
                                      <div className="text-xs text-slate-500 mt-1">
                                          {new Date(item.date).toLocaleString('vi-VN')}
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
