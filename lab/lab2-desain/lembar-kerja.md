# Lab 2 — Lembar desain SIMPEL

Kelompok: __________  Anggota: __________  Tanggal: __________

**1. Kebutuhan dan batas:** Apa yang harus dijawab segera? Kapan pekerjaan
diterima/selesai? Batas keterlambatan dan kehilangan yang disepakati: __________

**2. Diagram:** Gambar gateway → exchange → queue → consumer, jalur event
berikutnya, serta status yang dibaca pengguna. Tandai pemilik data: __________

**3. Routing:** Isi satu baris per subscription (event yang sama boleh berulang).

| Event | Exchange / type | Key | Queue → consumer |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |

**4. Satu kontrak:** tulis JSON dengan `event`, `schemaVersion`, `messageId`,
`correlationId`, `occurredAt`, `data.pengajuanId`. Pemilik ID dan aturan retry: __________

**5. Gangguan:** tulis tindakan, status pengguna, dan pemilik pemulihan.

| Gangguan | Penanganan / bukti hasil |
|---|---|
| Billing mati 10 menit | |
| Notifikasi lambat 3 detik | |
| Duplikat setelah commit sebelum ack | |

Retry maksimum/jeda: __________  DLQ/pemilik/redrive: __________

**6. Keputusan dan tinjauan:** Broker/pola dipilih karena __________.
Uji sukses dan hasilnya: __________. Celah dari kelompok peninjau: __________.
Perbaikan: __________. Risiko yang masih terbuka: __________.

Daftar tilik: [ ] kebutuhan/status [ ] topologi [ ] kontrak [ ] kegagalan [ ] pembuktian
