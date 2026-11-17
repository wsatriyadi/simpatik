import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Info,
  Lock,
  Save,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import { ASSESSMENT_META, classNames } from "../../lib/format";
import type {
  AssessmentStatus,
  FormEmployee,
  FormStatus,
  ItemResult,
  PeriodStatus,
  Stats,
} from "../../lib/types";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  RingProgress,
  StatusBadge,
} from "../ui";

const ALASAN = ["Cuti", "Sakit", "Dinas Luar/Tugas", "Lainnya"];

interface EmployeeDetail extends FormEmployee {
  employee_id: number;
  form_id: number;
  unit_id: number;
  unit: string;
  periode_label: string;
  form_status: FormStatus;
  period_status: PeriodStatus;
  position: number;
  total: number;
  next_id: number | null;
  can_edit: boolean;
  read_only_reason: string | null;
  gelar_depan: string | null;
  gelar_belakang: string | null;
  pangkat: string | null;
  golongan: string | null;
  status_kepegawaian: string | null;
  foto_path: string | null;
  updated_at?: string | null;
}

interface DetailResponse {
  employee: EmployeeDetail;
  items: ItemResult[];
  form: {
    id: number;
    unit_nama: string;
    periode_label: string;
    status: FormStatus;
    period_status: PeriodStatus;
  };
  stats: Stats;
  sementara: boolean;
}

interface EmployeeAssessmentProps {
  employeeId: number | string;
  embedded?: boolean;
  onSaved?: () => void;
  onNext?: (nextId: number) => void;
  onFinish?: () => void;
}

export function EmployeeAssessment({
  employeeId,
  embedded = false,
  onSaved,
  onNext,
  onFinish,
}: EmployeeAssessmentProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, status, reload } = useApi<DetailResponse>(
    `/kabid/form-employees/${employeeId}`,
  );
  const [tidakDiperiksa, setTidakDiperiksa] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [values, setValues] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTidakDiperiksa(data.employee.status === "tidak_diperiksa");
    setAlasan(data.employee.alasan || "");
    setKeterangan(data.employee.keterangan || "");
    const initial: Record<number, boolean> = {};
    data.items.forEach((item) => {
      initial[item.id] = item.memenuhi === 0 ? false : true;
    });
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.employee.id, data?.employee.updated_at, data?.items]);

  const preview = useMemo<AssessmentStatus>(() => {
    if (tidakDiperiksa) return "tidak_diperiksa";
    const failed = Object.values(values).filter((value) => !value).length;
    return failed > 0 ? "tidak_patuh" : "patuh";
  }, [tidakDiperiksa, values]);

  const failedCount = Object.values(values).filter((value) => !value).length;

  if (loading && !data) {
    return (
      <div className={classNames("space-y-3", !embedded && "pt-2")}>
        <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
        <div className="h-44 animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-24 animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-white" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} forbidden={status === 403} />;
  if (!data) return null;

  const { employee, items, stats } = data;
  const readOnly = !employee.can_edit;
  const identityAvailable = Boolean(
    employee.jabatan || employee.pangkat || employee.status_kepegawaian,
  );
  const meta = ASSESSMENT_META[preview];

  const save = async (next: boolean) => {
    if (tidakDiperiksa && !alasan) {
      toast.error("Alasan wajib dipilih", "Pilih alasan pegawai tidak diperiksa.");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ next_id: number | null; assessment: { status: AssessmentStatus } }>(
        `/kabid/form-employees/${employee.id}`,
        {
          method: "PUT",
          body: {
            tidak_diperiksa: tidakDiperiksa,
            alasan: tidakDiperiksa ? alasan : null,
            keterangan,
            items: tidakDiperiksa
              ? []
              : Object.entries(values).map(([itemId, memenuhi]) => ({
                  id: Number(itemId),
                  memenuhi,
                })),
          },
        },
      );
      toast.success(
        "Penilaian tersimpan",
        `${employee.nama.split(",")[0]} · ${ASSESSMENT_META[result.assessment.status].label}`,
      );
      onSaved?.();

      if (next) {
        if (result.next_id) {
          if (embedded && onNext) {
            onNext(result.next_id);
          } else {
            navigate(`/kabid/pegawai/${result.next_id}`);
          }
        } else {
          toast.info("Seluruh pegawai sudah dinilai", "Periksa ringkasan formulir dan tandai selesai.");
          if (embedded && onFinish) {
            onFinish();
          } else {
            navigate(`/kabid/form/${employee.form_id}`);
          }
        }
      } else {
        await reload();
      }
    } catch (err) {
      toast.error("Penilaian gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const setAllPatuh = () => {
    const next: Record<number, boolean> = {};
    items.forEach((item) => {
      next[item.id] = true;
    });
    setValues(next);
    setTidakDiperiksa(false);
  };

  return (
    <div className={classNames("space-y-3.5", embedded && "pb-20")}>
      <div className="flex items-center justify-between gap-3">
        {embedded ? (
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink/30">
            Pegawai {employee.position} / {employee.total}
          </p>
        ) : (
          <Link
            to={`/kabid/unit/${employee.unit_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {employee.unit}
          </Link>
        )}
        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30">
          {embedded ? "Panel penilaian" : `Pegawai ${employee.position} / ${employee.total}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="relative overflow-hidden border-b border-line/70 bg-gradient-to-br from-brand-50 via-white to-white px-4 pb-4 pt-5">
          <div className="flex items-start gap-3.5">
            <Avatar
              name={employee.nama}
              src={employee.foto_path ? `/api/photos/${employee.employee_id}` : null}
              size="hero"
            />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge meta={ASSESSMENT_META[employee.status]} />
                {data.sementara ? <Badge tone="gold">Sementara</Badge> : null}
              </div>
              <h1 className="mt-2 text-[16px] font-extrabold leading-snug text-ink">
                {employee.nama}
              </h1>
              <p className="mt-0.5 font-mono text-[10px] text-ink/40">
                {employee.nip || "NIP belum tersedia"}
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-ink/55">
                <BriefcaseBusiness className="mt-0.5 h-3 w-3 shrink-0 text-ink/30" />
                {employee.jabatan || "Jabatan belum tersedia"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line/70 pt-3.5 text-[10px] sm:grid-cols-4">
            <InfoField
              label="Pangkat / Golongan"
              value={
                employee.pangkat
                  ? `${employee.pangkat}${employee.golongan ? ` (${employee.golongan})` : ""}`
                  : "—"
              }
            />
            <InfoField label="Status Kepegawaian" value={employee.status_kepegawaian || "—"} />
            <InfoField label="Unit Kerja" value={employee.unit} />
            <InfoField label="Periode" value={employee.periode_label} />
          </div>
          {!identityAvailable ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[9px] leading-relaxed text-amber-800">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              Identitas SIMPEG belum tersedia. Pegawai tetap dapat dinilai; lengkapi NIP melalui
              Admin untuk mengambil foto dan detail resmi.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30">
              Progres formulir unit
            </p>
            <p className="mt-0.5 text-[10px] text-ink/50">
              {stats.answered}/{stats.total} pegawai berstatus · {stats.belum} tersisa
            </p>
          </div>
          <div className="w-24">
            <RingProgress
              value={stats.answered_pct}
              size={48}
              stroke={5}
              color={stats.answered_pct >= 100 ? "#1f8a70" : "#b8892f"}
            >
              <span className="tabular text-[9px] font-extrabold text-ink/70">
                {stats.answered_pct}%
              </span>
            </RingProgress>
          </div>
        </div>
      </div>

      {readOnly ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[10px] leading-relaxed text-amber-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-bold">Formulir tidak dapat diubah</p>
            <p className="mt-0.5">{employee.read_only_reason || "Periode sudah ditutup."}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-extrabold text-ink">Tidak Diperiksa</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-ink/40">
              Untuk pegawai yang cuti, sakit, dinas luar, atau tidak dapat dinilai.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tidakDiperiksa}
            disabled={readOnly}
            onClick={() => setTidakDiperiksa((value) => !value)}
            className={classNames(
              "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
              tidakDiperiksa ? "border-amber-600 bg-amber-500" : "border-stone-400/60 bg-stone-300",
              readOnly && "opacity-50",
            )}
          >
            <span
              className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/5 transition-transform"
              style={{ left: 2, transform: tidakDiperiksa ? "translateX(20px)" : "none" }}
            />
          </button>
        </div>

        {tidakDiperiksa ? (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-ink/35">
              Alasan <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {ALASAN.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setAlasan(reason)}
                  className={classNames(
                    "rounded-lg border px-2.5 py-2 text-[10px] font-semibold transition",
                    alasan === reason
                      ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/15"
                      : "border-line bg-white text-ink/55 hover:border-amber-200",
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-ink/35">
              Pegawai Tidak Diperiksa tidak masuk pembilang maupun penyebut kepatuhan.
            </p>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
          <div>
            <p className="text-[12px] font-extrabold text-ink">Ceklist Pakaian Dinas</p>
            <p className="mt-0.5 text-[9px] text-ink/35">{items.length} item periksa</p>
          </div>
          <button
            type="button"
            disabled={readOnly || tidakDiperiksa}
            onClick={setAllPatuh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Semua Patuh
          </button>
        </div>

        <div
          className={classNames(
            "grid gap-2 p-3 transition md:grid-cols-2",
            (tidakDiperiksa || readOnly) && "opacity-50",
          )}
        >
          {items.map((item, index) => {
            const value = values[item.id] !== false;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-line/70 bg-[#fdfcf9] px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[9px] font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold leading-snug text-ink/80">
                      {item.nama}
                    </p>
                    {item.kelompok ? (
                      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-ink/25">
                        {item.kelompok}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={readOnly || tidakDiperiksa}
                    onClick={() => setValues((current) => ({ ...current, [item.id]: true }))}
                    className={classNames(
                      "flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-bold transition",
                      value
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-line bg-white text-ink/50 hover:border-emerald-200",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Memenuhi
                  </button>
                  <button
                    type="button"
                    disabled={readOnly || tidakDiperiksa}
                    onClick={() => setValues((current) => ({ ...current, [item.id]: false }))}
                    className={classNames(
                      "flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-bold transition",
                      !value
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-line bg-white text-ink/50 hover:border-red-200",
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    Tidak Memenuhi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={classNames(
          "flex items-start gap-2.5 rounded-xl border px-3.5 py-3",
          preview === "patuh" && !tidakDiperiksa
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : preview === "tidak_patuh"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900",
        )}
      >
        {preview === "patuh" && !tidakDiperiksa ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        ) : preview === "tidak_patuh" ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold">
            Hasil: {meta.label}
            {tidakDiperiksa ? "" : preview === "tidak_patuh" ? ` (${failedCount} item)` : ""}
          </p>
          <p className="mt-0.5 text-[9px] leading-relaxed opacity-70">
            {tidakDiperiksa
              ? "Pegawai tidak masuk perhitungan kepatuhan."
              : preview === "patuh"
                ? "Seluruh item periksa terpenuhi."
                : "Satu item atau lebih tidak terpenuhi; pegawai dihitung Tidak Patuh."}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
        <label htmlFor={`keterangan-${employee.id}`} className="field-label">
          Keterangan tambahan{" "}
          <span className="normal-case tracking-normal text-ink/30">(opsional)</span>
        </label>
        <textarea
          id={`keterangan-${employee.id}`}
          value={keterangan}
          onChange={(event) => setKeterangan(event.target.value)}
          disabled={readOnly}
          rows={3}
          maxLength={500}
          placeholder="Catatan item yang dilanggar atau keterangan lainnya…"
          className="input-base resize-none text-xs"
        />
        <p className="mt-1.5 text-right text-[9px] text-ink/25">{keterangan.length}/500</p>
      </div>

      <div className="sticky bottom-[86px] z-20 rounded-2xl border border-line bg-white/95 p-2.5 shadow-lift backdrop-blur sm:bottom-[92px] lg:bottom-4">
        {readOnly ? (
          embedded ? (
            <div className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-stone-100 text-xs font-semibold text-ink/45">
              <Lock className="h-4 w-4" /> Hanya dapat dilihat
            </div>
          ) : (
            <Link
              to={`/kabid/unit/${employee.unit_id}`}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-800 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke daftar pegawai
            </Link>
          )
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              loading={saving}
              onClick={() => save(false)}
              icon={<Save className="h-4 w-4" />}
            >
              Simpan
            </Button>
            <Button
              className="flex-[1.35] whitespace-nowrap px-3 text-[13px]"
              loading={saving}
              onClick={() => save(true)}
            >
              Simpan &amp; Berikutnya
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 px-1 text-[9px] leading-relaxed text-ink/30">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Setiap simpan langsung menjadi draf di server. Anda dapat melanjutkan dari perangkat lain
        selama periode belum ditutup.
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-ink/25">{label}</p>
      <p className="mt-0.5 leading-snug text-ink/60">{value}</p>
    </div>
  );
}
