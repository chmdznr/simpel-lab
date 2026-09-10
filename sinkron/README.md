# SIMPEL — versi sinkron (bahan demo MP-2)

Empat layanan Node.js yang memanggil satu sama lain lewat HTTP biasa, **berantai**,
**tanpa broker**: `gateway → validasi → billing → notifikasi`. Sengaja dibuat rapuh —
ini bahan demo kegagalan di sesi 2.1, bukan contoh yang baik untuk ditiru.

```
Pengguna → gateway (3001) → validasi (3002) → billing (3003) → notifikasi (3004)
```

## Menjalankan

Pastikan Postgres sudah hidup (`docker compose up -d postgres`) dan `.env` sudah
disalin dari `.env.contoh` di root repo. Lalu buka **4 terminal terpisah**, satu per
layanan (urutan tidak penting, tapi lebih gampang kalau billing & notifikasi
duluan):

```bash
npm run sinkron:validasi
npm run sinkron:billing
npm run sinkron:notifikasi
npm run sinkron:gateway
```

Uji jalur normal (biarkan keempatnya hidup):

```bash
curl -X POST http://localhost:3001/pengajuan \
  -H 'content-type: application/json' \
  -d '{"pemohon":"Budi","jenis":"SIUP","kantor":"Jakarta"}'
```

Respons berhasil memuat `durasiMs` — perhatikan angka ini, jadi pembanding di kedua
demo di bawah.

---

## Demo A — matikan billing (bukti LI-1)

1. Di terminal `sinkron:billing`, tekan `Ctrl+C`.
2. Kirim ulang request `curl` di atas (atau lewat form kalau ada).
3. **Amati:** respons `HTTP 502`, `"ok": false`. Seluruh pengajuan gagal —
   padahal `validasi` sudah sukses memproses dan menulis ke DB. Kerja itu
   terbuang percuma karena tidak ada yang "menitipkan" pesan menunggu billing
   hidup lagi.
4. Nyalakan lagi: `npm run sinkron:billing`.

**Poin ke peserta:** dengan broker (lihat `../layanan/`), pesan tetap tersimpan
di queue saat billing mati dan diproses begitu billing hidup kembali — tidak
ada transaksi yang gagal permanen.

## Demo B — notifikasi lambat (bukti LI-3)

Layanan `notifikasi` sudah dikonfigurasi menunggu `NOTIF_DELAY_MS` (bawaan
3000 ms) sebelum membalas, mensimulasikan pihak ketiga yang lambat.

1. Pastikan keempat layanan hidup.
2. Kirim request `curl` seperti di atas dan perhatikan **waktu tunggu
   terminal** serta nilai `durasiMs` di respons.
3. **Amati:** total waktu response time pengguna ikut molor sebesar delay
   notifikasi (\~3,2–3,7 detik), walau billing dan validasi sudah selesai
   jauh lebih cepat. Pengguna menunggu langkah yang sama sekali tidak
   relevan buat dia (notifikasi bisa dikirim belakangan, tidak perlu
   ditunggu).

Untuk angka yang lebih meyakinkan (beban, bukan satu request), pakai
`tools/beban.js` dari root:

```bash
npm run beban -- 30 5
```

Catat `p50`/`p95`/tingkat kegagalan yang tercetak — jadi pembanding langsung
saat pola yang sama diulang terhadap `layanan/gateway` (versi berbroker) di
Lab 5c (MP-8).

## Membersihkan

`Ctrl+C` di keempat terminal. Data uji di tabel `pengajuan` boleh dibiarkan atau
dibersihkan dengan:

```bash
docker exec simpel-postgres psql -U simpel -d simpel -c "TRUNCATE pengajuan;"
```
