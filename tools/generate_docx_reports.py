#!/usr/bin/env python3
"""Generate polished Microsoft Word (.docx) report templates for Labs 3, 4, and 5
from their corresponding lembar-laporan.md files.
"""
import os
import re
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

ROOT = Path(__file__).resolve().parent.parent

COLOR_PRIMARY = RGBColor(26, 54, 93)     # #1A365D - Deep Navy
COLOR_SECONDARY = RGBColor(43, 108, 176) # #2B6CB0 - Slate Blue
COLOR_TEXT = RGBColor(30, 41, 59)        # #1E293B - Slate 800
COLOR_MUTED = RGBColor(100, 116, 139)    # #64748B - Slate 500
COLOR_CODE = RGBColor(15, 23, 42)        # #0F172A - Slate 900

HEX_PRIMARY = "1A365D"
HEX_SECONDARY = "2B6CB0"
HEX_BG_CODE = "F8FAFC"
HEX_BORDER = "CBD5E1"
HEX_ZEBRA = "F1F5F9"


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin_name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin_name}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_shading(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_table_borders(table, border_color=HEX_BORDER):
    tblPr = table._element.xpath('w:tblPr')
    if tblPr:
        borders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="{border_color}"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>
                <w:insideV w:val="none"/>
                <w:left w:val="none"/>
                <w:right w:val="none"/>
            </w:tblBorders>
        ''')
        tblPr[0].append(borders)


def format_run_tokens(paragraph, text, default_font="Calibri", default_size=Pt(10.5), default_color=COLOR_TEXT):
    """Parse basic inline markdown: **bold**, *italic*, `code`."""
    pattern = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)')
    parts = pattern.split(text)
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = default_font
            run.font.size = default_size
            run.font.color.rgb = default_color
        elif part.startswith('*') and part.endswith('*'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.name = default_font
            run.font.size = default_size
            run.font.color.rgb = default_color
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(194, 24, 91) # subtle berry accent for inline code
            run.bold = True
        else:
            run = paragraph.add_run(part)
            run.font.name = default_font
            run.font.size = default_size
            run.font.color.rgb = default_color


def add_code_block(doc, code_text):
    """Add a shaded box table for code / JSON."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_shading(cell, HEX_BG_CODE)
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)

    tcPr = cell._element.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>
            <w:left w:val="single" w:sz="18" w:space="0" w:color="{HEX_SECONDARY}"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05

    lines = code_text.strip('\n').split('\n')
    for i, line in enumerate(lines):
        if i > 0:
            p = cell.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
        run = p.add_run(line if line else ' ')
        run.font.name = 'Consolas'
        run.font.size = Pt(9.0)
        run.font.color.rgb = COLOR_CODE

    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(4)


def convert_markdown_to_docx(md_path, docx_path):
    doc = docx.Document()

    # Set 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    lines = md_path.read_text(encoding='utf-8').split('\n')
    i = 0
    in_code = False
    code_buffer = []

    while i < len(lines):
        line = lines[i]

        # Handle Code blocks
        if line.strip().startswith('```'):
            if in_code:
                in_code = False
                add_code_block(doc, '\n'.join(code_buffer))
                code_buffer = []
            else:
                in_code = True
                code_buffer = []
            i += 1
            continue

        if in_code:
            code_buffer.append(line)
            i += 1
            continue

        stripped = line.strip()

        # Handle empty lines
        if not stripped:
            i += 1
            continue

        # Handle horizontal rules
        if stripped in ('---', '***', '___'):
            # subtle decorative divider
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(6)
            pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="{HEX_BORDER}"/></w:pBdr>')
            p._element.get_or_add_pPr().append(pBdr)
            i += 1
            continue

        # Handle Headings
        if stripped.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(stripped[2:])
            run.font.name = 'Calibri'
            run.font.size = Pt(18)
            run.bold = True
            run.font.color.rgb = COLOR_PRIMARY
            i += 1
            continue
        elif stripped.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(stripped[3:])
            run.font.name = 'Calibri'
            run.font.size = Pt(13.5)
            run.bold = True
            run.font.color.rgb = COLOR_SECONDARY
            i += 1
            continue
        elif stripped.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(stripped[4:])
            run.font.name = 'Calibri'
            run.font.size = Pt(11.5)
            run.bold = True
            run.font.color.rgb = COLOR_PRIMARY
            i += 1
            continue
        elif stripped.startswith('#### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(stripped[5:])
            run.font.name = 'Calibri'
            run.font.size = Pt(10.5)
            run.bold = True
            run.font.color.rgb = COLOR_SECONDARY
            i += 1
            continue

        # Handle Markdown Tables
        if stripped.startswith('|') and '|' in stripped[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1

            if len(table_lines) >= 2:
                # Parse headers and rows
                raw_rows = [[c.strip() for c in row.strip('|').split('|')] for row in table_lines]
                # Filter out markdown divider row (|---|---|)
                rows = [r for r in raw_rows if not all(set(c.replace(':', '').replace('-', '')) == set() or c == '' for c in r)]

                if rows:
                    cols_count = max(len(r) for r in rows)
                    table = doc.add_table(rows=len(rows), cols=cols_count)
                    table.alignment = WD_TABLE_ALIGNMENT.CENTER
                    set_table_borders(table)

                    for r_idx, row_data in enumerate(rows):
                        is_header = (r_idx == 0)
                        tr = table.rows[r_idx]
                        if is_header:
                            trPr = tr._element.get_or_add_trPr()
                            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

                        for c_idx in range(cols_count):
                            cell = tr.cells[c_idx]
                            cell_text = row_data[c_idx] if c_idx < len(row_data) else ""
                            cell_p = cell.paragraphs[0]
                            cell_p.paragraph_format.space_before = Pt(0)
                            cell_p.paragraph_format.space_after = Pt(0)
                            cell_p.paragraph_format.line_spacing = 1.1

                            if is_header:
                                set_cell_shading(cell, HEX_PRIMARY)
                                set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
                                format_run_tokens(cell_p, cell_text, default_size=Pt(9.5), default_color=RGBColor(255, 255, 255))
                                for run in cell_p.runs:
                                    run.bold = True
                            else:
                                if r_idx % 2 == 1:
                                    set_cell_shading(cell, "FFFFFF")
                                else:
                                    set_cell_shading(cell, HEX_ZEBRA)
                                set_cell_margins(cell, top=90, bottom=90, left=130, right=130)
                                format_run_tokens(cell_p, cell_text, default_size=Pt(9.5), default_color=COLOR_TEXT)

                    # Add space after table
                    p_spacer = doc.add_paragraph()
                    p_spacer.paragraph_format.space_before = Pt(0)
                    p_spacer.paragraph_format.space_after = Pt(6)
            continue

        # Handle Bullet Points
        if stripped.startswith('- ') or stripped.startswith('* '):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            format_run_tokens(p, stripped[2:])
            i += 1
            continue

        # Handle Numbered Lists
        m_num = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if m_num:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            p.paragraph_format.first_line_indent = Inches(-0.25)
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            run_num = p.add_run(f"{m_num.group(1)}. ")
            run_num.bold = True
            run_num.font.name = 'Calibri'
            run_num.font.size = Pt(10.5)
            run_num.font.color.rgb = COLOR_SECONDARY
            format_run_tokens(p, m_num.group(2))
            i += 1
            continue

        # Handle Normal Paragraphs
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        format_run_tokens(p, stripped)
        i += 1

    doc.save(docx_path)
    print(f"Generated: {docx_path} ({docx_path.stat().st_size} bytes)")


def main():
    labs = [
        ROOT / 'lab/lab3-producer-consumer/lembar-laporan.md',
        ROOT / 'lab/lab4-routing/lembar-laporan.md',
        ROOT / 'lab/lab5-integrasi/lembar-laporan.md',
        ROOT / 'lab/lab6-monitoring/lembar-laporan.md',
        ROOT / 'lab/lab7-troubleshooting/lembar-laporan.md',
    ]
    for md_file in labs:
        docx_file = md_file.with_suffix('.docx')
        convert_markdown_to_docx(md_file, docx_file)


if __name__ == '__main__':
    main()
