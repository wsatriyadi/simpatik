import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CloudDownload,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../lib/api";
import { useApi, useDebounced, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import {
  formatDate,
  classNames,
  nisNip,
} from "../../lib/format";
import type { Employee, Unit } from "../../lib/types";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterPill,
  InfoBanner,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Pagination,
  SearchInput,
  SectionCard,
  Select,
  Switch,
  TableWrap,
} from "../../components/ui";

interface QualityStats {
  total: number;
  duplicates: number;
  duplicate_employees: number;
  empty: number;
  irregular: number;
  not_found: number;
  unsynced: number;
}

interface EmployeesResponse {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  quality: QualityStats;
}

interface SyncStatus {
  running: boolean;
  total?: number;
  label?: string;
  started_at?: string;
  finished_at?: string;
  result?: {
    total: number;
    found: number;
    not_found: number;
    error: number;
    aborted?: boolean;
  } | null;
}

export default function AdminEmployees() {
  useDocumentTitle("Kelola Pegawai");
  const toast = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [unitId, setUnitId] = useState("");
  const [simpeg, setSimpeg] = useState("");
  const [aktif, setAktif] = useState("1");
  const [quality, setQuality] = useState("");
  const [page, setPage] = useState(1);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState<null | "unit" | "all">(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pollToken, setPollToken] = useState(0);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [nama, setNama] = useState("");
  const [nip, setNip] = useState("");
  const [formUnitId, setFormUnitId] = useState("");
  const [formAktif, setFormAktif] = useState(true);
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (debouncedQ) params.set("q", debouncedQ);
  if (unitId) params.set("unitId", unitId);
  if (simpeg) params.set("simpeg", simpeg);
  if (aktif) params.set("aktif", aktif);
  if (quality) params.set("quality", quality);
  params.set("page", String(page));
  params.set("pageSize", "30");

  const { data, loading, error, reload } = useApi<EmployeesResponse>(
    `/admin/employees?${params.toString()}`,
  );
  const unitsApi = useApi<{ units: Unit[] }>("/admin/units");
  const units = unitsApi.data?.units || [];
  const qualityCounts = data?.quality;
  const wasRunning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const status = await api<SyncStatus>("/admin/simpeg/status");
        if (cancelled) return;
        setSyncStatus(status);
        if (wasRunning.current && !status.running) {
          await reload();
          if (status.result) {
            toast.info(
              "Sinkronisasi SIMPEG selesai",
              `${status.result.found} ditemukan · ${status.result.not_found} tidak ditemukan · ${status.result.error} gagal`,
            );
          }
        }
        wasRunning.current = status.running;
        if (status.running) timer = window.setTimeout(tick, 4000);
      } catch {
        /* abaikan kegagalan status */
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollToken]);

  const resetPage = () => setPage(1);

  const openCreate = () => {
    setEditing(null);
    setNama("");
    setNip("");
    setFormUnitId(unitId || "");
    setFormAktif(true);
    setModalOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setNama(employee.nama);
    setNip(employee.nip || "");
    setFormUnitId(String(employee.unit_id));
    setFormAktif(Boolean(employee.aktif));
    setModalOpen(true);
  };

  const save = async () => {
    if (!nama.trim()) {
      toast.error("Nama pegawai wajib diisi.");
      return;
    }
    if (!formUnitId) {
      toast.error("Unit kerja wajib dipilih.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        nama: nama.trim(),
        nip: nip.trim(),
        unit_id: Number(formUnitId),
        aktif: formAktif,
      };
      const result = await api<{ sync?: { queued?: boolean } }>(
        editing ? `/admin/employees/${editing.id}` : "/admin/employees",
        { method: editing ? "PATCH" : "POST", body },
      );
      toast.success(
        editing ? "Data pegawai diperbarui" : "Pegawai ditambahkan",
        result.sync?.queued
          ? "Sinkronisasi identitas SIMPEG berjalan di latar belakang."
          : undefined,
      );
      setModalOpen(false);
      await reload();
      setPollToken((value) => value + 1);
    } catch (err) {
      toast.error("Data pegawai gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const syncOne = async (employee: Employee) => {
    setSyncingId(employee.id);
    try {
      const result = await api<{ result: { status: string; reason?: string } }>(
        "/admin/simpeg/sync",
        { method: "POST", body: { scope: "employee", id: employee.id } },
      );
      if (result.result.status === "found") {
        toast.success("Identitas SIMPEG ditemukan", employee.nama);
      } else if (result.result.status === "not_found") {
        toast.info("NIP tidak ditemukan di SIMPEG", result.result.reason || employee.nama);
      } else {
        toast.error("Sinkronisasi gagal", result.result.reason || "SIMPEG tidak dapat dijangkau.");
      }
      await reload();
    } catch (err) {
      toast.error("Sinkronisasi gagal", err instanceof Error ? err.message : undefined);
    } finally {
      setSyncingId(null);
    }
  };

  const runSync = async (scope: "unit" | "all") => {
    setSyncBusy(scope);
    try {
      if (scope === "unit") {
        if (!unitId) return;
        const result = await api<{ result: { found: number; not_found: number; error: number; aborted?: boolean } }>(
          "/admin/simpeg/sync",
          { method: "POST", body: { scope: "unit", id: Number(unitId) } },
        );
        toast.success(
          "Sinkronisasi unit selesai",
          `${result.result.found} ditemukan · ${result.result.not_found} tidak ditemukan · ${result.result.error} gagal`,
        );
        setSyncOpen(false);
        await reload();
      } else {
        const result = await api<{ result: { total: number } }>("/admin/simpeg/sync", {
          method: "POST",
          body: { scope: "all" },
        });
        toast.info(
          "Sinkronisasi seluruh pegawai dimulai",
          `${result.result.total} pegawai diproses di latar belakang.`,
        );
        setSyncOpen(false);
        setPollToken((value) => value + 1);
      }
    } catch (err) {
      toast.error("Sinkronisasi gagal", err instanceof Error ? err.message : undefined);
    } finally {
      setSyncBusy(null);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const employees = data?.employees || [];
  const selectedUnit = units.find((unit) => String(unit.id) === unitId);

  return (
    <div>
      <PageHeader
        eyebrow="Data induk"
        title="Kelola Pegawai"
        description="Kelola identitas pegawai, penempatan unit, dan salinan identitas SIMPEG. NIP duplikat diperbolehkan dengan peringatan."
        actions={
          <>
            <Link
              to="/admin/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              <Upload className="h-4 w-4" />
              Impor Excel
            </Link>
            <Button onClick={openCreate} icon={<UserPlus className="h-4 w-4" />}>
              Tambah Pegawai
            </Button>
          </>
        }
      />

      {syncStatus?.running ? (
        <InfoBanner tone="blue" icon={RefreshCw} title="Sinkronisasi SIMPEG berjalan" className="mb-4">
          {syncStatus.label || "Memproses identitas pegawai"} · {syncStatus.total || 0} pegawai.
          Halaman akan diperbarui otomatis setelah selesai.
        </InfoBanner>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            key: "duplikat",
            label: "NIP duplikat",
            value: qualityCounts?.duplicates || 0,
            hint: `${qualityCounts?.duplicate_employees || 0} pegawai`,
            icon: AlertTriangle,
            tone: "amber" as const,
            active: quality === "duplikat",
            onClick: () => {
              setQuality(quality === "duplikat" ? "" : "duplikat");
              setSimpeg("");
              resetPage();
            },
          },
          {
            key: "kosong",
            label: "Tanpa NIP",
            value: qualityCounts?.empty || 0,
            hint: "Tetap dapat dinilai",
            icon: ShieldAlert,
            tone: "amber" as const,
            active: quality === "kosong",
            onClick: () => {
              setQuality(quality === "kosong" ? "" : "kosong");
              setSimpeg("");
              resetPage();
            },
          },
          {
            key: "tidak_lengkap",
            label: "Format tidak lengkap",
            value: qualityCounts?.irregular || 0,
            hint: "NIP ≠ 18 digit",
            icon: ShieldX,
            tone: "red" as const,
            active: quality === "tidak_lengkap",
            onClick: () => {
              setQuality(quality === "tidak_lengkap" ? "" : "tidak_lengkap");
              setSimpeg("");
              resetPage();
            },
          },
          {
            key: "simpeg",
            label: "Tidak ditemukan SIMPEG",
            value: qualityCounts?.not_found || 0,
            hint: "Tampil dengan inisial",
            icon: CloudDownload,
            tone: "slate" as const,
            active: simpeg === "tidak_ditemukan",
            onClick: () => {
              setSimpeg(simpeg === "tidak_ditemukan" ? "" : "tidak_ditemukan");
              setQuality("");
              resetPage();
            },
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={classNames(
                "card flex items-start justify-between gap-2 p-4 text-left transition hover:border-brand-200",
                card.active ? "ring-2 ring-brand-500/25" : "",
              )}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">
                  {card.label}
                </p>
                <p
                  className={classNames(
                    "mt-1 text-2xl font-extrabold tabular",
                    card.tone === "red" ? "text-red-700" : card.tone === "amber" ? "text-amber-700" : "text-ink",
                  )}
                >
                  {card.value}
                </p>
                <p className="mt-1 text-[9px] text-ink/35">{card.hint}</p>
              </div>
              <Icon
                className={classNames(
                  "h-4 w-4",
                  card.tone === "red" ? "text-red-400" : card.tone === "amber" ? "text-amber-400" : "text-ink/25",
                )}
              />
            </button>
          );
        })}
      </div>

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/70 p-4">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              resetPage();
            }}
            placeholder="Cari nama atau NIP…"
            className="w-full sm:w-[240px]"
          />
          <Select
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              resetPage();
            }}
            className="h-9 w-auto min-w-[150px] py-1.5 text-xs"
            aria-label="Saring unit"
          >
            <option value="">Semua unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nama}
              </option>
            ))}
          </Select>
          <Select
            value={simpeg}
            onChange={(event) => {
              setSimpeg(event.target.value);
              setQuality("");
              resetPage();
            }}
            className="h-9 w-auto min-w-[150px] py-1.5 text-xs"
            aria-label="Saring status SIMPEG"
          >
            <option value="">Semua status SIMPEG</option>
            <option value="ditemukan">Ditemukan di SIMPEG</option>
            <option value="tidak_ditemukan">Tidak ditemukan</option>
            <option value="gagal">Gagal sinkronisasi</option>
            <option value="belum">Belum disinkronkan</option>
          </Select>
          <Select
            value={aktif}
            onChange={(event) => {
              setAktif(event.target.value);
              resetPage();
            }}
            className="h-9 w-auto min-w-[120px] py-1.5 text-xs"
            aria-label="Saring status aktif"
          >
            <option value="">Semua status</option>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </Select>
          {quality || simpeg || unitId || q || aktif !== "1" ? (
            <FilterPill
              active={false}
              onClick={() => {
                setQuality("");
                setSimpeg("");
                setUnitId("");
                setQ("");
                setAktif("1");
                resetPage();
              }}
            >
              Reset filter
            </FilterPill>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncOpen(true)}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Sinkronkan SIMPEG
            </Button>
          </div>
        </div>

        {employees.length ? (
          <>
            <TableWrap className="hidden lg:block">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-4 py-3">Pegawai</th>
                    <th className="px-4 py-3">Unit Kerja</th>
                    <th className="px-4 py-3">Jabatan / Kepegawaian</th>
                    <th className="px-4 py-3">Identitas SIMPEG</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-[110px] px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="group transition hover:bg-brand-50/25">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={employee.nama_lengkap} src={employee.foto_url} size="sm" />
                          <div className="min-w-0">
                            <p className="max-w-[250px] truncate text-[13px] font-semibold text-ink">
                              {employee.nama_lengkap}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink/40">
                              {employee.nip || <span className="font-semibold text-amber-700">NIP kosong</span>}
                              {employee.nip_duplikat ? (
                                <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
                                  NIP ganda
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[210px] px-4 py-3">
                        <p className="truncate text-xs text-ink/65">{employee.unit}</p>
                      </td>
                      <td className="max-w-[190px] px-4 py-3">
                        <p className="truncate text-xs text-ink/65">{employee.jabatan || "—"}</p>
                        <p className="mt-0.5 text-[10px] text-ink/35">
                          {employee.status_kepegawaian || "Belum ada data"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <SimpegBadge employee={employee} />
                      </td>
                      <td className="px-4 py-3">
                        {employee.aktif ? (
                          <Badge tone="green" dot>Aktif</Badge>
                        ) : (
                          <Badge tone="slate" dot>Nonaktif</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => syncOne(employee)}
                            disabled={syncingId === employee.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-40"
                            title="Sinkronkan SIMPEG"
                          >
                            <RefreshCw className={classNames("h-3.5 w-3.5", syncingId === employee.id && "animate-spin")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(employee)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-brand-200 hover:text-brand-700"
                            title="Ubah data"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <div className="divide-y divide-line/60 lg:hidden">
              {employees.map((employee) => (
                <div key={employee.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={employee.nama_lengkap} src={employee.foto_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold leading-snug text-ink">
                        {employee.nama_lengkap}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink/40">
                        {employee.nip || "NIP kosong"}
                        {employee.nip_duplikat ? " · NIP ganda" : ""}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-ink/50">{employee.unit}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <SimpegBadge employee={employee} />
                        {employee.aktif ? <Badge tone="green" dot>Aktif</Badge> : <Badge tone="slate" dot>Nonaktif</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncOne(employee)}
                      loading={syncingId === employee.id}
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                    >
                      Sinkron
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(employee)}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                    >
                      Ubah
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} pageSize={data?.pageSize || 30} total={data?.total || 0} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="Tidak ada pegawai"
            description="Ubah saringan atau tambahkan pegawai baru pada data induk."
            action={
              <Button onClick={openCreate} icon={<UserPlus className="h-4 w-4" />}>
                Tambah Pegawai
              </Button>
            }
          />
        )}
      </SectionCard>

      <div className="mt-4">
        <InfoBanner icon={AlertTriangle} tone="gold" title="Tentang identitas SIMPEG">
          NIP kosong, ganda, atau tidak lengkap tetap dapat dinilai. Pegawai tersebut tampil dengan
          inisial sampai NIP diperbaiki dan disinkronkan. Perubahan NIP akan menghapus salinan
          identitas lama dan memerlukan sinkronisasi ulang.
        </InfoBanner>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Ubah data pegawai" : "Tambah pegawai"}
        description="Data unit pada formulir periode berjalan tidak berubah; perubahan berlaku pada periode berikutnya."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Simpan Perubahan" : "Tambah Pegawai"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama lengkap" required>
            <Input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="Nama pegawai tanpa gelar"
              autoFocus
            />
          </Field>
          <Field
            label="NIP"
            hint="18 digit. Boleh dikosongkan; sistem akan menandai data yang belum lengkap."
          >
            <Input
              value={nip}
              onChange={(event) => setNip(event.target.value)}
              placeholder="Contoh: 198001012005011001"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          {nip && !nisNip(nip) ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              NIP belum 18 digit. Pegawai tetap dapat disimpan dan dinilai, tetapi foto serta
              identitas SIMPEG tidak akan tersedia sampai NIP diperbaiki.
            </div>
          ) : null}
          <Field label="Unit kerja" required>
            <Select value={formUnitId} onChange={(event) => setFormUnitId(event.target.value)}>
              <option value="">Pilih unit kerja…</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.nama} {unit.aktif ? "" : "(nonaktif)"}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-xl border border-line bg-[#fbfaf7] p-3.5">
            <Switch
              checked={formAktif}
              onChange={setFormAktif}
              label="Pegawai aktif"
              description="Pegawai aktif disertakan pada formulir periode berikutnya."
            />
          </div>
          {editing && nip.trim() !== (editing.nip || "") ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              NIP berubah. Salinan identitas dan foto SIMPEG lama akan dihapus, lalu disinkronkan
              ulang bila NIP lengkap.
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        title="Sinkronkan data SIMPEG"
        description="Mengambil identitas dan foto resmi pegawai berdasarkan NIP. Data lama tidak ditimpa bila SIMPEG tidak dapat dijangkau."
        footer={
          <Button variant="outline" onClick={() => setSyncOpen(false)} disabled={Boolean(syncBusy)}>
            Tutup
          </Button>
        }
      >
        <div className="space-y-3">
          {unitId && selectedUnit ? (
            <button
              type="button"
              disabled={Boolean(syncBusy)}
              onClick={() => runSync("unit")}
              className="flex w-full items-start gap-3 rounded-xl border border-line bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <RefreshCw className={classNames("h-4 w-4", syncBusy === "unit" && "animate-spin")} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">
                  Sinkronkan unit {selectedUnit.nama}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink/50">
                  {selectedUnit.pegawai_aktif || 0} pegawai aktif · proses berjalan saat ini juga.
                </span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={Boolean(syncBusy)}
            onClick={() => runSync("all")}
            className="flex w-full items-start gap-3 rounded-xl border border-line bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <CloudDownload className={classNames("h-4 w-4", syncBusy === "all" && "animate-pulse")} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">Sinkronkan seluruh pegawai</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink/50">
                Berjalan di latar belakang. Gunakan bila data SIMPEG sudah lama tidak diperbarui.
              </span>
            </span>
          </button>
          <div className="rounded-lg bg-[#fbfaf7] px-3 py-2.5 text-[11px] leading-relaxed text-ink/45">
            Apabila SIMPEG tidak dapat dijangkau, sinkronisasi dihentikan tanpa mengubah data yang
            sudah tersimpan. Ulangi beberapa saat kemudian.
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SimpegBadge({ employee }: { employee: Employee }) {
  const status = employee.simpeg_status;
  if (status === "ditemukan") {
    return (
      <Badge tone="green" dot className="max-w-full" >
        <ShieldCheck className="h-3 w-3 shrink-0" />
        <span className="truncate">SIMPEG</span>
      </Badge>
    );
  }
  if (status === "gagal") {
    return (
      <Badge tone="red" dot className="max-w-full">
        <ShieldX className="h-3 w-3 shrink-0" />
        <span className="truncate" title={employee.sync_error || undefined}>Gagal sinkron</span>
      </Badge>
    );
  }
  if (status === "tidak_ditemukan") {
    return (
      <Badge tone="amber" dot className="max-w-full">
        <ShieldAlert className="h-3 w-3 shrink-0" />
        <span className="truncate" title={employee.sync_error || undefined}>Tidak ditemukan</span>
      </Badge>
    );
  }
  return (
    <Badge tone="slate" dot className="max-w-full">
      <span className="truncate">Belum disinkronkan</span>
    </Badge>
  );
}
