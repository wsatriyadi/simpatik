import { Badge } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import type { FormRow, Period, Unit } from "../../lib/types";
import {
  AppInfoCard,
  ChangePasswordCard,
  InstallAppCard,
  LogoutCard,
  ProfileCard,
} from "../../components/AccountPanels";

interface HomeShape {
  period: Period | null;
  units: Unit[];
  forms: FormRow[];
}

export default function KabidSettings() {
  useDocumentTitle("Pengaturan Akun");
  const { user } = useAuth();
  const { data } = useApi<HomeShape>("/kabid/home");
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3.5">
      <div className="px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
          Akun
        </p>
        <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
          Kelola identitas, password, dan pemasangan aplikasi pada perangkat Anda.
        </p>
      </div>

      <ProfileCard
        user={user}
        extra={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{data?.units?.length || 0} unit tugas</Badge>
              {data?.period ? <Badge tone="gold">{data.period.label}</Badge> : null}
            </div>
            {data?.units?.length ? (
              <div className="flex flex-wrap gap-1">
                {data.units.slice(0, 4).map((unit) => (
                  <span
                    key={unit.id}
                    className="max-w-full truncate rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[9px] text-ink/50"
                  >
                    {unit.nama}
                  </span>
                ))}
                {data.units.length > 4 ? (
                  <span className="rounded-md bg-ink/[0.04] px-2 py-1 text-[9px] font-semibold text-ink/40">
                    +{data.units.length - 4} unit
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        }
      />

      <ChangePasswordCard />
      <InstallAppCard />
      <LogoutCard description="Akhiri sesi Kabid pada perangkat ini." />
      <AppInfoCard />

      <p className="px-1 text-center text-[8px] leading-relaxed text-ink/25">
        SIMPATIK v1.0.0 · RSJ Sambang Lihum · Pemerintah Provinsi Kalimantan Selatan
      </p>
    </div>
  );
}
