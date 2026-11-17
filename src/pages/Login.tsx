import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button, InfoBanner, Spinner } from "../components/ui";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/kabid"} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const logged = await login(username.trim(), password);
      const state = location.state as { from?: string } | null;
      const fallback = logged.role === "admin" ? "/admin" : "/kabid";
      const from = state?.from;
      const target = from && from.startsWith(logged.role === "admin" ? "/admin" : "/kabid") ? from : fallback;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[1.06fr_1fr]">
      {/* Panel identitas */}
      <section className="relative hidden overflow-hidden bg-brand-950 p-10 text-white brand-pattern lg:flex lg:flex-col xl:p-14">
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-16 top-1/4 h-64 w-64 rounded-full border border-white/[0.06]" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white p-1 shadow-sm">
            <img
              src="/logo-rsj.jpg"
              alt="Logo RSJ Sambang Lihum"
              className="h-full w-full rounded-lg object-contain"
            />
          </span>
          <span className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-lg font-extrabold tracking-[0.08em]">SIMPATIK</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-200/60">
              RSJ Sambang Lihum
            </p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-[540px] py-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-200">
            <Sparkle /> Monitoring ASN · 2026
          </p>
          <h1 className="text-balance text-[40px] font-extrabold leading-[1.12] tracking-tight xl:text-[46px]">
            Kepatuhan pakaian dinas, terpantau rapi setiap bulan.
          </h1>
          <p className="mt-5 max-w-[440px] text-sm leading-relaxed text-brand-100/65">
            Satu tempat untuk menilai kepatuhan pakaian dinas dan atribut ASN, memantau
            progres seluruh unit, dan menerbitkan laporan resmi secara otomatis.
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              { icon: CheckCircle2, text: "Penilaian cepat dengan daftar pegawai berfoto" },
              { icon: ShieldCheck, text: "Rekap kepatuhan dihitung otomatis dan konsisten" },
              { icon: Smartphone, text: "Dapat dipasang di layar utama telepon genggam" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-[13px] text-brand-100/80">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                  <Icon className="h-3.5 w-3.5 text-gold-300" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs font-semibold text-brand-50/85">
              Rumah Sakit Jiwa Sambang Lihum
            </p>
            <p className="mt-0.5 text-[10px] text-brand-200/45">
              Pemerintah Provinsi Kalimantan Selatan
            </p>
          </div>
          <span className="text-[10px] font-medium text-brand-200/35">SIMPATIK v1.0.0</span>
        </div>
      </section>

      {/* Form masuk */}
      <section className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-8 paper-grain sm:px-8 lg:min-h-0 lg:py-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-1 shadow-sm">
                <img
                  src="/logo-rsj.jpg"
                  alt="Logo RSJ Sambang Lihum"
                  className="h-full w-full rounded-lg object-contain"
                />
              </span>
              <div>
                <p className="text-[15px] font-extrabold tracking-[0.06em] text-brand-900">SIMPATIK</p>
                <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-brand-600/70">
                  Monitoring Pakaian Dinas ASN
                </p>
              </div>
            </div>
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-ink/45">
              RSJSL
            </span>
          </div>

          <div className="rounded-3xl border border-line bg-white p-6 shadow-lift sm:p-8">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">
                Selamat datang
              </p>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink">
                Masuk ke SIMPATIK
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/50">
                Gunakan akun yang diberikan Admin. Kabid menggunakan NIP sebagai username.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="username" className="field-label">
                  Username / NIP
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Masukkan NIP atau username"
                    autoComplete="username"
                    autoFocus
                    className="input-base h-11 pl-10"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="field-label mb-0">
                    Password
                  </label>
                  <span className="text-[10px] text-ink/35">Lupa? Hubungi Admin</span>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    className="input-base h-11 pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink/35 transition hover:bg-ink/5 hover:text-ink/60"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                {submitting ? "Memeriksa akun…" : "Masuk ke SIMPATIK"}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
          </div>

          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 lg:hidden">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
                <Smartphone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-brand-900">Pasang SIMPATIK di layar utama</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-brand-800/55">
                  Buka menu Chrome <span className="font-semibold">⋮</span> lalu pilih{" "}
                  <span className="font-semibold">Tambahkan ke layar utama</span> agar tampil
                  seperti aplikasi.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-ink/30">
            <Wifi className="h-3 w-3" />
            SIMPATIK memerlukan koneksi internet · v1.0.0
          </div>
        </div>
      </section>
    </div>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M8 0l1.6 4.8L14.4 6 9.6 7.6 8 12.4 6.4 7.6 1.6 6l4.8-1.2L8 0Z" />
    </svg>
  );
}
