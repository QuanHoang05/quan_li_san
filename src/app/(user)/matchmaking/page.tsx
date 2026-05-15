'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, X, MapPin, Clock, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

type MatchResponse = {
    id: number;
    author_id: number;
    author_name: string;
    sport: string;
    level: string;
    time: string;
    courts: string;
    max_slots: number;
    current_slots: number;
    status: string;
    participants: string[];
};

export default function MatchmakingPage() {
    const [matches, setMatches] = useState<MatchResponse[]>([]);
    const [now, setNow] = useState(new Date());

    const getCookie = (name: string) => {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
    };

    const currentUserId = getCookie('user_id') ? parseInt(getCookie('user_id') as string) : null;
    const currentUserName = getCookie('userName');

    const loadMatches = async () => {
        try {
            const data = await api.matchmaking.getMatches();
            setMatches(data);
        } catch (error) {
            console.error("Failed to load matches", error);
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadMatches();
        window.addEventListener('match_updated', loadMatches);
        return () => window.removeEventListener('match_updated', loadMatches);
    }, []);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        sport: 'Pickleball',
        level: 'Tất cả các trình độ',
        time: '',
        courts: 'Đang tìm sân',
        max_slots: 4,
    });

    const handleCreateMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!currentUserId) {
            toast.error("Vui lòng đăng nhập để tạo trận đấu.");
            window.location.href = '/login?redirect=/matchmaking';
            return;
        }

        if (!formData.time) {
            toast.error('Vui lòng chọn thời gian!');
            return;
        }

        const matchTime = new Date(formData.time);
        if (matchTime <= new Date()) {
            toast.error('Thời gian bắt đầu phải trong tương lai!');
            return;
        }

        try {
            await api.matchmaking.createMatch({
                sport: formData.sport,
                level: formData.level,
                time: formData.time,
                courts: formData.courts,
                max_slots: formData.max_slots,
                author_id: currentUserId
            });
            toast.success('Tạo trận đấu thành công!');
            setShowCreateModal(false);
            setFormData({
                sport: 'Pickleball',
                level: 'Tất cả các trình độ',
                time: '',
                courts: 'Đang tìm sân',
                max_slots: 4,
            });
            loadMatches();
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi tạo trận đấu");
        }
    };

    const handleJoinMatch = async (matchId: number) => {
        if (!currentUserId) {
            toast.error("Vui lòng đăng nhập để tham gia.");
            window.location.href = '/login?redirect=/matchmaking';
            return;
        }

        try {
            await api.matchmaking.joinMatch(matchId, currentUserId);
            toast.success('Đã gửi yêu cầu tham gia đến chủ phòng!');
            loadMatches();
        } catch (error: any) {
            toast.error(error.message || "Không thể tham gia");
        }
    };

    const handleLeaveMatch = async (matchId: number) => {
        if (!currentUserId) return;
        if (!confirm("Bạn có chắc chắn muốn rời khỏi trận đấu này?")) return;
        
        try {
            await api.matchmaking.leaveMatch(matchId, currentUserId);
            toast.success('Đã rời khỏi trận đấu thành công!');
            loadMatches();
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi rời phòng");
        }
    };

    const handleCancelMatch = async (matchId: number) => {
        if (!currentUserId) return;
        if (!confirm("Hủy trận đấu sẽ thông báo đến tất cả thành viên. Bạn có chắc chắn?")) return;

        try {
            await api.matchmaking.cancelMatch(matchId, currentUserId);
            toast.success('Đã hủy trận đấu!');
            loadMatches();
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi hủy trận");
        }
    };

    const formatDateTime = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="flex flex-col gap-6 relative pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Tìm trận đấu</h2>
                    <p className="text-slate-500 mt-1">Ghép kèo, giao lưu thể thao cùng cộng đồng.</p>
                </div>
                <Button onClick={() => {
                    if (!currentUserId) {
                        toast.error("Vui lòng đăng nhập để tạo trận.");
                        window.location.href = '/login?redirect=/matchmaking';
                        return;
                    }
                    setShowCreateModal(true);
                }} className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                    <Plus size={20} /> Tạo trận mới
                </Button>
            </div>

            {matches.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
                    Hiện tại chưa có trận đấu nào đang tìm người. Hãy là người đầu tiên tạo trận!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {matches.map(match => {
                        const isFull = match.current_slots >= match.max_slots;
                        const isJoined = currentUserName && match.participants.includes(decodeURIComponent(currentUserName));
                        const isAuthor = match.author_id === currentUserId;

                        return (
                            <Card key={match.id} className={`transition-all duration-300 border-slate-200 flex flex-col h-full overflow-hidden ${isJoined ? 'ring-2 ring-emerald-500 shadow-emerald-500/10 shadow-lg' : 'hover:shadow-md'}`}>
                                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Môn thể thao</div>
                                            <CardTitle className="text-xl text-slate-800">{match.sport}</CardTitle>
                                        </div>
                                        <div className={`text-xs font-bold px-3 py-1 rounded-full ${isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {match.current_slots}/{match.max_slots}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 flex-1 flex flex-col gap-3">
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <Trophy size={18} className="text-amber-500 shrink-0" />
                                        <span className="font-medium text-sm">Cấp độ: <span className="text-slate-800">{match.level}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <Clock size={18} className="text-blue-500 shrink-0" />
                                        <span className="font-medium text-sm">Thời gian: <span className="text-slate-800">{formatDateTime(match.time)}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <MapPin size={18} className="text-rose-500 shrink-0" />
                                        <span className="font-medium text-sm">Địa điểm: <span className="text-slate-800">{match.courts}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600 mt-2 p-3 bg-slate-50 rounded-xl">
                                        <div className="w-8 h-8 bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm">
                                            {match.author_name ? match.author_name.charAt(0) : '?'}
                                        </div>
                                        <span className="text-sm font-semibold">Tạo bởi: {match.author_name} {isAuthor && '(Bạn)'}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0 p-5">
                                    {isAuthor ? (
                                        <Button 
                                            fullWidth 
                                            onClick={() => handleCancelMatch(match.id)}
                                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold border-none transition-colors"
                                        >
                                            Hủy trận đấu
                                        </Button>
                                    ) : isJoined ? (
                                        <Button 
                                            fullWidth 
                                            onClick={() => handleLeaveMatch(match.id)}
                                            className="bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold transition-colors"
                                        >
                                            Rời phòng
                                        </Button>
                                    ) : isFull ? (
                                        <Button fullWidth disabled className="bg-slate-200 text-slate-500 font-bold opacity-100">
                                            Đã Full Slot
                                        </Button>
                                    ) : (
                                        <Button 
                                            fullWidth 
                                            onClick={() => handleJoinMatch(match.id)}
                                            className="bg-slate-800 hover:bg-slate-900 text-white shadow-md"
                                        >
                                            Xin tham gia ngay
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create Match Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
                            <h3 className="font-bold text-xl flex items-center gap-2"><Plus size={24} /> Tạo Trận Mới</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[80vh]">
                            <form onSubmit={handleCreateMatch} className="flex flex-col gap-5">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Môn thể thao</label>
                                    <select 
                                        value={formData.sport}
                                        onChange={e => setFormData({...formData, sport: e.target.value})}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                    >
                                        <option value="Pickleball">Pickleball</option>
                                        <option value="Cầu lông">Cầu lông</option>
                                        <option value="Tennis">Tennis</option>
                                        <option value="Bóng bàn">Bóng bàn</option>
                                        <option value="Bóng đá">Bóng đá</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Cấp độ yêu cầu</label>
                                    <select 
                                        value={formData.level}
                                        onChange={e => setFormData({...formData, level: e.target.value})}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                    >
                                        <option value="Tất cả các trình độ">Tất cả các trình độ</option>
                                        <option value="Newbie (Mới chơi)">Newbie (Mới chơi)</option>
                                        <option value="Beginner (2.0 - 2.5)">Beginner (2.0 - 2.5)</option>
                                        <option value="Intermediate (3.0 - 3.5)">Intermediate (3.0 - 3.5)</option>
                                        <option value="Advanced (4.0+)">Advanced (4.0+)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Thời gian bắt đầu</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formData.time}
                                        onChange={e => setFormData({...formData, time: e.target.value})}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Sân bãi</label>
                                    <input 
                                        type="text" 
                                        value={formData.courts}
                                        onChange={e => setFormData({...formData, courts: e.target.value})}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                        placeholder="Ví dụ: Sân số 2, hoặc Đang tìm sân..."
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 mb-2 block">Số người tối đa (Slots)</label>
                                    <select 
                                        value={formData.max_slots}
                                        onChange={e => setFormData({...formData, max_slots: parseInt(e.target.value)})}
                                        className="w-full border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 p-3 rounded-xl font-medium text-slate-800 transition-all outline-none"
                                    >
                                        <option value={2}>2 người</option>
                                        <option value={4}>4 người</option>
                                        <option value={6}>6 người</option>
                                        <option value={8}>8 người</option>
                                    </select>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                                    <Button type="button" variant="outline" fullWidth onClick={() => setShowCreateModal(false)} className="py-4 font-bold border-none bg-slate-100 hover:bg-slate-200 text-slate-700">
                                        Hủy
                                    </Button>
                                    <Button type="submit" fullWidth className="py-4 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30">
                                        Đăng Kèo
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
