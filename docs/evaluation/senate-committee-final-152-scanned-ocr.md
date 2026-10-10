# Issue #864 — final remaining 152 scanned electronic original Senate committee Minutes, source-only

The [original 1,452-PDF Senate Minutes source audit](./senate-committee-2022-25-original-pdf-action-census.md) downloaded every linked original electronic Minutes PDF in the official LRL 2022–25 index. **207** were too low-text for embedded extraction; these are *not* evidence the underlying committee meetings contained no recorded action. The independently verified [55 previously recovered](./senate-committee-2023-24-final-scanned-originals.md) leave **2022:110 and 2025:42** still requiring source-bound OCR.

## Source identity and exact scope

The pinned code in `src/evidence/senate-committee-final-ocr-cohort.ts` reads **only two previously verified original source audit artifacts**, from original source run [#38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841):
- 2022 artifact #11674729430, exact original JSON SHA-256 `23be57a94c4c9dcb3641dca450b335c81fca9fbd25867d94658d77937b847372`; 121 originally low-text links minus three original OCR feasibility links and eight second-sample links = **110 remaining**. Ordered remaining URL-list SHA-256: `794bd1003290f13e5c44e1ab27b545eee9632f8a09c09b0ed6080afa275b3be9`.
- 2025 artifact #11675014092, original JSON SHA-256 `e611f2b7a7225d7c62e8bbae960db60c50793ffca7cb3928e62d578a809c5dea`; 51 originally low-text links minus one feasibility and eight second-sample links = **42 remaining**. Ordered URL-list SHA-256: `29d0656929dc92be4b283b296f1101cbbf6ad90ef991e31c6e1b30ceb6fee515`.

The source list is immutable by original full-document artifact SHA, URL-list SHA and prior-cohort source SHA; selection rejects duplicate URLs, mismatched hearing date/year, House/2021/non-LRL URL, unsupported extraction error and modified old manifests. There are exactly **nine non-overlapping source batches**: six shards of at most 19 2022 PDFs and three shards of 14 2025 PDFs.

## Work boundaries

The one-time, push-to-main-by-workflow-file [source-only GitHub Actions workflow](../../.github/workflows/senate-committee-final-152-scanned-ocr.yml) runs up to four independent OCR shards concurrently, no cron/dispatch. It downloads the *pinned prior source audit metadata*, then fetches only exact original LRL PDFs for one shard. Original PDF streaming maximum 8,000,000 bytes and verified maximum eight original pages; never follows redirects. It uses the already-validated opt-in OCR extractor and existing v2 recorded-rollcall/context-action parser.

Outputs contain original PDF byte SHA-256, OCR text SHA-256, hearing date/committee, source-derived named YEA/NAY member-choice hashes where explicitly available, parser candidate action observations, missingness flags and failures. **No raw PDF bytes, page images, OCR text or member names are retained in output or committed.** Zero parser detections cannot be interpreted as absence of votes; count-only, voice and context-only motions never imply named member votes or floor passage stances.

Do **not** upgrade the verified **55/207** current recovery total by 152 until actual source runs and artifacts succeed. Any source failure, source drift, oversize original or unexpected action parser exception must remain a separate unresolved original with a metadata-only failure artifact. Retain original artifact ZIP/JSON hashes and per-source metadata in tested durable proof ledgers after results verify.

This completes neither official 2021 print-only Senate records nor the 2022 print/electronic reconciliation. 141 electronically indexed 2022–25 meetings lack linked Minutes; 141 other original PDFs have a roll-call phrase signal without supported roll observations. The actual all-year recorded action and member choice denominators remain unknown, and any source-to-private-database join requires separately authorized read-only export. No production DB access/write, serving/evaluation/training/model/forecast or scheduler change, 2027 work or office contact. Keep #864 open.
