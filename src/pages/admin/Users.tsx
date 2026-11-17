import { useMemo, useState } from "react";
import {
  Building2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
} from "lucide-react";
import { api } from "../../lib/api";
import { useApi, useDocumentTitle } from "../../lib/hooks";
import { useToast } from "../../contexts/ToastContext";
import { classNames } from "../../lib/format";
import type { Role, Unit, User } from "../../lib/types";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  FilterPill,
  InfoBanner,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  SearchInput,
  SectionCard,
  Select,
  Switch,
  TableWrap,
} from "../../components/ui";

interface UserRow extends User {
  units: Array<{ id: number; nama: string }>;
  created_at?: string;
}

interface UsersResponse {
  users: UserRow[];
  units: Unit[];
}

export default function AdminUsers() {
  useDocumentTitle("Akun & Penugasan");
  const toast = useToast();
  const { data, loading, error, reload } = useApi<UsersResponse>("/admin/users");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [assignmentUser, setAssignmentUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    nama: "",
    nip: "",
    jabatan: "",
    username: "",
    password: "simpatik123",
    role: "kabid" as Role,
    aktif: true,
  });
  const [editForm, setEditForm] = useState({
    nama: "",
    nip: "",
    jabatan: "",
    aktif: true,
  });
  const [resetPassword, setResetPassword] = useState("simpatik123");
  const [unitSearch, setUnitSearch] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);

  const units = data?.units || [];
  const users = data?.users || [];
  const filtered = useMemo(
    () => users.filter((user) => roleFilter === "all" || user.role === roleFilter),
    [users, roleFilter],
  );

  const openAdd = () => {
    setAddForm({
      nama: "",
      nip: "",
      jabatan: "",
      username: "",
      password: "simpatik123",
      role: "kabid",
      aktif: true,
    });
    setAddOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setEditForm({
      nama: user.nama,
      nip: user.nip || "",
      jabatan: user.jabatan || "",
      aktif: Boolean(user.aktif),
    });
    setEditUser(user);
  };

  const openAssignment = (user: UserRow) => {
    setAssignmentUser(user);
    setSelectedUnits(user.units.map((unit) => unit.id));
    setUnitSearch("");
  };

  const createUser = async () => {
    if (!addForm.nama.trim() || !addForm.jabatan.trim()) {
      toast.error("Nama dan jabatan wajib diisi.");
      return;
    }
    if (addForm.role === "kabid" && !addForm.nip.trim()) {
      toast.error("NIP wajib diisi untuk akun Kabid.");
      return;
    }
    if (addForm.role === "admin" && !addForm.username.trim()) {
      toast.error("Username wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ user: UserRow }>("/admin/users", {
        method: "POST",
        body: {
          nama: addForm.nama.trim(),
          nip: addForm.nip.trim() || null,
          jabatan: addForm.jabatan.trim(),
          username: addForm.role === "kabid" ? addForm.nip.trim() : addForm.username.trim(),
          password: addForm.password,
          role: addForm.role,
          aktif: addForm.aktif,
        },
      });
      toast.success(
        "Akun berhasil dibuat",
        addForm.role === "kabid"
          ? "Atur unit tugas Kabid agar dapat mulai menilai."
          : "Akun Admin dapat langsung digunakan.",
      );
      setAddOpen(false);
      await reload();
      if (addForm.role === "kabid") {
        setAssignmentUser({ ...result.user, units: [] });
        setSelectedUnits([]);
        setUnitSearch("");
      }
    } catch (err) {
      toast.error("Akun gagal dibuat", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    if (!editForm.nama.trim() || !editForm.jabatan.trim()) {
      toast.error("Nama dan jabatan wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/users/${editUser.id}`, {
        method: "PATCH",
        body: {
          nama: editForm.nama.trim(),
          nip: editForm.nip.trim() || null,
          jabatan: editForm.jabatan.trim(),
          aktif: editForm.aktif,
        },
      });
      toast.success("Akun diperbarui", editForm.nama.trim());
      setEditUser(null);
      await reload();
    } catch (err) {
      toast.error("Akun gagal diperbarui", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: UserRow) => {
    try {
      await api(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: { aktif: !user.aktif },
      });
      toast.success(user.aktif ? "Akun dinonaktifkan" : "Akun diaktifkan", user.nama);
      await reload();
    } catch (err) {
      toast.error("Status akun gagal diubah", err instanceof Error ? err.message : undefined);
    }
  };

  const resetAccountPassword = async () => {
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      toast.error("Password minimal 8 karakter.");
      return;
    }
    setSaving(true);
    try {
      await api(`/admin/users/${resetUser.id}/reset-password`, {
        method: "POST",
        body: { password: resetPassword },
      });
      toast.success("Password berhasil direset", `Sampaikan password baru kepada ${resetUser.nama}.`);
      setResetUser(null);
    } catch (err) {
      toast.error("Password gagal direset", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const saveAssignments = async () => {
    if (!assignmentUser) return;
    setSaving(true);
    try {
      await api(`/admin/users/${assignmentUser.id}/assignments`, {
        method: "PUT",
        body: { unitIds: selectedUnits },
      });
      toast.success(
        "Penugasan diperbarui",
        `${assignmentUser.nama} bertanggung jawab atas ${selectedUnits.length} unit.`,
      );
      setAssignmentUser(null);
      await reload();
    } catch (err) {
      toast.error("Penugasan gagal disimpan", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const kandidatUnits = units.filter((unit) =>
    unit.nama.toLowerCase().includes(unitSearch.trim().toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Data induk"
        title="Akun Pengguna & Penugasan"
        description="Kelola akses Admin dan Kabid. Satu akun mewakili satu orang; username Kabid menggunakan NIP."
        actions={
          <Button onClick={openAdd} icon={<UserPlus className="h-4 w-4" />}>
            Buat Akun
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          <FilterPill active={roleFilter === "all"} onClick={() => setRoleFilter("all")} count={users.length}>
            Semua
          </FilterPill>
          <FilterPill
            active={roleFilter === "admin"}
            onClick={() => setRoleFilter("admin")}
            count={users.filter((user) => user.role === "admin").length}
          >
            Admin
          </FilterPill>
          <FilterPill
            active={roleFilter === "kabid"}
            onClick={() => setRoleFilter("kabid")}
            count={users.filter((user) => user.role === "kabid").length}
          >
            Kabid
          </FilterPill>
        </div>
        <p className="text-[11px] text-ink/35">
          {users.filter((user) => user.role === "kabid" && user.aktif).length} Kabid aktif ·{" "}
          {units.length} unit
        </p>
      </div>

      <SectionCard bodyClassName="p-0">
        {filtered.length ? (
          <>
            <TableWrap className="hidden lg:block">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-5 py-3">Pengguna</th>
                    <th className="px-4 py-3">Peran</th>
                    <th className="px-4 py-3">Jabatan</th>
                    <th className="px-4 py-3">Unit Tugas</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-[150px] px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filtered.map((user) => (
                    <tr key={user.id} className="group transition hover:bg-brand-50/25">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.nama} size="sm" />
                          <div className="min-w-0">
                            <p className="max-w-[230px] truncate text-[13px] font-semibold text-ink">
                              {user.nama}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink/40">{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.role === "admin" ? (
                          <Badge tone="dark">Admin</Badge>
                        ) : (
                          <Badge tone="brand">Kabid</Badge>
                        )}
                      </td>
                      <td className="max-w-[210px] px-4 py-3.5">
                        <p className="truncate text-xs text-ink/60">{user.jabatan || "—"}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.role === "admin" ? (
                          <span className="text-[10px] text-ink/30">Akses penuh</span>
                        ) : user.units.length ? (
                          <div className="flex max-w-[250px] flex-wrap gap-1">
                            {user.units.slice(0, 2).map((unit) => (
                              <span
                                key={unit.id}
                                className="max-w-[150px] truncate rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium text-brand-700"
                              >
                                {unit.nama}
                              </span>
                            ))}
                            {user.units.length > 2 ? (
                              <span className="rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[9px] font-bold text-ink/45">
                                +{user.units.length - 2}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700">Belum ada unit</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {user.aktif ? (
                          <Badge tone="green" dot>Aktif</Badge>
                        ) : (
                          <Badge tone="slate" dot>Nonaktif</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {user.role === "kabid" ? (
                            <button
                              type="button"
                              onClick={() => openAssignment(user)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-brand-200 hover:text-brand-700"
                              title="Atur unit tugas"
                            >
                              <Building2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-brand-200 hover:text-brand-700"
                            title="Ubah akun"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetUser(user);
                              setResetPassword("simpatik123");
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-brand-200 hover:text-brand-700"
                            title="Reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(user)}
                            disabled={user.id === data?.users.find((row) => row.role === "admin")?.id && user.role === "admin"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/35 transition hover:border-red-200 hover:text-red-600 disabled:opacity-30"
                            title={user.aktif ? "Nonaktifkan akun" : "Aktifkan akun"}
                          >
                            {user.aktif ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            <div className="divide-y divide-line/60 lg:hidden">
              {filtered.map((user) => (
                <div key={user.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={user.nama} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold leading-snug text-ink">{user.nama}</p>
                          <p className="mt-0.5 text-[10px] text-ink/40">{user.username}</p>
                        </div>
                        {user.role === "admin" ? <Badge tone="dark">Admin</Badge> : <Badge tone="brand">Kabid</Badge>}
                      </div>
                      <p className="mt-1 text-[10px] text-ink/50">{user.jabatan || "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {user.aktif ? <Badge tone="green" dot>Aktif</Badge> : <Badge tone="slate" dot>Nonaktif</Badge>}
                        {user.role === "kabid" ? (
                          <span className="text-[9px] text-ink/35">{user.units.length} unit tugas</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {user.role === "kabid" ? (
                      <Button size="sm" variant="outline" onClick={() => openAssignment(user)} icon={<Building2 className="h-3.5 w-3.5" />}>
                        Unit Tugas
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openEdit(user)} icon={<Pencil className="h-3.5 w-3.5" />}>
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetUser(user);
                        setResetPassword("simpatik123");
                      }}
                      icon={<KeyRound className="h-3.5 w-3.5" />}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="Belum ada akun"
            description="Buat akun Admin atau Kabid untuk mulai menggunakan SIMPATIK."
            action={<Button onClick={openAdd}>Buat Akun</Button>}
          />
        )}
      </SectionCard>

      <div className="mt-4">
        <InfoBanner icon={ShieldCheck} tone="brand" title="Aturan akun & penugasan">
          Satu unit hanya memiliki satu Kabid penanggung jawab pada satu waktu. Memberikan unit
          kepada Kabid lain akan memindahkan penugasan unit tersebut. Akun yang dinonaktifkan tidak
          dapat masuk, tetapi riwayat formulirnya tetap tersimpan.
        </InfoBanner>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Buat akun pengguna"
        description="Username Kabid otomatis menggunakan NIP. Password awal wajib disampaikan kepada pengguna."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={createUser} loading={saving} icon={<UserPlus className="h-4 w-4" />}>
              Buat Akun
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="field-label">Peran</p>
            <div className="grid grid-cols-2 gap-2">
              {(["kabid", "admin"] as Role[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setAddForm((form) => ({ ...form, role }))}
                  className={classNames(
                    "rounded-xl border px-3 py-3 text-left transition",
                    addForm.role === role
                      ? "border-brand-700 bg-brand-50 ring-2 ring-brand-500/15"
                      : "border-line bg-white hover:border-brand-200",
                  )}
                >
                  <span className="block text-sm font-bold text-ink">
                    {role === "kabid" ? "Kabid" : "Admin"}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-ink/45">
                    {role === "kabid" ? "Menilai unit tugasnya" : "Mengelola sistem & periode"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Field label="Nama lengkap & gelar" required>
            <Input
              value={addForm.nama}
              onChange={(event) => setAddForm((form) => ({ ...form, nama: event.target.value }))}
              placeholder="Contoh: Nor Hikmah, S.Kep, Ns, M.Kep"
            />
          </Field>
          {addForm.role === "kabid" ? (
            <Field label="NIP (sekaligus username)" required hint="NIP menjadi username untuk masuk.">
              <Input
                value={addForm.nip}
                onChange={(event) =>
                  setAddForm((form) => ({ ...form, nip: event.target.value, username: event.target.value }))
                }
                placeholder="18 digit NIP"
                inputMode="numeric"
              />
            </Field>
          ) : (
            <Field label="Username" required>
              <Input
                value={addForm.username}
                onChange={(event) => setAddForm((form) => ({ ...form, username: event.target.value }))}
                placeholder="Contoh: admin2"
                autoComplete="off"
              />
            </Field>
          )}
          <Field label="Jabatan" required>
            <Input
              value={addForm.jabatan}
              onChange={(event) => setAddForm((form) => ({ ...form, jabatan: event.target.value }))}
              placeholder="Contoh: Kepala Bidang Keperawatan"
            />
          </Field>
          <Field label="Password awal" required hint="Minimal 8 karakter. Pengguna dapat menggantinya sendiri.">
            <Input
              value={addForm.password}
              onChange={(event) => setAddForm((form) => ({ ...form, password: event.target.value }))}
              autoComplete="new-password"
            />
          </Field>
          <div className="rounded-xl border border-line bg-[#fbfaf7] p-3.5">
            <Switch
              checked={addForm.aktif}
              onChange={(aktif) => setAddForm((form) => ({ ...form, aktif }))}
              label="Akun aktif"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Ubah akun"
        description={editUser ? `Username: ${editUser.username}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama lengkap & gelar" required>
            <Input
              value={editForm.nama}
              onChange={(event) => setEditForm((form) => ({ ...form, nama: event.target.value }))}
            />
          </Field>
          {editUser?.role === "kabid" ? (
            <Field
              label="NIP"
              hint="Mengubah NIP juga mengubah username akun. Pastikan NIP baru belum dipakai akun lain."
            >
              <Input
                value={editForm.nip}
                onChange={(event) => setEditForm((form) => ({ ...form, nip: event.target.value }))}
                inputMode="numeric"
              />
            </Field>
          ) : null}
          <Field label="Jabatan" required>
            <Input
              value={editForm.jabatan}
              onChange={(event) => setEditForm((form) => ({ ...form, jabatan: event.target.value }))}
            />
          </Field>
          <div className="rounded-xl border border-line bg-[#fbfaf7] p-3.5">
            <Switch
              checked={editForm.aktif}
              onChange={(aktif) => setEditForm((form) => ({ ...form, aktif }))}
              label="Akun aktif"
              description="Menonaktifkan akun langsung mengakhiri sesi pengguna."
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetUser)}
        onClose={() => setResetUser(null)}
        title="Reset password"
        description={resetUser ? `Akun ${resetUser.nama} · ${resetUser.username}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setResetUser(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={resetAccountPassword} loading={saving}>
              Reset Password
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label="Password baru"
            required
            hint="Minimal 8 karakter. Seluruh sesi pengguna pada perangkat lain akan berakhir."
          >
            <Input
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
            Catat password sebelum menyimpan. Password tidak dapat dilihat kembali oleh Admin.
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(assignmentUser)}
        onClose={() => setAssignmentUser(null)}
        size="lg"
        title="Atur unit tugas Kabid"
        description={assignmentUser ? assignmentUser.nama : undefined}
        footer={
          <>
            <span className="mr-auto text-[11px] text-ink/40">
              {selectedUnits.length} unit dipilih
            </span>
            <Button variant="outline" onClick={() => setAssignmentUser(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={saveAssignments} loading={saving}>
              Simpan Penugasan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={unitSearch}
              onChange={setUnitSearch}
              placeholder="Cari unit kerja…"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedUnits(units.map((unit) => unit.id))}
            >
              Pilih semua
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedUnits([])}>
              Kosongkan
            </Button>
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-xl border border-line p-2 scroll-thin">
            {kandidatUnits.length ? (
              <div className="grid gap-0.5 sm:grid-cols-2">
                {kandidatUnits.map((unit) => {
                  const checked = selectedUnits.includes(unit.id);
                  return (
                    <Checkbox
                      key={unit.id}
                      checked={checked}
                      onChange={(value) =>
                        setSelectedUnits((current) =>
                          value ? [...new Set([...current, unit.id])] : current.filter((id) => id !== unit.id),
                        )
                      }
                      label={
                        <span className="text-[11px] leading-snug">
                          {unit.nama}
                          {!unit.aktif ? <span className="ml-1 text-[9px] text-ink/30">(nonaktif)</span> : null}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-6 text-xs text-ink/40">
                <Search className="h-4 w-4" /> Unit tidak ditemukan.
              </div>
            )}
          </div>
          <div className="rounded-lg bg-[#fbfaf7] px-3 py-2.5 text-[11px] leading-relaxed text-ink/45">
            Menyimpan penugasan akan memindahkan unit yang dipilih dari Kabid sebelumnya. Perubahan
            berlaku untuk periode yang belum ditutup.
          </div>
        </div>
      </Modal>
    </div>
  );
}
