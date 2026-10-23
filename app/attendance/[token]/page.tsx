'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { notifyError, notifySuccess } from '@/lib/swal';

type Info = { eventName: string; mahaliName: string; attendanceOpen: boolean };
type Result = { message: string; checkedInAt?: string; kind: 'loading' | 'ready' | 'success' | 'error' | 'closed' | 'duplicate' };
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

function deviceId() {
  let id = localStorage.getItem('absensi_device_token');
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    id = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    localStorage.setItem('absensi_device_token', id);
  }
  return id;
}

/* ─── Icons ─── */
function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  );
}
function IconDuplicate() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg className="size-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ─── Status Config ─── */
const statusConfig: Record<string, { bg: string; icon: React.ReactNode }> = {
  loading: { bg: 'border-slate-200 bg-slate-50 text-slate-700', icon: <SpinnerIcon /> },
  ready: { bg: 'border-blue-200 bg-blue-50 text-blue-950', icon: <IconInfo /> },
  success: { bg: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: <IconCheck /> },
  error: { bg: 'border-rose-200 bg-rose-50 text-rose-900', icon: <IconAlert /> },
  closed: { bg: 'border-amber-200 bg-amber-50 text-amber-900', icon: <IconClock /> },
  duplicate: { bg: 'border-rose-200 bg-rose-50 text-rose-900', icon: <IconDuplicate /> },
};

export default function AttendancePage() {
  const routeParams = useParams();
  const token = typeof routeParams?.token === 'string' ? routeParams.token : '';
  const [info, setInfo] = useState<Info>();
  const [result, setResult] = useState<Result>({ kind: 'loading', message: 'Memvalidasi QR…' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${api}/public/attendance/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!active) return;
        setInfo(body);
        setResult(body.attendanceOpen
          ? { kind: 'ready', message: 'Absensi sedang dibuka — silakan tekan tombol HADIR.' }
          : { kind: 'closed', message: 'Absensi belum dibuka atau sudah ditutup.' }
        );
      })
      .catch((error: unknown) => {
        if (active) setResult({
          kind: 'error',
          message: error instanceof TypeError
            ? 'Koneksi gagal. Periksa jaringan lalu muat ulang halaman.'
            : 'QR tidak valid atau tidak aktif. Silakan minta bantuan panitia.'
        });
      });
    return () => { active = false; };
  }, [token]);

  async function attend() {
    if (!info || busy || !token) return;
    setBusy(true);
    setResult({ kind: 'loading', message: 'Mengirim absensi…' });
    try {
      const response = await fetch(`${api}/public/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token, deviceToken: deviceId() }),
      });
      const body = await response.json();
      if (response.status === 201) {
        setResult({
          kind: 'success',
          message: 'Absensi berhasil dicatat',
          checkedInAt: new Date(`${body.checkedInAt}Z`).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        });
        notifySuccess('Absensi Berhasil!', 'Kehadiran Anda telah dicatat oleh server.');
      } else if (response.status === 409) {
        setResult({ kind: 'duplicate', message: 'Perangkat ini sudah melakukan absensi pada acara ini.' });
        notifyError('Sudah Melakukan Absensi', 'Perangkat ini sudah tercatat hadir pada acara ini.');
      } else if (response.status === 410) {
        setResult({ kind: 'closed', message: 'Absensi belum dibuka atau sudah ditutup.' });
        notifyError('Absensi Ditutup', 'Absensi belum dibuka atau sudah ditutup.');
      } else if (response.status === 429) {
        setResult({ kind: 'error', message: 'Terlalu banyak permintaan. Coba kembali sebentar lagi.' });
        notifyError('Terlalu Banyak Permintaan', 'Tunggu beberapa saat sebelum mencoba kembali.');
      } else {
        setResult({ kind: 'error', message: 'Absensi belum tercatat. Periksa koneksi lalu coba lagi.' });
        notifyError('Absensi Gagal', 'Absensi belum tercatat. Periksa koneksi lalu coba lagi.');
      }
    } catch {
      setResult({ kind: 'error', message: 'Koneksi gagal. Absensi belum tercatat; periksa koneksi lalu coba lagi.' });
      notifyError('Koneksi Gagal', 'Periksa jaringan internet Anda lalu muat ulang halaman.');
    } finally {
      setBusy(false);
    }
  }

  const config = statusConfig[result.kind] ?? statusConfig.loading;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-50 px-4 py-8 text-slate-900">
      {/* Background */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-950 to-blue-900" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 opacity-[.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />

      <section className="animate-fade-in-up relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/15">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800" />

        <div className="p-6 sm:p-8">
          {/* Logo/header */}
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-950 text-xs font-black text-white shadow-sm">AM</div>
            <div>
              <p className="text-sm font-bold tracking-tight">ABSENSI MAHALI</p>
              <p className="text-xs text-slate-500">Konfirmasi kehadiran</p>
            </div>
          </div>

          {/* Event info */}
          {info ? (
            <div className="animate-fade-in mt-8">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-800">Nama acara</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">{info.eventName}</h1>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mahali</p>
                <p className="mt-1.5 text-lg font-semibold">{info.mahaliName}</p>
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <div className="h-4 w-28 animate-shimmer rounded" />
              <div className="h-8 w-4/5 animate-shimmer rounded" />
              <div className="h-20 animate-shimmer rounded-2xl" />
            </div>
          )}

          {/* Status message */}
          <div
            role="status"
            aria-live="polite"
            className={`animate-fade-in mt-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6 ${config.bg}`}
          >
            <span className="mt-0.5 shrink-0">{config.icon}</span>
            <div>
              <span className="font-semibold">{result.message}</span>
              {result.checkedInAt && (
                <span className="mt-1 block text-sm opacity-80">
                  Waktu server: {result.checkedInAt} WIB
                </span>
              )}
            </div>
          </div>

          {/* HADIR button */}
          {info?.attendanceOpen && ['ready', 'error'].includes(result.kind) && (
            <button
              disabled={busy}
              onClick={() => void attend()}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-950 px-5 text-base font-bold tracking-wide text-white shadow-md transition-all hover:bg-blue-900 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[.98] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? (
                <>
                  <SpinnerIcon />
                  Mengirim…
                </>
              ) : (
                'HADIR'
              )}
            </button>
          )}

          {/* Success confirmation */}
          {result.kind === 'success' && (
            <div className="animate-fade-in mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-900">
              <span className="animate-checkmark grid size-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-white shadow-sm">
                <IconCheck />
              </span>
              <span>Check-in tercatat oleh server.</span>
            </div>
          )}

          {/* Info footer */}
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
            Sistem menggunakan token anonim pada browser untuk membatasi check-in ganda.</p>
        </div>
      </section>

      <p className="relative mt-6 text-xs text-blue-200/70">Absensi Digital per Mahali</p>
    </main>
  );
}
