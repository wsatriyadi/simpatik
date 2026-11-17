import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { DATA_DIR, PHOTO_DIR, DB_PATH } from "./config.js";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PHOTO_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kabid')),
    jabatan TEXT,
    nip TEXT,
    aktif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    urutan INTEGER NOT NULL DEFAULT 0,
    aktif INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE (user_id, unit_id)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    nip TEXT,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    aktif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS simpeg_identities (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    nama_simpeg TEXT,
    gelar_depan TEXT,
    gelar_belakang TEXT,
    jabatan TEXT,
    pangkat TEXT,
    golongan TEXT,
    status_kepegawaian TEXT,
    satker TEXT,
    unker TEXT,
    url_foto TEXT,
    foto_path TEXT,
    foto_mime TEXT,
    found INTEGER NOT NULL DEFAULT 0,
    sync_error TEXT,
    synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    kelompok TEXT,
    urutan INTEGER NOT NULL DEFAULT 0,
    aktif INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('berjalan', 'ditutup')),
    opened_by INTEGER REFERENCES users(id),
    opened_at TEXT NOT NULL,
    closed_by INTEGER REFERENCES users(id),
    closed_at TEXT,
    UNIQUE (bulan, tahun)
  );

  CREATE TABLE IF NOT EXISTS period_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    nama_saat_itu TEXT NOT NULL,
    kelompok_saat_itu TEXT,
    urutan INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    kabid_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'sedang', 'selesai', 'terkunci')),
    tanggal_pemeriksaan TEXT,
    penanda_tangan_nama TEXT,
    penanda_tangan_nip TEXT,
    penanda_tangan_jabatan TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (period_id, unit_id)
  );

  CREATE TABLE IF NOT EXISTS form_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    nama_saat_itu TEXT NOT NULL,
    nip_saat_itu TEXT,
    urutan INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_employee_id INTEGER NOT NULL UNIQUE REFERENCES form_employees(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'patuh', 'tidak_patuh', 'tidak_diperiksa')),
    alasan_tidak_diperiksa TEXT,
    keterangan TEXT,
    dinilai_oleh INTEGER REFERENCES users(id),
    dinilai_pada TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS assessment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    period_item_id INTEGER NOT NULL REFERENCES period_items(id),
    memenuhi INTEGER NOT NULL,
    UNIQUE (assessment_id, period_item_id)
  );

  CREATE TABLE IF NOT EXISTS form_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    kejadian TEXT NOT NULL,
    oleh_user_id INTEGER REFERENCES users(id),
    oleh_nama TEXT,
    pada TEXT NOT NULL,
    catatan TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    actor_id INTEGER,
    actor_nama TEXT,
    pada TEXT NOT NULL,
    detail TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT,
    payload TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_forms_period ON forms(period_id);
  CREATE INDEX IF NOT EXISTS idx_forms_unit ON forms(unit_id);
  CREATE INDEX IF NOT EXISTS idx_form_employees_form ON form_employees(form_id);
  CREATE INDEX IF NOT EXISTS idx_form_employees_employee ON form_employees(employee_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_fe ON assessments(form_employee_id);
  CREATE INDEX IF NOT EXISTS idx_assessment_items_assessment ON assessment_items(assessment_id);
  CREATE INDEX IF NOT EXISTS idx_period_items_period ON period_items(period_id);
  CREATE INDEX IF NOT EXISTS idx_employees_unit ON employees(unit_id);
  CREATE INDEX IF NOT EXISTS idx_employees_nip ON employees(nip);
  CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_history_form ON form_history(form_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

export function insert(sql, ...params) {
  return db.prepare(sql).run(...params).lastInsertRowid;
}

let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  txDepth += 1;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    txDepth -= 1;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function count(sql, ...params) {
  const row = get(sql, ...params);
  return row ? Number(row.c) : 0;
}
