import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Lock,
  Pencil,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { downloadFile } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import {
  ASSESSMENT_META,
  FORM_META,
  classNames,
  formatDate,
} from "../../lib/format";
import type {
  AssessmentStatus,
  FormEmployee,
  FormStatus,
  HistoryEntry,
  Item,
  PeriodStatus,
  Stats,
  Violation,
} from "../../lib/types";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  SectionCard,
  StatusBadge,
  TableWrap,
} from "../../components/ui";

interface FormBase {
  id: number;
  unit_nama: string;
  unit: string;
  bulan: number;
  tahun: number;
  periode_label: string;
  status: FormStatus;
  period_status: PeriodStatus;
  kabid_nama: string | null;
  kabid_jabatan: string | null;
  kabid_nip: string | null;
  tanggal_pemeriksaan: string | null;
  completed_at: string | null;
  penanda_tangan_nama: string | null;
  penanda_tangan_nip: string | null;
  penanda_tangan_jabatan: string | null;
  is_locked: boolean;
}

interface Row extends FormEmployee {
  employee_id: number;
  items: Record<string, 0 | 1>;
  dinilai_oleh_nama?: string | null;
}

interface DetailResponse {
  form: FormBase;
  items: Item[];
  rows: Row[];
  stats: Stats;
  violations: Violation[];
  history: HistoryEntry[];
  locked: boolean;
}

export default function AdminFormDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<DetailResponse>(id ? `/admin/forms/${id}` : null);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(50);
  const [downloading, setDownloading] = useState<string | null>(null);
  useDocumentTitle(data ? `Formulir ${data.form.unit_nama}` : "Detail Formulir");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.rows || [];
    return (data?.rows || []).filter(
      (row) => row.nama.toLowerCase().includes(q) || (row.nip || "").includes(q),
    );
  }, [data?.rows, query]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { form, stats, items, history, violations } = data;
  const sementara = form.period_status !== "ditutup";
  const download = async (type: "excel" | "pdf") => {
    setDownloading(type);
    try {
      const ext = type === "excel" ? "xlsx" : "pdf";
      await downloadFile(
        `/reports/form/${form.id}/${type}`,
        `Laporan-${form.unit_nama}-${form.periode_label}.${ext}`,
      );
    } catch (err) {
      toast.error("Laporan gagal diunduh", err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(null);
    }
  };

  const signerName = form.penanda_tangan_nama || form.kabid_nama || "Belum ada penanda tangan";
  const signerNip = form.penanda_tangan_nip || form.kabid_nip;
  const signerJabatan = form.penanda_tangan_jabatan || form.kabid_jabatan;

  return (
    <div>
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45 transition hover:text-brand-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Kembali ke dasbor
      </Link>

      <PageHeader
        eyebrow={
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {form.periode_label}
          </>
        }
        title={form.unit_nama}
        description="Tampilan baca-saja formulir periode. Admin tidak mengubah isi ceklist; perbaikan dilakukan oleh Kabid pemilik formulir selama periode belum ditutup."
        actions={
          <>
            <Button
              variant="outline"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              loading={downloading === "excel"}
              onClick={() => download("excel")}
            >
              Excel
            </Button>
            <Button
              variant="outline"
              icon={<FileText className="h-4 w-4" />}
              loading={downloading === "pdf"}
              onClick={() => download("pdf")}
            >
              PDF
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge meta={FORM_META[form.status]} />
        {sementara ? <Badge tone="gold">SEMENTARA</Badge> : <Badge tone="green">FINAL</Badge>}
        <span className="text-[11px] text-ink/35">
          {form.kabid_nama || "Belum ada Kabid"} · {stats.total} pegawai
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MiniStat label="Diperiksa" value={stats.diperiksa} />
        <MiniStat label="Patuh" value={stats.patuh} tone="green" />
        <MiniStat label="Tidak Patuh" value={stats.tidak_patuh} tone="red" />
        <MiniStat label="Tidak Diperiksa" value={stats.tidak_diperiksa} tone="amber" />
        <MiniStat label="Kepatuhan" value={`${stats.pct}%`} tone="brand" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_330px]">
        <SectionCard
          title="Ceklist pegawai"
          subtitle={`${stats.answered} dari ${stats.total} pegawai sudah berstatus`}
          action={
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setVisible(50);
              }}
              placeholder="Cari nama atau NIP…"
              className="w-[210px]"
            />
          }
          bodyClassName="p-0"
        >
          {filtered.length ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-2.5 text-[10px] text-ink/40">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  Memenuhi
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <X className="h-2.5 w-2.5" />
                  </span>
                  Tidak memenuhi
                </span>
                <span className="text-ink/25">·</span>
                <span>{filtered.length} pegawai ditampilkan</span>
              </div>
              <TableWrap>
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="w-10 px-3 py-3 text-center">No</th>
                      <th className="px-3 py-3">Pegawai</th>
                      {items.map((item, index) => (
                        <th
                          key={item.id}
                          className="w-[52px] px-1 py-2 text-center"
                          title={`${item.nama}${item.kelompok ? ` · ${item.kelompok}` : ""}`}
                        >
                          <span className="mx-auto block max-w-[48px] text-[8px] leading-tight">
                            {abbr(item.nama, index)}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-3">Hasil</th>
                      <th className="px-3 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filtered.slice(0, visible).map((row, index) => (
                      <tr key={row.id} className="transition hover:bg-brand-50/25">
                        <td className="px-3 py-2.5 text-center text-[10px] tabular text-ink/35">
                          {index + 1}
                        </td>
                        <td className="max-w-[230px] px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={row.nama} src={row.foto_path ? `/api/photos/${row.employee_id}` : null} size="xs" />
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-ink/80">{row.nama}</p>
                              <p className="text-[9px] text-ink/35">{row.nip || "Tanpa NIP"}</p>
                            </div>
                          </div>
                        </td>
                        {items.map((item) => {
                          const value = row.items[item.id];
                          return (
                            <td key={item.id} className="px-1 py-2.5 text-center">
                              <Mark value={value} status={row.status} />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5">
                          <StatusBadge meta={ASSESSMENT_META[row.status]} />
                        </td>
                        <td className="max-w-[250px] px-3 py-2.5">
                          <p className="truncate text-[10px] text-ink/50" title={row.keterangan || undefined}>
                            {row.keterangan ||
                              (row.status === "tidak_diperiksa"
                                ? row.alasan
                                : row.violated.length
                                  ? `Tidak memenuhi: ${row.violated.join(", ")}`
                                  : "—")}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              {filtered.length > visible ? (
                <div className="border-t border-line px-4 py-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setVisible((value) => value + 50)}>
                    Tampilkan {Math.min(50, filtered.length - visible)} pegawai lagi
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={Search}
              title="Pegawai tidak ditemukan"
              description="Coba kata kunci lain."
              action={<Button size="sm" variant="outline" onClick={() => setQuery("")}>Reset pencarian</Button>}
            />
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Penanda tangan" subtitle="Cuplikan identitas saat formulir ditandai selesai.">
            <div className="flex items-start gap-3">
              <Avatar name={signerName} size="md" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-snug text-ink">{signerName}</p>
                <p className="mt-0.5 text-[10px] text-ink/40">{signerJabatan || "—"}</p>
                {signerNip ? <p className="mt-1 text-[10px] text-ink/40">NIP. {signerNip}</p> : null}
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink/40">Tanggal pemeriksaan</span>
                <span className="text-right font-semibold text-ink/70">
                  {form.tanggal_pemeriksaan ? formatDate(form.tanggal_pemeriksaan, "medium") : "Belum ditandai"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink/40">Status periode</span>
                <Badge tone={form.period_status === "ditutup" ? "green" : "gold"}>
                  {form.period_status === "ditutup" ? "Final" : "Sementara"}
                </Badge>
              </div>
            </div>
            {!form.penanda_tangan_nama ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800">
                Formulir belum ditandai selesai. Nama di atas adalah Kabid penanggung jawab saat ini.
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Riwayat formulir" subtitle="Jejak perubahan yang tercatat sistem.">
            {history.length ? (
              <ol className="relative space-y-4 border-l border-line pl-4">
                {history.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-white text-ink/40">
                      {historyIcon(entry.kejadian)}
                    </span>
                    <p className="text-[11px] font-semibold leading-snug text-ink/75">{entry.kejadian}</p>
                    <p className="mt-0.5 text-[9px] text-ink/35">
                      {formatDate(entry.pada, "datetime")} · {entry.oleh_nama || "Sistem"}
                    </p>
                    {entry.catatan ? (
                      <p className="mt-1 rounded-md bg-[#fbfaf7] px-2 py-1.5 text-[9px] leading-relaxed text-ink/45">
                        {entry.catatan}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-ink/40">Belum ada riwayat.</p>
            )}
          </SectionCard>

          <SectionCard title="Pelanggaran terbanyak" subtitle="Pada formulir ini.">
            {violations.length ? (
              <div className="space-y-2">
                {violations.map((violation) => (
                  <div
                    key={violation.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-gold-100 bg-gold-50/60 px-2.5 py-2"
                  >
                    <p className="text-[10px] leading-snug text-gold-900">{violation.nama}</p>
                    <span className="shrink-0 text-[10px] font-bold text-gold-700">{violation.jumlah}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-ink/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Tidak ada pelanggaran.
              </div>
            )}
          </SectionCard>

          <div className="rounded-xl border border-line bg-[#fbfaf7] px-3.5 py-3 text-[10px] leading-relaxed text-ink/45">
            <p className="mb-1 flex items-center gap-1.5 font-bold text-ink/60">
              <Lock className="h-3 w-3" /> Baca-saja
            </p>
            Admin tidak dapat mengubah isi formulir. Minta Kabid pemilik formulir melakukan
            perbaikan selama periode belum ditutup.
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "slate" | "green" | "red" | "amber" | "brand";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-600"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "brand"
            ? "text-brand-800"
            : "text-ink";
  return (
    <div className="card px-4 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/40">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular ${color}`}>{value}</p>
    </div>
  );
}

function Mark({ value, status }: { value?: 0 | 1; status: AssessmentStatus }) {
  if (status === "tidak_diperiksa" || status === "belum" || value === undefined) {
    return <span className="text-[10px] text-ink/20">–</span>;
  }
  if (value === 1) {
    return (
      <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-red-600">
      <X className="h-3 w-3" />
    </span>
  );
}

function abbr(name: string, index: number) {
  const map: Record<string, string> = {
    "Pakaian dinas sesuai hari": "Pakaian",
    "Rapi, bersih, sopan, dan layak pakai": "Rapi",
    "ID Card": "ID Card",
    "Name Tag": "Name Tag",
    Korpri: "Korpri",
    "PIN Jujur": "PIN",
    "Lambang Pemda": "Lambang",
    "Sepatu sesuai ketentuan (hitam/coklat gelap)": "Sepatu",
  };
  return map[name] || `Item ${index + 1}`;
}

function historyIcon(event: string) {
  if (event.includes("Selesai")) return <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />;
  if (event.includes("Diubah")) return <Pencil className="h-2.5 w-2.5 text-amber-600" />;
  if (event.includes("ditutup")) return <Lock className="h-2.5 w-2.5 text-brand-700" />;
  if (event.includes("Pengguna")) return <UserRound className="h-2.5 w-2.5" />;
  return <Clock3 className="h-2.5 w-2.5" />;
}
