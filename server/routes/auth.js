import express from "express";
import { get, run } from "../db.js";
import {
  createSession,
  destroySession,
  hashPassword,
  loginRateLimit,
  registerFailedLogin,
  requireAuth,
  resetLoginAttempts,
  validatePassword,
  verifyPassword,
} from "../lib/auth.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { audit } from "../lib/audit.js";

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
    jabatan: user.jabatan,
    nip: user.nip,
    aktif: user.aktif,
  };
}

router.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      throw new HttpError(400, "Username dan password wajib diisi.");
    }
    const user = get("SELECT * FROM users WHERE username = ?", username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      registerFailedLogin(req._loginKey);
      throw new HttpError(401, "Username atau password salah.");
    }
    if (!user.aktif) {
      throw new HttpError(403, "Akun Anda dinonaktifkan. Hubungi Admin.");
    }
    resetLoginAttempts(req._loginKey);
    createSession(req, res, user.id);
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.user) {
      audit(req.user, "user", req.user.id, "Keluar aplikasi");
    }
    destroySession(req, res);
    res.json({ ok: true });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = get("SELECT * FROM users WHERE id=?", req.user.id);
    if (!user || !user.aktif) throw new HttpError(401, "Akun tidak aktif.");
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = String(req.body?.current || "");
    const next = String(req.body?.next || "");
    const user = get("SELECT * FROM users WHERE id=?", req.user.id);
    if (!user || !verifyPassword(current, user.password_hash)) {
      throw new HttpError(400, "Password saat ini tidak sesuai.");
    }
    validatePassword(next);
    if (next === current) {
      throw new HttpError(400, "Password baru harus berbeda dari password saat ini.");
    }
    run("UPDATE users SET password_hash=? WHERE id=?", hashPassword(next), user.id);
    run("DELETE FROM sessions WHERE user_id=? AND token<>?", user.id, req.sessionToken);
    audit(req.user, "user", user.id, "Ganti password");
    res.json({ ok: true });
  }),
);

export default router;
