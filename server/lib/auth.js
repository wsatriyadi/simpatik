import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { get, insert, run, nowIso } from "../db.js";
import { HttpError } from "./http.js";

export const SESSION_COOKIE = "simpatik_session";
const SESSION_HOURS = 8;
const SESSION_TTL_MS = SESSION_HOURS * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const loginAttempts = new Map();

function parseCookies(header = "") {
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "Password minimal 8 karakter.");
  }
  if (password.length > 128) {
    throw new HttpError(400, "Password terlalu panjang.");
  }
}

export function setSessionCookie(req, res, token, maxAgeSeconds = SESSION_HOURS * 3600) {
  const secure =
    req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  insert(
    "INSERT INTO sessions (token, user_id, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?)",
    token,
    userId,
    now.toISOString(),
    now.toISOString(),
    expires.toISOString(),
  );
  setSessionCookie(req, res, token);
  return token;
}

export function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[SESSION_COOKIE]) {
    run("DELETE FROM sessions WHERE token=?", cookies[SESSION_COOKIE]);
  }
  clearSessionCookie(res);
}

export function authenticate(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      req.user = null;
      return next();
    }
    const row = get(
      `SELECT s.token, s.expires_at, s.last_seen_at, u.*
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      token,
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now() || !row.aktif) {
      if (row) run("DELETE FROM sessions WHERE token=?", token);
      clearSessionCookie(res);
      req.user = null;
      return next();
    }
    const lastSeen = new Date(row.last_seen_at).getTime();
    if (Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
      const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
      run(
        "UPDATE sessions SET last_seen_at=?, expires_at=? WHERE token=?",
        nowIso(),
        expires,
        token,
      );
      setSessionCookie(req, res, token);
    }
    req.user = {
      id: row.id,
      nama: row.nama,
      username: row.username,
      role: row.role,
      jabatan: row.jabatan,
      nip: row.nip,
      aktif: row.aktif,
    };
    req.sessionToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, "Sesi masuk telah berakhir. Silakan masuk kembali."));
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, "Sesi masuk telah berakhir. Silakan masuk kembali."));
    if (req.user.role !== role) return next(new HttpError(403, "Halaman ini khusus untuk peran " + role + "."));
    next();
  };
}

export function checkOrigin(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const host = new URL(origin).host;
        if (host !== req.headers.host) {
          return next(new HttpError(403, "Permintaan lintas situs ditolak."));
        }
      } catch {
        return next(new HttpError(403, "Origin permintaan tidak valid."));
      }
    }
  }
  next();
}

export function loginRateLimit(req, res, next) {
  const key = `${req.ip}|${String(req.body?.username || "").toLowerCase()}`;
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, first: now };
  if (now - entry.first > 10 * 60 * 1000) {
    entry.count = 0;
    entry.first = now;
  }
  if (entry.count >= 12) {
    return next(
      new HttpError(429, "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit."),
    );
  }
  req._loginKey = key;
  next();
}

export function registerFailedLogin(key) {
  if (!key) return;
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, first: now };
  if (now - entry.first > 10 * 60 * 1000) {
    entry.count = 0;
    entry.first = now;
  }
  entry.count += 1;
  loginAttempts.set(key, entry);
}

export function resetLoginAttempts(key) {
  if (key) loginAttempts.delete(key);
}

export function cleanupSessions() {
  run("DELETE FROM sessions WHERE expires_at < ?", nowIso());
}
