import express from "express";
import { asyncHandler, HttpError, toInt } from "../lib/http.js";
import { canAccessForm, getActivePeriod, getFormBase, getPeriod, listPeriods } from "../lib/stats.js";
import {
  buildFormExcel,
  buildFormPdf,
  buildRecapExcel,
  buildRecapPdf,
} from "../lib/reports.js";

const router = express.Router();

function sendBuffer(res, result, type) {
  if (!result) throw new HttpError(404, "Laporan tidak tersedia.");
  res.setHeader("Content-Type", type);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.send(result.buffer);
}

function formForUser(user, formId) {
  const form = getFormBase(formId);
  if (!form) throw new HttpError(404, "Formulir tidak ditemukan.");
  if (!canAccessForm(user, form)) {
    throw new HttpError(403, "Anda tidak memiliki akses ke laporan ini.");
  }
  return form;
}

router.get(
  "/form/:id/excel",
  asyncHandler(async (req, res) => {
    const formId = toInt(req.params.id);
    if (!formId) throw new HttpError(400, "Formulir tidak valid.");
    formForUser(req.user, formId);
    const result = await buildFormExcel(formId);
    sendBuffer(res, result, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }),
);

router.get(
  "/form/:id/pdf",
  asyncHandler(async (req, res) => {
    const formId = toInt(req.params.id);
    if (!formId) throw new HttpError(400, "Formulir tidak valid.");
    formForUser(req.user, formId);
    const result = await buildFormPdf(formId);
    sendBuffer(res, result, "application/pdf");
  }),
);

function recapPeriod(req) {
  const requested = toInt(req.query.periodId);
  const active = getActivePeriod();
  const periods = listPeriods();
  const period =
    (requested && getPeriod(requested)) ||
    active ||
    (periods.length ? getPeriod(periods[0].id) : null);
  if (!period) throw new HttpError(404, "Belum ada periode untuk direkap.");
  return period;
}

router.get(
  "/recap/excel",
  asyncHandler(async (req, res) => {
    const period = recapPeriod(req);
    const result = await buildRecapExcel(period.id);
    sendBuffer(res, result, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }),
);

router.get(
  "/recap/pdf",
  asyncHandler(async (req, res) => {
    const period = recapPeriod(req);
    const result = await buildRecapPdf(period.id);
    sendBuffer(res, result, "application/pdf");
  }),
);

export default router;
