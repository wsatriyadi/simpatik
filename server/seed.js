import fs from "node:fs";
import { BULAN } from "./config.js";

const reset = process.argv.includes("--reset");

if (reset) {
  const { DB_PATH } = await import("./config.js");
  fs.mkdirSync(DB_PATH.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(DB_PATH + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
  console.log("Database lama dihapus.");
}

const { db } = await import("./db.js");
const { seedDatabase } = await import("./lib/seed-data.js");

const seeded = seedDatabase();
if (seeded) {
  console.log("Seed SIMPATIK selesai: 22 unit, 574 pegawai, 2 periode.");
  console.log("Admin  : admin / WisnuK3r3n@");
  console.log("Kabid  : <NIP> / simpatik123");
  console.log(`Periode berjalan: ${BULAN[10]} 2026`);
} else {
  console.log("Database sudah berisi data. Gunakan `npm run seed:reset` untuk memuat ulang.");
}
db.close();
