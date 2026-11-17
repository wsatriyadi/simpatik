import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { BULAN, formatDateId } from "../config.js";
import { get } from "../db.js";
import {
  formDetail,
  getPeriod,
  recap as getRecap,
} from "./stats.js";

const LOGO_BUFFER = readFileSync(
  fileURLToPath(new URL("../assets/logo-rsj.jpg", import.meta.url)),
);

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */
function reportData(formId) {
  const detail = formDetail(formId);
  if (!detail) return null;
  const { form } = detail;
  const assigned = get(
    `SELECT u.nama, u.nip, u.jabatan FROM assignments a
     JOIN users u ON u.id = a.user_id
     WHERE a.unit_id = ? ORDER BY a.id LIMIT 1`,
    form.unit_id,
  );
  const signer = form.penanda_tangan_nama
    ? {
        nama: form.penanda_tangan_nama,
        nip: form.penanda_tangan_nip,
        jabatan: form.penanda_tangan_jabatan,
      }
    : assigned || {
        nama: form.kabid_nama || "Belum ditugaskan",
        nip: form.kabid_nip,
        jabatan: form.kabid_jabatan,
      };
  const sementara = form.period_status !== "ditutup";
  const rows = detail.rows.map((row) => {
    let keterangan = row.keterangan || "";
    if (row.status === "tidak_diperiksa") {
      keterangan = `Tidak Diperiksa - ${row.alasan || "Tanpa alasan"}${keterangan ? `. ${keterangan}` : ""}`;
    } else if (row.status === "belum") {
      keterangan = "Belum Dinilai";
    } else if (row.violated.length) {
      keterangan = `Tidak memenuhi: ${row.violated.join(", ")}${keterangan ? `. ${keterangan}` : ""}`;
    }
    return { ...row, keterangan_laporan: keterangan };
  });
  return {
    ...detail,
    rows,
    signer,
    sementara,
    tanggal: form.tanggal_pemeriksaan,
    tanggal_label: form.tanggal_pemeriksaan ? formatDateId(form.tanggal_pemeriksaan) : "—",
  };
}

function fileBase(form, detail) {
  const unit = form.unit_nama
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `Laporan-${unit}-${BULAN[form.bulan - 1]}-${form.tahun}`;
}

function sheetName(value) {
  return String(value).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Laporan";
}

function styleRange(ws, row, col, rowSpan, colSpan) {
  for (let r = row; r < row + rowSpan; r += 1) {
    for (let c = col; c < col + colSpan; c += 1) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin", color: { argb: "FFD6DED9" } },
        left: { style: "thin", color: { argb: "FFD6DED9" } },
        bottom: { style: "thin", color: { argb: "FFD6DED9" } },
        right: { style: "thin", color: { argb: "FFD6DED9" } },
      };
    }
  }
}

function setCell(cell, value, options = {}) {
  cell.value = value;
  if (options.bold) cell.font = { bold: true };
  if (options.size) cell.font = { ...(cell.font || {}), size: options.size };
  if (options.color) cell.font = { ...(cell.font || {}), color: { argb: options.color } };
  if (options.fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
  }
  cell.alignment = {
    vertical: options.vAlign || "middle",
    horizontal: options.align || "left",
    wrapText: options.wrap !== false,
    textRotation: options.rotation || 0,
  };
  if (options.numFmt) cell.numFmt = options.numFmt;
  if (options.border) {
    cell.border = {
      top: { style: "thin", color: { argb: "FFBFC9C5" } },
      left: { style: "thin", color: { argb: "FFBFC9C5" } },
      bottom: { style: "thin", color: { argb: "FFBFC9C5" } },
      right: { style: "thin", color: { argb: "FFBFC9C5" } },
    };
  }
}

function addExcelLogo(workbook, ws) {
  const imageId = workbook.addImage({ buffer: LOGO_BUFFER, extension: "jpeg" });
  ws.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: 46, height: 46 },
    editAs: "oneCell",
  });
}

function excelHeaderFooter(sementara) {
  return {
    oddHeader: `&L&"Arial"&8SIMPATIK&C&"Arial,Bold"&9${sementara ? "SEMENTARA" : "LAPORAN KEPATUHAN PAKAIAN DINAS"}&R&"Arial"&8RSJ Sambang Lihum`,
    oddFooter: `&L&"Arial"&8Dicetak dari SIMPATIK&R&"Arial"&8Halaman &P dari &N`,
  };
}

/* ------------------------------------------------------------------ */
/* Excel — laporan per unit                                            */
/* ------------------------------------------------------------------ */
export async function buildFormExcel(formId) {
  const data = reportData(formId);
  if (!data) return null;
  const { form, items, rows, stats, violations, signer, sementara } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIMPATIK";
  workbook.created = new Date();
  const ws = workbook.addWorksheet(sheetName(`Ceklist ${form.unit_nama}`));
  const lastCol = 3 + items.length + 1;
  ws.columns = [
    { width: 5.5 },
    { width: 34 },
    { width: 23 },
    ...items.map(() => ({ width: 13 })),
    { width: 34 },
  ];

  ws.mergeCells(1, 1, 1, lastCol);
  setCell(ws.getCell(1, 1), "SIMPATIK — FORMULIR CEKLIST MONITORING KEPATUHAN PAKAIAN DINAS ASN", {
    bold: true,
    size: 14,
    align: "center",
    color: "FF0A2421",
  });
  ws.getRow(1).height = 54;
  addExcelLogo(workbook, ws);
  ws.mergeCells(2, 1, 2, lastCol);
  setCell(ws.getCell(2, 1), `RSJ SAMBANG LIHUM TAHUN ${form.tahun}`, {
    bold: true,
    size: 11,
    align: "center",
  });
  ws.getRow(2).height = 20;

  let rowCursor = 3;
  if (sementara) {
    ws.mergeCells(3, 1, 3, lastCol);
    setCell(ws.getCell(3, 1), "SEMENTARA — ANGKA BELUM FINAL (periode belum ditutup)", {
      bold: true,
      size: 10,
      color: "FFB3261E",
      align: "center",
      fill: "FFFDECEA",
    });
    ws.getRow(3).height = 20;
    rowCursor = 4;
  }

  const identityRows = [
    ["Bulan", `${BULAN[form.bulan - 1]} ${form.tahun}`],
    ["Instalasi / Ruangan / Unit Kerja", form.unit_nama],
    ["Hari / Tanggal", data.tanggal_label],
  ];
  identityRows.forEach(([label, value]) => {
    ws.mergeCells(rowCursor, 1, rowCursor, 1);
    setCell(ws.getCell(rowCursor, 1), label, { bold: true, size: 9 });
    ws.mergeCells(rowCursor, 2, rowCursor, Math.min(lastCol, 6));
    setCell(ws.getCell(rowCursor, 2), value, { size: 9 });
    ws.getRow(rowCursor).height = 17;
    rowCursor += 1;
  });
  ws.mergeCells(rowCursor, 1, rowCursor, 1);
  setCell(ws.getCell(rowCursor, 1), "Total Pegawai", { bold: true, size: 9 });
  ws.mergeCells(rowCursor, 2, rowCursor, Math.min(lastCol, 6));
  setCell(ws.getCell(rowCursor, 2), `${stats.total} pegawai`, { size: 9 });
  rowCursor += 1;

  const headerRow = rowCursor + 1;
  const header = ["No", "Nama", "NIP", ...items.map((item) => item.nama), "Keterangan"];
  header.forEach((label, idx) => {
    const cell = ws.getCell(headerRow, idx + 1);
    setCell(cell, label, {
      bold: true,
      size: 7.8,
      color: "FFFFFFFF",
      fill: "FF1E554E",
      align: "center",
      border: true,
    });
  });
  ws.getRow(headerRow).height = 52;

  rows.forEach((row, idx) => {
    const excelRow = headerRow + 1 + idx;
    setCell(ws.getCell(excelRow, 1), idx + 1, { align: "center", size: 8.5, border: true });
    setCell(ws.getCell(excelRow, 2), row.nama, { size: 8.5, border: true });
    setCell(ws.getCell(excelRow, 3), row.nip || "-", {
      size: 8.5,
      border: true,
      align: "center",
      numFmt: "@",
    });
    items.forEach((item, itemIdx) => {
      const value = row.items[item.id];
      const mark = row.status === "tidak_diperiksa" || row.status === "belum" ? "" : value === 1 ? "√" : value === 0 ? "×" : "";
      setCell(ws.getCell(excelRow, 4 + itemIdx), mark, {
        size: 11,
        align: "center",
        border: true,
        bold: mark === "×",
        color: mark === "×" ? "FFB3261E" : "FF1E6B50",
      });
    });
    setCell(ws.getCell(excelRow, 4 + items.length), row.keterangan_laporan, {
      size: 7.8,
      border: true,
    });
    ws.getRow(excelRow).height = row.keterangan_laporan.length > 60 ? 30 : 18;
  });

  let recapRow = headerRow + rows.length + 2;
  ws.mergeCells(recapRow, 1, recapRow, 3);
  setCell(ws.getCell(recapRow, 1), "REKAPITULASI", {
    bold: true,
    size: 10,
    fill: "FFEFF7F5",
    border: true,
  });
  recapRow += 1;

  const recapItems = [
    ["Total Pegawai Diperiksa", stats.diperiksa],
    ["Jumlah Patuh", stats.patuh],
    ["Jumlah Pelanggaran (Tidak Patuh)", stats.tidak_patuh],
    ["Jumlah Tidak Diperiksa", stats.tidak_diperiksa],
    ["Belum Dinilai", stats.belum],
    ["Persentase Kepatuhan", `${stats.pct}%`],
    ["Jenis Pelanggaran Terbanyak", violations.length ? violations.map((v) => v.nama).join("; ") : "—"],
  ];
  recapItems.forEach(([label, value]) => {
    ws.mergeCells(recapRow, 1, recapRow, 3);
    setCell(ws.getCell(recapRow, 1), label, { bold: true, size: 8.5, border: true });
    ws.mergeCells(recapRow, 4, recapRow, Math.max(6, lastCol - 1));
    setCell(ws.getCell(recapRow, 4), value, {
      size: 8.5,
      border: true,
      align: typeof value === "number" ? "center" : "left",
    });
    ws.getRow(recapRow).height = label === "Jenis Pelanggaran Terbanyak" ? 28 : 17;
    recapRow += 1;
  });

  recapRow += 1;
  ws.mergeCells(recapRow, 1, recapRow, lastCol);
  setCell(
    ws.getCell(recapRow, 1),
    "PATUH: Jika Semua Item Terpenuhi / TIDAK PATUH: Jika Salah Satu Item Tidak Terpenuhi",
    { italic: true, size: 8, color: "FF52605C" },
  );
  recapRow += 2;

  const sigStartCol = Math.max(1, lastCol - 3);
  ws.mergeCells(recapRow, sigStartCol, recapRow, lastCol);
  setCell(ws.getCell(recapRow, sigStartCol), `Atasan, ${signer.jabatan || "Kepala Bidang"}`, {
    size: 9,
    align: "left",
  });
  recapRow += 3;
  ws.mergeCells(recapRow, sigStartCol, recapRow, lastCol);
  const nameCell = ws.getCell(recapRow, sigStartCol);
  setCell(nameCell, signer.nama || "________________________", {
    bold: true,
    size: 9.5,
    align: "left",
  });
  nameCell.border = { bottom: { style: "thin", color: { argb: "FF15201E" } } };
  recapRow += 1;
  ws.mergeCells(recapRow, sigStartCol, recapRow, lastCol);
  setCell(ws.getCell(recapRow, sigStartCol), signer.nip ? `NIP. ${signer.nip}` : "NIP. ................................", {
    size: 9,
    align: "left",
  });

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + rows.length, column: lastCol },
  };
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRow}:${headerRow}`,
  };
  ws.headerFooter = excelHeaderFooter(sementara);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: `${fileBase(form, data)}.xlsx` };
}

/* ------------------------------------------------------------------ */
/* Excel — rekap gabungan                                              */
/* ------------------------------------------------------------------ */
export async function buildRecapExcel(periodId) {
  const recap = getRecap(periodId);
  if (!recap) return null;
  const { period, summary, forms, groups, violations, sementara } = recap;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIMPATIK";
  const ws = workbook.addWorksheet("Rekap Gabungan");
  ws.columns = [
    { width: 7 },
    { width: 42 },
    { width: 32 },
    { width: 9 },
    { width: 11 },
    { width: 9 },
    { width: 11 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
  ];
  const lastCol = 10;
  ws.mergeCells(1, 1, 1, lastCol);
  setCell(ws.getCell(1, 1), "SIMPATIK — REKAP GABUNGAN KEPATUHAN PAKAIAN DINAS ASN", {
    bold: true,
    size: 15,
    align: "center",
  });
  ws.getRow(1).height = 54;
  addExcelLogo(workbook, ws);
  ws.mergeCells(2, 1, 2, lastCol);
  setCell(ws.getCell(2, 1), `RSJ SAMBANG LIHUM — ${period.label.toUpperCase()}`, {
    bold: true,
    size: 11,
    align: "center",
  });
  if (period.status !== "ditutup") {
    ws.mergeCells(3, 1, 3, lastCol);
    setCell(ws.getCell(3, 1), "SEMENTARA — ANGKA BELUM FINAL", {
      bold: true,
      size: 10,
      color: "FFB3261E",
      align: "center",
      fill: "FFFDECEA",
    });
  }
  let cursor = 5;
  const summaryRows = [
    ["Total Pegawai", summary.total],
    ["Pegawai Diperiksa", summary.diperiksa],
    ["Patuh", summary.patuh],
    ["Tidak Patuh", summary.tidak_patuh],
    ["Tidak Diperiksa", summary.tidak_diperiksa],
    ["Belum Dinilai", summary.belum],
    ["Persentase Kepatuhan", `${summary.pct}%`],
    ["Pelanggaran Terbanyak", violations.length ? violations.map((v) => `${v.nama} (${v.jumlah})`).join("; ") : "—"],
    ["Unit dengan Kepatuhan Tertinggi", recap.topUnit ? `${recap.topUnit.unit} (${recap.topUnit.pct}%)` : "—"],
    ["Formulir Ditandai Selesai", `${summary.forms_complete} dari ${summary.forms_total}`],
  ];
  summaryRows.forEach(([label, value]) => {
    ws.mergeCells(cursor, 1, cursor, 3);
    setCell(ws.getCell(cursor, 1), label, { bold: true, size: 9, border: true, fill: "FFEFF7F5" });
    ws.mergeCells(cursor, 4, cursor, lastCol);
    setCell(ws.getCell(cursor, 4), value, { size: 9, border: true });
    cursor += 1;
  });

  cursor += 1;
  ws.mergeCells(cursor, 1, cursor, lastCol);
  setCell(ws.getCell(cursor, 1), "REKAP PER BIDANG / PENANGGUNG JAWAB", {
    bold: true,
    size: 10,
    fill: "FFD8ECE7",
    border: true,
  });
  cursor += 1;
  const groupHeader = ["No", "Bidang / Penanggung Jawab", "Jabatan", "Unit", "Diperiksa", "Patuh", "Tidak Patuh", "Tidak Diperiksa", "Belum", "% Patuh"];
  groupHeader.forEach((label, idx) => {
    setCell(ws.getCell(cursor, idx + 1), label, {
      bold: true,
      size: 8,
      fill: "FF1E554E",
      color: "FFFFFFFF",
      align: "center",
      border: true,
    });
  });
  ws.getRow(cursor).height = 30;
  cursor += 1;
  groups.forEach((group, idx) => {
    const values = [
      idx + 1,
      group.kabid_nama,
      group.kabid_jabatan,
      group.units.length,
      group.diperiksa,
      group.patuh,
      group.tidak_patuh,
      group.tidak_diperiksa,
      group.belum,
      `${group.pct}%`,
    ];
    values.forEach((value, col) => {
      setCell(ws.getCell(cursor, col + 1), value, {
        size: 8.5,
        border: true,
        align: col === 1 || col === 2 ? "left" : "center",
      });
    });
    cursor += 1;
  });

  cursor += 2;
  ws.mergeCells(cursor, 1, cursor, lastCol);
  setCell(ws.getCell(cursor, 1), "PERINGKAT UNIT KERJA", {
    bold: true,
    size: 10,
    fill: "FFD8ECE7",
    border: true,
  });
  cursor += 1;
  const unitHeader = ["Rank", "Unit Kerja", "Penanggung Jawab", "Total", "Diperiksa", "Patuh", "Tidak Patuh", "Tidak Diperiksa", "Belum", "% Patuh"];
  unitHeader.forEach((label, idx) => {
    setCell(ws.getCell(cursor, idx + 1), label, {
      bold: true,
      size: 8,
      fill: "FF1E554E",
      color: "FFFFFFFF",
      align: "center",
      border: true,
    });
  });
  ws.getRow(cursor).height = 30;
  cursor += 1;
  forms.forEach((form) => {
    const values = [
      form.rank,
      form.unit,
      form.kabid_nama || "Belum ditugaskan",
      form.total,
      form.diperiksa,
      form.patuh,
      form.tidak_patuh,
      form.tidak_diperiksa,
      form.belum,
      `${form.pct}%`,
    ];
    values.forEach((value, col) => {
      setCell(ws.getCell(cursor, col + 1), value, {
        size: 8.5,
        border: true,
        align: col === 1 || col === 2 ? "left" : "center",
        bold: col === 0,
      });
    });
    cursor += 1;
  });

  cursor += 2;
  ws.mergeCells(cursor, 1, cursor, lastCol);
  setCell(ws.getCell(cursor, 1), "ITEM PALING SERING DILANGGAR", {
    bold: true,
    size: 10,
    fill: "FFD8ECE7",
    border: true,
  });
  cursor += 1;
  if (violations.length) {
    violations.forEach((violation) => {
      ws.mergeCells(cursor, 1, cursor, 4);
      setCell(ws.getCell(cursor, 1), violation.nama, { size: 9, border: true });
      ws.mergeCells(cursor, 5, cursor, 6);
      setCell(ws.getCell(cursor, 5), `${violation.jumlah} pelanggaran`, {
        size: 9,
        border: true,
        align: "center",
      });
      cursor += 1;
    });
  } else {
    ws.mergeCells(cursor, 1, cursor, lastCol);
    setCell(ws.getCell(cursor, 1), "Belum ada pelanggaran tercatat.", { size: 9 });
    cursor += 1;
  }

  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.55, bottom: 0.55, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = excelHeaderFooter(sementara);
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `Rekap-Gabungan-${BULAN[period.bulan - 1]}-${period.tahun}.xlsx`,
  };
}

/* ------------------------------------------------------------------ */
/* PDF helpers                                                         */
/* ------------------------------------------------------------------ */
function pdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 34, left: 32, right: 32, bottom: 56 },
      bufferPages: true,
      info: { Title: "SIMPATIK", Author: "RSJ Sambang Lihum" },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function truncateText(doc, text, width, fontSize) {
  doc.fontSize(fontSize);
  const value = String(text ?? "");
  if (doc.widthOfString(value) <= width - 8) return value;
  let cut = value;
  while (cut.length > 4 && doc.widthOfString(`${cut}...`) > width - 8) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trim()}...`;
}

function drawCheck(doc, x, y, size, color = "#137a5f") {
  doc.save();
  doc.strokeColor(color).lineWidth(1.4);
  doc.moveTo(x, y + size * 0.55).lineTo(x + size * 0.38, y + size * 0.86).lineTo(x + size, y + size * 0.15).stroke();
  doc.restore();
}

function drawCross(doc, x, y, size, color = "#b3261e") {
  doc.save();
  doc.strokeColor(color).lineWidth(1.3);
  doc.moveTo(x, y).lineTo(x + size, y + size).stroke();
  doc.moveTo(x + size, y).lineTo(x, y + size).stroke();
  doc.restore();
}

function drawMarkCell(doc, x, y, width, height, value) {
  if (value === 1) drawCheck(doc, x + width / 2 - 5, y + height / 2 - 5, 10);
  else if (value === 0) drawCross(doc, x + width / 2 - 4.5, y + height / 2 - 4.5, 9);
}

function drawPdfTable(doc, options) {
  const {
    x,
    y: startY,
    columns,
    rows,
    headerHeight = 30,
    rowHeight = 18,
    fontSize = 7,
    bottom = doc.page.height - 58,
    repeatLabel = null,
    markColumnIndices = [],
    boldFirstColumn = false,
  } = options;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  let y = startY;

  function header() {
    doc.save();
    doc.rect(x, y, tableWidth, headerHeight).fill("#e3f0ec");
    doc.fillColor("#173a35").font("Helvetica-Bold").fontSize(fontSize);
    let cx = x;
    columns.forEach((col) => {
      doc.text(col.label, cx + 3, y + 4, {
        width: col.width - 6,
        height: headerHeight - 8,
        align: "center",
      });
      doc.rect(cx, y, col.width, headerHeight).strokeColor("#a9c4bd").lineWidth(0.6).stroke();
      cx += col.width;
    });
    doc.restore();
    y += headerHeight;
  }

  header();
  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > bottom) {
      doc.addPage();
      if (repeatLabel) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#173a35").text(repeatLabel, x, 22);
        y = 40;
      } else {
        y = 40;
      }
      header();
    }
    let cx = x;
    columns.forEach((col, colIndex) => {
      doc.save();
      if (rowIndex % 2 === 1) {
        doc.rect(cx, y, col.width, rowHeight).fill("#f7faf8");
      }
      doc.rect(cx, y, col.width, rowHeight).strokeColor("#d6e2de").lineWidth(0.45).stroke();
      doc.restore();
      if (markColumnIndices.includes(colIndex)) {
        drawMarkCell(doc, cx, y, col.width, rowHeight, row[colIndex]);
      } else {
        const value = truncateText(doc, row[colIndex] ?? "", col.width, fontSize);
        doc
          .fillColor("#1d2b28")
          .font(boldFirstColumn && colIndex === 0 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(fontSize)
          .text(value, cx + 3, y + (rowHeight - fontSize) / 2 + 1.5, {
            width: col.width - 6,
            align: col.align || "left",
            lineBreak: false,
          });
      }
      cx += col.width;
    });
    y += rowHeight;
  });
  return y;
}

function drawPdfLetterhead(doc, marginX = 32) {
  doc.image(LOGO_BUFFER, marginX, 22, { width: 44, height: 44 });
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor("#0a2421")
    .text("SIMPATIK", marginX + 50, 31, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#5b6b67")
    .text("RSJ Sambang Lihum", marginX + 50, 43, { lineBreak: false });
}

function addPdfFooters(doc, { sementara, title }) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(range.start + i);
    const page = doc.page;
    const bottomY = page.height - 48;
    const originalBottomMargin = page.margins.bottom;
    page.margins.bottom = 0;
    doc.save();
    doc.strokeColor("#cdd9d5").lineWidth(0.6).moveTo(32, bottomY - 10).lineTo(page.width - 32, bottomY - 10).stroke();
    doc
      .fillColor("#667571")
      .font("Helvetica")
      .fontSize(7)
      .text(`SIMPATIK — RSJ Sambang Lihum`, 32, bottomY, { width: 260, lineBreak: false });
    if (sementara) {
      doc.fillColor("#b3261e").font("Helvetica-Bold").fontSize(7.5).text("SEMENTARA", page.width / 2 - 40, bottomY, { width: 80, align: "center", lineBreak: false });
    } else {
      doc.fillColor("#667571").font("Helvetica").fontSize(7).text(title || "", page.width / 2 - 150, bottomY, { width: 300, align: "center", lineBreak: false });
    }
    doc
      .fillColor("#667571")
      .font("Helvetica")
      .fontSize(7)
      .text(`Halaman ${i + 1} dari ${total}`, page.width - 172, bottomY, { width: 140, align: "right", lineBreak: false });

    if (sementara) {
      doc.save();
      doc.rotate(-30, { origin: [page.width / 2, page.height / 2] });
      doc
        .opacity(0.07)
        .fillColor("#b3261e")
        .font("Helvetica-Bold")
        .fontSize(72)
        .text("SEMENTARA", 0, page.height / 2 - 30, { width: page.width, align: "center" });
      doc.restore();
      doc.opacity(1);
    }
    page.margins.bottom = originalBottomMargin;
    doc.restore();
  }
}

/* ------------------------------------------------------------------ */
/* PDF — laporan per unit                                              */
/* ------------------------------------------------------------------ */
export async function buildFormPdf(formId) {
  const data = reportData(formId);
  if (!data) return null;
  const { form, items, rows, stats, violations, signer, sementara } = data;
  const buffer = await pdfBuffer((doc) => {
    const pageWidth = doc.page.width;
    const marginX = 32;
    drawPdfLetterhead(doc, marginX);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#0a2421").text(
      "FORMULIR CEKLIST MONITORING KEPATUHAN PAKAIAN DINAS ASN",
      marginX,
      30,
      { width: pageWidth - marginX * 2, align: "center" },
    );
    doc.font("Helvetica-Bold").fontSize(9.5).text(
      `RSJ SAMBANG LIHUM TAHUN ${form.tahun}`,
      marginX,
      48,
      { width: pageWidth - marginX * 2, align: "center" },
    );
    if (sementara) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#b3261e")
        .text("SEMENTARA — ANGKA BELUM FINAL", marginX, 62, {
          width: pageWidth - marginX * 2,
          align: "center",
        });
    }

    let y = sementara ? 78 : 70;
    doc.font("Helvetica").fontSize(8).fillColor("#1d2b28");
    doc.text(`Bulan`, marginX, y);
    doc.text(`: ${BULAN[form.bulan - 1]} ${form.tahun}`, marginX + 90, y);
    doc.text(`Unit Kerja`, marginX + 300, y);
    doc.text(`: ${truncateText(doc, form.unit_nama, 260, 8)}`, marginX + 370, y);
    y += 13;
    doc.text("Hari / Tanggal", marginX, y);
    doc.text(`: ${data.tanggal_label}`, marginX + 90, y);
    doc.text("Jumlah Pegawai", marginX + 300, y);
    doc.text(`: ${stats.total} orang`, marginX + 370, y);
    y += 13;
    doc.text("Penanggung Jawab", marginX, y);
    doc.text(`: ${truncateText(doc, signer.nama || "—", 210, 8)}`, marginX + 90, y);
    doc.text("Kepatuhan", marginX + 300, y);
    doc.text(`: ${stats.pct}% (${stats.patuh} dari ${stats.diperiksa} diperiksa)`, marginX + 370, y);
    y += 16;

    const fixedWidths = 22 + 135 + 92 + 120;
    const itemWidth = Math.max(34, (pageWidth - marginX * 2 - fixedWidths) / items.length);
    const columns = [
      { label: "No", width: 22, align: "center" },
      { label: "Nama", width: 135 },
      { label: "NIP", width: 92, align: "center" },
      ...items.map((item) => ({ label: item.nama, width: itemWidth })),
      { label: "Keterangan", width: 120 },
    ];
    const tableRows = rows.map((row, idx) => [
      idx + 1,
      row.nama,
      row.nip || "-",
      ...items.map((item) => (row.status === "tidak_diperiksa" || row.status === "belum" ? null : row.items[item.id] ?? null)),
      row.keterangan_laporan,
    ]);
    const tableY = drawPdfTable(doc, {
      x: marginX,
      y,
      columns,
      rows: tableRows,
      headerHeight: 46,
      rowHeight: 19,
      fontSize: 6.8,
      bottom: doc.page.height - 70,
      repeatLabel: `Lanjutan — ${form.unit_nama} — ${BULAN[form.bulan - 1]} ${form.tahun}`,
      markColumnIndices: items.map((_, idx) => idx + 3),
      boldFirstColumn: false,
    });

    let recapY = tableY + 12;
    if (recapY + 150 > doc.page.height - 60) {
      doc.addPage();
      recapY = 40;
    }
    const recapWidth = 360;
    doc.rect(marginX, recapY, recapWidth, 146).strokeColor("#a9c4bd").lineWidth(0.7).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#173a35").text("REKAPITULASI", marginX + 10, recapY + 8);
    const recapLines = [
      ["Total Pegawai Diperiksa", `${stats.diperiksa} orang`],
      ["Jumlah Patuh", `${stats.patuh} orang`],
      ["Jumlah Pelanggaran", `${stats.tidak_patuh} orang`],
      ["Tidak Diperiksa", `${stats.tidak_diperiksa} orang`],
      ["Belum Dinilai", `${stats.belum} orang`],
      ["Persentase Kepatuhan", `${stats.pct}%`],
      ["Pelanggaran Terbanyak", violations.length ? violations.map((v) => v.nama).join("; ") : "—"],
    ];
    let lineY = recapY + 24;
    recapLines.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#36504a").text(label, marginX + 10, lineY, { width: 155 });
      doc.font("Helvetica").fontSize(7).fillColor("#1d2b28").text(`: ${value}`, marginX + 165, lineY, {
        width: recapWidth - 175,
      });
      lineY += label === "Pelanggaran Terbanyak" ? 24 : 15;
    });

    const sigX = pageWidth - marginX - 250;
    doc.font("Helvetica").fontSize(8).fillColor("#1d2b28").text(
      `Atasan, ${signer.jabatan || "Kepala Bidang"}`,
      sigX,
      recapY + 6,
      { width: 250 },
    );
    doc.font("Helvetica-Bold").fontSize(8.5).text(signer.nama || "____________________", sigX, recapY + 66, {
      width: 250,
    });
    doc.moveTo(sigX, recapY + 78).lineTo(sigX + 220, recapY + 78).strokeColor("#1d2b28").lineWidth(0.6).stroke();
    doc.font("Helvetica").fontSize(8).text(signer.nip ? `NIP. ${signer.nip}` : "NIP. ........................", sigX, recapY + 83);

    doc
      .font("Helvetica-Oblique")
      .fontSize(6.8)
      .fillColor("#52605c")
      .text(
        "PATUH: Jika Semua Item Terpenuhi / TIDAK PATUH: Jika Salah Satu Item Tidak Terpenuhi",
        marginX,
        recapY + 156,
        { width: 560 },
      );
    if (sementara) {
      doc
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .fillColor("#b3261e")
        .text("Laporan ini berstatus SEMENTARA sampai Admin menutup periode.", marginX, recapY + 168);
    }

    addPdfFooters(doc, {
      sementara,
      title: `${form.unit_nama} — ${BULAN[form.bulan - 1]} ${form.tahun}`,
    });
  });
  return { buffer, filename: `${fileBase(form, data)}.pdf` };
}

/* ------------------------------------------------------------------ */
/* PDF — rekap gabungan                                                */
/* ------------------------------------------------------------------ */
export async function buildRecapPdf(periodId) {
  const recap = getRecap(periodId);
  if (!recap) return null;
  const { period, summary, forms, groups, violations, sementara, topUnit } = recap;
  const buffer = await pdfBuffer((doc) => {
    const marginX = 32;
    const width = doc.page.width - marginX * 2;
    drawPdfLetterhead(doc, marginX);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#0a2421").text(
      "REKAP GABUNGAN KEPATUHAN PAKAIAN DINAS ASN",
      marginX,
      30,
      { width, align: "center" },
    );
    doc.font("Helvetica-Bold").fontSize(9.5).text(
      `RSJ SAMBANG LIHUM — ${period.label.toUpperCase()}`,
      marginX,
      48,
      { width, align: "center" },
    );
    if (sementara) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#b3261e")
        .text("SEMENTARA — ANGKA BELUM FINAL", marginX, 62, { width, align: "center" });
    }
    let y = sementara ? 80 : 70;

    const summaryLines = [
      ["Total Pegawai", summary.total],
      ["Diperiksa", summary.diperiksa],
      ["Patuh", summary.patuh],
      ["Tidak Patuh", summary.tidak_patuh],
      ["Tidak Diperiksa", summary.tidak_diperiksa],
      ["Belum Dinilai", summary.belum],
      ["Persentase Kepatuhan", `${summary.pct}%`],
      ["Formulir Ditandai Selesai", `${summary.forms_complete} / ${summary.forms_total}`],
    ];
    const boxWidth = 180;
    summaryLines.forEach(([label, value], idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const bx = marginX + col * boxWidth;
      const by = y + row * 30;
      doc.rect(bx, by, boxWidth - 6, 26).fillAndStroke("#f2f7f5", "#d6e2de");
      doc.fillColor("#5b6b67").font("Helvetica").fontSize(6.5).text(label.toUpperCase(), bx + 8, by + 4, { width: boxWidth - 20 });
      doc.fillColor("#173a35").font("Helvetica-Bold").fontSize(11).text(String(value), bx + 8, by + 12, { width: boxWidth - 20 });
    });
    y += 68;

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#173a35").text("REKAP PER BIDANG / PENANGGUNG JAWAB", marginX, y);
    y += 14;
    const groupColumns = [
      { label: "Bidang / Penanggung Jawab", width: 170 },
      { label: "Jabatan", width: 175 },
      { label: "Unit", width: 34, align: "center" },
      { label: "Diperiksa", width: 52, align: "center" },
      { label: "Patuh", width: 42, align: "center" },
      { label: "Tidak Patuh", width: 55, align: "center" },
      { label: "Tidak Diperiksa", width: 65, align: "center" },
      { label: "Belum", width: 42, align: "center" },
      { label: "% Patuh", width: 42, align: "center" },
    ];
    const totalGroupWidth = groupColumns.reduce((s, c) => s + c.width, 0);
    groupColumns[0].width += width - totalGroupWidth;
    y = drawPdfTable(doc, {
      x: marginX,
      y,
      columns: groupColumns,
      rows: groups.map((group) => [
        group.kabid_nama,
        group.kabid_jabatan,
        group.units.length,
        group.diperiksa,
        group.patuh,
        group.tidak_patuh,
        group.tidak_diperiksa,
        group.belum,
        `${group.pct}%`,
      ]),
      headerHeight: 26,
      rowHeight: 18,
      fontSize: 6.7,
      bottom: doc.page.height - 66,
      repeatLabel: `Rekap per Bidang — ${period.label}`,
      boldFirstColumn: true,
    });

    y += 18;
    if (y + 120 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#173a35").text("PERINGKAT UNIT KERJA", marginX, y);
    y += 14;
    const unitColumns = [
      { label: "Rank", width: 32, align: "center" },
      { label: "Unit Kerja", width: 215 },
      { label: "Penanggung Jawab", width: 170 },
      { label: "Total", width: 38, align: "center" },
      { label: "Diperiksa", width: 52, align: "center" },
      { label: "Patuh", width: 42, align: "center" },
      { label: "Tidak Patuh", width: 55, align: "center" },
      { label: "Tidak Diperiksa", width: 65, align: "center" },
      { label: "Belum", width: 42, align: "center" },
      { label: "% Patuh", width: 47, align: "center" },
    ];
    const totalUnitWidth = unitColumns.reduce((s, c) => s + c.width, 0);
    unitColumns[1].width += width - totalUnitWidth;
    y = drawPdfTable(doc, {
      x: marginX,
      y,
      columns: unitColumns,
      rows: forms.map((form) => [
        form.rank,
        form.unit,
        form.kabid_nama || "Belum ditugaskan",
        form.total,
        form.diperiksa,
        form.patuh,
        form.tidak_patuh,
        form.tidak_diperiksa,
        form.belum,
        `${form.pct}%`,
      ]),
      headerHeight: 26,
      rowHeight: 18,
      fontSize: 6.7,
      bottom: doc.page.height - 66,
      repeatLabel: `Peringkat Unit — ${period.label}`,
      boldFirstColumn: true,
    });

    y += 18;
    if (y + 90 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#173a35").text("PELANGGARAN TERBANYAK", marginX, y);
    y += 14;
    if (violations.length) {
      const text = violations.map((v) => `${v.nama} (${v.jumlah} pegawai)`).join("  •  ");
      doc.font("Helvetica").fontSize(8).fillColor("#1d2b28").text(text, marginX, y, { width });
      y += 20;
    } else {
      doc.font("Helvetica").fontSize(8).fillColor("#5b6b67").text("Belum ada pelanggaran tercatat.", marginX, y);
      y += 20;
    }
    if (topUnit) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#1d2b28")
        .text(
          `Unit dengan kepatuhan tertinggi: ${topUnit.unit} (${topUnit.pct}%).  Total pegawai diperiksa: ${summary.diperiksa} orang.`,
          marginX,
          y,
          { width },
        );
    }
    if (sementara) {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#b3261e")
        .text("Rekap ini berstatus SEMENTARA sampai Admin menutup periode.", marginX, y + 24, { width });
    }

    addPdfFooters(doc, { sementara, title: `Rekap Gabungan — ${period.label}` });
  });
  return {
    buffer,
    filename: `Rekap-Gabungan-${BULAN[period.bulan - 1]}-${period.tahun}.pdf`,
  };
}
