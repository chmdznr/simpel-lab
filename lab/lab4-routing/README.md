# Lab 4A — Fanout dan subscription yang independen
**MP-07 Bagian 1, hari ketiga, Rabu 16 September 2026. Praktik 45 menit.**

MP-07 total 4 JP dibagi dua hari. Hari ketiga berisi teori routing 45 menit dan
Lab 4A 45 menit; hari keempat berisi Lab 4B 90 menit untuk routing lanjutan,
retry tertunda, dan penanganan DLQ. Folder ini menyajikan **Lab 4A yang siap dijalankan**.

## Target dan batas
Satu event pengajuan diterima harus menghasilkan catatan validasi dan catatan tracking
yang independen. Menjalankan dua consumer pada satu queue membagi pekerjaan;
dua subscription memerlukan dua queue. Event `pengajuan.diterima` pada tracking
hanya menunjukkan penerimaan event, bukan bahwa validasi/billing sudah selesai.

Mode fanout merupakan percobaan eksplisit. Rancangan event topic pada Lab 2 tetap
menjadi rujukan integrasi akhir; kita tidak mengganti seluruh desain dengan fanout.
Lab ini menggunakan `simpel.fanout`, `validasi.fanout.q`, dan `tracking.q`.
Queue `validasi.q` Lab 3 tetap terpisah. Queue dan binding dibuat sebelum publish.

## Langkah 45 menit
1. **0–5 menit — prediksi.** Gambar satu fanout exchange dengan dua queue.
   Tulis penerima event F1. Prediksi apa yang berubah ketika tracking berhenti.
2. **5–10 — pindah mode.** Selesaikan backlog Lab 3. Hentikan gateway dan semua
   worker Lab 3 dengan Ctrl-C. Pastikan port gateway bebas. Jalankan
   `npm run db:siapkan` untuk menambahkan tabel tracking pada volume lama.
3. **10–15 — jalankan.** Gunakan tiga terminal dari akar repo:
   ```bash
   SIMPEL_MODE=fanout npm run broker:gateway
   SIMPEL_MODE=fanout WORKER_ID=vfan npm run broker:validasi
   SIMPEL_MODE=fanout WORKER_ID=track npm run broker:tracking
   ```
   Setiap baris berada pada terminal berbeda. Periksa log ready dan nama queue.
4. **15–20 — satu event, dua subscription.**
   `npm run kirim -- --count=10 --run=fan01`, lalu
   `npm run hasil -- fan01`. Setelah drain, validationRows=10 dan trackingRows=10.
   Cocokkan business ID; kedua consumer menerima message ID yang sama.
   Ini 10 event yang disalin ke dua queue, bukan 20 pengajuan baru.
5. **20–25 — tracking berhenti.** Hentikan hanya terminal tracking. Kirim
   `npm run kirim -- --count=5 --run=trackoff`. Validasi tetap memproses.
   Management menunjukkan Ready bertambah 5 pada tracking.q. Hasil untuk run
   ini: validationRows=5, trackingRows=0 selama tracking belum berjalan.
6. **25–30 — pemulihan.** Jalankan tracking dengan mode fanout lagi.
   TrackingRows menjadi 5. Diskusikan mengapa publish sebelum queue/binding
   tracking dibuat tidak akan direplay secara otomatis.
7. **30–35 — baca topologi dan matriks routing.** Buka `layanan/messaging.js`.
   Fanout mengabaikan routing key. Ingat eksperimen topic Lab 1: binding
   `pengajuan.*.jakarta` dan `pengajuan.siup.#` memberikan hasil berbeda.
   Prediksi tiga key: pengajuan.siup.jakarta, pengajuan.nib.jakarta,
   pengajuan.siup.jakarta.revisi. Jawaban: keduanya; Jakarta; SIUP.
   Kunci ini latihan routing bertingkat, bukan pengganti event `pengajuan.diterima`.
8. **35–40 — failure table.** Lengkapi tabel di bawah. Bandingkan no route,
   consumer mati, kontrak invalid, dan dependency failure. Jangan memberi
   semua kegagalan jawaban `nack(requeue=true)`.
9. **40–45 — presentasi singkat.** Tunjukkan bukti dua hasil, backlog tracking,
   dan recovery. Sebutkan apa yang masih menjadi pekerjaan Lab 4B.

| Kondisi | Bukti yang harus dicari | Tindakan |
|---|---|---|
| Consumer tracking mati | tracking.q Ready naik, validasi tetap selesai | pulihkan worker |
| Tidak ada binding cocok | mandatory return pada publisher | perbaiki rute, rekonsiliasi |
| Kontrak tidak valid | pengajuan.invalid bertambah | inspeksi/perbaiki kontrak |
| DB gagal | worker berhenti, delivery kembali | pulihkan DB, restart terarah |
| Dependency gagal berulang | perlu attempt count dan jeda | desain Lab 4B, bukan loop cepat |

## Berkas yang dikumpulkan
Gambar topologi, receipts fan01 dan trackoff, hasil jumlah/ID untuk kedua tabel,
serta tiga kalimat: mengapa dua queue diperlukan; mengapa tracking dapat tertinggal;
mengapa fanout bukan riwayat event yang bisa direplay setelah subscription dibuat.

**Rubrik (10):** dua queue dan binding benar (3); bukti kedua subscription (3);
kemandirian dan recovery tracking (2); diagnosis failure dan batas replay (2).
Lab 4A selesai jika peserta dapat menjelaskan hasil, bukan sekadar melihat queue kosong.

## Jembatan ke hari keempat
Pelajari perbedaan alternate exchange dan DLX: alternate exchange menangani pesan
yang tidak terute dari sebuah exchange; DLX menerima dead-letter dari queue pada
kondisi tertentu. TTL mengatur kedaluwarsa, bukan jadwal tepat. Rancangan retry
memerlukan jeda, batas percobaan, tujuan terminal, dan replay setelah perbaikan.
Lab 4A belum mengimplementasikan retry tertunda atau DLQ operasional lengkap.

Rujukan: [Exchanges](https://www.rabbitmq.com/docs/exchanges),
[DLX](https://www.rabbitmq.com/docs/dlx), [TTL](https://www.rabbitmq.com/docs/ttl).
