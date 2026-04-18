import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'QuanLiSan - Hệ thống quản lý thông minh',
  description: 'SaaS quản lý sân thể thao và mạng xã hội kết nối người chơi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased text-slate-900 bg-white`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
