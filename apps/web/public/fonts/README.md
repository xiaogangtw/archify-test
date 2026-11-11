# Report fonts

These local assets are loaded only when a quality report is exported. The PDF
embeds Inter for Latin and Noto Sans TC for Chinese at weights 400 and 500.
No report data or font request is sent to a third-party service at runtime.

Sources downloaded on 2026-10-29:

- Inter: https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf
  SHA256: `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`
- Noto Sans TC: https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf
  SHA256: `864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f`

Both fonts use the SIL Open Font License 1.1; adjacent OFL files retain the
copyright and license. Static instances use `wght=400` and `wght=500`; Inter
also uses `opsz=14`. Unused layout features are removed while retaining the
source Unicode coverage. Rebuild with `scripts/prepare-report-fonts.py` and
fontTools. These operations do not require fontTools in the deployed app.

The exporter embeds complete static TrueType fonts. Runtime fontkit subsetting
and the initial CFF approach failed visual verification despite readable
ToUnicode maps, so neither is used. Embedded fonts increase first-export asset
loading and PDF size; this is intentional for portable Chinese text rendering.
