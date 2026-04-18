/**
 * MODULE: ai_tools.ts
 * PURPOSE: Advanced AI Service Layer with Strict Role-Based Access Control (RBAC).
 * 
 * DESIGN PRINCIPLES (Senior Level):
 * 1. AI cannot access DB directly. It must call these predefined tools.
 * 2. Every tool call checks `currentUser.role` before execution.
 * 3. Logging is mandatory for security and audit trailing.
 */

export interface UserContext {
    id: number;
    role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}

export interface AIResponse<T> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    timestamp: string;
}

export class AIToolsService {
    private currentUser: UserContext;

    /**
     * Every AI agent session must instantiate this service with the calling user's context.
     * This is how we prevent data leakage.
     */
    constructor(userContext: UserContext) {
        this.currentUser = userContext;
    }

    private log(action: string, details: any) {
        const timestamp = new Date().toISOString();
        console.info(`[AI_TOOLS][${timestamp}][User:${this.currentUser.id}][Role:${this.currentUser.role}] Action: ${action}`, JSON.stringify(details));
    }

    private logError(action: string, error: unknown) {
        const timestamp = new Date().toISOString();
        console.error(`[AI_ERROR][${timestamp}][User:${this.currentUser.id}] Action: ${action}`, error);
    }

    private formatResponse<T>(success: boolean, message: string, data?: T, error?: string): AIResponse<T> {
        return {
            success,
            message,
            data,
            error,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * 1. get_financial_report()
     * STRICT ACCESS: Admin Only.
     * Returns: Revenue, tax, and profit calculations.
     */
    public async get_financial_report(): Promise<AIResponse<any>> {
        this.log('get_financial_report', { request: 'Fetch sensitive financial data' });

        // --- RBAC CHECK ---
        if (this.currentUser.role !== 'ADMIN') {
            this.log('get_financial_report', { status: 'denied_access' });
            return this.formatResponse(false, "Từ chối truy cập: Bạn không có quyền xem Báo cáo tài chính.");
        }
        // ------------------

        try {
            const MOCK_TAX_RATE = 0.10;
            const courtRevenue = 15500000;
            const posRevenue = 2450000;
            const totalRevenue = courtRevenue + posRevenue;

            const report = {
                month: "2023-11",
                court_revenue: courtRevenue,
                pos_revenue: posRevenue,
                total_revenue: totalRevenue,
                estimated_tax: totalRevenue * MOCK_TAX_RATE,
                net_revenue: totalRevenue - (totalRevenue * MOCK_TAX_RATE)
            };

            return this.formatResponse(true, "Lấy báo cáo tài chính thành công.", report);
        } catch (error) {
            this.logError('get_financial_report', error);
            return this.formatResponse(false, "Lỗi hệ thống.", undefined, (error as Error).message);
        }
    }

    /**
     * 2. get_personal_salary()
     * ACCESS: Staff & Admin.
     * Logic: Only returns salary data for `this.currentUser.id`!
     */
    public async get_personal_salary(): Promise<AIResponse<any>> {
        this.log('get_personal_salary', { request: 'Fetch personal salary' });

        if (this.currentUser.role === 'CUSTOMER') {
            return this.formatResponse(false, "Từ chối: Khách hàng không có thông tin lương.");
        }

        try {
            // Mock calculation based on shifts
            const salaryDetails = {
                userId: this.currentUser.id,
                month: "2023-11",
                total_shifts: 24,
                base_salary: 5000000,
                commission: 450000,
                total_payout: 5450000
            };

            return this.formatResponse(true, "Lấy lương cá nhân thành công.", salaryDetails);
        } catch (error) {
            this.logError('get_personal_salary', error);
            return this.formatResponse(false, "Lỗi khi lấy thông tin lương.", undefined, (error as Error).message);
        }
    }

    /**
     * 3. get_inventory_status()
     * ACCESS: Admin & Staff (Customers denied).
     * Returns: Products and stock quantities.
     */
    public async get_inventory_status(): Promise<AIResponse<any>> {
        this.log('get_inventory_status', { request: 'Fetch inventory limits' });

        if (this.currentUser.role === 'CUSTOMER') {
            return this.formatResponse(false, "Từ chối truy cập: Chỉ nhân viên hoặc Admin mới có quyền kiểm tra kho.");
        }

        try {
            const mockProducts = [
                { id: 1, name: "Nước Suối Aquafina", price: 10000, stock_quantity: 120 },
                { id: 2, name: "Thuê Vợt Pickleball", price: 50000, stock_quantity: 12 }
            ];

            return this.formatResponse(true, "Lấy thông tin kho thành công.", mockProducts);
        } catch (error) {
            this.logError('get_inventory_status', error);
            return this.formatResponse(false, "Lỗi khi kiểm tra kho.", undefined, (error as Error).message);
        }
    }
}
