import type { AssessmentStatus, FormStatus } from "./types";

export const MONTHS = [
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

const TZ = "Asia/Makassar";

function toDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+08:00`);
  return new Date(value);
}

export function formatDate(
  value: string | null | undefined,
  style: "long" | "medium" | "short" | "datetime" | "time" = "medium",
): string {
  if (!value) return "—";
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions = { timeZone: TZ };
  if (style === "long") {
    options.weekday = "long";
    options.day = "numeric";
    options.month = "long";
    options.year = "numeric";
  } else if (style === "medium") {
    options.day = "numeric";
    options.month = "long";
    options.year = "numeric";
  } else if (style === "short") {
    options.day = "2-digit";
    options.month = "short";
    options.year = "numeric";
  } else if (style === "datetime") {
    options.day = "numeric";
    options.month = "short";
    options.year = "numeric";
    options.hour = "2-digit";
    options.minute = "2-digit";
  } else {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("id-ID", options).format(date).replace(/\./g, ":");
}

export function formatPeriod(bulan: number, tahun: number): string {
  return `${MONTHS[bulan - 1]} ${tahun}`;
}

export function todayWita(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

const TITLES = ["h.", "hj.", "dr.", "drg.", "prof.", "hajjah", "haji"];

export function initials(name: string): string {
  const clean = (name || "")
    .split(",")[0]
    .trim()
    .split(/\s+/)
    .filter((word) => !TITLES.includes(word.toLowerCase()));
  const first = clean[0]?.[0] || "?";
  const last = clean.length > 1 ? clean[clean.length - 1][0] : clean[0]?.[1] || "";
  return `${first}${last}`.toUpperCase();
}

export function shortName(name: string): string {
  const clean = (name || "")
    .split(",")[0]
    .trim()
    .split(/\s+/)
    .filter((word) => !TITLES.includes(word.toLowerCase()));
  return clean[0] || name;
}

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export type Tone = "green" | "red" | "amber" | "blue" | "slate" | "gold" | "dark" | "brand";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const ASSESSMENT_META: Record<AssessmentStatus, StatusMeta> = {
  belum: { label: "Belum Dinilai", tone: "slate" },
  patuh: { label: "Patuh", tone: "green" },
  tidak_patuh: { label: "Tidak Patuh", tone: "red" },
  tidak_diperiksa: { label: "Tidak Diperiksa", tone: "amber" },
};

export const FORM_META: Record<FormStatus, StatusMeta> = {
  belum: { label: "Belum Mulai", tone: "slate" },
  sedang: { label: "Sedang Diisi", tone: "blue" },
  selesai: { label: "Ditandai Selesai", tone: "green" },
  terkunci: { label: "Terkunci", tone: "dark" },
};

export function pctTone(pct: number): Tone {
  if (pct >= 90) return "green";
  if (pct >= 75) return "blue";
  if (pct >= 60) return "amber";
  return "red";
}

export function nisNip(nip: string | null | undefined): boolean {
  return Boolean(nip && /^\d{18}$/.test(nip));
}

export function classNames(...values: Array<string | null | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}
