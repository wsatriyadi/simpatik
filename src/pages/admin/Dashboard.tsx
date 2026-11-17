import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Gauge,
  Lock,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import {
  FORM_META,
  MONTHS,
  formatDate,
  formatPeriod,
  todayWita,
} from "../../lib/format";
import type {
  FormRow,
  FormStatus,
  Period,
  PeriodSummary,
  Violation,
} from "../../lib/types";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FilterPill,
  InfoBanner,
  Modal,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  RingProgress,
  SearchInput,
  SectionCard,
  Select,
  StatCard,
  StatusBadge,
  TableWrap,
} from "../../components/ui";

interface OverviewResponse {
  period: Period | null;
  periods: Period[];
  summary: PeriodSummary | null;
  forms: FormRow[];
  violations: Violation[];
  activePeriod: Period | null;
  canOpen: boolean;
}

type StatusFilter = "all" | FormStatus;

export default function AdminDashboard() {
  useDocumentTitle("Dasbor Pemantauan");
  const toast = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const path = `/admin/overview${periodId ? `?periodId=${periodId}` : ""}`;
  const { data, loading, error, reload } = useApi<OverviewResponse>(path);
  const [unitQuery, setUnitQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openPeriod, setOpenPeriod] = useState(false);
  const [closePeriod, setClosePeriod] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeStep, setCloseStep] = useState<"confirm" | "force">("confirm");
  const [incomplete, setIncomplete] = useState<FormRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newPeriod, setNewPeriod] = useState(() => nextPeriodValue([]));

  const forms = data?.forms || [];
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const query = unitQuery.trim().toLowerCase();
    return forms.filter((form) => {
      const matchesQuery =
        !query ||
        form.unit.toLowerCase().includes(query) ||
        (form.kabid_nama || "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || form.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [forms, unitQuery, statusFilter]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: forms.length,
      belum: 0,
      sedang: 0,
      selesai: 0,
      terkunci: 0,
    };
    forms.forEach((form) => {
      base[form.status] += 1;
    });
    return base;
  }, [forms]);

  const isActivePeriod = data?.period?.status === "berjalan";
  const unfinished = forms
    .filter((form) => !form.completed_at)
    .sort((a, b) => b.belum - a.belum);
  const maxViolation = data?.violations?.[0]?.jumlah || 1;

  const openPeriodModal = () => {
    setNewPeriod(nextPeriodValue(data?.periods || []));
    setOpenPeriod(true);
  };

  const createPeriod = async () => {
    setCreating(true);
    try {
      const result = await api<{ period: Period }>("/admin/periods", {
        method: "POST",
        body: { bulan: newPeriod.bulan, tahun: newPeriod.tahun },
      });
      toast.success(
        "Periode berhasil dibuka",
        `${result.period.label} siap diisi oleh para Kabid.`,
      );
      setOpenPeriod(false);
      setPeriodId(result.period.id);
      await reload();
    } catch (err) {
      toast.error("Periode gagal dibuka", err instanceof Error ? err.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const startClose = () => {
    setCloseStep("confirm");
    setIncomplete([]);
    setClosePeriod(true);
  };

  const closeCurrentPeriod = async (force = false) => {
    if (!data?.period) return;
    setClosing(true);
    try {
      await api(`/admin/periods/${data.period.id}/close`, {
        method: "POST",
        body: { force },
      });
      toast.success(
        "Periode ditutup",
        "Seluruh formulir telah dikunci dan angka menjadi final.",
      );
      setClosePeriod(false);
      await reload();
    } catch (err) {
      const error = err as Error & { data?: { needsConfirmation?: boolean; incomplete?: FormRow[] } };
      if (error.data?.needsConfirmation) {
        setIncomplete(error.data.incomplete || []);
        setCloseStep("force");
      } else {
        toast.error("Periode gagal ditutup", error.message);
      }
    } finally {
      setClosing(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {data?.period ? data.period.label : "Belum ada periode"}
            {data?.period?.status === "ditutup" ? (
              <Badge tone="dark" className="ml-1">
                Final
              </Badge>
            ) : null}
          </>
        }
        title="Dasbor Pemantauan"
        description="Pantau progres penilaian seluruh unit, kepatuhan periode berjalan, dan siapkan laporan resmi rumah sakit."
        actions={
          <>
            {data?.periods?.length ? (
              <Select
                aria-label="Pilih periode"
                value={periodId ?? data.period?.id ?? ""}
                onChange={(event) => setPeriodId(Number(event.target.value))}
                className="h-10 w-[185px] text-xs font-semibold"
              >
                {data.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label} {period.status === "ditutup" ? "· Final" : "· Berjalan"}
                  </option>
                ))}
              </Select>
            ) : null}
            {data?.canOpen ? (
              <Button onClick={openPeriodModal} icon={<CalendarPlus className="h-4 w-4" />}>
                Buka Periode
              </Button>
            ) : null}
            {data?.period?.status === "berjalan" ? (
              <Button
                variant="outline"
                onClick={startClose}
                icon={<Lock className="h-4 w-4" />}
              >
                Tutup Periode
              </Button>
            ) : null}
          </>
        }
      />

      {!data?.period ? (
        <div className="card">
          <EmptyState
            icon={CalendarPlus}
            title="Belum ada periode monitoring"
            description="Buka periode pertama untuk membuat formulir ceklist bagi seluruh unit kerja aktif."
            action={
              <Button onClick={openPeriodModal} icon={<CalendarPlus className="h-4 w-4" />}>
                Buka Periode Pertama
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {data.period.status === "berjalan" ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-gold-200 bg-gold-50/70 px-4 py-3">
              <Clock3 className="h-4 w-4 text-gold-700" />
              <p className="text-xs font-semibold text-gold-900">
                Status SEMENTARA
              </p>
              <p className="text-xs text-gold-800/65">
                Angka rekap dan laporan belum final sampai Admin menutup periode.
              </p>
              <span className="ml-auto hidden rounded-full border border-gold-200 bg-white/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-gold-800 sm:block">
                {summary?.forms_complete || 0} / {summary?.forms_total || 0} formulir ditandai selesai
              </span>
            </div>
          ) : (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-900">Periode telah ditutup</p>
              <p className="text-xs text-emerald-800/60">
                Seluruh formulir terkunci permanen dan angka rekap menjadi final.
              </p>
              <span className="ml-auto text-[10px] font-semibold text-emerald-700">
                Ditutup {formatDate(data.period.closed_at, "medium")}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Total Pegawai"
              value={summary?.total || 0}
              hint={`${summary?.forms_total || 0} formulir unit`}
              icon={Users}
              tone="brand"
            />
            <StatCard
              label="Sudah Dinilai"
              value={summary?.answered || 0}
              hint={`${summary?.belum || 0} belum dinilai`}
              icon={ClipboardCheck}
              tone="blue"
            />
            <StatCard
              label="Patuh"
              value={summary?.patuh || 0}
              hint={`Dari ${summary?.diperiksa || 0} diperiksa`}
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label="Tidak Patuh"
              value={summary?.tidak_patuh || 0}
              hint={`${summary?.tidak_diperiksa || 0} tidak diperiksa`}
              icon={XCircle}
              tone="red"
            />
            <StatCard
              label="Kepatuhan"
              value={`${summary?.pct || 0}%`}
              hint="Patuh ÷ diperiksa"
              icon={Gauge}
              tone={summary && summary.pct >= 90 ? "green" : "amber"}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <SectionCard
              title="Kepatuhan periode"
              subtitle={
                isActivePeriod
                  ? "Angka sementara dihitung dari pegawai yang telah diperiksa."
                  : "Angka final dihitung dari pegawai yang telah diperiksa."
              }
              bodyClassName="p-5"
            >
              <div className="flex items-center justify-between gap-5">
                <RingProgress value={summary?.pct || 0} size={124} stroke={11}>
                  <span className="tabular text-2xl font-extrabold text-ink">
                    {summary?.pct || 0}%
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/35">
                    Patuh
                  </span>
                </RingProgress>
                <div className="min-w-0 flex-1 space-y-2.5">
                  {[
                    { label: "Patuh", value: summary?.patuh || 0, tone: "bg-emerald-500" },
                    { label: "Tidak patuh", value: summary?.tidak_patuh || 0, tone: "bg-red-500" },
                    { label: "Tidak diperiksa", value: summary?.tidak_diperiksa || 0, tone: "bg-amber-500" },
                    { label: "Belum dinilai", value: summary?.belum || 0, tone: "bg-stone-300" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-[11px]">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${item.tone}`} />
                      <span className="min-w-0 flex-1 truncate text-ink/50">{item.label}</span>
                      <span className="tabular font-bold text-ink/75">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink/50">Formulir ditandai selesai</span>
                  <span className="tabular font-bold text-ink/70">
                    {summary?.forms_complete || 0} / {summary?.forms_total || 0}
                  </span>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={
                    summary?.forms_total
                      ? ((summary.forms_complete || 0) / summary.forms_total) * 100
                      : 0
                  }
                  tone="green"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Pelanggaran terbanyak"
              subtitle="Item yang paling sering tidak dipenuhi."
              action={<AlertTriangle className="h-4 w-4 text-gold-500" />}
              bodyClassName="p-5"
            >
              {data.violations.length ? (
                <div className="space-y-3.5">
                  {data.violations.slice(0, 5).map((violation) => (
                    <div key={violation.id}>
                      <div className="mb-1.5 flex items-start justify-between gap-3">
                        <p className="text-[11px] font-semibold leading-snug text-ink/70">
                          {violation.nama}
                        </p>
                        <span className="tabular shrink-0 text-[11px] font-bold text-ink/45">
                          {violation.jumlah}
                        </span>
                      </div>
                      <ProgressBar
                        value={(Number(violation.jumlah) / Number(maxViolation)) * 100}
                        tone="gold"
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="py-8"
                  icon={CheckCircle2}
                  title="Belum ada pelanggaran"
                  description="Tidak ada item yang tidak dipenuhi pada penilaian sejauh ini."
                />
              )}
            </SectionCard>

            <SectionCard
              title={isActivePeriod ? "Formulir belum selesai" : "Formulir belum ditandai selesai"}
              subtitle={
                isActivePeriod
                  ? "Unit dengan sisa pegawai yang perlu dinilai."
                  : "Unit yang belum ditandai selesai saat periode ditutup."
              }
              action={<span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">{unfinished.length} unit</span>}
              bodyClassName="p-0"
            >
              {unfinished.length ? (
                <div className="divide-y divide-line/70">
                  {unfinished.slice(0, 5).map((form) => (
                    <Link
                      key={form.id}
                      to={`/admin/forms/${form.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink">{form.unit}</p>
                        <p className="mt-0.5 truncate text-[10px] text-ink/40">
                          {form.kabid_nama || "Belum ada Kabid"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-[11px] font-bold text-amber-700">
                          {form.belum > 0 ? `${form.belum} sisa` : "Belum ditandai"}
                        </p>
                        <p className="text-[9px] text-ink/35">
                          {form.answered}/{form.total} dinilai
                        </p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-ink/25" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="py-10"
                  icon={CheckCircle2}
                  title="Semua formulir selesai"
                  description="Seluruh unit telah ditandai selesai pada periode ini."
                />
              )}
            </SectionCard>
          </div>

          <div className="mt-5">
            <SectionCard
              title="Pantauan unit kerja"
              subtitle={`${forms.length} formulir · ${formatPeriod(data.period.bulan, data.period.tahun)}`}
              action={
                <div className="flex items-center gap-2">
                  <SearchInput
                    value={unitQuery}
                    onChange={setUnitQuery}
                    placeholder="Cari unit atau Kabid…"
                    className="w-[190px]"
                  />
                </div>
              }
              bodyClassName="p-0"
            >
              <div className="flex gap-1.5 overflow-x-auto border-b border-line/70 px-4 py-3 scroll-thin">
                {(
                  [
                    ["all", "Semua"],
                    ["belum", "Belum Mulai"],
                    ["sedang", "Sedang Diisi"],
                    ["selesai", "Selesai"],
                    ["terkunci", "Terkunci"],
                  ] as Array<[StatusFilter, string]>
                ).map(([value, label]) => (
                  <FilterPill
                    key={value}
                    active={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                    count={counts[value]}
                  >
                    {label}
                  </FilterPill>
                ))}
              </div>

              {filtered.length ? (
                <>
                  <TableWrap className="hidden md:block">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                      <thead>
                        <tr className="table-head">
                          <th className="px-4 py-3 font-semibold">Unit Kerja</th>
                          <th className="px-4 py-3 font-semibold">Penanggung Jawab</th>
                          <th className="w-[220px] px-4 py-3 font-semibold">Progres Pengisian</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="w-[70px] px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {filtered.map((form) => (
                          <tr key={form.id} className="group transition hover:bg-brand-50/30">
                            <td className="px-4 py-3">
                              <Link
                                to={`/admin/forms/${form.id}`}
                                className="font-semibold text-ink hover:text-brand-700"
                              >
                                {form.unit}
                              </Link>
                              <p className="mt-0.5 text-[10px] text-ink/35">
                                {form.total} pegawai
                              </p>
                            </td>
                            <td className="max-w-[230px] px-4 py-3">
                              <p className="truncate text-xs font-medium text-ink/70">
                                {form.kabid_nama || "Belum ditugaskan"}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-ink/35">
                                {form.kabid_jabatan || "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ProgressBar
                                  value={form.answered_pct}
                                  tone={form.answered === form.total ? "green" : "brand"}
                                  size="sm"
                                  className="flex-1"
                                />
                                <span className="tabular w-[72px] text-right text-[10px] font-semibold text-ink/45">
                                  {form.answered}/{form.total}
                                </span>
                              </div>
                              <p className="mt-1 text-[9px] text-ink/30">
                                {form.diperiksa} diperiksa · {form.belum} belum
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge meta={FORM_META[form.status]} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                to={`/admin/forms/${form.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/40 transition group-hover:border-brand-200 group-hover:text-brand-700"
                                aria-label={`Lihat formulir ${form.unit}`}
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>

                  <div className="divide-y divide-line/60 md:hidden">
                    {filtered.map((form) => (
                      <Link
                        key={form.id}
                        to={`/admin/forms/${form.id}`}
                        className="block px-4 py-4 transition active:bg-brand-50/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold leading-snug text-ink">
                              {form.unit}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-ink/40">
                              {form.kabid_nama || "Belum ditugaskan"} · {form.total} pegawai
                            </p>
                          </div>
                          <StatusBadge meta={FORM_META[form.status]} />
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <ProgressBar value={form.answered_pct} size="sm" />
                          <span className="tabular w-[62px] text-right text-[10px] font-semibold text-ink/45">
                            {form.answered}/{form.total}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Search}
                  title="Unit tidak ditemukan"
                  description="Coba kata kunci lain atau ubah saringan status formulir."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUnitQuery("");
                        setStatusFilter("all");
                      }}
                    >
                      Reset saringan
                    </Button>
                  }
                />
              )}
            </SectionCard>
          </div>
        </>
      )}

      <Modal
        open={openPeriod}
        onClose={() => setOpenPeriod(false)}
        title="Buka periode monitoring"
        description="Sistem akan membuat satu formulir per unit aktif beserta cuplikan pegawai dan item periksa."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenPeriod(false)} disabled={creating}>
              Batal
            </Button>
            <Button onClick={createPeriod} loading={creating} icon={<CalendarPlus className="h-4 w-4" />}>
              Buka Periode
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bulan" required>
              <Select
                value={newPeriod.bulan}
                onChange={(event) =>
                  setNewPeriod((value) => ({ ...value, bulan: Number(event.target.value) }))
                }
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tahun" required>
              <Select
                value={newPeriod.tahun}
                onChange={(event) =>
                  setNewPeriod((value) => ({ ...value, tahun: Number(event.target.value) }))
                }
              >
                {yearOptions(data?.periods || []).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <InfoBanner icon={ClipboardCheck} tone="brand" title="Yang akan dibuat">
            Formulir untuk {data?.forms.length || 22} unit aktif, menyalin daftar item periksa yang
            aktif saat ini dan daftar pegawai aktif setiap unit. Perubahan data induk setelah
            periode dibuka baru berlaku pada periode berikutnya.
          </InfoBanner>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800">
            Hanya satu periode dapat berjalan pada satu waktu. Periode yang sudah ditutup tidak
            dapat dibuka kembali.
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={closePeriod}
        onClose={() => setClosePeriod(false)}
        onConfirm={() => closeCurrentPeriod(closeStep === "force")}
        title={closeStep === "force" ? "Tutup periode meskipun belum lengkap?" : "Tutup periode sekarang?"}
        description={
          closeStep === "force"
            ? "Formulir yang belum selesai akan tetap ditutup dan dikunci. Angka yang belum lengkap akan menjadi bagian dari arsip final."
            : `Seluruh formulir ${data?.period?.label || ""} akan dikunci permanen dan angka rekap menjadi final.`
        }
        confirmLabel={closeStep === "force" ? "Tetap Tutup Periode" : "Tutup & Kunci Periode"}
        loading={closing}
        tone="danger"
      >
        {closeStep === "force" ? (
          <div>
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {incomplete.length} formulir belum ditandai selesai. Admin tetap dapat menutup
                periode, tetapi formulir tersebut tercatat belum lengkap pada arsip.
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {incomplete.map((form) => (
                <div key={form.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs">
                  <span className="truncate text-ink/70">{form.unit}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-red-600">
                    {form.belum} belum dinilai
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs leading-relaxed text-ink/60">
            <p>
              Setelah ditutup, Kabid tidak dapat mengubah ceklist lagi, laporan kehilangan cap
              SEMENTARA, dan periode tidak dapat dibuka kembali.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-brand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-ink/35">Formulir ditandai selesai</p>
                <p className="mt-0.5 text-lg font-extrabold text-brand-800">
                  {summary?.forms_complete || 0}
                  <span className="text-xs font-medium text-ink/35"> / {summary?.forms_total || 0}</span>
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-ink/35">Belum selesai</p>
                <p className="mt-0.5 text-lg font-extrabold text-amber-700">
                  {unfinished.length}
                  <span className="text-xs font-medium text-ink/35"> unit</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function nextPeriodValue(periods: Period[]) {
  const latest = periods[0];
  if (latest) {
    const nextMonth = latest.bulan === 12 ? 1 : latest.bulan + 1;
    const nextYear = latest.bulan === 12 ? latest.tahun + 1 : latest.tahun;
    return { bulan: nextMonth, tahun: nextYear };
  }
  const today = todayWita().split("-").map(Number);
  return { bulan: today[1], tahun: today[0] };
}

function yearOptions(periods: Period[]) {
  const current = new Date().getFullYear();
  const years = new Set<number>([current - 1, current, current + 1]);
  periods.forEach((period) => years.add(period.tahun));
  return Array.from(years).sort((a, b) => a - b);
}
