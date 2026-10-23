import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Absensi Mahali — Sistem Absensi Digital',
  description: 'Kelola kehadiran acara per Mahali. Sistem absensi digital yang sederhana, aman, dan terorganisir.',
  keywords: 'absensi, kehadiran, mahali, acara, QR code',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
