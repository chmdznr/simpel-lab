# Panduan Setup — SIMPEL Lab

**Dikirim H-1.** Mohon ikuti sampai selesai dan laporkan hasilnya (berhasil / macet
di langkah mana) sebelum hari pelatihan. Tanpa ini, praktik 27 JP di kelas tidak
bisa Anda ikuti.

Total waktu: sekitar 15–20 menit kalau koneksi internet lancar (unduhan image
Docker \~600 MB).

---

## Yang Anda butuhkan

- Laptop dengan **Docker Desktop** terpasang dan **sedang berjalan**.
- **Node.js versi 20** ke atas (`node --version`).
- Minimal **4 GB RAM luang** (di luar yang dipakai OS & aplikasi lain).
- Koneksi internet untuk mengunduh image Docker (sekali di awal saja).

Belum punya Docker Desktop atau Node.js? Unduh dari situs resmi masing-masing
sebelum lanjut — di luar cakupan panduan ini.

---

## Langkah 1 — Unduh bahan lab

Ikuti instruksi yang diberikan panitia untuk mendapatkan folder `simpel-lab/`
(via link zip atau `git clone`). Buka terminal di dalam folder tersebut.

## Langkah 2 — Siapkan file konfigurasi

```bash
cp .env.contoh .env
```

Nilai bawaan di `.env` sudah cocok untuk laptop sendiri. **Jangan ubah apa pun**
di langkah ini kecuali Anda tahu port yang disebut di dalamnya sudah dipakai
aplikasi lain (lihat Troubleshooting).

## Langkah 3 — Nyalakan broker & database

```bash
docker compose up -d rabbitmq postgres
```

Perintah ini mengunduh image `rabbitmq:4-management` dan `postgres:16-alpine`
(sekali saja, tersimpan untuk pemakaian berikutnya), lalu menyalakan
keduanya di latar belakang.

Prometheus dan Grafana **belum perlu dinyalakan sekarang** — baru dipakai di
Hari 5 (MP-9). Kalau ingin menyalakan semuanya sekaligus: `docker compose up -d`.

## Langkah 4 — Verifikasi berhasil

```bash
docker compose ps
```

Anda harus melihat `simpel-rabbitmq` dan `simpel-postgres` dengan status
`Up ... (healthy)`. Kalau masih `starting`, tunggu 30 detik lalu ulangi.

Lalu buka browser ke **http://localhost:15672** — Anda harus melihat halaman
login RabbitMQ Management. Login dengan:

- Username: `simpel`
- Password: `simpel123`

Kalau halaman ini muncul dan Anda bisa login, **setup Anda berhasil.**
Laporkan ke panitia/instruktur sesuai instruksi yang diberikan (biasanya lewat
form atau grup kelas).

## Langkah 5 — Siapkan dependensi Node.js

```bash
npm install
```

Ini memasang paket untuk semua layanan sekaligus (`express`, `amqplib`, `pg`).
Tidak perlu diulang tiap hari — cukup sekali sekarang, dan lagi kalau
instruktur memberi tahu ada layanan baru ditambahkan.

## Langkah 6 (opsional, tapi dianjurkan) — Coba jalankan sesuatu

Untuk memastikan Node.js dan Postgres benar-benar nyambung, bukan cuma
container-nya hidup:

```bash
npm run sinkron:billing
```

Di terminal lain:

```bash
curl -X POST http://localhost:3003/billing \
  -H 'content-type: application/json' \
  -d '{"id":"test-1234"}'
```

Kalau muncul balasan JSON berisi `"ok":true` dan `"kodeBilling":"BIL-..."`,
Node.js Anda siap. Tekan `Ctrl+C` untuk menghentikannya.

---

## Kapan mematikan container

Boleh dibiarkan hidup selama masa pelatihan (2 minggu), atau dimatikan tiap
selesai sesi dan dinyalakan lagi keesokan harinya:

```bash
docker compose stop     # matikan, data tetap tersimpan
docker compose up -d    # nyalakan lagi
```

Hindari `docker compose down -v` kecuali benar-benar ingin menghapus semua
data (volume) dan mulai dari nol.

---

## Troubleshooting

### "Port sudah dipakai" (`port is already allocated`)

Aplikasi lain di laptop Anda sudah memakai port yang sama (5672, 15672, 5432,
9090, atau 3000). Edit `.env`, ganti nilai port yang bentrok, mis.:

```
RABBITMQ_PORT=5673
```

Lalu `docker compose down` dan `docker compose up -d` lagi. Kalau port AMQP
(`RABBITMQ_PORT`) Anda ubah, ingat sesuaikan juga `AMQP_URL` di baris
bawahnya di `.env` (ganti angka port di URL-nya).

### Docker Desktop tidak mau jalan / macet di "Starting..."

- Restart Docker Desktop dari system tray/menu bar.
- Kalau masih macet, restart laptop.
- Pastikan virtualisasi aktif di BIOS (jarang jadi masalah di laptop modern,
  tapi kadang muncul di laptop kantor yang dikunci kebijakan IT).

### "Cannot connect to the Docker daemon"

Docker Desktop belum menyala. Buka aplikasinya, tunggu sampai ikon di
tray/menu bar menunjukkan status *running* (bukan *starting*), baru ulangi
perintah `docker compose up -d`.

### Memori tidak cukup / laptop jadi sangat lambat

- Pastikan hanya `rabbitmq` dan `postgres` yang hidup selama Hari 1–4:
  `docker compose up -d rabbitmq postgres` (jangan `up -d` polos yang
  menyalakan semuanya termasuk Prometheus+Grafana).
- Di Docker Desktop → Settings → Resources, turunkan batas RAM yang
  dialokasikan ke Docker kalau laptop Anda di bawah 8 GB total, tapi jangan
  di bawah 4 GB atau container bisa gagal start.
- Tutup aplikasi lain yang berat (browser dengan puluhan tab, IDE besar) saat
  sesi praktik berlangsung.

### Kebijakan IT kantor memblokir Docker Desktop

Ini kondisi yang **tidak bisa diselesaikan lewat panduan ini** — butuh dua
opsi:

1. **Kerja berpasangan.** Ikuti praktik menumpang di laptop rekan yang
   Docker-nya jalan normal. Instruktur/panitia akan mengatur pasangan di
   hari-H.
2. **Broker cadangan terpusat** (lihat bagian di bawah) — mengatasi RabbitMQ
   yang diblokir, TAPI kode Node.js dan `npm install` Anda tetap perlu jalan
   lokal. Kalau Docker Desktop sendiri yang diblokir total, opsi ini tidak
   menolong — pakai opsi 1.

Laporkan kondisi ini ke panitia **sebelum hari-H**, jangan menunggu sampai
sesi praktik dimulai.

---

## Broker cadangan terpusat

Kalau RabbitMQ lokal Anda (lewat Docker) tidak bisa dijalankan tapi Node.js
Anda tetap bisa jalan, panitia menyediakan satu instans RabbitMQ terpusat
yang bisa diakses dari luar. **Anda tidak perlu mengubah kode apa pun** —
cukup ganti connection string di `.env`:

```bash
# Komentari baris AMQP_URL yang menunjuk ke localhost:
# AMQP_URL=amqp://simpel:simpel123@localhost:5672

# Aktifkan baris ini, isi dengan kredensial yang dibagikan panitia di hari-H:
AMQP_URL=amqp://<user-anda>:<password-anda>@broker.pelatihan.example:5672/<vhost-anda>
```

Setiap peserta mendapat **vhost sendiri** di broker cadangan supaya queue
antar-peserta tidak saling bertabrakan. Jangan bagikan kredensial Anda ke
peserta lain.

Untuk Management UI broker cadangan, panitia akan membagikan alamat terpisah
(bukan `localhost:15672`) — dipakai persis seperti di Lab 0, hanya alamat dan
login-nya berbeda.

**Catatan:** `postgres` tidak tersedia versi cadangannya. Layanan `validasi`
yang menulis ke database tetap butuh Postgres lokal Anda jalan (lewat Docker)
— broker cadangan hanya menggantikan RabbitMQ.

---

## Sudah selesai? Langkah selanjutnya

Simpan folder `simpel-lab/` ini, Anda akan memakainya lagi setiap hari selama
pelatihan (14–25 September). Tidak perlu mengulang Langkah 1–5 tiap hari —
cukup `docker compose up -d rabbitmq postgres` setiap kali mau mulai sesi.
