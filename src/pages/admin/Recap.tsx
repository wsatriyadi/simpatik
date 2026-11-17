import { useState } from "react";
import {
  Award,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Medal,
  Trophy,
  XCircle,
} from "lucide-react";
import { api, downloadFile } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import type { Period, Stats, FormRow, Violation } from "../../lib/types";
import {
  Badge,
  Button,
  ErrorState,
  InfoBanner,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  SectionCard,
  Select,
  StatCard,
  StatusBadge,
  TableWrap,
} from "../../components/ui";
import { FORM_META, formatPeriod } from "../../lib/format";

interface GroupRecap extends Stats {
  kabid_id: number | null;
  kabid_nama: string;
  kabid_jabatan: string;
  units: FormRow[];
}

interface RecapPayload {
  summary: Stats & {
    forms_total: number;
    forms_complete: number;
    forms_in_progress: number;
    forms_not_started: number;
  };
  forms: FormRow[];
  groups: GroupRecap[];
  violations: Violation[];
  topUnit: FormRow | null;
}

interface RecapResponse {
  period: Period | null;
  periods: Period[];
  recap: RecapPayload | null;
  sementara: boolean;
}

export default function AdminRecap() {
  useDocumentTitle("Rekap Gabungan");
  const toast = useToast();
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const path = `/admin/recap${periodId ? `?periodId=${periodId}` : ""}`;
  const { data, loading, error, reload } = useApi<RecapResponse>(path);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const recap = data?.recap;
  const period = data?.period;
  const download = async (key: string, pathValue: string, filename: string) => {
    setDownloading(key);
    try {
      await downloadFile(pathValue, filename);
    } catch (err) {
      toast.error("Berkas gagal diunduh", err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pemantauan & rekap"
        title="Rekap Gabungan Rumah Sakit"
        description="Kepatuhan seluruh unit dan bidang pada satu periode, lengkap dengan peringkat unit dan item yang paling sering dilanggar."
        actions={
          <>
            {data?.periods?.length ? (
              <Select
                aria-label="Pilih periode"
                value={periodId ?? period?.id ?? ""}
                onChange={(event) => setPeriodId(Number(event.target.value))}
                className="h-10 w-[185px] text-xs font-semibold"
              >
                {data.periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} {item.status === "ditutup" ? "· Final" : "· Berjalan"}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button
              variant="outline"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              disabled={!period}
              loading={downloading === "excel"}
              onClick={() =>
                period &&
                download(
                  "excel",
                  `/reports/recap/excel?periodId=${period.id}`,
                  `Rekap-Gabungan-${period.bulan}-${period.tahun}.xlsx`,
                )
              }
            >
              Excel
            </Button>
            <Button
              variant="outline"
              icon={<FileText className="h-4 w-4" />}
              disabled={!period}
              loading={downloading === "pdf"}
              onClick={() =>
                period &&
                download(
                  "pdf",
                  `/reports/recap/pdf?periodId=${period.id}`,
                  `Rekap-Gabungan-${period.bulan}-${period.tahun}.pdf`,
                )
              }
            >
              PDF
            </Button>
          </>
        }
      />

      {!recap || !period ? (
        <div className="card">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Info className="h-8 w-8 text-brand-500" />
            <h2 className="mt-3 text-sm font-bold">Belum ada periode</h2>
            <p className="mt-1 text-xs text-ink/45">
              Buka dan isi periode terlebih dahulu untuk melihat rekap gabungan.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              {period.label}
            </Badge>
            {data.sementara ? (
              <Badge tone="gold">SEMENTARA · angka belum final</Badge>
            ) : (
              <Badge tone="green">FINAL · periode ditutup</Badge>
            )}
            <span className="text-[11px] text-ink/35">
              {recap.summary.forms_complete} dari {recap.summary.forms_total} formulir ditandai selesai
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Kepatuhan Rumah Sakit"
              value={`${recap.summary.pct}%`}
              hint={`${recap.summary.patuh} patuh dari ${recap.summary.diperiksa} diperiksa`}
              icon={Award}
              tone={recap.summary.pct >= 90 ? "green" : "amber"}
            />
            <StatCard
              label="Pegawai Diperiksa"
              value={recap.summary.diperiksa}
              hint={`Dari ${recap.summary.total} pegawai`}
              icon={CheckCircle2}
              tone="brand"
            />
            <StatCard
              label="Tidak Patuh"
              value={recap.summary.tidak_patuh}
              hint={`${recap.summary.tidak_diperiksa} tidak diperiksa`}
              icon={XCircle}
              tone="red"
            />
            <StatCard
              label="Pelanggaran Terbanyak"
              value={recap.violations[0]?.jumlah || 0}
              hint={
                recap.violations.length
                  ? recap.violations.map((item) => item.nama).join("; ")
                  : "Belum ada pelanggaran"
              }
              icon={Medal}
              tone="gold"
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <SectionCard
              title="Rekap per bidang"
              subtitle="Gabungan seluruh unit di bawah penanggung jawab yang sama."
              bodyClassName="p-0"
            >
              <TableWrap>
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3">Bidang / Penanggung Jawab</th>
                      <th className="px-3 py-3 text-center">Unit</th>
                      <th className="px-3 py-3 text-center">Diperiksa</th>
                      <th className="px-3 py-3 text-center">Patuh</th>
                      <th className="px-3 py-3 text-center">Tidak Patuh</th>
                      <th className="px-3 py-3 text-center">Tidak Diperiksa</th>
                      <th className="w-[120px] px-4 py-3">Kepatuhan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {recap.groups.map((group) => (
                      <tr key={group.kabid_id || 0} className="transition hover:bg-brand-50/25">
                        <td className="max-w-[250px] px-4 py-3">
                          <p className="truncate text-xs font-bold text-ink">{group.kabid_nama}</p>
                          <p className="mt-0.5 truncate text-[10px] text-ink/35">{group.kabid_jabatan}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular text-ink/55">
                          {group.units.length}
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular font-semibold">
                          {group.diperiksa}
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular text-emerald-700">
                          {group.patuh}
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular text-red-600">
                          {group.tidak_patuh}
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular text-amber-700">
                          {group.tidak_diperiksa}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={group.pct} tone={group.pct >= 90 ? "green" : "amber"} size="sm" />
                            <span className="tabular w-9 text-right text-[10px] font-bold text-ink/60">
                              {group.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </SectionCard>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-brand-800 bg-brand-950 p-5 text-white brand-pattern">
                <Trophy className="absolute -bottom-5 -right-3 h-28 w-28 text-white/[0.06]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">
                  Kepatuhan tertinggi
                </p>
                {recap.topUnit ? (
                  <>
                    <p className="mt-2 text-xl font-extrabold leading-tight">
                      {recap.topUnit.unit}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-100/55">
                      {recap.topUnit.kabid_nama || "Belum ditugaskan"}
                    </p>
                    <div className="mt-4 flex items-end gap-2">
                      <span className="text-4xl font-extrabold tabular text-gold-300">
                        {recap.topUnit.pct}%
                      </span>
                      <span className="pb-1 text-[10px] text-brand-100/45">
                        {recap.topUnit.patuh} dari {recap.topUnit.diperiksa} diperiksa
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-brand-100/60">Belum ada unit yang dinilai.</p>
                )}
              </div>

              <SectionCard
                title="Item paling sering dilanggar"
                subtitle="Pada periode ini, termasuk angka seri."
              >
                {recap.violations.length ? (
                  <div className="space-y-2.5">
                    {recap.violations.map((violation) => (
                      <div
                        key={violation.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-gold-100 bg-gold-50/60 px-3 py-2"
                      >
                        <p className="text-[11px] font-medium leading-snug text-gold-900">
                          {violation.nama}
                        </p>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-gold-700">
                          {violation.jumlah} pegawai
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink/40">Belum ada pelanggaran tercatat.</p>
                )}
              </SectionCard>
            </div>
          </div>

          <div className="mt-4">
            <SectionCard
              title="Peringkat unit kerja"
              subtitle={`${recap.forms.length} unit · diurutkan dari persentase kepatuhan tertinggi`}
              bodyClassName="p-0"
            >
              <TableWrap>
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="w-16 px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Unit Kerja</th>
                      <th className="px-4 py-3">Penanggung Jawab</th>
                      <th className="px-3 py-3 text-center">Total</th>
                      <th className="px-3 py-3 text-center">Diperiksa</th>
                      <th className="px-3 py-3 text-center">Patuh</th>
                      <th className="px-3 py-3 text-center">Tidak Patuh</th>
                      <th className="w-[130px] px-4 py-3">Kepatuhan</th>
                      <th className="w-[90px] px-4 py-3 text-right">Laporan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {recap.forms.map((form) => (
                      <tr key={form.id} className="group transition hover:bg-brand-50/25">
                        <td className="px-4 py-3 text-center">
                          <RankBadge rank={form.rank ?? 0} />
                        </td>
                        <td className="max-w-[230px] px-4 py-3">
                          <p className="truncate text-xs font-bold text-ink">{form.unit}</p>
                          <p className="mt-0.5 text-[9px] text-ink/30">{form.total} pegawai</p>
                        </td>
                        <td className="max-w-[190px] px-4 py-3">
                          <p className="truncate text-[11px] text-ink/55">{form.kabid_nama || "Belum ditugaskan"}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-xs tabular text-ink/50">{form.total}</td>
                        <td className="px-3 py-3 text-center text-xs tabular font-semibold">{form.diperiksa}</td>
                        <td className="px-3 py-3 text-center text-xs tabular text-emerald-700">{form.patuh}</td>
                        <td className="px-3 py-3 text-center text-xs tabular text-red-600">{form.tidak_patuh}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={form.pct}
                              size="sm"
                              tone={form.pct >= 90 ? "green" : form.pct >= 75 ? "blue" : form.pct >= 60 ? "amber" : "red"}
                            />
                            <span className="tabular w-9 text-right text-[10px] font-bold text-ink/60">
                              {form.pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Unduh Excel unit"
                              disabled={downloading === `f-${form.id}-x`}
                              onClick={() =>
                                download(`f-${form.id}-x`, `/reports/form/${form.id}/excel`, `${form.unit}.xlsx`)
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Unduh PDF unit"
                              disabled={downloading === `f-${form.id}-p`}
                              onClick={() =>
                                download(`f-${form.id}-p`, `/reports/form/${form.id}/pdf`, `${form.unit}.pdf`)
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-40"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </SectionCard>
          </div>

          <div className="mt-4">
            <InfoBanner
              tone={data.sementara ? "gold" : "green"}
              icon={data.sementara ? Info : CheckCircle2}
              title={data.sementara ? "Rekap masih SEMENTARA" : "Rekap sudah final"}
            >
              {data.sementara
                ? "Angka dapat berubah selama periode belum ditutup. Setiap lembar laporan Excel/PDF yang diunduh mencantumkan cap SEMENTARA."
                : "Periode telah ditutup. Seluruh angka final dan laporan dapat diterbitkan ulang dari arsip."}
            </InfoBanner>
          </div>
        </>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gold-100 text-gold-800 border-gold-200"
      : rank === 2
        ? "bg-stone-100 text-stone-600 border-stone-200"
        : rank === 3
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-white text-ink/40 border-line";
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-extrabold ${styles}`}>
      {rank}
    </span>
  );
}
