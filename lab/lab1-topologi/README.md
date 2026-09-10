# Lab 1 — Bedah Topologi

**Sesi:** MP-4.3 (Hari 2) · **Durasi:** 45 menit

> Kerangka. Rincian langkah lengkap disusun menjelang Hari 2, setelah Lab 0
> selesai dan materi 4.1–4.2 (connection, channel, vhost, exchange, binding,
> queue, quorum vs classic) diajarkan.

## Tujuan

Peserta membuat sendiri, lewat Management UI (belum kode):

1. Satu **vhost** baru untuk latihan (mis. `/lab1`).
2. Satu **user** dengan permission terbatas ke vhost tersebut.
3. Empat **exchange**, satu per tipe: `direct`, `fanout`, `topic`, `headers`.
4. Beberapa **queue** dengan **binding** ke masing-masing exchange, memakai
   routing key bertema SIMPEL (mis. `pengajuan.siup.jakarta`).
5. Perbandingan **quorum queue vs classic queue** — buat satu dari masing-masing,
   bandingkan opsi yang tersedia saat pembuatan.

## Output yang dinilai (daftar tilik aktivitas MP-4)

Diagram komponen RabbitMQ hasil kerja peserta (exchange, binding, queue) —
lihat kerangka-materi.md §5.

## TODO sebelum Hari 2

- [ ] Tulis langkah per-langkah selengkap Lab 0 (target: peserta tidak
      bertanya "klik di mana" di setiap baris).
- [ ] Siapkan tabel routing key contoh yang konsisten dengan skenario SIMPEL
      (jenis dokumen × kantor pelayanan) — dipakai lagi di Lab 4 (MP-7).
- [ ] Tentukan apakah vhost per-peserta atau bersama (pertimbangkan beban
      broker cadangan kalau dipakai banyak peserta bersamaan).
