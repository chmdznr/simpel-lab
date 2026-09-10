"""Build the printable, one-page Lab 2 worksheet with installed ReportLab."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle

output = Path(__file__).with_name('lembar-kerja.pdf')
c = canvas.Canvas(str(output), pagesize=A4)
c.setTitle('Lab 2 - Lembar Desain SIMPEL')
c.setAuthor('Achmad Zaenuri')
navy, gray = HexColor('#192A56'), HexColor('#546377')
W = A4[0] - 72
style = ParagraphStyle('body', fontName='Helvetica', fontSize=9.5, leading=12, textColor=navy)

def line(text, y, size=10, bold=False):
    c.setFillColor(navy)
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    c.drawString(36, y, text)

def box(y, h):
    c.setStrokeColor(HexColor('#CBD3DD'))
    c.setLineWidth(.6)
    c.rect(36, y, W, h)

def table(rows, ytop, widths, heights):
    cells = [[Paragraph(x, style) for x in row] for row in rows]
    t = Table(cells, colWidths=widths, rowHeights=heights)
    t.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), .5, HexColor('#CBD3DD')),
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#EEF2F7')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    _, h = t.wrap(W, 800)
    t.drawOn(c, 36, ytop-h)

line('LAB 2  |  LEMBAR DESAIN SIMPEL', 805, 17, True)
line('MP-05 - Hari 2 - 45 menit - Skenario fiktif', 786, 10)
line('Kelompok: __________________  Anggota: __________________  Tanggal: __________', 766, 9.5)
line('1. Kebutuhan: kapan diterima, kapan selesai, dan batas keterlambatan?', 742, 10.5, True)
box(690, 43)
line('2. Diagram: layanan, exchange/type, queue, consumer, status, dan pemilik data', 674, 10, True)
box(571, 94)
line('3. Routing: satu baris per subscription; beberapa binding boleh berbagi queue', 555, 10, True)
table([['Event / binding key', 'Exchange / type', 'Queue -> consumer']] + [['', '', ''] for _ in range(5)], 543, [W*.36, W*.28, W*.36], [20]+[14]*5)
line('4. Satu kontrak event + pemilik ID + aturan retry', 438, 10.5, True)
line('event, schemaVersion, messageId, correlationId, occurredAt (UTC), data.pengajuanId', 423, 9)
box(349, 65)
line('5. Gangguan: tindakan, status pengguna, pemilik pemulihan, dan bukti hasil', 332, 10, True)
table([['Gangguan', 'Penanganan / hasil yang diharapkan'],
       ['Billing mati 10 menit', ''], ['Notifikasi 3 detik/pesan', ''],
       ['Duplikat setelah commit,<br/>sebelum ack', '']], 320, [W*.33, W*.67], [20,24,24,30])
line('Retry maksimum/jeda: __________________  DLQ/pemilik/redrive: __________________', 207, 9)
line('6. Keputusan dan tinjauan sejawat', 185, 10.5, True)
line('Broker/pola + alasan: _________________________________________________________', 168, 9.5)
line('Uji sukses + hasil: ____________________________________________________________', 148, 9.5)
line('Celah / perbaikan: ____________________________________________________________', 128, 9.5)
line('Risiko tersisa: _______________________________________________________________', 108, 9.5)
line('Cek: kebutuhan/status | topologi | kontrak | kegagalan | pembuktian', 82, 9.5, True)
line('Simpan untuk MP-06-08 dan capstone. Panduan lengkap: lab/lab2-desain/README.md', 64, 8.5)
c.save()
print(output)
