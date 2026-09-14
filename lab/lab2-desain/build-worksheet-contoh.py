"""Build the printable 2-page Lab 2 Example Reference Worksheet with ReportLab."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

output = Path(__file__).with_name('lembar-kerja-contoh.pdf')
c = canvas.Canvas(str(output), pagesize=A4)
c.setTitle('Lab 2 - Contoh Lembar Desain SIMPEL')
c.setAuthor('Achmad Zaenuri')

navy = HexColor('#192A56')
orange = HexColor('#B94D00')
gray = HexColor('#546377')
border_col = HexColor('#CBD3DD')
bg_header = HexColor('#EEF2F7')
bg_light = HexColor('#F8FAFC')

W, H = A4
margin = 36
usable_w = W - (2 * margin)

style_body = ParagraphStyle('body', fontName='Helvetica', fontSize=8.5, leading=11, textColor=navy)
style_bold = ParagraphStyle('bold', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=navy)
style_table = ParagraphStyle('table', fontName='Helvetica', fontSize=8, leading=10, textColor=navy)
style_table_h = ParagraphStyle('table_h', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=navy)
style_code = ParagraphStyle('code', fontName='Courier', fontSize=7.5, leading=9.5, textColor=navy)

def draw_header(title, subtitle, page_num):
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(margin, H - 42, title)
    c.setFont('Helvetica', 9)
    c.setFillColor(gray)
    c.drawString(margin, H - 56, subtitle)
    c.setFont('Helvetica-Bold', 8.5)
    c.setFillColor(orange)
    c.drawRightString(W - margin, H - 42, 'CONTOH ACUAN')
    c.setFont('Helvetica', 8)
    c.setFillColor(gray)
    c.drawRightString(W - margin, H - 56, f'Halaman {page_num} dari 2')
    c.setStrokeColor(border_col)
    c.setLineWidth(0.8)
    c.line(margin, H - 62, W - margin, H - 62)

def draw_footer(page_num):
    c.setStrokeColor(border_col)
    c.setLineWidth(0.5)
    c.line(margin, 40, W - margin, 40)
    c.setFont('Helvetica', 7.5)
    c.setFillColor(gray)
    c.drawString(margin, 28, 'PJJ Implementasi Messaging Queue TA 2026 · Selaras dengan kode simpel-lab (layanan/alur.js & messaging.js)')
    c.drawRightString(W - margin, 28, f'Lab 2 Desain · Hal {page_num}')

# ==========================================
# PAGE 1
# ==========================================
draw_header('LAB 2 | CONTOH LEMBAR DESAIN INTEGRASI SIMPEL',
            'MP-05 · Hari 2 · Model Jawaban Perancangan Arsitektur untuk Implementasi MP-06–MP-08', 1)

# Metadata Box
c.setFillColor(bg_light)
c.setStrokeColor(border_col)
c.setLineWidth(0.6)
c.rect(margin, H - 106, usable_w, 38, fill=1, stroke=1)
c.setFillColor(navy)
c.setFont('Helvetica-Bold', 8)
c.drawString(margin + 8, H - 80, 'Kelompok: Kelompok 1 (Arsitektur SIMPEL)')
c.drawString(margin + 200, H - 80, 'Anggota: Budi (Fasilitator), Siti (Pencatat), Ahmad (Penantang), Rian (Penyaji)')
c.drawString(margin + 8, H - 96, 'Tanggal: 15 September 2026')
c.drawString(margin + 200, H - 96, 'Status: Terverifikasi selaras dengan Lab 3 (MP-06), Lab 4 (MP-07), & Lab 5 (MP-08)')

# Section 1: Kebutuhan Bisnis & Janji Layanan
y1 = H - 122
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y1, '1. Kebutuhan Bisnis & Janji Layanan (Acceptance vs Completion)')

sec1_text = [
    [Paragraph('<b>Diterima (Accepted):</b> Request tervalidasi dasar, data tersimpan persisten di DB Gateway (tabel <i>pengajuan</i>, status <i>diterima</i>) dan event dicatat di Outbox dalam transaksi lokal atomik. Pemohon menerima respons <b>HTTP 202 Accepted</b> + <i>pengajuanId: "SIM-001"</i> + URL tracking <i>/pengajuan/SIM-001/status</i>.', style_body)],
    [Paragraph('<b>Selesai (Completed):</b> Service Billing berhasil menerbitkan kode pembayaran (<i>BIL-SIM-001</i>), tersimpan di DB billing, dan mem-publish event <i>billing.terbit</i>. Service Billing adalah pemilik status akhir penyelesaian transaksi tahap perizinan ini.', style_body)],
    [Paragraph('<b>Toleransi Keterlambatan & Persistensi:</b> Validasi berkas &le; 5 detik, penerbitan billing &le; 15 detik (saat lonjakan &le; 2 menit). Seluruh antrean dideklarasikan <i>durable: true</i> dan pesan dikirim dengan <i>persistent: true</i> (delivery mode 2) guna menjamin zero-loss saat broker restart.', style_body)]
]
t1 = Table(sec1_text, colWidths=[usable_w])
t1.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('BACKGROUND', (0, 0), (-1, -1), bg_light),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor('#E2E8F0')),
]))
w1, h1 = t1.wrap(usable_w, 200)
t1.drawOn(c, margin, y1 - 8 - h1)

# Section 2: Diagram Alur Data & State Ownership
y2 = y1 - 18 - h1
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y2, '2. Diagram Alur Data & Kepemilikan State (SIMPEL 5 Services)')

diagram_text = [
    [Paragraph('<b>Alur Urutan Layanan (Happy Path):</b><br/>'
               '&bull; <b>1. Penerimaan:</b> Pemohon &rarr; <b>Gateway</b> (simpan DB lokal + outbox) &rarr; HTTP 202 Accepted (<i>SIM-001</i>) &rarr; publish <i>pengajuan.diterima</i>.<br/>'
               '&bull; <b>2. Validasi:</b> <i>validasi.q</i> &rarr; <b>Validasi Service</b> (catat DB <i>alur_validasi</i> status <i>reserved</i>) &rarr; publish <i>validasi.selesai</i>.<br/>'
               '&bull; <b>3. Billing:</b> <i>billing.q</i> &rarr; <b>Billing Service</b> (catat DB <i>alur_billing</i> kode <i>BIL-SIM-001</i>) &rarr; publish <i>billing.terbit</i>.<br/>'
               '&bull; <b>4. Notifikasi:</b> <i>notifikasi.q</i> &rarr; <b>Notifikasi Service</b> (kirim email/SMS pemohon) &rarr; publish <i>notifikasi.terkirim</i>.<br/>'
               '&bull; <b>5. Audit Trail:</b> <b>Tracking Service</b> subscribe wildcard <i>#</i> pada <i>tracking.q</i> &rarr; rekam linimasa transaksi di <i>alur_tracking</i>.<br/>'
               '<b>Penanganan Kegagalan, DLQ, & Kompensasi Saga:</b><br/>'
               '&bull; <i>Cacat Skema:</i> Consumer me-reject pesan &rarr; otomatis masuk ke DLQ <i>pengajuan.invalid</i> via <i>simpel.invalid</i>.<br/>'
               '&bull; <i>Validasi Ditolak:</i> Publish <i>pengajuan.ditolak</i> &rarr; masuk ke <i>tracking.q</i> & <i>notifikasi.q</i> (tidak ke billing).<br/>'
               '&bull; <i>Kompensasi Saga:</i> Billing gagal &rarr; publish <i>billing.gagal</i> &rarr; <i>validasi.q</i> merollback status <i>reserved</i> menjadi <i>cancelled</i> &rarr; publish <i>pengajuan.dibatalkan</i>.', style_body)]
]
t2 = Table(diagram_text, colWidths=[usable_w])
t2.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F1F5F9')),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
w2, h2 = t2.wrap(usable_w, 200)
t2.drawOn(c, margin, y2 - 8 - h2)

# Section 3: Tabel Topologi Routing
y3 = y2 - 18 - h2
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y3, '3. Tabel Topologi Routing (Topic Exchange: simpel.events)')

routing_data = [
    [Paragraph('<b>Nama Event Bisnis</b>', style_table_h),
     Paragraph('<b>Exchange & Tipe</b>', style_table_h),
     Paragraph('<b>Routing / Binding Key</b>', style_table_h),
     Paragraph('<b>Queue Tujuan &rarr; Consumer</b>', style_table_h),
     Paragraph('<b>Peran Pemrosesan</b>', style_table_h)],
    [Paragraph('pengajuan.diterima', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('pengajuan.diterima', style_table), Paragraph('validasi.q &rarr; Validasi', style_table), Paragraph('Verifikasi berkas & persyaratan', style_table)],
    [Paragraph('validasi.selesai', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('validasi.selesai', style_table), Paragraph('billing.q &rarr; Billing', style_table), Paragraph('Penerbitan kode bayar billing', style_table)],
    [Paragraph('billing.terbit', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('billing.terbit', style_table), Paragraph('notifikasi.q &rarr; Notifikasi', style_table), Paragraph('Kirim email/SMS konfirmasi', style_table)],
    [Paragraph('pengajuan.#', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('pengajuan.#', style_table), Paragraph('tracking.q &rarr; Tracking', style_table), Paragraph('Audit trail lifecycle berkas', style_table)],
    [Paragraph('billing.#', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('billing.#', style_table), Paragraph('tracking.q &rarr; Tracking', style_table), Paragraph('Audit trail penerbitan billing', style_table)],
    [Paragraph('billing.gagal', style_table), Paragraph('simpel.events (topic)', style_table), Paragraph('billing.gagal', style_table), Paragraph('validasi.q &rarr; Validasi', style_table), Paragraph('Kompensasi Saga batalkan izin', style_table)],
    [Paragraph('* (invalid schema)', style_table), Paragraph('simpel.invalid (direct)', style_table), Paragraph('invalid', style_table), Paragraph('pengajuan.invalid (DLQ)', style_table), Paragraph('Karantina pesan cacat skema', style_table)]
]
t3 = Table(routing_data, colWidths=[usable_w * 0.22, usable_w * 0.20, usable_w * 0.20, usable_w * 0.20, usable_w * 0.18])
t3.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('BACKGROUND', (0, 0), (-1, 0), bg_header),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
]))
w3, h3 = t3.wrap(usable_w, 200)
t3.drawOn(c, margin, y3 - 8 - h3)

draw_footer(1)
c.showPage()

# ==========================================
# PAGE 2
# ==========================================
draw_header('LAB 2 | CONTOH LEMBAR DESAIN INTEGRASI SIMPEL',
            'MP-05 · Hari 2 · Kontrak Data, Mitigasi Gangguan, & Tinjauan Sejawat', 2)

# Section 4: Spesifikasi Kontrak Event Minimum (JSON Envelope)
y4 = H - 80
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y4, '4. Spesifikasi Kontrak Event Minimum (Envelope JSON - Messaging.js Standard)')

code_json = (
    '{\n'
    '  "event": "validasi.selesai",\n'
    '  "schemaVersion": 1,\n'
    '  "messageId": "evt-7f8a9b0c-1234-4567-89ab-cdef01234567",\n'
    '  "correlationId": "corr-SIM-001-20260915",\n'
    '  "occurredAt": "2026-09-15T08:30:00.000Z",\n'
    '  "data": {\n'
    '    "pengajuanId": "SIM-001", "pemohon": "PT Maju Bersama", "jenis": "SIUP",\n'
    '    "kantor": "KPP-Jakarta", "hasilValidasi": "lengkap", "petugas": "petugas-04"\n'
    '  }\n'
    '}'
)
desc_contract = (
    '<b>Aturan Kontrak & ID:</b><br/>'
    '&bull; <i>messageId</i> wajib unik untuk tiap pesan dan dipertahankan saat retry (kunci idempotensi consumer).<br/>'
    '&bull; <i>correlationId</i> mengikat pelacakan end-to-end, dipetakan ke AMQP property <i>correlation_id</i>.<br/>'
    '&bull; <i>occurredAt</i> wajib ISO-8601 UTC.<br/>'
    '&bull; <b>Kebijakan Skema Invalid:</b> Jika <i>schemaVersion</i> atau payload tidak valid, consumer memanggil '
    '<i>channel.reject(msg, false)</i>. Pesan otomatis diarahkan ke dead-letter exchange <i>simpel.invalid</i> '
    'dan mengantre di <i>pengajuan.invalid</i> untuk investigasi tanpa memacetkan worker.'
)

contract_table = [
    [Paragraph(f'<pre>{code_json}</pre>', style_code), Paragraph(desc_contract, style_body)]
]
t4 = Table(contract_table, colWidths=[usable_w * 0.48, usable_w * 0.52])
t4.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('GRID', (0, 0), (-1, -1), 0.5, border_col),
    ('BACKGROUND', (0, 0), (0, 0), HexColor('#F8FAFC')),
    ('BACKGROUND', (1, 0), (1, 0), HexColor('#FFFFFF')),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
w4, h4 = t4.wrap(usable_w, 200)
t4.drawOn(c, margin, y4 - 8 - h4)

# Section 5: Pengujian 3 Kartu Gangguan (Break Testing)
y5 = y4 - 18 - h4
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y5, '5. Pengujian Skenario Gangguan (Break Testing - 3 Kartu Insiden)')

fault_data = [
    [Paragraph('<b>Skenario Gangguan</b>', style_table_h),
     Paragraph('<b>Dampak & Tindakan Penanganan Teknis</b>', style_table_h),
     Paragraph('<b>Status Pengguna & Pemulihan</b>', style_table_h)],
    [Paragraph('<b>1. Billing Down 10 Menit</b><br/>(Layanan perbankan mati sementara)', style_table),
     Paragraph('Pesan tertahan aman di antrean durable <i>billing.q</i> (tidak drop). Saat worker hidup kembali, pesan diproses bertahap sesuai <i>prefetch</i>.', style_table),
     Paragraph('Pemohon melihat status: <i>"Menunggu Kode Bayar"</i> (HTTP 202). Tidak terjadi timeout.<br/><b>Pemilik:</b> Admin Billing & SRE.<br/><b>Bukti:</b> Grafik queue naik 10m lalu surut normal.', style_table)],
    [Paragraph('<b>2. Notifikasi Lambat 3s</b><br/>(Latensi vendor SMS/Email tinggi)', style_table),
     Paragraph('<i>notifikasi.q</i> terisolasi secara asinkron. Antrean notifikasi yang menumpuk tidak memblokir laju pemrosesan validasi ataupun billing.', style_table),
     Paragraph('Status izin & billing pemohon sudah terbit sah. Email konfirmasi tiba beberapa saat kemudian (<i>eventual consistency</i>).<br/><b>Bukti:</b> Billing tetap &le; 1 detik.', style_table)],
    [Paragraph('<b>3. Duplikat Redelivery</b><br/>(Worker crash sesaat sebelum kirim ack)', style_table),
     Paragraph('Broker me-redeliver pesan. Worker memeriksa tabel <i>alur_inbox (owner, message_id)</i> dan unique constraint DB <i>pengajuan_id</i>. Jika terdaftar, transaksi di-skip dan langsung dikirim <i>channel.ack()</i>.', style_table),
     Paragraph('Pemohon tetap menerima tepat 1 kode billing (bebas penagihan ganda).<br/><b>Pemilik:</b> Worker Consumer.<br/><b>Bukti:</b> Log terminal mencatat <i>{"duplicate":"evt-..."}</i>, baris DB tetap 1.', style_table)]
]
t5 = Table(fault_data, colWidths=[usable_w * 0.26, usable_w * 0.40, usable_w * 0.34])
t5.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('BACKGROUND', (0, 0), (-1, 0), bg_header),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
]))
w5, h5 = t5.wrap(usable_w, 200)
t5.drawOn(c, margin, y5 - 8 - h5)

# Section 6: Keputusan Arsitektur & Tinjauan Sejawat
y6 = y5 - 18 - h5
c.setFont('Helvetica-Bold', 10)
c.setFillColor(navy)
c.drawString(margin, y6, '6. Keputusan Arsitektur & Tinjauan Sejawat (Peer Review)')

sec6_text = [
    [Paragraph('<b>Pola Terpilih & Alasan:</b> Choreography Event-Driven + Transactional Outbox/Inbox pada Topic Exchange <i>simpel.events</i>. Memberikan isolasi kegagalan penuh antar-service dan menjamin nol kehilangan pesan saat aplikasi crash sebelum komit broker.', style_body)],
    [Paragraph('<b>Celah Hasil Peer Review & Revisi:</b> Semula pesan penolakan (<i>pengajuan.ditolak</i>) hanya masuk ke tracking. Direvisi: routing key <i>pengajuan.ditolak</i> juga dibinding ke <i>notifikasi.q</i> agar pemohon segera memperoleh email pemberitahuan penolakan beserta alasan revisi berkas.', style_body)],
    [Paragraph('<b>Risiko Terbuka (Open Risk) & Mitigasi:</b> Antrean <i>tracking.q</i> menerima seluruh event (<i>#</i>). Saat lonjakan trafik masif, queue tracking berpotensi lag. Rencana mitigasi di Lab 3/4: konfigurasi prefetch 50 dan scaling worker tracking horizontal.', style_body)]
]
t6 = Table(sec6_text, colWidths=[usable_w])
t6.setStyle(TableStyle([
    ('BOX', (0, 0), (-1, -1), 0.5, border_col),
    ('BACKGROUND', (0, 0), (-1, -1), bg_light),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor('#E2E8F0')),
]))
w6, h6 = t6.wrap(usable_w, 200)
t6.drawOn(c, margin, y6 - 8 - h6)

draw_footer(2)
c.save()
print(output)
