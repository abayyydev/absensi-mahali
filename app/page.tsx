export default function Home() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4 py-10 text-slate-900">
      {/* Background decorative elements */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-950/[.04] blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-blue-950/[.03] blur-3xl" />
      </div>

      <section className="animate-fade-in-up relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/[.06]">
        {/* Hero section */}
        <div className="relative overflow-hidden bg-blue-950 px-6 py-14 text-white sm:px-10 sm:py-20">
          {/* Background pattern */}
          <div aria-hidden="true" className="absolute inset-0 opacity-[.04]" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px'}} />
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-400/10 blur-2xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <div className="grid size-8 place-items-center rounded-lg bg-white/15 text-xs font-black">AM</div>
              <span className="text-sm font-semibold tracking-tight">Absensi Mahali</span>
            </div>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[.2em] text-blue-200">
              Sistem Absensi Digital
            </p>
            <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
              Kelola kehadiran acara per Mahali.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/80">
              Siapkan acara, kelola QR, dan pantau rekap kehadiran dengan alur yang sederhana dan terorganisir.
            </p>
          </div>
        </div>

        {/* Action section */}
        <div className="flex flex-col justify-between gap-5 px-6 py-7 sm:flex-row sm:items-center sm:px-10 sm:py-8">
          <div>
            <p className="text-lg font-bold tracking-tight">Ruang pengelola</p>
            <p className="mt-1 text-sm text-slate-500">
              Masuk untuk melihat acara dan laporan kehadiran.
            </p>
          </div>
          <a
            href="/admin"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-950 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-900 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Buka dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L11.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08l3.158-2.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <p className="relative mt-8 text-xs text-slate-400">
        Sistem Absensi Digital per Mahali
      </p>
    </main>
  );
}
