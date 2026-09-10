# Proyek Action Learning — [judul kasus]

Panduan pengerjaan minggu kedua, 21–25 September 2026. Satu studi kasus dengan enam indikator; 7 JP mandiri + 3 JP sinkron. Pengarahan 45 menit pada 18 September terpisah dari alokasi ini.

## 1. Masalah, ruang lingkup, dan kriteria keberhasilan

Jelaskan pengguna, hasil yang diharapkan, kesulitan integrasi, serta batas prototipe. Gunakan data sintetis. Tuliskan kriteria yang dapat diuji, misalnya sepuluh input menghasilkan sepuluh receipt berbeda setelah worker pulih.

## 2. Arsitektur dan kontrak event

Sertakan diagram producer, exchange/topic, queue, consumer, penyimpanan, serta jalur retry jika ada. Jelaskan pilihan work queue/pub-sub, routing, identitas event, acceptance versus completion, acknowledgement, dan duplicate handling.

## 3. Menjalankan dan menghentikan

Tuliskan versi lingkungan, prasyarat, command setup/start/test/stop, port lokal, dan apakah shutdown mempertahankan volume. Jangan menyertakan secret. Reviewer harus dapat mengikuti petunjuk tanpa bantuan lisan.

## 4. Konfigurasi routing dan akses

Sertakan deklarasi/provisioning, binding/routing key, identitas bootstrap/runtime, dan uji allowed serta rejected/unmatched yang sesuai kasus.

## 5. Bukti pengujian

| ID uji | Input/ID asli | Harapan | Hasil aktual | Lokasi bukti | Status |
|---|---|---|---|---|---|
| Normal | | | | | |
| Fault | | | | | |
| Recovery | | | | | |

Tetapkan input sebelum eksekusi. Cocokkan set ID dengan hasil yang dimaksud; queue kosong dan HTTP response saja tidak cukup. Untuk angka latency, pisahkan latency respons dari completion serta catat model beban.

## 6. Laporan troubleshooting

Catat waktu/gejala, observasi, dua hipotesis, pemeriksaan pembeda, tindakan, serta verifikasi ID input asli. Simpan bukti sebelum perbaikan. Nyatakan bila tindakan baru merupakan mitigasi.

## 7. Hasil, batas, dan langkah berikutnya

Nyatakan apa yang sudah terbukti serta belum diuji. Contoh batas: single-node, plain-text lokal, kapasitas tertentu belum diukur. Jangan mengklaim dampak produksi dari demo lokal.

## 8. Kontribusi dan sumber

Sebutkan komponen SIMPEL/referensi yang digunakan ulang dan bagian kontribusi sendiri. Pastikan diagram, code, konfigurasi, dan hasil menjelaskan sistem yang sama.

## Checkpoint dan presentasi

| Tanggal | Alokasi | Hasil kerja |
|---|---|---|
| 21 Sep | 2 JP mandiri | Masalah, diagram, kontrak |
| 22 Sep | 2 JP mandiri | Producer/consumer berjalan |
| 23 Sep | 2 JP mandiri | Routing dan bukti |
| 24 Sep | 1 JP mandiri | Uji recovery dan laporan |
| 25 Sep | 3 JP sinkron | Presentasi dan feedback, 135 menit bersama |

Kanal pengumpulan, tenggat rinci, dan giliran presentasi mengikuti panitia. Siapkan alur presentasi: masalah → desain → eksperimen → hasil → batas. Rekaman cadangan harus diberi tanggal dan tidak disebut sebagai demo langsung.

Ketentuan KAP: program nonkelulusan, 40% aktivitas + 60% presentasi studi kasus. Rubrik umpan balik rinci pada materi pengajar adalah usulan, bukan perubahan bobot/ambang resmi.
