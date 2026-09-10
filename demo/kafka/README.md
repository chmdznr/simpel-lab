# Demo instruktur — Kafka: pesan tetap, posisi baca berbeda

**MP-04.4 · 5 menit di kelas.** Persiapkan image dan broker sebelum kelas.
Peserta cukup mengamati; tidak ada instalasi Kafka atau kode aplikasi peserta.
Image dipatok pada Apache Kafka **4.0.2**, lini 4.0 dengan mode KRaft.
Satu broker/controller ini hanya demonstrasi, bukan konfigurasi HA.

Jalankan dari root `simpel-lab`. Semua CLI berjalan di container yang sama;
tidak ada port Kafka yang dibuka ke host.

```bash
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo up -d
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Tunggu sampai perintah kedua berhasil. Lalu jalankan pemeriksaan demo:

```bash
bash demo/kafka/verify-demo.sh
```

Script membuat topic baru, menerbitkan tiga event sintetis, lalu menampilkan
ketiganya dua kali melalui **dua consumer group baru**. Nama topic dan group
unik per eksekusi sehingga pengulangan demo tidak tercampur percobaan lama.

## Alur bicara pengajar

1. **Prediksi (1 menit):** “Setelah konsumen pertama membaca, apakah event habis?”
2. **Tunjukkan perintah (1 menit):** topic satu partition, replication factor satu;
   urutan di contoh ini hanya dalam partition tersebut.
3. **Amati output (2 menit):** group A dan group B masing-masing membaca tiga event.
   `--from-beginning` dipakai dengan group baru. Pada group lama dengan committed
   offset, flag itu bukan perintah universal untuk mereset posisi baca.
4. **Tarik keputusan (1 menit):** konsumsi tidak menghapus record Kafka.
   Retention/compaction menentukan data yang masih tersedia; offset menentukan
   posisi konsumen. RabbitMQ Streams juga mendukung replay. Pembanding lab kita
   adalah classic/quorum queue dengan acknowledgment, bukan semua fitur RabbitMQ.

Demo ini tidak mengukur throughput, failover, atau jaminan exactly-once.
Jika Docker gagal sebelum kelas, gunakan tiga baris event di script untuk
walkthrough dan sebutkan bahwa demo tidak dijalankan; jangan mengklaim hasil live.

## Bersihkan demo sendiri

```bash
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo down -v
```

Perintah tersebut hanya untuk project demo Kafka ini. Jangan menjalankan
`down -v` pada compose utama ketika masih memerlukan data lab.

Sumber: [Apache Kafka Quick Start](https://kafka.apache.org/40/getting-started/quickstart/).
