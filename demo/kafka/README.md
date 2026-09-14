# Demo Instruktur — Apache Kafka: Event Log Persisten & Replay Offset

**Sesi:** MP-04.4 · **Durasi:** 5 menit di kelas.

Demonstrasi ini dilakukan oleh instruktur di depan kelas untuk memperlihatkan kontras arsitektur antara model antrean RabbitMQ (*destructive consumer read*) versus model distributed commit log Apache Kafka (*offset-based replayable log*). 

Peserta cukup mengamati; tidak ada keharusan instalasi Kafka di laptop peserta.

Menggunakan image Apache Kafka **4.0.2** (mode KRaft tanpa ZooKeeper). Instance standalone ini dikonfigurasi khusus untuk kebutuhan demonstrasi instruksional.

---

## Cara Menjalankan

Jalankan dari root folder `simpel-lab/`. Seluruh perintah CLI dieksekusi di dalam container:

```bash
# 1. Nyalakan container demo Kafka
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo up -d

# 2. Tunggu sampai broker siap merespons daftar topic
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# 3. Jalankan script demonstrasi otomatis
bash demo/kafka/verify-demo.sh
```

Script akan membuat topic baru secara dinamis, mempublish 3 event sintetis, lalu membaca event tersebut sebanyak dua kali menggunakan **dua consumer group independen yang berbeda**. Nama topic dan consumer group digenerate unik pada setiap eksekusi agar pengujian berulang tidak saling tumpang tindih.

---

## Panduan Fasilitasi Demo Instruktur

1. **Prediksi (Menit ke-1):**
   *Tanyakan ke kelas:* "Begitu Consumer Group A selesai membaca 3 event di topic ini, apakah pesan di Kafka akan hilang seperti halnya di RabbitMQ queue?"
2. **Tunjukkan Konfigurasi (Menit ke-2):**
   Tunjukkan bahwa topic memiliki 1 partition dan replication factor 1. Tegaskan bahwa jaminan urutan pesan di Kafka berlaku strictly per-partition.
3. **Amati Output Replay (Menit ke-3 & 4):**
   Tunjukkan terminal: Consumer Group A membaca 3 event dari awal. Beberapa detik kemudian, Consumer Group B yang baru bergabung juga membaca 3 event yang sama persis dari awal (`--from-beginning`). Pesan TIDAK terhapus saat dibaca!
4. **Poin Kunci Pembelajaran (Menit ke-5):**
   - Di Kafka, pembacaan oleh consumer tidak menghapus data. Record dipertahankan berdasarkan kebijakan retensi (*time/size retention*).
   - Setiap consumer group mengelola cursor/posisinya sendiri via *committed offset*.
   - Catatan arsitektur: RabbitMQ Streams juga menyediakan kapabilitas append-only log dan offset replay serupa. Model perbandingan di lab utama kita adalah RabbitMQ AMQP Queue (Classic & Quorum) yang berbasis konsumsi destruktif dengan acknowledgement.

---

## Membersihkan Environment Demo

Setelah demonstrasi selesai, bersihkan container dan volume Kafka:

```bash
docker compose -f demo/kafka/docker-compose.yml -p simpel-kafka-demo down -v
```

> **Perhatian:** Flag `down -v` di atas hanya menghapus volume untuk project `simpel-kafka-demo`, dan aman dari compose stack utama SIMPEL.

Rujukan teknis: [Apache Kafka Quick Start Documentation](https://kafka.apache.org/40/getting-started/quickstart/).
