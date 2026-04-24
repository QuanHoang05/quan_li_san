'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main style={{ fontFamily: "'Inter', 'Be Vietnam Pro', sans-serif" }}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HERO SECTION */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f1923 0%, #0d2b2e 50%, #0a1a1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow effects */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        {/* Top badge */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '999px',
          padding: '0.4rem 1.2rem',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backdropFilter: 'blur(10px)',
        }}>
          🏆 Nền tảng Thể thao Toàn diện
        </div>

        {/* Main heading */}
        <h1 style={{
          color: 'white',
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1.1,
          marginBottom: '0.5rem',
          letterSpacing: '-0.02em',
        }}>
          Nâng tầm trải nghiệm
        </h1>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1.1,
          marginBottom: '1.5rem',
          letterSpacing: '-0.02em',
          background: 'linear-gradient(90deg, #10b981, #34d399)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          QuanLiSan
        </h1>

        {/* Subtitle */}
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          textAlign: 'center',
          maxWidth: '600px',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
        }}>
          Hệ thống quản lý sân bãi thông minh, kết nối cộng đồng người chơi và tối ưu hóa vận hành kinh doanh thể thao của bạn.
        </p>

        {/* Features row */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: '⏰', text: 'Đặt sân nhanh' },
            { icon: '👥', text: 'Ghép kèo dễ dàng' },
            { icon: '✅', text: 'Quản lý tối ưu' },
          ].map(f => (
            <span key={f.text} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#10b981' }}>{f.icon}</span> {f.text}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '4rem' }}>
          <button onClick={() => router.push('/courts')} style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '0.9rem 2rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(16,185,129,0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
            🏟️ Khám phá Sân Thể Thao
          </button>
          <button onClick={() => router.push('/matchmaking')} style={{
            background: 'transparent',
            color: 'white',
            border: '1.5px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            padding: '0.9rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'white'; }}>
            👫 Tìm Kèo / Ghép Trận
          </button>
        </div>

        {/* Scroll cue */}
        <div style={{ position: 'absolute', bottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Bắt đầu ngay</span>
          <div style={{ color: '#10b981', fontSize: '1.2rem', animation: 'bounce 1.5s infinite' }}>↓</div>
        </div>
      </section>

      {/* SPORTS SECTION */}
      <section style={{ background: '#f8fafc', padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Các loại sân thể thao</h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem' }}>Hỗ trợ đầy đủ các bộ môn phổ biến nhất</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: '🏸', name: 'Cầu Lông', desc: 'Sân tiêu chuẩn BWF, đèn LED', color: '#6366f1' },
              { icon: '⚽', name: 'Bóng Đá', desc: 'Sân cỏ nhân tạo 5-7 người', color: '#10b981' },
              { icon: '🎾', name: 'Tennis', desc: 'Mặt sân hard court chuyên nghiệp', color: '#f59e0b' },
              { icon: '🏓', name: 'Pickleball', desc: 'Xu hướng thể thao mới nhất', color: '#ef4444' },
            ].map(sport => (
              <div key={sport.name} onClick={() => router.push('/courts')} style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{sport.icon}</div>
                <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem', fontSize: '1.1rem' }}>{sport.name}</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{sport.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: 'white', padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Đặt sân chỉ 3 bước</h2>
          <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '3rem' }}>Nhanh chóng, đơn giản, không cần đăng ký</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
            {[
              { step: '01', title: 'Chọn môn & sân', desc: 'Xem lịch sân trực tiếp theo ngày, chọn khung giờ còn trống.' },
              { step: '02', title: 'Điền thông tin', desc: 'Nhập tên, số điện thoại và chọn hình thức thanh toán (đặt cọc / full).' },
              { step: '03', title: 'Xác nhận & chờ', desc: 'Nhân viên xác nhận và liên hệ lại với bạn trong vài phút.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#e2e8f0', lineHeight: 1, marginBottom: '0.75rem' }}>{s.step}</span>
                <h3 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', fontSize: '1.05rem' }}>{s.title}</h3>
                <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: '0.9rem' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{ background: 'linear-gradient(135deg, #0f1923, #0d2b2e)', padding: '5rem 2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Sẵn sàng trải nghiệm?</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2.5rem' }}>Khám phá sân, tìm đối thủ và đặt lịch ngay hôm nay.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/courts')} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', padding: '0.9rem 2.5rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 30px rgba(16,185,129,0.35)' }}>
            Đặt sân ngay
          </button>
          <button onClick={() => router.push('/login')} style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.9rem 2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            Đăng nhập hệ thống quản lý
          </button>
        </div>
      </section>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
      `}</style>
    </main>
  );
}
