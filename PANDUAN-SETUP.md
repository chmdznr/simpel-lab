# Panduan Persiapan Lingkungan (Setup Guide) — SIMPEL Lab

**Dikirimkan H-1 Sebelum Pelatihan Dimulai.**  
Mohon ikuti panduan ini sampai selesai dan laporkan hasil verifikasinya sebelum hari pertama pelatihan. Kesiapan lingkungan ini adalah prasyarat mutlak untuk dapat mengikuti seluruh rangkaian 27 JP praktik hands-on.

Estimasi waktu pengerjaan: sekitar 15–20 menit (tergantung kecepatan koneksi internet untuk mengunduh image Docker ~600 MB).

---

## Prasyarat Perangkat & Software

- Laptop dengan **Docker Desktop** (atau Docker Engine di Linux) yang sudah terpasang dan **sedang berjalan**.
- **Node.js versi 20** ke atas (verifikasi via `node --version`).
- Minimal **4 GB RAM kosong** (di luar penggunaan sistem operasi dan aplikasi harian).
- Koneksi internet stabil untuk mengunduh base image container di awal setup.

---

## Langkah 1 — Unduh Repositori Lab

Unduh atau clone folder repositori `simpel-lab/` sesuai instruksi dari panitia pelatihan. Buka aplikasi Terminal / Command Prompt, lalu arahkan ke root direktori tersebut:

```bash
cd simpel-lab
```

---

## Langkah 2 — Siapkan File Konfigurasi Environment

Salin template konfigurasi ke file `.env` lokal:

```bash
cp .env.contoh .env
```

> **Catatan:** Nilai bawaan di dalam `.env` sudah dikonfigurasi optimal untuk penggunaan lokal di laptop. Jangan mengubah isi file ini kecuali terdapat port yang bentrok dengan aplikasi lokal lain (lihat bagian *Troubleshooting* di bawah).

---

## Langkah 3 — Jalankan Container Broker & Database

Jalankan container RabbitMQ dan PostgreSQL di latar belakang (*detached mode*):

```bash
docker compose up -d rabbitmq postgres
```

Perintah ini akan mengunduh image `rabbitmq:4-management` dan `postgres:16-alpine` (hanya diunduh sekali di awal), lalu menyalakan kedua container tersebut.

> Container Prometheus dan Grafana belum perlu dijalankan sekarang — stack monitoring baru digunakan pada Hari ke-5 (MP-09).

---

## Langkah 4 — Verifikasi Kesehatan Container

Periksa status container yang sedang berjalan:

```bash
docker compose ps
```

Pastikan container `simpel-rabbitmq` dan `simpel-postgres` menampilkan status **`Up ... (healthy)`**. Jika status masih `starting`, tunggu sekitar 15–30 detik lalu ulangi perintah pengecekan.

### Akses RabbitMQ Management UI
Buka web browser dan akses: **`http://localhost:15672`**. Login menggunakan kredensial default:
- **Username:** `simpel`
- **Password:** `simpel123`

Jika halaman dashboard Management UI berhasil terbuka dan menampilkan ringkasan overview broker, **setup infrastruktur dasar Anda dinyatakan berhasil.** Laporkan hasil ini kepada panitia / instruktur di grup kelas.

---

## Langkah 5 — Instalasi Dependensi Node.js

Jalankan instalasi paket dependensi:

```bash
npm install
```

Perintah ini akan memasang seluruh pustaka yang dibutuhkan (`amqplib`, `pg`, `express`, dll). Langkah ini hanya perlu dijalankan sekali di awal.

---

## Langkah 6 (Opsional tapi Dianjurkan) — Uji Coba Layanan

Untuk memastikan koneksi Node.js ke database PostgreSQL berjalan normal:

1. Di terminal utama, jalankan salah satu service simulasi:
   ```bash
   npm run sinkron:billing
   ```
2. Di terminal kedua, kirim request uji via `curl`:
   ```bash
   curl -X POST http://localhost:3003/billing \
     -H 'content-type: application/json' \
     -d '{"id":"test-1234"}'
   ```
3. Jika terminal membalas dengan payload JSON `{"ok":true, "kodeBilling":"BIL-..."}`, environment Node.js dan database Anda sudah 100% siap. Hentikan service dengan menekan `Ctrl+C`.

---

## Manajemen Siklus Hidup Container

Container boleh dibiarkan menyala selama periode pelatihan, atau dimatikan setiap kali sesi harian berakhir dan dinyalakan kembali keesokan harinya:

```bash
docker compose stop     # Menghentikan container sementara, seluruh data tetap aman tersimpan
docker compose up -d    # Menyalakan kembali container
```

> **Peringatan:** Hindari menjalankan perintah `docker compose down -v` kecuali Anda memang berniat menghapus seluruh database/volume dan mereset environment dari nol.

---

## Panduan Troubleshooting Masalah Umum

### 1. Error Port Sudah Digunakan (`port is already allocated`)
Jika port 5672, 15672, atau 5432 sudah terpakai oleh aplikasi lain di laptop Anda:
1. Buka file `.env` dengan text editor.
2. Ubah port yang bentrok ke port alternatif, misalnya:
   ```text
   RABBITMQ_PORT=5673
   ```
3. Sesuaikan juga URL koneksi pada baris `AMQP_URL` di bawahnya agar port-nya cocok.
4. Jalankan `docker compose down` lalu jalankan kembali `docker compose up -d rabbitmq postgres`.

### 2. Error `Cannot connect to the Docker daemon`
Aplikasi Docker Desktop belum menyala sempurna. Buka aplikasi Docker Desktop, tunggu hingga indikator di menu bar/taskbar menunjukkan status *running*, lalu ulangi perintah docker compose.

### 3. Kendala Kapasitas Memori / Laptop Lambat
- Pastikan hanya menyalakan container yang dibutuhkan: `docker compose up -d rabbitmq postgres` (jangan menyalakan seluruh service monitoring sekaligus).
- Pada pengaturan Docker Desktop (Settings $\rightarrow$ Resources), batasi alokasi RAM ke Docker minimal 4 GB.
- Tutup aplikasi berat yang tidak digunakan selama sesi praktik berlangsung.

---

## Langkah Selanjutnya

Simpan folder `simpel-lab/` ini di direktori kerja Anda. Anda akan menggunakannya setiap hari sepanjang sesi pelatihan (14–25 September 2026). Setiap kali memulai sesi kelas, cukup pastikan container aktif dengan perintah: `docker compose up -d rabbitmq postgres`.
