# #864: 2023–2024 final scanned-original Senate minutes OCR catch-up

The independent [2022–25 original-PDF source audit](./senate-committee-2022-25-original-pdf-action-census.md) downloaded all 1,452 original Minnesota Legislative Reference Library electronic Senate minutes PDFs, with zero HTTP failures. It could not extract adequate embedded text from 22 PDFs in 2023 and 13 in 2024. All **35** source failures were original PDF text extraction failures, **not proof of meetings with no votes**.

The [first six](./senate-committee-scanned-minutes-ocr-feasibility.md) and [second 24](./senate-committee-24-originals-second-ocr-audit.md) OCR pilots recovered five of those originals in **each** year: 2023: 1+4; 2024: 1+4. The new pinned [2023–24 remaining-original manifest](../../src/evidence/senate-committee-2023-24-scanned-catchup.ts) covers **17** further original Higher Education PDFs from 2023 and **8** further original Higher Education PDFs from 2024, with exact dates/URLs checked against the failed-source JSON in original run [#38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841), artifacts 11674568363 (2023) and 11675315164 (2024). Exact ordered URL SHA-256: `cd3e4b1a21c18df68b1014c08628a4ca4438d401b00cd9fee42965f292da8108`. This cohort excludes every one of the 30 previously OCR-recovered originals.

## One-time, bounded execution

The [one-time two-year workflow](../../.github/workflows/senate-committee-2023-24-remaining-scans-ocr.yml) runs **only when that specific workflow file enters `main`**. Two year-isolated jobs use exact pinned URLs; no redirects; streamed maximum **8,000,000 source PDF bytes and 8 original pages each**; explicit opt-in OCR; original raw PDF SHA-256 and OCR text SHA-256; and the existing named-roll, count-only, context-motion and missingness parser. It retains **only source metadata, hashes and observation keys**, never PDF bodies, page images, OCR text or names. Individual member YEA/NAY requires a source-explicit named roll; contextual votes/motions do not imply member votes or floor-passage positions. The source-only script fails the job if any original remains unreadable and still emits a partial-failure metadata artifact.

**No source recovery is claimed merely because this workflow is merged.** Inspect the actual post-merge Actions jobs, verify recovered/failed counts against 17/8, and permanently record source artifact ZIP + JSON hashes before certifying any additional recovered originals. The original 2021 print-only and 2022 mixed print/electronic records, 141 indexed 2022–25 meetings without linked minutes, possible parser false negatives, and authorized source-to-private-database reconciliation remain separate. This work does not access production DB, rerun historical backfills, change eligibility/predictions/models/serving, activate scheduling, contact public offices, or address 2027. Keep #864 open.

## Verified original source outcome — 2026-10-10

The one-time [original-source workflow #38073521109](https://github.com/killjoy00/votepredict/actions/runs/38073521109) ran successfully on exact [merged PR #886](https://github.com/killjoy00/votepredict/pull/886), commit `32144d53d178c8d460ec9bd881b7d041574bccf5`. Both separately audited source jobs completed with no original HTTP, preflight, or OCR failures:

| Original cohort | Attempted | OCR recovered | Failed | Named rolls detected | Parser context-action candidates | No supported action detected |
|---|---:|---:|---:|---:|---:|---:|
| Final 2023 Higher Education | 17 | 17 | 0 | 0 | 11 (1 voice, 1 unanimous, 9 result-only) | 11 |
| Final 2024 Higher Education | 8 | 8 | 0 | 0 | 21 (21 result-only) | 1 |
| **This batch** | **25** | **25** | **0** | **0** | **32** | **12** |

Both 2023 and 2024 now have **all originally low-embedded-text electronic source PDFs OCR extracted**: 2023 **22/22** (5 earlier + 17 new), 2024 **13/13** (5 earlier + 8 new). This **does not establish** that every recorded committee vote/motion was recognized, or cover meetings without linked Minutes PDFs.

Source artifacts were independently retrieved and verified and their ZIP/JSON SHA-256 hashes permanently retained with **all 25 exact original PDF SHA-256 and OCR text SHA-256 hashes** in the [metadata-only source ledger](./source-proof/senate-committee-2023-24-final-25-scanned-ocr-source-ledger.json):

- 2023 artifact **11678185896**: ZIP `9d6981acee78651cbbc87211901d8b0e80092f332811d75be77e1f92dee3cfe7`, JSON `2ea0feb375285de31e3838df4fd88e0cee1aee38f11e71a913b789d38e9c64f4`
- 2024 artifact **11677986160**: ZIP `afc29c477a9f624876349a5d2e4f1c532a403fad9e845ccb5be1d3edf540b66f`, JSON `117eab1b79627bb625c21c424b9e6c302968bed52d6d1f01102dbcfd73b19375`

The [pre-merge CI #38073343396](https://github.com/killjoy00/votepredict/actions/runs/38073343396) and [post-merge CI #38073521111](https://github.com/killjoy00/votepredict/actions/runs/38073521111) both passed the full clean-migrations, TypeScript/tests/build, and dependency-audit checks. No production database was accessed or modified.

### Updated electronic original PDF extraction status

| Year | Initially low-text PDFs | OCR recovered cumulatively | Still needing OCR |
|---|---:|---:|---:|
| 2022 | 121 | 11 | 110 |
| 2023 | 22 | 22 | 0 |
| 2024 | 13 | 13 | 0 |
| 2025 | 51 | 9 | 42 |
| **Total** | **207** | **55** | **152** |

**Caution:** The 30 earlier OCR originals produced 62 parser context-only candidates plus one named roll with eight source choices; the additional 25 produced 32 more context-only parser candidates. Across 55 recovered originals, that's **94 parser context candidates**, **not** 94 manually verified distinct recorded motions. The other missingness categories remain independent: 2021 print-only minutes, 2022 print/electronic difference, 141 linked-minutes-absent meeting entries, potential parser false negatives, and unapproved private database SELECT reconciliation and historical correction. Do not infer database or model coverage from improved source extraction. Keep issue #864 open.
