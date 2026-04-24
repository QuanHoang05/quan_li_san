'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

export type AppNotification = {
    id: string;
    message: string;
    time: string;
    read: boolean;
    targetRole: 'ALL' | 'ADMIN' | 'STAFF' | 'CUSTOMER';
};

export default function NotificationBell({ userRole }: { userRole: string }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadNotifications = () => {
        const stored = localStorage.getItem('app_notifications');
        if (stored) {
            const allNotifs: AppNotification[] = JSON.parse(stored);
            // Filter by role
            const myNotifs = allNotifs.filter(n => n.targetRole === 'ALL' || n.targetRole === userRole);
            setNotifications(myNotifs.reverse()); // newest first
        }
    };

    useEffect(() => {
        loadNotifications();
        // Listen to custom event for cross-component updates
        window.addEventListener('app_notify', loadNotifications);
        
        // Listen to clicks outside to close dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            window.removeEventListener('app_notify', loadNotifications);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userRole]);

    const markAllRead = () => {
        const stored = localStorage.getItem('app_notifications');
        if (stored) {
            const allNotifs: AppNotification[] = JSON.parse(stored);
            const updated = allNotifs.map(n => {
                if (n.targetRole === 'ALL' || n.targetRole === userRole) {
                    return { ...n, read: true };
                }
                return n;
            });
            localStorage.setItem('app_notifications', JSON.stringify(updated));
            loadNotifications();
        }
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            markAllRead();
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={toggleDropdown}
                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 text-sm">Thông báo ({unreadCount})</h4>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Đã đọc tất cả</button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">Không có thông báo nào.</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {notifications.map(n => (
                                    <li key={n.id} className={`p-4 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-emerald-50/30' : ''}`}>
                                        <p className="text-sm text-slate-800">{n.message}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(n.time).toLocaleString('vi-VN')}</p>
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

// Helper to push a notification from any component
export const pushNotification = (message: string, targetRole: AppNotification['targetRole']) => {
    const stored = localStorage.getItem('app_notifications');
    const notifs: AppNotification[] = stored ? JSON.parse(stored) : [];
    
    notifs.push({
        id: Date.now().toString() + Math.random().toString(),
        message,
        time: new Date().toISOString(),
        read: false,
        targetRole
    });
    
    localStorage.setItem('app_notifications', JSON.stringify(notifs));
    window.dispatchEvent(new Event('app_notify'));
};
