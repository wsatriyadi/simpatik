# SIMPATIK

**Sistem Monitoring Kepatuhan Pakaian Dinas & Atribut ASN**  
RSJ Sambang Lihum — Pemerintah Provinsi Kalimantan Selatan

Aplikasi web responsif + PWA untuk memantau kepatuhan pakaian dinas ASN per unit kerja, dengan dua peran: **Admin** (desktop) dan **Kabid** (responsif di ponsel, tablet, dan desktop). Implementasi mengikuti **PRD SIMPATIK v0.5**.

## Menjalankan

Prasyarat: **Node.js 24+** (menggunakan `node:sqlite` bawaan, tanpa dependensi native).

```bash
npm install
npm run seed:reset     # membuat database demo bersih
npm run build
npm start              # http://localhost:3001
```

Mode pengembangan:

```bash
npm run dev            # API :3001 + Vite :5173
```

Database otomatis dibuat dan di-seed jika masih kosong. Seluruh data demo dapat dikembalikan ke kondisi awal kapan saja dengan `npm run seed:reset`.

## Akun demo

| Peran | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Kabid | NIP masing-masing | `simpatik123` |

Contoh Kabid:

| Nama | Username (NIP) |
|---|---|
| Noorlianisyah, SKM | `198006092006042010` |
| Hajjah Nurhikmah, S.ST, M.Kes | `197503252000122008` |
| Nor Hikmah, S.Kep, Ns, M.Kep | `197805202002122004` |
| Muhammad Fahmi Arif, S.Kom, MM | `198203122006041011` |

## Fitur utama

- **Admin**: dasbor pemantauan, buka/tutup periode, unit kerja, pegawai, impor Excel, akun & penugasan Kabid, item periksa, rekap gabungan, detail formulir read-only, dan pengaturan.
- **Kabid**: beranda, daftar pegawai per unit, pengisian checklist 8 item, penilaian Tidak Diperiksa dengan alasan, simpan berkelanjutan, tandai formulir selesai, rekap unit, dan unduh laporan unit. Di desktop/laptop, daftar pegawai dan panel penilaian tampil berdampingan (master-detail); di ponsel/tablet alurnya tetap satu layar penuh.
- **Aturan penilaian**: Patuh bila seluruh item terpenuhi; Tidak Patuh bila ada item tidak terpenuhi; Tidak Diperiksa dengan alasan Cuti/Sakit/Dinas Luar-Tugas/Lainnya. Persentase = Patuh ÷ Diperiksa × 100.
- **Periode**: hanya satu periode berjalan. Formulir dan nama penanda tangan di-snapshot per periode. Setelah periode ditutup, seluruh formulir terkunci permanen dan angka menjadi final.
- **Laporan**: Excel dan PDF per unit sesuai formulir resmi dengan kop logo RSJ Sambang Lihum, plus rekap gabungan rumah sakit. Laporan periode berjalan mencantumkan **SEMENTARA**; laporan periode tertutup final.
- **Identitas resmi**: logo RSJ Sambang Lihum tampil berdampingan dengan SIMPATIK pada halaman masuk dan kop laporan.
- **SIMPEG**: sinkronisasi identitas dan foto dilakukan di server, disimpan lokal, dan tidak pernah dirender langsung dari URL remote. Kegagalan sinkronisasi tidak menimpa data yang sudah ada.
- **PWA**: manifest, ikon, dan service worker; dapat dipasang di layar utama perangkat mobile.

## Struktur proyek

```
src/                 React + TypeScript + Tailwind (UI)
  pages/admin/       Layar Admin
  pages/kabid/       Layar Kabid
  components/        Layout, komponen UI, logo, proteksi peran
  contexts/          Auth dan Toast
  lib/               API client, hooks, format, tipe
server/
  index.js           Express, security headers, serve dist + SPA fallback
  db.js              Skema SQLite (node:sqlite)
  seed.js            Seed demo deterministik
  lib/               Auth, statistik, SIMPEG, impor, laporan, audit
  routes/            Auth, Admin, Kabid, laporan, foto
public/              Manifest, service worker, ikon
scripts/             Generator ikon PWA
```

Data runtime tersimpan di `server/data/` (database, foto SIMPEG) dan tidak disertakan dalam repositori.

## Catatan operasional

- Gunakan satu instance server karena database SQLite lokal. Untuk deployment multi-instance, pindahkan database ke server SQLite terpusat/PostgreSQL.
- Variabel lingkungan yang didukung: `PORT` (default `3001`), `HOST` (default `0.0.0.0`; gunakan `127.0.0.1` di belakang reverse proxy), `SIMPATIK_DB`, `SIMPEG_API_URL`.
- `npm run typecheck` untuk pemeriksaan TypeScript dan `npm run icons` untuk membuat ulang ikon PWA.

## Deployment

Instalasi produksi: **https://simpatik.satriyadi.com** (Cloudflare + Caddy, Express hanya mendengarkan `127.0.0.1:3001`). Password Admin pada instalasi produksi wajib diganti melalui menu Pengaturan Akun.
