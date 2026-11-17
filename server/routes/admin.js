import express from "express";
import multer from "multer";
import {
  all,
  get,
  insert,
  run,
  tx,
  nowIso,
} from "../db.js";
import {
  asyncHandler,
  HttpError,
  cleanText,
  requireText,
  toInt,
} from "../lib/http.js";
import { hashPassword, validatePassword } from "../lib/auth.js";
import { BULAN, periodLabel } from "../config.js";
import {
  formDetail,
  fullName,
  getActivePeriod,
  getAssignedUnits,
  getPeriod,
  isAssigned,
  listPeriods,
  periodSummary,
  qualityStats,
  recap,
  getViolationList,
} from "../lib/stats.js";
import { audit } from "../lib/audit.js";
import {
  startBackgroundSync,
  syncEmployee,
  syncEmployees,
  simpegStatus,
  employeeIdsNeedingSync,
} from "../lib/simpeg.js";
import {
  parseWorkbook,
  validateImport,
  stageImport,
  commitImport,
  createImportTemplate,
} from "../lib/import.js";
import { witaDate } from "../config.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function bit(value, fallback = 1) {
  if (value === undefined || value === null) return fallback;
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  return 0;
}

function parseId(value, label = "ID") {
  const id = toInt(value);
  if (!id || id < 1) throw new HttpError(400, `${label} tidak valid.`);
  return id;
}

function requireUnit(unitId) {
  const unit = get("SELECT * FROM units WHERE id=?", unitId);
  if (!unit) throw new HttpError(404, "Unit kerja tidak ditemukan.");
  return unit;
}

function employeePayload(body, existing = null) {
  const nama = requireText(body.nama ?? existing?.nama, "Nama pegawai wajib diisi.", 200);
  const unitId = toInt(body.unit_id ?? existing?.unit_id);
  if (!unitId) throw new HttpError(400, "Unit kerja wajib dipilih.");
  requireUnit(unitId);
  const nip = body.nip === undefined ? existing?.nip ?? null : cleanText(body.nip, 40);
  const aktif = bit(body.aktif, existing?.aktif ?? 1);
  return { nama, nip, unitId, aktif };
}

/* ------------------------------------------------------------------ */
/* Dashboard & periods                                                 */
/* ------------------------------------------------------------------ */
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const periods = listPeriods();
    const requested = toInt(req.query.periodId);
    const active = getActivePeriod();
    const selected =
      (requested && getPeriod(requested)) ||
      active ||
      (periods.length ? getPeriod(periods[0].id) : null);
    if (!selected) {
      return res.json({
        period: null,
        periods,
        summary: null,
        forms: [],
        violations: [],
        canOpen: true,
        quality: qualityStats(),
      });
    }
    const data = periodSummary(selected.id);
    res.json({
      period: data.period,
      periods,
      summary: data.summary,
      forms: data.forms,
      violations: getViolationList(selected.id),
      activePeriod: active,
      canOpen: !active,
      quality: qualityStats(),
    });
  }),
);

router.get(
  "/periods",
  asyncHandler(async (req, res) => {
    res.json({ periods: listPeriods(), active: getActivePeriod() });
  }),
);

router.post(
  "/periods",
  asyncHandler(async (req, res) => {
    const bulan = toInt(req.body?.bulan);
    const tahun = toInt(req.body?.tahun);
    if (!bulan || bulan < 1 || bulan > 12) throw new HttpError(400, "Bulan periode tidak valid.");
    if (!tahun || tahun < 2020 || tahun > 2100) throw new HttpError(400, "Tahun periode tidak valid.");
    const active = getActivePeriod();
    if (active) {
      throw new HttpError(
        409,
        `Periode ${active.label} masih berjalan. Tutup periode tersebut sebelum membuka periode baru.`,
      );
    }
    const duplicate = get("SELECT * FROM periods WHERE bulan=? AND tahun=?", bulan, tahun);
    if (duplicate) {
      throw new HttpError(409, `Periode ${BULAN[bulan - 1]} ${tahun} sudah pernah dibuka.`);
    }
    const activeItems = all("SELECT * FROM items WHERE aktif=1 ORDER BY urutan, id");
    if (!activeItems.length) throw new HttpError(400, "Tidak ada item periksa aktif. Aktifkan minimal satu item.");
    const units = all("SELECT * FROM units WHERE aktif=1 ORDER BY urutan, nama");
    if (!units.length) throw new HttpError(400, "Tidak ada unit kerja aktif.");
    const openedAt = nowIso();
    let periodId;

    tx(() => {
      periodId = insert(
        "INSERT INTO periods (bulan, tahun, status, opened_by, opened_at) VALUES (?,?,?,?,?)",
        bulan,
        tahun,
        "berjalan",
        req.user.id,
        openedAt,
      );
      const periodItems = activeItems.map((item, idx) =>
        insert(
          "INSERT INTO period_items (period_id, item_id, nama_saat_itu, kelompok_saat_itu, urutan) VALUES (?,?,?,?,?)",
          periodId,
          item.id,
          item.nama,
          item.kelompok,
          idx + 1,
        ),
      );
      units.forEach((unit) => {
        const assignment = get(
          `SELECT u.id FROM assignments a JOIN users u ON u.id=a.user_id
           WHERE a.unit_id=? ORDER BY a.id LIMIT 1`,
          unit.id,
        );
        const formId = insert(
          "INSERT INTO forms (period_id, unit_id, kabid_id, status, created_at) VALUES (?,?,?,?,?)",
          periodId,
          unit.id,
          assignment?.id || null,
          "belum",
          openedAt,
        );
        const employees = all(
          `SELECT e.id, e.nama, e.nip, si.gelar_depan, si.gelar_belakang, si.found
           FROM employees e LEFT JOIN simpeg_identities si ON si.employee_id=e.id
           WHERE e.unit_id=? AND e.aktif=1
           ORDER BY e.nama COLLATE NOCASE, e.id`,
          unit.id,
        );
        employees.forEach((employee, idx) => {
          const nama =
            employee.found === 1
              ? fullName(employee.nama, employee.gelar_depan, employee.gelar_belakang)
              : employee.nama;
          const feId = insert(
            "INSERT INTO form_employees (form_id, employee_id, nama_saat_itu, nip_saat_itu, urutan) VALUES (?,?,?,?,?)",
            formId,
            employee.id,
            nama,
            employee.nip,
            idx + 1,
          );
          insert(
            "INSERT INTO assessments (form_employee_id, status, updated_at) VALUES (?, 'belum', ?)",
            feId,
            openedAt,
          );
        });
        insert(
          "INSERT INTO form_history (form_id, kejadian, oleh_user_id, oleh_nama, pada, catatan) VALUES (?,?,?,?,?,?)",
          formId,
          "Formulir dibuat",
          req.user.id,
          req.user.nama,
          openedAt,
          `Periode ${BULAN[bulan - 1]} ${tahun} dibuka`,
        );
      });
    });
    audit(req.user, "period", periodId, "Buka periode", {
      periode: `${BULAN[bulan - 1]} ${tahun}`,
      unit: units.length,
      item: activeItems.length,
    });
    res.status(201).json({ period: getPeriod(periodId) });
  }),
);

router.post(
  "/periods/:id/close",
  asyncHandler(async (req, res) => {
    const periodId = parseId(req.params.id, "Periode");
    const period = get("SELECT * FROM periods WHERE id=?", periodId);
    if (!period) throw new HttpError(404, "Periode tidak ditemukan.");
    if (period.status === "ditutup") throw new HttpError(409, "Periode sudah ditutup dan tidak dapat dibuka kembali.");
    const active = getActivePeriod();
    if (!active || active.id !== periodId) {
      throw new HttpError(409, "Hanya periode berjalan yang dapat ditutup.");
    }
    const forms = all(
      `SELECT f.id, f.status, u.nama AS unit,
              (SELECT COUNT(*) FROM form_employees fe WHERE fe.form_id=f.id) AS total,
              (SELECT COUNT(*) FROM form_employees fe JOIN assessments a ON a.form_employee_id=fe.id
               WHERE fe.form_id=f.id AND a.status='belum') AS belum
       FROM forms f JOIN units u ON u.id=f.unit_id WHERE f.period_id=? ORDER BY u.urutan`,
      periodId,
    );
    const incomplete = forms.filter((form) => form.status !== "selesai" || Number(form.belum) > 0);
    const force = bit(req.body?.force, 0) === 1;
    if (incomplete.length && !force) {
      throw new HttpError(409, "Masih ada formulir yang belum ditandai selesai.", {
        needsConfirmation: true,
        incomplete: incomplete.map((form) => ({
          id: form.id,
          unit: form.unit,
          status: form.status,
          total: Number(form.total),
          belum: Number(form.belum),
        })),
        count: incomplete.length,
      });
    }
    const closedAt = nowIso();
    tx(() => {
      run(
        "UPDATE periods SET status='ditutup', closed_by=?, closed_at=? WHERE id=?",
        req.user.id,
        closedAt,
        periodId,
      );
      forms.forEach((form) => {
        run("UPDATE forms SET status='terkunci' WHERE id=?", form.id);
        insert(
          "INSERT INTO form_history (form_id, kejadian, oleh_user_id, oleh_nama, pada, catatan) VALUES (?,?,?,?,?,?)",
          form.id,
          "Periode ditutup",
          req.user.id,
          req.user.nama,
          closedAt,
          "Formulir dikunci permanen",
        );
      });
    });
    audit(req.user, "period", periodId, "Tutup periode", {
      periode: periodLabel(period),
      formulirBelumSelesai: incomplete.length,
      paksa: force,
    });
    const data = periodSummary(periodId);
    res.json({ period: data.period, summary: data.summary, closed: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */
router.get(
  "/units",
  asyncHandler(async (req, res) => {
    const units = all(
      `SELECT u.*,
        (SELECT COUNT(*) FROM employees e WHERE e.unit_id=u.id AND e.aktif=1) AS pegawai_aktif,
        (SELECT COUNT(*) FROM employees e WHERE e.unit_id=u.id) AS pegawai_total,
        (SELECT COUNT(*) FROM forms f WHERE f.unit_id=u.id) AS formulir,
        (SELECT k.id FROM assignments a JOIN users k ON k.id=a.user_id WHERE a.unit_id=u.id ORDER BY a.id LIMIT 1) AS kabid_id,
        (SELECT k.nama FROM assignments a JOIN users k ON k.id=a.user_id WHERE a.unit_id=u.id ORDER BY a.id LIMIT 1) AS kabid_nama,
        (SELECT k.jabatan FROM assignments a JOIN users k ON k.id=a.user_id WHERE a.unit_id=u.id ORDER BY a.id LIMIT 1) AS kabid_jabatan
       FROM units u ORDER BY u.urutan, u.nama`,
    );
    res.json({ units });
  }),
);

router.post(
  "/units",
  asyncHandler(async (req, res) => {
    const nama = requireText(req.body?.nama, "Nama unit wajib diisi.", 160);
    const aktif = bit(req.body?.aktif, 1);
    const duplicate = get("SELECT id FROM units WHERE lower(nama)=lower(?)", nama);
    if (duplicate) throw new HttpError(409, "Nama unit sudah digunakan.");
    const max = get("SELECT COALESCE(MAX(urutan),0) AS m FROM units");
    const id = insert(
      "INSERT INTO units (nama, urutan, aktif) VALUES (?,?,?)",
      nama,
      Number(max.m) + 1,
      aktif,
    );
    audit(req.user, "unit", id, "Tambah unit", { nama });
    res.status(201).json({ unit: get("SELECT * FROM units WHERE id=?", id) });
  }),
);

router.patch(
  "/units/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Unit");
    const unit = requireUnit(id);
    const nama = req.body?.nama === undefined ? unit.nama : requireText(req.body.nama, "Nama unit wajib diisi.", 160);
    const aktif = req.body?.aktif === undefined ? unit.aktif : bit(req.body.aktif);
    const duplicate = get("SELECT id FROM units WHERE lower(nama)=lower(?) AND id<>?", nama, id);
    if (duplicate) throw new HttpError(409, "Nama unit sudah digunakan.");
    run("UPDATE units SET nama=?, aktif=? WHERE id=?", nama, aktif, id);
    audit(req.user, "unit", id, "Ubah unit", { sebelum: unit.nama, sesudah: nama, aktif });
    res.json({ unit: get("SELECT * FROM units WHERE id=?", id) });
  }),
);

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */
router.get(
  "/employees",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const pageSize = Math.min(100, Math.max(5, toInt(req.query.pageSize, 30)));
    const conditions = ["1=1"];
    const params = [];
    const q = cleanText(req.query.q, 100);
    if (q) {
      conditions.push("(e.nama LIKE ? OR e.nip LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    const unitId = toInt(req.query.unitId);
    if (unitId) {
      conditions.push("e.unit_id = ?");
      params.push(unitId);
    }
    if (req.query.aktif === "1" || req.query.aktif === "0") {
      conditions.push("e.aktif = ?");
      params.push(Number(req.query.aktif));
    }
    const simpeg = String(req.query.simpeg || "");
    if (simpeg === "ditemukan") conditions.push("si.found = 1");
    else if (simpeg === "tidak_ditemukan") {
      conditions.push("si.employee_id IS NOT NULL AND si.found = 0 AND (si.sync_error IS NULL OR si.sync_error NOT LIKE 'SIMPEG%')");
    } else if (simpeg === "gagal") {
      conditions.push("si.employee_id IS NOT NULL AND si.found = 0 AND si.sync_error LIKE 'SIMPEG%'");
    } else if (simpeg === "belum") {
      conditions.push("si.employee_id IS NULL");
    }
    const quality = String(req.query.quality || "");
    if (quality === "duplikat") {
      conditions.push(
        "e.nip IN (SELECT nip FROM employees WHERE nip IS NOT NULL AND TRIM(nip) <> '' GROUP BY nip HAVING COUNT(*) > 1)",
      );
    } else if (quality === "kosong") {
      conditions.push("(e.nip IS NULL OR TRIM(e.nip) = '')");
    } else if (quality === "tidak_lengkap") {
      conditions.push(
        "e.nip IS NOT NULL AND TRIM(e.nip) <> '' AND (LENGTH(TRIM(e.nip)) <> 18 OR e.nip GLOB '*[^0-9]*')",
      );
    }
    const where = conditions.join(" AND ");
    const totalRow = get(
      `SELECT COUNT(*) AS c FROM employees e
       LEFT JOIN simpeg_identities si ON si.employee_id=e.id
       WHERE ${where}`,
      ...params,
    );
    const rows = all(
      `SELECT e.id, e.nama, e.nip, e.aktif, e.unit_id, u.nama AS unit,
              si.gelar_depan, si.gelar_belakang, si.jabatan, si.pangkat, si.golongan,
              si.status_kepegawaian, si.found, si.sync_error, si.synced_at, si.foto_path,
              si.employee_id AS identity_employee_id,
              CASE
                WHEN si.employee_id IS NULL THEN 'belum'
                WHEN si.found = 1 THEN 'ditemukan'
                WHEN si.sync_error LIKE 'SIMPEG%' THEN 'gagal'
                ELSE 'tidak_ditemukan'
              END AS simpeg_status
       FROM employees e
       JOIN units u ON u.id=e.unit_id
       LEFT JOIN simpeg_identities si ON si.employee_id=e.id
       WHERE ${where}
       ORDER BY u.urutan, e.nama COLLATE NOCASE, e.id
       LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      (page - 1) * pageSize,
    );
    const duplicateNips = new Set(
      all(
        "SELECT nip FROM employees WHERE nip IS NOT NULL AND TRIM(nip) <> '' GROUP BY nip HAVING COUNT(*) > 1",
      ).map((row) => row.nip),
    );
    const employees = rows.map((row) => ({
      ...row,
      nama_lengkap: row.found === 1 ? fullName(row.nama, row.gelar_depan, row.gelar_belakang) : row.nama,
      nip_duplikat: row.nip ? duplicateNips.has(row.nip) : false,
      foto_url: row.foto_path ? `/api/photos/${row.id}` : null,
    }));
    res.json({
      employees,
      total: Number(totalRow.c),
      page,
      pageSize,
      quality: qualityStats(),
    });
  }),
);

router.get(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pegawai");
    const row = get(
      `SELECT e.*, u.nama AS unit, si.* FROM employees e
       JOIN units u ON u.id=e.unit_id
       LEFT JOIN simpeg_identities si ON si.employee_id=e.id
       WHERE e.id=?`,
      id,
    );
    if (!row) throw new HttpError(404, "Pegawai tidak ditemukan.");
    res.json({
      employee: {
        ...row,
        nama_lengkap:
          row.found === 1 ? fullName(row.nama, row.gelar_depan, row.gelar_belakang) : row.nama,
        foto_url: row.foto_path ? `/api/photos/${id}` : null,
      },
    });
  }),
);

router.post(
  "/employees",
  asyncHandler(async (req, res) => {
    const payload = employeePayload(req.body);
    const id = insert(
      "INSERT INTO employees (nama, nip, unit_id, aktif, created_at) VALUES (?,?,?,?,?)",
      payload.nama,
      payload.nip,
      payload.unitId,
      payload.aktif,
      nowIso(),
    );
    audit(req.user, "employee", id, "Tambah pegawai", {
      nama: payload.nama,
      nip: payload.nip,
      unit: requireUnit(payload.unitId).nama,
    });
    let sync = null;
    if (payload.nip && /^\d{18}$/.test(payload.nip)) {
      sync = startBackgroundSync([id], `Sinkronisasi pegawai baru: ${payload.nama}`);
    }
    res.status(201).json({ employee: { id, ...payload }, sync });
  }),
);

router.patch(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pegawai");
    const existing = get("SELECT * FROM employees WHERE id=?", id);
    if (!existing) throw new HttpError(404, "Pegawai tidak ditemukan.");
    const payload = employeePayload(req.body, existing);
    const nipChanged = (payload.nip || null) !== (existing.nip || null);
    run(
      "UPDATE employees SET nama=?, nip=?, unit_id=?, aktif=? WHERE id=?",
      payload.nama,
      payload.nip,
      payload.unitId,
      payload.aktif,
      id,
    );
    if (nipChanged) {
      run("DELETE FROM simpeg_identities WHERE employee_id=?", id);
    }
    audit(req.user, "employee", id, "Ubah pegawai", {
      sebelum: { nama: existing.nama, nip: existing.nip, unit_id: existing.unit_id, aktif: existing.aktif },
      sesudah: payload,
    });
    let sync = null;
    if (nipChanged && payload.nip && /^\d{18}$/.test(payload.nip)) {
      sync = startBackgroundSync([id], `Sinkronisasi perubahan NIP: ${payload.nama}`);
    }
    res.json({ employee: { id, ...payload }, sync });
  }),
);

/* ------------------------------------------------------------------ */
/* SIMPEG                                                              */
/* ------------------------------------------------------------------ */
router.post(
  "/simpeg/sync",
  asyncHandler(async (req, res) => {
    const scope = String(req.body?.scope || "employee");
    if (scope === "employee") {
      const id = parseId(req.body?.id, "Pegawai");
      const result = await syncEmployee(id);
      res.json({ result, status: simpegStatus() });
      return;
    }
    if (scope === "unit") {
      const unitId = parseId(req.body?.id, "Unit");
      requireUnit(unitId);
      const ids = all(
        "SELECT id FROM employees WHERE unit_id=? AND aktif=1 ORDER BY nama",
        unitId,
      ).map((row) => row.id);
      const summary = await syncEmployees(ids);
      res.json({ result: summary, status: simpegStatus() });
      return;
    }
    if (scope === "all") {
      const ids = all("SELECT id FROM employees WHERE aktif=1 ORDER BY id").map((row) => row.id);
      const job = startBackgroundSync(ids, "Sinkronisasi seluruh pegawai");
      res.json({ result: { queued: true, total: ids.length }, status: simpegStatus(), job });
      return;
    }
    throw new HttpError(400, "Cakupan sinkronisasi tidak dikenal.");
  }),
);

router.get(
  "/simpeg/status",
  asyncHandler(async (req, res) => {
    res.json(simpegStatus());
  }),
);

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */
router.get(
  "/import/template",
  asyncHandler(async (req, res) => {
    const buffer = await createImportTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="Template-Impor-SIMPATIK.xlsx"');
    res.send(Buffer.from(buffer));
  }),
);

router.post(
  "/import/validate",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Berkas Excel belum dipilih.");
    if (!/\.(xlsx|xlsm)$/i.test(req.file.originalname)) {
      throw new HttpError(400, "Gunakan berkas Excel berformat .xlsx atau .xlsm.");
    }
    let parsed;
    try {
      parsed = await parseWorkbook(req.file.buffer);
    } catch (error) {
      throw new HttpError(400, "Berkas Excel tidak dapat dibaca. Pastikan berkas tidak rusak.");
    }
    if (!parsed.units.length) {
      throw new HttpError(
        400,
        "Tidak ada lembar kerja dengan kolom Nama dan NIP. Periksa format berkas.",
        { skipped: parsed.skipped },
      );
    }
    const checkSimpeg = bit(req.body?.checkSimpeg, 1) === 1;
    const validation = await validateImport(parsed, { checkSimpeg });
    run(
      "DELETE FROM import_batches WHERE created_at < ?",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
    const batchId = stageImport({
      filename: req.file.originalname,
      parsed,
      report: validation.report,
      userId: req.user.id,
    });
    res.json({
      batchId,
      filename: req.file.originalname,
      report: validation.report,
    });
  }),
);

router.post(
  "/import/commit",
  asyncHandler(async (req, res) => {
    const batchId = requireText(req.body?.batchId, "Batch impor tidak valid.", 80);
    const result = commitImport(batchId);
    const inserted = result.new_employee_ids || [];
    let syncQueued = 0;
    if (inserted.length) {
      const placeholders = inserted.map(() => "?").join(",");
      const valid = all(
        `SELECT id, nip FROM employees WHERE id IN (${placeholders})`,
        ...inserted,
      ).filter((row) => /^\d{18}$/.test(String(row.nip || "")));
      if (valid.length) {
        const job = startBackgroundSync(
          valid.map((row) => row.id),
          "Sinkronisasi SIMPEG setelah impor",
        );
        if (job.queued) syncQueued = valid.length;
      }
    }
    audit(req.user, "import", null, "Impor pegawai", {
      unit_baru: result.units_created,
      pegawai_baru: result.employees_inserted,
      dilewati: result.employees_skipped,
    });
    res.json({
      ...result,
      new_employee_ids: undefined,
      sync_queued: syncQueued,
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Users & assignments                                                 */
/* ------------------------------------------------------------------ */
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = all(
      "SELECT id, nama, username, role, jabatan, nip, aktif, created_at FROM users ORDER BY role, nama COLLATE NOCASE",
    );
    const assignments = all(
      `SELECT a.user_id, a.unit_id, u.nama AS unit
       FROM assignments a JOIN units u ON u.id=a.unit_id ORDER BY u.urutan`,
    );
    const map = new Map();
    assignments.forEach((row) => {
      if (!map.has(row.user_id)) map.set(row.user_id, []);
      map.get(row.user_id).push({ id: row.unit_id, nama: row.unit });
    });
    res.json({
      users: users.map((user) => ({
        ...user,
        units: map.get(user.id) || [],
      })),
      units: all("SELECT id, nama, aktif FROM units ORDER BY urutan, nama"),
    });
  }),
);

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const role = String(req.body?.role || "kabid");
    if (!["admin", "kabid"].includes(role)) throw new HttpError(400, "Peran tidak valid.");
    const nama = requireText(req.body?.nama, "Nama pengguna wajib diisi.", 200);
    const jabatan = cleanText(req.body?.jabatan, 200);
    if (!jabatan) throw new HttpError(400, "Jabatan wajib diisi.");
    const nip = cleanText(req.body?.nip, 40);
    let username = cleanText(req.body?.username, 100);
    if (role === "kabid") {
      if (!nip) throw new HttpError(400, "NIP Kabid wajib diisi.");
      username = nip;
    }
    if (!username) throw new HttpError(400, "Username wajib diisi.");
    const password = String(req.body?.password || "");
    validatePassword(password);
    const duplicate = get("SELECT id FROM users WHERE lower(username)=lower(?)", username);
    if (duplicate) throw new HttpError(409, "Username sudah digunakan.");
    const id = insert(
      `INSERT INTO users (nama, username, password_hash, role, jabatan, nip, aktif, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      nama,
      username,
      hashPassword(password),
      role,
      jabatan,
      nip,
      bit(req.body?.aktif, 1),
      nowIso(),
    );
    audit(req.user, "user", id, "Buat akun", { nama, username, role, jabatan });
    res.status(201).json({ user: get("SELECT id, nama, username, role, jabatan, nip, aktif FROM users WHERE id=?", id) });
  }),
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pengguna");
    const user = get("SELECT * FROM users WHERE id=?", id);
    if (!user) throw new HttpError(404, "Pengguna tidak ditemukan.");
    const nama = req.body?.nama === undefined ? user.nama : requireText(req.body.nama, "Nama wajib diisi.", 200);
    const jabatan = req.body?.jabatan === undefined ? user.jabatan : cleanText(req.body.jabatan, 200);
    const nip = req.body?.nip === undefined ? user.nip : cleanText(req.body.nip, 40);
    const aktif = req.body?.aktif === undefined ? user.aktif : bit(req.body.aktif);
    if (id === req.user.id && aktif === 0) {
      throw new HttpError(400, "Anda tidak dapat menonaktifkan akun sendiri.");
    }
    let username = user.username;
    if (user.role === "kabid" && nip && nip !== user.nip) {
      const duplicate = get("SELECT id FROM users WHERE lower(username)=lower(?) AND id<>?", nip, id);
      if (duplicate) throw new HttpError(409, "NIP tersebut sudah digunakan sebagai username akun lain.");
      username = nip;
    }
    run(
      "UPDATE users SET nama=?, jabatan=?, nip=?, username=?, aktif=? WHERE id=?",
      nama,
      jabatan,
      nip,
      username,
      aktif,
      id,
    );
    if (aktif === 0) run("DELETE FROM sessions WHERE user_id=?", id);
    audit(req.user, "user", id, "Ubah akun", { nama, jabatan, nip, aktif });
    res.json({ user: get("SELECT id, nama, username, role, jabatan, nip, aktif FROM users WHERE id=?", id) });
  }),
);

router.post(
  "/users/:id/reset-password",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pengguna");
    const user = get("SELECT * FROM users WHERE id=?", id);
    if (!user) throw new HttpError(404, "Pengguna tidak ditemukan.");
    const password = String(req.body?.password || "");
    validatePassword(password);
    run("UPDATE users SET password_hash=? WHERE id=?", hashPassword(password), id);
    run("DELETE FROM sessions WHERE user_id=?", id);
    audit(req.user, "user", id, "Reset password", { nama: user.nama });
    res.json({ ok: true });
  }),
);

router.put(
  "/users/:id/assignments",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pengguna");
    const user = get("SELECT * FROM users WHERE id=?", id);
    if (!user) throw new HttpError(404, "Pengguna tidak ditemukan.");
    if (user.role !== "kabid") throw new HttpError(400, "Penugasan hanya berlaku untuk akun Kabid.");
    const raw = Array.isArray(req.body?.unitIds) ? req.body.unitIds : [];
    const unitIds = [...new Set(raw.map((value) => toInt(value)).filter((value) => value && value > 0))];
    unitIds.forEach((unitId) => requireUnit(unitId));
    tx(() => {
      run("DELETE FROM assignments WHERE user_id=?", id);
      unitIds.forEach((unitId) => {
        run("DELETE FROM assignments WHERE unit_id=? AND user_id<>?", unitId, id);
        insert("INSERT OR IGNORE INTO assignments (user_id, unit_id) VALUES (?,?)", id, unitId);
      });
    });
    audit(req.user, "assignment", id, "Ubah penugasan Kabid", {
      kabid: user.nama,
      unit: unitIds.length,
      unit_ids: unitIds,
    });
    res.json({ assignments: getAssignedUnits(id) });
  }),
);

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */
router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const items = all(
      `SELECT i.*, (SELECT COUNT(*) FROM period_items pi WHERE pi.item_id=i.id) AS dipakai
       FROM items i ORDER BY i.urutan, i.id`,
    );
    const activePeriod = getActivePeriod();
    const snapshot = activePeriod
      ? all(
          "SELECT id, item_id, nama_saat_itu AS nama, kelompok_saat_itu AS kelompok, urutan FROM period_items WHERE period_id=? ORDER BY urutan, id",
          activePeriod.id,
        )
      : [];
    res.json({ items, active_period: activePeriod, snapshot });
  }),
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const nama = requireText(req.body?.nama, "Nama item periksa wajib diisi.", 200);
    const kelompok = cleanText(req.body?.kelompok, 100) || "Atribut Lengkap";
    const max = get("SELECT COALESCE(MAX(urutan),0) AS m FROM items");
    const urutan = toInt(req.body?.urutan, Number(max.m) + 1);
    const aktif = bit(req.body?.aktif, 1);
    const id = insert(
      "INSERT INTO items (nama, kelompok, urutan, aktif) VALUES (?,?,?,?)",
      nama,
      kelompok,
      urutan,
      aktif,
    );
    const activePeriod = getActivePeriod();
    audit(req.user, "item", id, "Tambah item periksa", {
      nama,
      berlaku_mulai: "periode berikutnya",
      periode_berjalan: activePeriod?.label || null,
    });
    res.status(201).json({ item: get("SELECT * FROM items WHERE id=?", id) });
  }),
);

router.patch(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Item");
    const item = get("SELECT * FROM items WHERE id=?", id);
    if (!item) throw new HttpError(404, "Item periksa tidak ditemukan.");
    const nama = req.body?.nama === undefined ? item.nama : requireText(req.body.nama, "Nama item wajib diisi.", 200);
    const kelompok = req.body?.kelompok === undefined ? item.kelompok : cleanText(req.body.kelompok, 100);
    const urutan = req.body?.urutan === undefined ? item.urutan : toInt(req.body.urutan, item.urutan);
    const aktif = req.body?.aktif === undefined ? item.aktif : bit(req.body.aktif);
    run(
      "UPDATE items SET nama=?, kelompok=?, urutan=?, aktif=? WHERE id=?",
      nama,
      kelompok,
      urutan,
      aktif,
      id,
    );
    const activePeriod = getActivePeriod();
    audit(req.user, "item", id, "Ubah item periksa", {
      sebelum: item.nama,
      sesudah: nama,
      aktif,
      berlaku_mulai: "periode berikutnya",
      periode_berjalan: activePeriod?.label || null,
    });
    res.json({ item: get("SELECT * FROM items WHERE id=?", id) });
  }),
);

router.put(
  "/items/order",
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => toInt(id)).filter(Boolean) : [];
    if (!ids.length) throw new HttpError(400, "Urutan item tidak valid.");
    const existing = all("SELECT id FROM items");
    const existingIds = new Set(existing.map((row) => row.id));
    if (ids.some((id) => !existingIds.has(id))) throw new HttpError(400, "Item periksa tidak ditemukan.");
    tx(() => {
      ids.forEach((id, idx) => run("UPDATE items SET urutan=? WHERE id=?", idx + 1, id));
    });
    audit(req.user, "item", null, "Ubah urutan item periksa", { ids });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Recap & form detail                                                 */
/* ------------------------------------------------------------------ */
router.get(
  "/recap",
  asyncHandler(async (req, res) => {
    const periods = listPeriods();
    const requested = toInt(req.query.periodId);
    const active = getActivePeriod();
    const selected =
      (requested && getPeriod(requested)) ||
      active ||
      (periods.length ? getPeriod(periods[0].id) : null);
    if (!selected) {
      return res.json({ period: null, periods, recap: null, sementara: false });
    }
    const data = recap(selected.id);
    res.json({
      period: data.period,
      periods,
      recap: {
        summary: data.summary,
        forms: data.forms,
        groups: data.groups,
        violations: data.violations,
        topUnit: data.topUnit,
      },
      sementara: selected.status !== "ditutup",
    });
  }),
);

router.get(
  "/forms/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Formulir");
    const detail = formDetail(id);
    if (!detail) throw new HttpError(404, "Formulir tidak ditemukan.");
    res.json({ ...detail });
  }),
);

router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 50)));
    const rows = all(
      "SELECT * FROM audit_log ORDER BY pada DESC, id DESC LIMIT ?",
      limit,
    );
    res.json({ entries: rows });
  }),
);

router.get(
  "/simpeg/candidates",
  asyncHandler(async (req, res) => {
    res.json({ ids: employeeIdsNeedingSync() });
  }),
);

router.get("/date", (req, res) => res.json({ date: witaDate() }));

export default router;
