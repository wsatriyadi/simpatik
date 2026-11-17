export type Role = "admin" | "kabid";

export interface User {
  id: number;
  nama: string;
  username: string;
  role: Role;
  jabatan: string | null;
  nip: string | null;
  aktif: number;
}

export type PeriodStatus = "berjalan" | "ditutup";
export type FormStatus = "belum" | "sedang" | "selesai" | "terkunci";
export type AssessmentStatus = "belum" | "patuh" | "tidak_patuh" | "tidak_diperiksa";

export interface Period {
  id: number;
  bulan: number;
  tahun: number;
  status: PeriodStatus;
  label: string;
  opened_at: string;
  opened_by: number | null;
  closed_at: string | null;
  closed_by: number | null;
}

export interface Stats {
  total: number;
  patuh: number;
  tidak_patuh: number;
  tidak_diperiksa: number;
  belum: number;
  diperiksa: number;
  answered: number;
  pct: number;
  answered_pct: number;
}

export interface FormRow extends Stats {
  id: number;
  period_id: number;
  unit_id: number;
  unit: string;
  unit_nama: string;
  unit_urutan?: number;
  kabid_id: number | null;
  kabid_nama: string | null;
  kabid_jabatan: string | null;
  status: FormStatus;
  tanggal_pemeriksaan: string | null;
  completed_at: string | null;
  penanda_tangan_nama?: string | null;
  snapshot_kabid_nama?: string | null;
  remaining?: number;
  rank?: number;
}

export interface PeriodSummary extends Stats {
  forms_total: number;
  forms_complete: number;
  forms_in_progress: number;
  forms_not_started: number;
}

export interface Violation {
  id: number;
  nama: string;
  jumlah: number;
  urutan: number;
}

export interface Item {
  id: number;
  item_id?: number;
  nama: string;
  kelompok: string | null;
  urutan: number;
  aktif?: number;
  dipakai?: number;
}

export interface Unit {
  id: number;
  nama: string;
  urutan: number;
  aktif: number;
  pegawai_aktif?: number;
  pegawai_total?: number;
  formulir?: number;
  kabid_id?: number | null;
  kabid_nama?: string | null;
  kabid_jabatan?: string | null;
}

export interface Employee {
  id: number;
  nama: string;
  nama_lengkap: string;
  nip: string | null;
  unit_id: number;
  unit: string;
  aktif: number;
  gelar_depan?: string | null;
  gelar_belakang?: string | null;
  jabatan?: string | null;
  pangkat?: string | null;
  golongan?: string | null;
  status_kepegawaian?: string | null;
  found?: number;
  identitas_employee_id?: number | null;
  identity_employee_id?: number | null;
  sync_error?: string | null;
  synced_at?: string | null;
  simpeg_status?: "ditemukan" | "tidak_ditemukan" | "gagal" | "belum";
  nip_duplikat?: boolean;
  foto_url?: string | null;
}

export interface FormEmployee {
  id: number;
  employee_id: number;
  nama: string;
  nip: string | null;
  urutan: number;
  status: AssessmentStatus;
  alasan: string | null;
  keterangan: string | null;
  dinilai_pada: string | null;
  jabatan?: string | null;
  foto_path?: string | null;
  simpeg_found?: number;
  violated: string[];
  position?: number;
  total?: number;
  next_id?: number | null;
  can_edit?: boolean;
  read_only_reason?: string | null;
}

export interface ItemResult extends Item {
  memenuhi: 0 | 1 | null;
}

export interface HistoryEntry {
  id: number;
  form_id: number;
  kejadian: string;
  oleh_nama: string | null;
  oleh_role?: string | null;
  pada: string;
  catatan: string | null;
}
