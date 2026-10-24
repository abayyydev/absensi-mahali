'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { confirmDialog, notifyError, notifySuccess, promptVoid } from '@/lib/swal';

/* ─── Types ─── */
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
type User = { id: number; name: string; email: string; role: 'superadmin' | 'admin' | 'committee'; is_active?: number; created_at?: string };
type EventRow = { id: number; name: string; description?: string | null; location?: string | null; starts_at: string; ends_at: string; attendance_opens_at: string; attendance_closes_at: string; status: string; mahali_count: number };
type Mahali = { id: number; code: string; name: string; is_active: number };
type QrLink = { id: number; is_active: number; name: string; code: string };
type Summary = { mahalis: { mahaliId: number; mahaliName: string; total: number }[]; total: number };
type Attendance = { id: number; checked_in_at: string; status: string; mahaliName: string; void_reason?: string | null };
type View = 'dashboard' | 'events' | 'mahalis' | 'qr' | 'reports' | 'users';
type EventForm = { name: string; description: string; location: string; startsAt: string; endsAt: string; attendanceOpensAt: string; attendanceClosesAt: string; status: string };

/* ─── Constants ─── */
const emptyEvent: EventForm = { name: '', description: '', location: '', startsAt: '', endsAt: '', attendanceOpensAt: '', attendanceClosesAt: '', status: 'upcoming' };

/* ─── Tailwind class tokens ─── */
const inputClass = 'mt-1.5 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 disabled:bg-slate-100 disabled:cursor-not-allowed';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-900 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[.98] disabled:opacity-50';
const dangerButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 active:scale-[.98]';

/* ─── Helpers ─── */
function localInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T').replace(/Z$/, '')}${value.includes('Z') ? '' : 'Z'}`);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return Number.isNaN(date.getTime()) ? '' : shifted.toISOString().slice(0, 16);
}
function iso(value: string) { return new Date(value).toISOString(); }
function dateLabel(value: string) {
  return new Date(`${value.replace(' ', 'T').replace(/Z$/, '')}Z`).toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta'
  });
}
function friendlyError(code: string) {
  if (code === 'UNAUTHENTICATED') return '';
  if (code === 'FORBIDDEN') return 'Akun ini tidak memiliki akses untuk tindakan tersebut.';
  if (code === 'RATE_LIMITED') return 'Terlalu banyak permintaan. Coba lagi beberapa saat.';
  return 'Permintaan gagal. Periksa koneksi lalu coba lagi.';
}
function eventFriendlyError(code: string) {
  if (code === 'FORBIDDEN') return 'Hanya admin yang dapat mengubah acara.';
  if (code === 'INVALID_REQUEST') return 'Data acara tidak valid. Pastikan waktu mulai dan selesai berurutan.';
  return 'Acara gagal disimpan. Periksa koneksi lalu coba lagi.';
}

function generateQrCard(qrDataUrl: string, label: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(qrDataUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cardWidth = 720;
      const qrSize = 580;
      const paddingX = (cardWidth - qrSize) / 2;
      const paddingTop = 48;
      const gap = 28;
      const fontSize = 24;
      const bottomPadding = 42;
      const radius = 28;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(qrDataUrl);
        return;
      }

      ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      const maxTextWidth = cardWidth - 64;
      const words = label.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 1.4;
      const textBlockHeight = lines.length * lineHeight;
      const cardHeight = Math.round(paddingTop + qrSize + gap + textBlockHeight + bottomPadding);

      canvas.width = cardWidth;
      canvas.height = cardHeight;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, cardWidth, cardHeight, radius);
      } else {
        ctx.moveTo(radius, 0);
        ctx.lineTo(cardWidth - radius, 0);
        ctx.quadraticCurveTo(cardWidth, 0, cardWidth, radius);
        ctx.lineTo(cardWidth, cardHeight - radius);
        ctx.quadraticCurveTo(cardWidth, cardHeight, cardWidth - radius, cardHeight);
        ctx.lineTo(radius, cardHeight);
        ctx.quadraticCurveTo(0, cardHeight, 0, cardHeight - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
      }
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      ctx.drawImage(img, paddingX, paddingTop, qrSize, qrSize);

      ctx.fillStyle = '#1e293b';
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textStartY = paddingTop + qrSize + gap + lineHeight / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, cardWidth / 2, textStartY + index * lineHeight);
      });

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(qrDataUrl);
    img.src = qrDataUrl;
  });
}

/* ─── SVG Icons ─── */
function IconDashboard() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>; }
function IconCalendar() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" /></svg>; }
function IconBuilding() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h10.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75h-1.5v2h3.25a.75.75 0 01.75.75v3.5a.75.75 0 01-.75.75H1.75A.75.75 0 011 17.25v-3.5a.75.75 0 01.75-.75H5v-2H3.5a.75.75 0 01-.75-.75v-7.5zm5.5 7.5v2h3v-2h-3z" clipRule="evenodd" /></svg>; }
function IconUsers() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a3 3 0 100-6 3 3 0 000 6zm6 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 15.25A4.75 4.75 0 016.25 10.5h1.5a4.75 4.75 0 014.75 4.75v.5H1.5v-.5zm12.25-3.9a4.75 4.75 0 014.75 4.75v.5H14v-1.35a6.2 6.2 0 00-1.3-3.8h1.05z" /></svg>; }
function IconQr() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4.25A1.25 1.25 0 014.25 3h3.5A1.25 1.25 0 019 4.25v3.5A1.25 1.25 0 017.75 9h-3.5A1.25 1.25 0 013 7.75v-3.5zm1.5.25v3h3v-3h-3zM3 12.25A1.25 1.25 0 014.25 11h3.5A1.25 1.25 0 019 12.25v3.5A1.25 1.25 0 017.75 17h-3.5A1.25 1.25 0 013 15.75v-3.5zm1.5.25v3h3v-3h-3zM12.25 3A1.25 1.25 0 0011 4.25v3.5A1.25 1.25 0 0012.25 9h3.5A1.25 1.25 0 0017 7.75v-3.5A1.25 1.25 0 0015.75 3h-3.5zm.25 1.5v3h3v-3h-3zM11 12.25a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5zm4 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75v-1.5zm-3.25 3.25a.75.75 0 00-.75.75v1.5a.75.75 0 00.75.75h1.5a.75.75 0 00.75-.75v-1.5a.75.75 0 00-.75-.75h-1.5zm4 0a.75.75 0 00-.75.75v1.5a.75.75 0 00.75.75h1.5a.75.75 0 00.75-.75v-1.5a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" /></svg>; }
function IconChart() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" /></svg>; }
function IconLogout() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" /><path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd" /></svg>; }
function IconClose() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>; }
function IconMenu() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>; }
function IconDownload() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>; }
function IconRefresh() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.28a.75.75 0 00-.75.75v3.955a.75.75 0 001.5 0v-2.134l.228.228a7 7 0 0011.714-3.138.75.75 0 00-1.449-.39c-.031.115-.07.226-.112.334zm-.004-5.482A7 7 0 003.592 9.08a.75.75 0 101.449.39c.031-.116.07-.227.112-.335a5.5 5.5 0 019.201-2.466l.312.311H12.233a.75.75 0 000 1.5h3.955a.75.75 0 00.75-.75V3.775a.75.75 0 00-1.5 0v2.134l-.228-.228z" clipRule="evenodd" /></svg>; }
function IconEdit() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>; }
function IconPlus() { return <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>; }
function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

const navIcons: Record<string, React.ReactNode> = {
  dashboard: <IconDashboard />,
  events: <IconCalendar />,
  mahalis: <IconBuilding />,
  qr: <IconQr />,
  reports: <IconChart />,
  users: <IconUsers />,
};

const navItems = [
  { id: 'dashboard', label: 'Ringkasan' },
  { id: 'events', label: 'Acara' },
  { id: 'mahalis', label: 'Data Mahali' },
  { id: 'qr', label: 'QR Code' },
  { id: 'reports', label: 'Laporan' },
  { id: 'users', label: 'Pengguna' },
];

const pageTitles: Record<View, string> = {
  dashboard: 'Ringkasan kehadiran',
  events: 'Kelola acara',
  mahalis: 'Data Mahali',
  qr: 'QR acara',
  reports: 'Laporan kehadiran',
  users: 'Kelola pengguna',
};

/* ════════════════════════════════════════════════════ */
/*  REUSABLE MODAL COMPONENT                            */
/* ════════════════════════════════════════════════════ */
function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl animate-scale-in sm:p-8`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 id="modal-title" className="text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Tutup modal"
          >
            <IconClose />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*  MAIN ADMIN PAGE                                     */
/* ════════════════════════════════════════════════════ */
export default function AdminPage() {
  const [user, setUser] = useState<User>();
  const [managedUsers, setManagedUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [mahalis, setMahalis] = useState<Mahali[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [busy, setBusy] = useState(false);

  /* Modal visibility states */
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMahaliModalOpen, setIsMahaliModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  /* Form states */
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [editingEvent, setEditingEvent] = useState<number | null>(null);
  const [mahaliCode, setMahaliCode] = useState('');
  const [mahaliName, setMahaliName] = useState('');
  const [editingMahali, setEditingMahali] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedMahali, setSelectedMahali] = useState('');
  const [qrLinks, setQrLinks] = useState<QrLink[]>([]);
  const [qrData, setQrData] = useState('');
  const [qrLabel, setQrLabel] = useState('');
  const [reportEvent, setReportEvent] = useState('');
  const [reportMahali, setReportMahali] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [report, setReport] = useState<Summary>();
  const [history, setHistory] = useState<Attendance[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'committee' as 'admin' | 'committee' });
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' });

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('absensi_token') : null;
    const response = await fetch(`${api}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(savedToken ? { Authorization: `Bearer ${savedToken}` } : {}),
        ...init?.headers,
      },
    });
    const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(body?.error ?? 'REQUEST_FAILED');
    return body;
  }, []);

  const load = useCallback(async () => {
    const current = await request('/auth/me');
    setUser(current.user);
    const [eventResult, mahaliResult] = await Promise.all([request('/admin/events'), request('/admin/mahalis')]);
    setEvents(eventResult.events);
    setMahalis(mahaliResult.mahalis);
    setSelectedEvent((value) => value || String(eventResult.events[0]?.id ?? ''));
    setReportEvent((value) => value || String(eventResult.events[0]?.id ?? ''));
    if (current.user.role === 'admin' || current.user.role === 'superadmin') setManagedUsers((await request('/admin/users')).users);
  }, [request]);

  useEffect(() => { void load().catch(() => setUser(undefined)); }, [load]);

  useEffect(() => {
    if (!selectedEvent || !user) { setQrLinks([]); return; }
    void request(`/admin/events/${selectedEvent}/mahalis`)
      .then((result) => setQrLinks(result.mahalis))
      .catch((e: Error) => notifyError('Gagal memuat QR', friendlyError(e.message)));
  }, [selectedEvent, user, request, qrData]);

  /* ─── Action handlers ─── */
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (res?.token && typeof window !== 'undefined') {
        localStorage.setItem('absensi_token', res.token);
      }
      setPassword('');
      await load();
      notifySuccess('Berhasil masuk', 'Selamat datang di panel pengelolaan.');
    } catch (e) {
      notifyError('Gagal masuk', e instanceof Error && e.message === 'RATE_LIMITED'
        ? 'Terlalu banyak percobaan. Tunggu beberapa menit.'
        : 'Email atau kata sandi tidak cocok.');
    } finally { setBusy(false); }
  }

  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }); }
    finally {
      if (typeof window !== 'undefined') localStorage.removeItem('absensi_token');
      setUser(undefined); setView('dashboard'); notifySuccess('Berhasil keluar');
    }
  }

  /* ─── Events CRUD ─── */
  function openCreateEventModal() {
    setEditingEvent(null);
    setEventForm(emptyEvent);
    setIsEventModalOpen(true);
  }

  function editEvent(row: EventRow) {
    setEditingEvent(row.id);
    setEventForm({
      name: row.name,
      description: row.description ?? '',
      location: row.location ?? '',
      startsAt: localInput(row.starts_at),
      endsAt: localInput(row.ends_at),
      attendanceOpensAt: localInput(row.attendance_opens_at),
      attendanceClosesAt: localInput(row.attendance_closes_at),
      status: row.status,
    });
    setIsEventModalOpen(true);
  }

  async function saveEvent(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    if (new Date(eventForm.startsAt) >= new Date(eventForm.endsAt) || new Date(eventForm.attendanceOpensAt) >= new Date(eventForm.attendanceClosesAt)) {
      notifyError('Validasi Gagal', 'Waktu mulai harus sebelum waktu selesai. Rentang absensi juga harus berurutan.');
      setBusy(false);
      return;
    }
    const payload = {
      ...eventForm,
      startsAt: iso(eventForm.startsAt), endsAt: iso(eventForm.endsAt),
      attendanceOpensAt: iso(eventForm.attendanceOpensAt), attendanceClosesAt: iso(eventForm.attendanceClosesAt),
    };
    try {
      await request(editingEvent ? `/admin/events/${editingEvent}` : '/admin/events', {
        method: editingEvent ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      notifySuccess(editingEvent ? 'Perubahan Acara Tersimpan' : 'Acara Berhasil Dibuat');
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setEventForm(emptyEvent);
      await load();
    } catch (e) {
      notifyError('Gagal Menyimpan Acara', eventFriendlyError(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  async function archiveEvent(row: EventRow) {
    const confirmed = await confirmDialog({
      title: 'Arsipkan Acara?',
      text: `Arsipkan acara "${row.name}"? Riwayat absensi tetap tersimpan dan tidak dihapus.`,
      confirmText: 'Ya, arsipkan',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await request(`/admin/events/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
      notifySuccess('Acara Diarsipkan', `Acara "${row.name}" berhasil diarsipkan.`);
      await load();
    } catch (e) {
      notifyError('Gagal Mengarsipkan', eventFriendlyError(e instanceof Error ? e.message : ''));
    }
  }

  async function deleteEvent(row: EventRow) {
    const confirmed = await confirmDialog({
      title: 'Hapus Acara Permanen?',
      text: `Hapus acara "${row.name}" beserta seluruh data QR dan absensi terkait? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus permanen',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await request(`/admin/events/${row.id}`, { method: 'DELETE' });
      notifySuccess('Acara Dihapus', `Acara "${row.name}" berhasil dihapus.`);
      if (selectedEvent === String(row.id)) setSelectedEvent('');
      if (reportEvent === String(row.id)) setReportEvent('');
      await load();
    } catch {
      notifyError('Gagal Menghapus', 'Acara gagal dihapus. Periksa koneksi lalu coba lagi.');
    }
  }

  /* ─── Mahali CRUD ─── */
  function openCreateMahaliModal() {
    setEditingMahali(null);
    setMahaliCode('');
    setMahaliName('');
    setIsMahaliModalOpen(true);
  }

  function editMahali(item: Mahali) {
    setEditingMahali(item.id);
    setMahaliCode(item.code);
    setMahaliName(item.name);
    setIsMahaliModalOpen(true);
  }

  async function saveMahali(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const currentMahali = mahalis.find((item) => item.id === editingMahali);
      await request(editingMahali ? `/admin/mahalis/${editingMahali}` : '/admin/mahalis', {
        method: editingMahali ? 'PATCH' : 'POST',
        body: JSON.stringify({ code: mahaliCode, name: mahaliName, isActive: currentMahali ? Boolean(currentMahali.is_active) : true }),
      });
      notifySuccess(editingMahali ? 'Data Mahali Diperbarui' : 'Mahali Berhasil Ditambahkan');
      setIsMahaliModalOpen(false);
      setMahaliCode('');
      setMahaliName('');
      setEditingMahali(null);
      await load();
    } catch (e) {
      notifyError('Gagal Menyimpan Mahali', e instanceof Error && e.message === 'CONFLICT'
        ? 'Kode Mahali sudah digunakan.'
        : 'Data Mahali gagal disimpan. Periksa kembali isian formulir.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMahali(item: Mahali) {
    const active = !Boolean(item.is_active);
    if (!active) {
      const confirmed = await confirmDialog({
        title: 'Nonaktifkan Mahali?',
        text: `Nonaktifkan "${item.name}"? Data riwayat absensi lama tetap tersimpan.`,
        confirmText: 'Ya, nonaktifkan',
        isDanger: true,
      });
      if (!confirmed) return;
    }

    try {
      await request(`/admin/mahalis/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: active }) });
      notifySuccess(active ? 'Mahali Diaktifkan' : 'Mahali Dinonaktifkan');
      await load();
    } catch {
      notifyError('Gagal Memperbarui', 'Status Mahali gagal diperbarui.');
    }
  }

  async function deleteMahali(item: Mahali) {
    const confirmed = await confirmDialog({
      title: 'Hapus Mahali Permanen?',
      text: `Hapus Mahali "${item.name}" beserta seluruh tautan QR acara terkait? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus permanen',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await request(`/admin/mahalis/${item.id}`, { method: 'DELETE' });
      notifySuccess('Mahali Dihapus', `Mahali "${item.name}" berhasil dihapus.`);
      await load();
    } catch {
      notifyError('Gagal Menghapus Mahali', 'Mahali gagal dihapus. Periksa koneksi lalu coba lagi.');
    }
  }

  /* ─── QR Code Management ─── */
  function openCreateQrModal() {
    if (!selectedEvent && events.length > 0) {
      setSelectedEvent(String(events[0].id));
    }
    setIsQrModalOpen(true);
  }

  async function makeQr(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await request(`/admin/events/${selectedEvent}/mahalis/${selectedMahali}/qr`, { method: 'POST' });
      const mahali = mahalis.find((item) => String(item.id) === selectedMahali);
      const eventName = events.find((item) => String(item.id) === selectedEvent)?.name;
      const fullLabel = `${eventName ?? 'Acara'} — ${mahali?.name ?? 'Mahali'}`;
      setQrLabel(fullLabel);
      const cardImage = await generateQrCard(result.qrDataUrl, fullLabel);
      setQrData(cardImage);
      notifySuccess('QR Berhasil Dibuat', 'Kartu QR siap diunduh dan digunakan untuk absensi.');
      setIsQrModalOpen(false);
    } catch (e) {
      notifyError('Gagal Membuat QR', e instanceof Error && e.message === 'ALREADY_LINKED'
        ? 'Mahali ini sudah terhubung ke acara. Gunakan rotasi QR pada daftar.'
        : 'QR gagal dibuat. Pastikan acara dan Mahali aktif.');
    } finally {
      setBusy(false);
    }
  }

  async function previewQr(link: QrLink) {
    try {
      const result = await request(`/admin/event-mahalis/${link.id}/qr`);
      const eventName = events.find((item) => String(item.id) === selectedEvent)?.name;
      const fullLabel = `${eventName ?? 'Acara'} — ${link.name}`;
      setQrLabel(fullLabel);
      const cardImage = await generateQrCard(result.qrDataUrl, fullLabel);
      setQrData(cardImage);
      notifySuccess('Pratinjau QR', `Kartu QR untuk ${link.name} siap diunduh.`);
    } catch {
      notifyError('Gagal Memuat QR', 'Gambar QR tidak dapat dimuat.');
    }
  }

  async function changeQr(link: QrLink, patch: { active?: boolean; rotate?: boolean }) {
    if (patch.rotate) {
      const confirmed = await confirmDialog({
        title: 'Rotasi QR Code?',
        text: `QR lama untuk ${link.name} akan langsung tidak berlaku. Pastikan untuk mengunduh QR baru setelah dirotasi.`,
        confirmText: 'Ya, rotasi QR',
        isDanger: true,
      });
      if (!confirmed) return;
    }

    if (patch.active === false) {
      const confirmed = await confirmDialog({
        title: 'Nonaktifkan QR?',
        text: `QR ${link.name} tidak dapat digunakan peserta untuk check-in sementara waktu.`,
        confirmText: 'Ya, nonaktifkan',
        isDanger: true,
      });
      if (!confirmed) return;
    }

    try {
      const result = await request(`/admin/event-mahalis/${link.id}/qr`, { method: 'PATCH', body: JSON.stringify(patch) });
      if (result.qrDataUrl) {
        const fullLabel = `${events.find((item) => String(item.id) === selectedEvent)?.name ?? 'Acara'} — ${link.name}`;
        setQrLabel(fullLabel);
        const cardImage = await generateQrCard(result.qrDataUrl, fullLabel);
        setQrData(cardImage);
      }
      notifySuccess(patch.rotate ? 'QR Telah Dirotasi' : `QR ${patch.active ? 'diaktifkan' : 'dinonaktifkan'}`);
      setQrLinks((items) => items.map((item) => item.id === link.id ? { ...item, is_active: patch.rotate ? 1 : Number(patch.active) } : item));
    } catch {
      notifyError('Gagal Mengubah QR', 'Perubahan QR gagal disimpan.');
    }
  }

  async function deleteQr(link: QrLink) {
    const confirmed = await confirmDialog({
      title: 'Hapus QR Code?',
      text: `Hapus tautan QR untuk "${link.name}"? QR ini tidak akan dapat digunakan untuk absensi lagi.`,
      confirmText: 'Ya, hapus permanen',
      isDanger: true,
    });
    if (!confirmed) return;

    try {
      await request(`/admin/event-mahalis/${link.id}`, { method: 'DELETE' });
      notifySuccess('QR Dihapus', `QR untuk ${link.name} berhasil dihapus.`);
      setQrLinks((items) => items.filter((item) => item.id !== link.id));
      if (qrLabel.includes(link.name)) {
        setQrData('');
        setQrLabel('');
      }
    } catch {
      notifyError('Gagal Menghapus QR', 'QR gagal dihapus.');
    }
  }

  /* ─── Reports & Void Attendance ─── */
  async function showReport(eventId: string, filtered = true) {
    if (!eventId) return;
    const params = new URLSearchParams();
    if (filtered && reportMahali) params.set('mahaliId', reportMahali);
    if (filtered && dateFrom) params.set('dateFrom', dateFrom);
    if (filtered && dateTo) params.set('dateTo', dateTo);
    const summaryQuery = params.toString();
    const historyParams = new URLSearchParams(summaryQuery);
    historyParams.set('pageSize', '500');
    if (filtered && statusFilter) historyParams.set('status', statusFilter);
    try {
      const [summary, rows] = await Promise.all([
        request(`/admin/reports/events/${eventId}/summary${summaryQuery ? `?${summaryQuery}` : ''}`),
        request(`/admin/reports/events/${eventId}/attendances?${historyParams}`),
      ]);
      setReport(summary); setHistory(rows.attendances);
    } catch {
      notifyError('Gagal Memuat Laporan', 'Periksa filter dan koneksi lalu coba lagi.');
    }
  }

  async function voidAttendance(row: Attendance) {
    const reason = await promptVoid(row.mahaliName);
    if (!reason) return;

    try {
      await request(`/admin/attendances/${row.id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
      notifySuccess('Check-in Dikoreksi', 'Perubahan status berhasil dicatat di audit log.');
      await showReport(reportEvent);
    } catch {
      notifyError('Koreksi Gagal', 'Pastikan Anda masuk sebagai administrator yang berwenang.');
    }
  }

  /* ─── Render ─── */
  async function createManagedUser(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      await request('/admin/users', { method: 'POST', body: JSON.stringify(userForm) });
      setUserForm({ name: '', email: '', password: '', role: user?.role === 'superadmin' ? 'admin' : 'committee' });
      notifySuccess('Akun Berhasil Dibuat'); await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      notifyError('Gagal Membuat Akun', code === 'EMAIL_IN_USE' ? 'Email tersebut sudah digunakan.' : code === 'FORBIDDEN' ? 'Admin hanya dapat membuat akun panitia.' : 'Periksa data dan pastikan kata sandi minimal 8 karakter.');
    } finally { setBusy(false); }
  }

  function startEditUser(account: User) {
    setEditingUser(account.id); setProfileForm({ name: account.name, email: account.email, password: '' });
  }

  async function saveManagedUser(event: FormEvent) {
    event.preventDefault(); if (editingUser === null) return; setBusy(true);
    const payload: { name: string; email: string; password?: string } = { name: profileForm.name, email: profileForm.email };
    if (profileForm.password) payload.password = profileForm.password;
    try {
      await request(`/admin/users/${editingUser}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditingUser(null); setProfileForm({ name: '', email: '', password: '' });
      notifySuccess('Profil Pengguna Diperbarui'); await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      notifyError('Gagal Memperbarui Profil', code === 'EMAIL_IN_USE' ? 'Email tersebut sudah digunakan.' : 'Pastikan data valid dan kata sandi baru minimal 8 karakter.');
    } finally { setBusy(false); }
  }

  if (!user) return <LoginPage email={email} password={password} busy={busy} onEmail={setEmail} onPassword={setPassword} onSubmit={login} />;
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const activeEvent = events.find((item) => String(item.id) === reportEvent);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ─── Sidebar desktop ─── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        {/* Logo */}
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="grid size-10 place-items-center rounded-xl bg-blue-950 text-sm font-black text-white shadow-sm">AM</div>
          <div>
            <p className="font-bold tracking-tight">Absensi Mahali</p>
            <p className="text-xs text-slate-500">Panel pengelolaan</p>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3 py-5">
          {navItems.filter((item) => (isAdmin || !['mahalis', 'users'].includes(item.id))).map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as View)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-all duration-200 ${
                view === item.id
                  ? 'bg-blue-50 text-blue-950 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`grid size-8 place-items-center rounded-lg transition-colors duration-200 ${
                view === item.id ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{navIcons[item.id]}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{user.role === 'superadmin' ? 'Superadmin' : isAdmin ? 'Administrator' : 'Panitia'}</p>
          </div>
          <button className={`${secondaryButton} w-full justify-center`} onClick={() => void logout()}>
            <IconLogout />
            Keluar
          </button>
        </div>
      </aside>

      {/* ─── Mobile menu overlay ─── */}
      {mobileMenu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileMenu(false)} />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 w-72 border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex h-[72px] items-center justify-between border-b border-slate-100 px-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-blue-950 text-sm font-black text-white">AM</div>
                <p className="font-bold tracking-tight">Absensi Mahali</p>
              </div>
              <button onClick={() => setMobileMenu(false)} className="grid size-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="Tutup menu">
                <IconClose />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-5">
              {navItems.filter((item) => (isAdmin || !['mahalis', 'users'].includes(item.id))).map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id as View); setMobileMenu(false); }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-all ${
                    view === item.id ? 'bg-blue-50 text-blue-950' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${view === item.id ? 'bg-blue-950 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {navIcons[item.id]}
                  </span>
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 rounded-xl bg-slate-50 p-3">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{user.role === 'superadmin' ? 'Superadmin' : isAdmin ? 'Administrator' : 'Panitia'}</p>
              </div>
              <button className={`${secondaryButton} w-full justify-center`} onClick={() => { void logout(); setMobileMenu(false); }}>
                <IconLogout /> Keluar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Main content ─── */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-7 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Buka menu">
                <IconMenu />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-800">
                  Ruang kerja / {navItems.find((item) => item.id === view)?.label}
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">{pageTitles[view]}</h1>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role === 'superadmin' ? 'Superadmin' : isAdmin ? 'Admin' : 'Panitia'}</p>
              </div>
              <div className="grid size-9 place-items-center rounded-full bg-blue-950 text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
          {/* View content */}
          <div className="animate-fade-in">
            {view === 'dashboard' && (
              <Dashboard
                events={events}
                mahalis={mahalis}
                onSelect={(id) => { setReportEvent(String(id)); setView('reports'); void showReport(String(id), false); }}
              />
            )}
            {view === 'events' && (
              <EventsPage
                events={events}
                isAdmin={isAdmin}
                onAdd={openCreateEventModal}
                onEdit={editEvent}
                onArchive={archiveEvent}
                onDelete={deleteEvent}
              />
            )}
            {view === 'mahalis' && (
              <MahalisPage
                items={mahalis}
                isAdmin={isAdmin}
                onAdd={openCreateMahaliModal}
                onEdit={editMahali}
                onToggle={toggleMahali}
                onDelete={deleteMahali}
              />
            )}
            {view === 'qr' && (
              <QrPage
                events={events}
                links={qrLinks}
                selectedEvent={selectedEvent}
                data={qrData}
                label={qrLabel}
                isAdmin={isAdmin}
                onEvent={setSelectedEvent}
                onOpenCreate={openCreateQrModal}
                onPreview={previewQr}
                onChange={changeQr}
                onDelete={deleteQr}
              />
            )}
            {view === 'reports' && (
              <ReportsPage
                events={events}
                mahalis={mahalis}
                reportEvent={reportEvent}
                reportMahali={reportMahali}
                dateFrom={dateFrom}
                dateTo={dateTo}
                status={statusFilter}
                summary={report}
                history={history}
                activeEvent={activeEvent}
                canCorrect={isAdmin}
                onVoid={(row) => void voidAttendance(row)}
                onEvent={setReportEvent}
                onMahali={setReportMahali}
                onDateFrom={setDateFrom}
                onDateTo={setDateTo}
                onStatus={setStatusFilter}
                onFilter={(e) => { e.preventDefault(); void showReport(reportEvent); }}
                onLoad={() => void showReport(reportEvent, false)}
              />
            )}
            {view === 'users' && isAdmin && (
              <UsersPage
                users={managedUsers}
                isSuperAdmin={user.role === 'superadmin'}
                userForm={userForm}
                editingUser={editingUser}
                profileForm={profileForm}
                busy={busy}
                onUserForm={setUserForm}
                onCreate={createManagedUser}
                onEdit={startEditUser}
                onProfileForm={setProfileForm}
                onUpdate={saveManagedUser}
                onCancelEdit={() => setEditingUser(null)}
              />
            )}
          </div>
        </main>
      </div>

      {/* ─── MODAL: EVENT FORM ─── */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title={editingEvent ? 'Ubah Acara' : 'Buat Acara Baru'}
        subtitle="Lengkapi informasi acara, jadwal pelaksanaan, dan jendela waktu absensi."
      >
        <form onSubmit={saveEvent} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Nama acara
            <input
              className={inputClass}
              type="text"
              required
              value={eventForm.name}
              onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
              placeholder="Contoh: Majelis Akbar 2026"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Lokasi
              <input
                className={inputClass}
                type="text"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Gedung / Aula"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Status
              <select
                className={inputClass}
                value={eventForm.status}
                onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
              >
                <option value="draft">Draf</option>
                <option value="upcoming">Akan datang</option>
                <option value="ongoing">Berlangsung</option>
                <option value="completed">Selesai</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Keterangan / Deskripsi
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              placeholder="Catatan atau keterangan acara..."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Mulai acara
              <input
                className={inputClass}
                type="datetime-local"
                required
                value={eventForm.startsAt}
                onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Selesai acara
              <input
                className={inputClass}
                type="datetime-local"
                required
                value={eventForm.endsAt}
                onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Absensi dibuka
              <input
                className={inputClass}
                type="datetime-local"
                required
                value={eventForm.attendanceOpensAt}
                onChange={(e) => setEventForm({ ...eventForm, attendanceOpensAt: e.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Absensi ditutup
              <input
                className={inputClass}
                type="datetime-local"
                required
                value={eventForm.attendanceClosesAt}
                onChange={(e) => setEventForm({ ...eventForm, attendanceClosesAt: e.target.value })}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setIsEventModalOpen(false)}
            >
              Batal
            </button>
            <button className={primaryButton} disabled={busy}>
              {busy ? 'Menyimpan…' : editingEvent ? 'Simpan Perubahan' : 'Buat Acara'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: MAHALI FORM ─── */}
      <Modal
        isOpen={isMahaliModalOpen}
        onClose={() => setIsMahaliModalOpen(false)}
        title={editingMahali ? 'Ubah Data Mahali' : 'Tambah Mahali Baru'}
        subtitle="Masukkan kode unik dan nama Mahali untuk data master."
      >
        <form onSubmit={saveMahali} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Kode Mahali
            <input
              className={inputClass}
              maxLength={40}
              required
              value={mahaliCode}
              onChange={(e) => setMahaliCode(e.target.value)}
              placeholder="Contoh: MHL-01"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Nama Mahali
            <input
              className={inputClass}
              maxLength={160}
              required
              value={mahaliName}
              onChange={(e) => setMahaliName(e.target.value)}
              placeholder="Contoh: Mahali Jakarta Pusat"
            />
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setIsMahaliModalOpen(false)}
            >
              Batal
            </button>
            <button className={primaryButton} disabled={busy}>
              {busy ? 'Menyimpan…' : editingMahali ? 'Simpan Perubahan' : 'Tambah Mahali'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: CREATE QR FORM ─── */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Hubungkan Mahali ke Acara (Buat QR)"
        subtitle="Pilih acara dan Mahali yang akan dihubungkan untuk membuat QR absensi."
      >
        <form onSubmit={makeQr} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Pilih Acara
            <select
              required
              className={inputClass}
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">Pilih acara</option>
              {events.filter((e) => e.status !== 'archived').map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Pilih Mahali
            <select
              required
              className={inputClass}
              value={selectedMahali}
              onChange={(e) => setSelectedMahali(e.target.value)}
            >
              <option value="">Pilih Mahali</option>
              {mahalis.filter((m) => m.is_active).map((m) => (
                <option key={m.id} value={m.id}>{m.code} · {m.name}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setIsQrModalOpen(false)}
            >
              Batal
            </button>
            <button className={primaryButton} disabled={busy || !selectedEvent || !selectedMahali}>
              {busy ? 'Membuat QR…' : 'Buat QR'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*  LOGIN PAGE                                          */
/* ════════════════════════════════════════════════════ */
function LoginPage({ email, password, busy, onEmail, onPassword, onSubmit }: {
  email: string; password: string; busy: boolean;
  onEmail: (v: string) => void; onPassword: (v: string) => void; onSubmit: (e: FormEvent) => void;
}) {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_1fr]">
      {/* Left panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-blue-950 p-12 text-white lg:flex">
        <div aria-hidden="true" className="absolute inset-0 opacity-[.04]" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px'}} />
        <div aria-hidden="true" className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/10 font-black backdrop-blur-sm">AM</div>
          <span className="font-semibold">Absensi Mahali</span>
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-blue-200">Administrasi acara</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            Kehadiran tercatat rapi, acara lebih mudah dikelola.
          </h1>
          <p className="mt-5 max-w-md leading-7 text-blue-100/75">
            Kelola acara, QR Mahali, dan rekap kehadiran dalam satu tempat.
          </p>
        </div>
        <p className="relative text-xs text-blue-200/70">Sistem Absensi Digital per Mahali</p>
      </section>

      {/* Right panel — form */}
      <section className="grid place-items-center p-5 sm:p-10">
        <form onSubmit={onSubmit} className="animate-fade-in-up w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
          <div className="mb-8 lg:hidden">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-950 font-black text-white shadow-sm">AM</div>
          </div>

          <p className="text-sm font-semibold text-blue-800">Selamat datang</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Masuk ke dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Gunakan akun admin atau panitia untuk melanjutkan.
          </p>

          <label className="mt-7 block text-sm font-semibold text-slate-700" htmlFor="email">
            Email
            <input id="email" className={inputClass} type="email" autoComplete="username" required
              value={email} onChange={(e) => onEmail(e.target.value)} placeholder="nama@organisasi.id" />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="password">
            Kata sandi
            <input id="password" className={inputClass} type="password" autoComplete="current-password" required
              value={password} onChange={(e) => onPassword(e.target.value)} />
          </label>

          <button className={`${primaryButton} mt-6 w-full justify-center`} disabled={busy}>
            {busy ? (
              <>
                <svg className="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Memeriksa…
              </>
            ) : 'Masuk'}
          </button>

          <p className="mt-5 text-center text-xs text-slate-500">
            Akses hanya untuk pengelola yang berwenang.
          </p>
        </form>
      </section>
    </main>
  );
}

/* ════════════════════════════════════════════════════ */
/*  DASHBOARD                                           */
/* ════════════════════════════════════════════════════ */
function Dashboard({ events, mahalis, onSelect }: { events: EventRow[]; mahalis: Mahali[]; onSelect: (id: number) => void }) {
  const active = events.filter((event) => event.status !== 'archived');

  return (
    <>
      <div className="stagger-children grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Jumlah acara" value={events.length} note="Termasuk arsip acara" color="blue" />
        <StatCard title="Mahali aktif" value={mahalis.filter((m) => m.is_active).length} note="Data master tersedia" color="emerald" />
        <StatCard title="Acara berjalan" value={events.filter((e) => e.status === 'ongoing').length} note="Berdasarkan status acara" color="amber" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Acara terbaru</h2>
            <p className="mt-1 text-sm text-slate-500">Buka rekap kehadiran untuk acara yang dipilih.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {active.length} acara aktif
          </span>
        </div>

        {active.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {active.slice(0, 6).map((event) => (
              <article key={event.id} className="group rounded-2xl border border-slate-200 p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{event.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{dateLabel(event.starts_at)}</p>
                    {event.location && <p className="mt-0.5 text-xs text-slate-400">Lokasi: {event.location}</p>}
                  </div>
                  <StatusBadge value={event.status} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{event.mahali_count} Mahali terhubung</span>
                  <button className={secondaryButton} onClick={() => onSelect(event.id)}>
                    <IconChart /> Buka laporan
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <Empty title="Belum ada acara" text="Buat acara terlebih dahulu untuk mulai mengelola absensi." />
          </div>
        )}
      </Panel>
    </>
  );
}

/* ════════════════════════════════════════════════════ */
/*  EVENTS PAGE                                         */
/* ════════════════════════════════════════════════════ */
function EventsPage({ events, isAdmin, onAdd, onEdit, onArchive, onDelete }: {
  events: EventRow[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (r: EventRow) => void;
  onArchive: (r: EventRow) => void;
  onDelete: (r: EventRow) => void;
}) {
  const [page, setPage] = useState(1);
  const paginated = events.slice((page - 1) * 10, page * 10);

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Daftar Acara</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola informasi acara, status, dan riwayat kehadiran.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {events.length} total
          </span>
          {isAdmin && (
            <button className={primaryButton} onClick={onAdd}>
              <IconPlus /> Buat Acara Baru
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {paginated.map((event) => (
          <article key={event.id} className="rounded-2xl border border-slate-200 p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{event.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {event.location ? `Lokasi: ${event.location}` : 'Lokasi belum diisi'} · {event.mahali_count} Mahali terhubung
                </p>
                {event.description && (
                  <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                    Keterangan: {event.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Pelaksanaan: <strong className="text-slate-700">{dateLabel(event.starts_at)}</strong> – <strong className="text-slate-700">{dateLabel(event.ends_at)}</strong></span>
                  <span>Absensi: <strong className="text-slate-700">{dateLabel(event.attendance_opens_at)}</strong> – <strong className="text-slate-700">{dateLabel(event.attendance_closes_at)}</strong></span>
                </div>
              </div>
              <StatusBadge value={event.status} />
            </div>
            {isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button className={secondaryButton} onClick={() => onEdit(event)}>
                  <IconEdit /> Ubah Acara
                </button>
                {event.status !== 'archived' && (
                  <button className={secondaryButton} onClick={() => onArchive(event)}>
                    Arsipkan
                  </button>
                )}
                <button className={dangerButton} onClick={() => onDelete(event)}>
                  <IconTrash /> Hapus
                </button>
              </div>
            )}
          </article>
        ))}
        {!events.length && (
          <Empty title="Belum ada acara" text="Klik tombol 'Buat Acara Baru' di atas untuk membuat acara pertama." />
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={events.length}
        pageSize={10}
        onPageChange={setPage}
      />
    </Panel>
  );
}

/* ════════════════════════════════════════════════════ */
/*  MAHALIS PAGE                                        */
/* ════════════════════════════════════════════════════ */
function MahalisPage({ items, isAdmin, onAdd, onEdit, onToggle, onDelete }: {
  items: Mahali[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (m: Mahali) => void;
  onToggle: (m: Mahali) => void;
  onDelete: (m: Mahali) => void;
}) {
  const [page, setPage] = useState(1);
  const paginated = items.slice((page - 1) * 10, page * 10);

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Master Data Mahali</h2>
          <p className="mt-1 text-sm text-slate-500">Data master wilayah/kelompok Mahali. Gunakan nonaktifkan untuk arsip, atau hapus untuk menghapus permanen.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {items.length} data
          </span>
          {isAdmin && (
            <button className={primaryButton} onClick={onAdd}>
              <IconPlus /> Tambah Mahali Baru
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 divide-y divide-slate-100">
        {paginated.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
            <div className="flex items-center gap-3.5">
              <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-xs font-bold text-blue-950 shadow-sm">
                {item.code.slice(0, 3).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">Kode: {item.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={item.is_active ? 'active' : 'inactive'} />
              {isAdmin && (
                <>
                  <button className={secondaryButton} onClick={() => onEdit(item)}>
                    <IconEdit /> Ubah
                  </button>
                  <button className={item.is_active ? secondaryButton : secondaryButton} onClick={() => void onToggle(item)}>
                    {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button className={dangerButton} onClick={() => void onDelete(item)}>
                    <IconTrash /> Hapus
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!items.length && (
          <Empty title="Belum ada Mahali" text="Klik 'Tambah Mahali Baru' untuk menambahkan master data Mahali pertama." />
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={items.length}
        pageSize={10}
        onPageChange={setPage}
      />
    </Panel>
  );
}

/* ════════════════════════════════════════════════════ */
/*  QR PAGE                                             */
/* ════════════════════════════════════════════════════ */
function QrPage({ events, links, selectedEvent, data, label, isAdmin, onEvent, onOpenCreate, onPreview, onChange, onDelete }: {
  events: EventRow[];
  links: QrLink[];
  selectedEvent: string;
  data: string;
  label: string;
  isAdmin: boolean;
  onEvent: (v: string) => void;
  onOpenCreate: () => void;
  onPreview: (link: QrLink) => void;
  onChange: (link: QrLink, patch: { active?: boolean; rotate?: boolean }) => void;
  onDelete: (link: QrLink) => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [selectedEvent]);
  const paginated = links.slice((page - 1) * 10, page * 10);

  return (
    <div className="space-y-6">
      {/* Top filter & action bar */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold tracking-tight">QR Code Absensi per Mahali</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Setiap Mahali memiliki QR Code unik per acara. Anda dapat melihat pratinjau QR kapan saja, merotasi, atau menghapusnya.
            </p>
          </div>
          {isAdmin && (
            <button className={primaryButton} onClick={onOpenCreate}>
              <IconPlus /> Hubungkan Mahali (Buat QR)
            </button>
          )}
        </div>

        <div className="mt-5 max-w-sm">
          <label className="block text-sm font-semibold text-slate-700">
            Pilih Acara
            <select
              className={inputClass}
              value={selectedEvent}
              onChange={(e) => onEvent(e.target.value)}
            >
              <option value="">Pilih acara</option>
              {events.filter((e) => e.status !== 'archived').map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Linked QR list */}
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Daftar QR Mahali</h2>
              <p className="mt-1 text-sm text-slate-500">
                {events.find((e) => String(e.id) === selectedEvent)?.name ?? 'Pilih acara terlebih dahulu'}
              </p>
            </div>
            {selectedEvent && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {links.length} QR terhubung
              </span>
            )}
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {paginated.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
                <div>
                  <p className="font-semibold text-slate-900">{link.name}</p>
                  <p className="text-sm text-slate-500">Kode: {link.code}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={link.is_active ? 'active' : 'inactive'} />
                  <button className={secondaryButton} onClick={() => onPreview(link)} title="Lihat dan unduh gambar QR ini">
                    <IconEye /> Pratinjau QR
                  </button>
                  {isAdmin && (
                    <>
                      <button className={secondaryButton} onClick={() => onChange(link, { rotate: true })} title="Ganti token QR lama dengan token baru">
                        <IconRefresh /> Rotasi
                      </button>
                      <button className={secondaryButton} onClick={() => onChange(link, { active: !Boolean(link.is_active) })}>
                        {link.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button className={dangerButton} onClick={() => onDelete(link)} title="Hapus QR Code ini">
                        <IconTrash /> Hapus
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {selectedEvent && !links.length && (
              <Empty title="Belum ada QR terhubung" text="Klik tombol 'Hubungkan Mahali (Buat QR)' untuk menautkan Mahali ke acara ini." />
            )}
            {!selectedEvent && (
              <Empty title="Pilih acara" text="Pilih salah satu acara di atas untuk melihat daftar QR Mahali." />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={links.length}
            pageSize={10}
            onPageChange={setPage}
          />
        </Panel>

        {/* QR Preview panel */}
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Pratinjau QR Code</h2>
            {data && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Aktif
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {label ? label : 'Klik tombol "Pratinjau QR" pada daftar di samping untuk menampilkan QR.'}
          </p>

          {data.startsWith('data:image') ? (
            <div className="animate-scale-in">
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-2 text-center shadow-sm">
                <img className="mx-auto w-full max-w-64 rounded-xl shadow-xs" src={data} alt={`Kartu QR absensi ${label}`} />
              </div>
              <a className={`${primaryButton} mt-4 w-full justify-center`} href={data} download={`qr-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`}>
                <IconDownload /> Unduh Kartu QR (PNG)
              </a>
            </div>
          ) : (
            <div className="mt-5 grid aspect-square place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
                  <IconQr />
                </span>
                <p className="mt-3">Pilih dan klik tombol <strong>"Pratinjau QR"</strong> pada salah satu Mahali untuk melihat gambarnya di sini.</p>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-blue-50 p-3.5 text-xs leading-5 text-blue-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 size-4 shrink-0 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
            QR yang sudah dibuat dapat dilihat kapan saja melalui tombol "Pratinjau QR".
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*  REPORTS PAGE                                        */
/* ════════════════════════════════════════════════════ */
function ReportsPage({ events, mahalis, reportEvent, reportMahali, dateFrom, dateTo, status, summary, history, activeEvent, canCorrect, onVoid, onEvent, onMahali, onDateFrom, onDateTo, onStatus, onFilter, onLoad }: {
  events: EventRow[]; mahalis: Mahali[]; reportEvent: string; reportMahali: string; dateFrom: string; dateTo: string;
  status: string; summary?: Summary; history: Attendance[]; activeEvent?: EventRow; canCorrect: boolean;
  onVoid: (row: Attendance) => void; onEvent: (v: string) => void; onMahali: (v: string) => void;
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void; onStatus: (v: string) => void;
  onFilter: (e: FormEvent) => void; onLoad: () => void;
}) {
  const [summaryPage, setSummaryPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    setHistoryPage(1);
  }, [reportEvent, reportMahali, dateFrom, dateTo, status]);

  const paginatedSummary = summary ? summary.mahalis.slice((summaryPage - 1) * 10, summaryPage * 10) : [];
  const paginatedHistory = history.slice((historyPage - 1) * 10, historyPage * 10);

  const query = new URLSearchParams();
  if (reportMahali) query.set('mahaliId', reportMahali);
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  const exportHref = (format: 'xlsx' | 'pdf' | 'csv') =>
    `${api}/admin/reports/events/${reportEvent}/export?format=${format}${query.size ? `&${query}` : ''}`;

  return (
    <div className="space-y-6">
      {/* Filter panel */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Filter Laporan Kehadiran</h2>
            <p className="mt-1 text-sm text-slate-500">Ringkasan dan ekspor hanya menghitung check-in yang berstatus valid.</p>
          </div>
          {summary && (
            <span className="rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-800">
              {summary.total} check-in valid
            </span>
          )}
        </div>
        <form onSubmit={onFilter} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <label className="block text-sm font-semibold text-slate-700">
            Acara
            <select className={inputClass} required value={reportEvent} onChange={(e) => onEvent(e.target.value)}>
              <option value="">Pilih acara</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mahali
            <select className={inputClass} value={reportMahali} onChange={(e) => onMahali(e.target.value)}>
              <option value="">Semua Mahali</option>
              {mahalis.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Dari tanggal
            <input className={inputClass} type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Sampai tanggal
            <input className={inputClass} type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} />
          </label>
          <button className={`${primaryButton} justify-center`} type="submit">Terapkan filter</button>
        </form>
      </Panel>

      {summary ? (
        <>
          {/* Stats cards */}
          <div className="stagger-children grid gap-4 sm:grid-cols-3">
            <StatCard title="Total check-in valid" value={summary.total} note={activeEvent?.name ?? 'Acara terpilih'} color="emerald" />
            <StatCard title="Mahali dalam laporan" value={summary.mahalis.filter((item) => item.total > 0).length} note={`Dari ${summary.mahalis.length} Mahali`} color="blue" />
            <StatCard title="Catatan ditampilkan" value={history.length} note="Riwayat terbaru sesuai filter" color="slate" />
          </div>

          {/* Chart + table */}
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Kehadiran per Mahali</h2>
                <p className="mt-1 text-sm text-slate-500">Grafik batang persentase dengan tabel data pendamping.</p>
              </div>
              <div className="flex gap-2">
                <a className={secondaryButton} href={exportHref('xlsx')}><IconDownload /> Excel</a>
                <a className={secondaryButton} href={exportHref('pdf')}><IconDownload /> PDF</a>
                <a className={secondaryButton} href={exportHref('csv')}><IconDownload /> CSV</a>
              </div>
            </div>

            {/* Bar chart */}
            <div className="mt-6 space-y-4">
              {summary.mahalis.map((item) => {
                const pct = summary.total ? Math.max(item.total ? 1 : 0, item.total / summary.total * 100) : 0;
                return (
                  <div key={item.mahaliId}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-900">{item.mahaliName}</span>
                      <span className="tabular-nums font-semibold text-slate-700">{item.total} orang</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="animate-progress-bar h-2.5 rounded-full bg-blue-800 transition-all" style={{ '--bar-width': `${pct}%`, width: `${pct}%` } as React.CSSProperties} />
                    </div>
                  </div>
                );
              })}
              {!summary.mahalis.length && <Empty title="Belum ada rekap" text="Belum ada Mahali yang terhubung ke acara ini." />}
            </div>

            {/* Data table */}
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mahali</th>
                    <th className="px-4 py-3 text-right font-semibold">Check-in valid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSummary.map((item) => (
                    <tr key={item.mahaliId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium">{item.mahaliName}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={summaryPage}
              totalItems={summary.mahalis.length}
              pageSize={10}
              onPageChange={setSummaryPage}
            />
          </Panel>

          {/* History table */}
          <Panel>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Riwayat Check-in</h2>
                <p className="mt-1 text-sm text-slate-500">Tanpa identitas peserta atau token perangkat (sesuai SOT Privasi).</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Status riwayat
                  <select className={`${inputClass} min-w-44`} value={status} onChange={(e) => onStatus(e.target.value)}>
                    <option value="">Semua status</option>
                    <option value="valid">Valid</option>
                    <option value="voided">Dikoreksi</option>
                  </select>
                </label>
                <button className={secondaryButton} onClick={onLoad}><IconRefresh /> Muat riwayat</button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
                    <th className="px-4 py-3 font-semibold">Mahali</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Catatan koreksi</th>
                    {canCorrect && <th className="px-4 py-3 font-semibold">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">{dateLabel(row.checked_in_at)}</td>
                      <td className="px-4 py-3">{row.mahaliName}</td>
                      <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{row.void_reason || '—'}</td>
                      {canCorrect && (
                        <td className="px-4 py-3">
                          {row.status === 'valid' && (
                            <button className={dangerButton} onClick={() => onVoid(row)}>Koreksi</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!history.length && (
                <div className="px-4 py-6">
                  <Empty title="Belum ada riwayat" text="Ubah filter atau periksa kembali data acara." />
                </div>
              )}
            </div>

            <Pagination
              currentPage={historyPage}
              totalItems={history.length}
              pageSize={10}
              onPageChange={setHistoryPage}
            />
          </Panel>
        </>
      ) : (
        <Panel>
          <Empty title="Pilih acara untuk melihat laporan" text="Ringkasan, riwayat, dan tombol ekspor akan muncul setelah data dimuat." />
        </Panel>
      )}
    </div>
  );
}

function UsersPage({ users, isSuperAdmin, userForm, editingUser, profileForm, busy, onUserForm, onCreate, onEdit, onProfileForm, onUpdate, onCancelEdit }: {
  users: User[];
  isSuperAdmin: boolean;
  userForm: { name: string; email: string; password: string; role: 'admin' | 'committee' };
  editingUser: number | null;
  profileForm: { name: string; email: string; password: string };
  busy: boolean;
  onUserForm: (value: { name: string; email: string; password: string; role: 'admin' | 'committee' }) => void;
  onCreate: (event: FormEvent) => void;
  onEdit: (account: User) => void;
  onProfileForm: (value: { name: string; email: string; password: string }) => void;
  onUpdate: (event: FormEvent) => void;
  onCancelEdit: () => void;
}) {
  const [page, setPage] = useState(1);
  const paginated = users.slice((page - 1) * 10, page * 10);
  const editingAccount = users.find((account) => account.id === editingUser);

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.8fr)]">
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Akun pengguna</h2>
          <p className="mt-1 text-sm text-slate-500">Perubahan nama, email, atau reset kata sandi dicatat dalam audit log.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{users.length} akun</span>
      </div>
      <div className="mt-5 space-y-3">
        {paginated.map((account) => (
          <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 font-bold text-blue-950">
                {account.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{account.name}</p>
                <p className="truncate text-sm text-slate-500">{account.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={account.role} />
              <button className={secondaryButton} onClick={() => onEdit(account)}>
                <IconEdit /> Ubah profil
              </button>
            </div>
          </article>
        ))}
        {!users.length && <Empty title="Belum ada akun yang dikelola" text="Buat akun dari formulir ini." />}
      </div>
      <Pagination
        currentPage={page}
        totalItems={users.length}
        pageSize={10}
        onPageChange={setPage}
      />
    </Panel>
    <div className="space-y-6">
      <Panel><h2 className="text-lg font-bold">{editingAccount ? `Ubah profil ${editingAccount.role}` : 'Tambah akun'}</h2><p className="mt-1 text-sm text-slate-500">Kata sandi minimal 8 karakter dan disimpan dalam bentuk hash.</p>{editingAccount ? <form className="mt-5 space-y-4" onSubmit={onUpdate}><label className="block text-sm font-semibold text-slate-700">Nama<input className={inputClass} required maxLength={160} value={profileForm.name} onChange={(e) => onProfileForm({ ...profileForm, name: e.target.value })} /></label><label className="block text-sm font-semibold text-slate-700">Email<input className={inputClass} required type="email" maxLength={254} value={profileForm.email} onChange={(e) => onProfileForm({ ...profileForm, email: e.target.value })} /></label><label className="block text-sm font-semibold text-slate-700">Kata sandi baru <span className="font-normal text-slate-400">(opsional)</span><input className={inputClass} type="password" minLength={8} maxLength={200} autoComplete="new-password" value={profileForm.password} onChange={(e) => onProfileForm({ ...profileForm, password: e.target.value })} placeholder="Kosongkan jika tidak diubah" /></label><div className="flex gap-2"><button className={`${primaryButton} flex-1`} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button><button type="button" className={secondaryButton} onClick={onCancelEdit}>Batal</button></div></form> : <form className="mt-5 space-y-4" onSubmit={onCreate}><label className="block text-sm font-semibold text-slate-700">Nama<input className={inputClass} required maxLength={160} value={userForm.name} onChange={(e) => onUserForm({ ...userForm, name: e.target.value })} /></label><label className="block text-sm font-semibold text-slate-700">Email<input className={inputClass} required type="email" maxLength={254} value={userForm.email} onChange={(e) => onUserForm({ ...userForm, email: e.target.value })} /></label><label className="block text-sm font-semibold text-slate-700">Kata sandi awal<input className={inputClass} required type="password" minLength={8} maxLength={200} autoComplete="new-password" value={userForm.password} onChange={(e) => onUserForm({ ...userForm, password: e.target.value })} /></label>{isSuperAdmin && <label className="block text-sm font-semibold text-slate-700">Role<select className={inputClass} value={userForm.role} onChange={(e) => onUserForm({ ...userForm, role: e.target.value as 'admin' | 'committee' })}><option value="admin">Admin</option><option value="committee">Panitia</option></select></label>}<div className="rounded-xl bg-blue-50 px-3.5 py-3 text-xs leading-5 text-blue-950">{isSuperAdmin ? 'Superadmin dapat membuat akun admin dan panitia.' : 'Admin dapat membuat akun panitia dan mengubah profil admin/panitia.'}</div><button className={`${primaryButton} w-full`} disabled={busy}>{busy ? 'Membuat akun…' : `Tambah ${isSuperAdmin ? (userForm.role === 'admin' ? 'admin' : 'panitia') : 'panitia'}`}</button></form>}</Panel>
      <Panel><h3 className="font-semibold">Aturan akses</h3><ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600"><li>Superadmin membuat akun admin dan panitia.</li><li>Admin membuat panitia, serta memperbarui profil admin dan panitia.</li><li>Role akun tidak dapat diubah dari formulir profil.</li></ul></Panel>
    </div>
  </div>;
}

/* ════════════════════════════════════════════════════ */
/*  SHARED COMPONENTS                                   */
/* ════════════════════════════════════════════════════ */

function Panel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[.025] transition-shadow hover:shadow-md sm:p-6">
      {children}
    </section>
  );
}

function StatCard({ title, value, note, color = 'blue' }: { title: string; value: number; note: string; color?: 'blue' | 'emerald' | 'amber' | 'slate' }) {
  const accents: Record<string, string> = {
    blue: 'from-blue-600 to-blue-800',
    emerald: 'from-emerald-600 to-emerald-800',
    amber: 'from-amber-500 to-amber-700',
    slate: 'from-slate-500 to-slate-700',
  };
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[.025]">
      <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${accents[color]}`} />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    inactive: 'bg-slate-100 text-slate-600 ring-slate-500/10',
    upcoming: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    ongoing: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    completed: 'bg-slate-100 text-slate-700 ring-slate-500/10',
    archived: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    draft: 'bg-violet-50 text-violet-800 ring-violet-600/20',
    valid: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    voided: 'bg-rose-50 text-rose-800 ring-rose-600/20',
    superadmin: 'bg-violet-50 text-violet-800 ring-violet-600/20',
    admin: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    committee: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  };
  const labels: Record<string, string> = {
    active: 'Aktif', inactive: 'Nonaktif', upcoming: 'Akan datang', ongoing: 'Berlangsung',
    completed: 'Selesai', archived: 'Diarsipkan', draft: 'Draf', valid: 'Valid', voided: 'Dikoreksi',
    superadmin: 'Superadmin', admin: 'Admin', committee: 'Panitia',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[value] ?? 'bg-slate-100 text-slate-700 ring-slate-500/10'}`}>
      <span className={`inline-block size-1.5 rounded-full ${
        ['active', 'ongoing', 'valid'].includes(value) ? 'bg-emerald-500' :
        value === 'voided' ? 'bg-rose-500' :
        value === 'upcoming' ? 'bg-blue-500' :
        value === 'draft' ? 'bg-violet-500' :
        value === 'archived' ? 'bg-amber-500' :
        'bg-slate-400'
      }`} />
      {labels[value] ?? value}
    </span>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto size-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pages: number[] = [];
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
      <p className="text-xs sm:text-sm">
        Menampilkan <span className="font-semibold text-slate-900">{start}</span>–<span className="font-semibold text-slate-900">{end}</span> dari <span className="font-semibold text-slate-900">{totalItems}</span> data
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Halaman sebelumnya"
          >
            <IconChevronLeft />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          {startPage > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                1
              </button>
              {startPage > 2 && <span className="px-1 text-slate-400">…</span>}
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`grid size-8 place-items-center rounded-xl text-xs font-semibold transition ${
                p === currentPage
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-1 text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                className="grid size-8 place-items-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Halaman berikutnya"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <IconChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
