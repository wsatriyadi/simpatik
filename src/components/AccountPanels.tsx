import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, LogOut, MonitorSmartphone, Smartphone, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { usePwaInstall } from "../lib/hooks";
import type { User } from "../lib/types";
import { Avatar, Badge, Button, Field, Input, SectionCard } from "./ui";
import { LogoMark } from "./Logo";

export function ProfileCard({
  user,
  extra,
  action,
}: {
  user: User;
  extra?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <SectionCard title="Profil akun" subtitle="Identitas ini digunakan pada tampilan dan dokumen.">
      <div className="flex items-start gap-4">
        <Avatar name={user.nama} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold leading-tight text-ink">{user.nama}</h3>
            <Badge tone={user.role === "admin" ? "dark" : "brand"}>
              {user.role === "admin" ? "Admin" : "Kabid"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink/50">{user.jabatan || "—"}</p>
          <div className="mt-4 grid gap-3 border-t border-line pt-4 text-xs sm:grid-cols-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30">Username</p>
              <p className="mt-1 font-mono text-[11px] font-medium text-ink/70">{user.username}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30">NIP</p>
              <p className="mt-1 font-mono text-[11px] font-medium text-ink/70">{user.nip || "—"}</p>
            </div>
          </div>
          {extra ? <div className="mt-4">{extra}</div> : null}
        </div>
      </div>
      {action ? <div className="mt-4 border-t border-line pt-4">{action}</div> : null}
    </SectionCard>
  );
}

export function ChangePasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 8) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }
    if (next !== confirm) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    setSaving(true);
    try {
      await api("/auth/password", { method: "POST", body: { current, next } });
      toast.success("Password berhasil diganti", "Gunakan password baru pada masuk berikutnya.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error("Password gagal diganti", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="Ganti password"
      subtitle="Gunakan minimal 8 karakter. Sesi di perangkat lain akan diakhiri."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Password saat ini" required>
          <Input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            placeholder="Masukkan password saat ini"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password baru" required>
            <Input
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
            />
          </Field>
          <Field label="Ulangi password baru" required>
            <Input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Ketik ulang"
            />
          </Field>
        </div>
        <Button
          type="submit"
          loading={saving}
          disabled={!current || !next || !confirm}
          icon={<KeyRound className="h-4 w-4" />}
        >
          Simpan Password Baru
        </Button>
      </form>
    </SectionCard>
  );
}

export function LogoutCard({ description }: { description?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <SectionCard title="Keluar dari akun" subtitle={description || "Akhiri sesi pada perangkat ini."}>
      <Button
        variant="outline"
        className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
        icon={<LogOut className="h-4 w-4" />}
        onClick={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      >
        Keluar Sekarang
      </Button>
    </SectionCard>
  );
}

export function InstallAppCard() {
  const { canInstall, installed, install } = usePwaInstall();
  const toast = useToast();
  return (
    <SectionCard
      title="Pasang aplikasi"
      subtitle="Tampilkan SIMPATIK seperti aplikasi di layar utama telepon genggam."
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {installed ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Aplikasi sudah terpasang
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/45">
                SIMPATIK terbuka dalam mode aplikasi. Pembaruan dilakukan otomatis dari server.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-ink">Pasang di layar utama</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/45">
                Pada Chrome Android, buka menu ⋮ lalu pilih “Tambahkan ke layar utama”. Di iPhone,
                gunakan tombol Bagikan lalu “Tambah ke Layar Utama”.
              </p>
              {canInstall ? (
                <Button size="sm" className="mt-3" onClick={async () => {
                  const result = await install();
                  if (result) toast.success("SIMPATIK dipasang", "Ikon aplikasi ditambahkan ke layar utama.");
                }}>
                  <Smartphone className="h-3.5 w-3.5" />
                  Pasang Aplikasi
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export function AppInfoCard() {
  return (
    <SectionCard title="Tentang SIMPATIK">
      <div className="flex items-start gap-3">
        <LogoMark className="h-11 w-11" />
        <div>
          <p className="text-sm font-extrabold tracking-[0.04em] text-brand-900">SIMPATIK</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-ink/45">
            Sistem Monitoring Kepatuhan Pakaian Dinas & Atribut ASN
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">Versi 1.0.0</Badge>
            <Badge tone="slate">Fase 1</Badge>
            <Badge tone="green">PWA</Badge>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink/35">
            RSJ Sambang Lihum · Pemerintah Provinsi Kalimantan Selatan. Seluruh antarmuka
            menggunakan Bahasa Indonesia.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

export function AccountSummary({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-[#fbfaf7] px-3.5 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-ink/75">{user.nama}</p>
        <p className="truncate text-[9px] text-ink/40">{user.username}</p>
      </div>
    </div>
  );
}
