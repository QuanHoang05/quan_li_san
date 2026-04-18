import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function DashboardPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1>Tổng quan (Dashboard)</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <Card>
                    <CardHeader>
                        <CardTitle>Doanh thu hôm nay</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>2,450,000 đ</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Số trận đã đặt</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>18 Trận</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Check-in rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>95%</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
