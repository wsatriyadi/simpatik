import bcrypt from "bcryptjs";
import {
  all,
  count,
  get,
  insert,
  nowIso,
  run,
  tx,
} from "../db.js";
import { BULAN, periodLabel } from "../config.js";

/* ------------------------------------------------------------------ */
/* Deterministic random                                                */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261117);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

/* ------------------------------------------------------------------ */
/* Master data from PRD Appendix A                                     */
/* ------------------------------------------------------------------ */
const KABID_SEED = [
  {
    key: "fahmi",
    nama: "Muhammad Fahmi Arif, S.Kom, MM",
    nip: "198203122006041011",
    jabatan: "Kepala Bidang Keuangan",
  },
  {
    key: "norhikmah",
    nama: "Nor Hikmah, S.Kep, Ns, M.Kep",
    nip: "197805202002122004",
    jabatan: "Kepala Bidang Umum & Kepegawaian",
  },
  {
    key: "nahdi",
    nama: "M. Nahdiansyah Abdi, S.Psi",
    nip: "198811022010011009",
    jabatan: "Kasubbag Penerimaan & Mobilisasi Dana",
  },
  {
    key: "baihaki",
    nama: "Muhammad Baihaki, S.Kep, Ns, MM",
    nip: "198105062005011007",
    jabatan: "Kepala Bagian Perencanaan & Organisasi",
  },
  {
    key: "asmadiannor",
    nama: "H. Asmadiannor, S.Kep, Ns, M.Kes",
    nip: "197404172000031005",
    jabatan: "Kepala Bidang Hukum & Informasi",
  },
  {
    key: "said",
    nama: "Said, SH, LL.M",
    nip: "197109281998031003",
    jabatan: "Kepala Bidang Penunjang & Non Medik",
  },
  {
    key: "lisa",
    nama: "Hj. Lisa Mahliyani, S.Kep, Ns, MM",
    nip: "197707142001122006",
    jabatan: "Kepala Bidang Pendidikan, Penelitian & Pengembangan",
  },
  {
    key: "ideris",
    nama: "Ideris, SP, M.Kes",
    nip: "196912031996031002",
    jabatan: "Kepala Bidang Pelayanan Medik",
  },
  {
    key: "nurhikmah",
    nama: "Hajjah Nurhikmah, S.ST, M.Kes",
    nip: "197503252000122008",
    jabatan: "Kepala Bidang Penunjang Medik",
  },
  {
    key: "noorlianisyah",
    nama: "Noorlianisyah, SKM",
    nip: "198006092006042010",
    jabatan: "Kepala Bidang Keperawatan",
  },
];

const UNITS_SEED = [
  { nama: "Bagian Keuangan", jumlah: 21, kabid: "fahmi" },
  { nama: "Bagian Umum Kepegawaian (UMPEG)", jumlah: 47, kabid: "norhikmah" },
  { nama: "Instalasi JKN", jumlah: 11, kabid: "nahdi" },
  { nama: "Bagian Perencanaan & Organisasi", jumlah: 11, kabid: "baihaki" },
  { nama: "Bidang Hukum & Informasi", jumlah: 20, kabid: "asmadiannor" },
  { nama: "Bidang Penunjang & Non Medik", jumlah: 27, kabid: "said" },
  { nama: "Bidang Pendidikan, Penelitian & Pengembangan (Diklat)", jumlah: 8, kabid: "lisa" },
  { nama: "Bidang Pelayanan Medik", jumlah: 7, kabid: "ideris" },
  { nama: "Komite Medik", jumlah: 28, kabid: "ideris" },
  { nama: "Bidang Penunjang Medik", jumlah: 5, kabid: "nurhikmah" },
  { nama: "Instalasi Gizi", jumlah: 25, kabid: "nurhikmah" },
  { nama: "Instalasi Farmasi", jumlah: 27, kabid: "nurhikmah" },
  { nama: "Instalasi Laboratorium", jumlah: 14, kabid: "nurhikmah" },
  { nama: "Instalasi Rekam Medik", jumlah: 17, kabid: "nurhikmah" },
  { nama: "Instalasi Rehab Medik", jumlah: 12, kabid: "nurhikmah" },
  { nama: "Instalasi Psikologi", jumlah: 9, kabid: "nurhikmah" },
  { nama: "Instalasi Loundry", jumlah: 8, kabid: "nurhikmah" },
  { nama: "Instalasi Rehabilitasi Psikososial", jumlah: 10, kabid: "nurhikmah" },
  { nama: "Poli Gilut & Radiologi", jumlah: 7, kabid: "nurhikmah" },
  { nama: "Bidang Keperawatan", jumlah: 16, kabid: "noorlianisyah" },
  { nama: "Instalasi Rawat Inap", jumlah: 232, kabid: "noorlianisyah" },
  { nama: "Instalasi Rawat Jalan", jumlah: 12, kabid: "noorlianisyah" },
];

const ITEMS_SEED = [
  { nama: "Pakaian dinas sesuai hari", kelompok: "Pakaian Dinas" },
  { nama: "Rapi, bersih, sopan, dan layak pakai", kelompok: "Pakaian Dinas" },
  { nama: "ID Card", kelompok: "Atribut Lengkap" },
  { nama: "Name Tag", kelompok: "Atribut Lengkap" },
  { nama: "Korpri", kelompok: "Atribut Lengkap" },
  { nama: "PIN Jujur", kelompok: "Atribut Lengkap" },
  { nama: "Lambang Pemda", kelompok: "Atribut Lengkap" },
  { nama: "Sepatu sesuai ketentuan (hitam/coklat gelap)", kelompok: "Sepatu" },
];

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */
const MALE = [
  "Ahmad", "Muhammad", "Abdul", "Rizky", "Fajar", "Hendra", "Agus", "Bambang",
  "Dedi", "Eko", "Hadi", "Irfan", "Joko", "Lukman", "Maman", "Nanda", "Oki",
  "Rahmat", "Samsul", "Taufik", "Umar", "Wahyu", "Yudi", "Zainal", "Akhmad",
  "Bayu", "Candra", "Doni", "Faisal", "Gilang", "Haris", "Iwan", "Kurnia",
  "Maulana", "Norman", "Panji", "Reza", "Sigit", "Tri", "Yusuf", "Aditya",
  "Bima", "Dwi", "Erwin", "Gunawan", "Herman", "Ilham", "Junaidi", "Mursyid",
  "Naufal", "Purnama", "Rudi", "Syahrial", "Tarmizi", "Yanto", "Zulkifli",
  "Hidayat", "Rayhan", "Saprudin", "Aulia",
];

const FEMALE = [
  "Siti", "Nur", "Dewi", "Rina", "Yuliana", "Fitri", "Laila", "Maria", "Noor",
  "Rahmawati", "Sri", "Wulan", "Yuni", "Zubaidah", "Aisyah", "Bunga", "Citra",
  "Dina", "Elly", "Farida", "Gina", "Hesti", "Indah", "Juwita", "Kartika",
  "Lestari", "Mira", "Nisa", "Octavia", "Putri", "Ratna", "Sari", "Tina",
  "Ulfa", "Vera", "Winda", "Yanti", "Zahra", "Anisa", "Bella", "Raudhatul",
  "Norhaliza", "Mahdalena", "Rabiatul", "Hafizah", "Nurul", "Annisa", "Desi",
  "Eka", "Herlina", "Ika", "Lina", "Mela", "Nia", "Risa", "Sinta", "Widya",
  "Yulia", "Mega", "Dahlia",
];

const MIDDLE = [
  "Agustina", "Amelia", "Andini", "Anggraini", "Apriani", "Ariani", "Cahaya",
  "Darma", "Elvira", "Fahmi", "Fitria", "Hidayat", "Iskandar", "Kusuma",
  "Maulida", "Nurhaliza", "Pratama", "Rahmawati", "Setiawan", "Wijaya",
];

const LAST = [
  "Pratama", "Saputra", "Hidayat", "Nugroho", "Setiawan", "Wijaya", "Kusuma",
  "Ramadhani", "Maulida", "Sari", "Lestari", "Anggraini", "Permata",
  "Handayani", "Purnama", "Gunawan", "Santoso", "Wibowo", "Hartono",
  "Susanto", "Firmansyah", "Akbar", "Maulana", "Fahrezi", "Siregar",
  "Sitompul", "Nainggolan", "Simanjuntak", "Noor", "Aulia", "Rahim", "Rasyid",
  "Hafiz", "Zulkifli", "Anwar", "Fauzi", "Hakim", "Ilahi", "Jamil", "Karim",
  "Latif", "Mansur", "Nasution", "Omar", "Putra", "Qadri", "Rachman", "Saleh",
  "Thamrin", "Usman", "Yusuf", "Zamzami", "Apriyanto", "Bahri", "Candra",
  "Darmawan", "Effendi", "Firdaus", "Ginanjar", "Husin", "Iskandar",
  "Jauhari", "Kurniawan", "Lubis", "Mardani", "Nurdin", "Oktaviani",
  "Puspita", "Rahayu", "Suryani", "Taufik", "Utami", "Wulandari",
  "Yulianti", "Zainuddin",
];

const GENERAL_GELAR = [
  { depan: "", belakang: "S.E." },
  { depan: "", belakang: "S.Kom" },
  { depan: "", belakang: "S.Sos" },
  { depan: "", belakang: "S.H." },
  { depan: "", belakang: "S.IP" },
  { depan: "", belakang: "A.Md." },
  { depan: "", belakang: "M.Si" },
  { depan: "", belakang: "S.KM" },
  { depan: "", belakang: "" },
];

const PROFILES = {
  keuangan: {
    gelar: [{ depan: "", belakang: "S.E." }, { depan: "", belakang: "A.Md.Ak." }, { depan: "", belakang: "M.Ak." }, { depan: "", belakang: "S.Kom" }],
    jabatan: ["Analis Keuangan", "Bendahara Pengeluaran", "Verifikator Keuangan", "Staf Administrasi", "Pranata Komputer"],
  },
  umum: {
    gelar: GENERAL_GELAR,
    jabatan: ["Analis Kepegawaian", "Pengelola Umum", "Staf Administrasi", "Arsiparis", "Pranata Komputer", "Pengelola Barang"],
  },
  perencanaan: {
    gelar: [{ depan: "", belakang: "S.Sos" }, { depan: "", belakang: "S.IP" }, { depan: "", belakang: "M.Si" }, { depan: "", belakang: "S.E." }],
    jabatan: ["Perencana Ahli Muda", "Analis Organisasi", "Staf Perencanaan", "Analis Kebijakan"],
  },
  hukum: {
    gelar: [{ depan: "", belakang: "S.H." }, { depan: "", belakang: "M.H." }, { depan: "", belakang: "S.Kom" }, { depan: "", belakang: "S.Sos" }],
    jabatan: ["Analis Hukum", "Perancang Peraturan", "Pengelola Informasi", "Pranata Humas", "Staf Administrasi"],
  },
  penunjangNonMedik: {
    gelar: GENERAL_GELAR,
    jabatan: ["Staf Administrasi", "Pengelola Sarana", "Pranata Komputer", "Analis Tata Usaha", "Pengelola Barang"],
  },
  diklat: {
    gelar: [{ depan: "", belakang: "S.Kep., Ns" }, { depan: "", belakang: "S.Psi" }, { depan: "", belakang: "M.Kes" }, { depan: "", belakang: "S.Sos" }],
    jabatan: ["Pengelola Diklat", "Widyaiswara Muda", "Staf Diklat", "Analis Pelatihan"],
  },
  medik: {
    gelar: [{ depan: "dr.", belakang: "Sp.KJ" }, { depan: "dr.", belakang: "Sp.KJ., M.Kes" }, { depan: "dr.", belakang: "" }, { depan: "", belakang: "S.Kep., Ns" }],
    jabatan: ["Dokter Spesialis Kedokteran Jiwa", "Dokter Umum", "Perawat Ahli Muda"],
    doctorChance: 0.65,
  },
  pelayananMedik: {
    gelar: [{ depan: "dr.", belakang: "Sp.KJ" }, { depan: "dr.", belakang: "Sp.PD" }, { depan: "dr.", belakang: "" }, { depan: "", belakang: "S.KM" }],
    jabatan: ["Dokter Spesialis Kedokteran Jiwa", "Dokter Umum", "Analis Pelayanan Medik"],
    doctorChance: 0.6,
  },
  penunjangMedik: {
    gelar: [{ depan: "", belakang: "S.KM" }, { depan: "", belakang: "M.Kes" }, { depan: "", belakang: "S.ST" }],
    jabatan: ["Analis Kesehatan", "Pengelola Penunjang Medik", "Staf Administrasi"],
  },
  gizi: {
    gelar: [{ depan: "", belakang: "S.Gz" }, { depan: "", belakang: "A.Md.Gz" }, { depan: "", belakang: "M.Gz" }],
    jabatan: ["Nutrisionis", "Ahli Gizi", "Pengelola Instalasi Gizi"],
  },
  farmasi: {
    gelar: [{ depan: "", belakang: "S.Farm., Apt." }, { depan: "", belakang: "A.Md.Farm." }, { depan: "", belakang: "S.Farm." }],
    jabatan: ["Apoteker", "Asisten Apoteker", "Tenaga Teknis Kefarmasian"],
  },
  laboratorium: {
    gelar: [{ depan: "", belakang: "A.Md.AK" }, { depan: "", belakang: "S.Tr.AK" }, { depan: "", belakang: "S.KM" }],
    jabatan: ["Pranata Laboratorium Kesehatan", "Analis Laboratorium", "Pengelola Instalasi Laboratorium"],
  },
  rekamMedik: {
    gelar: [{ depan: "", belakang: "A.Md.RMIK" }, { depan: "", belakang: "S.KM" }, { depan: "", belakang: "S.Tr.RMIK" }],
    jabatan: ["Perekam Medis Ahli Muda", "Perekam Medis", "Analis Rekam Medik"],
  },
  rehab: {
    gelar: [{ depan: "", belakang: "S.Ft" }, { depan: "", belakang: "A.Md.Fis" }, { depan: "", belakang: "S.Tr.Ft" }],
    jabatan: ["Fisioterapis", "Terapis Okupasi", "Terapis Wicara"],
  },
  psikologi: {
    gelar: [{ depan: "", belakang: "S.Psi" }, { depan: "", belakang: "M.Psi" }, { depan: "", belakang: "S.Psi., M.Psi" }],
    jabatan: ["Psikolog Klinis", "Asisten Psikolog", "Terapis Psikologi"],
  },
  laundry: {
    gelar: [{ depan: "", belakang: "A.Md." }, { depan: "", belakang: "S.Sos" }, { depan: "", belakang: "" }],
    jabatan: ["Petugas Layanan Laundry", "Pengelola Linen", "Staf Administrasi"],
  },
  keperawatan: {
    gelar: [{ depan: "", belakang: "S.Kep., Ns" }, { depan: "", belakang: "A.Md.Kep" }, { depan: "", belakang: "S.Kep., Ns., M.Kep" }, { depan: "", belakang: "SKM" }],
    jabatan: ["Perawat Ahli Muda", "Perawat Pelaksana", "Bidan Pelaksana", "Pengelola Keperawatan"],
  },
  rawat: {
    gelar: [{ depan: "", belakang: "S.Kep., Ns" }, { depan: "", belakang: "A.Md.Kep" }, { depan: "", belakang: "S.Kep" }, { depan: "", belakang: "S.Kep., Ns., M.Kep" }],
    jabatan: ["Perawat Pelaksana", "Perawat Ahli Pertama", "Perawat Ahli Muda", "Bidan Pelaksana"],
  },
  gigi: {
    gelar: [{ depan: "", belakang: "A.Md.Rad" }, { depan: "drg.", belakang: "" }, { depan: "", belakang: "S.Tr.Rad" }],
    jabatan: ["Radiografer", "Perawat Gigi", "Dokter Gigi"],
  },
  jkn: {
    gelar: [{ depan: "", belakang: "S.E." }, { depan: "", belakang: "A.Md." }, { depan: "", belakang: "S.KM" }],
    jabatan: ["Pengelola Jaminan Kesehatan", "Verifikator Klaim", "Staf Administrasi"],
  },
};

function profileFor(unitName) {
  if (unitName === "Bagian Keuangan") return PROFILES.keuangan;
  if (unitName.includes("Umum Kepegawaian")) return PROFILES.umum;
  if (unitName.includes("Perencanaan")) return PROFILES.perencanaan;
  if (unitName.includes("Hukum")) return PROFILES.hukum;
  if (unitName.includes("Penunjang & Non Medik")) return PROFILES.penunjangNonMedik;
  if (unitName.includes("Diklat")) return PROFILES.diklat;
  if (unitName === "Komite Medik") return PROFILES.medik;
  if (unitName.includes("Pelayanan Medik")) return PROFILES.pelayananMedik;
  if (unitName.includes("Penunjang Medik")) return PROFILES.penunjangMedik;
  if (unitName.includes("Gizi")) return PROFILES.gizi;
  if (unitName.includes("Farmasi")) return PROFILES.farmasi;
  if (unitName.includes("Laboratorium")) return PROFILES.laboratorium;
  if (unitName.includes("Rekam Medik")) return PROFILES.rekamMedik;
  if (unitName.includes("Rehab Medik")) return PROFILES.rehab;
  if (unitName.includes("Psikologi")) return PROFILES.psikologi;
  if (unitName.includes("Loundry")) return PROFILES.laundry;
  if (unitName.includes("Keperawatan")) return PROFILES.keperawatan;
  if (unitName.includes("Rawat Inap") || unitName.includes("Rawat Jalan")) return PROFILES.rawat;
  if (unitName.includes("Poli Gilut")) return PROFILES.gigi;
  if (unitName.includes("JKN")) return PROFILES.jkn;
  return PROFILES.umum;
}

const PANGKAT = [
  ["Pengatur Muda", "II/a"],
  ["Pengatur Muda Tk. I", "II/b"],
  ["Pengatur", "II/c"],
  ["Penata Muda", "III/a"],
  ["Penata Muda Tk. I", "III/b"],
  ["Penata", "III/c"],
  ["Penata Tk. I", "III/d"],
  ["Pembina", "IV/a"],
  ["Pembina Tk. I", "IV/b"],
];

function statusKepegawaian() {
  const n = rng();
  if (n < 0.72) return "PNS";
  if (n < 0.95) return "PPPK";
  return "PPPK Paruh Waktu";
}

function displayName(baseName, gelar) {
  const depan = gelar.depan ? `${gelar.depan} ` : "";
  const belakang = gelar.belakang ? `, ${gelar.belakang}` : "";
  return `${depan}${baseName}${belakang}`;
}

function dateIso(year, month, day, hour = 8) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T${hh}:00:00+08:00`).toISOString();
}

/* ------------------------------------------------------------------ */
/* Assessment generation                                               */
/* ------------------------------------------------------------------ */
const VIOLATION_WEIGHT = [7, 11, 13, 16, 8, 6, 9, 30];

function chooseViolations(max = 3) {
  const count = rng() < 0.62 ? 1 : rng() < 0.9 ? 2 : max;
  const pool = [];
  VIOLATION_WEIGHT.forEach((w, idx) => {
    for (let i = 0; i < w; i += 1) pool.push(idx);
  });
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < count && guard < 200) {
    guard += 1;
    const idx = pick(pool);
    chosen.add(idx);
  }
  return chosen;
}

function chooseReason() {
  const n = rng();
  if (n < 0.34) return "Cuti";
  if (n < 0.64) return "Sakit";
  if (n < 0.9) return "Dinas Luar/Tugas";
  return "Lainnya";
}

function fillAssessment(assessmentId, itemRows, kabidId, at, forcedStatus) {
  let status = forcedStatus;
  if (!status) {
    const n = rng();
    status = n < 0.86 ? "patuh" : n < 0.955 ? "tidak_patuh" : "tidak_diperiksa";
  }

  if (status === "belum") return;

  if (status === "tidak_diperiksa") {
    const alasan = chooseReason();
    const keterangan =
      alasan === "Lainnya"
        ? pick(["Tugas belajar di luar daerah", "Mengikuti bimbingan teknis", "Izin keperluan keluarga"])
        : rng() < 0.2
          ? pick(["Surat keterangan terlampir", "Telah diinformasikan ke unit"])
          : null;
    run(
      `UPDATE assessments SET status='tidak_diperiksa', alasan_tidak_diperiksa=?, keterangan=?,
       dinilai_oleh=?, dinilai_pada=?, updated_at=? WHERE id=?`,
      alasan,
      keterangan,
      kabidId,
      at,
      at,
      assessmentId,
    );
    return;
  }

  let violationSet = new Set();
  if (status === "tidak_patuh") violationSet = chooseViolations();
  const keterangan =
    status === "tidak_patuh" && rng() < 0.3
      ? pick([
          "Ditegur saat apel pagi",
          "Atribut dilengkapi setelah pemeriksaan",
          "Pakaian tidak sesuai jadwal hari",
          "Sepatu tidak sesuai ketentuan",
        ])
      : null;

  run(
    `UPDATE assessments SET status=?, keterangan=?, dinilai_oleh=?, dinilai_pada=?, updated_at=? WHERE id=?`,
    status,
    keterangan,
    kabidId,
    at,
    at,
    assessmentId,
  );
  itemRows.forEach((item, idx) => {
    insert(
      "INSERT INTO assessment_items (assessment_id, period_item_id, memenuhi) VALUES (?, ?, ?)",
      assessmentId,
      item.id,
      violationSet.has(idx) ? 0 : 1,
    );
  });
}

function assessmentForEmployee(feId) {
  return get("SELECT * FROM assessments WHERE form_employee_id=?", feId);
}

function addHistory(formId, kejadian, userId, nama, at, catatan = null) {
  insert(
    "INSERT INTO form_history (form_id, kejadian, oleh_user_id, oleh_nama, pada, catatan) VALUES (?,?,?,?,?,?)",
    formId,
    kejadian,
    userId,
    nama,
    at,
    catatan,
  );
}

function addAudit(entity, entityId, action, actorId, actorNama, at, detail) {
  insert(
    "INSERT INTO audit_log (entity, entity_id, action, actor_id, actor_nama, pada, detail) VALUES (?,?,?,?,?,?,?)",
    entity,
    entityId,
    action,
    actorId,
    actorNama,
    at,
    detail ? JSON.stringify(detail) : null,
  );
}

/* ------------------------------------------------------------------ */
/* Seeder                                                              */
/* ------------------------------------------------------------------ */
export function seedDatabase() {
  const existing = count("SELECT COUNT(*) c FROM users");
  if (existing > 0) return false;

  const now = nowIso();
  const adminHash = bcrypt.hashSync("WisnuK3r3n@", 10);
  const kabidHash = bcrypt.hashSync("simpatik123", 10);

  tx(() => {
    /* Users ---------------------------------------------------------- */
    const adminId = insert(
      "INSERT INTO users (nama, username, password_hash, role, jabatan, nip, aktif, created_at) VALUES (?,?,?,?,?,?,1,?)",
      "Administrator SIMPATIK",
      "admin",
      adminHash,
      "admin",
      "Administrator Sistem",
      null,
      now,
    );

    const kabidIds = {};
    KABID_SEED.forEach((k) => {
      kabidIds[k.key] = insert(
        "INSERT INTO users (nama, username, password_hash, role, jabatan, nip, aktif, created_at) VALUES (?,?,?,?,?,?,1,?)",
        k.nama,
        k.nip,
        kabidHash,
        "kabid",
        k.jabatan,
        k.nip,
        now,
      );
    });

    /* Units & assignments ------------------------------------------- */
    const units = [];
    UNITS_SEED.forEach((u, idx) => {
      const unitId = insert(
        "INSERT INTO units (nama, urutan, aktif) VALUES (?,?,1)",
        u.nama,
        idx + 1,
      );
      units.push({ ...u, id: unitId });
      insert(
        "INSERT INTO assignments (user_id, unit_id) VALUES (?,?)",
        kabidIds[u.kabid],
        unitId,
      );
    });

    /* Items ---------------------------------------------------------- */
    const items = [];
    ITEMS_SEED.forEach((item, idx) => {
      const itemId = insert(
        "INSERT INTO items (nama, kelompok, urutan, aktif) VALUES (?,?,?,1)",
        item.nama,
        item.kelompok,
        idx + 1,
      );
      items.push({ ...item, id: itemId });
    });

    /* Employees ------------------------------------------------------ */
    const usedNames = new Set();
    const employees = [];
    const counters = new Map();

    units.forEach((unit) => {
      const profile = profileFor(unit.nama);
      for (let i = 0; i < unit.jumlah; i += 1) {
        let baseName = "";
        let guard = 0;
        while (!baseName && guard < 300) {
          guard += 1;
          const gender = rng() < 0.46 ? "L" : "P";
          const first = pick(gender === "L" ? MALE : FEMALE);
          const last = pick(LAST);
          let candidate = `${first} ${last}`;
          if (usedNames.has(candidate)) candidate = `${first} ${pick(MIDDLE)} ${last}`;
          if (!usedNames.has(candidate)) {
            usedNames.add(candidate);
            baseName = candidate;
          }
        }
        if (!baseName) baseName = `Pegawai ${unit.nama} ${i + 1}`;

        const gender = rng() < 0.46 ? "L" : "P";
        const birthYear = randInt(1968, 2000);
        const birthMonth = randInt(1, 12);
        const birthDay = randInt(1, 28);
        const tmtYear = randInt(2004, 2024);
        const tmtMonth = randInt(1, 12);
        const counterKey = `${tmtYear}${tmtMonth}${gender}`;
        const seq = (counters.get(counterKey) || 0) + 1;
        counters.set(counterKey, seq);
        const nip = `${birthYear}${String(birthMonth).padStart(2, "0")}${String(birthDay).padStart(2, "0")}${tmtYear}${String(tmtMonth).padStart(2, "0")}${gender === "L" ? 1 : 2}${String(seq).padStart(3, "0")}`;

        const gelar = pick(profile.gelar);
        const isDoctor = profile.doctorChance && rng() < profile.doctorChance;
        const finalGelar = isDoctor ? { depan: "dr.", belakang: pick(["Sp.KJ", "Sp.KJ., M.Kes", ""]) } : gelar;
        const status = statusKepegawaian();
        const pangkat = pick(PANGKAT);

        employees.push({
          unitId: unit.id,
          unitName: unit.nama,
          nama: baseName,
          nip,
          issue: null,
          found: true,
          gelar: finalGelar,
          display: displayName(baseName, finalGelar),
          jabatan: isDoctor
            ? "Dokter Spesialis Kedokteran Jiwa"
            : pick(profile.jabatan),
          pangkat: pangkat[0],
          golongan: pangkat[1],
          statusKepegawaian: status,
        });
      }
    });

    /* Data quality issues (PRD Appendix C) -------------------------- */
    const rawatInap = units.find((u) => u.nama === "Instalasi Rawat Inap");
    const rawatInapIdx = employees
      .map((e, idx) => (e.unitId === rawatInap.id ? idx : -1))
      .filter((idx) => idx >= 0);

    const emptyPicks = new Set();
    while (emptyPicks.size < 3) emptyPicks.add(pick(rawatInapIdx));
    emptyPicks.forEach((idx) => {
      employees[idx].nip = null;
      employees[idx].issue = "kosong";
      employees[idx].found = false;
      employees[idx].gelar = { depan: "", belakang: "" };
      employees[idx].display = employees[idx].nama;
    });

    const used = new Set(emptyPicks);
    let guard = 0;
    while (used.size < 3 + 39 && guard < 5000) {
      guard += 1;
      const idx = randInt(0, employees.length - 1);
      if (used.has(idx)) continue;
      used.add(idx);
      employees[idx].nip = employees[idx].nip.slice(0, 15);
      employees[idx].issue = "pendek";
      employees[idx].found = false;
      employees[idx].gelar = { depan: "", belakang: "" };
      employees[idx].display = employees[idx].nama;
    }

    let weirdAdded = 0;
    guard = 0;
    while (weirdAdded < 2 && guard < 2000) {
      guard += 1;
      const idx = randInt(0, employees.length - 1);
      if (used.has(idx)) continue;
      used.add(idx);
      const raw = employees[idx].nip;
      employees[idx].nip =
        weirdAdded === 0
          ? raw.slice(0, 14)
          : `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8, 12)} ${raw.slice(12, 14)} ${raw.slice(14, 15)} ${raw.slice(15)}`;
      employees[idx].issue = "aneh";
      employees[idx].found = false;
      employees[idx].gelar = { depan: "", belakang: "" };
      employees[idx].display = employees[idx].nama;
      weirdAdded += 1;
    }

    const duplicateSources = [];
    while (duplicateSources.length < 18) {
      const idx = randInt(0, employees.length - 1);
      if (used.has(idx)) continue;
      used.add(idx);
      duplicateSources.push(idx);
    }
    const duplicateTargets = [];
    while (duplicateTargets.length < 18) {
      const idx = randInt(0, employees.length - 1);
      if (used.has(idx)) continue;
      used.add(idx);
      duplicateTargets.push(idx);
    }
    duplicateTargets.forEach((idx, i) => {
      employees[idx].nip = employees[duplicateSources[i]].nip;
      employees[idx].issue = "duplikat";
    });

    /* Insert employees + identities --------------------------------- */
    const employeesByUnit = new Map();
    employees.forEach((e, idx) => {
      const employeeId = insert(
        "INSERT INTO employees (nama, nip, unit_id, aktif, created_at) VALUES (?,?,?,1,?)",
        e.nama,
        e.nip,
        e.unitId,
        now,
      );
      e.id = employeeId;
      insert(
        `INSERT INTO simpeg_identities
         (employee_id, nama_simpeg, gelar_depan, gelar_belakang, jabatan, pangkat, golongan,
          status_kepegawaian, satker, unker, url_foto, foto_path, foto_mime, found, sync_error, synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        employeeId,
        e.nama,
        e.gelar.depan || null,
        e.gelar.belakang || null,
        e.found ? e.jabatan : null,
        e.found ? e.pangkat : null,
        e.found ? e.golongan : null,
        e.found ? e.statusKepegawaian : null,
        e.found ? "RSJ Sambang Lihum" : null,
        e.found ? e.unitName : null,
        null,
        null,
        null,
        e.found ? 1 : 0,
        e.found
          ? null
          : e.issue === "kosong"
            ? "NIP kosong"
            : e.issue === "pendek"
              ? "NIP 15 digit — tidak ditemukan di SIMPEG"
              : "Format NIP tidak beraturan — tidak ditemukan di SIMPEG",
        dateIso(2026, 10, 2, 9),
      );
      if (!employeesByUnit.has(e.unitId)) employeesByUnit.set(e.unitId, []);
      employeesByUnit.get(e.unitId).push(e);
    });

    /* Workspace helper for a period ---------------------------------- */
    function createPeriod(bulan, tahun, openedAt) {
      const periodId = insert(
        "INSERT INTO periods (bulan, tahun, status, opened_by, opened_at) VALUES (?,?,?,?,?)",
        bulan,
        tahun,
        "berjalan",
        adminId,
        openedAt,
      );
      const periodItems = items.map((item, idx) =>
        ({
          id: insert(
            "INSERT INTO period_items (period_id, item_id, nama_saat_itu, kelompok_saat_itu, urutan) VALUES (?,?,?,?,?)",
            periodId,
            item.id,
            item.nama,
            item.kelompok,
            idx + 1,
          ),
          nama: item.nama,
        }),
      );

      const forms = [];
      units.forEach((unit) => {
        const kabid = KABID_SEED.find((k) => k.key === unit.kabid);
        const kabidId = kabidIds[unit.kabid];
        const formId = insert(
          "INSERT INTO forms (period_id, unit_id, kabid_id, status, created_at) VALUES (?,?,?,?,?)",
          periodId,
          unit.id,
          kabidId,
          "belum",
          openedAt,
        );
        const unitEmployees = (employeesByUnit.get(unit.id) || []).slice();
        unitEmployees.sort((a, b) => a.display.localeCompare(b.display, "id"));
        unitEmployees.forEach((emp, idx) => {
          const feId = insert(
            "INSERT INTO form_employees (form_id, employee_id, nama_saat_itu, nip_saat_itu, urutan) VALUES (?,?,?,?,?)",
            formId,
            emp.id,
            emp.display,
            emp.nip,
            idx + 1,
          );
          insert(
            "INSERT INTO assessments (form_employee_id, status, updated_at) VALUES (?, 'belum', ?)",
            feId,
            openedAt,
          );
        });
        addHistory(formId, "Formulir dibuat", adminId, "Administrator SIMPATIK", openedAt, `Periode ${BULAN[bulan - 1]} ${tahun} dibuka`);
        forms.push({ id: formId, unit, kabidId, kabid });
      });

      return { id: periodId, items: periodItems, forms, openedAt };
    }

    function completeForm(form, period, at, { setStatus = true } = {}) {
      const assessmentRows = all(
        `SELECT a.id, fe.id AS fe_id FROM assessments a
         JOIN form_employees fe ON fe.id = a.form_employee_id
         WHERE fe.form_id=?`,
        form.id,
      );
      assessmentRows.forEach((row) => {
        fillAssessment(row.id, period.items, form.kabidId, at);
      });
      if (setStatus) {
        run(
          `UPDATE forms SET status='selesai', completed_at=?, tanggal_pemeriksaan=?,
           penanda_tangan_nama=?, penanda_tangan_nip=?, penanda_tangan_jabatan=? WHERE id=?`,
          at,
          at.slice(0, 10),
          form.kabid.nama,
          form.kabid.nip,
          form.kabid.jabatan,
          form.id,
        );
        addHistory(form.id, "Ditandai selesai", form.kabidId, form.kabid.nama, at, `Tanggal pemeriksaan ${at.slice(0, 10)}`);
      }
    }

    function partialFill(form, period, ratio, at) {
      const rows = all(
        `SELECT a.id, fe.id AS fe_id FROM assessments a
         JOIN form_employees fe ON fe.id = a.form_employee_id
         WHERE fe.form_id=? ORDER BY fe.urutan`,
        form.id,
      );
      const target = Math.max(1, Math.round(rows.length * ratio));
      const indices = rows.map((_, idx) => idx);
      for (let i = indices.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const chosen = new Set(indices.slice(0, target));
      rows.forEach((row, idx) => {
        if (chosen.has(idx)) fillAssessment(row.id, period.items, form.kabidId, at);
      });
      run("UPDATE forms SET status='sedang' WHERE id=?", form.id);
    }

    /* October 2026 — closed and final -------------------------------- */
    const october = createPeriod(10, 2026, dateIso(2026, 10, 1));
    october.forms.forEach((form, idx) => {
      const day = 25 + (idx % 6);
      completeForm(form, october, dateIso(2026, 10, day, 10 + (idx % 6)));
    });
    run(
      "UPDATE periods SET status='ditutup', closed_by=?, closed_at=? WHERE id=?",
      adminId,
      dateIso(2026, 11, 3, 9),
      october.id,
    );
    october.forms.forEach((form) => {
      run("UPDATE forms SET status='terkunci' WHERE id=?", form.id);
      addHistory(form.id, "Periode ditutup", adminId, "Administrator SIMPATIK", dateIso(2026, 11, 3, 9), "Formulir dikunci permanen");
    });
    addAudit("period", october.id, "Tutup periode", adminId, "Administrator SIMPATIK", dateIso(2026, 11, 3, 9), {
      periode: "Oktober 2026",
    });

    /* November 2026 — running period -------------------------------- */
    const november = createPeriod(11, 2026, dateIso(2026, 11, 2));
    addAudit("period", november.id, "Buka periode", adminId, "Administrator SIMPATIK", dateIso(2026, 11, 2), {
      periode: "November 2026",
      unit: units.length,
    });

    const completeIdx = new Set([0, 1, 2]);
    const editedIdx = 3;
    const fullNotMarkedIdx = 11;
    const progress = {
      4: 0.62,
      5: 0.4,
      6: 0.75,
      7: 0.55,
      8: 0.3,
      9: 0.68,
      10: 0.45,
      12: 0.52,
      13: 0.8,
      14: 0.38,
      19: 0.35,
      20: 0.41,
    };

    november.forms.forEach((form, idx) => {
      if (completeIdx.has(idx)) {
        const day = 10 + (idx % 4);
        completeForm(form, november, dateIso(2026, 11, day, 10 + idx));
      } else if (idx === editedIdx) {
        const completeAt = dateIso(2026, 11, 9, 10);
        completeForm(form, november, completeAt);
        const editAt = dateIso(2026, 11, 15, 9);
        const first = get(
          `SELECT a.id, fe.id AS fe_id FROM assessments a
           JOIN form_employees fe ON fe.id=a.form_employee_id
           WHERE fe.form_id=? ORDER BY fe.urutan LIMIT 1`,
          form.id,
        );
        if (first) {
          run(
            "UPDATE assessments SET keterangan=?, dinilai_pada=?, updated_at=? WHERE id=?",
            "Diperbarui setelah pemeriksaan awal",
            editAt,
            editAt,
            first.id,
          );
        }
        run(
          `UPDATE forms SET status='sedang', completed_at=NULL, tanggal_pemeriksaan=NULL,
           penanda_tangan_nama=NULL, penanda_tangan_nip=NULL, penanda_tangan_jabatan=NULL
           WHERE id=?`,
          form.id,
        );
        addHistory(
          form.id,
          "Diubah setelah ditandai selesai",
          form.kabidId,
          form.kabid.nama,
          editAt,
          "Status formulir kembali menjadi Sedang Diisi; penandaan selesai sebelumnya dibatalkan",
        );
      } else if (idx === fullNotMarkedIdx) {
        const at = dateIso(2026, 11, 14, 13);
        completeForm(form, november, at, { setStatus: false });
        run("UPDATE forms SET status='sedang' WHERE id=?", form.id);
      } else if (progress[idx]) {
        partialFill(form, november, progress[idx], dateIso(2026, 11, 12 + (idx % 4), 9 + (idx % 7)));
      }
      // remaining units stay "belum"
    });

    /* A few audit trail entries for master data ---------------------- */
    addAudit("user", kabidIds.noorlianisyah, "Buat akun", adminId, "Administrator SIMPATIK", dateIso(2026, 10, 29, 14), {
      username: KABID_SEED.find((k) => k.key === "noorlianisyah").nip,
      peran: "Kabid",
    });
    addAudit("assignment", units[20].id, "Ubah penugasan", adminId, "Administrator SIMPATIK", dateIso(2026, 10, 29, 14), {
      unit: units[20].nama,
      kabid: KABID_SEED.find((k) => k.key === "noorlianisyah").nama,
    });
  });

  return true;
}

export { KABID_SEED, UNITS_SEED, ITEMS_SEED, displayName };
