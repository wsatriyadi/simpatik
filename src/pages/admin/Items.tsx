import { useState } from "react";
import { ArrowDown, ArrowUp, Info, ListChecks, Pencil, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import type { Item, Period } from "../../lib/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InfoBanner,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  SectionCard,
  Switch,
} from "../../components/ui";

interface ItemsResponse {
  items: Item[];
  active_period: Period | null;
  snapshot: Item[];
}

export default function AdminItems() {
  useDocumentTitle("Item Periksa");
  const toast = useToast();
  const { data, loading, error, reload } = useApi<ItemsResponse>("/admin/items");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [nama, setNama] = useState("");
  const [kelompok, setKelompok] = useState("Atribut Lengkap");
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const items = data?.items || [];

  const openCreate = () => {
    setEditing(null);
    setNama("");
    setKelompok("Atribut Lengkap");
    setAktif(true);
    setModalOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setNama(item.nama);
    setKelompok(item.kelompok || "Atribut Lengkap");
    setAktif(Boolean(item.aktif));
    setModalOpen(true);
  };

  const save = async () => {
    if (!nama.trim()) {
      toast.error("Nama item periksa wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/admin/items/${editing.id}`, {
          method: "PATCH",
          body: { nama: nama.trim(), kelompok, aktif },
        });
        toast.success("Item periksa diperbarui", "Berlaku mulai periode berikutnya.");
      } else {
        await api("/admin/items", {
          method: "POST",
          body: { nama: nama.trim(), kelompok, aktif },
        });
        toast.success("Item periksa ditambahkan", "Berlaku mulai periode berikutnya.");
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error("Item gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: Item, value: boolean) => {
    try {
      await api(`/admin/items/${item.id}`, {
        method: "PATCH",
        body: { aktif: value },
      });
      toast.success(value ? "Item diaktifkan" : "Item dinonaktifkan", "Berlaku mulai periode berikutnya.");
      await reload();
    } catch (err) {
      toast.error("Status item gagal diubah", err instanceof Error ? err.message : undefined);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setOrdering(true);
    try {
      await api("/admin/items/order", { method: "PUT", body: { ids } });
      await reload();
    } catch (err) {
      toast.error("Urutan gagal diubah", err instanceof Error ? err.message : undefined);
    } finally {
      setOrdering(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Data induk"
        title="Kelola Item Periksa"
        description="Item periksa menentukan aspek yang dinilai pada setiap pegawai. Perubahan hanya berlaku pada periode berikutnya."
        actions={
          <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Tambah Item
          </Button>
        }
      />

      <InfoBanner
        tone="gold"
        icon={Info}
        title="Cuplikan per periode"
        className="mb-4"
      >
        Saat periode dibuka, daftar item aktif disalin menjadi cuplikan periode. Mengubah item
        sekarang tidak mengubah formulir {data?.active_period ? data.active_period.label : "yang sudah berjalan"}.
      </InfoBanner>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Item periksa"
          subtitle={`${items.filter((item) => item.aktif).length} aktif · ${items.length} total`}
          bodyClassName="p-0"
        >
          {items.length ? (
            <div className="divide-y divide-line/60">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-brand-50/25 sm:px-5"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0 || ordering}
                      onClick={() => move(index, -1)}
                      className="flex h-5 w-5 items-center justify-center rounded text-ink/25 transition hover:bg-ink/5 hover:text-brand-700 disabled:opacity-20"
                      aria-label="Naikkan urutan"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1 || ordering}
                      onClick={() => move(index, 1)}
                      className="flex h-5 w-5 items-center justify-center rounded text-ink/25 transition hover:bg-ink/5 hover:text-brand-700 disabled:opacity-20"
                      aria-label="Turunkan urutan"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-semibold leading-snug ${item.aktif ? "text-ink" : "text-ink/40 line-through"}`}>
                      {item.nama}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand" className="text-[9px]">
                        {item.kelompok || "Tanpa kelompok"}
                      </Badge>
                      {Number(item.dipakai) > 0 ? (
                        <span className="text-[9px] text-ink/30">
                          dipakai di {item.dipakai} periode
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(item, !item.aktif)}
                      className="relative h-5 w-9 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                      style={{
                        backgroundColor: item.aktif ? "#1e554e" : "#e7e5e4",
                        borderColor: item.aktif ? "#1e554e" : "#d6d3d1",
                      }}
                      role="switch"
                      aria-checked={Boolean(item.aktif)}
                      aria-label={`Aktifkan ${item.nama}`}
                    >
                      <span
                        className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform"
                        style={{ left: 2, transform: item.aktif ? "translateX(16px)" : "none" }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition group-hover:border-brand-200 group-hover:text-brand-700"
                      aria-label={`Ubah ${item.nama}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ListChecks}
              title="Belum ada item periksa"
              description="Tambahkan minimal satu item sebelum membuka periode."
              action={<Button onClick={openCreate}>Tambah Item</Button>}
            />
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                Cuplikan periode
                {data?.active_period ? (
                  <Badge tone="blue">{data.active_period.label}</Badge>
                ) : (
                  <Badge tone="slate">Tidak ada periode berjalan</Badge>
                )}
              </span>
            }
            subtitle="Daftar item yang sedang dipakai formulir periode berjalan."
            bodyClassName="p-0"
          >
            {data?.snapshot?.length ? (
              <ol className="divide-y divide-line/60">
                {data.snapshot.map((item, index) => (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-800">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold leading-snug text-ink/75">{item.nama}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-ink/30">
                        {item.kelompok}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                className="py-8"
                icon={Info}
                title="Belum ada cuplikan"
                description="Cuplikan item dibuat otomatis saat periode baru dibuka."
              />
            )}
          </SectionCard>

          <div className="rounded-2xl border border-line bg-[#fbfaf7] p-4 text-[11px] leading-relaxed text-ink/50">
            <p className="mb-1 font-bold text-ink/70">Catatan pengelolaan</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Item yang pernah dipakai tidak dapat dihapus permanen; gunakan nonaktif.</li>
              <li>Urutan item mengikuti daftar di atas dan tampil sama pada laporan.</li>
              <li>Perubahan nama item tidak mengubah cuplikan periode yang sudah dibuat.</li>
            </ul>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Ubah item periksa" : "Tambah item periksa"}
        description="Perubahan berlaku mulai periode berikutnya; periode berjalan tetap memakai cuplikan lama."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Simpan Perubahan" : "Tambah Item"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama item periksa" required>
            <Input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="Contoh: Name Tag"
              autoFocus
            />
          </Field>
          <Field label="Kelompok" hint="Kelompok membantu pengelompokan pada tampilan laporan.">
            <Input
              value={kelompok}
              onChange={(event) => setKelompok(event.target.value)}
              placeholder="Contoh: Atribut Lengkap"
            />
          </Field>
          <div className="rounded-xl border border-line bg-[#fbfaf7] p-3.5">
            <Switch
              checked={aktif}
              onChange={setAktif}
              label="Item aktif"
              description="Item aktif akan disalin ke periode berikutnya."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
