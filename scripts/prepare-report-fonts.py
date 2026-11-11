"""Rebuild report fonts from the two verified source files; requires fontTools."""
import hashlib
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

sources = [
    ('Inter', '29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031'),
    ('NotoSansTC', '864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f'),
]
if len(sys.argv) != 3:
    raise SystemExit('Usage: python scripts/prepare-report-fonts.py Inter-variable.ttf NotoSansTC-variable.ttf')
target = Path(__file__).resolve().parents[1] / 'apps/web/public/fonts'
for source, (_, expected) in zip(sys.argv[1:], sources):
    if hashlib.sha256(Path(source).read_bytes()).hexdigest() != expected:
        raise SystemExit('Unexpected source font digest: ' + source)
for source, (family, _) in zip(sys.argv[1:], sources):
    for label, weight in [('Regular', 400), ('Medium', 500)]:
        font = TTFont(source)
        axes = {'wght': weight, **({'opsz': 14} if family == 'Inter' else {})}
        instantiateVariableFont(font, axes, inplace=True)
        options = subset.Options()
        options.layout_features = []
        processor = subset.Subsetter(options=options)
        processor.populate(unicodes=font.getBestCmap().keys())
        processor.subset(font)
        font.save(target / f'{family}-{label}.ttf')
