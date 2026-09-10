// SIMPEL - versi BERBROKER - billing
//
// KERANGKA SAJA. Dibangun di Lab 4 (MP-7, routing) dan Lab 5 (MP-8,
// end-to-end + saga choreography saat billing gagal permanen).
// Pola: consumer dari queue hasil binding (fanout/topic ke "pengajuan.diterima"),
// menerbitkan event "billing.terbit" setelah sukses -- lihat layanan/validasi
// untuk pola koneksi + ack yang sama.

// TODO(Lab 4/5): salin pola koneksi dari layanan/validasi/index.js, ganti
// nama queue sesuai desain routing yang dibuat di Lab 2 (MP-5).
