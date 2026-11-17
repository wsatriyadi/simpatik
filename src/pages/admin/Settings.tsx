import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useDocumentTitle } from "../../lib/hooks";
import { PageHeader, SectionCard, Badge } from "../../components/ui";
import {
  AppInfoCard,
  ChangePasswordCard,
  LogoutCard,
  ProfileCard,
} from "../../components/AccountPanels";

export default function AdminSettings() {
  useDocumentTitle("Pengaturan Akun");
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Akun"
        title="Pengaturan Akun"
        description="Kelola identitas akun, keamanan password, dan sesi masuk Anda pada perangkat ini."
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <ProfileCard
            user={user}
            extra={
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink/45">
                <Badge tone="dark">Akses penuh</Badge>
                <span>Administrator sistem dan data induk</span>
              </div>
            }
          />
          <ChangePasswordCard />
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Hak akses Admin"
            subtitle="Peran Anda pada SIMPATIK."
            action={<ShieldCheck className="h-4 w-4 text-brand-500" />}
          >
            <ul className="space-y-2.5 text-xs text-ink/60">
              {[
                "Mengelola unit, pegawai, akun, dan item periksa",
                "Membuka serta menutup periode monitoring",
                "Memantau progres dan mengunduh seluruh laporan",
                "Tidak mengisi atau mengubah ceklist unit",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {text}
                </li>
              ))}
            </ul>
          </SectionCard>
          <LogoutCard />
          <AppInfoCard />
        </div>
      </div>
    </div>
  );
}
