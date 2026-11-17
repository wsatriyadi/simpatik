import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { FORM_META, formatDate, shortName } from "../../lib/format";
import type { FormRow, Period, Stats, Violation } from "../../lib/types";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageSkeleton,
  ProgressBar,
  RingProgress,
  StatusBadge,
} from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";

interface RecapResponse {
  period: Period | null;
  summary: Stats | null;
  forms: FormRow[];
  violations: Violation[];
  violation_list: Violation[];
  sementara: boolean;
}

export default function KabidRecap() {
  useDocumentTitle("Rekap Bidang Saya");
  const { data, loading, error, reload } = useApi<RecapResponse>("/kabid/recap");
  const { user } = useAuth();

  if (loading && !data) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-48 animate-pulse rounded-3xl bg-brand-900/10" />
        <div className="h-24 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  if (!data.period || !data.summary) {
    return (
      <div className="space-y-4 pt-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
            Rekap bidang
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">
            Rekap Bidang Saya
          </h1>
        </div>
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Belum ada periode berjalan"
            description="Rekap kepatuhan akan tersedia setelah Admin membuka periode monitoring."
          />
        </div>
      </div>
    );
  }

  const { summary, forms, period } = data;
  const completeForms = forms.filter((form) => Boolean(form.completed_at)).length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3.5">
      <div className="px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
          Rekap bidang
        </p>
        <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink">
          Rekap Bidang Saya
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
          Gabungan {forms.length} unit tugas · {period.label}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-brand-800 bg-brand-950 p-5 text-white shadow-lift brand-pattern">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gold-200">
              <BarChart3 className="h-3 w-3" />
              {period.label}
            </span>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-100/45">
              Kepatuhan gabungan
            </p>
            <p className="tabular mt-1 text-4xl font-extrabold leading-none text-gold-300">
              {summary.pct}%
            </p>
            <p className="mt-2 text-[10px] text-brand-100/50">
              {summary.patuh} patuh dari {summary.diperiksa} pegawai diperiksa
            </p>
          </div>
          <RingProgress value={summary.pct} size={104} stroke={9} trackColor="rgba(255,255,255,0.14)">
            <span className="tabular text-[20px] font-extrabold text-white">{summary.pct}%</span>
            <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-brand-100/40">
              Patuh
            </span>
          </RingProgress>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <Mini label="Pegawai" value={summary.total} />
          <Mini label="Terisi" value={`${summary.answered}/${summary.total}`} />
          <Mini label="Form selesai" value={`${completeForms}/${forms.length}`} />
        </div>
      </div>

      {data.sementara ? (
        <div className="flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-3 text-[10px] leading-relaxed text-gold-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
          <div>
            <p className="font-bold">Angka masih SEMENTARA</p>
            <p className="mt-0.5 text-gold-800/70">
              Rekap menjadi final setelah Admin menutup periode. Laporan yang diunduh saat ini
              mencantumkan cap SEMENTARA.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Patuh" value={summary.patuh} tone="green" />
        <Tile label="Tidak patuh" value={summary.tidak_patuh} tone="red" />
        <Tile label="Tidak diperiksa" value={summary.tidak_diperiksa} tone="amber" />
        <Tile label="Belum dinilai" value={summary.belum} tone={summary.belum ? "amber" : "green"} />
      </div>

      {data.violation_list.length ? (
        <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink">
            <TrendingUp className="h-3.5 w-3.5 text-gold-500" /> Pelanggaran terbanyak bidang
          </p>
          <div className="mt-2.5 space-y-2">
            {data.violation_list.slice(0, 5).map((violation) => (
              <div key={violation.id}>
                <div className="mb-1 flex items-start justify-between gap-2 text-[10px]">
                  <span className="leading-snug text-ink/55">{violation.nama}</span>
                  <span className="shrink-0 font-bold text-ink/40">{violation.jumlah}</span>
                </div>
                <ProgressBar
                  value={
                    (Number(violation.jumlah) / Number(data.violation_list[0].jumlah)) * 100
                  }
                  size="sm"
                  tone="gold"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[10px] font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> Belum ada pelanggaran tercatat pada unit Anda.
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-[13px] font-extrabold text-ink">Rincian per unit</h2>
          <span className="text-[9px] text-ink/30">Diurutkan dari kepatuhan tertinggi</span>
        </div>
        <div className="space-y-2">
          {forms.map((form) => (
            <Link
              key={form.id}
              to={`/kabid/form/${form.id}`}
              className="block rounded-2xl border border-line bg-white p-3.5 shadow-soft transition active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold leading-snug text-ink">{form.unit}</p>
                  <p className="mt-0.5 text-[9px] text-ink/35">
                    {form.diperiksa} diperiksa · {form.belum} belum
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge meta={FORM_META[form.status]} />
                  <ArrowRight className="h-3.5 w-3.5 text-ink/20" />
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <ProgressBar
                  value={form.pct}
                  tone={form.pct >= 90 ? "green" : form.pct >= 75 ? "blue" : "amber"}
                  size="sm"
                />
                <span className="tabular w-9 text-right text-[10px] font-extrabold text-ink/55">
                  {form.pct}%
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[8px] text-ink/30">
                <span>
                  {form.answered}/{form.total} berstatus
                </span>
                {form.tanggal_pemeriksaan ? (
                  <span>Diperiksa {formatDate(form.tanggal_pemeriksaan, "short")}</span>
                ) : (
                  <span>Belum ditandai selesai</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 px-1 text-[9px] leading-relaxed text-ink/30">
        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
        Hasil penilaian Anda tersimpan langsung di server, {shortName(user?.nama || "")}. Angka
        final ditetapkan Admin saat menutup periode.
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-brand-100/35">{label}</p>
      <p className="tabular mt-0.5 text-[12px] font-extrabold text-white/85">{value}</p>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "amber";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-600"
        : "text-amber-700";
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3 shadow-sm">
      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/30">{label}</p>
      <p className={`tabular mt-1 text-lg font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
