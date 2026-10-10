# #864: durable source checkpoint for 2021–25 Minnesota Senate candidate-registration discovery

The one-time regulator-source [capture workflow](https://github.com/killjoy00/votepredict/actions/runs/38081628130) ran on **October 10, 2026** after [PR #914](https://github.com/killjoy00/votepredict/pull/914) merged. It requested every Senate district 1–67 across the CFB's 2020, 2022, 2024 and 2026 election viewer segments, retained 268 individual original HTML response SHA-256 digests in its metadata artifact, and finished successfully.

The permanent [registration source checkpoint](source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json) preserves the acquisition's exact GitHub Actions run/artifact IDs, hashes of the original ZIP, uncompressed JSON, normalized set of 268 per-page source identity/hash/registration-ID observations, independently hashed four segment subsets, all 494 distinct registration-number keys, and a compact four-bit presence mask for each key. It also preserves the complete list of 2024 and other source-empty districts and all eight same-display-name/different-ID collisions. Regression tests validate these hashes and counts.

## Acquired public source observations, not legal denominator

| Source election segment | District pages retrieved and parsed | Pages with a candidate label | Distinct registration IDs in segment |
|---|---:|---:|---:|
| 2020 (predecessor context for possible 2021 obligations) | 67 | 67 | 231 |
| 2022 | 67 | 64 | 270 |
| 2024 | 67 | 48 | 126 |
| 2026 (viewer needed to find 2025 special-election candidates) | 67 | 66 | 249 |
| **All four segments, deduplicated by numeric registration ID** | **268** | **245 pages with labels** | **494** |

The 494 deduplicated IDs are **not 494 active committees in 2021–2025**. **134** candidate IDs are observed only in the 2026 source segment; these must not be assigned to 2025 on that evidence. The other **360** appear somewhere in the 2020, 2022 or 2024 segments, which likewise do not prove continuously registered committee activity over 2021–2025. Source-empty candidate selectors mean **no label observed on a particular current CFB viewer**, not zero historical Senate committees, reporting obligations or filings.

The same-display-name case "Bushard, Robert" illustrates why registration numbers must remain independent: the 2022 segment displays registration 18937; the 2026 segment displays 19531. The eight name collisions are kept separate, not merged by person-name heuristics. Original PDF registration control IDs **18443** and **19205** are present.

## Checksum contract and artifact retention

Acquired artifact:
- [Successful run #38081628130](https://github.com/killjoy00/votepredict/actions/runs/38081628130)
- Artifact ID **11680891630**, named **cfb-senate-2021-25-official-district-registration-discovery** (GitHub retention currently through **November 9, 2026**)
- Original ZIP SHA-256: **fe85e6d3e4ae64d24d3153ae23b976267769cea8e57400e8008f2daffbace5a1**
- Uncompressed source observation JSON SHA-256: **83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04**
- Deterministically normalized 268-page digest: **08c27a830b9ce8084997dac7203a421f08dbf2af20a22c602be3703d74ff9747**

The checkpoint preserves the digest rule exactly. The compact sorted registration IDs and segment masks allow per-segment reconstruction even after the Actions artifact expires. For a future independent reproduction of each page's original body hash, the source artifact is required; a normalized aggregate digest alone is not an archival copy of every HTML response.

Recheck the fixed source checkpoint without database access:

    node --import tsx --test tests/cfb-senate-district-source-checkpoint.test.ts

## Remaining work before marking finance evidence complete

1. Independently confirm Minnesota Senate committee registrations' **effective registration date, registered office/district, termination dates, re-registrations and changes**, including candidates not displayed on any 2026-retrieved comparison page.
2. Construct a historical **committee × reporting year × legally applicable report requirement** table for 2021–2025. Keep nonfilers, exemptions, candidates not on the ballot, temporary/special-election rules and termination reports explicit.
3. Reconcile actual original-versus-amended filings and case-specific **filing / statutory release floor / historically verified public-by** dates. The two originally proven filer committees and seven original PDF versions remain just a bounded evidence subset; they do not support a coverage fraction.
4. Only later, after separate authorization, reconcile against an appropriately permissioned DB extract. Do **not** access or alter production Neon/Vercel, retrain models, run scheduler/backfill work, change 2027 or change serving behavior.

**Issue #864 remains open.** A successfully observed statewide *election-viewer* inventory is not the historical statewide *reporting-obligation* denominator.
