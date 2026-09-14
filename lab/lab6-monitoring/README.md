# Lab 6 — Monitoring Metrik, Alerting, dan Kontrol Akses Publisher

**Modul MP-09 · Hari 5 (Jumat, 18 September 2026) · Praktik 2 JP (90 Menit).**

Lab ini berfokus pada aspek operasional production-readiness: **monitoring metrik performa antrean via Prometheus & Grafana** (45 menit) serta **penegakan hak akses minimum (*least-privilege permissions*) pada user publisher** (45 menit).

Seluruh latihan dijalankan dari root direktori `simpel-lab/` menggunakan stack terisolasi `simpel-ops`.

---

## 1. Menjalankan Stack Monitoring

Sesi hari kelima menggunakan stack Docker Compose mandiri bernama `simpel-ops` dengan volume dan port terisolasi, sehingga tidak mengganggu data lab hari-hari sebelumnya:

```bash
npm run operasi -- up
npm run operasi -- setup
npm run operasi -- snapshot
```

### Daftar Endpoint dan Akses Layanan

| Komponen Sistem | Alamat Akses Lokal | Kredensial Latihan | Fungsi Utama |
|---|---|---|---|
| **RabbitMQ Management** | `http://127.0.0.1:15695` | `labops` / `labops-only` | Dashboard manajemen broker |
| **Grafana Dashboard** | `http://127.0.0.1:3005/d/simpel-ops` | `labops` / `labops-only` | Visualisasi grafik metrik per antrean |
| **Prometheus** | `http://127.0.0.1:9095` | *(tanpa login)* | Engine penarik metrik (*scraper*) & rules |
| **AMQP Port** | `127.0.0.1:5775` | `labops` / `labops-only` | Port koneksi broker (vhost `lab6`) |
| **PostgreSQL** | `127.0.0.1:5475` | `labops` / `labops-only` | Database operasional `labops` |

---

## 2. Mensimulasikan Backlog dan Mengamati Alerting

Pastikan consumer worker belum dijalankan. Kirim 100 pesan untuk membuat tumpukan antrean:

```bash
npm run operasi -- publish 100
npm run operasi -- snapshot
```

1. **Amati di Grafana:** Buka `http://127.0.0.1:3005/d/simpel-ops`, pilih variable **Vhost: lab6**, atur rentang waktu ke *Last 15 minutes*. Amati 6 panel visualisasi: lonjakan pesan Ready pada `lab6.q`, antrean Unacked, serta ketiadaan consumer.
2. **Amati di Prometheus:** Buka `http://127.0.0.1:9095/alerts`. Cari alert rule bernama `SimpelQueueWithoutConsumer`.
   - *Kondisi Rule:* `rabbitmq_queue_messages_ready > 0` dan `rabbitmq_queue_consumers == 0` selama minimal 15 detik.
   - Amati status alert bertransisi dari `Pending` menjadi `Firing` (karena ada pesan menumpuk tanpa ada satu pun worker yang melayani).
3. **Nyalakan Consumer:**
   Di terminal kedua, jalankan consumer worker:
   ```bash
   npm run operasi -- consumer
   ```
   Consumer ini membaca pesan dengan manual ack, prefetch 2, dan delay artifisial 200 ms per pesan.
4. **Amati Pemulihan (*Recovery*):**
   - Di Grafana, amati kurva Ready menurun stabil, angka delivery/ack rate meningkat.
   - Di Prometheus Alerts, amati status alert `SimpelQueueWithoutConsumer` otomatis beralih menjadi resolved/mati begitu antrean terkuras habis.

---

## 3. Memahami Query PromQL Metrik RabbitMQ

RabbitMQ mengekspor metrik standar Prometheus melalui plugin `rabbitmq_prometheus`:
- `/metrics/per-object`: Menyediakan gauge per antrean (misalnya jumlah pesan ready dan unacked).
- `/metrics/detailed`: Menyediakan counter throughput (misalnya total pesan yang di-ack).

Query PromQL penting yang digunakan:

```promql
# 1. Jumlah pesan yang siap diambil per antrean:
rabbitmq_queue_messages_ready{vhost="lab6"}

# 2. Laju pesan yang berhasil di-ack per detik (throughput):
rate(rabbitmq_detailed_queue_messages_acked_total{vhost="lab6"}[1m])

# 3. Status kesehatan proses broker (1 = hidup/scrape sukses):
up{job="rabbitmq"}
```

---

## 4. Pembuktian Hak Akses Minimum (*Least Privilege*)

Di production, service Publisher (misalnya Gateway) **tidak boleh memiliki hak penuh sebagai admin**. Publisher hanya boleh mempublish ke exchange yang ditugaskan kepadanya, dan dilarang keras mendeklarasikan antrean sembarangan atau membaca pesan milik service lain.

Jalankan audit konfigurasi permission dan uji probe keamanan:

```bash
npm run operasi -- permissions
npm run operasi -- probe
```

User `lab6-publisher` dikonfigurasi dengan aturan regex ketat pada vhost `lab6`:
- **Configure regex:** `^$` *(dilarang membuat atau menghapus resource apa pun)*
- **Write regex:** `^lab6\.events$` *(hanya boleh mempublish ke exchange `lab6.events`)*
- **Read regex:** `^$` *(dilarang membaca queue atau binding mana pun)*

### Hasil Verifikasi Probe Keamanan

| Operasi yang Diuji | Ekspektasi Perilaku | Hasil Pengujian Aktual |
|---|---|---|
| **Publish ke `lab6.events`** | Berhasil dan mendapat publisher confirm | `Allowed & Confirmed` |
| **Publish ke exchange lain** | Ditolak oleh broker dengan error 403 | `ACCESS_REFUSED (Ditolak)` |
| **Mendeklarasikan queue baru** | Ditolak oleh broker dengan error 403 | `ACCESS_REFUSED (Ditolak)` |
| **Membaca pesan dari `lab6.q`** | Ditolak oleh broker dengan error 403 | `ACCESS_REFUSED (Ditolak)` |

Setiap penolakan hak akses menghasilkan kode error AMQP `403/ACCESS_REFUSED` dan koneksi channel langsung ditutup oleh broker untuk mencegah eskalasi celah keamanan.

---

## 5. Checklist Verifikasi Mandiri

- [ ] Stack monitoring `simpel-ops` berhasil menyala dan metrik tampil di Grafana.
- [ ] Alert `SimpelQueueWithoutConsumer` berhasil memicu status *Firing* saat antrean menumpuk, dan otomatis pulih (*Resolved*) saat worker dinyalakan.
- [ ] Berhasil membaca dan memahami arti query PromQL `rabbitmq_queue_messages_ready` dan ack rate.
- [ ] Seluruh 4 skenario security probe membuktikan penegakan prinsip least privilege pada user publisher.

---

## Menghentikan Stack

Hentikan worker consumer dengan menekan `Ctrl+C`. Jika langsung melanjutkan ke Lab 7, stack `simpel-ops` dapat dibiarkan menyala. Jika ingin menghentikan stack:

```bash
npm run operasi -- down
```

> Skrip `down` mempertahankan data volume lokal.

Rujukan teknis: [RabbitMQ Monitoring with Prometheus & Grafana](https://www.rabbitmq.com/docs/prometheus) dan [RabbitMQ Access Control](https://www.rabbitmq.com/docs/access-control).
