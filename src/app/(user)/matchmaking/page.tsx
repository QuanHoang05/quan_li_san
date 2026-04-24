'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, X, MapPin, Clock, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';

type Match = {
    id: string;
    sport: string;
    level: string;
    time: string; // ISO string from datetime-local e.g. "2026-04-22T18:00"
    courts: string;
    currentSlots: number;
    maxSlots: number;
    author: string;
    participants: string[];
};

export default function MatchmakingPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [now, setNow] = useState(new Date());

    const CURRENT_USER = 'Bạn (Người dùng)';

    // Update current time every minute to auto-expire matches
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Load initial data
    useEffect(() => {
        const stored = localStorage.getItem('matchmaking_matches_v2');
        if (stored) {
            try {
                setMatches(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse matches", e);
            }
        } else {
            // Default mock data
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(19, 0, 0, 0);

            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 2);
            nextWeek.setHours(18, 0, 0, 0);

            const defaults: Match[] = [
                { 
                    id: '1', sport: 'Pickleball', level: 'Beginner (2.0 - 2.5)', 
                    time: nextWeek.toISOString().slice(0, 16), courts: 'Sân số 3', 
                    currentSlots: 2, maxSlots: 4, author: 'Minh Tuấn', participants: ['Minh Tuấn', 'Hải Yến'] 
                },
                { 
                    id: '2', sport: 'Cầu lông', level: 'Intermediate (Tầm trung)', 
                    time: tomorrow.toISOString().slice(0, 16), courts: 'Sân số 1', 
                    currentSlots: 3, maxSlots: 4, author: 'Hoàng Long', participants: ['Hoàng Long', 'Tuấn Hưng', 'Thành Đạt'] 
                }
            ];
            setMatches(defaults);
        }
    }, []);

    // Save to localStorage whenever matches change
    useEffect(() => {
        if (matches.length > 0) {
            localStorage.setItem('matchmaking_matches_v2', JSON.stringify(matches));
        }
    }, [matches]);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        sport: 'Pickleball',
        level: 'Tất cả các trình độ',
        time: '',
        courts: 'Đang tìm sân',
        maxSlots: 4,
    });

    const handleCreateMatch = (e: React.FormEvent) => {
        e.preventDefault();
        
        const hasRole = document.cookie.includes('role=');
        if (!hasRole) {
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

        const newMatch: Match = {
            id: Date.now().toString(),
            sport: formData.sport,
            level: formData.level,
            time: formData.time,
            courts: formData.courts,
            currentSlots: 1,
            maxSlots: formData.maxSlots,
            author: CURRENT_USER,
            participants: [CURRENT_USER],
        };

        setMatches([newMatch, ...matches]);
        toast.success('Tạo trận đấu thành công!');
        setShowCreateModal(false);
        setFormData({
            sport: 'Pickleball',
            level: 'Tất cả các trình độ',
            time: '',
            courts: 'Đang tìm sân',
            maxSlots: 4,
        });
    };

    const handleJoinMatch = (matchId: string) => {
        const hasRole = document.cookie.includes('role=');
        if (!hasRole) {
            toast.error("Vui lòng đăng nhập để tham gia.");
            window.location.href = '/login?redirect=/matchmaking';
            return;
        }

        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                if (m.currentSlots >= m.maxSlots) {
                    toast.error('Trận đấu đã đủ người!');
                    return m;
                }
                if (m.participants.includes(CURRENT_USER)) {
                    toast.error('Bạn đã tham gia trận này rồi!');
                    return m;
                }
                
                // Simulate notification to author
                if (m.author !== CURRENT_USER) {
                    toast.success(`Đã gửi thông báo tham gia đến ${m.author}!`);
                } else {
                    toast.success('Bạn đã tham gia trận đấu!');
                }

                return {
                    ...m,
                    currentSlots: m.currentSlots + 1,
                    participants: [...m.participants, CURRENT_USER]
                };
            }
            return m;
        }));
    };

    const handleLeaveMatch = (match: Match) => {
        const matchTime = new Date(match.time);
        const diffHours = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 1) {
            toast.error('Không thể rời trận khi chỉ còn chưa đầy 1 tiếng nữa là bắt đầu!');
            return;
        }

        setMatches(prev => prev.map(m => {
            if (m.id === match.id) {
                toast.success('Đã rời khỏi trận đấu!');
                return {
                    ...m,
                    currentSlots: m.currentSlots - 1,
                    participants: m.participants.filter(p => p !== CURRENT_USER)
                };
            }
            return m;
        }));
    };

    // Lọc bỏ những trận đã bắt đầu (thời gian < hiện tại)
    const activeMatches = matches.filter(m => new Date(m.time) > now);

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
                    const hasRole = document.cookie.includes('role=');
                    if (!hasRole) {
                        toast.error("Vui lòng đăng nhập để tạo trận.");
                        window.location.href = '/login?redirect=/matchmaking';
                        return;
                    }
                    setShowCreateModal(true);
                }} className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                    <Plus size={20} /> Tạo trận mới
                </Button>
            </div>

            {activeMatches.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
                    Hiện tại chưa có trận đấu nào đang tìm người. Hãy là người đầu tiên tạo trận!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeMatches.map(match => {
                        const isFull = match.currentSlots >= match.maxSlots;
                        const isJoined = match.participants.includes(CURRENT_USER);
                        const matchTime = new Date(match.time);
                        const diffHours = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                        const canLeave = diffHours >= 1;

                        return (
                            <Card key={match.id} className={`transition-all duration-300 border-slate-200 flex flex-col h-full overflow-hidden ${isJoined ? 'ring-2 ring-emerald-500 shadow-emerald-500/10 shadow-lg' : 'hover:shadow-md'}`}>
                                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Môn thể thao</div>
                                            <CardTitle className="text-xl text-slate-800">{match.sport}</CardTitle>
                                        </div>
                                        <div className={`text-xs font-bold px-3 py-1 rounded-full ${isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {match.currentSlots}/{match.maxSlots}
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
                                            {match.author.charAt(0)}
                                        </div>
                                        <span className="text-sm font-semibold">Tạo bởi: {match.author} {match.author === CURRENT_USER && '(Bạn)'}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0 p-5">
                                    {isJoined ? (
                                        <Button 
                                            fullWidth 
                                            variant="outline"
                                            onClick={() => handleLeaveMatch(match)}
                                            className={`font-bold ${canLeave ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-slate-400 border-slate-200 hover:bg-transparent cursor-not-allowed'}`}
                                        >
                                            {canLeave ? 'Rời trận đấu' : 'Không thể rời (< 1 tiếng)'}
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
                                            Tham gia ngay
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
                                        value={formData.maxSlots}
                                        onChange={e => setFormData({...formData, maxSlots: parseInt(e.target.value)})}
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
