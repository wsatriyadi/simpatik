import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(__dirname, "data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");
export const DB_PATH = process.env.SIMPATIK_DB || path.join(DATA_DIR, "simpatik.db");
export const PORT = Number(process.env.PORT || 3001);
export const HOST = process.env.HOST || "0.0.0.0";
export const APP_NAME = "SIMPATIK";
export const APP_VERSION = "1.0.0";

export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const ALASAN_TIDAK_DIPERIKSA = [
  "Cuti",
  "Sakit",
  "Dinas Luar/Tugas",
  "Lainnya",
];

export const SIMPEG_API =
  process.env.SIMPEG_API_URL || "https://simpeg.kalselprov.go.id/api/identitas?nip=";

export function periodLabel(period) {
  if (!period) return "—";
  return `${BULAN[period.bulan - 1]} ${period.tahun}`;
}

export function witaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateId(value) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00+08:00`) : value;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
