'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export type AppNotification = {
    id: number;
    message: string;
    created_at: string;
    is_read: boolean;
    match_request_id?: number | null;
};

export default function NotificationBell({ userId, userRole }: { userId?: number, userRole: string }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadNotifications = async () => {
        if (!userId) return;
        try {
            const data = await api.matchmaking.getNotifications(userId);
            setNotifications(data);
        } catch (error) {
            console.error("Failed to load notifications:", error);
        }
    };

    useEffect(() => {
        loadNotifications();
        // Poll every 30 seconds
        const interval = setInterval(loadNotifications, 30000);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            clearInterval(interval);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userId]);

    const handleRead = async (id: number) => {
        try {
            await api.matchmaking.readNotification(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error(error);
        }
    };

    const markAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        for (const id of unreadIds) {
            await handleRead(id);
        }
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const handleApprove = async (reqId: number, notifId: number) => {
        try {
            await api.matchmaking.approveRequest(reqId);
            toast.success("Đã chấp nhận yêu cầu!");
            await handleRead(notifId);
            loadNotifications();
            // trigger match list update
            window.dispatchEvent(new Event('match_updated'));
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi chấp nhận");
        }
    };

    const handleReject = async (reqId: number, notifId: number) => {
        try {
            await api.matchmaking.rejectRequest(reqId);
            toast.success("Đã từ chối yêu cầu.");
            await handleRead(notifId);
            loadNotifications();
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi từ chối");
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={toggleDropdown}
                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 text-sm">Thông báo ({unreadCount})</h4>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Đã đọc tất cả</button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">Không có thông báo nào.</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {notifications.map(n => (
                                    <li key={n.id} className={`p-4 transition-colors ${!n.is_read ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`} onClick={() => !n.is_read && handleRead(n.id)}>
                                        <p className="text-sm text-slate-800 leading-relaxed">{n.message}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('vi-VN')}</p>
                                        
                                        {!n.is_read && n.match_request_id && (
                                            <div className="flex gap-2 mt-3">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleApprove(n.match_request_id!, n.id); }}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <Check size={14} /> Chấp nhận
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleReject(n.match_request_id!, n.id); }}
                                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                >
                                                    <X size={14} /> Từ chối
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
