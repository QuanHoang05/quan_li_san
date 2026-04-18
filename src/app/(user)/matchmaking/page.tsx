import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function MatchmakingPage() {
    const matches = [
        { id: 1, sport: 'Pickleball', level: 'Beginner (2.0 - 2.5)', time: '18:00 - 20:00 Hôm nay', courts: 'Sân số 3' },
        { id: 2, sport: 'Cầu lông', level: 'Intermediate (Tầm trung)', time: '19:00 - 21:00 Ngày mai', courts: 'Sân số 1' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Tìm trận đấu</h2>
                <Button size="sm">Tạo trận mới</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matches.map(match => (
                    <Card key={match.id}>
                        <CardHeader>
                            <CardTitle style={{ color: 'var(--primary)' }}>{match.sport}</CardTitle>
                        </CardHeader>
                        <CardContent style={{ padding: '0 1.5rem 1.5rem' }}>
                            <p><strong>Cấp độ:</strong> {match.level}</p>
                            <p><strong>Thời gian:</strong> {match.time}</p>
                            <p><strong>Địa điểm:</strong> {match.courts}</p>
                        </CardContent>
                        <CardFooter>
                            <Button fullWidth>Tham gia ngay</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
