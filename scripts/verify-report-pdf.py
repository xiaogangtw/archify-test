"""Verify execution-UI fixture PDF text, fonts and bounds (pypdf, PyMuPDF)."""
import sys
from pathlib import Path
from pypdf import PdfReader
import pymupdf

for arg in sys.argv[1:]:
    path = Path(arg)
    reader = PdfReader(path)
    doc = pymupdf.open(path)
    text = '\n'.join(page.get_text() for page in doc)
    compact = ''.join(text.split())
    for expected in ['執行品質報告', '登入成功案例', '登入失敗案例', 'a' * 40, 'b' * 40, 'c' * 40]:
        assert ''.join(expected.split()) in compact, (path.name, expected)
    if path.name == 'long-report.pdf':
        assert compact.count('表格續頁終點') == 2
    assert '\ufffd' not in text
    assert sum(len(page.images) for page in reader.pages) == 0
    for page in reader.pages:
        fonts = page['/Resources']['/Font']
        for ref in fonts.values():
            font = ref.get_object()['/DescendantFonts'][0].get_object()
            assert '/FontFile2' in font['/FontDescriptor']
    for page in doc:
        sizes = {round(span['size'], 2) for block in page.get_text('dict')['blocks'] if block['type'] == 0 for line in block['lines'] for span in line['spans']}
        assert sizes <= {9.75, 11.25}, (path.name, 'expected 13px body / 15px headings', sizes)
        for block in page.get_text('blocks'):
            assert block[0] >= 40 and block[2] <= 560 and block[1] >= 20 and block[3] <= 825, (path.name, block[:4])
    print(f'{path.name}: {len(reader.pages)} pages; Chinese/Latin/SHA text, embedded fonts, zero images, 13px/15px sizes and bounds PASS')
