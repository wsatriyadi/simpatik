import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { api, downloadFile } from "../../lib/api";
import { useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import {
  Badge,
  Button,
  ConfirmDialog,
  InfoBanner,
  PageHeader,
  SectionCard,
  Switch,
  TableWrap,
} from "../../components/ui";

interface PersonRow {
  unit: string;
  nama: string;
  nip: string;
  row: number;
  reason?: string;
  pemilik_lama?: string;
}

interface ImportReport {
  sheets: Array<{ nama: string; jumlah: number }>;
  skipped: Array<{ sheet: string; reason: string }>;
  totals: {
    units: number;
    employees: number;
    empty_nip: number;
    irregular: number;
    duplicates: number;
    existing: number;
    simpeg_checked: number;
    simpeg_not_found: number;
  };
  duplicates: {
    total: number;
    truncated: boolean;
    items: Array<{
      nip: string;
      pemilik: Array<{ unit: string; nama: string; nip: string; row: number }>;
    }>;
  };
  empty: { total: number; truncated: boolean; items: PersonRow[] };
  irregular: { total: number; truncated: boolean; items: PersonRow[] };
  existing: { total: number; truncated: boolean; items: PersonRow[] };
  simpeg: {
    checked: boolean;
    reachable: boolean | null;
    checked_count: number;
    not_found_total: number;
    note: string;
    not_found: { total: number; truncated: boolean; items: PersonRow[] };
  };
}

export default function AdminImport() {
  useDocumentTitle("Impor Pegawai");
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checkSimpeg, setCheckSimpeg] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);

  const chooseFile = (selected: File | null) => {
    if (!selected) return;
    if (!/\.(xlsx|xlsm)$/i.test(selected.name)) {
      toast.error("Format berkas tidak didukung", "Gunakan berkas .xlsx atau .xlsm.");
      return;
    }
    setFile(selected);
    setReport(null);
    setBatchId(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    chooseFile(event.dataTransfer.files?.[0] || null);
  };

  const validate = async () => {
    if (!file) return;
    setValidating(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("checkSimpeg", String(checkSimpeg));
      const result = await api<{ batchId: string; report: ImportReport }>(
        "/admin/import/validate",
        { method: "POST", body: form },
      );
      setReport(result.report);
      setBatchId(result.batchId);
      toast.success(
        "Berkas selesai diperiksa",
        `${result.report.totals.employees} baris pegawai pada ${result.report.totals.units} unit.`,
      );
    } catch (err) {
      toast.error("Berkas gagal diperiksa", err instanceof Error ? err.message : undefined);
    } finally {
      setValidating(false);
    }
  };

  const commit = async () => {
    if (!batchId) return;
    setCommitting(true);
    try {
      const result = await api<{
        employees_inserted: number;
        employees_skipped: number;
        units_created: number;
        sync_queued: number;
      }>("/admin/import/commit", { method: "POST", body: { batchId } });
      toast.success(
        "Impor berhasil",
        `${result.employees_inserted} pegawai ditambahkan · ${result.employees_skipped} dilewati` +
          (result.sync_queued ? ` · sinkronisasi SIMPEG untuk ${result.sync_queued} pegawai dimulai.` : ""),
      );
      setConfirmOpen(false);
      navigate("/admin/employees");
    } catch (err) {
      toast.error("Impor gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setCommitting(false);
    }
  };

  const warningCount = report
    ? report.totals.duplicates +
      report.totals.empty_nip +
      report.totals.irregular +
      report.totals.simpeg_not_found
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Data induk"
        title="Impor Pegawai dari Excel"
        description="Unggah berkas dengan satu tab per unit kerja dan kolom No, Nama, NIP. Sistem menampilkan laporan validasi sebelum data disimpan."
        actions={
          <Button
            variant="outline"
            icon={<Download className="h-4 w-4" />}
            onClick={() =>
              downloadFile("/admin/import/template", "Template-Impor-SIMPATIK.xlsx").catch((err) =>
                toast.error("Template gagal diunduh", err.message),
              )
            }
          >
            Unduh Template
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Berkas Excel"
          subtitle="Format formulir asal: satu lembar kerja mewakili satu unit kerja."
        >
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
              dragOver
                ? "border-brand-400 bg-brand-50"
                : "border-line bg-[#fbfaf7] hover:border-brand-200 hover:bg-brand-50/30"
            }`}
          >
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-100 bg-white text-brand-600 shadow-sm">
              <UploadCloud className="h-6 w-6" />
            </span>
            <p className="text-sm font-bold text-ink">Tarik berkas ke sini atau pilih berkas</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-ink/45">
              Maksimal 20 MB. Setiap tab harus memiliki baris judul dengan kolom{" "}
              <span className="font-semibold">Nama</span> dan{" "}
              <span className="font-semibold">NIP</span>.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Pilih Berkas
            </Button>
          </div>

          {file ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink">{file.name}</p>
                <p className="text-[10px] text-ink/40">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setReport(null);
                  setBatchId(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-lg p-1.5 text-ink/35 hover:bg-white hover:text-red-600"
                aria-label="Hapus berkas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Switch
              checked={checkSimpeg}
              onChange={setCheckSimpeg}
              label="Periksa NIP ke SIMPEG"
              description="Mencocokkan NIP ke API SIMPEG. Dapat memakan waktu untuk ratusan pegawai."
            />
            <Button
              onClick={validate}
              disabled={!file}
              loading={validating}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            >
              {validating ? "Memeriksa berkas…" : "Periksa Berkas"}
            </Button>
          </div>
          {validating && checkSimpeg ? (
            <p className="mt-3 text-[11px] leading-relaxed text-ink/40">
              Pemeriksaan SIMPEG dijalankan dengan batas waktu. Bila API lambat atau tidak dapat
              dijangkau, laporan tetap ditampilkan dan pemeriksaan ditandai belum lengkap.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Panduan singkat" subtitle="Agar laporan validasi mudah dibaca.">
          <ol className="space-y-3 text-xs leading-relaxed text-ink/60">
            {[
              "Gunakan satu tab per unit. Nama tab otomatis menjadi nama unit kerja.",
              "Baris judul memuat kolom Nama dan NIP. Kolom No opsional.",
              "NIP sebaiknya disimpan sebagai teks 18 digit agar tidak berubah format.",
              "NIP kosong, duplikat, dan tidak lengkap tetap dapat diimpor dengan peringatan.",
              "Pegawai dengan NIP yang sudah ada pada unit yang sama akan dilewati saat penyimpanan.",
            ].map((text, idx) => (
              <li key={text} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-800">
                  {idx + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <InfoBanner tone="gold" icon={ShieldAlert} title="Data awal berasal dari berkas asli">
              Setelah impor, jalankan Sinkronkan SIMPEG untuk mengambil foto. NIP tidak lengkap
              akan tampil dengan inisial sampai diperbaiki pada data induk.
            </InfoBanner>
          </div>
        </SectionCard>
      </div>

      {report ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Laporan Validasi</h2>
              <p className="mt-0.5 text-xs text-ink/45">
                {report.totals.units} unit · {report.totals.employees} baris pegawai diperiksa
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReport(null);
                  setBatchId(null);
                  setFile(null);
                }}
              >
                Batalkan
              </Button>
              <Button
                variant="gold"
                onClick={() => setConfirmOpen(true)}
                icon={<CheckCircle2 className="h-4 w-4" />}
              >
                Simpan Hasil Impor
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">Unit terbaca</p>
              <p className="mt-1 text-2xl font-extrabold tabular">{report.totals.units}</p>
              <p className="mt-1 text-[9px] text-ink/30">{report.totals.employees} pegawai</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">Sudah ada</p>
              <p className="mt-1 text-2xl font-extrabold tabular text-sky-700">{report.totals.existing}</p>
              <p className="mt-1 text-[9px] text-ink/30">akan dilewati</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">Peringatan</p>
              <p className="mt-1 text-2xl font-extrabold tabular text-amber-700">{warningCount}</p>
              <p className="mt-1 text-[9px] text-ink/30">tetap dapat diimpor</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">Diperiksa SIMPEG</p>
              <p className="mt-1 text-2xl font-extrabold tabular">
                {report.simpeg.checked_count}
              </p>
              <p className="mt-1 text-[9px] text-ink/30">
                {report.simpeg.not_found_total} tidak ditemukan
              </p>
            </div>
          </div>

          {report.simpeg.checked && report.simpeg.reachable === false ? (
            <InfoBanner tone="red" icon={AlertTriangle} title="SIMPEG tidak dapat dijangkau">
              Pemeriksaan NIP ke SIMPEG tidak selesai. Impor tetap dapat dilanjutkan; jalankan
              sinkronisasi setelah server SIMPEG dapat diakses.
            </InfoBanner>
          ) : null}
          {report.simpeg.note ? (
            <InfoBanner tone="gold" icon={AlertTriangle} title="Catatan pemeriksaan SIMPEG">
              {report.simpeg.note}
            </InfoBanner>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Rekap per unit"
              subtitle="Jumlah baris pada setiap tab."
              bodyClassName="p-0"
            >
              <TableWrap>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-2.5">Unit Kerja</th>
                      <th className="w-24 px-4 py-2.5 text-right">Pegawai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {report.sheets.map((sheet) => (
                      <tr key={sheet.nama}>
                        <td className="px-4 py-2.5 text-xs font-medium text-ink/70">{sheet.nama}</td>
                        <td className="px-4 py-2.5 text-right text-xs tabular font-semibold">
                          {sheet.jumlah}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              {report.skipped.length ? (
                <div className="border-t border-line px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">
                    Tab dilewati
                  </p>
                  {report.skipped.map((sheet) => (
                    <p key={sheet.sheet} className="text-[11px] text-ink/50">
                      <span className="font-semibold text-ink/70">{sheet.sheet}</span> — {sheet.reason}
                    </p>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="NIP duplikat"
              subtitle={`${report.totals.duplicates} NIP muncul lebih dari sekali.`}
              action={
                <Badge tone={report.totals.duplicates ? "amber" : "green"}>
                  {report.totals.duplicates ? "Perlu perhatian" : "Tidak ada"}
                </Badge>
              }
              bodyClassName="p-0"
            >
              {report.duplicates.items.length ? (
                <div className="max-h-[330px] space-y-2 overflow-y-auto p-4 scroll-thin">
                  {report.duplicates.items.map((duplicate) => (
                    <div key={duplicate.nip} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
                      <p className="font-mono text-[11px] font-bold text-amber-900">{duplicate.nip}</p>
                      <div className="mt-1 space-y-0.5">
                        {duplicate.pemilik.map((owner, idx) => (
                          <p key={`${owner.unit}-${idx}`} className="text-[10px] text-amber-800/70">
                            {owner.nama} · {owner.unit}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-6 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Tidak ditemukan NIP duplikat.
                </div>
              )}
            </SectionCard>

            <PersonList
              title="Tanpa NIP"
              description={`${report.totals.empty_nip} pegawai tidak memiliki NIP. Tetap dapat dinilai tanpa foto SIMPEG.`}
              items={report.empty.items}
              tone="amber"
            />
            <PersonList
              title="Format NIP tidak lengkap"
              description={`${report.totals.irregular} NIP tidak berformat 18 digit. Perbaiki pada data induk.`}
              items={report.irregular.items}
              tone="red"
              showReason
            />
            <PersonList
              title="Sudah terdaftar"
              description={`${report.totals.existing} baris akan dilewati karena NIP/nama sudah ada pada unit yang sama.`}
              items={report.existing.items}
              tone="slate"
              showOwner
            />
            <PersonList
              title="Tidak ditemukan di SIMPEG"
              description={
                report.simpeg.checked
                  ? `${report.totals.simpeg_not_found} NIP tidak ditemukan pada API SIMPEG.`
                  : "Pemeriksaan SIMPEG tidak dijalankan."
              }
              items={report.simpeg.not_found.items}
              tone="slate"
              emptyText="Tidak ada data atau pemeriksaan SIMPEG tidak dijalankan."
            />
          </div>

          <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-lift backdrop-blur">
            <div>
              <p className="text-xs font-bold text-ink">
                {report.totals.employees} baris siap diproses
              </p>
              <p className="mt-0.5 text-[10px] text-ink/45">
                Data yang sudah ada akan dilewati. Tidak ada data lama yang dihapus.
              </p>
            </div>
            <Button onClick={() => setConfirmOpen(true)} icon={<CheckCircle2 className="h-4 w-4" />}>
              Simpan Hasil Impor
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={commit}
        title="Simpan hasil impor?"
        description="Data akan digabungkan ke data induk. Pegawai dengan NIP/nama yang sudah ada pada unit yang sama dilewati."
        confirmLabel="Simpan ke Data Induk"
        tone="primary"
        loading={committing}
      >
        {report ? (
          <div className="space-y-2 text-xs leading-relaxed text-ink/60">
            <p>
              <span className="font-bold text-ink">{report.totals.employees}</span> baris dari{" "}
              <span className="font-bold text-ink">{report.totals.units}</span> unit akan diproses.
            </p>
            <p>
              <span className="font-bold text-ink">{report.totals.existing}</span> baris sudah ada
              dan akan dilewati. Sinkronisasi SIMPEG untuk pegawai baru berjalan di latar belakang.
            </p>
            {report.totals.duplicates ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Terdapat {report.totals.duplicates} NIP duplikat pada berkas. Data tetap disimpan
                dengan peringatan.
              </div>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function PersonList({
  title,
  description,
  items,
  tone,
  showReason,
  showOwner,
  emptyText = "Tidak ada data pada kategori ini.",
}: {
  title: string;
  description: string;
  items: PersonRow[];
  tone: "amber" | "red" | "slate";
  showReason?: boolean;
  showOwner?: boolean;
  emptyText?: string;
}) {
  const badgeTone = tone === "red" ? "red" : tone === "amber" ? "amber" : "slate";
  return (
    <SectionCard
      title={title}
      subtitle={description}
      action={<Badge tone={badgeTone}>{items.length}</Badge>}
      bodyClassName="p-0"
    >
      {items.length ? (
        <div className="max-h-[330px] overflow-y-auto scroll-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">NIP</th>
                {showReason ? <th className="px-4 py-2">Keterangan</th> : null}
                {showOwner ? <th className="px-4 py-2">Pemilik lama</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {items.map((item, idx) => (
                <tr key={`${item.unit}-${item.row}-${idx}`}>
                  <td className="max-w-[180px] truncate px-4 py-2 font-medium text-ink/70">{item.nama}</td>
                  <td className="max-w-[160px] truncate px-4 py-2 text-ink/45">{item.unit}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-ink/50">{item.nip || "—"}</td>
                  {showReason ? <td className="px-4 py-2 text-[10px] text-ink/45">{item.reason}</td> : null}
                  {showOwner ? (
                    <td className="max-w-[190px] truncate px-4 py-2 text-[10px] text-ink/45">
                      {item.pemilik_lama || "—"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-6 text-xs text-ink/40">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {emptyText}
        </div>
      )}
    </SectionCard>
  );
}
