import express from "express";
import path from "node:path";
import fs from "node:fs";
import { ROOT_DIR, PORT, HOST, APP_VERSION } from "./config.js";
import { db, count } from "./db.js";
import { seedDatabase } from "./lib/seed-data.js";
import {
  authenticate,
  checkOrigin,
  cleanupSessions,
  requireRole,
} from "./lib/auth.js";
import { HttpError } from "./lib/http.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import kabidRoutes from "./routes/kabid.js";
import reportsRoutes from "./routes/reports.js";
import photosRoutes from "./routes/photos.js";

const distDir = path.join(ROOT_DIR, "dist");
const isProduction = fs.existsSync(path.join(distDir, "index.html"));

if (count("SELECT COUNT(*) c FROM users") === 0) {
  const seeded = seedDatabase();
  if (seeded) console.log("Database kosong — data awal SIMPATIK dimuat.");
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (isProduction) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'",
    );
  }
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const api = express.Router();
api.use(authenticate);
api.use(checkOrigin);
api.use("/auth", authRoutes);
api.use("/admin", requireRole("admin"), adminRoutes);
api.use("/kabid", requireRole("kabid"), kabidRoutes);
api.use("/reports", reportsRoutes);
api.use("/photos", photosRoutes);
api.get("/health", (req, res) => res.json({ ok: true, version: APP_VERSION, user: req.user?.role || null }));
api.use((req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan." }));

app.use("/api", api);

if (isProduction) {
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      app: "SIMPATIK API",
      version: APP_VERSION,
      note: "Frontend berjalan melalui Vite pada mode pengembangan (npm run dev).",
    });
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Ukuran berkas melebihi batas 20 MB." });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Format permintaan tidak valid." });
  }
  console.error("[SIMPATIK]", err);
  res.status(500).json({ error: "Terjadi kesalahan pada server. Silakan coba lagi." });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`SIMPATIK berjalan di http://localhost:${PORT} (bind ${HOST}:${PORT})`);
  console.log(`Mode: ${isProduction ? "produksi (dist)" : "API pengembangan"}`);
});

const cleanup = setInterval(cleanupSessions, 60 * 60 * 1000);
cleanup.unref();

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
