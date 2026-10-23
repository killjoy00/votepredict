# #864 scoped 192-original rendered-page OCR review

Appendix to the [authoritative completion ledger](senate-864-completion-ledger.md).
This is a completed **local source-only audit**, not a production insertion or
a certified all-format historical vote denominator.

All **192** frozen OCR originals (**136 from 2022; 56 from 2025**) were acquired
with exact official URL/raw-PDF SHA256 authentication. Their **331 pages** were
rendered at 300 dpi as PNGs and checked for complete page sequence and image
integrity. Tesseract OSD supplied orientation; every oriented page was visually
reviewed by Codex. Seven pages are blank raster pages. The other 324 received
individual visual review indices. Two segmentation passes, PSM 3 and PSM 11,
use the **same OCR engine**, not independent engines.

The [complete evidence receipt](source-proof/senate-864-192-ocr-rendered-audit-20261023.json)
retains all source identities, full baseline text, both full page OCR texts and
hashes, raw raster hashes, orientation evidence, parser observation counts,
legibility findings and rendered-page notes. It records **14 originals with
printed individual choices**, versus **11** in the existing parser candidate
set. Among the other 178 originals, 168 have no printed individual choices
observed on fully readable reviewed pages; **10 retain clipping/occlusion
quality holds**. These are bounded observations about these images. They do
not prove that no historical vote occurred or certify every OCR word.

| Additional original missed by the named parsers | Printed evidence | Remaining requirement |
| --- | --- | --- |
| February 9, 2022 State Government Finance and Policy and Elections, page 1 | SF2818 area: five in-favor names and three opposition names in columns | Exact distinct question association: sides precede the final recommendation text. No nearby-heading assignment. |
| March 10, 2022 Energy and Utilities Finance and Policy, page 2 | SF3661 passage checkbox; four Yes marks and three No marks; explicit prevailed Yes | Validated geometry-aware complete-question extraction and historical identity reconciliation. Mathews has a blank row; no choice or absence inferred. |
| March 30, 2022 Property Taxes, page 2 | SF3882 referral to Local Government; Weber/Chamberlain No, Murphy/Klein Yes; 2-2 motion did not prevail | Validated complete-question extraction for individually printed “voted yes/no” lines and historical identity reconciliation. OCR “Roll cail” defeats a literal roll-call marker. |

These three originals are retained as **source-only extractor/question holds**.
They supply no automatically accepted events or choices. The February 9 column
names already exist in baseline OCR: improving OCR alone cannot fix that parser
gap. Parser agreement likewise misses the checkbox and individually voted lines.

The visual review also confirms existing candidate evidence, including three
physical named rolls on March 2, 2022 Finance despite only two primary parser
observations, and eight on April 6 despite ten overlapping primary observations.
Raw named tokens and parser streams are not additive votes. February 9 SF2677
and March 30 SF3881 visibly have recommendation questions although legacy primary
observations attach amendment classifications; this audit does not repair those
database classifications. The March 12, 2025 Judiciary roll is S.R.15, a nonbill
resolution; it stays outside bill-question semantics. April 23 Taxes has four
nine-name rolls. Indexed/printed year conflicts in earlier 2025 Taxes pages
remain identity holds even where their text is legible.

The original population report's **233 parser-candidate originals / 2,626
text negatives** retain their parser meaning; the three visual misses are an
additional coverage finding. No `ocrVisualQualityCertified` inventory boolean
is changed. The 55 OCR originals from 2023/2024 are outside this visual review.
The acquired unparseable May 19, 2022 Finance PDF is outside these 192 readable
OCR originals. The upper-left occlusion on March 16 Property Taxes page 2 was
also confirmed against its full 300 dpi raster.

## Reproduce

```bash
python scripts/audit-senate-864-ocr-originals.py --originals /tmp/senate864-originals --output /tmp/senate864-ocr.json
node scripts/verify-senate-864-ocr-audit.mjs
node --test tests/senate-864-ocr-audit.test.mjs
node --import tsx scripts/compare-senate-864-ocr-parsers.mjs
```

The first command requires Poppler, Tesseract eng/osd and Pillow. It validates
the immutable input and raw bytes, uses fresh temporary render directories,
rejects missing pages or corrupt PNGs, and runs bounded OCR processes. Raster
hashes can vary with tool versions; new rasters require new visual review.
The verifier rejects missing pages, changed text, unreviewed orientation and
promotion of findings to votes. The parser comparison reproduces **576**
source/configuration comparisons. The checked-in workflow has no database
credentials and performs zero production writes. #864 remains **OPEN**.
