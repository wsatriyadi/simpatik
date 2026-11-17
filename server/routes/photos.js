import express from "express";
import path from "node:path";
import fs from "node:fs";
import { get } from "../db.js";
import { DATA_DIR } from "../config.js";
import { isAssigned } from "../lib/stats.js";
import { asyncHandler, HttpError } from "../lib/http.js";

const router = express.Router();

router.get(
  "/:employeeId",
  asyncHandler(async (req, res) => {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId) throw new HttpError(400, "Pegawai tidak valid.");
    const employee = get("SELECT id, unit_id FROM employees WHERE id=?", employeeId);
    if (!employee) throw new HttpError(404, "Pegawai tidak ditemukan.");
    const identity = get("SELECT foto_path, foto_mime FROM simpeg_identities WHERE employee_id=?", employeeId);
    if (!identity?.foto_path) throw new HttpError(404, "Foto belum tersedia.");
    let allowed = req.user.role === "admin" || isAssigned(req.user.id, employee.unit_id);
    if (!allowed) {
      allowed = Boolean(
        get(
          `SELECT 1 AS ok FROM forms f WHERE f.unit_id=? AND f.kabid_id=? AND f.status='terkunci' LIMIT 1`,
          employee.unit_id,
          req.user.id,
        ),
      );
    }
    if (!allowed) throw new HttpError(403, "Anda tidak memiliki akses ke foto pegawai ini.");
    const absolute = path.resolve(DATA_DIR, identity.foto_path);
    if (!absolute.startsWith(path.resolve(DATA_DIR)) || !fs.existsSync(absolute)) {
      throw new HttpError(404, "Berkas foto tidak ditemukan.");
    }
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", identity.foto_mime || "image/jpeg");
    res.sendFile(absolute);
  }),
);

export default router;
