import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  TrendingUp,
} from "lucide-react";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useAuth } from "../../contexts/AuthContext";
import {
  FORM_META,
  formatDate,
  greeting,
  pctTone,
  shortName,
} from "../../lib/format";
import type { FormRow, Period, Stats } from "../../lib/types";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageSkeleton,
  ProgressBar,
  RingProgress,
  StatusBadge,
} from "../../components/ui";

interface HomeResponse {
  period: Period | null;
  user: { id: number; nama: string; jabatan: string | null; nip: string | null };
  forms: FormRow[];
  reminders: Array<{
    id: number;
    unit: string;
    unit_id: number;
    remaining: number;
    answered: number;
    total: number;
    status: FormRow["status"];
  }>;
  summary: Stats;
  units: Array<{ id: number; nama: string }>;
}

export default function KabidHome({ mode = "home" }: { mode?: "home" | "penilaian" }) {
  useDocumentTitle(mode === "penilaian" ? "Penilaian" : "Beranda");
  const { data, loading, error, reload } = useApi<HomeResponse>("/kabid/home");
  const { user } = useAuth();

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-[560px] md:max-w-[760px] pt-2 lg:max-w-none">
        <PageSkeleton />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const displayUser = data.user || user;
  const forms = data.forms || [];
  const activeForms = forms.filter((form) => !form.completed_at).length;
  const completedForms = forms.filter((form) => Boolean(form.completed_at)).length;

  return (
    <div className="mx-auto w-full max-w-[560px] md:max-w-[760px] space-y-4 lg:max-w-none">
      {mode === "home" ? (
        <div className="px-0.5 lg:flex lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
              {greeting()}
            </p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-tight text-ink lg:text-[32px]">
              {shortName(displayUser?.nama || "")}
            </h1>
            <p className="mt-1 text-[11px] leading-relaxed text-ink/45 lg:text-[12px]">
              {displayUser?.jabatan || "Kepala Bidang"}
              <span className="mx-1.5 text-ink/20">·</span>
              {formatDate(new Date().toISOString(), "long")}
            </p>
          </div>
          {data.period ? (
            <Badge tone="brand" className="mt-3 self-start lg:mt-0">
              {data.period.label}
            </Badge>
          ) : null}
        </div>
      ) : (
        <div className="px-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
            Penilaian periode
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight text-ink lg:text-[30px]">
            {data.period?.label || "Belum ada periode"}
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/45 lg:text-[12px]">
            Pilih unit kerja untuk melanjutkan penilaian pegawai.
          </p>
        </div>
      )}

      {!data.period ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Belum ada periode berjalan"
            description="Admin belum membuka periode monitoring. Silakan kembali lagi setelah periode dibuka."
          />
        </div>
      ) : (
        <div
          className={
            mode === "home"
              ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
              : "space-y-4"
          }
        >
          <div className="space-y-4">
            {mode === "home" ? (
              <div className="relative overflow-hidden rounded-3xl border border-brand-800 bg-brand-950 p-5 text-white shadow-lift brand-pattern lg:p-6">
                <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full border border-white/[0.07]" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gold-200">
                      <CalendarDays className="h-3 w-3" />
                      {data.period.label}
                    </span>
                    <p className="mt-3 text-[11px] leading-relaxed text-brand-100/55">
                      Total pengisian seluruh unit tugas Anda
                    </p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="tabular text-3xl font-extrabold leading-none">
                        {data.summary.answered}
                      </span>
                      <span className="pb-0.5 text-[11px] text-brand-100/40">
                        / {data.summary.total} pegawai dinilai
                      </span>
                    </div>
                  </div>
                  <RingProgress
                    value={data.summary.answered_pct}
                    size={92}
                    stroke={8}
                    color={data.summary.answered_pct >= 100 ? "#43c59a" : "#e4c47c"}
                    trackColor="rgba(255,255,255,0.14)"
                    className="text-white"
                  >
                    <span className="tabular text-[19px] font-extrabold text-white">
                      {data.summary.answered_pct}%
                    </span>
                    <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-brand-100/45">
                      terisi
                    </span>
                  </RingProgress>
                </div>
                <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                      Kepatuhan
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold text-gold-300">
                      {data.summary.pct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                      Ditandai selesai
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold">
                      {completedForms}/{forms.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                      Perlu diisi
                    </p>
                    <p className="mt-0.5 text-sm font-extrabold text-gold-300">
                      {activeForms} unit
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-white p-3 shadow-soft lg:max-w-[720px] lg:gap-3 lg:p-4">
                <div className="rounded-xl bg-brand-50/60 px-3 py-2.5 lg:px-4 lg:py-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/35">Unit tugas</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular text-brand-800">{forms.length}</p>
                </div>
                <div className="rounded-xl bg-amber-50 px-3 py-2.5 lg:px-4 lg:py-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/35">Belum selesai</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular text-amber-700">{activeForms}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5 lg:px-4 lg:py-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/35">Kepatuhan</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular text-emerald-700">
                    {data.summary.pct}%
                  </p>
                </div>
              </div>
            )}

            {mode === "home" && data.reminders.length ? (
              <section>
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                    <Clock3 className="h-3.5 w-3.5 text-gold-500" />
                    Perlu diselesaikan
                  </h2>
                  <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[9px] font-bold text-gold-800">
                    {data.reminders.length} formulir
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {data.reminders.map((reminder) => (
                    <Link
                      key={reminder.id}
                      to={`/kabid/unit/${reminder.unit_id}`}
                      className="flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-50/80 px-3.5 py-3 transition active:scale-[0.995] hover:border-gold-300"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gold-600 shadow-sm">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold leading-snug text-gold-950">
                          {reminder.unit}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gold-800/60">
                          {reminder.remaining > 0
                            ? `${reminder.remaining} pegawai belum dinilai`
                            : "Semua dinilai — belum ditandai selesai"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-gold-600/60" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                  <ClipboardList className="h-3.5 w-3.5 text-brand-600" />
                  {mode === "home" ? "Unit tugas saya" : "Unit kerja"}
                </h2>
                <span className="text-[10px] font-semibold text-ink/35">{forms.length} unit</span>
              </div>

              {forms.length ? (
                <div className="grid gap-2.5 md:grid-cols-2">
                  {forms.map((form) => (
                    <Link
                      key={form.id}
                      to={`/kabid/unit/${form.unit_id}`}
                      className="block rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-brand-200 hover:shadow-lift active:scale-[0.995]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold leading-snug text-ink">{form.unit}</p>
                          <p className="mt-0.5 text-[10px] text-ink/40">
                            {form.total} pegawai · {form.belum} belum dinilai
                          </p>
                        </div>
                        <StatusBadge meta={FORM_META[form.status]} />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <ProgressBar
                          value={form.answered_pct}
                          tone={form.answered === form.total ? "green" : "brand"}
                          size="sm"
                        />
                        <span className="tabular w-11 text-right text-[10px] font-bold text-ink/55">
                          {form.answered_pct}%
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-[9px] text-ink/35">
                        <span>
                          {form.answered}/{form.total} berstatus · {form.diperiksa} diperiksa
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            pctTone(form.pct) === "green"
                              ? "text-emerald-700"
                              : pctTone(form.pct) === "red"
                                ? "text-red-600"
                                : "text-amber-700"
                          }`}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {form.pct}% patuh
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <EmptyState
                    icon={ClipboardList}
                    title="Belum ada unit tugas"
                    description="Hubungi Admin untuk menetapkan unit kerja yang menjadi tanggung jawab Anda."
                  />
                </div>
              )}
            </section>

            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-white/60 px-3.5 py-3 text-[10px] leading-relaxed text-ink/40">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p>
                Penilaian tersimpan otomatis per pegawai. Anda dapat melanjutkan dari perangkat lain
                selama periode belum ditutup Admin.
              </p>
            </div>
          </div>

          {mode === "home" ? (
            <aside className="hidden space-y-3 lg:sticky lg:top-[92px] lg:block">
              <div className="relative overflow-hidden rounded-2xl border border-brand-800 bg-brand-950 p-5 text-white shadow-lift brand-pattern">
                <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/10" />
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-gold-300">
                  Rekap bidang saya
                </p>
                <p className="mt-1 text-[11px] text-brand-100/50">{data.period.label}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <RingProgress
                    value={data.summary.pct}
                    size={100}
                    stroke={9}
                    color={data.summary.pct >= 90 ? "#43c59a" : "#e4c47c"}
                    trackColor="rgba(255,255,255,0.14)"
                    className="text-white"
                  >
                    <span className="tabular text-xl font-extrabold text-white">
                      {data.summary.pct}%
                    </span>
                    <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-brand-100/45">
                      patuh
                    </span>
                  </RingProgress>
                  <div className="min-w-0 flex-1 space-y-2 text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-100/45">Patuh</span>
                      <span className="tabular font-bold">{data.summary.patuh}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-100/45">Tidak patuh</span>
                      <span className="tabular font-bold">{data.summary.tidak_patuh}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-100/45">Tidak diperiksa</span>
                      <span className="tabular font-bold">{data.summary.tidak_diperiksa}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-100/45">Belum dinilai</span>
                      <span className="tabular font-bold">{data.summary.belum}</span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/kabid/rekap"
                  className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-[11px] font-bold text-white transition hover:bg-white/15"
                >
                  Lihat rekap lengkap <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink/30">
                  Status formulir
                </p>
                <p className="mt-1.5 text-[20px] font-extrabold text-ink">
                  {completedForms}
                  <span className="text-[12px] font-semibold text-ink/35"> / {forms.length} ditandai selesai</span>
                </p>
                <ProgressBar
                  className="mt-2.5"
                  value={forms.length ? (completedForms / forms.length) * 100 : 0}
                  tone="green"
                />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[10px]">
                  <span className="text-ink/40">Belum selesai</span>
                  <span className="font-bold text-amber-700">{activeForms} unit</span>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-[10px] leading-relaxed text-brand-800/70">
                <p className="font-bold text-brand-900">Catatan</p>
                <p className="mt-1">
                  Angka kepatuhan bersifat sementara sampai Admin menutup periode. Formulir yang
                  sudah ditandai selesai tetap dapat diperbaiki dan akan kembali berstatus Sedang
                  Diisi.
                </p>
              </div>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
