// SIMPEL - versi BERBROKER - tracking
//
// KERANGKA SAJA. Konsumen KEDUA atas event "pengajuan.diterima" yang sama --
// contoh pub-sub (fanout exchange), dibangun di Lab 4 (MP-7 7.2a). Tugasnya
// cuma mencatat status, tidak memblokir alur utama gateway->validasi->billing.

// TODO(Lab 4): buat fanout exchange "pengajuan.event", bind queue tracking
// ke situ bersama queue validasi, konsumsi dengan pola yang sama seperti
// layanan/validasi/index.js.
