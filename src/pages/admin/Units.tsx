import { useState } from "react";
import { Building2, Pencil, Plus, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import type { Unit } from "../../lib/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InfoBanner,
  Modal,
  PageHeader,
  PageSkeleton,
  SectionCard,
  Switch,
  TableWrap,
  Input,
} from "../../components/ui";

interface UnitsResponse {
  units: Unit[];
}

export default function AdminUnits() {
  useDocumentTitle("Kelola Unit Kerja");
  const toast = useToast();
  const { data, loading, error, reload } = useApi<UnitsResponse>("/admin/units");
  const [editing, setEditing] = useState<Unit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nama, setNama] = useState("");
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setNama("");
    setAktif(true);
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setNama(unit.nama);
    setAktif(Boolean(unit.aktif));
    setModalOpen(true);
  };

  const save = async () => {
    if (!nama.trim()) {
      toast.error("Nama unit wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/admin/units/${editing.id}`, {
          method: "PATCH",
          body: { nama: nama.trim(), aktif },
        });
        toast.success("Unit kerja diperbarui", nama.trim());
      } else {
        await api("/admin/units", {
          method: "POST",
          body: { nama: nama.trim(), aktif },
        });
        toast.success("Unit kerja ditambahkan", "Unit baru akan masuk periode berikutnya.");
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error("Unit gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const units = data?.units || [];
  const activeCount = units.filter((unit) => unit.aktif).length;

  return (
    <div>
      <PageHeader
        eyebrow="Data induk"
        title="Kelola Unit Kerja"
        description="Unit kerja menjadi wadah formulir bulanan. Unit yang sudah memiliki formulir hanya dapat dinonaktifkan, tidak dihapus."
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Unit
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">Total unit</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{units.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">Unit aktif</p>
          <p className="mt-1 text-2xl font-extrabold tabular text-emerald-700">{activeCount}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">Pegawai aktif</p>
          <p className="mt-1 text-2xl font-extrabold tabular text-brand-800">
            {units.reduce((sum, unit) => sum + (unit.pegawai_aktif || 0), 0)}
          </p>
        </div>
      </div>

      <SectionCard title="Daftar unit kerja" subtitle={`${units.length} unit terdaftar`} bodyClassName="p-0">
        {units.length ? (
          <>
            <TableWrap className="hidden md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-5 py-3">Unit Kerja</th>
                    <th className="px-4 py-3">Pegawai Aktif</th>
                    <th className="px-4 py-3">Penanggung Jawab</th>
                    <th className="px-4 py-3">Formulir</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-16 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {units.map((unit) => (
                    <tr key={unit.id} className="group transition hover:bg-brand-50/30">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <span className="font-semibold text-ink">{unit.nama}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink/60">
                          <Users className="h-3.5 w-3.5 text-ink/30" />
                          {unit.pegawai_aktif || 0}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3.5">
                        <p className="truncate text-xs font-medium text-ink/70">
                          {unit.kabid_nama || "Belum ditugaskan"}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-ink/35">
                          {unit.kabid_jabatan || "Atur penugasan pada menu Akun"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs tabular text-ink/50">
                        {unit.formulir || 0}
                      </td>
                      <td className="px-4 py-3.5">
                        {unit.aktif ? (
                          <Badge tone="green" dot>
                            Aktif
                          </Badge>
                        ) : (
                          <Badge tone="slate" dot>
                            Nonaktif
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(unit)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/40 transition group-hover:border-brand-200 group-hover:text-brand-700"
                          aria-label={`Ubah ${unit.nama}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <div className="divide-y divide-line/60 md:hidden">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => openEdit(unit)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition active:bg-brand-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-snug text-ink">{unit.nama}</p>
                    <p className="mt-0.5 text-[10px] text-ink/40">
                      {unit.pegawai_aktif || 0} pegawai · {unit.formulir || 0} formulir
                    </p>
                    <p className="mt-1 truncate text-[10px] text-ink/50">
                      {unit.kabid_nama || "Belum ada penanggung jawab"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {unit.aktif ? (
                      <Badge tone="green" dot>Aktif</Badge>
                    ) : (
                      <Badge tone="slate" dot>Nonaktif</Badge>
                    )}
                    <Pencil className="h-3.5 w-3.5 text-ink/30" />
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Building2}
            title="Belum ada unit kerja"
            description="Tambahkan unit kerja pertama untuk mulai mengelola data pegawai."
            action={<Button onClick={openCreate}>Tambah Unit</Button>}
          />
        )}
      </SectionCard>

      <div className="mt-4">
        <InfoBanner icon={Building2} tone="brand" title="Tentang perubahan unit">
          Perubahan nama unit berlaku pada data induk. Formulir periode yang sudah berjalan dan
          periode tertutup tetap menyimpan nama unit saat formulir dibuat.
        </InfoBanner>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Ubah unit kerja" : "Tambah unit kerja"}
        description={
          editing
            ? "Perubahan ini tidak mengubah formulir periode yang sudah dibuat."
            : "Unit baru akan tersedia pada periode monitoring berikutnya."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Simpan Perubahan" : "Tambah Unit"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama unit kerja" required>
            <Input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="Contoh: Instalasi Rawat Inap"
              autoFocus
            />
          </Field>
          <div className="rounded-xl border border-line bg-[#fbfaf7] p-3.5">
            <Switch
              checked={aktif}
              onChange={setAktif}
              label="Unit aktif"
              description="Unit aktif ikut dibuatkan formulir saat periode baru dibuka."
            />
          </div>
          {editing && Number(editing.formulir) > 0 ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
              Unit ini sudah memiliki {editing.formulir} formulir. Unit tidak dapat dihapus, tetapi
              dapat dinonaktifkan agar tidak ikut pada periode berikutnya.
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
