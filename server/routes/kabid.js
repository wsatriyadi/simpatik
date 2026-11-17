import express from "express";
import { all, get, insert, run, tx, nowIso } from "../db.js";
import { asyncHandler, HttpError, cleanText, toInt } from "../lib/http.js";
import { ALASAN_TIDAK_DIPERIKSA, BULAN, witaDate } from "../config.js";
import {
  canAccessForm,
  canFillForm,
  formEmployeeDetail,
  formEmployeesForUnit,
  formStats,
  getActivePeriod,
  getFormBase,
  getFormHistory,
  getFormItems,
  getViolations,
  kabidForms,
  kabidHome,
} from "../lib/stats.js";

const router = express.Router();

function parseId(value, label = "ID") {
  const id = toInt(value);
  if (!id || id < 1) throw new HttpError(400, `${label} tidak valid.`);
  return id;
}

function findUnitFormForUser(user, unitId, periodId) {
  const unit = get("SELECT * FROM units WHERE id=?", unitId);
  if (!unit) throw new HttpError(404, "Unit kerja tidak ditemukan.");
  const assigned = get(
    "SELECT 1 AS ok FROM assignments WHERE user_id=? AND unit_id=?",
    user.id,
    unitId,
  );
  if (!assigned) throw new HttpError(403, "Unit ini bukan bagian dari tugas Anda.");
  const form = get(
    "SELECT * FROM forms WHERE period_id=? AND unit_id=?",
    periodId,
    unitId,
  );
  if (!form) throw new HttpError(404, "Formulir unit ini belum tersedia pada periode berjalan.");
  const base = getFormBase(form.id);
  if (!canAccessForm(user, base)) throw new HttpError(403, "Anda tidak memiliki akses ke formulir ini.");
  return { unit, form: base };
}

router.get(
  "/home",
  asyncHandler(async (req, res) => {
    res.json(kabidHome(req.user.id));
  }),
);

router.get(
  "/units/:unitId",
  asyncHandler(async (req, res) => {
    const unitId = parseId(req.params.unitId, "Unit");
    const period = getActivePeriod();
    if (!period) {
      const unit = get("SELECT * FROM units WHERE id=?", unitId);
      if (!unit) throw new HttpError(404, "Unit kerja tidak ditemukan.");
      const assigned = get(
        "SELECT 1 AS ok FROM assignments WHERE user_id=? AND unit_id=?",
        req.user.id,
        unitId,
      );
      if (!assigned) throw new HttpError(403, "Unit ini bukan bagian dari tugas Anda.");
      return res.json({ period: null, unit, form: null, employees: [], items: [], can_fill: false });
    }
    const { unit, form } = findUnitFormForUser(req.user, unitId, period.id);
    const stats = formStats(form.id);
    const employees = formEmployeesForUnit(form.id);
    const items = getFormItems(form.id);
    res.json({
      period,
      unit,
      form: { ...form, ...stats, remaining: stats.belum },
      stats,
      employees,
      items,
      can_fill: canFillForm(req.user, form),
      sementara: true,
    });
  }),
);

router.get(
  "/form-employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pegawai formulir");
    const data = formEmployeeDetail(id);
    if (!data) throw new HttpError(404, "Data pegawai pada formulir tidak ditemukan.");
    const form = getFormBase(data.employee.form_id);
    if (!canAccessForm(req.user, form)) {
      throw new HttpError(403, "Anda tidak memiliki akses ke pegawai ini.");
    }
    const canEdit = canFillForm(req.user, form);
    res.json({
      employee: {
        ...data.employee,
        can_edit: canEdit,
        read_only_reason:
          canEdit
            ? null
            : form.period_status === "ditutup"
              ? "Periode sudah ditutup."
              : "Formulir ini bukan tugas Anda atau sudah dikunci.",
      },
      items: data.items,
      form,
      stats: formStats(form.id),
      sementara: form.period_status !== "ditutup",
    });
  }),
);

router.put(
  "/form-employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "Pegawai formulir");
    const data = formEmployeeDetail(id);
    if (!data) throw new HttpError(404, "Data pegawai pada formulir tidak ditemukan.");
    const form = getFormBase(data.employee.form_id);
    if (!canFillForm(req.user, form)) {
      throw new HttpError(403, "Formulir tidak dapat diubah. Periode mungkin sudah ditutup atau bukan tugas Anda.");
    }
    const assessment = get("SELECT * FROM assessments WHERE form_employee_id=?", id);
    if (!assessment) throw new HttpError(404, "Penilaian tidak ditemukan.");
    const periodItems = getFormItems(form.id);
    const tidakDiperiksa = req.body?.tidak_diperiksa === true || req.body?.tidak_diperiksa === 1;
    const keterangan = cleanText(req.body?.keterangan, 500);
    let status;
    let alasan = null;
    let itemValues = [];

    if (tidakDiperiksa) {
      alasan = cleanText(req.body?.alasan, 60);
      if (!ALASAN_TIDAK_DIPERIKSA.includes(alasan)) {
        throw new HttpError(400, "Alasan Tidak Diperiksa wajib dipilih.");
      }
      status = "tidak_diperiksa";
    } else {
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
      const map = new Map();
      rawItems.forEach((item) => {
        const itemId = toInt(item?.id);
        if (itemId) map.set(itemId, item?.memenuhi === true || item?.memenuhi === 1 ? 1 : 0);
      });
      if (periodItems.some((item) => !map.has(item.id))) {
        throw new HttpError(400, "Seluruh item periksa wajib dinilai.");
      }
      itemValues = periodItems.map((item) => ({ id: item.id, memenuhi: map.get(item.id) }));
      status = itemValues.every((item) => item.memenuhi === 1) ? "patuh" : "tidak_patuh";
    }

    const at = nowIso();
    tx(() => {
      if (form.status === "selesai") {
        run(
          `UPDATE forms SET status='sedang', completed_at=NULL, tanggal_pemeriksaan=NULL,
           penanda_tangan_nama=NULL, penanda_tangan_nip=NULL, penanda_tangan_jabatan=NULL
           WHERE id=?`,
          form.id,
        );
        insert(
          "INSERT INTO form_history (form_id, kejadian, oleh_user_id, oleh_nama, pada, catatan) VALUES (?,?,?,?,?,?)",
          form.id,
          "Diubah setelah ditandai selesai",
          req.user.id,
          req.user.nama,
          at,
          "Status formulir kembali menjadi Sedang Diisi; penandaan selesai sebelumnya dibatalkan",
        );
      } else if (form.status === "belum") {
        run("UPDATE forms SET status='sedang' WHERE id=?", form.id);
      }
      run(
        `UPDATE assessments SET status=?, alasan_tidak_diperiksa=?, keterangan=?, dinilai_oleh=?,
         dinilai_pada=?, updated_at=? WHERE id=?`,
        status,
        alasan,
        keterangan,
        req.user.id,
        at,
        at,
        assessment.id,
      );
      run("DELETE FROM assessment_items WHERE assessment_id=?", assessment.id);
      if (status !== "tidak_diperiksa") {
        itemValues.forEach((item) => {
          insert(
            "INSERT INTO assessment_items (assessment_id, period_item_id, memenuhi) VALUES (?,?,?)",
            assessment.id,
            item.id,
            item.memenuhi,
          );
        });
      }
    });

    const next = get(
      `SELECT fe.id FROM form_employees fe
       LEFT JOIN assessments a ON a.form_employee_id=fe.id
       WHERE fe.form_id=? AND fe.id<>? AND (a.id IS NULL OR a.status='belum')
       ORDER BY CASE WHEN fe.urutan > ? THEN 0 ELSE 1 END, fe.urutan, fe.id
       LIMIT 1`,
      form.id,
      id,
      data.employee.urutan,
    );
    const stats = formStats(form.id);
    res.json({
      assessment: { status, alasan, keterangan, dinilai_pada: at },
      form_stats: stats,
      next_id: next?.id || null,
    });
  }),
);

router.post(
  "/forms/:formId/complete",
  asyncHandler(async (req, res) => {
    const formId = parseId(req.params.formId, "Formulir");
    const form = getFormBase(formId);
    if (!form) throw new HttpError(404, "Formulir tidak ditemukan.");
    if (!canFillForm(req.user, form)) {
      throw new HttpError(403, "Formulir tidak dapat ditandai selesai.");
    }
    const stats = formStats(formId);
    if (stats.belum > 0) {
      throw new HttpError(
        400,
        `Masih ada ${stats.belum} pegawai yang belum dinilai. Selesaikan seluruh penilaian terlebih dahulu.`,
        { belum: stats.belum },
      );
    }
    const at = nowIso();
    const tanggal = witaDate();
    const wasComplete = form.status === "selesai";
    tx(() => {
      run(
        `UPDATE forms SET status='selesai', completed_at=?, tanggal_pemeriksaan=?,
         penanda_tangan_nama=?, penanda_tangan_nip=?, penanda_tangan_jabatan=? WHERE id=?`,
        at,
        tanggal,
        req.user.nama,
        req.user.nip,
        req.user.jabatan,
        formId,
      );
      insert(
        "INSERT INTO form_history (form_id, kejadian, oleh_user_id, oleh_nama, pada, catatan) VALUES (?,?,?,?,?,?)",
        formId,
        wasComplete ? "Penandaan selesai diperbarui" : "Ditandai selesai",
        req.user.id,
        req.user.nama,
        at,
        `Tanggal pemeriksaan ${tanggal}`,
      );
    });
    res.json({
      form: getFormBase(formId),
      stats: formStats(formId),
      tanggal_pemeriksaan: tanggal,
    });
  }),
);

router.get(
  "/forms/:formId",
  asyncHandler(async (req, res) => {
    const formId = parseId(req.params.formId, "Formulir");
    const form = getFormBase(formId);
    if (!form) throw new HttpError(404, "Formulir tidak ditemukan.");
    if (!canAccessForm(req.user, form)) {
      throw new HttpError(403, "Anda tidak memiliki akses ke formulir ini.");
    }
    const stats = formStats(formId);
    res.json({
      form,
      stats,
      violations: getViolations({ formId }),
      history: getFormHistory(formId),
      can_fill: canFillForm(req.user, form),
      sementara: form.period_status !== "ditutup",
      can_complete: stats.belum === 0,
    });
  }),
);

router.get(
  "/recap",
  asyncHandler(async (req, res) => {
    const period = getActivePeriod();
    if (!period) {
      return res.json({ period: null, summary: null, forms: [], violations: [], sementara: false });
    }
    const forms = kabidForms(req.user.id, period.id)
      .map((form) => ({ ...form, remaining: form.belum }))
      .sort((a, b) => b.pct - a.pct || a.unit.localeCompare(b.unit, "id"));
    const summary = {
      total: forms.reduce((sum, form) => sum + form.total, 0),
      patuh: forms.reduce((sum, form) => sum + form.patuh, 0),
      tidak_patuh: forms.reduce((sum, form) => sum + form.tidak_patuh, 0),
      tidak_diperiksa: forms.reduce((sum, form) => sum + form.tidak_diperiksa, 0),
      belum: forms.reduce((sum, form) => sum + form.belum, 0),
      diperiksa: forms.reduce((sum, form) => sum + form.diperiksa, 0),
      answered: forms.reduce((sum, form) => sum + form.answered, 0),
    };
    summary.pct = summary.diperiksa
      ? Math.round((summary.patuh / summary.diperiksa) * 100)
      : 0;
    const violations = all(
      `SELECT pi.id, pi.nama_saat_itu AS nama, COUNT(*) AS jumlah, pi.urutan
       FROM assessment_items ai
       JOIN assessments a ON a.id=ai.assessment_id
       JOIN form_employees fe ON fe.id=a.form_employee_id
       JOIN forms f ON f.id=fe.form_id
       JOIN period_items pi ON pi.id=ai.period_item_id
       WHERE f.period_id=? AND f.unit_id IN (SELECT unit_id FROM assignments WHERE user_id=?)
         AND ai.memenuhi=0
       GROUP BY pi.id ORDER BY jumlah DESC, pi.urutan`,
      period.id,
      req.user.id,
    );
    const max = violations.length ? Number(violations[0].jumlah) : 0;
    res.json({
      period,
      summary,
      forms,
      violations: violations.filter((row) => Number(row.jumlah) === max),
      violation_list: violations,
      sementara: true,
    });
  }),
);

export default router;
