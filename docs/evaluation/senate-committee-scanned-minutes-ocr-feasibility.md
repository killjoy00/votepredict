# Issue #864 — six-source scanned original Senate Minutes OCR feasibility

The official [2022–2025 source-link census](./senate-committee-2021-25-official-meeting-census.md) enumerated **1,452 original Senate minutes PDFs** in the current LRL index. The [source PDF action audit](./senate-committee-2022-25-original-pdf-action-census.md) then actually read all **1,452**:

| Year | Original PDFs | Text successfully extracted | Too little embedded text |
| --- | ---: | ---: | ---: |
| 2022 | 325 | 204 | **121** |
| 2023 | 454 | 432 | **22** |
| 2024 | 258 | 245 | **13** |
| 2025 | 415 | 364 | **51** |
| **Total** | **1452** | **1245** | **207** |

**All 207 previously unresolved original PDFs failed the same embedded-text check.** They were downloaded but their text was under the extractor's minimum; they were not HTTP failures. These sources may be scanned/image-based, but that is an inference from text extraction alone until OCR is demonstrated on original bytes. Do not declare them blank or absent, and do not treat the 1,245 parser-success PDFs as fully recognized actions without reviewing ambiguous rollcall/voice cues.

## Bounded, source-backed OCR check

Use the [one-time six-original workflow](../../.github/workflows/senate-committee-six-scanned-minutes-ocr-pilot.yml), drawing **three fixed 2022 official originals and one each from 2023, 2024, 2025** from the exact prior original-source failure list. The tool uses the existing Minnesota Senate PDF extractor's explicit OCR opt-in and Poppler/Tesseract fallback **only when embedded text is unavailable**. Each original PDF is individually limited to **8 MiB and 8 independently verified pages** (pdfinfo preflight), with **no redirects** and exact pinned hosts and URLs. The source's ordinary OCR routine discards temporary rasterized pages after each document. If the source exceeds either bound, it is explicitly recorded as unresolved rather than partially OCR'd. Per source it records official PDF bytes SHA-256, original URLs, hearing day, OCR or embedded extraction method, parsed action-type counts/keys and minimal source-cue flags. The original PDFs, temporary rasterized images, extracted OCR text and member name lists are **not** persisted. The original PDF OCR fallback cleans its temporary working directory.

**Acceptance for expanding OCR:** at least one authentic original missing-text PDF must be recovered with substantial extractable text and a clear event/date/committee identity; the existing action parser must produce meaningful and source-matched action observations without hallucinating choices. If feasibility fails, categorize the 207 files explicitly as requiring manual scan/OCR recovery and stop, rather than scanning thousands of pages needlessly.

This is a narrow technical feasibility check, not authority to bulk OCR every source, run a production backfill, infer a vote from an unobserved action, or promote candidate evidence. 2021 official Senate print-only minutes are entirely separate; the 2022 print/electronic collections may differ. Reconciliation to a private evidence database requires a separately authorized SELECT-only export. No production DB/forecasts/serving/scheduler/2027 or office contact. Issue #864 stays OPEN.
