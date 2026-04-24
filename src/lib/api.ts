// src/lib/api.ts

// Giải quyết lỗi CORS/Fetch: Nếu chạy trên Browser (client), ép buộc dùng localhost:8000
const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser ? 'http://localhost:8000' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

export interface Product {
    id: number;
    name: string;
    category: string;
    price: number;
    cost_price: number;
    stock_quantity: number;
    image_url: string | null;
    unit: string;
    min_stock: number;
}

export interface BankSettings {
    id: number;
    bank_code: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    is_active: boolean;
}

export const api = {
    uploadFile: async (file: File): Promise<{url: string}> => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Không thể tải ảnh lên');
        return res.json();
    },
    
    products: {
        getAll: async (): Promise<Product[]> => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/products`, {
                    next: { revalidate: 0 } // no caching for real-time POS
                });
                if (!res.ok) throw new Error('Lỗi khi tải danh sách sản phẩm');
                return res.json();
            } catch (error) {
                console.error("Fetch products failed:", error);
                throw error;
            }
        },
        
        create: async (data: Omit<Product, 'id'>): Promise<Product> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Không thể thêm sản phẩm');
            return res.json();
        },
        
        update: async (id: number, data: Omit<Product, 'id'>): Promise<Product> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Không thể cập nhật sản phẩm');
            return res.json();
        },
        
        delete: async (id: number): Promise<boolean> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/products/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Không thể xóa sản phẩm');
            return true;
        },
        
        reportDamage: async (data: { product_id: number; reason: string; amount: number; compensation_amount?: number }): Promise<{ok: boolean, new_stock: number}> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/report-damage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Không thể báo hỏng sản phẩm');
            return res.json();
        }
    },
    
    inventory: {
        getLogs: async (params?: { log_type?: string; date_from?: string; date_to?: string; product_id?: number }): Promise<any[]> => {
            const q = new URLSearchParams();
            if (params) {
                if (params.log_type) q.set('log_type', params.log_type);
                if (params.date_from) q.set('date_from', params.date_from);
                if (params.date_to) q.set('date_to', params.date_to);
                if (params.product_id) q.set('product_id', String(params.product_id));
            }
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/logs?${q.toString()}`, { next: { revalidate: 0 } });
            if (!res.ok) throw new Error('Lỗi fetch log');
            return res.json();
        },
        import: async (data: { product_id: number; quantity: number; unit_cost?: number; supplier_name?: string; note?: string; selling_price?: number; product_name?: string; image_url?: string; user_name?: string; is_admin?: boolean }): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/import`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Import failed');
            return res.json();
        },
        approveLog: async (logId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/logs/${logId}/approve`, { method: 'PUT' });
            if (!res.ok) throw new Error('Approve failed');
            return res.json();
        },
        rejectLog: async (logId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/logs/${logId}/reject`, { method: 'PUT' });
            if (!res.ok) throw new Error('Reject failed');
            return res.json();
        },
        deleteLog: async (logId: number, is_admin: boolean = false): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/logs/${logId}?is_admin=${is_admin}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            return res.json();
        },
        updateLog: async (logId: number, data: any): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/logs/${logId}`, { 
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Update failed');
            return res.json();
        },
        approveDamage: async (logId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/approve-damage/${logId}`, { method: 'POST' });
            if (!res.ok) throw new Error('Approve failed');
            return res.json();
        },
        rejectDamage: async (logId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/inventory/reject-damage/${logId}`, { method: 'POST' });
            if (!res.ok) throw new Error('Reject failed');
            return res.json();
        }
    },
    
    orders: {
        checkout: async (data: { items: {product_id: number, quantity: number}[], payment_method: string, total_amount: number, customer_id?: number }) => {
            const res = await fetch(`${API_BASE_URL}/api/v1/orders/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Thanh toán thất bại');
            return res.json();
        }
    },
    
    courts: {
        getAll: async (): Promise<any[]> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts`);
            if (!res.ok) throw new Error('Failed to fetch courts');
            return res.json();
        },
        create: async (data: any): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Create court failed');
            return res.json();
        },
        update: async (id: number, data: any): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Update court failed');
            return res.json();
        },
        delete: async (id: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Delete court failed');
            return res.json();
        },
        block: async (id: number, data: {start_time: string, end_time: string, reason: string}) => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${id}/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Block court failed');
            return res.json();
        },
        unblock: async (blockId: number) => {
            const res = await fetch(`${API_BASE_URL}/api/v1/blocks/${blockId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Unblock failed');
            return res.json();
        },
        // --- PRICING RULES ---
        getPricing: async (courtId: number): Promise<any[]> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${courtId}/pricing`);
            if (!res.ok) throw new Error('Get pricing failed');
            return res.json();
        },
        upsertPricing: async (courtId: number, shiftId: number, data: { tier: string; price_override: number | null }): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${courtId}/pricing/${shiftId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Upsert pricing failed');
            return res.json();
        },
        deletePricing: async (courtId: number, shiftId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/${courtId}/pricing/${shiftId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Delete pricing failed');
            return res.json();
        }
    },
    
    scheduler: {
        getDaily: async (date: string): Promise<{courts: any[], bookings: any[], blocks: any[]}> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/scheduler?date=${date}`);
            if (!res.ok) throw new Error('Get scheduler failed');
            return res.json();
        }
    },
    
    bookings: {
        create: async (data: any): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Create booking failed');
            return res.json();
        },
        reassign: async (id: number, data: {court_id: number, start_time: string, end_time: string}): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/${id}/reassign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Reassign failed');
            return res.json();
        },
        update: async (id: number, data: any): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Update booking failed');
            return res.json();
        },
        delete: async (id: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Delete booking failed');
            return res.json();
        },
        // --- HISTORY (hard delete) ---
        getHistory: async (params: { court_id?: number; date_from?: string; date_to?: string }): Promise<any[]> => {
            const q = new URLSearchParams();
            if (params.court_id) q.set('court_id', String(params.court_id));
            if (params.date_from) q.set('date_from', params.date_from);
            if (params.date_to) q.set('date_to', params.date_to);
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/history?${q.toString()}`);
            if (!res.ok) throw new Error('Get history failed');
            return res.json();
        },
        hardDelete: async (id: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/history/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Hard delete failed');
            return res.json();
        },
        hardDeleteAll: async (params: { court_id?: number; date_from?: string; date_to?: string }): Promise<any> => {
            const q = new URLSearchParams();
            if (params.court_id) q.set('court_id', String(params.court_id));
            if (params.date_from) q.set('date_from', params.date_from);
            if (params.date_to) q.set('date_to', params.date_to);
            const res = await fetch(`${API_BASE_URL}/api/v1/bookings/history?${q.toString()}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Hard delete all failed');
            return res.json();
        }
    },

    stats: {
        byShift: async (params: { period: 'month' | 'year'; value: string; court_id?: number }): Promise<any> => {
            const q = new URLSearchParams({ period: params.period, value: params.value });
            if (params.court_id) q.set('court_id', String(params.court_id));
            const res = await fetch(`${API_BASE_URL}/api/v1/stats/by-shift?${q.toString()}`);
            if (!res.ok) throw new Error('Get stats failed');
            return res.json();
        },
        products: async (params: {
            period: 'day' | 'range' | 'month' | 'year';
            value?: string;
            date_from?: string;
            date_to?: string;
            category?: string;
        }): Promise<any> => {
            const q = new URLSearchParams();
            if (params.period) q.set('period', params.period);
            if (params.value) q.set('value', params.value);
            if (params.date_from) q.set('date_from', params.date_from);
            if (params.date_to) q.set('date_to', params.date_to);
            if (params.category) q.set('category', params.category);
            const res = await fetch(`${API_BASE_URL}/api/v1/stats/products?${q.toString()}`);
            if (!res.ok) throw new Error('Get product stats failed');
            return res.json();
        }
    },

    bank: {
        get: async (): Promise<BankSettings | null> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bank-settings`);
            if (!res.ok) return null;
            return res.json();
        },
        getAll: async (): Promise<BankSettings[]> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bank-settings/all`);
            if (!res.ok) return [];
            return res.json();
        },
        update: async (data: Omit<BankSettings, 'id' | 'is_active'>): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bank-settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Bank settings update failed');
            return res.json();
        },
        toggle: async (id: number, is_active: boolean): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bank-settings/${id}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active })
            });
            if (!res.ok) throw new Error('Bank settings toggle failed');
            return res.json();
        },
        delete: async (id: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/bank-settings/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Bank settings delete failed');
            return res.json();
        }
    },

    onlineBookings: {
        getAvailability: async (date: string): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/courts/availability?date=${date}`);
            if (!res.ok) throw new Error('Get availability failed');
            return res.json();
        },
        create: async (data: {
            court_id: number;
            date: string;
            shift_ids: number[];
            guest_name: string;
            guest_phone: string;
            note?: string;
        }): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/online-bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Đặt sân thất bại');
            }
            return res.json();
        },
        getById: async (id: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/online-bookings/${id}`);
            if (!res.ok) throw new Error('Get booking failed');
            return res.json();
        },
        getByPhone: async (phone: string): Promise<any[]> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/online-bookings/by-phone/${encodeURIComponent(phone)}`);
            if (!res.ok) throw new Error('Get bookings by phone failed');
            return res.json();
        },
        uploadProof: async (bookingId: number, file: File): Promise<any> => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE_URL}/api/v1/online-bookings/${bookingId}/upload-proof`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Upload proof failed');
            return res.json();
        },
        confirmTest: async (payment_ref: string, amount: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/webhooks/confirm-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_ref, amount, source: 'test' }),
            });
            if (!res.ok) throw new Error('Confirm test failed');
            return res.json();
        },
        manualApprove: async (bookingId: number): Promise<any> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/online-bookings/${bookingId}/manual-approve`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Manual approve failed');
            return res.json();
        },
        getWebhookLogs: async (): Promise<any[]> => {
            const res = await fetch(`${API_BASE_URL}/api/v1/webhook-logs`);
            if (!res.ok) return [];
            return res.json();
        },
    },
}
