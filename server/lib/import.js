import crypto from "node:crypto";
import ExcelJS from "exceljs";
import { all, get, insert, run, tx, nowIso } from "../db.js";
import { fetchSimpegIdentity } from "./simpeg.js";
import { cleanText } from "./http.js";

function norm(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function cap(list, max = 120) {
  return { items: list.slice(0, max), total: list.length, truncated: list.length > max };
}

export async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const units = [];
  const skipped = [];

  workbook.eachSheet((sheet) => {
    let headerRow = null;
    let nameCol = null;
    let nipCol = null;
    let noCol = null;
    const maxScan = Math.min(sheet.rowCount || 0, 25);
    for (let r = 1; r <= maxScan; r += 1) {
      const row = sheet.getRow(r);
      let hasName = false;
      let hasNip = false;
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const text = norm(cell.text);
        if (/^nama(\s+pegawai)?$/i.test(text) || /^nama\b/i.test(text)) {
          nameCol = col;
          hasName = true;
        }
        if (/^nip/i.test(text)) {
          nipCol = col;
          hasNip = true;
        }
        if (/^no\.?$/i.test(text)) noCol = col;
      });
      if (hasName && hasNip) {
        headerRow = r;
        break;
      }
    }
    if (!headerRow) {
      skipped.push({ sheet: sheet.name, reason: "Kolom Nama dan NIP tidak ditemukan." });
      return;
    }
    const rows = [];
    for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const nama = norm(row.getCell(nameCol).text);
      if (!nama) continue;
      if (/^(jumlah|total|rekapitulasi|keterangan)\b/i.test(nama)) continue;
      const nip = norm(row.getCell(nipCol).text);
      const no = noCol ? norm(row.getCell(noCol).text) : "";
      rows.push({ nama, nip, no, row: r });
    }
    if (!rows.length) {
      skipped.push({ sheet: sheet.name, reason: "Tidak ada baris pegawai." });
      return;
    }
    units.push({ nama: norm(sheet.name).slice(0, 120), rows });
  });

  return { units, skipped };
}

export async function validateImport(parsed, { checkSimpeg = true } = {}) {
  const totals = {
    units: parsed.units.length,
    employees: 0,
    empty_nip: 0,
    irregular: 0,
    duplicates: 0,
    existing: 0,
    simpeg_checked: 0,
    simpeg_not_found: 0,
  };
  const duplicateMap = new Map();
  const empty = [];
  const irregular = [];
  const existing = [];
  const allRows = [];

  const existingRows = all("SELECT e.nip, e.nama, u.nama AS unit FROM employees e JOIN units u ON u.id=e.unit_id");
  const existingByNip = new Map();
  existingRows.forEach((row) => {
    const key = digitsOnly(row.nip);
    if (!key) return;
    if (!existingByNip.has(key)) existingByNip.set(key, []);
    existingByNip.get(key).push(row);
  });
  const existingKeyByUnitName = new Set(
    existingRows.map((row) => `${row.unit.toLowerCase()}|${row.nama.toLowerCase()}`),
  );

  parsed.units.forEach((unit) => {
    unit.rows.forEach((row) => {
      totals.employees += 1;
      const nip = norm(row.nip);
      const digits = digitsOnly(nip);
      const item = { unit: unit.nama, nama: row.nama, nip, row: row.row };
      allRows.push(item);
      if (!nip) {
        totals.empty_nip += 1;
        if (empty.length < 300) empty.push(item);
      } else if (!/^\d{18}$/.test(nip)) {
        totals.irregular += 1;
        if (irregular.length < 300) {
          irregular.push({
            ...item,
            reason:
              digits.length === 15
                ? "NIP 15 digit"
                : /\s/.test(nip)
                  ? "NIP mengandung spasi"
                  : "Format NIP tidak beraturan",
          });
        }
      }
      if (digits) {
        if (!duplicateMap.has(digits)) duplicateMap.set(digits, []);
        duplicateMap.get(digits).push(item);
        const matches = existingByNip.get(digits);
        if (matches) {
          totals.existing += 1;
          if (existing.length < 300) existing.push({ ...item, pemilik_lama: matches.map((m) => `${m.nama} (${m.unit})`).join("; ") });
        }
      } else if (existingKeyByUnitName.has(`${unit.nama.toLowerCase()}|${row.nama.toLowerCase()}`)) {
        totals.existing += 1;
      }
    });
  });

  const duplicates = [];
  duplicateMap.forEach((rows, nip) => {
    if (rows.length > 1) {
      totals.duplicates += 1;
      duplicates.push({ nip, pemilik: rows });
    }
  });

  let simpeg = {
    checked: false,
    reachable: null,
    checked_count: 0,
    not_found: [],
    not_found_total: 0,
    note: checkSimpeg ? "" : "Pemeriksaan SIMPEG tidak dijalankan.",
  };

  if (checkSimpeg) {
    const nips = [...duplicateMap.keys()].filter((nip) => /^\d{18}$/.test(nip));
    const deadline = Date.now() + 60000;
    let cursor = 0;
    let networkErrors = 0;
    const results = new Map();
    async function worker() {
      while (cursor < nips.length && Date.now() < deadline && networkErrors < 4) {
        const idx = cursor;
        cursor += 1;
        const nip = nips[idx];
        const result = await fetchSimpegIdentity(nip);
        results.set(nip, result);
        if (result.status === "error") networkErrors += 1;
        else networkErrors = 0;
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, nips.length || 1) }, () => worker()));
    const notFound = [];
    results.forEach((result, nip) => {
      if (result.status === "not_found") {
        const owners = duplicateMap.get(nip) || [];
        owners.forEach((owner) => {
          if (notFound.length < 300) notFound.push({ ...owner, alasan: result.reason });
          simpeg.not_found_total += 1;
        });
      }
    });
    simpeg = {
      checked: true,
      reachable: results.size > 0 && !(networkErrors >= 4 && results.size === 0),
      checked_count: results.size,
      not_found: notFound,
      not_found_total: simpeg.not_found_total,
      note:
        results.size < nips.length
          ? `Pemeriksaan SIMPEG dibatasi waktu: ${results.size} dari ${nips.length} NIP diperiksa.`
          : "",
    };
    totals.simpeg_checked = results.size;
    totals.simpeg_not_found = simpeg.not_found_total;
  }

  return {
    parsed,
    report: {
      sheets: parsed.units.map((unit) => ({ nama: unit.nama, jumlah: unit.rows.length })),
      skipped: parsed.skipped,
      totals,
      duplicates: cap(duplicates),
      empty: cap(empty),
      irregular: cap(irregular),
      existing: cap(existing),
      simpeg: { ...simpeg, not_found: cap(simpeg.not_found) },
    },
    allRows,
  };
}

export function stageImport({ filename, parsed, report, userId }) {
  const id = crypto.randomUUID();
  insert(
    "INSERT INTO import_batches (id, filename, payload, created_by, created_at) VALUES (?,?,?,?,?)",
    id,
    filename,
    JSON.stringify({ units: parsed.units }),
    userId,
    nowIso(),
  );
  return id;
}

export function getImportBatch(id) {
  return get("SELECT * FROM import_batches WHERE id=?", id);
}

export function commitImport(batchId) {
  const batch = getImportBatch(batchId);
  if (!batch) {
    const error = new Error("Berkas impor tidak ditemukan atau sudah kedaluwarsa. Silakan unggah ulang.");
    error.status = 404;
    throw error;
  }
  const payload = JSON.parse(batch.payload);
  const result = {
    units_created: 0,
    employees_inserted: 0,
    employees_skipped: 0,
    new_employee_ids: [],
  };

  tx(() => {
    payload.units.forEach((unitData) => {
      let unit = get("SELECT * FROM units WHERE lower(nama)=lower(?)", unitData.nama);
      if (!unit) {
        const max = get("SELECT COALESCE(MAX(urutan),0) AS m FROM units");
        const unitId = insert(
          "INSERT INTO units (nama, urutan, aktif) VALUES (?,?,1)",
          unitData.nama,
          Number(max?.m || 0) + 1,
        );
        unit = get("SELECT * FROM units WHERE id=?", unitId);
        result.units_created += 1;
      }
      const existing = all("SELECT id, nama, nip FROM employees WHERE unit_id=?", unit.id);
      const nipSet = new Set(
        existing.map((row) => digitsOnly(row.nip)).filter(Boolean),
      );
      const nameSet = new Set(existing.map((row) => row.nama.toLowerCase()));
      unitData.rows.forEach((row) => {
        const nama = cleanText(row.nama, 200);
        if (!nama) return;
        const nip = cleanText(row.nip, 40);
        const digits = digitsOnly(nip);
        if (digits ? nipSet.has(digits) : nameSet.has(nama.toLowerCase())) {
          result.employees_skipped += 1;
          return;
        }
        const employeeId = insert(
          "INSERT INTO employees (nama, nip, unit_id, aktif, created_at) VALUES (?,?,?,1,?)",
          nama,
          nip || null,
          unit.id,
          nowIso(),
        );
        result.employees_inserted += 1;
        result.new_employee_ids.push(employeeId);
        if (digits) nipSet.add(digits);
        nameSet.add(nama.toLowerCase());
      });
    });
    run("DELETE FROM import_batches WHERE id=?", batchId);
  });

  return result;
}

export async function createImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIMPATIK";
  const guide = workbook.addWorksheet("Petunjuk");
  guide.columns = [{ width: 90 }];
  guide.addRow(["TEMPLATE IMPOR PEGAWAI SIMPATIK"]);
  guide.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0A2421" } };
  guide.addRow([]);
  [
    "1. Satu lembar kerja (tab) mewakili satu unit kerja. Nama tab menjadi nama unit.",
    "2. Setiap tab wajib memiliki kolom Nama dan NIP pada baris judul.",
    "3. Kolom No bersifat opsional.",
    "4. NIP sebaiknya ditulis sebagai teks lengkap 18 digit agar tidak berubah format.",
    "5. NIP kosong, duplikat, atau tidak lengkap tetap dapat diimpor dan akan ditandai pada laporan validasi.",
    "6. Impor akan menggabungkan data: pegawai dengan NIP yang sudah ada pada unit yang sama akan dilewati.",
    "7. Hapus baris contoh pada tab 'Contoh Unit' sebelum mengunggah data sebenarnya.",
  ].forEach((text) => {
    const row = guide.addRow([text]);
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = 30;
  });
  const sample = workbook.addWorksheet("Contoh Unit");
  sample.columns = [
    { width: 6 },
    { width: 38 },
    { width: 26 },
  ];
  sample.addRow(["No", "Nama", "NIP"]);
  sample.getRow(1).font = { bold: true };
  sample.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2EF" } };
  sample.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFC9C5" } },
        left: { style: "thin", color: { argb: "FFBFC9C5" } },
        bottom: { style: "thin", color: { argb: "FFBFC9C5" } },
        right: { style: "thin", color: { argb: "FFBFC9C5" } },
      };
    });
  });
  sample.addRow([1, "Nama Pegawai Contoh", "198001012005011001"]);
  sample.addRow([2, "Nama Pegawai Lain", "198502022010012002"]);
  sample.getColumn(3).numFmt = "@";
  return workbook.xlsx.writeBuffer();
}
