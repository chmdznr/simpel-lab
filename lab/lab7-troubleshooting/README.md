# Lab 7 — Empat kasus troubleshooting

MP-10: satu kelompok mengerjakan **satu kasus** dalam 45 menit, lalu berbagi hasil. Empat kasus dapat dikerjakan satu per satu setelah kelas. Semua vhost, payload, dan receipt bersifat sintetis.

## Persiapan

Jalankan dari root repo. Gunakan stack hari kelima:

```sh
npm run operasi -- up
```

Kasus memakai vhost `lab7-a` s.d. `lab7-d`, database `labops`, serta tabel `lab7_input`, `lab7_control`, dan `lab7_hasil`. Setiap prepare membuat lima input dengan ID tetap untuk pengujian tersebut. Prepare menolak kasus yang sudah ada agar bukti tidak ditimpa. Jika gagal di tengah, periksa catatan input dan queue sebelum mengambil tindakan.

| Huruf | Perintah awal | Titik pengamatan |
|---|---|---|
| A | Prepare saja; jangan mulai worker dahulu | Ready, consumers, input/receipt |
| B | Prepare lalu worker B | Binding dan unmatched queue |
| C | Prepare lalu worker C | Unacked dan log waiting |
| D | Prepare lalu worker D | Attempt, retry queue, terminal queue |

Contoh kasus C; ganti huruf sesuai penugasan:

```sh
npm run kasus -- prepare c
# Terminal kedua, biarkan berjalan:
npm run kasus -- worker c
# Terminal pertama:
npm run kasus -- inspect c
```

Buka Management http://127.0.0.1:15695 atau Grafana http://127.0.0.1:3005/d/simpel-ops, pilih vhost kelompok. Akun kelas `labops` / `labops-only`. Tunggu statistik diperbarui sebelum menyimpulkan keadaan.

## Investigasi 45 menit

1. **5 menit:** bagi peran operator, pencatat, penantang hipotesis.
2. **10 menit:** catat keadaan tanpa mengubah backlog.
3. **10 menit:** tulis dua hipotesis dan pemeriksaan yang membedakannya.
4. **10 menit:** terapkan koreksi dan verifikasi.
5. **10 menit:** bagikan bukti serta keterbatasan.

Untuk D, biarkan retry selesai sampai lima pesan berada di `case.dlq` agar exhaustion terlihat. Retry delay 2 detik dan maksimal tiga attempt adalah pengaturan demonstrasi. Republish aplikasi mempertahankan message ID; bukan selalu broker redelivery.

## Repair dan verifikasi

Tulis dugaan serta buktinya sebelum menjalankan helper repair. B, C, D:

```sh
npm run kasus -- repair c
npm run kasus -- inspect c
npm run kasus -- verify c
```

Untuk A, mulai `npm run kasus -- worker a` di terminal kedua. Perintah `repair a` hanya mengingatkan langkah itu.

`verify` lulus ketika lima ID input asli persis sama dengan set receipt. Constraint `(case_id,message_id)` mencegah receipt ganda. Setelah statistik stabil, periksa juga ready/unacked seluruh queue kasus dan binding jika relevan.

Repair B memperbaiki binding lalu memindahkan pesan dikenal dari unmatched queue melalui confirm-before-ack. Repair C memulihkan flag dependency agar worker yang sama melanjutkan. Repair D memulihkan fault dan melakukan replay terkontrol dari DLQ dengan ID sama. Pesan tidak dikenal dipertahankan dan menyebabkan error, bukan diam-diam direplay.

Jangan purge queue, mengganti ID pesan, atau menjalankan prepare ulang untuk membuat hasil tampak baik. Repair binding saja tidak memindahkan pesan yang sudah parkir. Restart worker saja tidak menjelaskan akar masalah dependency.

## Worksheet laporan

Salin bagian ini ke catatan kelompok:

- Kasus / operator / waktu:
- Hasil yang diharapkan dan lima ID input:
- Observasi: vhost, queue, ready, unacked, consumers, receipt, log relevan:
- Batas terakhir yang masih terbukti:
- Hipotesis 1 dan 2:
- Pemeriksaan pembeda dan hasil:
- Perbaikan dan alasan:
- Verifikasi input asli, receipt, sisa queue, konfigurasi:
- Keterbatasan atau dugaan yang belum terbukti:

## Batas simulasi dan shutdown

Kasus C mensimulasikan **langkah pemrosesan tertahan**; database tetap hidup untuk menyimpan flag kontrol. Kasus D mensimulasikan dependency gagal dan retry terbatas. Ini bukan uji outage PostgreSQL, HA broker, atau benchmark kapasitas.

Single-node queue TTL/dead-lettering adalah contoh ringkas; jaminan pemindahan saat kegagalan broker/target perlu ditinjau sesuai queue type dan konfigurasi produksi. Confirm-before-ack tetap mempunyai jendela duplikasi; receipt idempoten membatasi hasil ganda.

Stop seluruh worker dengan Ctrl+C, lalu `npm run operasi -- down`. Volume peserta tetap disimpan. Pengajar dapat menjalankan `npm run verify:day5` pada project QA terpisah setelah stack peserta berhenti.
