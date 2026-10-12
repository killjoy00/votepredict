# #864 — follow-up to original-PDF parser v3 first-attempt six-document HOLD

**Previously merged:** [PR #1244](https://github.com/killjoy00/votepredict/pull/1244), independent government source-only [run #38292166407](https://github.com/killjoy00/votepredict/actions/runs/38292166407) on exact main SHA `9b7bb8f57fca9bf991b78c030fb1bb7e7b13a2ce`, first attempt. Synthetic parser and full PR CI passed. **Original source run finished with a genuine aggregate HOLD**, not an all-1452 certificate.

## First source-only audit observations (all sixteen SHA-pinned shards, no private DB)

| Year | Exact original linked PDFs | Revalidated original PDFs | Held | Baseline named candidate rolls on verified originals | New v3 named candidates on verified originals |
|---|---:|---:|---:|---:|---:|
| 2022 | 325 | 323 | 2 | 28 | 28 |
| 2023 | 454 | 453 | 1 | 22 | 22 |
| 2024 | 258 | 258 | 0 | 25 | 30 |
| 2025 | 415 | 412 | 3 | 29 | 32 |
| **Total** | **1,452** | **1,446** | **6** | **104** | **112** |

The six held original documents occur only in four bounded original run matrix shards: `2022/3` (two), `2023/0` (one), `2025/0` (one), and `2025/1` (two). **All six original failures were coarse `otherFailClosedHolds`; the original run did not identify precise cause.** In the first run, none were classified as an independently changed PDF SHA/transport or original extracted-text SHA drift, but this coarse categorization is not positive proof of another exact cause.

**2024 authentic source gain:** one Education Policy original on February 14, 2024 has six separately requested numbered amendment rolls rather than two archive-parser candidates, +4 independently authenticated original actions; one other 2024 source added another named candidate. The rechecked 2025 cohort adds three further named candidates. These eight added candidate observations do **not** establish eight missing stored events, nor change the frozen V2/V4/V6 source-to-Neon parity receipts or certify an official vote/motion universe.

## Second proof: four held shards only, preserving first run's 12 passing originals

The [new first-attempt workflow](../../.github/workflows/senate-864-six-held-original-retry-v4.yml) rechecks **exactly four** held year/shards, all original PDF bytes again SHA-verified against the original government metadata and all PDF page/OCR resource caps retained. Only transient categorized failures may receive **one** same-scope retry. Integrity, source-text drift, original metadata mismatch and semantic action mismatch must fail closed.

The other **twelve** passing original receipts are recovered by exact original run ID, artifact name, artifact ID and GitHub ZIP SHA-256 digest pinned in the workflow. The existing sixteen-shard aggregator now additionally validates original manifest run, parser versions, finite nonnegative counts and nonregression. Only 16 successful, unique, total-1,452 original receipts can yield a safe complete-original-*electronic-PDF* reparse aggregate. Mixing runs is labeled and pin-verified; this is not one unbroken 1,452-PDF re-fetch in the second run.

If any of the six remains unresolved, the public receipt preserves only reviewed static failure categories/counts (OCR, PDF parse, page cap, metadata command, transport/integrity, original-text drift, semantic mismatch or unknown). Neither original URLs, PDF text, person names, SHA fingerprints of choices, event keys, nor raw exception messages leave the source parser process.

**Outside scope and still on HOLD:** 2021 official printed Minutes denominator; 2022 print-versus-electronic parity; 141 indexed meetings without linked electronic Minutes; full source-to-stored individual vote/action reconciliation; exact 2024 missing YEA identity/root cause; all-membership service day; production binding; all historical motion denominator. No production reads/writes, corrections, forecast/model/serving/scheduler/2027 change or office contact. [#864](https://github.com/killjoy00/votepredict/issues/864) remains OPEN.
