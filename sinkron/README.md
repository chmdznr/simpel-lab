# SIMPEL — Versi Synchronous (Materi Demo MP-02)

Empat service Node.js yang saling memanggil secara berantai melalui protokol HTTP biasa **tanpa perantara message broker**:
`gateway → validasi → billing → notifikasi`. 

Arsitektur ini **sengaja dirancang rapuh** sebagai materi demonstrasi kegagalan sistem pada sesi MP-02, untuk membuktikan kelemahan interaksi synchronous berantai sebelum kita menerapkan message broker.

```text
Pemohon → gateway (:3001) → validasi (:3002) → billing (:3003) → notifikasi (:3004)
```

---

## Cara Menjalankan

Pastikan PostgreSQL sudah aktif (`docker compose up -d postgres`) dan file `.env` sudah disiapkan di root direktori repositori. Buka **4 tab/jendela terminal terpisah**, lalu jalankan masing-masing service (disarankan menyalakan service hilir terlebih dahulu):

```bash
npm run sinkron:validasi
npm run sinkron:billing
npm run sinkron:notifikasi
npm run sinkron:gateway
```

### Uji Coba Jalur Normal (Happy Path)

Saat keempat service menyala, kirim satu permohonan via `curl`:

```bash
curl -X POST http://localhost:3001/pengajuan \
  -H 'content-type: application/json' \
  -d '{"pemohon":"Budi","jenis":"SIUP","kantor":"Jakarta"}'
```

Respons sukses akan menyertakan atribut `durasiMs`. Perhatikan angka latensi ini sebagai baseline untuk dibandingkan dengan skenario kegagalan dan latensi di bawah.

---

## Demo A — Simulasi Downtime Billing (Bukti Kasus LI-1)

Skenario: Service Billing mendadak crash atau tidak dapat diakses.

1. Di terminal `sinkron:billing`, hentikan proses dengan menekan `Ctrl+C`.
2. Kirim ulang request `curl` pengajuan izin di atas.
3. **Amati hasilnya:** Gateway mengembalikan respons `HTTP 502 Bad Gateway` dengan payload `{"ok": false}`. Seluruh transaksi pengajuan dinyatakan gagal oleh pengguna—padahal service `validasi` telah berhasil memvalidasi dokumen dan menyimpan datanya ke database. Komputasi tersebut terbuang sia-sia karena tidak ada antrean penyangga yang menahan pekerjaan hingga service billing hidup kembali.
4. Nyalakan kembali service billing: `npm run sinkron:billing`.

> **Poin Pembelajaran Teknis:** Dengan message broker (arsitektur di folder `../layanan/`), event pengajuan tetap aman tersimpan di dalam queue saat service billing down, dan akan diproses secara otomatis begitu billing pulih kembali tanpa memicu kegagalan transaksi di mata pemohon.

---

## Demo B — Simulasi Latensi Notifikasi Pihak Ketiga (Bukti Kasus LI-3)

Service `notifikasi` dikonfigurasi dengan delay artifisial melalui environment variable `NOTIF_DELAY_MS` (default 3000 ms) untuk mensimulasikan latensi vendor gateway email/SMS yang lambat.

1. Pastikan keempat service menyala normal.
2. Kirim kembali request `curl` di atas dan perhatikan waktu tunggu di terminal serta nilai `durasiMs` pada response body.
3. **Amati hasilnya:** Total waktu tunggu yang dirasakan pemohon membengkak hingga ~3,2–3,7 detik hanya karena menunggu proses pengiriman notifikasi selesai. Pengguna terpaksa menahan koneksi HTTP untuk operasi sampingan yang sebenarnya tidak membutuhkan respons seketika (*temporal coupling*).

### Pengujian Beban Bersamaan (Load Test)

Untuk melihat dampak latensi kaskade ini pada kondisi konkurensi tinggi, jalankan script generator beban dari root repositori (30 request dengan 5 konkurensi paralel):

```bash
npm run beban -- 30 5
```

Catat metrik throughput, persentil `p50`, `p95`, dan tingkat error yang dihasilkan. Angka ini akan menjadi pembanding langsung saat kita menguji versi berbroker (`layanan/gateway`) pada Lab 5c (MP-08).

---

## Membersihkan Environment Demo

Hentikan proses di keempat terminal dengan menekan `Ctrl+C`. Data uji pada tabel `pengajuan` dapat dibersihkan jika diinginkan:

```bash
docker exec simpel-postgres psql -U simpel -d simpel -c "TRUNCATE pengajuan;"
```
