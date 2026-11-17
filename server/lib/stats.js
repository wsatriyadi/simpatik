import { all, get } from "../db.js";
import { BULAN, periodLabel } from "../config.js";

export function fullName(nama, depan, belakang) {
  if (!nama) return "";
  const d = depan ? `${depan} ` : "";
  const b = belakang ? `, ${belakang}` : "";
  return `${d}${nama}${b}`;
}

export function getPeriod(periodId) {
  if (!periodId) return null;
  const row = get("SELECT * FROM periods WHERE id=?", periodId);
  return row ? { ...row, label: periodLabel(row) } : null;
}

export function getActivePeriod() {
  const row = get("SELECT * FROM periods WHERE status='berjalan' ORDER BY id DESC LIMIT 1");
  return row ? { ...row, label: periodLabel(row) } : null;
}

export function listPeriods() {
  return all("SELECT * FROM periods ORDER BY tahun DESC, bulan DESC").map((row) => ({
    ...row,
    label: periodLabel(row),
  }));
}

export function getFormBase(formId) {
  const row = get(
    `SELECT f.*, u.nama AS unit_nama, u.aktif AS unit_aktif, u.urutan AS unit_urutan,
            p.bulan, p.tahun, p.status AS period_status, p.opened_at, p.closed_at,
            k.nama AS kabid_nama, k.jabatan AS kabid_jabatan, k.nip AS kabid_nip
     FROM forms f
     JOIN units u ON u.id = f.unit_id
     JOIN periods p ON p.id = f.period_id
     LEFT JOIN users k ON k.id = f.kabid_id
     WHERE f.id = ?`,
    formId,
  );
  if (!row) return null;
  return {
    ...row,
    periode_label: `${BULAN[row.bulan - 1]} ${row.tahun}`,
    unit: row.unit_nama,
    is_locked: row.status === "terkunci" || row.period_status === "ditutup",
  };
}

export function formStats(formId) {
  const row = get(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN a.status='patuh' THEN 1 ELSE 0 END),0) AS patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_patuh' THEN 1 ELSE 0 END),0) AS tidak_patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_diperiksa' THEN 1 ELSE 0 END),0) AS tidak_diperiksa,
            COALESCE(SUM(CASE WHEN a.status='belum' OR a.id IS NULL THEN 1 ELSE 0 END),0) AS belum
     FROM form_employees fe
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE fe.form_id = ?`,
    formId,
  );
  return normalizeStats(row);
}

export function normalizeStats(row) {
  const total = Number(row?.total || 0);
  const patuh = Number(row?.patuh || 0);
  const tidakPatuh = Number(row?.tidak_patuh || 0);
  const tidakDiperiksa = Number(row?.tidak_diperiksa || 0);
  const belum = Number(row?.belum || 0);
  const diperiksa = patuh + tidakPatuh;
  const answered = diperiksa + tidakDiperiksa;
  return {
    total,
    patuh,
    tidak_patuh: tidakPatuh,
    tidak_diperiksa: tidakDiperiksa,
    belum,
    diperiksa,
    answered,
    pct: diperiksa > 0 ? Math.round((patuh / diperiksa) * 100) : 0,
    answered_pct: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

export function getFormItems(formId) {
  return all(
    `SELECT pi.id, pi.item_id, pi.nama_saat_itu AS nama, pi.kelompok_saat_itu AS kelompok, pi.urutan
     FROM forms f JOIN period_items pi ON pi.period_id = f.period_id
     WHERE f.id = ? ORDER BY pi.urutan, pi.id`,
    formId,
  );
}

export function getViolations({ formId = null, periodId = null } = {}) {
  const conditions = ["ai.memenuhi = 0"];
  const params = [];
  if (formId) {
    conditions.push("fe.form_id = ?");
    params.push(formId);
  }
  if (periodId) {
    conditions.push("f.period_id = ?");
    params.push(periodId);
  }
  const rows = all(
    `SELECT pi.id, pi.nama_saat_itu AS nama, COUNT(*) AS jumlah, pi.urutan
     FROM assessment_items ai
     JOIN assessments a ON a.id = ai.assessment_id
     JOIN form_employees fe ON fe.id = a.form_employee_id
     JOIN forms f ON f.id = fe.form_id
     JOIN period_items pi ON pi.id = ai.period_item_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY pi.id
     ORDER BY jumlah DESC, pi.urutan`,
    ...params,
  );
  if (!rows.length) return [];
  const max = Number(rows[0].jumlah);
  return rows.filter((row) => Number(row.jumlah) === max);
}

export function getViolationList(periodId) {
  return all(
    `SELECT pi.id, pi.nama_saat_itu AS nama, COUNT(*) AS jumlah, pi.urutan
     FROM assessment_items ai
     JOIN assessments a ON a.id = ai.assessment_id
     JOIN form_employees fe ON fe.id = a.form_employee_id
     JOIN forms f ON f.id = fe.form_id
     JOIN period_items pi ON pi.id = ai.period_item_id
     WHERE f.period_id = ? AND ai.memenuhi = 0
     GROUP BY pi.id
     ORDER BY jumlah DESC, pi.urutan`,
    periodId,
  );
}

function assignmentMap() {
  const rows = all(
    `SELECT a.unit_id, u.id AS kabid_id, u.nama AS kabid_nama, u.jabatan AS kabid_jabatan
     FROM assignments a JOIN users u ON u.id = a.user_id
     ORDER BY a.id`,
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.unit_id)) map.set(row.unit_id, row);
  });
  return map;
}

export function getFormList(periodId) {
  const period = getPeriod(periodId);
  if (!period) return { period: null, forms: [] };
  const rows = all(
    `SELECT f.id, f.period_id, f.unit_id, f.kabid_id, f.status, f.tanggal_pemeriksaan,
            f.completed_at, f.penanda_tangan_nama,
            u.nama AS unit_nama, u.urutan AS unit_urutan, u.aktif AS unit_aktif,
            k.nama AS snapshot_kabid_nama, k.jabatan AS snapshot_kabid_jabatan,
            COUNT(fe.id) AS total,
            COALESCE(SUM(CASE WHEN a.status='patuh' THEN 1 ELSE 0 END),0) AS patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_patuh' THEN 1 ELSE 0 END),0) AS tidak_patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_diperiksa' THEN 1 ELSE 0 END),0) AS tidak_diperiksa,
            COALESCE(SUM(CASE WHEN a.status='belum' OR a.id IS NULL THEN 1 ELSE 0 END),0) AS belum
     FROM forms f
     JOIN units u ON u.id = f.unit_id
     LEFT JOIN users k ON k.id = f.kabid_id
     LEFT JOIN form_employees fe ON fe.form_id = f.id
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE f.period_id = ?
     GROUP BY f.id
     ORDER BY u.urutan, u.nama`,
    periodId,
  );
  const map = period.status === "berjalan" ? assignmentMap() : new Map();
  const forms = rows.map((row) => {
    const current = map.get(row.unit_id);
    const useCurrent = period.status === "berjalan" && current;
    return {
      ...row,
      ...normalizeStats(row),
      unit: row.unit_nama,
      kabid_id: useCurrent ? current.kabid_id : row.kabid_id,
      kabid_nama: useCurrent ? current.kabid_nama : row.snapshot_kabid_nama,
      kabid_jabatan: useCurrent ? current.kabid_jabatan : row.snapshot_kabid_jabatan,
      snapshot_kabid_nama: row.snapshot_kabid_nama,
      snapshot_kabid_jabatan: row.snapshot_kabid_jabatan,
    };
  });
  return { period, forms };
}

export function periodSummary(periodId) {
  const { period, forms } = getFormList(periodId);
  if (!period) return null;
  const summary = {
    total: 0,
    patuh: 0,
    tidak_patuh: 0,
    tidak_diperiksa: 0,
    belum: 0,
    diperiksa: 0,
    answered: 0,
    pct: 0,
    answered_pct: 0,
  };
  forms.forEach((form) => {
    summary.total += form.total;
    summary.patuh += form.patuh;
    summary.tidak_patuh += form.tidak_patuh;
    summary.tidak_diperiksa += form.tidak_diperiksa;
    summary.belum += form.belum;
    summary.diperiksa += form.diperiksa;
    summary.answered += form.answered;
  });
  summary.pct = summary.diperiksa > 0 ? Math.round((summary.patuh / summary.diperiksa) * 100) : 0;
  summary.answered_pct = summary.total > 0 ? Math.round((summary.answered / summary.total) * 100) : 0;
  const complete = forms.filter((f) => Boolean(f.completed_at)).length;
  return {
    period,
    forms,
    summary: {
      ...summary,
      forms_total: forms.length,
      forms_complete: complete,
      forms_in_progress: forms.filter(
        (f) => f.status === "sedang" && f.answered > 0,
      ).length,
      forms_not_started: forms.filter((f) => f.answered === 0 && f.status !== "selesai").length,
    },
  };
}

export function recap(periodId) {
  const base = periodSummary(periodId);
  if (!base) return null;
  const violations = getViolationList(periodId);
  const ranked = base.forms
    .slice()
    .sort((a, b) => {
      if (b.diperiksa === 0 && a.diperiksa > 0) return -1;
      if (a.diperiksa === 0 && b.diperiksa > 0) return 1;
      return b.pct - a.pct || b.patuh - a.patuh || a.unit.localeCompare(b.unit, "id");
    })
    .map((form, idx) => ({ ...form, rank: idx + 1 }));

  const groupMap = new Map();
  base.forms.forEach((form) => {
    const key = form.kabid_id || 0;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        kabid_id: form.kabid_id,
        kabid_nama: form.kabid_nama || "Belum ditugaskan",
        kabid_jabatan: form.kabid_jabatan || "—",
        units: [],
        total: 0,
        patuh: 0,
        tidak_patuh: 0,
        tidak_diperiksa: 0,
        belum: 0,
        diperiksa: 0,
        answered: 0,
        pct: 0,
      });
    }
    const group = groupMap.get(key);
    group.units.push(form);
    group.total += form.total;
    group.patuh += form.patuh;
    group.tidak_patuh += form.tidak_patuh;
    group.tidak_diperiksa += form.tidak_diperiksa;
    group.belum += form.belum;
    group.diperiksa += form.diperiksa;
    group.answered += form.answered;
  });
  const groups = Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      pct: group.diperiksa > 0 ? Math.round((group.patuh / group.diperiksa) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || a.kabid_nama.localeCompare(b.kabid_nama, "id"));

  const topUnit = ranked.find((form) => form.diperiksa > 0) || null;
  return {
    ...base,
    forms: ranked,
    groups,
    violations,
    topUnit,
    sementara: base.period.status !== "ditutup",
  };
}

export function getAssignedUnits(userId) {
  return all(
    `SELECT u.* FROM assignments a JOIN units u ON u.id = a.unit_id
     WHERE a.user_id = ? ORDER BY u.urutan, u.nama`,
    userId,
  );
}

export function isAssigned(userId, unitId) {
  return Boolean(
    get("SELECT 1 AS ok FROM assignments WHERE user_id=? AND unit_id=?", userId, unitId),
  );
}

export function canAccessForm(user, form) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (isAssigned(user.id, form.unit_id)) return true;
  if (form.period_status === "ditutup" || form.status === "terkunci") {
    return form.kabid_id === user.id;
  }
  return false;
}

export function canFillForm(user, form) {
  return (
    user?.role === "kabid" &&
    form.period_status === "berjalan" &&
    form.status !== "terkunci" &&
    isAssigned(user.id, form.unit_id)
  );
}

export function getFormRows(formId) {
  const rows = all(
    `SELECT fe.id, fe.employee_id, fe.nama_saat_itu AS nama, fe.nip_saat_itu AS nip, fe.urutan,
            e.aktif AS employee_aktif,
            si.foto_path, si.found AS simpeg_found,
            a.id AS assessment_id, a.status, a.alasan_tidak_diperiksa AS alasan,
            a.keterangan, a.dinilai_pada, a.updated_at,
            du.nama AS dinilai_oleh_nama
     FROM form_employees fe
     JOIN employees e ON e.id = fe.employee_id
     LEFT JOIN simpeg_identities si ON si.employee_id = e.id
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     LEFT JOIN users du ON du.id = a.dinilai_oleh
     WHERE fe.form_id = ?
     ORDER BY fe.urutan, fe.id`,
    formId,
  );
  const itemResults = all(
    `SELECT ai.assessment_id, ai.period_item_id, ai.memenuhi
     FROM assessment_items ai
     JOIN assessments a ON a.id = ai.assessment_id
     JOIN form_employees fe ON fe.id = a.form_employee_id
     WHERE fe.form_id = ?`,
    formId,
  );
  const byAssessment = new Map();
  itemResults.forEach((item) => {
    if (!byAssessment.has(item.assessment_id)) byAssessment.set(item.assessment_id, {});
    byAssessment.get(item.assessment_id)[item.period_item_id] = item.memenuhi;
  });
  return rows.map((row) => ({
    ...row,
    status: row.status || "belum",
    items: byAssessment.get(row.assessment_id) || {},
  }));
}

export function getHistory(formId) {
  return all(
    `SELECT h.*, u.role AS oleh_role FROM form_history h
     LEFT JOIN users u ON u.id = h.oleh_user_id
     WHERE h.form_id = ? ORDER BY h.pada ASC, h.id ASC`,
    formId,
  );
}

export function formDetail(formId) {
  const form = getFormBase(formId);
  if (!form) return null;
  const items = getFormItems(formId);
  const rows = getFormRows(formId);
  const stats = formStats(formId);
  const violations = getViolations({ formId });
  rows.forEach((row) => {
    row.violated = items
      .filter((item) => row.items[item.id] === 0)
      .map((item) => item.nama);
  });
  return {
    form,
    items,
    rows,
    stats,
    violations,
    history: getHistory(formId),
    locked: form.period_status === "ditutup" || form.status === "terkunci",
  };
}

export function kabidForms(userId, periodId) {
  const rows = all(
    `SELECT f.id, f.period_id, f.unit_id, f.status, f.tanggal_pemeriksaan,
            f.completed_at, u.nama AS unit_nama, u.urutan AS unit_urutan,
            COUNT(fe.id) AS total,
            COALESCE(SUM(CASE WHEN a.status='patuh' THEN 1 ELSE 0 END),0) AS patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_patuh' THEN 1 ELSE 0 END),0) AS tidak_patuh,
            COALESCE(SUM(CASE WHEN a.status='tidak_diperiksa' THEN 1 ELSE 0 END),0) AS tidak_diperiksa,
            COALESCE(SUM(CASE WHEN a.status='belum' OR a.id IS NULL THEN 1 ELSE 0 END),0) AS belum
     FROM forms f
     JOIN units u ON u.id = f.unit_id
     LEFT JOIN form_employees fe ON fe.form_id = f.id
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE f.period_id = ?
       AND f.unit_id IN (SELECT unit_id FROM assignments WHERE user_id = ?)
     GROUP BY f.id
     ORDER BY u.urutan, u.nama`,
    periodId,
    userId,
  );
  return rows.map((row) => ({
    ...row,
    ...normalizeStats(row),
    unit: row.unit_nama,
    remaining: Number(row.belum) || 0,
  }));
}

export function kabidHome(userId) {
  const period = getActivePeriod();
  const user = get(
    "SELECT id, nama, username, role, jabatan, nip FROM users WHERE id=?",
    userId,
  );
  if (!period) {
    return {
      period: null,
      user,
      forms: [],
      reminders: [],
      summary: normalizeStats({}),
      units: getAssignedUnits(userId),
    };
  }
  const forms = kabidForms(userId, period.id);
  const summary = normalizeStats({
    total: forms.reduce((sum, f) => sum + f.total, 0),
    patuh: forms.reduce((sum, f) => sum + f.patuh, 0),
    tidak_patuh: forms.reduce((sum, f) => sum + f.tidak_patuh, 0),
    tidak_diperiksa: forms.reduce((sum, f) => sum + f.tidak_diperiksa, 0),
    belum: forms.reduce((sum, f) => sum + f.belum, 0),
  });
  const reminders = forms
    .filter((form) => form.status !== "selesai")
    .map((form) => ({
      id: form.id,
      unit: form.unit,
      unit_id: form.unit_id,
      remaining: form.belum,
      answered: form.answered,
      total: form.total,
      status: form.status,
    }))
    .sort((a, b) => b.remaining - a.remaining);
  return {
    period,
    user,
    forms: forms.map((form) => ({ ...form, remaining: form.belum })),
    reminders,
    summary,
    units: getAssignedUnits(userId),
  };
}

export function findUnitForm(periodId, unitId) {
  return get("SELECT * FROM forms WHERE period_id=? AND unit_id=?", periodId, unitId);
}

export function formEmployeesForUnit(formId) {
  const rows = all(
    `SELECT fe.id, fe.employee_id, fe.nama_saat_itu AS nama, fe.nip_saat_itu AS nip, fe.urutan,
            si.foto_path, si.found AS simpeg_found, si.jabatan,
            a.id AS assessment_id, a.status, a.alasan_tidak_diperiksa AS alasan,
            a.keterangan, a.dinilai_pada
     FROM form_employees fe
     JOIN employees e ON e.id = fe.employee_id
     LEFT JOIN simpeg_identities si ON si.employee_id = e.id
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE fe.form_id = ?
     ORDER BY fe.urutan, fe.id`,
    formId,
  );
  const violations = all(
    `SELECT a.form_employee_id, pi.nama_saat_itu AS nama
     FROM assessment_items ai
     JOIN assessments a ON a.id = ai.assessment_id
     JOIN period_items pi ON pi.id = ai.period_item_id
     JOIN form_employees fe ON fe.id = a.form_employee_id
     WHERE fe.form_id = ? AND ai.memenuhi = 0
     ORDER BY pi.urutan`,
    formId,
  );
  const byEmployee = new Map();
  violations.forEach((v) => {
    if (!byEmployee.has(v.form_employee_id)) byEmployee.set(v.form_employee_id, []);
    byEmployee.get(v.form_employee_id).push(v.nama);
  });
  return rows.map((row) => ({
    ...row,
    status: row.status || "belum",
    violated: byEmployee.get(row.id) || [],
  }));
}

export function formEmployeeDetail(formEmployeeId) {
  const row = get(
    `SELECT fe.id, fe.form_id, fe.employee_id, fe.nama_saat_itu AS nama, fe.nip_saat_itu AS nip, fe.urutan,
            f.unit_id, f.status AS form_status, f.period_id, p.status AS period_status,
            p.bulan, p.tahun, u.nama AS unit_nama, e.nama AS nama_induk, e.nip AS nip_induk,
            si.gelar_depan, si.gelar_belakang, si.jabatan, si.pangkat, si.golongan,
            si.status_kepegawaian, si.foto_path, si.found AS simpeg_found,
            a.id AS assessment_id, a.status, a.alasan_tidak_diperiksa AS alasan,
            a.keterangan, a.dinilai_pada, a.updated_at
     FROM form_employees fe
     JOIN forms f ON f.id = fe.form_id
     JOIN periods p ON p.id = f.period_id
     JOIN units u ON u.id = f.unit_id
     JOIN employees e ON e.id = fe.employee_id
     LEFT JOIN simpeg_identities si ON si.employee_id = fe.employee_id
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE fe.id = ?`,
    formEmployeeId,
  );
  if (!row) return null;
  const items = getFormItems(row.form_id);
  const results = all(
    `SELECT ai.period_item_id, ai.memenuhi FROM assessment_items ai
     WHERE ai.assessment_id = ?`,
    row.assessment_id,
  );
  const resultMap = {};
  results.forEach((r) => {
    resultMap[r.period_item_id] = r.memenuhi;
  });
  const position = get(
    "SELECT COUNT(*) AS c FROM form_employees WHERE form_id=? AND urutan < ?",
    row.form_id,
    row.urutan,
  );
  const total = get("SELECT COUNT(*) AS c FROM form_employees WHERE form_id=?", row.form_id);
  const nextUnanswered = get(
    `SELECT fe.id FROM form_employees fe
     LEFT JOIN assessments a ON a.form_employee_id = fe.id
     WHERE fe.form_id = ? AND fe.id != ? AND (a.id IS NULL OR a.status='belum')
     ORDER BY CASE WHEN fe.urutan > ? THEN 0 ELSE 1 END, fe.urutan, fe.id
     LIMIT 1`,
    row.form_id,
    row.id,
    row.urutan,
  );
  return {
    employee: {
      ...row,
      status: row.status || "belum",
      position: Number(position?.c || 0) + 1,
      total: Number(total?.c || 0),
      next_id: nextUnanswered?.id || null,
      unit: row.unit_nama,
      periode_label: `${BULAN[row.bulan - 1]} ${row.tahun}`,
    },
    items: items.map((item) => ({
      ...item,
      memenuhi: resultMap[item.id] === undefined ? null : resultMap[item.id],
    })),
  };
}

export function completeness(formId) {
  return normalizeStats(formStats(formId));
}

export function getFormHistory(formId) {
  return getHistory(formId);
}

export function duplicateSummary() {
  const rows = all("SELECT nip, COUNT(*) AS jumlah FROM employees WHERE nip IS NOT NULL AND TRIM(nip) != '' GROUP BY nip HAVING COUNT(*) > 1");
  return {
    nip_values: rows.length,
    employees: rows.reduce((sum, row) => sum + Number(row.jumlah), 0),
    groups: rows,
  };
}

export function qualityStats() {
  const employees = all(
    `SELECT e.id, e.nip, si.found, si.employee_id AS identity_employee_id
     FROM employees e LEFT JOIN simpeg_identities si ON si.employee_id=e.id
     WHERE e.aktif=1`,
  );
  let empty = 0;
  let irregular = 0;
  let notFound = 0;
  let unsynced = 0;
  const nipMap = new Map();
  employees.forEach((emp) => {
    const nip = (emp.nip || "").trim();
    if (!nip) empty += 1;
    else {
      nipMap.set(nip, (nipMap.get(nip) || 0) + 1);
      if (!/^\d{18}$/.test(nip)) irregular += 1;
    }
    if (!emp.identity_employee_id) unsynced += 1;
    else if (!emp.found) notFound += 1;
  });
  let duplicates = 0;
  let duplicateEmployees = 0;
  nipMap.forEach((countValue) => {
    if (countValue > 1) {
      duplicates += 1;
      duplicateEmployees += countValue;
    }
  });
  return {
    total: employees.length,
    duplicates,
    duplicate_employees: duplicateEmployees,
    empty,
    irregular,
    not_found: notFound,
    unsynced,
  };
}
