# VotePredict #864 — V41 full source PDF recovery for 830 indexed Senate CFB report versions

**Research checkpoint: October 15, 2026.** Read-only public government source research, not a production deployment. Builds on [merged V40 PR #1287](https://github.com/killjoy00/votepredict/pull/1287). V41 review: [PR #1296](https://github.com/killjoy00/votepredict/pull/1296).

## Evidence acquisition result

The immutable V40 original index identified **830 exact 2021–25 Minnesota Campaign Finance Board candidate-committee report-version references**, 506 originals and 324 amendments, across all 95 Minnesota senators who served at some point during those years. V40 already recorded 590 downloaded whole official government PDFs with unique file SHA256/byte sizes, 579 distinct bodies and 240 index-only references.

**Actual source-run #38751927330** ([original read-only Actions run](https://github.com/killjoy00/votepredict/actions/runs/38751927330), job 116480257433) independently reconstructed the V40 baseline and downloaded **all 240 remaining complete original government PDF response bodies** by their exact government viewer URLs: 18 from report year 2021, 115 from 2022, 44 from 2023 and 63 from 2024. Each GET returned full PDF bytes and a whole-body SHA256; zero HTTP/source holds. Source acquisition did *not* require text extraction, OCR, first-page parser recognition or exposing report contents.

**Independent rerun of the same government source query** on [run #38751927330 attempt 2](https://github.com/killjoy00/votepredict/actions/runs/38751927330), job 116482128081, reproduced **240/240 exact version IDs, official viewer fingerprints, whole-file PDF SHA256 hashes and original byte sizes**, with zero source holds. This reproduces **current 2026 public government PDF bodies**, not exact *historic* versions of those bytes.

| Report year | Newly downloaded V41 PDF version refs |
| --- | ---: |
| 2021 | 18 |
| 2022 | 115 (including C pre-primary and E pre-general) |
| 2023 | 44 |
| 2024 | 63 |
| 2025 | 0 (already acquired under V40) |
| **Additional total** | **240** |

## New source-ledger state

| Source distinction | V40 | V41 |
| --- | ---: | ---: |
| Official indexed filing version IDs | 830 | **830** |
| Downloaded original government PDF version references | 590 | **830** |
| SHA-distinct whole PDF binaries | 579 | **813** |
| Indexed versions sharing a within-committee whole binary | 11 | **17** |
| Known indexed versions awaiting any PDF | 240 | **0** |
| Actual-serving senators with source report evidence | 95 | **95** |
| Historical exact-content independent public-by dates proven | 0 | **0** |
| Legal owed-original-report denominator | unknown | **unknown** |

All 240 new source-version records are preserved in [V41 original proof PSV](source-proof/cfb-2021-25-240-new-government-PDF-source-retrieval-v41.psv) with full SHA256 and byte length, exact CFB version reference, committee registration, report period, original/amendment index, viewer-source SHA, direct public CFB URL, 2026 retrieval time, GET method and successful workflow/job ID. The complete [830-version ledger](source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv) preserves the 590 V40 originals and all new source provenance without rewriting prior source archives. [Checkpoint](source-proof/cfb-2021-25-240-government-PDF-source-recovery-checkpoint-v41.json) documents both matching source runs. [Profile source data](../../data/cfb-senate-official-filings-2021-25-v41.json) reflects current downloads; [SHA-pinned offline V41 auditor](../../scripts/audit-cfb-864-830-full-pdf-source-v41.mjs) independently reconstructs all 830 rows and validates 813 distinct full PDF hashes.

The six additional aliases are **same registered committee, identical whole-body PDF files across separate version indices**: 1 pair in 2022 C, 1 triplet in 2023 YE (two aliases), 1 2024 special pre-general pair, 1 2024 YE pair, and another 2024 YE pair. No original government PDF whole-file SHA collision across different registered candidate committees was observed. Amended version references remain separate; alias PDFs must not be added as distinct donations.

## Product and historical interpretation

Every *currently indexed* filing now has a downloaded current official PDF binary; legislator profiles reflect that reality rather than implying there are outstanding attempts. A real PDF that cannot be parsed remains filing-existence evidence. The existing data has **425 readable-form versions, 14 unresolved scan/detail versions, one report-date conflict, 373 downloaded unparsed full-PDF version references and 17 same-body aliases**. Download authentication does not certify report-level monetary reconciliation.

All **830 historic exact-version independently evidenced first-public dates remain unproven**. Current CFB copies may be redacted/reposted, so their whole-body hashes need not equal a historical copy. Minnesota Statutes [§10A.20 subdivision 1b](https://www.revisor.mn.gov/statutes/cite/10A.20) provides a legal release floor for ordinary reports, not proof that a particular PDF version's exact contents were public at a previous vote cutoff. [2026 Minnesota Session Laws Chapter 101 §30](https://www.revisor.mn.gov/laws/2026/0/Session+Law/Chapter/101/) required temporary removal, redaction and staged reposting of old reports, adding an explicit historic-source-content limitation. No source rows are promoted into earlier historical as-of eligibility.

Also **not established**: complete committee registration/termination and statutory legally owed-original reporting denominator, itemized/nonitemized receipt and expenditure reconciliation, loan/debt totals or amendment financial diffs. These require separate official original filing/report-body reviews. An 830/830 *known indexed* PDF acquisition percentage is **not** a statutory filing-completeness percentage.

No source donor/payee names, monetary transaction rows, raw original government PDF blobs, production/Neon reads or writes, forecast eligibility/model changes, serving updates, migrations, deployments or scheduler activation. Issue #864 stays open.

## Remaining source research, with stopping conditions

1. Work through 373 unparsed PDF versions, plus 14 hard-to-read forms and one report-date conflict, prioritizing 2022 pre-election original/amended *summary totals*. Retain unreadable details as unknown and never sum amended report versions as separate contributions.
2. Reconcile annual principal-committee registrations, reporting obligations, true ballot conditions, termination filings and special elections against Board rules; do not substitute the 830 indexed count for an owed denominator.
3. Seek exact-version contemporaneous public-by only via independent old content snapshots; after reproducible failed archive strategies, stop rather than inventing dates or equating legal release with publication.
4. Validate V41 independent tests/full application CI and review PR #1296. Avoid all production writes and deployment until separately authorized.
