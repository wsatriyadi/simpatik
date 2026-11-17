import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { PHOTO_DIR, SIMPEG_API } from "../config.js";
import { all, get, insert, nowIso, run } from "../db.js";

const MAX_PHOTO = 6 * 1024 * 1024;

function photoUrlFrom(images) {
  if (!images) return null;
  if (typeof images === "string") return images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (typeof image === "string") return image;
      if (image && typeof image === "object") {
        const url = image.url || image.foto || image.src || image.path;
        if (url) return url;
      }
    }
  }
  if (typeof images === "object") {
    return images.url || images.foto || images.src || null;
  }
  return null;
}

function statusText(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const map = { "1": "PNS", "2": "PPPK", "3": "PPPK Paruh Waktu" };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase();
  if (lower === "pns" || lower === "pppk") return raw.toUpperCase();
  if (lower.includes("paruh")) return "PPPK Paruh Waktu";
  if (lower.includes("pppk")) return "PPPK";
  if (lower.includes("pns")) return "PNS";
  return raw;
}

export async function fetchSimpegIdentity(nip) {
  const clean = String(nip || "").trim();
  if (!/^\d{18}$/.test(clean)) {
    return {
      status: "not_found",
      reason: clean
        ? "NIP tidak lengkap / format tidak beraturan."
        : "NIP kosong.",
    };
  }
  try {
    const url = `${SIMPEG_API}${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "SIMPATIK-RSJSL/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return { status: "not_found", reason: "NIP tidak ditemukan di SIMPEG." };
    }
    if (!res.ok) {
      return { status: "error", reason: `SIMPEG mengembalikan HTTP ${res.status}.` };
    }
    const data = await res.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : data && typeof data === "object" && (data.nip || data.nama)
          ? [data]
          : [];
    if (!list.length) {
      return { status: "not_found", reason: "NIP tidak ditemukan di SIMPEG." };
    }
    const item = list[0];
    return {
      status: "found",
      data: {
        nip: String(item.nip || clean),
        nama: item.nama || item.nama_lengkap || null,
        gelar_depan: item.gelar_depan || null,
        gelar_belakang: item.gelar_belakang || null,
        jabatan: item.jabatan || null,
        pangkat: item.pangkat || null,
        golongan: item.golongan || null,
        status_kepegawaian: statusText(item.status_pns ?? item.status_kepegawaian),
        satker: item.satker || null,
        unker: item.unker || null,
      },
      photoUrl: photoUrlFrom(item.images),
    };
  } catch (error) {
    return {
      status: "error",
      reason:
        error?.name === "TimeoutError"
          ? "SIMPEG tidak merespons (waktu habis)."
          : `SIMPEG tidak dapat dijangkau: ${error?.message || "kesalahan jaringan"}`,
    };
  }
}

async function downloadPhoto(employeeId, photoUrl) {
  if (!photoUrl) return null;
  try {
    const base = new URL(SIMPEG_API);
    const url = new URL(photoUrl, base.origin).toString();
    const res = await fetch(url, {
      headers: { Accept: "image/*", "User-Agent": "SIMPATIK-RSJSL/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_PHOTO) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const filename = `${employeeId}.${ext}`;
    const absolute = path.join(PHOTO_DIR, filename);
    await fsp.writeFile(absolute, buffer);
    for (const other of ["jpg", "png", "webp"]) {
      if (other === ext) continue;
      try {
        fs.rmSync(path.join(PHOTO_DIR, `${employeeId}.${other}`), { force: true });
      } catch {
        /* ignore */
      }
    }
    return { foto_path: `photos/${filename}`, foto_mime: type };
  } catch {
    return null;
  }
}

function removePhoto(employeeId) {
  for (const ext of ["jpg", "png", "webp"]) {
    try {
      fs.rmSync(path.join(PHOTO_DIR, `${employeeId}.${ext}`), { force: true });
    } catch {
      /* ignore */
    }
  }
}

function upsertIdentity(employeeId, values) {
  const exists = get("SELECT employee_id FROM simpeg_identities WHERE employee_id=?", employeeId);
  if (!exists) {
    insert(
      `INSERT INTO simpeg_identities
       (employee_id, nama_simpeg, gelar_depan, gelar_belakang, jabatan, pangkat, golongan,
        status_kepegawaian, satker, unker, url_foto, foto_path, foto_mime, found, sync_error, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      employeeId,
      values.nama_simpeg ?? null,
      values.gelar_depan ?? null,
      values.gelar_belakang ?? null,
      values.jabatan ?? null,
      values.pangkat ?? null,
      values.golongan ?? null,
      values.status_kepegawaian ?? null,
      values.satker ?? null,
      values.unker ?? null,
      values.url_foto ?? null,
      values.foto_path ?? null,
      values.foto_mime ?? null,
      values.found ?? 0,
      values.sync_error ?? null,
      values.synced_at ?? nowIso(),
    );
  } else {
    run(
      `UPDATE simpeg_identities SET nama_simpeg=?, gelar_depan=?, gelar_belakang=?, jabatan=?,
        pangkat=?, golongan=?, status_kepegawaian=?, satker=?, unker=?, url_foto=?,
        foto_path=COALESCE(?, foto_path), foto_mime=COALESCE(?, foto_mime), found=?,
        sync_error=?, synced_at=? WHERE employee_id=?`,
      values.nama_simpeg ?? null,
      values.gelar_depan ?? null,
      values.gelar_belakang ?? null,
      values.jabatan ?? null,
      values.pangkat ?? null,
      values.golongan ?? null,
      values.status_kepegawaian ?? null,
      values.satker ?? null,
      values.unker ?? null,
      values.url_foto ?? null,
      values.foto_path ?? null,
      values.foto_mime ?? null,
      values.found ?? 0,
      values.sync_error ?? null,
      values.synced_at ?? nowIso(),
      employeeId,
    );
  }
}

export async function syncEmployee(employeeId, { photo = true } = {}) {
  const employee = get("SELECT * FROM employees WHERE id=?", employeeId);
  if (!employee) return { status: "error", reason: "Pegawai tidak ditemukan." };
  const result = await fetchSimpegIdentity(employee.nip);
  const at = nowIso();

  if (result.status === "error") {
    upsertIdentity(employeeId, {
      found: 0,
      sync_error: result.reason,
      synced_at: at,
    });
    return { employee_id: employeeId, status: "error", reason: result.reason };
  }

  if (result.status === "not_found") {
    removePhoto(employeeId);
    upsertIdentity(employeeId, {
      found: 0,
      sync_error: result.reason,
      synced_at: at,
    });
    return { employee_id: employeeId, status: "not_found", reason: result.reason };
  }

  let photoValues = null;
  if (photo && result.photoUrl) {
    photoValues = await downloadPhoto(employeeId, result.photoUrl);
  }
  upsertIdentity(employeeId, {
    nama_simpeg: result.data.nama,
    gelar_depan: result.data.gelar_depan,
    gelar_belakang: result.data.gelar_belakang,
    jabatan: result.data.jabatan,
    pangkat: result.data.pangkat,
    golongan: result.data.golongan,
    status_kepegawaian: result.data.status_kepegawaian,
    satker: result.data.satker,
    unker: result.data.unker,
    url_foto: result.photoUrl,
    found: 1,
    sync_error: null,
    synced_at: at,
    ...(photoValues || {}),
  });
  return { employee_id: employeeId, status: "found" };
}

export async function syncEmployees(employeeIds, { concurrency = 3 } = {}) {
  const ids = [...new Set(employeeIds)];
  const summary = {
    total: ids.length,
    found: 0,
    not_found: 0,
    error: 0,
    aborted: false,
    started_at: nowIso(),
    finished_at: null,
  };
  let cursor = 0;
  let consecutiveErrors = 0;

  async function worker() {
    while (cursor < ids.length && !summary.aborted) {
      const idx = cursor;
      cursor += 1;
      const id = ids[idx];
      let result;
      try {
        result = await syncEmployee(id);
      } catch (error) {
        result = { status: "error", reason: error?.message };
      }
      if (result.status === "found") {
        summary.found += 1;
        consecutiveErrors = 0;
      } else if (result.status === "not_found") {
        summary.not_found += 1;
        consecutiveErrors = 0;
      } else {
        summary.error += 1;
        consecutiveErrors += 1;
        if (consecutiveErrors >= 5) summary.aborted = true;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length || 1) }, () => worker()),
  );
  summary.finished_at = nowIso();
  return summary;
}

let currentJob = null;

export function simpegStatus() {
  if (!currentJob) return { running: false };
  return {
    running: currentJob.running,
    total: currentJob.total,
    label: currentJob.label,
    started_at: currentJob.started_at,
    finished_at: currentJob.finished_at,
    result: currentJob.result || null,
  };
}

export function startBackgroundSync(employeeIds, label = "Sinkronisasi SIMPEG") {
  if (currentJob?.running) {
    return { queued: false, reason: "Sinkronisasi lain sedang berjalan." };
  }
  const ids = [...new Set(employeeIds)].filter(Boolean);
  currentJob = {
    running: true,
    total: ids.length,
    label,
    started_at: nowIso(),
    finished_at: null,
    result: null,
  };
  setImmediate(async () => {
    try {
      currentJob.result = await syncEmployees(ids);
    } catch (error) {
      currentJob.result = { total: ids.length, error: 1, reason: error?.message };
    } finally {
      currentJob.running = false;
      currentJob.finished_at = nowIso();
    }
  });
  return { queued: true, total: ids.length };
}

export function employeeIdsNeedingSync() {
  return all(
    `SELECT e.id FROM employees e
     LEFT JOIN simpeg_identities si ON si.employee_id=e.id
     WHERE e.aktif=1 AND (si.employee_id IS NULL OR si.found=0 OR si.synced_at IS NULL)`,
  ).map((row) => row.id);
}
