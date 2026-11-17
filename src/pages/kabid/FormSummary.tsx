import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  PenLine,
  Users,
} from "lucide-react";
import { api, downloadFile } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import {
  FORM_META,
  formatDate,
} from "../../lib/format";
import type {
  FormStatus,
  HistoryEntry,
  PeriodStatus,
  Stats,
  Violation,
} from "../../lib/types";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ProgressBar,
  RingProgress,
  StatusBadge,
} from "../../components/ui";

interface FormResponse {
  form: {
    id: number;
    unit_id: number;
    unit_nama: string;
    periode_label: string;
    status: FormStatus;
    period_status: PeriodStatus;
    tanggal_pemeriksaan: string | null;
    penanda_tangan_nama: string | null;
    penanda_tangan_nip: string | null;
    penanda_tangan_jabatan: string | null;
    completed_at: string | null;
  };
  stats: Stats;
  violations: Violation[];
  history: HistoryEntry[];
  can_fill: boolean;
  sementara: boolean;
  can_complete: boolean;
}

export default function KabidFormSummary() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<FormResponse>(
    id ? `/kabid/forms/${id}` : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  useDocumentTitle(data ? `Ringkasan ${data.form.unit_nama}` : "Ringkasan Formulir");

  if (loading && !data) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-56 animate-pulse rounded-3xl border border-line bg-white" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-line bg-white" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { form, stats, violations, history } = data;
  const locked = form.period_status === "ditutup" || form.status === "terkunci";
  const complete = Boolean(form.completed_at);

  const download = async (type: "excel" | "pdf") => {
    setDownloading(type);
    try {
      await downloadFile(
        `/reports/form/${form.id}/${type}`,
        `Laporan-${form.unit_nama}-${form.periode_label}.${type === "excel" ? "xlsx" : "pdf"}`,
      );
    } catch (err) {
      toast.error("Laporan gagal diunduh", err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(null);
    }
  };

  const markComplete = async () => {
    setCompleting(true);
    try {
      await api(`/kabid/forms/${form.id}/complete`, { method: "POST" });
      toast.success(
        "Formulir ditandai selesai",
        `Tanggal pemeriksaan ${formatDate(new Date().toISOString(), "long")} tersimpan otomatis.`,
      );
      setConfirmOpen(false);
      await reload();
    } catch (err) {
      toast.error("Formulir gagal ditandai selesai", err instanceof Error ? err.message : undefined);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/kabid/unit/${form.unit_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {form.unit_nama}
        </Link>
        <Link
          to={`/kabid/unit/${form.unit_id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-brand-700 shadow-sm"
        >
          <Users className="h-3 w-3" /> Daftar pegawai
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-brand-800 bg-brand-950 p-5 text-white shadow-lift brand-pattern">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{form.periode_label}</Badge>
          <StatusBadge meta={FORM_META[form.status]} />
          {data.sementara ? (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/60">
              Sementara
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-[19px] font-extrabold leading-tight">{form.unit_nama}</h1>
        <div className="mt-5 flex items-center gap-5">
          <RingProgress value={stats.pct} size={122} stroke={10} trackColor="rgba(255,255,255,0.14)">
            <span className="tabular text-[26px] font-extrabold leading-none text-white">
              {stats.pct}%
            </span>
            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-brand-100/45">
              Kepatuhan
            </span>
          </RingProgress>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-brand-100/45">Pengisian</span>
              <span className="font-bold">
                {stats.answered}/{stats.total}
              </span>
            </div>
            <ProgressBar
              value={stats.answered_pct}
              tone={stats.answered === stats.total ? "green" : "gold"}
              size="sm"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                  Patuh
                </p>
                <p className="text-sm font-extrabold text-emerald-300">{stats.patuh}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                  Tidak patuh
                </p>
                <p className="text-sm font-extrabold text-red-300">{stats.tidak_patuh}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                  Tidak diperiksa
                </p>
                <p className="text-sm font-extrabold text-gold-300">{stats.tidak_diperiksa}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-brand-100/35">
                  Belum dinilai
                </p>
                <p className="text-sm font-extrabold text-white/70">{stats.belum}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SummaryTile label="Total pegawai" value={stats.total} />
        <SummaryTile label="Diperiksa" value={stats.diperiksa} />
        <SummaryTile label="Patuh" value={stats.patuh} tone="green" />
        <SummaryTile label="Tidak patuh" value={stats.tidak_patuh} tone="red" />
        <SummaryTile label="Tidak diperiksa" value={stats.tidak_diperiksa} tone="amber" />
        <SummaryTile label="Belum dinilai" value={stats.belum} tone={stats.belum ? "amber" : "green"} />
      </div>

      {violations.length ? (
        <div className="rounded-2xl border border-gold-200 bg-gold-50/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-gold-900">
            <AlertTriangle className="h-3.5 w-3.5" /> Pelanggaran terbanyak unit
          </p>
          <div className="mt-2 space-y-1.5">
            {violations.map((violation) => (
              <div
                key={violation.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5"
              >
                <p className="text-[10px] leading-snug text-gold-900/80">{violation.nama}</p>
                <span className="shrink-0 text-[10px] font-bold text-gold-700">
                  {violation.jumlah}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[12px] font-extrabold text-ink">Status formulir</h2>
          <StatusBadge meta={FORM_META[form.status]} />
        </div>
        {complete ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[10px] leading-relaxed text-emerald-800">
            <p className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Formulir sudah ditandai selesai
            </p>
            <p className="mt-1">
              Tanggal pemeriksaan{" "}
              <span className="font-semibold">
                {form.tanggal_pemeriksaan
                  ? formatDate(form.tanggal_pemeriksaan, "long")
                  : "—"}
              </span>
              .
            </p>
            {form.penanda_tangan_nama ? (
              <p className="mt-1 text-emerald-700/70">
                Penanda tangan: {form.penanda_tangan_nama}
                {form.penanda_tangan_nip ? ` · NIP. ${form.penanda_tangan_nip}` : ""}
              </p>
            ) : null}
            <p className="mt-2 text-[9px] text-emerald-700/60">
              {locked
                ? "Periode sudah ditutup. Formulir dan laporan final tidak dapat diubah."
                : "Bila Anda mengubah salah satu pegawai, status formulir kembali menjadi Sedang Diisi dan perlu ditandai selesai kembali."}
            </p>
          </div>
        ) : locked ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-bold">Periode ditutup sebelum formulir ditandai selesai</p>
              <p className="mt-0.5">
                Formulir terkunci permanen. Angka pada laporan final mengikuti penilaian yang
                tersimpan; formulir ini tidak memiliki tanggal pemeriksaan dan penanda tangan.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div
              className={`rounded-xl border px-3.5 py-3 text-[10px] leading-relaxed ${
                stats.belum === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {stats.belum === 0 ? (
                <p className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Seluruh pegawai sudah berstatus
                </p>
              ) : (
                <p className="flex items-center gap-1.5 font-bold">
                  <Clock3 className="h-3.5 w-3.5" /> {stats.belum} pegawai belum dinilai
                </p>
              )}
              <p className="mt-1">
                {stats.belum === 0
                  ? "Tandai formulir selesai untuk mencatat tanggal pemeriksaan dan penanda tangan laporan."
                  : "Formulir hanya dapat ditandai selesai setelah seluruh pegawai memiliki status Patuh, Tidak Patuh, atau Tidak Diperiksa."}
              </p>
            </div>
            {stats.belum > 0 ? (
              <Link
                to={`/kabid/unit/${form.unit_id}`}
                className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 text-[11px] font-bold text-brand-800"
              >
                <PenLine className="h-3.5 w-3.5" /> Lanjutkan penilaian
              </Link>
            ) : (
              <Button
                className="mt-2 w-full"
                variant="gold"
                onClick={() => setConfirmOpen(true)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Tandai Formulir Selesai
              </Button>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <Button
            variant="outline"
            size="sm"
            loading={downloading === "excel"}
            onClick={() => download("excel")}
            icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
          >
            Unduh Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            loading={downloading === "pdf"}
            onClick={() => download("pdf")}
            icon={<FileText className="h-3.5 w-3.5" />}
          >
            Unduh PDF
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[8px] leading-relaxed text-ink/30">
          {data.sementara ? (
            <>
              <Download className="h-2.5 w-2.5" />
              Laporan periode berjalan mencantumkan cap SEMENTARA pada setiap halaman.
            </>
          ) : (
            <>
              <Lock className="h-2.5 w-2.5" />
              Laporan final periode yang telah ditutup dan tidak dapat diubah.
            </>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <h2 className="text-[12px] font-extrabold text-ink">Riwayat formulir</h2>
        {history.length ? (
          <ol className="mt-3 space-y-3 border-l border-line pl-3.5">
            {history.slice(-6).map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full border border-white bg-brand-300 ring-2 ring-brand-50" />
                <p className="text-[10px] font-semibold leading-snug text-ink/65">{entry.kejadian}</p>
                <p className="mt-0.5 text-[8px] text-ink/30">
                  {formatDate(entry.pada, "datetime")} · {entry.oleh_nama || "Sistem"}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[10px] text-ink/35">Belum ada riwayat.</p>
        )}
      </div>

      {!locked ? (
        <p className="px-1 text-[9px] leading-relaxed text-ink/30">
          Formulir yang sudah ditandai selesai masih dapat diubah selama periode belum ditutup.
          Setiap perubahan mengembalikan status menjadi Sedang Diisi.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={markComplete}
        title="Tandai formulir selesai?"
        description="Tanggal pemeriksaan dicatat otomatis dan nama Anda disimpan sebagai penanda tangan laporan."
        confirmLabel="Ya, Tandai Selesai"
        tone="primary"
        loading={completing}
      >
        <div className="space-y-2 text-[11px] leading-relaxed text-ink/60">
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-ink/45">Unit kerja</span>
            <span className="font-semibold text-ink/75">{form.unit_nama}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-ink/45">Tanggal pemeriksaan</span>
            <span className="font-semibold text-ink/75">
              {formatDate(new Date().toISOString(), "long")}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-ink/45">Penanda tangan</span>
            <span className="max-w-[190px] truncate text-right font-semibold text-ink/75">
              {form.penanda_tangan_nama || "Anda"}
            </span>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
            Angka rekap masih SEMENTARA sampai Admin menutup periode.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-600"
        : tone === "amber"
          ? "text-amber-700"
          : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-3 shadow-sm">
      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink/30">{label}</p>
      <p className={`tabular mt-1 text-lg font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
