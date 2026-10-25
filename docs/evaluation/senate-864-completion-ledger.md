# #864 authoritative historical source-to-database completion ledger

Maintained reconciliation for **2021–2025 Minnesota Senate**. Initial reviewed main:
`5dc567397de8c4acfffe34417d444802c5a8b6db`; full-family census snapshot **2026-10-19T15:14:11.167Z**
at **`a606969debe0ebd9ec41aa57d9372771c41f4182`**, [39275444868](https://github.com/killjoy00/votepredict/actions/runs/39275444868), protected job `118139505759`.
**#864 remains OPEN:** unknown official denominators and unresolved source-to-database joins
prevent closure under its actual acceptance criteria. Completed actionable subtracks are
marked complete below; this is not a claim of complete history.

The [durable aggregate receipt](source-proof/senate-864-completion-readback-20261019.json)
and [senator/year/source media matrix](source-proof/senate-864-media-senator-year-source-20261019.csv)
are appendices of this one maintained ledger. Older linked reports remain dated receipts,
not competing current completion ledgers. A workflow success, source inventory or empty
query does not establish completeness.

## October 25 final closeout: repair workstream complete; source dependencies blocked

**The user-approved bounded closeout is complete. No new repair batch is needed.**
The accepted **2026-10-25T15:04:57.332Z** snapshot reconciles the existing corpus
across all four categories in verified READ ONLY / REPEATABLE READ with explicit
ROLLBACK. It makes zero production writes, new source acquisitions or outcome
experiments. All 36 schema-ledger entries match. The initial query attempt was
not accepted because its source-type filter omitted the known Taxes PDF; the
fixed complete snapshot includes that exact original rather than mixing times.

| Category | Verified closeout result |
| --- | --- |
| Committee | **221 events / 1,950 choices** inventoried; all **52 reviewed questions / 625 choices** reconciled: 51 same-source exact plus one independently verified alternate-source match. |
| Websites | **1,194 / 1,194** exact source/literal/person/clock/flag matches; **92 people / 123 bodies**, three known scope exclusions. Both frozen protocols and the examined experiment result are unchanged. |
| Finance | **830 / 830** exact registry versions / **813 bodies**; retained Miller PDF bytes verified, **25 exact mechanical links / three unchanged purpose holds**. **58,555** legacy eligibility claims and **32,711** possible early-date flags remain explicit revalidation debt. |
| Media | **948** context rows accounted for (794 in-range / 154 outside); all **three** previously certified Miller fragments exact. Context mentions create no new attributable statements. |

The [final human-readable closeout and fixed blocked list](senate-864-final-closeout-20261025.md),
[machine-readable reconciliation](source-proof/senate-864-final-closeout-20261025.json)
and [file-hash publication receipt](source-proof/senate-864-final-closeout-publication-20261025.json)
are the final appendices of this workstream. The existing strict source validators
were reused; six focused tests cover incorrect source/person/clock bindings,
read-only query bounds, missing schema proof, frozen-input drift and private-field
rejection. Private database snapshots, raw donor information and retained PDF
bytes are not published.

The current retained-text row-parser check still has **40 held occurrences** and
four excluded cross-original question keys. These overlap across sources and
fragments; they are not certified missing events or a universal denominator.
Nonbill cases also require separately scoped identity/storage semantics, rather
than assignment to a nearby bill; those are scope/design holds as well as proof gaps.
The final blocked list also preserves May 12 Taxes/SF2818 question holds, six
missing-Minutes dates, ten quality holds, the unparseable committee PDF,
2021/2022 print boundaries, finance publication/obligation gaps, wider owned-site
coverage and media attribution gaps. No existing hold is silently certified.

- [x] Reconcile the fixed existing evidence against current storage across all four categories.
- [x] Assess the single allowed final repair batch: **not needed; zero newly proven discrepancies**.
- [x] Publish the final report, receipts and explicit source-blocked list.
- [x] End this repair workstream; no new collection, retries, parser expansion, experiment or recurring task.

**#864 remains OPEN and source-blocked under its original completeness criteria.**
There is no active engineering queue. Reopening requires separately scoped work
with new exact source evidence or a demonstrated defect. All earlier sections
below are dated history, not instructions to restart completed investigations.
Senate floor, serving, forecasts, weights, training, frozen evaluation, Vercel
and scheduler state remain unchanged; no offices were contacted or audio reviewed.

## October 25: reviewed Taxes grids and Labor rolls — production verified

**Current 2022–2025 committee production: 221 events / 1,950 explicitly named choices.**
This pass adds **15 events / 146 choices**, with zero classification corrections,
source-document writes or alias writes. All **206 previous events / 1,804 choices**
remain unchanged across all audited fields in the independent bounded readback. Cumulatively
from the original 183 / 1,326 baseline: **+38 events / +624 choices / ten classification
corrections**. **#864 remains OPEN.**

| Year | Current events | Current named choices |
| --- | ---: | ---: |
| 2022 | 40 | 270 |
| 2023 | 65 | 580 |
| 2024 | 63 | 561 |
| 2025 | 53 | 539 |
| **Total** | **221** | **1,950** |

[PR #1579](https://github.com/killjoy00/votepredict/pull/1579), reviewed main
`af0d768464ed53a59992d42383d837089b0f50df`, recovers ten **April 27, 2023 Taxes / SF1811** questions with
**97 explicit binary choices**, and five **April 9, 2024 Labor / SF5266**
amendment rolls with **49 choices**. The [source review](senate-864-reviewed-rolls-20261025.md)
lists every question, selected handwritten field, nested/accepted oral change,
original URL and SHA. The [bounded plan](source-proof/senate-864-population-reviewed-rolls-plan.json)
pins the complete reviewed cell artifact and literal question fingerprints.

Changed-vote annotations explicitly resolve Klein's A35 Yes and Dziedzic's A26
No. Pass, Absent and blank rows yield no binary votes. The A12 Absent/abstention
conflict remains metadata; only nine explicit Yes/No choices are inserted.
The blank withdrawn A31 sheet yields no event. The final SF1811 record is a
committee recommendation as amended, not floor passage. The existing Taxes
source's null committee field is preserved; the event committee comes only from
the same SHA-pinned original's printed header.

Labor A5/A12 bind the accepted friendly oral changes and explicit voice adoption
to the same parent before the subsequent named roll. The SF5266 bill heading and
presentation must agree. A9's literal “Hauschilld” requires the existing exact
historical alias plus one active membership and the original full Grant Hauschild
header. No alias is invented. The reviewed grouped lane requires explicit source
opt-in, preserving all older census recognizers and accepted passage fingerprints.

Protected [run 40201293559](https://github.com/killjoy00/votepredict/actions/runs/40201293559),
independent job `121192834030`, production job `121193693166`, passed **2,468 standard checks /
79 focused tests**, fresh source authentication and the dependency audit.
Disposable PostgreSQL verifies add-only recovery, unrelated-row preservation,
exact readback and a second zero-write run. All ten applicable reviewed-head gates
passed before merge. Required audit also found three existing Undici advisories;
only its locked transitive version was patched **7.30.0 → 7.30.1**, with no manifest
or other dependency change. Audit then reported zero vulnerabilities.

The [durable production receipt](source-proof/senate-864-reviewed-rolls-production-20261025.json)
preserves the exact main/run/job/artifact identifiers and all new IDs/timestamps.
The existing protected path reauthenticates both PDFs, the canonical Labor body
and the reviewed artifact before verified READ ONLY/ROLLBACK preflight,
schema-ledger checks and locked SERIALIZABLE bounds. Exact independent writer
readback and replay pass. All new events retain hearing-date availability,
same-day exclusion, is_passage=false, modelWeight=0 and mechanicallyActionable=false.

The separate [Neon connector readback](source-proof/senate-864-reviewed-rolls-independent-readback-20261025.json)
at **2026-10-25T14:19:49.580Z**, compared with **2026-10-25T14:01:37.843Z**, independently
checks all 146 choices, source/question identity, active historical service,
timing/model guards and preservation of every previous record, all three bounded
source records, 205 memberships, three bills and the full 36-entry schema ledger.
Only **2023 Taxes +10/97** and **2024 Labor +5/49** change.

The [current summary](source-proof/senate-864-reviewed-rolls-summary-20261025.json)
and [111-row committee matrix](source-proof/senate-864-population-committee-20261025-reviewed-rolls.csv)
preserve every dated baseline column, distinguish this pass's additions, and extend
the reviewed subset **37/479 → 52/625**. This is a preserved-and-extended subset,
not a newly certified all-format denominator. The dated frozen census remains
2,860 originals / 2,859 readable / 233 parser candidates / 2,626 text-negative /
one unparseable; its 40 held parser occurrences were **not recomputed** here.

**Remaining holds:** May 12, 2023 Taxes still has an ambiguous/misused selected
question field and lacks the exact stored PDF source; no source or event is added.
SF2818 still lacks an authenticated complete question/tally. The earlier question,
identity, incomplete-list, outcome and nonbill holds, ten clipped/occluded originals,
date/header/attendance conflicts, cross-original aliases, unparseable Finance PDF,
six missing-Minutes dates, 2021 print history and 2022 print/electronic equivalence
remain open. All 247 OCR originals / 416 pages remain scoped visually reviewed;
no word-perfect OCR or quality-certification flag is promoted. No floor, serving
model, forecast, weights, training, frozen-evaluation, Vercel or scheduler change;
no office contact or manual audio review.

## October 23: printed checkbox/voted rows recovered; all 247 OCR originals reviewed

**At the October 23 snapshot: 206 events / 1,804 explicitly named choices.**
This pass adds **two events / eleven choices**, with zero classification corrections.
The independent readback confirms all **204 previous events / 1,793 choices unchanged**.
Cumulatively from 183 / 1,326: **+23 events / +478 choices / ten classification corrections**.
**#864 remains OPEN.**

| Year | Current events | Current named choices |
| --- | ---: | ---: |
| 2022 | 40 | 270 |
| 2023 | 55 | 483 |
| 2024 | 58 | 512 |
| 2025 | 53 | 539 |
| **Total** | **206** | **1,804** |

[PR #1574](https://github.com/killjoy00/votepredict/pull/1574) recovers complete
explicit referral requests followed by individually printed voted-yes/no lines.
[PR #1576](https://github.com/killjoy00/votepredict/pull/1576), main
94585be08386b87d69a2ec37c227c2671a1685f8, preserves original HTML checkbox
cell boundaries and the selected complete bill question, direct recommendation,
known cell marks, agreeing printed tally and unambiguous outcome. Its actual
SF3661 cells match every independent 300dpi PDF grid cell; Mathews's blank
row supplies neither a vote nor an inferred absence.

The recovered records are **March 10, 2022 Energy, SF3661 committee
recommendation, passed 4–3 (seven choices)** and **March 30, 2022 Property
Taxes, SF3882 referral to Local Government, failed 2–2 (four choices)**.
The latter is distinct from the later lay-over motion. Both remain committee
motions, is_passage=false, modelWeight=0, actionable=false and sameDay=false.

Protected run [40033870365](https://github.com/killjoy00/votepredict/actions/runs/40033870365),
gate 120688469606, production job 120689685852, passed **2,468 standard /
69 focused tests**, including actual source fixtures and disposable PostgreSQL,
with zero failures/skips and zero production dependency audit vulnerabilities.
Fresh PDF bytes and original Clerk bodies are independently SHA-bound.
The existing schema/service/name guards, READ ONLY/ROLLBACK preflight,
SERIALIZABLE bounded writes, unchanged-record checks, exact readback and
zero-write replay all passed. The [production receipt](source-proof/senate-864-structured-pair-production-20261023.json)
preserves artifact 12536432022 and its ZIP digest.

The separate [Neon connector readback](source-proof/senate-864-structured-pair-independent-readback-20261023.json)
at **2026-10-23T22:34:44.723Z**, compared with 21:46:34.228Z, independently
checks every earlier event/choice, source documents, roster, bills and complete
36-entry schema ledger. It verifies each new literal question, historical
membership/service identity, choice, source hash, timing and model guard.
Both events were created at **22:34:13.412648 UTC**.

The [current overlay summary](source-proof/senate-864-structured-followup-summary-20261023.json)
and [111-row committee matrix](source-proof/senate-864-population-committee-20261023-structured-followup.csv)
preserve every dated baseline metric and show the two proven additions separately.
The reviewed question pool is now **37 questions / 479 choices**: prior strict
35/468 unchanged, plus these two/eleven in 2022. This is a preserved-and-extended
reviewed subset, not a fresh all-original acquisition or universal denominator.
The frozen census remains 2,860 originals / 2,859 readable / 233 parser candidates /
2,626 text-negative / one unparseable, with 40 held row occurrences.

**Remaining visual review complete:** [the 55-original appendix](senate-864-55-ocr-review-20261023.md)
and [per-page audit](source-proof/senate-864-55-ocr-rendered-audit-20261023.json)
record all **85 pages** from 24 originals in 2023 and 31 in 2024. Three originals
contain printed individual choices; 52 have none observed. The source-only
integrity job verifies 239 public files plus the manifest, all page hashes,
110 fresh OCR parser comparisons and the exact union with the previous audit.
**All 247 OCR originals / 416 pages are now reviewed**: 17 visual named originals,
220 fully legible scoped negatives, ten earlier quality holds, eight blank
raster pages, zero originals left unreviewed. No word-perfect OCR or visual
quality certification flag is promoted.

Two handwritten Taxes packets (April 27 / May 12, 2023) are additional parser
misses; the April 9, 2024 Labor original was already a candidate. Their changed
marks, blank/misused question fields, nested amendments, conflicting
Absent/abstention label and page continuations remain an explicit source-only
question/production reconciliation queue. These visual observations add no
certified votes.

**SF2818 investigation complete; association remains held.**
The original prints eight sides after a generic roll-call request and before
the final recommendation, with no printed numerical tally. Canonical Clerk
returns 404; the authenticated daily API confirms hearing 16667 but marks
minutes non-public with no minutes link. The [investigation receipt](source-proof/senate-864-sf2818-question-hold-20261023.json)
states exactly what authenticated question/list-completeness proof would reopen
the hold. No choice is assigned to a guessed question.

Public source executions [PR #1573](https://github.com/killjoy00/votepredict/pull/1573)
and [PR #1575](https://github.com/killjoy00/votepredict/pull/1575) preserve 58
authenticated originals / 90 pages and the fixed two-original ruled-cell proof.
PR #1573 also supplies the minimal Zod 4.6.6 override required to clear the
newly published dependency advisory; standard checks and audit pass.
[The publication receipt](source-proof/senate-864-structured-followup-publication-20261023.json)
binds the durable artifacts and source review commits.

The prior ten quality holds, date/header conflicts, cross-original aliases,
one unparseable Finance PDF, six missing-Minutes dates (1,586/1,592), 2021 print
history and 2022 print/electronic equivalence remain unresolved. No floor,
serving model, forecast, weights, training, frozen evaluation, Vercel or
scheduler change occurred. No offices were contacted and no manual audio
review was used. **#864 remains OPEN.**

## October 23: renewed recommendation recovered; all 192 requested OCR originals reviewed

**Before this follow-up, 2022–2025 committee production was 204 events / 1,793 explicitly named choices.**
The renewal adds **one event / fourteen choices**, with **zero classification
corrections**. All **203 earlier events / 1,779 choices are unchanged**.
Cumulatively from 183 / 1,326: **+21 events / +467 choices / ten classification
corrections**. #864 remains **OPEN**.

| Year | Events before → after renewal | Choices before → after renewal |
| --- | ---: | ---: |
| 2022 | 38 → 38 | 259 → 259 |
| 2023 | 54 → 55 | 469 → 483 |
| 2024 | 58 → 58 | 512 → 512 |
| 2025 | 53 → 53 | 539 → 539 |
| **Total** | **203 → 204** | **1,779 → 1,793** |

[PR #1569](https://github.com/killjoy00/votepredict/pull/1569), main
`58cab955ca9dcfca97c9b30bbc166b289f4a0500`, admits a renewed recommendation only
when the original fully restates the bill and complete parliamentary question.
It independently re-proves that original's distinct A10/A28/A21 amendments and
all **40 accepted prior choices** before excluding those different anchors.
Incomplete renewals and unresolved oral/withdrawn/compound associations stay
held. The added question is **April 3, 2023 State and Local Government and
Veterans, SF1426 as amended, recommended to pass and re-referred to Finance**,
explicitly passed **8–6**. No sides are inferred from attendance, tally or slate.

Protected run [40013876281](https://github.com/killjoy00/votepredict/actions/runs/40013876281),
independent gate `120620841053`, production job `120622233172`, passed **2,468
standard checks / 65 focused tests**, zero failures/skips and a clean production
dependency audit. Fresh original authentication, historical service/identity,
schema-ledger and READ ONLY/ROLLBACK preflight precede bounded SERIALIZABLE
writes and exact verification. Replay writes zero rows. The [production receipt](source-proof/senate-864-renewed-question-production-20261023.json)
preserves artifact `12528295824`, ZIP SHA256
`fbce92af9265a96f66097d6caad2e61483fabb5d888e271316f0e24ae4323489`.

The separate [Neon connector readback](source-proof/senate-864-renewed-question-independent-readback-20261023.json),
**2026-10-23T19:49:27.191Z**, verifies the literal question and fourteen sides,
all three prior amendments/40 choices, every earlier record unchanged and all
**35 committee/year groups**, inside bounded READ ONLY/explicit ROLLBACK.
New event `755ebc0d-7e9e-40d3-8b61-67783ac99079`, created
**2026-10-23 19:49:06.220114+00**, remains a committee motion with null amendment,
passed=true, is_passage=false, weight=0, actionable=false and sameDay=false.

The [renewal triage](source-proof/senate-864-renewed-question-held-triage-20261023.json)
preserves every earlier proven passage and reduces held parser occurrences
**43 → 40**: **13 question identity, 12 tally/incomplete list, eight outcome,
seven nonbill**. Removed occurrences include duplicate original witnesses and
an already-proven amendment witness: **one new distinct question**, not three
votes. A [local source census](source-proof/senate-864-renewed-question-source-census-20261023.json)
SHA-checks all **2,859 readable acquired texts**, finding no new row-candidate
original outside the existing 233. This is local source analysis, not a claimed
protected Actions acquisition or production readback.

**Final population parity:** [PR #1570](https://github.com/killjoy00/votepredict/pull/1570), main
`db7f5c85d6502a2505e5c0a8d1d6a8508db971ff`, runs the existing protected
READ ONLY reconciliation, [40017727121](https://github.com/killjoy00/votepredict/actions/runs/40017727121).
Gate `120634014922` passes **2,468 standard / 41 focused tests**; protected job
`120635385879` and credential-free publisher `120636060564` succeed. Fresh
readback **2026-10-23T20:19:24.665Z** confirms **35/35 strict questions and
468/468 choices**: 34 same-source exact plus the independently verified prior
alternate-source A35. Strict coverage is **19 questions / 253 choices in 2023**
and **16 / 215 in 2024**; zero 2022/2025 strict denominators do not mean zero
historical votes. Immediate prior state was 34/35 questions / 454/468 choices.
The paired `before` matrices instead reconstruct the original 183 / 1,326
baseline across all passes.

The five dated renewal/OCR files are the [registry](source-proof/senate-864-population-original-registry-20261023-renewal-ocr.json),
[complete inventory](source-proof/senate-864-population-original-inventory-20261023-renewal-ocr.json),
[summary](source-proof/senate-864-population-summary-20261023-renewal-ocr.json),
[before](source-proof/senate-864-population-committee-before-20261023-renewal-ocr.csv)
and [after](source-proof/senate-864-population-committee-after-20261023-renewal-ocr.csv)
matrices. All **233 full candidate texts**, both **111-row** matrices, all
34 prior strict question/choice fingerprints and every prior proven original
passage were checked. Population remains **2,860 originals / 2,859 readable /
233 parser-candidate / 2,626 text-negative / one unparseable**. Original
registry bytes are unchanged. Artifact `12530110275` has ZIP SHA256
`f6080f4274e5665be33f70575281defeae2c7d31dee06b14ddfea630f439bd26`;
the [publication/file-hash receipt](source-proof/senate-864-renewal-ocr-publication-20261023.json)
preserves its protected run, generated review commit and five exact file blobs.
This reconciliation performs **zero production writes**.

**OCR review completed:** [PR #1571](https://github.com/killjoy00/votepredict/pull/1571), main
`6629c482b0b5cab33705fe6a0f5039be70fa7db9`, passes canonical CI and the
credential-free source-only gate [40018112590](https://github.com/killjoy00/votepredict/actions/runs/40018112590),
job `120635336748`. The [audit appendix](senate-864-192-ocr-review-20261023.md)
and [full literal evidence receipt](source-proof/senate-864-192-ocr-rendered-audit-20261023.json)
authenticate **192/192 raw original PDF hashes** and review **331/331 pages**
from **136 originals in 2022 / 56 in 2025**. Seven are blank raster pages;
324 have individual visual indices. At 300 dpi, Tesseract PSM 3/11 and rendered
inspection find **14 originals with printed individual choices**, versus **11**
parser candidates. Among the other 178, **168 have no printed individual choices
observed on fully readable reviewed pages; ten retain clipping/occlusion holds**.
This is a Codex rendered-page review, not independent human or word-perfect OCR
certification. Both OCR passes use the same engine. **576** parser comparisons
reproduce, and seven integrity tests reject incomplete pages, changed text,
unreviewed orientation or promotion of findings into certified votes.

| Additional visual original missed by named parsers | Remaining requirement |
| --- | --- |
| February 9, 2022 State Government, SF2818 area: five in-favor / three opposition names | Exact question association; sides precede the final recommendation. Baseline OCR already has the names. |
| March 10, 2022 Energy, SF3661 selected passage checkbox: four Yes / three No marks; prevailed Yes | Validated geometry-aware complete-question extraction and historical identities. Mathews' row is blank; infer no choice or absence. |
| March 30, 2022 Property Taxes, SF3882 referral: Weber/Chamberlain No, Murphy/Klein Yes; 2–2 did not prevail | Validated complete-question extraction of individually printed voted-yes/no lines and historical identities. OCR “Roll cail” defeats literal roll-call markers. |

These are **source-only extractor/question holds**, with **zero OCR-derived
production writes or newly certified votes**. Additional physical rolls and
legacy recommendation/amendment classification issues in existing 2022
candidates are recorded in the appendix. The 2025 Judiciary S.R.15 roll remains
nonbill. Parser streams/source witnesses are not additive votes. The **233
parser-candidate / 2,626 text-negative** metrics retain their parser meaning;
the three visual misses are additional coverage debt.

No inventory `ocrVisualQualityCertified` flag is promoted. The 192-original
scoped review is complete; ten originals retain quality holds and **55 OCR
originals from 2023/2024 were outside this visual review**. Date/year/attendance
conflicts, cross-original aliases, duplicated Education Finance Clerk text, the
unparseable May 19, 2022 Finance PDF, six missing-Minutes dates (**1,586/1,592**
date coverage), 2021 print history and 2022 print/electronic equivalence remain
held. The all-format historical named-roll denominator is **not certified**.
No floor, serving model, forecast, weights, training, frozen evaluation, Vercel
or scheduler change occurred. No offices were contacted; no manual audio review
was used. **#864 remains OPEN.**

## October 23: explicit yay/Absence labels — production verified and held occurrences classified

**Before renewal, 2022–2025 Minnesota Senate committee production: 203 events / 1,779 explicitly named choices.** This pass added **one event / thirteen choices**, with **zero classification corrections**. All **202 previous events and 1,766 previous choices are unchanged**. Cumulatively since the original 183 / 1,326 population baseline, this is **+20 events / +453 choices / ten classification corrections**. #864 remains **OPEN**.

| Year | Events before → after this pass | Named choices before → after |
| --- | ---: | ---: |
| 2022 | 38 → 38 | 259 → 259 |
| 2023 | 53 → 54 | 456 → 469 |
| 2024 | 58 → 58 | 512 → 512 |
| 2025 | 53 → 53 | 539 → 539 |
| **Total** | **202 → 203** | **1,766 → 1,779** |

[PR #1566](https://github.com/killjoy00/votepredict/pull/1566), reviewed main `f543c216c964bced601e8d978384f6c4bff5616b`, recognizes the original explicit affirmative labels **yay/yays** and the excluded **Absence** status. It does not infer a vote from attendance, Pass, absence or a tally. The source must still print one complete distinct question, contiguous named sides, an agreeing tally and an unambiguous outcome, with full historical identities and active session/service bounds.

The separately authenticated missing question is **March 7, 2023 Elections, SF2051 A2**, explicitly failed **5–8**, with thirteen printed named choices and a separate excluded Pass. Its [fixed original plan](source-proof/senate-864-population-explicit-label-repair-plan.json) pins the Clerk URL/text SHA and entire question key. The same label correction makes five additional original-source witnesses readable, but four keys were already proven from other originals: January 17 SF26 and the April 3 SF1636 A25, A28 and final recommendation. The three SF1636 questions already have exact Clerk events and choices; **no duplicate events or choices were inserted for those PDF witnesses**. Source occurrences are not additive votes.

**Protected execution:** [39967681431](https://github.com/killjoy00/votepredict/actions/runs/39967681431), independent gate `120461736077`, production job `120463414111`, succeeded. Both reviewed-head and reviewed-main checks passed **2,468 standard checks / 60 focused tests**, zero failures or skips, fresh official-source authentication and a clean production-dependency audit. The actual disposable PostgreSQL test inserted one event / thirteen choices, preserved unrelated accepted data, and executed a second zero-write run. The first PR attempt correctly failed before production because its disposable fixture placed memberships from multiple sessions into one session; the corrected fixture uses the actual 2023–24 membership cohort. No production guard was weakened.

The protected writer reauthenticated the source before bounded verified `REPEATABLE READ READ ONLY` / explicit `ROLLBACK` preflight, schema-ledger validation and bounded `SERIALIZABLE` writes. Independent post-write readback verifies the exact question and all thirteen sides, old-record preservation and **zero-write replay**. The [permanent production receipt](source-proof/senate-864-explicit-labels-production-20261023.json) preserves main/run/job identifiers and artifact `12508111274`, `senate864-population-explicit-label-production-verified`, ZIP SHA256 `9c3ab52ae880dae081ac44d00cadf91d8e4fa172b7d9290b44b28eb89fe9e9ff`.

The separate [Neon connector readback](source-proof/senate-864-explicit-labels-independent-readback-20261023.json), **2026-10-23T14:18:40.047Z**, independently compares every named side, all earlier records and all **35** committee/year groups. New event `8cbaa9e2-865d-4610-8430-76f91a9c9224` was created **2026-10-23 14:18:15.548099+00**. Only 2023 Elections changes: **15 / 199 → 16 / 212**. A second bounded verified READ ONLY / explicit ROLLBACK scope query at **2026-10-23T14:19:15.677Z** confirms all **203 / 1,779** are **us-mn / senate**.

**Population parity:** [PR #1567](https://github.com/killjoy00/votepredict/pull/1567), main `1ba274ff30dad05bb7e3a99626ab06e5ca8c29a0`, preserves every earlier dated report and publishes distinct explicit-label filenames. Protected READ ONLY run [39968666228](https://github.com/killjoy00/votepredict/actions/runs/39968666228) independently reauthenticates candidate originals and checks the expanded cohort; its fresh readback is **2026-10-23T14:24:01.996Z**, with **zero production writes**. The strict subset is **34/34 questions and 454/454 choices exact** (33 same-source exact plus the prior independently verified alternate-source A35). Immediately before this pass, the same expanded cohort had **33/34 questions / 441/454 choices**. The dated paired `before` matrix instead reconstructs the original 183 / 1,326 baseline across all population passes; those columns must not be confused with this pass's immediate before state.

The new [original registry](source-proof/senate-864-population-original-registry-20261023-explicit-labels.json), [full inventory and complete candidate texts](source-proof/senate-864-population-original-inventory-20261023-explicit-labels.json), [summary](source-proof/senate-864-population-summary-20261023-explicit-labels.json), [before matrix](source-proof/senate-864-population-committee-before-20261023-explicit-labels.csv), [after matrix](source-proof/senate-864-population-committee-after-20261023-explicit-labels.csv), and [publication/file-hash receipt](source-proof/senate-864-explicit-labels-publication-20261023.json) are appendices of this ledger. Public-report review verifies all **233** complete candidate text SHA256s, both **111-row** matrices and preservation of every earlier strict question/choice fingerprint. The [local all-text census](source-proof/senate-864-explicit-labels-source-census-20261023.json) checks all **2,859** readable acquired texts against their registered SHA256s and finds no new row-candidate original outside the existing 233. That receipt is explicitly local source analysis, not a claimed protected Actions acquisition or production result.

**Remaining holds:** the [reproducible triage](source-proof/senate-864-held-row-triage-20261023.json) examines all 233 candidate originals, preserves every previously proven passage, and reduces held parser occurrences **56 → 43** (**31 in 2023 / 12 in 2024**). This includes duplicate PDF/Clerk originals and fragmentation collapsing inside still-held questions; it is **not thirteen recovered votes**. Each remaining occurrence carries source URL/SHA, text SHA, source offset, complete extracted motion context, all overlapping reasons and a concrete reopening condition. The following primary categories use a fixed precedence and are mutually exclusive; the underlying reasons overlap.

| Primary cause | Occurrences before → after | Reopening evidence |
| --- | ---: | --- |
| Question identity, oral/renewed/withdrawn or contradictory association | 16 → 15 | An authenticated complete distinct parliamentary question, exact named sides and outcome, plus a separately validated reusable extractor |
| Incomplete named rows or missing/disagreeing printed tally | 25 → 13 | A complete authenticated contiguous list and agreeing printed tally for the exact question |
| Missing or ambiguous printed outcome | 8 → 8 | An explicit result uniquely bound to the complete question and printed sides |
| Nonbill question | 7 → 7 | Validated nonbill identity/storage semantics, complete sides, tally and explicit outcome; no nearby bill assignment |
| **Total** | **56 → 43** | **No slate/tally inference or speculative reconstruction** |

Coverage gaps remain concrete. The source population is unchanged at **2,860 originals / 2,859 readable / 233 named-candidate originals / 2,626 text-negative originals / one acquired unparseable Finance PDF**. The **247 OCR originals remain visually uncertified**: **136 in 2022, 24 in 2023, 31 in 2024 and 56 in 2025**. Strict coverage is now 18 questions / 239 choices in 2023 and 16 / 215 in 2024; zero strict denominators for 2022/2025 do not certify no historical votes. The six missing-Minutes dates, **1,586/1,592 meeting-date coverage**, SF2270/SF1894 cross-original aliases, source date/attendance conflicts, duplicated Education Finance Clerk body, unresolved 2021 print history and 2022 print/electronic equivalence all remain held. Repeating previously failed endpoints is not proposed as progress.

**Bounded pass complete:** one demonstrated reusable label defect is repaired through production and full population parity; the remaining cases require new exact evidence or a separately validated question extractor. The complete all-format historical named-roll denominator is **not certified**. No accepted Senate floor, serving model, forecast, weights, training, frozen evaluation, Vercel or scheduler change is part of this work. No offices were contacted and no manual audio review was used. **#864 remains OPEN.**

## October 22 continuation (October 23 UTC): complete row recovery — production verified

**Before the explicit-label pass: 202 events / 1,766 explicitly named choices.** This continuation added **three events and 122 choices**, corrected **five classifications**, and preserved all **six existing target event IDs**. The cumulative improvement since the original 183-event / 1,326-choice baseline is **+19 events / +440 choices / ten classification corrections**. This is verified production, not an extraction estimate.

| Year | Events before → after this continuation | Choices before → after | Added events | Added choices |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 38 → 38 | 259 → 259 | 0 | 0 |
| 2023 | 50 → 53 | 416 → 456 | 3 | 40 |
| 2024 | 58 → 58 | 430 → 512 | 0 | 82 |
| 2025 | 53 → 53 | 539 → 539 | 0 | 0 |
| **Total** | **199 → 202** | **1,644 → 1,766** | **3** | **122** |

**Implemented reusable mechanism:** [PR #1563](https://github.com/killjoy00/votepredict/pull/1563), reviewed main `06e3832f982deda80eaa2db99557f4e8ee27bc0e`, recognizes contiguous rows across a *matching* previous-page footer and next-page number, complete Chair/Lead/Ranking row labels, directly coded bill/amendment actions, the unpunctuated Omnibus bill heading, and explicit YES/NO tally/outcome variants. Unexplained numeric lines, discontinuous pages and intervening motions stop the roll. Absent/Pass/N/A labels never supply YEA/NAY choices. Printed full identities and active historical service bounds remain mandatory.

| Exact original source cohort | Source-proven questions / choices | Independently verified correction |
| --- | ---: | --- |
| April 3, 2023 State and Local Government and Veterans Clerk original: SF1426 A10, A28, A21 | **3 / 40** | Three missing amendment events and all 40 printed choices added; A10 and A28 passed 8–5, A21 failed 6–8. No vote inferred for a header name absent from a particular printed roll. |
| March 21, 2024 Elections LRL PDF: SF4729 A11, A16, A22, A13, A14, A15 | **6 / 82** | Six existing IDs retained; all 82 missing choices added. A11/A16/A22/A13/A14 had wrong bill/ref/outcome classifications; A15 already had the correct classification. A22 is explicitly passed 7–6; the separate printed Pass is excluded. |

The original complete question, every printed named side and the printed result must occur uniquely inside a legacy event's authenticated source context before correcting it. A matching tally, amendment metadata, bill/date or voting slate is insufficient. Existing source documents, legacy contexts, external keys, creation timestamps, tallies and valid choices were preserved; canonical complete-question identity is added as source proof.

**Execution and independent readback:** protected [39892047202](https://github.com/killjoy00/votepredict/actions/runs/39892047202), independent gate `120213833709`, production `120214523866`, all successful. The PR and reviewed-main gates passed **2,468 standard checks / 53 focused tests**, including actual-original negative tests and disposable-Postgres recovery/preservation/replay, plus a clean production-dependency audit. The workflow reauthenticated both originals before bounded `REPEATABLE READ READ ONLY`/explicit `ROLLBACK` preflight, schema-checked `SERIALIZABLE` writes and an independent exact readback. All nine questions / 122 choices are exact, all 199 prior event IDs and 1,644 prior choices remain, and replay writes **zero**.

The [permanent production receipt](source-proof/senate-864-population-complete-production-20261023.json) preserves main/run/job IDs, the nine target IDs and timestamps, and artifact `12475287393` (`senate864-population-complete-production-verified`), ZIP SHA256 `d059516c2e215511b03896f92a43a589493031ebd7206dab7bca1f0c4a5d71ac`. A separate [Neon connector readback](source-proof/senate-864-population-complete-independent-readback-20261023.json), **2026-10-23T02:58:18.835Z**, independently compares every printed named side, all previous records and all **35** exact committee/year groups. A second verified READ ONLY scope query at **2026-10-23T02:59:52.056Z** confirms all 202 / 1,766 belong to **us-mn / senate**. Changes are confined to 2023 State and Local Government and Veterans (+3 / +40) and 2024 Elections (+0 / +82).

**Expanded coverage measurement:** the [supplemental local source census](source-proof/senate-864-population-complete-source-census-20261023.json) checked all **2,859 readable acquired texts** against their recorded SHA256s and found no newly recognized row-candidate original outside the existing 233-candidate scope. It is explicitly a local authenticated-text check, not a claimed Actions or production run. Every previously admitted strict question remains recognized.

[Reporting PR #1564](https://github.com/killjoy00/votepredict/pull/1564), main `16a2d52de4df0588f4fd81a0671b68ae94603a4d`, preserves the October 22 appendices and regenerates dated reports. Final protected bounded READ ONLY population parity is [39892647032](https://github.com/killjoy00/votepredict/actions/runs/39892647032), fresh readback **2026-10-23T03:05:03.338Z**, with **zero production writes**. It reauthenticates all 121 named/prior PDFs, all 1,379 stored Clerk hashes and the unchanged unstored Clerk body; the unchanged remaining acquisition findings retain their immutable source/text pins.

The new [original registry](source-proof/senate-864-population-original-registry-20261023.json), [full per-original inventory and complete candidate texts](source-proof/senate-864-population-original-inventory-20261023.json), [summary](source-proof/senate-864-population-summary-20261023.json), and [before](source-proof/senate-864-population-committee-before-20261023.csv) / [after](source-proof/senate-864-population-committee-after-20261023.csv) committee matrices are appendices of this maintained ledger. The [publication/file-hash receipt](source-proof/senate-864-population-report-publication-20261023.json) permanently pins all five generated files, successful gates and acquisition provenance.

**The source population remains 2,860 distinct URL/SHA originals; 2,859 are readable, 233 have named candidates, 2,626 have no named roll detected in bounded extracted text, and one acquired Finance PDF remains unparseable.** The strict subset expands from 24 questions / 319 choices to **33 questions / 441 choices**. 37 exact keys are found; the same four keys in two unresolved SF2270/SF1894 cross-original alias groups remain excluded.

| Same expanded 33-question source cohort | Before this continuation | Independently verified after |
| --- | ---: | ---: |
| Correctly represented questions | **24/33** | **33/33** |
| Choices on correctly represented questions | **319/441** | **441/441** |
| Demonstrably missing events | **3** | **0** |
| Existing questions missing choices, correct classification | **1** | **0** |
| Existing questions with classification defects and missing choices | **5** | **0** |
| Missing choices on the six existing questions | **82** | **0** |

| Year | Acquired / readable originals | Named-candidate originals | Strict questions / choices now | Correct questions before → after continuation | Correct choices before → after continuation |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 608 / 607 | 28 | 0 / 0 | 0 → 0 | 0 → 0 |
| 2023 | 933 / 933 | 73 | 17 / 226 | 14 → 17 | 186 → 226 |
| 2024 | 518 / 518 | 78 | 16 / 215 | 10 → 16 | 133 → 215 |
| 2025 | 801 / 801 | 54 | 0 / 0 | 0 → 0 | 0 → 0 |

The final state has **32 same-source exact questions plus the previously independently authenticated alternate-source A35 amendment**. The dated paired report's `before` column reconstructs the *original* 183 / 1,326 baseline across both passes; the table above instead isolates the immediately preceding 199 / 1,644 state. The original strict coverage was 1/33 questions and 14/441 choices. The cumulative strict coverage gain of 427 choices differs from 440 actual new choices because the strict cohort includes the old A35 choices and excludes the repaired thirteen-choice SF2270 question pending cross-original equivalence proof.

**Remaining holds and stopping rule:** 56 held row-candidate occurrences remain, including unresolved motion/renewal/compound associations, tally-free or incomplete lists, and source/date/attendance identity conflicts. These are source occurrences, not certified missing votes. Reopening requires either a separately validated reusable complete-question extractor or newly authenticated official evidence proving the exact question, printed named sides and outcome; matching slates/tallies or nearby bill headings are insufficient. The SF2270/SF1894 alias groups, duplicated Education Finance Clerk body, problematic 2025 Elections printed dates/attendance, acquired unparseable May 19, 2022 Finance PDF and visually uncertified OCR/text negatives remain held.

The six missing-Minutes dates and **1,586/1,592 meeting-date coverage**, unresolved 2021 print history and 2022 print/electronic equivalence are unchanged. The complete all-format historical named-roll denominator is **not certified**; zero strict-row denominators for 2022 or 2025 do not mean no committee votes. The admitted reusable category is completed through production and expanded population parity. Other cases remain evidence/extractor work, with no speculative bill-by-bill reconstruction.

No accepted Senate floor, serving model, forecast, weights, training, frozen evaluation, Vercel or scheduler change is part of this work. **#864 remains OPEN.**

## October 22: population original inventory and reusable repairs — production verified

**Previous population pass improvement: +16 events, +318 explicit named choices, and
five source-proven classification/bill corrections.** All eight pre-existing
target event IDs were preserved. The original **183 events / 1,326 choices**
became **199 events / 1,644 choices**; this is an actual protected production
result, not a source-plan estimate.

| Calendar year | Stored events before → after | Stored named choices before → after | New events | New choices | Classification corrections |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 38 → 38 | 259 → 259 | 0 | 0 | 0 |
| 2023 | 36 → 50 | 231 → 416 | 14 | 185 | 0 |
| 2024 | 56 → 58 | 297 → 430 | 2 | 133 | 5 |
| 2025 | 53 → 53 | 539 → 539 | 0 | 0 | 0 |
| **2022–2025** | **183 → 199** | **1,326 → 1,644** | **16** | **318** | **5** |

Three small reviewed repairs reused the generic original-question extractor
and conservative historical membership matcher:

| Reviewed PR / main commit | Reusable correction and exact bounded outcome | Protected production run / jobs | Durable receipt |
| --- | --- | --- | --- |
| [#1546](https://github.com/killjoy00/votepredict/pull/1546), `7e4489eab64d282ff996c7dc43c985a051309bd4` | Explicit individually labeled row format omitted by the old parser: ten Clerk originals, 14 new questions / 181 choices | [39849422268](https://github.com/killjoy00/votepredict/actions/runs/39849422268); source gate 120071292742; production 120072809843 | [First repair](source-proof/senate-864-population-row-production-20261022.json) |
| [#1548](https://github.com/killjoy00/votepredict/pull/1548), `05d215ae318d83d5af00a29b5091bbeb83384aa1` | Wrapped full names and legacy forward-context association: five PDFs, nine questions / 123 missing choices; eight event IDs retained, five classifications corrected, one new event | [39853048276](https://github.com/killjoy00/votepredict/actions/runs/39853048276); source gate 120083988069; production 120084947774 | [Wrapped originals](source-proof/senate-864-population-wrapped-production-20261022.json) |
| [#1552](https://github.com/killjoy00/votepredict/pull/1552), `740f401616014443d43d3cc58c83e1c6106beb68` | Independently reverify the accepted failed SF3 A35 amendment from seven SHA-pinned PDFs before distinguishing the separate February 7, 2023 final recommendation: one new event / 14 choices | [39856488099](https://github.com/killjoy00/votepredict/actions/runs/39856488099); source gate 120095919119; production 120097392311 | [Prior-question bridge](source-proof/senate-864-population-prior-production-20261022.json) |

The wrapped-original correction independently binds an existing event only
when its stored context occurs uniquely in the authenticated original and
contains exactly one **complete question, every printed named row, and the
printed result**. Merely mentioning the question or sharing bill/date, tallies,
voting slate or paragraph ordinal is insufficient. It corrects SF3616 A4
(previously A5), SF3616 A5 (previously null bill/A6), SF3868 and SF4039 final
recommendations (previously amendments), and SF4700 A3 (previously attached to
future SF4951). The added question is SF4785 A6. No duplicate replacement
events were inserted for the eight existing questions.

The third correction does not weaken the possible-duplicate hold. The
existing A35 recovery planner must first find that independently authenticated
original question **exact in production with all 14 choices and active full
historical identities**, using the historical full-name aliases. Only that
proven different amendment can be excluded when matching the separate final
recommendation. Other uncertain alternate-original joins remain held.

Every production run passed independent original authentication, full normal
checks, focused and disposable-Postgres regression tests, and the production
dependency audit. Preflight and independent post-write transactions verified
`REPEATABLE READ READ ONLY` and explicit `ROLLBACK`. Atomic
`SERIALIZABLE` writes rechecked schema ledger and bounded source/identity
plans; every old choice and every non-target event was compared unchanged.
Eight target event IDs, original source documents, creation timestamps and
unmodified fields were preserved. All three runs verified exact named choices
and **zero-write replay**.

Independent Neon-connector readbacks confirmed the first cohort at
**2026-10-22T20:34:40.840Z**, the second at **2026-10-22T21:00:47.100Z**, and
the separate SF3 recommendation at **2026-10-22T21:25:15.269Z**. The last
independent comparison checked its literal complete source question, source
URL/SHA, 8 YEA / 6 NAY result, all fourteen named sides, and active 2023–2024
memberships. New event `bf0ca680-aac0-4997-a47f-481af526353c` was created
**2026-10-22 21:24:37.026911+00**; it remains a committee motion with null
amendment reference, passed=true and is_passage=false.

Production artifacts, also preserved as permanent JSON receipts above:

| Cohort | Actions artifact | ZIP SHA256 |
| --- | --- | --- |
| Row originals | 12456782133, senate864-population-row-production-verified | 8d3a54b8c1ec3a272e49e419ba9b3978f4118e294b8c8740e19d8cc722741ea0 |
| Wrapped originals | 12459450098, senate864-population-wrapped-production-verified | 32ff63f743ac884af7bd75f56c3205968e033a36df182492e71af41bf8ca8451 |
| Prior-question bridge | 12459957160, senate864-population-prior-production-verified | acd1d1994ac696c1d4f7c35da3bc2f56a6c8f6c8b5f3de15f51c5fc01b856f8b |

**Population inventory and reconciliation:** [PR #1553](https://github.com/killjoy00/votepredict/pull/1553)
made the full source examination reproducible; [PR #1555](https://github.com/killjoy00/votepredict/pull/1555)
corrects source-order-dependent reporting by comparing every authenticated
original for an identical complete question and named-choice fingerprint.
Distinct production event IDs across originals remain an ambiguity hold.
[PR #1556](https://github.com/killjoy00/votepredict/pull/1556) binds the unstored
Clerk page's fresh extraction to the immutable acquired text hash; its raw
HTML is unchanged. Historical crosswalk text hashes remain recorded as
provenance. [PR #1557](https://github.com/killjoy00/votepredict/pull/1557)
ensures complete extracted text is retained for legacy-only and signal-only
candidate originals as well; the public publisher verifies every such text
SHA256 before creating the report branch. The earlier parity attempt [39865482035](https://github.com/killjoy00/votepredict/actions/runs/39865482035)
stopped before reports or writes on the historical/current extractor hash
mismatch and is not accepted as a completed check.
The acquired corpus was fully examined from authenticated originals during
this session (PDF source completions **2026-10-22T20:06:56.724Z through
2026-10-22T20:28:00.852Z**). Its immutable
[compressed acquisition input](source-proof/senate-864-population-acquired-cache-20261022.json.gz)
and [reuse descriptor](source-proof/senate-864-population-prior-inventory.json)
preserve all extraction findings. Git blob SHA
`f330e19bee23c4688574d1caac585a96d3ad6e4c` and uncompressed content SHA256
`3206b8558cc7db5f8e809ce370ba4efe9e5022935dab7e85d2d037dfe582651e` pin this input. Its internal runId=0 explicitly denotes a
local source-cache scan, not a claimed Actions acquisition success; provisional
production numerators in the cache are never accepted as the final readback.

Final protected bounded READ ONLY parity is
[39868107260](https://github.com/killjoy00/votepredict/actions/runs/39868107260),
reviewed main `369c6aca2169b11e8b9b893a714803f385350ec5`. It reauthenticates every named-candidate PDF and
the seven prior-question originals, revalidates all 1,379 stored Clerk text
hashes, and independently recomputes all production numerators. The full
corpus's other extraction findings are reused by immutable SHA. It performs
**zero production writes**. Fresh readback time is **2026-10-22T22:57:47.700Z**.
The checked artifact is `12465391672` (`senate864-public-population-reports`), ZIP SHA256
`5458227c38ac6112bac9da28aa8c0b955a93bcce2b392c8afc1947bb236d80c6`; its fixed five files were published to
review branch `work/864-population-results-39868107260`, commit
`058a2dcb5e641b35b9a1279f541067c9023cb7a9`, before this ordinary report PR. The
[permanent publication and file-hash receipt](source-proof/senate-864-population-report-publication-20261022.json)
preserves every file's SHA256/Git blob identity, exact reviewed main commits
and successful gate/job identifiers. Independent report review verified all
**233 complete candidate-original texts and their hashes**, both **111-row**
committee matrices, source populations, production totals and public-data bounds. The reviewed reporting implementation passed all
2,459 standard checks, 23 focused regression/integration tests and a clean
production-dependency security audit before merge. Changed OCR text is preserved as explicit
extraction debt with both text hashes; changed PDF bytes or embedded-text
drift fail verification. The redundant all-PDF refetch
[39857810406](https://github.com/killjoy00/votepredict/actions/runs/39857810406)
is not counted as completed production or parity evidence.

The [original URL/SHA registry](source-proof/senate-864-population-original-registry-20261022.json),
[per-original candidate and question evidence](source-proof/senate-864-population-original-inventory-20261022.json),
[paired summary](source-proof/senate-864-population-summary-20261022.json), and
[before](source-proof/senate-864-population-committee-before-20261022.csv) /
[after](source-proof/senate-864-population-committee-after-20261022.csv)
year/committee matrices are appendices of this maintained ledger. They contain
every acquired original's scope, exact fingerprints, extraction result, all
recognizer streams and held row questions. All named-candidate originals retain their complete extracted text, while
uncertified supplemental contexts also retain literal snippets, offsets and
hashes without promoting them to distinct votes. Exact committee labels are retained; no unproved committee
alias joins are inferred. A separate
[independent committee readback](source-proof/senate-864-population-independent-committee-readback-20261022.json)
checks all 34 materialized year/committee groups and confirms that all 199
events / 1,644 choices belong to **us-mn / senate**.

**Acquired population: 2,860 distinct URL/SHA originals** — 1,452 linked LRL
PDFs, 28 supplementary authenticated LRL PDFs, 1,379 stored Clerk text
originals, and one authenticated unstored Clerk body. All **2,859 readable originals** were examined (**1,479 PDFs / 1,380 Clerk bodies**); the acquired May 19, 2022 Finance PDF remains unparseable. **233 originals have named candidates** and **2,626 have no named roll detected in bounded extracted text**, which is not a visually certified absence. The overlapping streams contain **415 raw-prose observations**, **353 supplemental-label observations**, and **64 held row occurrences**; per-original detector maxima total **574 candidate occurrences / 5,576 choice occurrences**, not distinct votes. **247 originals rely on visually uncertified OCR** and **284 require question or extraction review**. Fresh parity authenticated **121 named/prior-question PDFs**, checked all **1,379 stored Clerk hashes** and the unchanged unstored Clerk HTML, and found **zero changed OCR extractions**.

| Year | Originals (PDF / Clerk) | Readable | Named-candidate originals | Bounded text negatives | Strict questions / choices | Correct questions before → after | Correct choices before → after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2022 | 608 (328 / 280) | 607 | 28 | 579 | 0 / 0 | 0 → 0 | 0 → 0 |
| 2023 | 933 (462 / 471) | 933 | 73 | 860 | 14 / 186 | 1 → 14 | 14 → 186 |
| 2024 | 518 (271 / 247) | 518 | 78 | 440 | 10 / 133 | 0 → 10 | 0 → 133 |
| 2025 | 801 (419 / 382) | 801 | 54 | 747 | 0 / 0 | 0 → 0 | 0 → 0 |

**Valid strict question denominator:** 28 exact row-question keys are found.
Four keys in two cross-original wording/committee-alias groups are not
independently certified distinct or equivalent and are excluded from the
**24 distinct questions / 319 explicit choices** denominator. These groups are
March 9, 2023 Elections SF2270 and March 3, 2025 Veterans Subcommittee SF1894.
Neither unmatched source occurrences nor detector totals are additional
certified parliamentary questions.

| Same strict source cohort | Before this pass | Independently verified after |
| --- | ---: | ---: |
| Correctly represented distinct questions | **1/24** | **24/24** |
| Choices on correctly represented questions | **14/319** | **319/319** |
| Same-source exact questions | 0 | **23** |
| Independently verified alternate-source question | **1** | **1** |
| Demonstrably missing events | **15** | **0** |
| Existing questions missing named choices, correct classification | **3** | **0** |
| Existing questions with classification defects and missing choices | **5** | **0** |
| Missing choices on those eight existing questions | **109** | **0** |

The alternate-source question is the previously accepted A35 amendment.
This strict source cohort includes its fourteen existing choices and excludes
the repaired SF2270 Clerk question's thirteen choices pending cross-original
wording proof. Therefore the strict coverage gain of **305 choices** differs
from the actual production gain of **318 new choices**. Both measures are
reported; they are not interchangeable denominators.

**Ranked systematic mechanisms and actual recoveries:** individually labeled
rows omitted by the legacy parser had the highest proven event yield (14 new
events / 181 choices). Wrapped full-name headers and forward-looking bill/ref
association produced the next proven defect class (eight existing questions
with 109 missing choices, five wrong classifications, plus one absent
14-choice question). Independently authenticating an already accepted
different question then safely released one further 14-choice recommendation.
Regression tests cover the actual original formats, compound/withdrawn and
repeated motions, contradictory names and outcomes, duplicate events,
identical slates/tallies, later bill/ref contamination, source-order
independence, active historical identities and zero-write replay. No isolated
ambiguous bill was manually reconstructed.

**Remaining evidence holds and reopening proof:**

| Hold | Specific proof required before promotion |
| --- | --- |
| Other named formats and **64 held row-candidate occurrences** | A reusable extractor must bind one complete original question, bill/ref, explicit named sides and printed outcome; unrelated result restatements, withdrawals and repeated questions must remain separate. These are candidate occurrences, not 64 certified absent votes. |
| SF2270 / SF1894 cross-original aliases | Independent official evidence of exact question equivalence or distinctness, with committee/date identity; shared tallies or slates are insufficient. |
| PDF printed date/weekday and absentee conflicts | An authenticated corrected original or independent official record resolving the contradiction. In particular, the 2025 Elections February 13 and March 27 originals remain held. |
| Identical Clerk body on 2023 Education Finance March 15 and March 29 | Authenticated date-correct originals or an official correction establishing which hearing each body documents. |
| Acquired May 19, 2022 Finance PDF is unparseable | A readable, authenticated extraction with separately verified printed question and named choices; extraction failure is not evidence of no votes. |
| Bounded text negatives and OCR quality | Sufficient extraction/visual verification to certify absence of a named roll in the entire original; parser silence alone is insufficient. |
| Six absent Minutes and print/electronic boundaries | New authenticated written originals or independently verified collection equivalence. Existing meeting/agenda coverage does not supply a roll denominator. |

The complete **all-format original named-roll denominator remains uncertified**.
The per-year zero strict-row denominators for 2022 and 2025 do not mean those
years had no named committee votes, and do not invalidate their previously
accepted stored choices. The stopping rule is met for the source-proven
reusable categories above; remaining identity questions require new evidence
or a separately validated extraction rule.


The six exact missing-Minutes dates remain: **2022-03-15 Housing Finance and
Policy; 2022-08-10 and 2022-10-03 Environment and Natural Resources Finance;
2023-04-13 and 2024-05-16 Environment, Climate, and Legacy; 2025-05-12
Subcommittee on Committees**. **1,586/1,592** covered indexed meeting dates
are not a recorded-vote denominator. **2021 print scope and 2022
print/electronic equivalence remain unresolved.**

Hearing-day event/available-on dates and same-day exclusion are preserved.
Only explicitly printed YEA/NAY choices were materialized; attendance,
voice/unanimous/results-only motions and aggregate counts supplied no named
choices. No accepted Senate floor, serving model, weight, forecast, training,
frozen evaluation, Vercel or scheduler change is part of this work.
**#864 remains OPEN.**

## October 22 UTC: nine source-pinned 2025 Elections rolls inserted and independently verified

**Completed bounded correction; not a statewide completion certificate.** This engagement
was limited to **four already acquired official 2025 Elections Minutes** dated February 6,
February 11, March 25, and April 8, 2025. The original-PDF bytes and extracted-text
SHA256s were independently reauthenticated against the existing immutable source-proof
ledger, and the live Neon primary already contained **exactly one matching original
source-document row for each of the four URLs/SHA256s**. The independent source and
historical-roster evidence is in
[`senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json`](source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json),
the [eight-motion original-context checkpoint](source-proof/senate-2025-elections-eight-original-motion-context-success-ledger.json)
and the existing official 94th-Session Elections membership review.

**Exact selected supplemental-subset denominator:** 4 authenticated original Minutes;
**13 preidentified candidate explicit named YEA/NAY passages / 143 printed individual
YEA/NAY choices**. This is explicitly *not* the exhaustive named-roll denominator of
those four complete Minutes or of the wider 2021–2025 Senate source corpus.
In particular, separately examined April 8 A10 (7/3/1), A11 (10/0/1) and the other
10/0/1 result are not silently counted, inferred, or represented as newly complete.

The source-only verifier isolated **nine uniquely identified parliamentary questions,
with exactly 99 printed YEA/NAY choices**: February 6 SF529 Lucero A1 amendment,
Limmer table motion, and Boldon recommendation; February 11 SF569 recommendation
and Rules referral; March 25 SF1812 as-amended Judiciary referral; April 8 SF2384
A20, A32, A21 and A19 amendments. Failed amendments and distinct recommendations
remain separate events; no source choice was inferred from opening attendance,
slate similarity, aggregate totals or adjacently printed formal results.
All printed names were cross-checked to full historical identities and active
2025–2026 Senate memberships, rather than surname-only matches.

**Exact source-to-production correction result, from successful protected
[#39705363063](https://github.com/killjoy00/votepredict/actions/runs/39705363063),
job `119585092385` (2026-10-22T01:27:32.307Z):**

| Frozen selected cohort | Previously stored / preflight | Newly inserted or corrected | Independently verified after |
| --- | ---: | ---: | ---: |
| Authenticated original Minutes | 4 matched source documents | 0 new documents | 4 original matches, 1 each |
| Source-proven independently classified questions (9) | 0 events | **9 new events**; 0 event corrections | **9/9 exact** |
| Printed named choices on those nine questions (99) | 0 individual choices | **99 new choices** | **99/99 exact** |
| Remaining ambiguous supplemental questions (4) | Not accepted as recoverable | **0** | 4 source holds / 44 YEA-NAY tokens, no imputation |
| Idempotent replay of the verified nine | N/A | **0 additional writes** | Confirmed 0 |

The production runner independently confirmed **4 source rows, 0 old matching
committee events, 0 old matching named-choice rows, 70 historical Senate memberships
in its bounded 2025–2026 roster snapshot, and four exact bill identities** before
applying the guarded plans. The **four held source questions** are not four additional
proven absent events: two February 6 A2 passages cannot be uniquely distinguished
under repeated wording/slates (22 printed choices), the February 11 Mathews A2 passage
has an original SF0529 versus official SF0828 bill-reference conflict (11), and the
April 8 procedural/result passage combines SF2384 with SF3096 and does not have
a independently safe target question association (11). There were **zero live
identity holds among the nine separately verified motions**.

| Year | Events before | Events after | Choices before | Choices after |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 38 | 38 | 259 | 259 |
| 2023 | 35 | 35 | 217 | 217 |
| 2024 | 56 | 56 | 297 | 297 |
| **2025** | **44** | **53** | **440** | **539** |
| **Total of returned 2022–2025 committee rows** | **173** | **182** | **1,213** | **1,312** |

The returned protected census contained no 2021 committee row; this is **not**
evidence that no 2021 committee vote exists. Named-availability-flagged 2025
events increased **40 → 49**, and 2025 hearing-date-timing-marked events
increased **16 → 25**. Each new event has official-hearing
`eventOccurredOn`/`availableOn` on the hearing date and `sameDayEligible=false`.
The source-proven addition preserved **every prior valid event ID and choice**
and changed no Senate floor votes, training, immutable freezes, serving,
forecasting, model weights, Vercel deployment or schedulers.

**Implementation / operational receipts:** [PR #1526](https://github.com/killjoy00/votepredict/pull/1526)
merged at `b5363349b616b7e96988419051d28c93d4aba973`, introducing an
idempotent, bounded original-source/question reconciliation with explicit
historical membership, amendment and existing-record duplicate guards; PR
[#1528](https://github.com/killjoy00/votepredict/pull/1528) merged at
`5e7b240426d4486fd049131b77d748254aa8f784` to give safe bounded
diagnostics; PR [#1529](https://github.com/killjoy00/votepredict/pull/1529)
merged at **`615c2f83433a27231aa0f6fa213eab4347406e80`** to fix the
**demonstrated PostgreSQL `08P01` bind-arity defect** in the new preflight
(a two-parameter source-document query had been supplied three date/URL/SHA
arguments). The fix has a regression test validating all three query shapes.
Earlier protected executions [#39703572710](https://github.com/killjoy00/votepredict/actions/runs/39703572710)
and [#39704484541](https://github.com/killjoy00/votepredict/actions/runs/39704484541)
**failed closed** during preflight; neither was falsely counted as a completed
source-to-production repair. The final full CI and SHA-source verification,
followed by protected production write/read-back, both **succeeded** on the
reviewed `615c2f8...` main SHA in [#39705363063](https://github.com/killjoy00/votepredict/actions/runs/39705363063)
(independent-test job `119584019977`, production job `119585092385`,
artifact `senate864-elections-original-production-verified`, ID
`12394343569`). Production reads used bounded `REPEATABLE READ READ ONLY`
with explicit `ROLLBACK` both before and after a revalidated
`SERIALIZABLE` write, with schema/primary identity checks. The subsequent
independent read-back verified all nine questions and 99 named choices, with
**zero** remaining writes on replay.

**Systematic limitation:** The verified omissions demonstrate that matching
meeting-date Minutes or the availability of an authenticated source PDF does
not establish materialization of its individual explicit named motions. This
bounded repair adds a reusable fail-closed question-specific reconciliation;
it does **not** claim a population-wide reusable parsing fix or extrapolate
the four-source yield to all 1,586 authenticated meeting dates. The next
cohort, if pursued, must independently inventory original named questions and
their live event/choice parity, without confusing the 1,586/1,592
meeting-date availability observation with vote-level coverage. Issue #864
remains **OPEN** for the precise held original questions and wider
uncertified motion population.

## October 20 UTC: three bounded production changes executed and verified

**Complete in the authorized scope.** [#1489](https://github.com/killjoy00/votepredict/pull/1489)
implemented the guarded patch; [#1490](https://github.com/killjoy00/votepredict/pull/1490)
corrected its handling of existing negative parser results. Actual production execution
used reviewed main **`b42133d96a14a8be618a1a6e0a8cfb8b34b1c085`**, protected
[39369127511](https://github.com/killjoy00/votepredict/actions/runs/39369127511), job
**118453549297**, independently read back at **2026-10-20T04:25:45.213Z**.

| Family / exact source scope | Committed change | Independent stored read-back |
|---|---|---|
| Four already acquired Minutes: Judiciary 2024-04-19; Human Services 2025-03-17; Education Finance 2025-04-10; Taxes 2025-04-23 | 12 named rolls / 144 explicit choices added; seven existing event field/text/reference repairs | All 19 source rolls / 211 choices exact; original seven IDs/keys and all 67 original choice rows unchanged |
| Jeremy Miller / Enterprise Minnesota Q&A / archive observation year 2022 | Three non-serving attributable literal fragments appended | One article / one person / three fragments; two original HTML versions authenticated, with the earliest copy supporting the stored fragments; no duplicate statement events |
| Miller registration 16891 / 2024 year-end original `16891:24:pcc:YE:0:0` | 25 existing unmatched parser-result records upgraded to exact mechanical containment: 18 contributions (9 IND / 9 PCF schedule) and seven campaign expenditures; zero new link records | 25 exact links / 28 total link records, three unmatched purpose holds unchanged; all 28 evidence records and eligibility claims unchanged |

The actual read-only preflight found **28 unmatched link records / zero exact links**.
The first protected #1489 run, [39368167690](https://github.com/killjoy00/votepredict/actions/runs/39368167690),
job 118450569932, stopped at `Finance link source conflict` before COMMIT; it committed
no data changes. Zero exact links had incorrectly been treated as zero link records.
V2 handles well-formed negative parser results while preserving every source comparator,
the three held records (including timestamps), and any already certified exact records.
Contradictory exact claims still stop execution. This was a persistence-plan defect,
not new evidence against the transactions or a reason to relax matching.

The writer reauthenticated the same seven bodies before discovering existing protected
primary-database credentials. The schema ledger and bounded pre/post snapshots were
verified inside **REPEATABLE READ READ ONLY** transactions with explicit **ROLLBACK**.
A locked **SERIALIZABLE** state fingerprint guarded the single atomic transaction;
in-transaction validation and independent post-commit read-back verify every new literal,
choice side, historical person/session, report entry, source clock and non-serving flag.
**Idempotent replay would write zero records.** No floor, serving, model, training, freeze,
scheduler or Vercel changes occurred.

All 19 selected committee motions follow hearing-day availability and next-day eligibility.
A13 and the distinct oral amendment to A14 remain separate from the SF5337 recommendation;
the SF2149 A1 outcome is now explicitly passed; divided A16 covers only lines 1.21–1.23;
A22 remains withdrawn; failed Taxes A49 remains separate from the passed recommendation.
No attendance, count-only, voice or formal-result restatement supplied individual choices.
Current materialized committee totals are **173 events / 1,213 explicit choices**:
2022 **38/259**, 2023 **35/217**, 2024 **56/297**, 2025 **44/440**. These are stored
units, not a certified all-motion denominator; written-date coverage remains 1,586/1,592.

Media retains the exact observation **2022-10-05T01:59:37Z**. The displayed 2021-11-08
date is not authenticated 2021 publication. Each fragment is `direct_statement`,
`reputable_secondary`, zero-weight, mechanically non-actionable, research-only and not
as-of/serving eligible; the source copies do not create six statement events.

Finance entry coordinates are dated line numbers in fresh `pdftotext -layout` output of
the exact authenticated six-page body, under extractor/matcher version
`miller16891-2024-printed-layout-full-comparators-v1`. Each appended raw block includes
its own printed counterparty header, dated row, amount columns and full continuation
purpose. Existing v1 captures/pages/entries remain immutable. Full-purpose mismatches
stay unmatched; mechanical containment does not establish historical first-public proof.
The accepted practical estimate 2025-02-01 remains separate from UNKNOWN publication
chronology, and the 28 legacy eligibility claims were not rewritten.

Durable appendices: [production aggregate receipt](source-proof/senate-864-three-bounded-production-verified-20261020.json),
[fresh seven-body source receipt](source-proof/senate-864-three-bounded-production-originals-20261020.json),
and the unchanged [19-question attestation](../../tests/fixtures/senate-864-four-original-questions.json),
SHA256 `4b10a95ef840b8b7e15c0aefe78e5262e3691b3b305d3decfdd5cceabb922a24`.
Exact-head #1490 CI **39368831166** and independent **39368831180**, merged-main CI
**39369127418** and independent job **118452744192** all passed. Validation includes
**2,297 repository tests / 17 focused checks**, including an actual migrated PostgreSQL
transaction starting with 28 unmatched results, 25 upgrades / three preserved holds,
committee/media inserts, immutable preservation, concurrency rejection and zero-write replay.

**#864 remains OPEN.** These three implementation items are complete; unknown broader
denominators, six written-source gaps and other source-to-stored discrepancies still
prevent historical completeness. Stable holds below require specific new evidence.

## October 21, 2026: specific remaining A–D holds — bounded final disposition

**Method and result.** Revisited current main, `AGENTS.md`, #864 and comments, relevant merged PRs, original-source manifests, independent source checks and successful protected execution receipts. None of the bounded cases supplied a *newly* authenticated original or reproducible earlier source-to-database defect. **Zero new source-proven writes, zero new database queries and zero new historical eligibility changes.** No additional protected writer was warranted. The [October 20 independently verified production run](source-proof/senate-864-three-bounded-production-verified-20261020.json) remains authoritative. That execution's read-only checks used `REPEATABLE READ READ ONLY` with explicit `ROLLBACK`. No unavailable Clerk route was retried, no alternative proximity parser was run, and no broad website/media crawl was started.

### A. Six original committee Minutes gaps — six separate stable evidence holds

Evidence: [original indexed six-date/source manifest](source-proof/senate-864-six-minutes-recheck-20261019.json) and [whole-response/Clerk/calendar recheck](source-proof/senate-864-six-exact-source-recheck-v2.json). Six LRL index originals remain authenticated but link no written Minutes. Five independently matched Clerk hearing routes returned HTTP 503 on the earlier check; repeating them without evidence of a fix adds nothing.

| Committee and exact date | Authenticated official identity | Disposition / evidence to reopen |
|---|---|---|
| Housing Finance and Policy — **2022-03-15** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=23832-0&date=2022-03-15&year=2022), Clerk hearing 16859, session 92 | **Stable hold:** this hearing's written original with printed question/choice evidence, not SF3259 agenda/letters. |
| Environment and Natural Resources Finance — **2022-08-10** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=23835-0&date=2022-08-10&year=2022), Clerk hearing 17254, session 92 | **Stable hold:** exact written Minutes; agenda and resource reports are not named votes. |
| Environment and Natural Resources Finance — **2022-10-03** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=23835-0&date=2022-10-03&year=2022), Clerk hearing 17261, session 92 | **Stable hold:** exact written Minutes; presentations/letters do not supply sides. |
| Environment, Climate, and Legacy — **2023-04-13** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=26147-0&date=2023-04-13&year=2023), Clerk hearing 17971, session 93 | **Stable hold:** exact written Minutes; SF2062 materials/attendance are insufficient. |
| Environment, Climate, and Legacy — **2024-05-16** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=26147-0&date=2024-05-16&year=2024) and [official date calendar](https://www.leg.mn.gov/cal?d1=05/16/2024), **no matched standing-committee hearing ID** | **Stable identity and written-source hold:** independently establish this standing-committee hearing *and* matching written Minutes. HF3911 conference materials are **excluded as a substitute**, not grounds to remove the indexed date. |
| Rules and Administration, Subcommittee on Committees — **2025-05-12** | [LRL exact day](https://www.lrl.mn.gov/minutes/comm?commid=26198-21261&date=2025-05-12&year=2025), Clerk hearing 19475, session 94 | **Stable hold:** exact subcommittee's written Minutes, not unrelated Rules meeting. |

**Coverage remains 1,586/1,592 indexed dates.** These results do not prove originals or votes nonexistent. Only a newly authentic official same-hearing written body or specific demonstrated former URL/identity defect justifies reopening. Individually named roll calls would still require distinct printed questions, hearing-day member identity and exact stored-side reconciliation; no attendance, count-only, voice or same-day substituted material supplies members' sides.

### B. Six PAC comparator-held sets — source-original classification, not ingestion loss

[Protected raw-original audit](source-proof/senate-864-donor-six-raw-clarification.json) and [independent typed comparator implementation](../../src/evidence/senate-864-pac-comparator-source.mjs) already independently reconciled **777/777 regulator canonical keys, 780 source copies and zero field mismatches**. Of the original 23 comparator-held candidates, **17 comparator sets are resolved/verified** *as comparisons only*, and **six separate receiving committee/year sets are stable evidence holds**. Those six share ten distinct problematic original donor rows: **four literal `Other` types and six rows with both donor name and type genuinely blank**, all ten registration fields blank. Four held sets additionally have unusable-field problems. Eight raw receipts are classed contribution and two other; the receipt label does not authenticate the entity. Aggregate receipts do not publish a row-to-six-set mapping; do not invent one.

**Each of the six remaining sets: stable evidence hold.** Every original type/name agrees with ingestion. Natural-person `Individual`/`Self` is already recognized without a PAC registration requirement; `Other` and blank classifications cannot safely be inferred. Reopen an individually keyed set only upon independently authenticated original donor name, classification, and applicable registration/nonapplicability, or a specific reproduced parsing defect. Preserve all original rows and one-to-one collision constraints. No PDF-row certification, original/amended version attachment or historical-publication/as-of promotion is warranted. The two previously comparator-complete PAC PDF candidates remain on separate printed-row-containment and exact-version-publication holds; neither was rerun.

### C. Three 2024 Miller full-purpose discrepancies — three stable original-version holds

The [source-attested six-page original](source-proof/senate-864-three-bounded-production-originals-20261020.json) is CFB registration **16891**, version **`16891:24:pcc:YE:0:0`** at [the exact CFB report URL](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=24&type=pcc&period=YE&se=0&regnum=16891&amend=0), original SHA256 **`e5d5d82d46ec7ac2c573c0cc4158541e06d2846e16573d748c0d052f7648b0a3`**. The authenticated report registry exposes one indexed version, not a proven alternative or amendment. Ten canonical expenditures agree on date, complete counterparty, paid/unpaid/total and printed `Campaign expenditure` classification; **seven** full purposes agree, and **three separate existing transaction-link rows remain unmatched** on *complete purpose*. The earlier [successful guarded writer](source-proof/senate-864-three-bounded-production-verified-20261020.json) verified **25 exact upgrades, three existing holds preserved and all 28 evidence/eligibility copies unchanged**.

**Each of the three: stable evidence hold, not proof of a false transaction.** Require independently authenticated bulk original and an exact report/amended original version that explains the *full* discrepant purpose, or a reproducible specific extraction/version association defect. Never match by date/amount proximity, abbreviated/fuzzy purpose or presumed amendment. Historical exact-version/row public-by remains **UNKNOWN**; accepted 2025-02-01 practical release estimate is not independent publication chronology. Preserve historical eligibility pending separate evidence.

### D. Named campaign-site and media source/version holds — no completed reimport

| Named original | Final disposition | New evidence required |
|---|---|---|
| **Wiger 2020 Senate-owned site** | **Stable original hold.** The [2012 Patch candidate questionnaire](https://patch.com/minnesota/oakdale/chuck-wiger-candidate-for-minnesota-senate-district-43) is **excluded as evidence of a 2020 owned website**, although it can remain a separate older publisher original. | Exact election-era candidate-owned Senate page, original bytes/indexed digest, ownership and observation clock. |
| **Tomassoni 2020 Senate-owned site** | [Two rehashed 2019 `tomassoni4senate.com` originals](../../data/evaluation/senate-864-bakk-governor-tomassoni-repurposed-site-original-disqualification-receipts-v1.json) contain unrelated receipt-template SEO and are **excluded** as candidate statements. The true Senate original is a **stable hold**. | Pre-repurposing campaign-owned page containing attributable candidate text and independently attested archive clock. |
| **Bakk 2020 Senate-owned site** | [Two 2008 `tombakk.com` whole originals](../../data/evaluation/senate-864-bakk-governor-tomassoni-repurposed-site-original-disqualification-receipts-v1.json) explicitly identify a *governor* campaign; **excluded as Senate-site originals**. True 2020 Senate original remains a **stable hold**. | Same-office Senate campaign-owned election-period page and verified original URL/digest/capture. |
| **Doron Clark Jan 2025 priorities/questionnaire** | **Previously resolved:** authenticated [2025-01-16T23:21:35Z owned priorities page](../../data/evaluation/senate-864-new-2022-25-deep-original-source-receipts-v1.json), SHA256 `59f3c0302ea2c60c059f7cd8dba90bb9fbabe87804b4efe7fda0a713ed3d1a02`; no reimport. **Stable separate PDF version hold:** current DFL Google Drive questionnaire SHA256 `20af081301bf740ff2cb9a9825985fff72110daa16c6a46356d9938e552390dc` is not proven the January 2025 version. | Dated independently authenticated original January 2025 PDF bytes/version, not merely a contemporaneously linked mutable URL. |
| **Named media clock/attribution discrepancies** | **Stable holds**: Hauschild's supposed February 2024 transcript cue first authenticated July 24, 2025; Kunesh 2023/2024 selected print versions postdate their earlier broadcast references. **Excluded as an in-office remark**: Heintzeman's April 30, 2025 story predates May 6 Senate oath. See [media original/accounting](#media-originalimportstorageexclusion-accounting-finalized-in-bounded-scope). Closed Reformer/MPR dispositions stand. | An exact original attributable passage with independently defensible observation/publication clock and verified membership; no contextual-mention inference or backdating. |

**Previously resolved and independently verified:** 1,194/1,194 itemized owned-site literals stored, 3 known-person McNutt exclusions, zero unknown people; three Miller Enterprise Minnesota literal statements stored against earliest independently authenticated **2022-10-05T01:59:37Z** observation with research-only flags. The 88 aggregate-only, nonitemized campaign research entries are not invented; wider campaign/media denominators remain unknown. No frozen website experiment, Reformer/MPR source or completed import was revisited.

### Permanence, execution and independent follow-ups

**Permanent disposition under currently authenticated evidence, not permanent nonexistence:** exclude the exact Bakk governor and Tomassoni unrelated site bodies, the 2012 Wiger publisher page as 2020 owned-site proof, and the 2024 HF3911 conference papers as standing-committee Minutes. The remaining six Minutes dates, six PAC comparison sets, three Miller purposes, Wiger/Tomassoni/Bakk authentic site gaps, Clark PDF-version clock and named media source holds are **stable until the exact new evidence above exists**. Earlier 12/144 committee, three Miller media, 25 finance and 1,194 website repairs remain **resolved and independently verified** with PR, merged SHA, test and workflow receipts in the [maintained receipt map](#merged-executed-and-verified-receipt-map). **Newly source-proven corrections awaiting execution: none.**

Distinct independently sourced obligations merit *dedicated follow-up issues only when there is a concrete evidence path*: (1) 2021 print meeting/motion denominator, 2022 print/electronic equivalence and individually anchored remaining motions; (2) legally owed CFB filing inventory, exact-version/row publication evidence and bounded legacy eligibility; (3) Wiger/Tomassoni/Bakk owned-site originals and version-specific Clark questionnaire; (4) named media source attribution and authentic historical observation. Avoid converting holds into a standing broad scraping assignment. **#864's bounded actionable source-resolvable phase is dispositioned; #864 remains OPEN under its original true-official-denominator/full source-to-stored-parity acceptance criteria.** Closure under those criteria still requires real evidence or an explicitly agreed transfer of remaining obligations, not an artificial declaration of complete history.

## Pre-production October 20 UTC: three bounded evidence-only snapshots

**Dated pre-production source/read-back snapshot; current storage is superseded by the verified production section above. This earlier pass made no database writes.**
[#1484](https://github.com/killjoy00/votepredict/pull/1484) acquired no new source cohort:
it reuses four already acquired original Minutes, two retained versions of one Enterprise
Minnesota interview, and Miller registration **16891**'s single indexed **2024 year-end
original `16891:24:pcc:YE:0:0`**. The final corrected audit is
[#1486](https://github.com/killjoy00/votepredict/pull/1486), merged
`8909582f003fe86ba3e2d8f29883d9cad6ddb27e`, executed at **2026-10-20T02:23:54.274Z** in protected
[39358291489](https://github.com/killjoy00/votepredict/actions/runs/39358291489), job **118419129381**.
The [aggregate source-to-store receipt](source-proof/senate-864-three-bounded-readback-20261020.json),
[seven-body source receipt](source-proof/senate-864-three-bounded-originals-20261020.json)
and [manually reviewed question attestation](../../tests/fixtures/senate-864-four-original-questions.json)
are appendices of this maintained ledger.

### Committee: twelve missing source questions, with all identities resolved

| Exact original | Source named rolls / printed choices | Stored events / choices |
|---|---:|---:|
| Judiciary and Public Safety, 2024-04-19 | 3 / 27 | 2 / 18 |
| Human Services, 2025-03-17 | 2 / 18 | 1 / 9 |
| Education Finance, 2025-04-10 | 10 / 130 | 1 / 13 |
| Taxes, 2025-04-23 | 4 / 36 | 3 / 27 |
| **Selected four originals only** | **19 / 211** | **7 / 67** |

All four original URL/PDF SHA identities are stored. **All 67 existing choices match the
source and historical person/session; zero unresolved joins across the 211 printed
choices.** Each of the seven stored questions has a unique source anchor. Complete question
text plus compatible bill/tally distinguishes overlapping Taxes contexts; no ordinal-key,
attendance, count-only or surname-only assignment is used. The earlier four parser gains
were candidate locators, not the full named-roll count of these originals.

The source-proven plan at that snapshot was **12 events / 144 explicit choices** from these exact sources:
the Judiciary oral amendment to A14; Human Services SF2149 A4; nine Education Finance
SF2255 rolls (A32, A10, A5, A20, A13, A24, A14, A19, recommendation to Taxes); and Taxes
SF2669's recommendation to Finance. Preserve original IDs/keys and all 67 existing choices.
Also correct the SF5337 recommendation currently classified as an amendment, SF2149 A1's
null outcome despite explicit passage, and source-proven missing bill/amendment references.
**These data repairs are not executed by this evidence-only pass.**

Education Finance's three 13–0 rolls print all thirteen names; they are not inferred from
unanimity. A16 covers divided lines 1.21–1.23 only. A22 was withdrawn; the later roll is
the recommendation. Judiciary's distinct oral roll occurred before A14 as amended was
withdrawn; Seeberger's different withdrawn oral proposal and the voice-voted oral amendment
supply no extra named votes. Taxes A49 failed; the later recommendation passed. Formal
result restatements are not additional motions. Apply the owner hearing-day availability
and next-day eligibility rule in any future guarded correction.

### Media: three source-ready fragments, no stored evidence found in the bounded query

The existing Enterprise Minnesota Q&A has three selected short literal fragments in
paragraphs explicitly labeled **Miller:** in **both** exact SHA1/SHA256-authenticated bodies.
The stable historical Jeremy Miller identity resolves uniquely. The earliest authenticated
observation is **2022-10-05T01:59:37Z**, followed by 2023-01-31T06:39:41Z. The displayed
2021-11-08 date is not independent 2021 publication proof. Two source copies do not create
six statement events. No audio review or subjective sincerity gate is required.

The exact source hashes/article URL/seed query returned **zero evidence rows**, including
zero literal direct statements or context copies for this selected article. This is a
bounded storage observation, not a claim that the statement never existed or that media
history is complete. The concrete next implementation is a bounded append of **three
non-serving literal statements** using the 2022 observation clock, the resolved stable
person and source deduplication. No import was executed here. Closed Reformer/MPR cases
and general press-release crawling remain outside this pass.

### Finance: 25 exact printed-row matches; three purpose holds and separate chronology hold

The exact six-page report registry, raw PDF body SHA and all six stored pages read back.
Its itemized denominator is **9 individual contributions + 9 committee/fund contributions
+ 10 campaign expenditures = 28 printed rows**. The NCD page has zero itemized rows;
non-itemized subtotals are not individual transactions. Independent expenditures are
outside this candidate-report scope.

| Family | Stored evidence copies | Canonical transactions | Exact unique printed-row matches | Held |
|---|---:|---:|---:|---:|
| Contributions | 18 | 18 | 18 (9 IND, 9 PCF schedule) | 0 |
| Campaign expenditures | 10 | 10 | 7 | 3 full-purpose differences |

All ten expenditures agree on date/paid amount, full counterparty and unpaid/total
columns. Their actual type **Campaign expenditure** matches the original **B1–CE Campaign
Expenditures** heading. The seven exact matches additionally pass full-purpose and
one-to-one collision checks. The three purpose differences remain **unmatched to this
exact version**, not proven invalid transactions. Reopen them only with an authenticated
original bulk row and exact report-version comparison that explains the full-purpose
difference; do not use a fuzzy/proximity fallback or change canonical records speculatively.

At that pre-production snapshot there were **zero exact links**, but **28 unmatched parser-result records**. The current production receipt above verifies 25 upgrades to exact containment and three unchanged unmatched holds. Exact-link counts and total link-record counts are distinct.

The board received stamp is **2025-01-09**, due date **2025-01-31**, statutory release
floor and accepted practical estimate **2025-02-01**. Historical exact-version public-by
proof remains **UNKNOWN**; the selected cohort has zero tracked exact-version or independent
historical bulk-row publication proofs. The source acquisition/dating subtrack stays closed.
An original/archive observation or official publication receipt for this exact version/row
is needed to reopen chronology. Containment does not authenticate historical publication.
All **28 existing legacy eligibility claims** are unchanged; missing proof is diagnostic,
not authority for an automatic historical rewrite.

### Actual validation, scope and stopping point

The final main [CI 39358291472](https://github.com/killjoy00/votepredict/actions/runs/39358291472) and
independent source job passed **2,297 repository tests and 13 focused checks**, including
all ten SELECTs on clean migrated PostgreSQL. Production reads used the existing independently
marked primary, verified **REPEATABLE READ READ ONLY**, matching schema ledger and explicit
**ROLLBACK**. Public receipts exclude private row-level identities, finance names, amounts
and keys. No database correction/import/link write, model/weight/training/freeze/floor change,
Vercel deployment or scheduler reactivation occurred.

Earlier successful audit receipts remain dated execution evidence: #1484 main
`f33545a9d3808d3a0c08e3558d861ab9ec5f2818`, run 39356274079/job 118412555964;
#1485 main `b1fbc36479aa5886e0c2cbbefcb256117fc89450`, run 39357442992/job 118416148731.
Their new-auditor cross-session identity and synthetic type-label diagnostics are superseded
by this final read-back; they were not genuine unknown-person or invalid-transaction findings.

**Next work is the bounded implementations above, not another archive/parser investigation.**
The three expense purpose differences and historical publication need the specific new
evidence stated above. Six missing written Minutes, the 2021 print denominator, 2022
print/electronic equivalence, owed-finance filing denominator and previously accepted holds
remain separately accounted below. **#864 remains OPEN under its actual acceptance criteria.**

## October 20 UTC: all 526 website metadata holds resolved and stored; donor/Minutes holds clarified

**Implemented, merged, executed and verified.** [#1481](https://github.com/killjoy00/votepredict/pull/1481),
main `be89457c87b1a7521da877eb44bb93091020b172`, corrects concrete source-field alias and
omitted-receipt joins in a separate additive planner. Retained acquisition manifests recover
exact original page locators; the final 35 excerpts require literal containment in explicitly
identified candidate-owned originals. No name-only page assignment, filename-derived clock,
new general crawl or subjective position certification was used.

All **526 previously held excerpts** independently match original SHA256, indexed SHA1,
exact original URL/archive observation and visible literal text. The
[durable public source map](source-proof/senate-864-website-recovered-source-map.json) records
54 added unique bodies, the 526 original-ledger bindings and pinned acquisition artifacts.
Existing source ledgers retain the exact literal texts. This source map is an appendix of
this reconciliation, not a competing census. The existing 668-record planner and both
immutable experiment protocols are preserved explicitly; their dated hold counts below
are superseded for current inventory accounting.

[#1482](https://github.com/killjoy00/votepredict/pull/1482), main
`422646d3bf8a683bef073c67d9a3a241e72859a7`, reuses the existing durable writer after
independent same-commit source verification and a digest-bound same-run artifact.
Protected [39349395107](https://github.com/killjoy00/votepredict/actions/runs/39349395107),
job `118390051620`, **inserted 526 / reused 0** and exactly read back **1,194/1,194**
literals, stable identities, original URLs/hashes, archive observations/CDX and non-serving
flags. All prior 668 records remain exact. **Replay would insert 0.** Before/after audits
verified schema checksums, REPEATABLE READ READ ONLY and explicit ROLLBACK.
[Executed aggregate receipt](source-proof/senate-864-website526-executed.json).

Current itemized inventory: **1,197 = 1,194 stored source-supported excerpts + 3 known-person
McNutt scope exclusions**; **0 source-metadata holds / 0 unknown people**. These are
**92 people / 123 unique original bodies / 1,194 distinct person-literal pairs**. Excerpts
and overlapping text are not independent pages, people or predictive samples. Archive
observation years: **373 before 2021; 51 in 2021; 723 in 2022; 0 in 2023; 18 in 2024;
29 in 2025**. This dates observable copies, not first authorship, and does not certify all
owned pages or usable pre-vote features for every senator. The wider denominator remains
UNKNOWN. The 88 aggregate-only, nonmaterialized items were not invented. No outcomes were
read or models fitted in this continuation; the already examined frozen v2 stays exact.

**Six donor comparison sets: precise original-data holds, not ingestion loss.** Protected
[39349054386](https://github.com/killjoy00/votepredict/actions/runs/39349054386), job
`118389667098`, verified the complete independent current regulator rowset and all
**777 canonical comparator keys / 780 copies**, with **0 absent keys / 0 field mismatches**.
[Durable raw-column clarification](source-proof/senate-864-donor-six-raw-clarification.json):
the six held recipient/year comparison sets contain **10 problematic canonical originals**:
**4 explicitly Other; 6 with both donor name and entity type literally blank**. All ten lack
registration numbers; **10/10 raw types and names agree with parsing**, and no type column
is missing. Eight have contribution receipt labels; two fall in the separately reported
other-receipt bucket. Those labels do not establish legal entity identity. Four held sets
have overlapping usable-field failures. **17/23 sets remain complete; 6 held.** The older
strict all-registration result remains 23 held, separately labelled. No comparator was
dropped, assigned a name/registration, attached to a PDF version or historically promoted.
Whole CSV byte hashes differed across downloads; the complete parsed-rowset commitment,
including raw columns and copies, matched. A 2026 source observation is not historical
publication. Reopen only for independent original identities/classifications/applicable
identifiers for these exact records, including actual donor names for the blank originals.

**Six missing Minutes: bounded recheck complete, no recovery.** The
[exact-source receipt](source-proof/senate-864-six-exact-source-recheck-v2.json) verifies all
six LRL whole responses unchanged from the previous receipt, with no linked written Minutes.
All five independently identified original Clerk routes return **HTTP 503**. The exact
May 16, 2024 calendar still does not establish the standing Environment/Climate/Legacy
hearing; same-day conference materials are not an equivalent meeting. Written-date coverage
remains **1,586/1,592**. These observations prove neither source nonexistence nor zero votes.
The reopening requirement remains the exact official committee/day written original and,
for May 16, the independently matched standing-committee hearing identity. No generic
archive or audio investigation is proposed.

**Validation:** #1481 required CI [39348720397](https://github.com/killjoy00/votepredict/actions/runs/39348720397),
independent original [39348720357](https://github.com/killjoy00/votepredict/actions/runs/39348720357),
independent comparator [39348720342](https://github.com/killjoy00/votepredict/actions/runs/39348720342)
and main CI [39349054417](https://github.com/killjoy00/votepredict/actions/runs/39349054417) SUCCESS.
#1482 required CI [39349090633](https://github.com/killjoy00/votepredict/actions/runs/39349090633),
independent original/binding [39349090646](https://github.com/killjoy00/votepredict/actions/runs/39349090646),
main CI [39349395181](https://github.com/killjoy00/votepredict/actions/runs/39349395181) and
protected source/append/read-back above SUCCESS. Full CI passed **2,297 repository tests**;
**16 focused local tests** and typecheck passed, with dedicated source/binding/non-serving/
rollback and donor checks. Automated verification and recorded agent reviews are not
represented as independent human approval. No branch/environment protections were bypassed.

## October 19 continuation: verified website expansion and executed experiment

**The 52 newly source-ready excerpts are now imported and verified**, not merely planned.
[#1477](https://github.com/killjoy00/votepredict/pull/1477), main
`452ea58d0680f6d1d2905f73a43a938b84af77a4`; required CI
[39324793311](https://github.com/killjoy00/votepredict/actions/runs/39324793311) and independent
[39324793476](https://github.com/killjoy00/votepredict/actions/runs/39324793476) passed.
The independent job rehashed four exact original HTML bodies from three pinned acquisition
artifacts, matched SHA256/SHA1 and independent CDX capture/URL/digest rows, and found all
52 literal excerpts in original visible text. The protected main
[39325185350](https://github.com/killjoy00/votepredict/actions/runs/39325185350), job
`118309647752`, **inserted 52 / reused 0**, read back **668/668** exact literals, identities,
original URLs/hashes/indexed observations and non-serving flags, and verified **0 replay inserts**.
Before/after snapshots verified REPEATABLE READ READ ONLY, schema checksums and explicit ROLLBACK.
The existing durable writer was reused; all 616 v1 records/keys and the v1 protocol hash remain exact.
At that #1477 execution: **668 excerpts / 53 people / 69 original bodies / 668 unique person-literal features**.
At that stage there were **526 source-metadata holds, 3 known-person scope exclusions and 0 unknown people**; the latest retained-source continuation above supersedes those holds.

A separately versioned [protocol v2](senate-864-website-experiment-protocol-v2.json) merged
before outcome access. The [outcome-free readback/cohort commitment](source-proof/senate-864-website-cohort-v2-pre-outcome.json)
was then committed in [#1478](https://github.com/killjoy00/votepredict/pull/1478), main
`502e505976ff82d814ab3bbfbf4fbe9fd190745e`, before its separately gated outcome execution.
It selects **12,134 member/bill targets / 370 bills / 52 people / 59 distinct constructed
text inputs** from 24,218 accepted first-passage targets. **12,084 targets lack qualifying
prior text**; this does not mean their candidates had no positions. There are **0 unknown
service bounds, 0 missing bill hashes and 0 cross-partition identical bill-version hashes**.
All text observations precede target-day local midnight strictly. Training has 4,073 targets /
177 bills (2021–22), validation 3,540 / 85 (2023), and test 4,521 / 108 (2024–25).
The exact cohort commitment is
`0bf82f9a1f7401b7dd4d79886b92c78aa2c476e78ace29582975b4b4061a2dc9`.

**Outcome experiment executed and verified:** protected
[39326151003](https://github.com/killjoy00/votepredict/actions/runs/39326151003), job
`118313094173`; [durable aggregate result](source-proof/senate-864-website-v2-executed-20261019.json).
Required PR CI [39325745476](https://github.com/killjoy00/votepredict/actions/runs/39325745476),
independent [39325745679](https://github.com/killjoy00/votepredict/actions/runs/39325745679),
and main CI [39326150837](https://github.com/killjoy00/votepredict/actions/runs/39326150837) passed.
Five Python numerical/chronology regressions and 15 dedicated JavaScript/PostgreSQL/source-gate
checks passed. The outcome-free preparation receipt was produced on `452ea58d` and its file was committed on `502e5059` before that commit's gated outcome execution. The frozen source/storage/protocol/cohort commitments were matched **before**
reading vote sides in a verified read-only transaction, explicitly rolled back before fitting.
Private rows/text and fitted weights stayed in memory; only aggregate metrics were exported.

| Frozen 2024–25 test model | Bill-macro log loss | Bill-macro Brier |
|---|---:|---:|
| Training-only overall YEA rate | 0.5884604741 | 0.1764924542 |
| Training-only party YEA rates | 1.0806926349 | 0.2126346114 |
| Party offset + website TF-IDF ridge | 1.0806929824 | 0.2126346786 |

Lower is better. Validation selected **lambda 100**, the strongest prescribed shrinkage.
The prespecified primary comparison shows **no useful held-out gain**: text-minus-party log loss
`+0.0000003475`, paired 2,000 bill-cluster bootstrap 95% interval
`[+0.0000003014, +0.0000003892]`; Brier delta `+0.0000000671`.
Historical party-rate transfer itself performed worse than the overall-rate baseline.
Secondary AUROC changed from 0.191906 to 0.203539, while balanced accuracy remained 0.5;
this does not overturn the primary result. The sample-size thresholds were met, but selected
source survival, repeated people/old captures and website-only features limit interpretation.
This experiment **does not establish that bill-conditioned website text is useless**.
No bill-text features, mutable encoder, subjective stance labels or serving changes were used.
**The 2024–25 test is now examined for this experiment:** do not tune against these results
and later call the same test untouched. A further model experiment needs a separately frozen
protocol and an honest evaluation design; no outcome-driven archive recovery is proposed.

**Existing committee source cohort now reconciles exactly:** the same protected workflow,
job `118313094006`, reused all 1,452 SHA-pinned original PDF manifests (including previously
verified OCR) with the existing comparator, without fetching/re-parsing the PDF universe.
[Durable receipt](source-proof/senate-864-existing-committee-readback-20261019.json):
**1,452/1,452 original URL/SHA identities, 153/153 recognized candidate rolls and 989/989
original named-choice tokens matched**, with no named-choice mismatch or unresolved stored
membership in that bounded comparison. It read **155 stored events / 1,009 choices**, including
the separately proved SF1 addition. The frozen parser reports one 2023 document with extra
stored events: its two new SF1 events are separately source-proven, not evidence of duplicates.
The recognized candidate set is **not an all-motion denominator**, and source context actions
and independent hearing-day identity checks for the whole universe remain uncertified.
The snapshot precedes the separately bounded Judiciary six-motion correction below.

## Six additional Judiciary named motions: merged, applied and verified

Exact original-page review found a concrete omission beyond the earlier one-YEA repair.
The February 21, 2024 Judiciary original above explicitly prints six failed named amendment
rolls: **A-17, Kreun's voted oral amendment at page 5/line 5.21, A-22, A-8, A-19 and A-18**.
Their physical source boundaries and exact literal AYE/NAY lists were independently checked;
the oral roll continues from page 1 onto page 2. The original register supplies full identities,
not choices. Full first-name/surname identities (with initial variants) and the separately
proved Ron/Ronald alias join explicit stored hearing-day service bounds; no surname-only join.
The existing **6–4 recommendation to Finance** is distinct from all six failed 4–6 / 5–5 rolls.
Its broad legacy motion text had included preceding amendments and its kind was `amendment`.

[#1479](https://github.com/killjoy00/votepredict/pull/1479), main
`391b951d08ac7522471ea7a70cd9a55bf8242762`, is **merged, executed and verified**.
Required [39327576169](https://github.com/killjoy00/votepredict/actions/runs/39327576169)
and independent [39327576220](https://github.com/killjoy00/votepredict/actions/runs/39327576220)
passed **2,297 repository tests / 0 failures**, four specific tests including PostgreSQL,
and fresh independent official originals. Main CI
[39328026704](https://github.com/killjoy00/votepredict/actions/runs/39328026704) passed.
Protected [39328026873](https://github.com/killjoy00/votepredict/actions/runs/39328026873),
job `118320064442`, reports **6 events / 60 explicit choices inserted, 1 recommendation
classification/text corrected, exact 7 motions / 70 choices verified and 0 replay inserts**.
The recommendation's existing ID/key and all ten literal choices/person links/metadata
were separately compared before/after and preserved. Its narrowed text now represents only
the recommendation; its kind is `motion`, `passed=true`, `is_passage=false`.

[Durable aggregate receipt](source-proof/senate-864-judiciary-six-motions-verified-20261019.json)
records the schema checksum gate, verified read-only before/after snapshots and explicit
ROLLBACKs, locked SERIALIZABLE atomic plan, exact original/anchor/side/person checks,
all new literal source names and non-serving/timing flags, post-commit read-back and replay.
Only this original's six specific source anchors are addable. No generic parser or positional
replay changed. A-13's **count-only** 5–5 division, the A-14 **voice vote**, Howe's withdrawn
oral proposal, Seeberger's unvoted oral proposal and the later formal-result restatement
supply **zero inferred individual choices**. They are not automatically counted as additional
named motions. Broader context-action parity remains uncertified.

The dated #1479 receipt reported **161 events / 1,069 explicit choices** before the later twelve-roll repair:
2022 38/259, 2023 35/217, 2024 **55/288**, 2025 33/305. The new source-proven six are
separate from the frozen 153-candidate parser comparison above; this does not certify an
all-motion denominator. Written-date coverage remains **1,586/1,592**: this correction uses
one already acquired original. All seven target motions use hearing-date availability,
next-day eligibility, no inferred floor passage and zero model weight. The old one-YEA
writer is a dated completed stage; its single-event guard is not a replay path for the now
seven-motion source. Education Policy's separate unanchored event and other source holds
remain unchanged.

## October 19 focused continuation: six Minutes, Judiciary YEA, PAC2 and PAC23

**#1474 is merged, executed and verified**, main `c9b56f4f23c673d8c14a66a1104dd89ebe4eb5cc`. [Durable focused receipts](source-proof/senate-864-focused-verified-20261019.json) preserve actual results. Exact-head required CI [39302144905](https://github.com/killjoy00/votepredict/actions/runs/39302144905), independent Judiciary originals [39302144756](https://github.com/killjoy00/votepredict/actions/runs/39302144756) and comparator tests/original acquisition [39302144633](https://github.com/killjoy00/votepredict/actions/runs/39302144633) all passed: **2,293 repository tests**, four Judiciary tests including actual PostgreSQL, four comparator and 27 inherited gates. Main CI [39302798219](https://github.com/killjoy00/votepredict/actions/runs/39302798219) also passed. Older full-census JSON remains an immutable snapshot.

**Actual YEA correction:** protected [39302798150](https://github.com/killjoy00/votepredict/actions/runs/39302798150), job `118233068429`, inserted **1 YEA**, read back **1 existing event / 10 exact choices**, verified source/identity/non-serving metadata and **0 idempotent replay inserts**. Separate read-only snapshots explicitly rolled back before and after the serializable commit. The existing non-passage event, key and nine choices were preserved. This closes A-YEA2024 only; no claim of full-year motion/member parity.

The 2024 missing-YEA source has a concrete, independently supported identity defect: the February 21 Judiciary original prints **`Latz - Chair`** on the 6–4 recommendation of SF3534 to Finance. Its header/signature identify **Ron Latz**. The separate official [2024 Judiciary attendance register](https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/Jud_2024_attendance.pdf) prints `Latz, Ron`; the [adopted January 4, 2023 Journal/SR7](https://www.senate.mn/journals/2023-2024/2023010402.pdf) establishes Judiciary's `Latz, Chair`; the original [LRL service directory](https://www.lrl.mn.gov/legdb/senate_dir) explicitly connects `Latz, Ronald Steven` to nickname `Ron` and Senate District 46, 2023–present. The directory was observed in 2026; its retrieval date is not historical publication evidence. Attendance supplies identity context, never the choice. The choice comes only from the original named YEA list.

Pinned originals: Minutes SHA `a109e8cbdd2edacc705c4494c35bc096052e9ceb69e16fbbc296b36506dbfa5d` (210,882 bytes); independent attendance SHA `d10d4eeb55c6a80244fac9a084b3ba648ed28f85ce18a3a4eea30532fc24c5d3` (248,084 bytes); adopted Journal SHA `25deddcfec84597df9e3e4382cca907f7e19d78f7a6db9a93d27ab60dbfd096e` (1,114,582 bytes). The contextual repair requires the **full identity/alias**, explicit stored hearing-day membership bounds, exact PDF/date/bill/question and nine exact existing choices. It can insert only the missing printed YEA, or recognize an exact ten-choice replay; any changed/ambiguous state holds. It preserves original spelling and normalized source token, existing event/key and nine choices. No general name-parser relaxation or positional replay. Independent keyless source reauthentication, schema validation, SERIALIZABLE apply and a separate verified read-only post-commit ROLLBACK are mandatory.

The [six-case source receipt](source-proof/senate-864-six-minutes-recheck-20261019.json) records complete current official date pages, exact links and whole-response hashes. All six still link no written Minutes; **1,586/1,592 is unchanged**. Five exact hearing identities were recovered from the official day calendars, but their original Clerk HTML and legacy goldpages PHP routes returned transport/updating errors. For May 16, 2024, the day calendar has HF3911 conference proceedings and other committees, without an independently matched Environment/Climate/Legacy hearing. Its conference-related attachments do not establish an equivalent standing-committee meeting. Reopen each case only for its exact written original (including a working correctly identified Clerk body). Agendas, attendance, bill text, unrelated same-day clips and failed requests establish neither zero votes nor source nonexistence. No further generic archive/audio pass is proposed.

For the **two comparator-complete PAC candidates**, the actual protected exact-page receipt in #1464 remains authoritative: two rehashed original bodies/pages and report identities, zero certified labelled rows and zero authenticated historical version-public-by. Review found no new source that crosses either gate. The item-level four-field diagnostic is not proof that fields are absent from a page. No additional proximity/parser experiment, relaxed name/column check, version association or historical eligibility promotion is proposed. Reopen only for independent printed-row containment and, separately, an independently dated observation of the exact original/amended version.

**The 23 comparator cases: original-source accounting complete.** Protected [39302798399](https://github.com/killjoy00/votepredict/actions/runs/39302798399), job `118233569931`, reproduced all **777 canonical comparison keys / 780 original CSV copies** across 23 recipient/year groups, with **0 absent keys / 0 literal field mismatches**. Their missing registrations originate in the official source: **764 Individual, 3 Self, 4 Other, 6 unclassified**. These are not 23 unidentified PAC donors or lost ingestion fields.

**Entity-typed comparison executed and verified:** [#1475](https://github.com/killjoy00/votepredict/pull/1475), main `0f51f20ad59a5f3d32cec565726b2814bb2e07fd`; protected [39304896926](https://github.com/killjoy00/votepredict/actions/runs/39304896926), job `118240985498`. **17/23 complete receiving-committee/year comparison sets pass; 6 remain held for unclassified entities. Four of those also fail the usable-field/name gate.** Those reasons overlap, not ten held cases. Original mismatch, missing registered ID and target PAC identity/signature holds are each zero.

Every row in each comparison set must match an independently fetched regulator original. Registered entities retain their number requirement and the original PAC/date/amount uniqueness check. Explicit Individual/Self rows do not acquire invented PAC registrations. Unknown entities/names/fields, conflicting raw copies and collisions hold; no row is dropped. The legacy all-registration gate remains separately labelled as 23 held. **The 17 verified comparison sets are not printed-PDF row matches.** No exact report version is attached, historical publication proved or eligibility promoted.

Both protected audits verified REPEATABLE READ READ ONLY and explicitly rolled back. The mutable 39,883,429-byte official CSV produced different whole-body hashes, recorded individually in the [focused receipts](source-proof/senate-864-focused-verified-20261019.json). The independent commitment over every parsed 2021–2025 row, every raw CSV column and duplicate copy matched exactly: `886aa0e25fba2713c4076e52f89b202c1aace945ec17886a5d36fb7199aae0ba`. Only order/CSV serialization is disregarded; changed fields/copy counts hold. This is a 2026 observation of historical records, not historical public-by or PAC affiliation proof.

Exact-head [required CI 39304293244](https://github.com/killjoy00/votepredict/actions/runs/39304293244) and [independent checks 39304293296](https://github.com/killjoy00/votepredict/actions/runs/39304293296) passed: **2,293 repository tests, seven comparator tests and 27 inherited gate tests**. Main CI [39304896549](https://github.com/killjoy00/votepredict/actions/runs/39304896549) also passed.

**Stable remaining evidence requirement:** the six typed cases need independent original entity classifications and applicable identifiers for their exact Other/unclassified comparator records; four also need usable original identity/transaction fields. Name similarity, committee/year association or a threshold change cannot reopen them. The two focused PAC cases separately require printed-row containment and authenticated historical publication of the exact original/amended version. No further archive/parser recovery is proposed without that new evidence.

## October 19 follow-up: person labels corrected

The earlier stored/frozen-v1 receipt's **55 `unresolved_official_person` labels were
extractor/schema labels**, not 55 unknown candidate identities. The corrected default
source planner reads explicit nested person declarations and their declared page-section
IDs/file references. **52 excerpts now resolve** from existing records: Justin D. Eichorn
12, Kent Eken 13 and Bill G. Ingebrigtsen 27. Louis McNutt's three excerpts have a known
identity and are explicitly **outside the 95 actually-serving-person study**, not unknown.
There are **zero unresolved-person excerpts** in the corrected source plan.

[Reproducible correction receipt](source-proof/senate-864-website-person-resolution-20261019.json):
At that identity-correction snapshot: **668 source-ready excerpts / 53 people / 69 original bodies**, **526 source-metadata
holds** (URL 147, SHA 266, indexed digest 113) and **3 known-person scope exclusions**.
This corrects attribution handling without new archive research or relaxed source/clock gates.
Regression checks cover every affected record, contradictory full names and ambiguous page
receipts. All previous 616 records and ingestion keys match exactly in the revised plan.

**At the name-correction commit, stored verification remained 616** and additional imports were zero. The later #1477 execution above has now imported/read back all 52 additions: verification at #1477 was 668. The frozen v1 protocol/hash and its 11,514
prepared targets stay unchanged. The fixed-v1 importer and audit explicitly use the v1
compatibility planner; the corrected default is v2. That bounded source-verified import and its separately versioned cohort are now executed and verified above. At #1477 verified storage was 668; do not silently replace the separately preserved frozen v1.
The completed v1 writer now requires its explicit reviewed-commit marker, so this name fix
does not trigger archive acquisition or database access.

## Calendar-year reconciliation — earlier dated snapshot

This table preserves the earlier October 19/20 accounting. Its committee numbers
are historical baseline values, superseded by the October 25 verified totals
and final closeout above. It is not a separate current completion claim.

The website rows report the latest verified 1,194-record storage; earlier v1/v2 counts remain dated receipts below. Archive observation year is distinct from target-vote year. Earlier observations are itemized in the latest continuation receipt.

Year means committee hearing date, finance metadata transaction/report calendar year, or
website/media archive observation year. Target-vote years are reported separately.
A 2021 report may be received/released in 2022; pre-2021 website captures may inform later
votes. Observation is not authenticated first publication. UNKNOWN never means zero.

| Family/year | Denominator and authenticated source scope | Actual stored read-back / discrepancy | Availability, eligibility and next action |
|---|---|---|---|
| Committee 2021 | Printed meeting/motion denominator UNKNOWN; selected official Journal originals only | Full source-to-stored parity UNKNOWN; no complete print acquisition | A-PRINT / A-2021 below; hearing-day availability, next-day eligibility. |
| Committee 2022 | 337 indexed meeting dates / 334 written-source dates / 3 source gaps; true all-motion denominator UNKNOWN | 38 materialized events / 28 declared named events / 259 explicit stored choices | Complete individual/motion parity UNKNOWN. |
| Committee 2023 | 517 indexed meeting dates / 516 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 35 materialized events / 24 declared named events / 217 explicit stored choices | SF1 2 motions/20 choices repaired and verified. |
| Committee 2024 | 300 indexed meeting dates / 299 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 56 materialized events / 32 declared named events / 297 explicit choices in the latest verified committee readback | One YEA plus six distinct Judiciary amendment rolls repaired; original-to-all-motion/member parity remains UNKNOWN. Selected April 19 original: all 3 rolls/27 choices stored and source-verified, including the distinct oral amendment; original IDs/choices preserved. |
| Committee 2025 | 438 indexed meeting dates / 437 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 44 materialized events / 40 declared named events / 440 explicit stored choices | Complete individual/motion parity UNKNOWN. Selected three originals: all 16 rolls/184 choices stored and source-verified after 11 additions/135 choices and existing field repairs. |
| Finance 2021 | 121 indexed PDF versions / 121 within-year unique bodies; legally owed filings UNKNOWN | Contributions 2,091 / 5,794; spending 1,543 / 4,425; IE 7 / 35 (canonical / copies) | 10,014 legacy eligible copies / 5,947 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2022 | 346 indexed PDF versions / 344 within-year unique bodies; legally owed filings UNKNOWN | Contributions 2,588 / 9,503; spending 3,386 / 9,987; IE 326 / 1,630 (canonical / copies) | 17,067 legacy eligible copies / 2,247 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2023 | 110 indexed PDF versions / 108 within-year unique bodies; legally owed filings UNKNOWN | Contributions 1,651 / 2,493; spending 1,506 / 2,150; IE 0 observed / 0 observed (canonical / copies) | 4,272 legacy eligible copies / 1,847 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2024 | 123 indexed PDF versions / 118 within-year unique bodies; legally owed filings UNKNOWN | Contributions 1,563 / 2,659; spending 1,535 / 2,070; IE 27 / 135 (canonical / copies) | 4,699 legacy eligible copies / 1,550 possible early-date flags; 0 tracked exact-version public-by proofs. Selected Miller cohort: 25 exact persisted links / 28 total link records, with 3 unmatched full-purpose holds unchanged; 18 contribution and 7 campaign-expenditure links, chronology separate. All 28 evidence/eligibility records preserved. |
| Finance 2025 | 130 indexed PDF versions / 122 within-year unique bodies; legally owed filings UNKNOWN | Contributions 3,027 / 16,666; spending 1,983 / 6,163; IE 31 / 155 (canonical / copies) | 22,503 legacy eligible copies / 21,120 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Campaign websites 2021 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 51 exact stored excerpts observed in 2021; 1,194/1,194 verified overall, 92 people / 123 unique original bodies | Strict observation-before-target rule; earlier observations can inform later targets. All itemized source holds resolved; 3 known-person scope exclusions. Whole-site completeness remains UNKNOWN. |
| Campaign websites 2022 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 723 exact stored excerpts observed in 2022; 1,194/1,194 verified overall, 92 people / 123 unique original bodies | Strict observation-before-target rule; earlier observations can inform later targets. All itemized source holds resolved; 3 known-person scope exclusions. Whole-site completeness remains UNKNOWN. |
| Campaign websites 2023 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 0 exact stored excerpts observed in 2023; 1,194/1,194 verified overall, 92 people / 123 unique original bodies | Strict observation-before-target rule; earlier observations can inform later targets. All itemized source holds resolved; 3 known-person scope exclusions. Whole-site completeness remains UNKNOWN. |
| Campaign websites 2024 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 18 exact stored excerpts observed in 2024; 1,194/1,194 verified overall, 92 people / 123 unique original bodies | Strict observation-before-target rule; earlier observations can inform later targets. All itemized source holds resolved; 3 known-person scope exclusions. Whole-site completeness remains UNKNOWN. |
| Campaign websites 2025 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 29 exact stored excerpts observed in 2025; 1,194/1,194 verified overall, 92 people / 123 unique original bodies | Strict observation-before-target rule; earlier observations can inform later targets. All itemized source holds resolved; 3 known-person scope exclusions. Whole-site completeness remains UNKNOWN. |
| Media 2021 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 131 stored contexts / 122 within-year source documents / 52 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2022 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 182 stored contexts / 163 within-year context-source documents / 118 with publisher dates, plus 3 verified attributable Miller fragments from one article | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. Selected Miller Q&A: 3 exact stored non-serving fragments first observed 2022-10-05T01:59:37Z; one article/person, two authenticated source copies, no inferred 2021 publication. |
| Media 2023 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 155 stored contexts / 132 within-year source documents / 124 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2024 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 118 stored contexts / 103 within-year source documents / 88 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2025 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 208 stored contexts / 168 within-year source documents / 155 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |

Committee date coverage is **1,586/1,592**, not the older 1,578/1,592. The original
14 written-source gaps are now **8 recovered + 6 held**. Prior [#1363](https://github.com/killjoy00/votepredict/pull/1363), main
`245501d9e19f92b16262fbb9b25cf341f05d52e7`, [38946174902](https://github.com/killjoy00/votepredict/actions/runs/38946174902) verified
**8 changed / 8 exact literal raw-source read-backs / 108 raw parser records**.
Those 108 records are not 108 certified distinct motions or inferred individual choices.

Stored committee counts above cover materialized events explicitly marked
`committeeVote=true`, not all raw parser views. The earlier full-family snapshot measured those hearing-date flags on two SF1 events. The latest committee readback now verifies them on those two plus all seven target Judiciary motions; absence of these flags on an older event alone does not prove incorrect eligibility. No bulk flag rewrite.
2021 print completeness and 2022 print/electronic equivalence remain UNKNOWN.

## Verified changes and bounded dispositions

### Committee: SF1 repair complete; other source gates preserved

The earlier SF1 7/10 identity result was already superseded on main by the official
SR7 office identities (Dziedzic Chair, Rest Vice Chair, Johnson Lead). This pass reused
that work, independently re-fetched the exact Minutes, SR7 and adopted January 4 Journal,
then [#1462](https://github.com/killjoy00/votepredict/pull/1462) merged at `fd4f2143657f4b283cbecbee828ae5a4d0f6d649`.
Actual guarded [39267889248](https://github.com/killjoy00/votepredict/actions/runs/39267889248), job `118113766685`, reports:

- **2 inserted events / 20 inserted choices / 2 exact verified events / 20 verified choices**.
- **0 idempotent replay inserts**, verified read-only snapshots explicitly rolled back
  before and separately after the committed write.
- Exact original/source hashes, migration checksums, historical hearing-day service bounds,
  a serializable bounded add-only plan and concurrent-state conflict checks all passed.
- Failed **4–6 oral amendment** and adopted **6–4 committee report** remain distinct;
  `is_passage=false`, hearing-day availability, next-day eligibility and zero model weight.
  No positional importer replay, attendance inference, floor-parser or serving change.

The historical V16 source **10 / stored 9** discrepancy is **superseded by the verified one-choice correction above**. Independent office/full-name/explicit nickname evidence and hearing-day stored membership bounds now resolve Ron Latz. The original printed token remains intact; no surname-only assignment or generic parser replay.

A final single-source read-back addressed the already authenticated February 14, 2024
Education Policy example ([#1470](https://github.com/killjoy00/votepredict/pull/1470)): **1 exact stored original document / 1 candidate
stored event / 0 uniquely labelled stored amendments / 1 unanchored event**.
The official two-page PDF proves six numbered failed 4–6 amendments (10, 2, 3, 5, 6, 9),
60 named-choice occurrences, plus a later recommendation without named sides.
One generic stored event cannot establish which numbered question it represents.
This is a precise original-motion-to-stored-event join HOLD, not proof that a selected
set of five or four motions is safely addable. Equal voter slates/tallies or legacy
ordinal keys do not resolve it. No replay, rekey or new member inference was performed.

## October 22, 2026: historical finance eligibility consumer guard and actual pre-vote upper bound

**Parent issue state: OPEN — DO NOT CLOSE #864.** The bounded campaign-finance as-of diagnostic/safeguard workstream has a stopping disposition only; it does not satisfy the parent issue's remaining historical Senate completeness criteria. Neither the documentation PR nor its merge is an issue-closing action.

**Correction merged and source-evidence STOP applied:** [PR #1542](https://github.com/killjoy00/votepredict/pull/1542), main `e9b22a00345545376424a42d22edee29ea9df241`. Keyless PR [CI #39836816829](https://github.com/killjoy00/votepredict/actions/runs/39836816829) and finance-specific [PR test/EXPLAIN #39836816845](https://github.com/killjoy00/votepredict/actions/runs/39836816845) both succeeded. First-attempt merged-main protected [finance run #39837360728](https://github.com/killjoy00/votepredict/actions/runs/39837360728), independent no-secret preflight job `120029063738` and protected existing default-branch Neon job `120030560094`, both **SUCCESS**. The actual protected SQL completed `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, verified database/role/readonly status, returned allowlisted grouped counts and executed explicit `ROLLBACK`; **zero production writes**. Logs contained no private transaction rows, donor names, financial amounts, private source identifiers, raw connection values or export files.

**Demonstrated historical evaluation consumer defect corrected (not a transaction proof):** `scripts/closeout-historical-evidence.ts` and the strict `public_availability` lane of `scripts/evaluate-historical-finance-two-clock.ts` previously accepted persisted `asOfEligible=true` plus dated `published_at` without independently reauthenticated row-specific historical public-by evidence. This could feed a previously unverified legacy date into a historical experimental diagnostic. Both now fail closed unless separately authenticated exact-row/version historical-publication metadata, with the applicable original/amendment statutory bound or authenticated archive capture, is present. Deduplication now retains source family/filer/year/row identity, and candidate contributions cannot masquerade as expenditures. The explicit retrospective **underlying-activity** diagnostic remains marked non-historical and separate. `publicFinanceFeatures`/experimental CSV loader retain the earlier #1461 source/date fix. The current campaign-finance snapshot, legislator profile prior-cycle context reader and gambling intelligence are contextual/display functions, **not part of these frozen prediction matrices**; the prior-cycle context still uses stored labels and must **not** be advertised as independently historically certified. No serving forecasts, coefficients, training, frozen historical outputs, scheduler, Vercel deployment, or existing evidence metadata changed.

**Actual protected historical Senate 2021–2025 source-to-cutoff audit (new snapshot; bounded to selected already-stored bulk families):**

| Source family | Stored copies / canonical keys | `asOfEligible=true` copies | Potentially before a 2021–25 Senate member's **latest** recorded passage vote, copies / family+filer+year+rowKey keys | Potential candidate-report earliest-floor conflicts before that latest cutoff |
|---|---:|---:|---:|---:|
| Candidate contributions | 37,115 / 10,920 | 36,419 | 5,425 / 1,576 | 4,179 |
| Candidate expenditures | 24,795 / 9,953 | 20,416 | 4,617 / 1,551 | 3,549 |
| Independent expenditures (spender identified separately) | 1,955 / 391 | 1,720 | 20 / 4 | Not candidate-report matched |
| **All** | **63,865 / 21,264** | **58,555** | **10,062 / 3,131** | **7,728** |

The 2021 cohort accounts for **5,912** possible pre-vote copies, 2023 for **4,130**, and 2024 for **20 independent-expenditure** copies; 2022 and 2025 contribute **zero** under this deliberately defined **same-membership latest-passage-cutoff** test. In particular the **20 independent-expenditure copies are NOT input to the two affected candidate-only historical experimental diagnostic loaders**, so the candidate-family **10,042 copies / 3,127 keys** are the *maximum pre-vote candidate input surface for those paths*, before verifying any actual historical matrix row, training partition or identical membership/cutoff. These are **upper bounds**, not 10,062 model features or 3,131 proven faulty transactions. Unknown first publication does not prove actual leakage. `senate_metadata_only` rows have no joined historical membership-vote cutoff and were not counted as exposed. A member's **latest** passage vote is deliberately permissive; the actual historical evaluation matrix/cutoff population is not proven by this aggregate census.

All **58,555** eligible copies in the protected snapshot lack the *new independently reauthenticated exact-row historical proof metadata*, not necessarily any other available source provenance: earlier historical archive labels, indexed PDF references and 25 separate exact containment links are **not** automatically erased or discredited. The newly guarded SQL admitted **0** source-certified pre-vote copies. Of the 10,062 upper-bound copies, **7,728** appear earlier than the **earliest** report-year candidate PDF legal floor (candidate-year association only); **0** precede their stored underlying transaction date, **0** precede a labelled archived capture date, and **0** have a protected-store independently reauthenticated exact-row proof admission. The same 7,728 copies precede the earliest practical report-year estimate; neither comparison establishes original row containment, exact original/amended version, or independent historical public-by proof. Legacy filing-derived/provenance labels appear on the 10,062 possible copies, but these are not independently verified as row-specific contemporaneous public disclosure. **No individual record was proven to have an invalid eligibility date** by these grouped comparisons; no eligibility writes or speculative bulk withdrawal were made. The 35 missing contribution entity-type fields remain **35 copies** (not 35 individuals or PAC classifications), and filer-versus-spender identity remains separate.

**Quantified disposition:** 63,865 stored copies / 21,264 canonical group keys examined; 58,555 persisted eligible-copy claims; 10,062 possible pre-vote exposure copies (10,042 candidate-family in affected historical diagnostic pathways, 20 IE stored/context-only in this comparison); **0 independently certified historical pre-vote finance rows in the repaired readers; 0 source-proven invalid transactions; 0 source-proven transaction corrections; 0 database eligibility writes; 1 demonstrated diagnostic consumer bypass class corrected in two consumers and tested**. There is no source-proven individual repair in the bounded highest-risk cohort. **STOP** this subtrack rather than extrapolating report-year hypotheses into 7,728 changes or continuing general PDF matching.

**Exact remaining finance evidence HOLD:** Independently show the canonical transaction in an authenticated original/amendment version or dated official archive bulk source; verify the printed row or authoritative exact transaction disclosure; establish its separately supported publication/observation timestamp; apply §10A.20 subd. 1b due-date next-day **08:00 America/Chicago**, independent later-filing floor, report class/entity, exact version and local/DST cutoff; then join to a concrete affected historical Senate prediction time. A protected *guarded idempotent write and independent readback* is only warranted after that entire chain is source-proven. V46 practical dates, modern PDF fetches, 830 indexed versions / 813 bodies and registration/year associations never suffice alone. Existing statutory logic and accepted report practical dates stay CLOSED. Issue #864 remains OPEN for its original broad acceptance, not for indefinite finance parser work.

### Finance: demonstrable consumer defect corrected

[#1461](https://github.com/killjoy00/votepredict/pull/1461), main `a195d3dd024338c921afdbd38f65722a5b7c4093`, fixes the
experimental finance loader **and its actual `publicFinanceFeatures` consumer**:
a `direct_disclosure` label no longer bypasses a known
`statutoryNotBeforeOn` floor. The reader also rejects contradictory saved experimental
inputs. **31 focused regressions** cover contributions, candidate spending and IE
separately, early originals, on-time/late filings, later amendment versions and same-day
exclusion. Typecheck/full CI [39266394215](https://github.com/killjoy00/votepredict/actions/runs/39266394215) and post-merge [39266882531](https://github.com/killjoy00/votepredict/actions/runs/39266882531) passed.
No existing historical database eligibility was automatically promoted or withdrawn.

Official [2021](https://www.revisor.mn.gov/statutes/2021/cite/10A.20),
[2024](https://www.revisor.mn.gov/statutes/2024/cite/10A.20) and
[2025](https://www.revisor.mn.gov/statutes/2025/cite/10A.20) §10A.20 subd. 1b were
rechecked: ordinary reports under that section remain nonpublic until **08:00 local
time the day after the proven due date**. Early filing cannot advance that release.
The project's additional **filed+1** bound handles later filings conservatively:
`max(due+1,filed+1)`; filed+1 is project policy, not an additional statutory release mandate.
Each later amendment/version keeps its own filing bound. Day-only replay excludes
the entire availability day, avoiding same-day/UTC/DST leakage. Missing due/report-type
proof fails closed. Large-contribution notices and lobbying have separately scoped
proof builders; they do not automatically inherit the ordinary-report rule.
The [policy and examples](cfb-ordinary-report-statutory-release-policy.md) clarify this boundary.

The actual consumer chain was traced: `cfb-report-availability.ts` supplies negative
release bounds to report/Board parsing; the transaction selector rejects filing-only
windows; `cfb-report-finance-mapper.ts` cannot convert a current report parse to historical
publication. Candidate/IE promotion needs separately labelled disclosure proof;
the Board-table writer retains `legalFloorOnly=true`. The experimental loader retains
the floor and the feature reader now enforces it. Practical estimates, source receipt
dates and authenticated historical public-by remain separate.

### Finance: canonical transactions versus evidence copies

Canonical identity is **family + registered filer/spender + year + rowKey**.
Copies include repeated source/session materializations. All counts below use the
**same current snapshot**, recognized bulk families and Senate-linked or explicitly
Senate-metadata-only evidence; they are not a legally owed filing/transaction universe.

| Family | Broad canonical / copies | Indexed registration, any 2021–25 year | Indexed registration AND matching report year |
|---|---:|---:|---:|
| candidate_contribution | 10,920 / 37,115 | 10,737 / 36,932 | 10,206 / 34,601 |
| candidate_expenditure | 9,953 / 24,795 | 9,807 / 24,649 | 9,352 / 23,090 |
| independent_expenditure | 391 / 1,955 | Not candidate-PDF matched | Not candidate-PDF matched |

Thus the earlier **20,544 canonical candidate transactions / 61,581 copies** are
reproduced exactly by the registration-only schedule filter:
10,737 contributions / 36,932 copies and 9,807 expenditures / 24,649 copies.
The broader scope has **20,873 / 61,910**, while the tighter registration/year
association has **19,558 / 57,691**. These are filter differences, not disappearing
transactions or proof of exact PDF membership. IE remains **391 / 1,955** separately;
its canonical filer is the **spender registration**, never a candidate recipient's
registration. All scoped copies have canonical key components. 35 contribution
copies lack contributor-type metadata (9 in 2024, 26 in 2025); no PAC/party/person
classification was guessed. Entity-type completeness is UNKNOWN.

The earlier diagnostic was freshly reproduced: **58,555 legacy eligible copies /
32,711 possible early-date conflicts / 0 exact version references**.
Within **56,835 candidate-family eligible copies**, 30,249 have one candidate-year version,
22,421 multiple candidate versions and 4,165 no candidate report version. The remaining
**1,720 eligible IE copies** are not candidate-PDF matched. A sole candidate PDF is not printed-row proof;
these flags do not establish invalid transactions or permit bulk rewrites.

**830/830 registry rows match exact immutable inputs / 813 globally unique bodies**;
all version identities have cached body matches; **0 tracked exact historical
version-public-by proofs**. Acquisition/practical dating is COMPLETE; accepted
handwriting/date estimates are not reopened. V47's source_documents-only comparison
still finds 0/830 URL/SHA matches because registry/body-cache tables are distinct.
This does not imply lost acquisition.

The prior [raw schedule execution](https://github.com/killjoy00/votepredict/actions/runs/38980349111), main
`4e6118cf0be30b9b96c53372c7daf45a995c241b`, separately recorded 830 captures,
1,296 candidate lines, **3 version links / 1 canonical transaction**, 56,990 unmatched
report/row pairs, 7 OCR-needed reports and 0 independent bulk-row observations.
That dated writer receipt is not certified historical publication; the eligible-copy
diagnostic's zero references does not erase separate provenance-table links.
No broad schedule/parser recovery or eligibility rewrite is proposed.

### Focused PAC two-case inspection: completed, stable holds

Starting from the two comparator-complete cases in [#1417](https://github.com/killjoy00/votepredict/pull/1417), [#1418](https://github.com/killjoy00/votepredict/pull/1418) and
[#1421](https://github.com/killjoy00/votepredict/pull/1421), [#1464](https://github.com/killjoy00/votepredict/pull/1464) merged at `26ef7238a8097521fa1b863d3505912e61e212ea`.
Protected [39270375811](https://github.com/killjoy00/votepredict/actions/runs/39270375811), job `118122429016`, inspected/rehashed **2 unique
original bodies / 2 exact original pages / 2 printed report identities**.
Original graphics included 8/8 and 84/14 horizontal/vertical rules. The fixed gate
could certify **0 labelled physical-row containments** jointly enclosing date,
registered entity, legal name and correct total. This does not prove absence.

Three related original/amended observations had receipt dates; there were **0
authenticated historical exact-version public-by proofs and 0 independent historical
bulk-row observations**. Source containment and historical chronology remain separate
gates. Reopen only for independent original printed-row attestation and independently
dated publication of that exact original/amended version. **STOPPED**: no comparator
relaxation, proximity experiments, envelope change or promoted candidate. The later #1475 source-backed entity-typed audit verifies comparison sets for **17 of the other 23 candidates**, holding **6** for unclassified entities (4 also fail the usable-field/name gate). Its complete comparison sets do not certify printed-row containment or historical publication. The legacy all-registration metric remains separately labelled as 23 held; the four date/amount collisions never establish identity by name alone.

### Campaign websites: dated v1 storage verification and frozen experiment preparation

Fresh read-back verifies **616/616 exact literal excerpts**, stable person identity,
original URL/full SHA, authenticated archive observation timestamp/indexed digest,
context/neutral type and required non-serving flags. **0 missing, mismatched, extra
or duplicate ingestion keys**. There are **50 people / 65 original page bodies /
616 exact person+literal features**, with 0 exact literal duplicate copies. Overlapping
excerpts are still not independent samples.

154 ready excerpts were observed before 2021, 31 in 2021, 426 in 2022 and 5 in 2025.
The historical v1 receipt partitions its 581 labels as missing original URL 147, body SHA 266,
indexed digest 113 and person 55. The person labels are superseded by the correction above:
52 existing identities resolved and 3 known-person scope exclusions. The later retained-source recovery above resolves all 526 source-metadata holds.
The 72 original-page provenance receipts are distinct from 398 linked literal excerpts.
1,285 was aggregate research metadata; 1,197 are materialized excerpts; 88 are not
itemized and were not fabricated. Wiger/Tomassoni/Bakk owned-site originals and
Clark's version-specific questionnaire/priorities holds remain bounded.
No sincerity or subjective policy-position certification was required.

The [protocol v1](senate-864-website-experiment-protocol-v1.json) was merged in [#1463](https://github.com/killjoy00/votepredict/pull/1463)
**before outcomes**; SHA-256:
`ba6b6bddc901fb26f2ea19897bf855a25d9f6b3ca81d9de5b3fedfb78eeff43b`.
Source-plan commitment:
`45dbe7103e2e79ed9492b031f95255ea0921b02a655aa66ae3d60fd2db1be0d3`.

- Include literal candidate-owned text with complete original/archive provenance and
  storage flags; observation must be strictly before target-day **00:00 America/Chicago**.
  Unknown/uncertain timestamp upper bounds and same-day observations are excluded.
- Join through stable legislator identity into target session/membership with explicit
  service bounds; never district/surname. Exact person/literal duplicates retain earliest
  proven observation. One first accepted passage target per member/bill/session; no
  repeated-outcome or per-excerpt target multiplication.
- Train 2021–22; validation 2023; untouched chronological test 2024–25. Training-only
  overall/party Beta(1,1) baselines versus a separate TF-IDF/logistic ridge text delta.
  Fixed grid, training-only vocabulary/IDF and no test tuning.
- Primary bill-macro log loss/Brier; secondary member/micro/AUROC/balanced accuracy;
  seeded bill-cluster bootstrap. Require strict clock, person, same-bill/version/
  identical-text cross-partition and outcome-leakage checks. Small partitions
  (<30 bills or <20 minority outcomes) remain exploratory/inconclusive.

| Target year | Eligible-domain member/bill targets | Strict pre-vote prepared targets | Bills | People |
|---|---:|---:|---:|---:|
| 2021 | 4,706 | 997 | 71 | 15 |
| 2022 | 6,965 | 2,563 | 106 | 25 |
| 2023 | 5,546 | 3,467 | 85 | 42 |
| 2024 | 3,837 | 2,402 | 58 | 42 |
| 2025 | 3,241 | 2,085 | 50 | 43 |

**11,514** prepared targets have immutable per-year membership/bill/event commitments
in the receipt. The query selects the accepted YEA/NAY domain without returning or
testing sides. This is a reproducible pre-vote candidate cohort, not a fitted matrix
or prediction result. Counts precede specified modeling-stage identical-bill-text
exclusions; party/minority-outcome coverage and all leakage checks are required before
future fitting. Capture selection, source survival, sparse people and old pages limit
generalization. **No outcomes were tested in that v1 preparation snapshot**. The separately frozen v2 experiment above is now executed; no serving weights, production training pipeline or earlier immutable evaluation freeze changed.

### Media: original/import/storage/exclusion accounting finalized in bounded scope

The [aggregate senator/year/source matrix](source-proof/senate-864-media-senator-year-source-20261019.csv)
contains **487 nonzero contextual cells and 18 declared statement-family cells**.
JSON public person ordinals index the one-based
[95-person manifest](../../data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json);
seed IDs map to the [44-source catalogue](../../data/sources/local-trade-news-v1.json).
Cells overlap across people; summing them is not an article or quotation total.
Unobserved cells do not mean no published statement.

Fresh **948 contexts = 794 in-range observation-year contexts + 154 outside**;
688 distinct in-range source documents; 537 contexts have publisher dates
(52/118/124/88/155 by 2021–25); 0 invalid archive clocks, 0 unknown seeds and 0 unsafe
neutral/non-serving flags. **652 unresolved full-name mention tokens** remain
unassigned. Context mentions certify **0 named statements**, not an absence of
statements. All 18 declared-direct cells have stored availability year **2026**;
metadata labels are not independent source certification or historical eligibility.

Existing selected originals were re-read across **all stored source kinds**:
17 Reformer-related versions / 13 original URLs plus 6 MPR versions / 4 URLs,
**0 exact URL+whole-body or archive+whole-body matches**. These 23 source versions
are not 23 unique articles or statements. Each public version ID and disposition
is retained in the receipt. Accepted Reformer/MPR investigations stay CLOSED.

Separately **13/13 selected later first-party statements** match literal, whole
publisher-body hash, observation and non-serving flags. First independent observation
is **2026-10-14**, not authenticated historical publication from displayed dates.
15 blocked URLs, 1 unmatched literal and 3 no-quote senators remain excluded.
Hauschild selected wording stays July 24, 2025 rather than the 2024 broadcast;
Kunesh 2023 wording uses February 10 rather than February 7, and selected 2024
charter wording uses December 11 rather than October 22. Heintzeman's April 30
story precedes his May 6 oath. No contextual mentions become attributable speech,
no general press-release crawl, no new archive recovery.

## Reused dated source/execution receipts

The SF1 V7 zero-stored state below is the pre-correction snapshot, superseded by the executed 2-event/20-choice repair above. These are dated scope-specific receipts, not current completeness claims.

- **Committee index and recovery:** [independent index reconciliation](senate-864-independent-committee-year-reconciliation.md), [fourteen-date baseline and subsequent eight recoveries](senate-864-fourteen-remaining-written-minute-source-dates.md), [eight exact raw originals](../../data/collections/senate-minute-gap-recovery-20261016.json). Updated written coverage **1,586/1,592**, not the older 1,578. Remaining six: 2022-03-15 Housing; 2022-08-10 and 2022-10-03 Environment Finance; 2023-04-13 Environment/Climate/Legacy; 2024-05-16 Environment/Climate/Legacy; 2025-05-12 Subcommittee on Committees. Reopen only for new exact committee/day written originals; no renewed generic archive/audio investigation.
- **SF1:** [official January 24 Minutes](https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf), SHA `a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379`; adopted [SR7](https://www.senate.mn/resolutions/pdf/ls93/2023_2024/SR0007_O0.pdf) and [January 4 Journal](https://www.senate.mn/journals/2023-2024/2023010402.pdf). Existing fix `e1875d5ccfeb55dbaee124340829ebd376a4c289`; [protected V7 run 38795586486](https://github.com/killjoy00/votepredict/actions/runs/38795586486), actual log: **10/10 each, 20 resolved choices, 0 stored events, 2 add-only candidates, 0 holds**. Earlier 7/10 holds are superseded. Failed 4–6 oral amendment and passed 6–4 committee report remain distinct.
- **2024 YEA:** [V16 report](senate-864-2024-missing-yea-v16-shared-safe-schema.md), `e19134daeea054254a4a32ac8a8f8e9335462b05`; [successful run 38357471669](https://github.com/killjoy00/votepredict/actions/runs/38357471669): 9-choice intersection, zero conservative roster/alias matches, identity/service were unproved in that dated receipt. Superseded by #1474, independent original office/full alias and protected 39302798150: one YEA inserted, exact 10/10 readback, zero replay inserts.
- **Finance acquisition/dating COMPLETE:** [830-version original source ledger](source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv), [practical dates](../../data/cfb-2021-25-830-estimated-availability-v46.json). **830 indexed versions / 813 globally unique bodies**, not 830 legally owed filings. [V48 registry](cfb-2021-25-pdf-registry-eligibility-triage-v48.md), `13c14c6297ee5a02458064c8af9ee5df548370b0`, [successful run 38797421452](https://github.com/killjoy00/votepredict/actions/runs/38797421452). Prior 58,555 eligible **copies** / 32,711 possible early dates are diagnostic, not proven invalid transactions; [V47 scope](cfb-2021-25-source830-neon-finance-date-reconciliation-v47.md). Later schedule audit: 20,544 canonical candidate transactions / 61,581 evidence copies in its narrower scope; 10,737 contributions / 36,932 copies; 9,807 expenditures / 24,649 copies; IE 391 / 1,955 separately. The same-snapshot scope reconciliation below now reproduces these exact totals.
- **PAC focused hold:** [PR 1417](https://github.com/killjoy00/votepredict/pull/1417), [1418](https://github.com/killjoy00/votepredict/pull/1418), [1421](https://github.com/killjoy00/votepredict/pull/1421), latest `0f0b0ff30dacdc834e2f7db22d5c571eb7518479`, [successful protected run 39083967656](https://github.com/killjoy00/votepredict/actions/runs/39083967656). Two comparator-complete candidates each have one candidate version, **0 certified printed rows and 0 authenticated historical version-public-by**. Separate gates: original labelled row boundaries/fields/report identity; independently dated original/amended publication chronology. The later #1475 entity-typed original-source check verifies 17/23 comparison sets and holds 6; the legacy all-registration metric remains 23 held. No PDF-row or historical-publication promotion follows either result.
- **Campaign import COMPLETE at its receipt:** [minimal policy](senate-864-candidate-website-asof-minimal.md), [PR 1321](https://github.com/killjoy00/votepredict/pull/1321), `9a97326b1fee310cb4f98b44d358e56f240a134b`; [run 38803307035](https://github.com/killjoy00/votepredict/actions/runs/38803307035), protected job `116658761429`: **616 inserted, 616 exact literal/provenance/flag read-backs, 398 linked to 72 freshly reverified originals, 581 holds**, sample as-of rows 8. The 72 earlier records are provenance receipts. **1,285 is aggregate research metadata, 1,197 itemized excerpts, 88 not materialized**; no invented text. Original-site leads for 92/95 people do not mean all 92 have usable pre-vote features. Wiger/Tomassoni/Bakk website originals remain unavailable; publisher quotations do not replace them.
- **Media bounded accounting:** [verified capture-year read-back](senate-media-verified-live-neon-capture-year-counts.md), `71bb9000389b49019d5c71b05209f5a111277098`, [run 38093691235](https://github.com/killjoy00/votepredict/actions/runs/38093691235): **794 in-range contexts + 154 outside = 948**, not 948 quotations. [Repeated protected denominator](senate-media-track-d-946-987-protected-coverage-20261018.md), [run 39185450015](https://github.com/killjoy00/votepredict/actions/runs/39185450015). [All-source-kind comparison](senate-media-track-d-946-987-cross-source-results-20261018.md), `85c2cec06a31e32350e728cd29649b338f975a56`, [run 39190098548](https://github.com/killjoy00/votepredict/actions/runs/39190098548): **0/23 exact selected archive-version matches across 46 source kinds**, not 23 unique articles or statements. No Reformer/MPR recovery restart, crawl expansion or reopened accepted disposition.



## Stable holds and exact reopening evidence

| Hold | Required evidence to reopen | Current disposition |
|---|---|---|
| A-PRINT | Complete authenticated 2021 print meeting/motion inventory and 2022 print/electronic reconciliation | Denominators UNKNOWN. No office contact or manual audio request. |
| A-2021 | Newly available official written motion/hearing-day proof for SF1159 Dibble and distinct McEwen amendments, and SF970 Pappas amendment, printed in the April 12, 2021 Journal | April 8 bill-level committee actions are proven, but not the individual motion dates; [existing source disposition](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6114008344). No manual audio reopening or inferred date/member side. |
| A-SIX | Exact official written Minutes for 2022-03-15 Housing; 2022-08-10 and 2022-10-03 Environment Finance; 2023-04-13 and 2024-05-16 Environment/Climate/Legacy; 2025-05-12 Subcommittee on Committees | Latest exact recheck: all six LRL whole bodies unchanged/no Minutes links; five identified original Clerk routes HTTP 503. May 16 additionally lacks an exact standing-committee hearing match. No source nonexistence or individual votes inferred. |
| A-YEA2024 — CLOSED | Independent official office, full-name/nickname and explicit hearing-day membership bounds authenticated | #1474 executed: 1 YEA inserted, exact 10/10 readback and zero replay inserts. Other committee joins remain open. |
| A-EDUCATION | Unique original numbered question-to-current stored event anchor plus hearing-day member-side parity | Exact PDF stored, one generic event unanchored; cannot safely choose additions/relabels from repeated slates or ordinal keys. |
| A-MOTION | Distinct source questions and historical person/session joins for remaining review cohorts | The selected four originals are COMPLETE: 19/19 printed rolls and 211/211 choices source-verified in storage after 12/144 additions and seven existing field repairs; all identities resolved. Other 81/323 candidate cohorts remain unverified, not automatic motions or safe importer replay. |
| B-OBLIGATION | Effective filer/entity identities, report-type duties/exemptions and authoritative owed-report inventory by year | Legally owed denominator UNKNOWN; indexed PDFs are not obligations. |
| B-LEGACY | Exact transaction-to-original-version containment or independently authenticated regulatory row disclosure, plus appropriate historical release/observation bound | 58,555 eligible-copy claims remain revalidation debt; no speculative withdrawal, promotion or exact-version attachment by year. |
| B-PAC2 | Independent original printed-row attestation (date, registered entity, legal name, correct total) and, separately, independently dated publication of that exact original/amended version | Two stable source/chronology gates; exact two-case inspection STOPPED. |
| B-PAC23 | Independent original donor identity/entity classification and applicable identifiers for the ten exact Other/blank records; six originals have blank donor names and types | Latest protected original audit: **17/23 sets complete; 6 held**. Ten canonical problematic originals = 4 Other + 6 blank names/types; all 10 blank registrations; all raw values match parser. Four held sets also fail usable fields. No PDF/publication/eligibility promotion. |
| B-MILLER-PURPOSE | Authenticated original bulk rows and an exact report-version comparison explaining the three full-purpose differences | Date, full counterparty and all amount columns agree; three rows remain unmatched to this exact PDF. No fuzzy purpose/collision fallback or invalid-transaction inference. |
| B-MILLER-PUBLICBY | Independently dated original/archive observation or official public-disclosure receipt for this exact version/row | 25 mechanical containment matches do not prove historical publication. Accepted practical date 2025-02-01 is not first-public proof; 28 existing eligibility claims unchanged. |
| C-COVERAGE | Newly available exact original owned-site evidence for Wiger/Tomassoni/Bakk, version-specific Clark sources, or an authenticated wider page/text inventory | Wider denominator UNKNOWN. Itemized inventory recovery is complete; do not restart closed generic archive searches or invent the 88 aggregate-only records. |
| C-SOURCES — CLOSED within itemized inventory | COMPLETE: exact retained original bytes, indexed URL/observation/digest and visible literal containment recovered for all 526 held excerpts | All 1,194 in-scope copies are source-supported and exactly stored; 3 McNutt scope exclusions; 0 unknown people. The wider owned-site/text denominator remains UNKNOWN. |
| C-IMPORT526 | COMPLETE: latest retained-source append/read-back above resolves all 526 source holds | 1,194 exact stored excerpt copies; old 668 and both frozen protocols preserved. |
| C-IMPORT52 | COMPLETE: #1477 inserted 52 and exactly read back all 668; zero replay inserts | Frozen v1 616/protocol preserved; separately versioned v2 cohort committed before outcomes. |
| C-EXPERIMENT | COMPLETE in the frozen v2 scope: #1478 actual protected outcome experiment, source/storage/cohort/leakage checks and aggregate results above | No useful held-out primary-metric gain; 2024–25 test is now examined. Further experiments require a new frozen protocol and honest evaluation design. |
| D-ATTRIBUTION | Exact source-contained attributable literal, historical person and supported publication/observation clock for remaining specifically identified versions | Contextual mentions and provenance receipts are not literal attributable statements. Miller's three selected fragments are COMPLETE: exact non-serving storage/source/person/2022-clock read-back and zero-write replay; no further evidence gathering or import is needed for them. Preserve closed Reformer/MPR and general-crawl exclusions. |

Further recovery requires **new evidence or a concrete defect in the prior method**.
A successful job or another proximity-parser variation is not new source proof.

## Merged, executed and verified receipt map

| Work | Merged main SHA | Validation and actual execution |
|---|---|---|
| [#1461](https://github.com/killjoy00/votepredict/pull/1461) finance guard + initial ledger | `a195d3dd024338c921afdbd38f65722a5b7c4093` | 31 focused regressions; CI [39266394215](https://github.com/killjoy00/votepredict/actions/runs/39266394215), post-merge [39266882531](https://github.com/killjoy00/votepredict/actions/runs/39266882531) passed; code only, no eligibility write |
| [#1462](https://github.com/killjoy00/votepredict/pull/1462) SF1 add-only repair | `fd4f2143657f4b283cbecbee828ae5a4d0f6d649` | Independent source/SQL [39267320317](https://github.com/killjoy00/votepredict/actions/runs/39267320317); actual guarded [39267889248](https://github.com/killjoy00/votepredict/actions/runs/39267889248): 2 events/20 choices exact post-commit read-back, 0 replay inserts |
| [#1463](https://github.com/killjoy00/votepredict/pull/1463) consolidated audit + protocol freeze | `1ffa5fdcb1e3b4c750924c2d9deae94efe73cf52` | Initial protected [39269101135](https://github.com/killjoy00/votepredict/actions/runs/39269101135) failed safely; no accepted completion receipt |
| [#1464](https://github.com/killjoy00/votepredict/pull/1464) exact two PAC pages | `26ef7238a8097521fa1b863d3505912e61e212ea` | 30 focused tests; independent [39269775612](https://github.com/killjoy00/votepredict/actions/runs/39269775612); protected [39270375811](https://github.com/killjoy00/votepredict/actions/runs/39270375811) verifies sources and retains two holds |
| [#1466](https://github.com/killjoy00/votepredict/pull/1466) safe mixed-chamber cast, IE spender scope, cohort fingerprints | `67d0fe52706a316b99eceb8ed92e2eb83aa3fc6d` | CI [39271052754](https://github.com/killjoy00/votepredict/actions/runs/39271052754) / PostgreSQL [39271052470](https://github.com/killjoy00/votepredict/actions/runs/39271052470) passed; protected [39271616540](https://github.com/killjoy00/votepredict/actions/runs/39271616540) failed safely at inherited SQL bind contract |
| [#1468](https://github.com/killjoy00/votepredict/pull/1468) correct parameterless inherited call, test actual orchestration | `eba22dbc5cfba6b73aaa4161dc67b5668f7d528f` | All 9 dedicated checks including real PostgreSQL passed; CI [39272559789](https://github.com/killjoy00/votepredict/actions/runs/39272559789) / independent [39272559931](https://github.com/killjoy00/votepredict/actions/runs/39272559931); protected [39273129172](https://github.com/killjoy00/votepredict/actions/runs/39273129172) SUCCESS, job 118131573694; post-merge CI [39273129228](https://github.com/killjoy00/votepredict/actions/runs/39273129228) SUCCESS |
| [#1470](https://github.com/killjoy00/votepredict/pull/1470) bounded Education anchors + same-snapshot finance scopes | `a606969debe0ebd9ec41aa57d9372771c41f4182` | All 10 dedicated checks including PostgreSQL passed; CI [39274952995](https://github.com/killjoy00/votepredict/actions/runs/39274952995) / independent [39274953069](https://github.com/killjoy00/votepredict/actions/runs/39274953069); final protected [39275444868](https://github.com/killjoy00/votepredict/actions/runs/39275444868) SUCCESS, job 118139505759; independent main job 118138445409; post-merge CI [39275444619](https://github.com/killjoy00/votepredict/actions/runs/39275444619) SUCCESS |
| [#1473](https://github.com/killjoy00/votepredict/pull/1473) structured website person correction | `f220028b7ac7d4b0c221c7c0f8546dce573af84e` | Required CI 39282336576, website checks 39282336797 and independent 39282336656 SUCCESS; zero extra imports, frozen v1 intact |
| [#1474](https://github.com/killjoy00/votepredict/pull/1474) one Judiciary YEA and original comparator accounting | `c9b56f4f23c673d8c14a66a1104dd89ebe4eb5cc` | Required CI 39302144905; independent 39302144756 / 39302144633; protected YEA 39302798150 (1 inserted, exact 10/10, zero replay); protected comparator 39302798399 (777 keys / 780 source copies exact); main CI 39302798219 SUCCESS |
| [#1475](https://github.com/killjoy00/votepredict/pull/1475) every-row source-backed entity-typed comparison | `0f51f20ad59a5f3d32cec565726b2814bb2e07fd` | Required CI 39304293244 and independent 39304293296 SUCCESS; protected 39304896926, job 118240985498, verifies 17/23 complete comparison sets and 6 holds; main CI 39304896549 SUCCESS |
| [#1477](https://github.com/killjoy00/votepredict/pull/1477) website 52 append + frozen protocol v2 | `452ea58d0680f6d1d2905f73a43a938b84af77a4` | Required CI 39324793311 and independent 39324793476 SUCCESS; protected 39325185350 / 118309647752 inserted 52, verified all 668, zero replay; outcome-free cohort committed before outcomes |
| [#1478](https://github.com/killjoy00/votepredict/pull/1478) isolated website experiment + existing committee readback | `502e505976ff82d814ab3bbfbf4fbe9fd190745e` | Required CI 39325745476 / independent 39325745679 / main CI 39326150837 SUCCESS; protected 39326151003 jobs 118313094173 (frozen no-gain result) and 118313094006 (153/153 rolls, 989/989 choices) SUCCESS |
| [#1479](https://github.com/killjoy00/votepredict/pull/1479) six exact Judiciary rolls + recommendation semantics | `391b951d08ac7522471ea7a70cd9a55bf8242762` | Required CI 39327576169 / independent 39327576220 / main CI 39328026704 SUCCESS; protected 39328026873 / 118320064442 inserted 6/60, corrected recommendation, exact 7/70, zero replay |

| [#1484](https://github.com/killjoy00/votepredict/pull/1484) selected three-family evidence audit | `f33545a9d3808d3a0c08e3558d861ab9ec5f2818` | CI 39355994362 / source 39355994347 / main CI 39356274179 SUCCESS; protected 39356274079 / 118412555964 executed read-only. Initial cross-session/type diagnostics superseded below; no data writes. |
| [#1485](https://github.com/killjoy00/votepredict/pull/1485) hearing-session joins and finance field accounting | `b1fbc36479aa5886e0c2cbbefcb256117fc89450` | CI 39357111622 / source 39357111589 / main CI 39357442863 SUCCESS; protected 39357442992 / 118416148731 verifies all 67 choices, zero unresolved identities, seven matching spending purposes. No data writes. |
| [#1486](https://github.com/killjoy00/votepredict/pull/1486) actual CE class and final unique containment | `8909582f003fe86ba3e2d8f29883d9cad6ddb27e` | CI 39357958098 / source 39357958012 / main CI 39358291472 SUCCESS; protected 39358291489 / 118419129381 verifies 19/211 source versus 7/67 stored, three media literals source-ready/zero returned storage rows, 25 exact finance matches/three purpose holds. 2,297 repository and 13 focused checks pass. No data writes. |
| [#1489](https://github.com/killjoy00/votepredict/pull/1489) bounded writer; [#1490](https://github.com/killjoy00/votepredict/pull/1490) existing parser-result fix | `b42133d96a14a8be618a1a6e0a8cfb8b34b1c085` | Exact-head CI 39368831166 / source+17 PostgreSQL checks 39368831180; main CI 39369127418; protected 39369127511 / 118453549297 SUCCESS: 12/144 inserted, seven events repaired, three media fragments appended, 25 finance links upgraded / three held records preserved, independent exact read-back, zero replay. Earlier V1 stopped before COMMIT with no changes. |

Dated October 19 full-census source artifact: `12196953355`, ZIP SHA-256
`eea965970a1c54a881911c87bac521c3053b51d71e8f620c81c51db77de0da42`.
The durable JSON appendix preserves the parsed allowlisted receipt independently of artifact expiry.
A temporary no-secret reader in [#1471](https://github.com/killjoy00/votepredict/pull/1471) transferred only this pinned sanitized artifact after
the local host disconnected; it was removed before final merge. It queried no database.

All database audits used bounded static SELECTs inside **verified REPEATABLE READ READ ONLY**
transactions and explicit **ROLLBACK**. Earlier failed audit attempts produced no accepted result.
Writes used the separately guarded source/schema/idempotency/post-commit verification path.
Automated independent verification and this agent's recorded PR reviews are not represented
as independent human approval. No branch/environment protection was bypassed.

## Completion checklist and closure decision

- [x] Read AGENTS.md first, inspect main, issue comments, related PRs/workflows/implementations; no nested AGENTS.md applied.
- [x] Establish this authoritative ledger before new implementation and reuse existing dated source receipts.
- [x] Correct demonstrable finance loader/consumer defect and meaningful regressions; preserve existing eligibility.
- [x] Complete SF1 guarded 2-motion/20-choice correction through CI/review/merge/execution/read-back.
- [x] Resolve Ron Latz's office-labelled 2024 YEA through independent sources and actual one-choice correction/readback.
- [x] Reconcile all 777 unusable comparator keys with the current original; distinguish Individual/Self/Other/unclassified source data from ingestion loss.
- [x] Execute the separate source-backed comparison of every row: 17/23 complete sets verified, 6 precise classification holds; preserve all PDF/publication/eligibility gates.
- [x] Recheck the exact six missing-Minutes sources and retain their bounded written-original holds.
- [x] Finish exact two-case PAC inspection and stop at separate containment/publication holds.
- [x] Verify all 616 literal website records and non-serving flags; freeze protocol and prepare reproducible pre-vote cohort.
- [x] Correct all 52 structured-identity/page joins and classify 3 known-person scope exclusions; verify zero unknown people.
- [x] Import/read back the 52 additions and all 668 literal records; preserve v1 and separately freeze v2 before outcomes.
- [x] Recover all 526 source-metadata holds from retained original acquisitions, append only verified literals and read back all 1,194; preserve the frozen 668-record experiment.
- [x] Execute the prespecified isolated website experiment, publish the no-gain result and mark its test as examined.
- [x] Reconcile the existing 1,452 original PDF identities / 153 candidate rolls / 989 named tokens after the YEA correction.
- [x] Add the separately source-proven six Judiciary named rolls / 60 choices, correct the recommendation question/classification, and verify all seven/70 with zero replay inserts.
- [x] Finalize bounded media accounting by senator/year/source and preserve existing exclusions.
- [x] Pre-production audit of four selected Minutes: 19 rolls/211 choices versus then-stored 7/67, all identities resolved and the exact 12/144 additions identified.
- [x] Verify three existing Miller Q&A fragments in two exact versions, stable person and earliest 2022 observation; distinguish zero returned storage rows from source absence.
- [x] Reconcile one Miller 2024 finance report: 28 copies/28 canonical records, 25 exact printed-row matches, 3 precise purpose holds and separate publication chronology hold.
- [x] Execute and independently verify 12-roll/144-choice committee additions and seven existing field repairs; preserve seven original IDs/keys and all 67 choice rows; exact 19/211 read-back and zero replay.
- [x] Append/read back three non-serving Miller literal statements, one article/person, exact earliest authenticated 2022 observation, source deduplication and zero replay.
- [x] Upgrade/read back 25 proven exact mechanical finance links from 28 unmatched parser results; preserve three held records and all 28 evidence/eligibility records, with zero replay. Publication chronology remains held.
- [x] Record merged versus executed versus verified outcomes; update one consolidated #864 checklist linked here.
- [x] Classify the six named Minutes, six PAC comparator sets, three Miller purposes and named website/media holds with exact source/version evidence, exclusions and reopening conditions in the October 21 bounded pass; zero newly supported writes.
- [ ] True official denominators and complete original-to-stored parity across all four families.

**October 21 actionable exact-hold pass disposed:** no new original or proved ingestion defect; identical failed endpoints, wider parser or crawling retries are not authorized as progress.

**#864 cannot close.** Acquisition/practical dating, SF1, the seven-motion Judiciary correction, v1 storage verification,
website v2 import/cohort/outcome evaluation, all 526 retained-source metadata recoveries and bounded PAC/media disposition passes are complete in their
stated scopes. Unknown denominators, six written gaps and other unresolved source-to-stored question joins,
legacy finance eligibility, wider website coverage and remaining media evidence gaps still prevent historical completeness. The four-original 19/211 repair, three non-serving Miller fragments and 25 exact mechanical finance links are now also complete and independently verified.
No indefinite parser/archive continuation is proposed.

No forecasting/serving models or weights, production training pipeline, earlier immutable evaluation freezes, accepted Senate
floor processing, Vercel deployment or scheduler reactivation changed. The isolated v2 research fit is explicitly reported above. No offices were contacted
and no manual audio listening was requested.

---

## October 22, 2026: 2023 Elections seven-original named roll cohort — exact opportunity and holds

This is a **bounded, separate source cohort** from the completed 2025 Elections
recovery. All seven already acquired official 2023 Elections Minutes were
independently re-fetched and SHA-verified, with exact original printed
YEA/NAY partitions. [PR #1534](https://github.com/killjoy00/votepredict/pull/1534)
contains the fixed original-source proof and guarded single-cohort readback.

| Original-source denominator | Original proof | Admitted source question | Held original source |
| --- | ---: | ---: | ---: |
| Official 2023 Elections Minutes | **7/7** PDFs/texts | Seven source identities verified | Zero original acquisition failures |
| Individually named rolls | **10** | **1** uniquely linked original motion | **9** unresolved question/outcome links |
| Explicit YEA/NAY choice occurrences | **133** | **14** choices on SF3 A35 failed 6–8, Feb 7 | **119** choices not admitted |
| Separate source Pass/Absent statuses | **7** | **0 inferred yea/nay** | Excluded as nonvoting statuses |

**Historical source holds (9 questions /119 printed choice occurrences):**
January 17 SF26 recommendation (13, result linkage unbound);
February 7 A36/oral amendment (14, exact amendment identity ambiguous)
and SF3 recommendation (14, result linkage unbound);
February 14 SF1515 and SF1507 recommendations (13+13, outcomes unbound);
February 21 SF749 recommendation (13, outcome unbound);
March 2 SF1434 oral amendment (14, outcome unbound);
March 7 A2 (13, bill/question identity hold);
March 14 SF1827 recommendation (12, outcome unbound).
These are authenticated **source roll passages**, not certified omitted
database events. No ordinal key, matching voting slate, attendance, aggregate
tally, or formal result alone is allowed to identify their parliamentary motion.

**Protected production comparison and verified correction (October 22, 2026 UTC):**
[PR #1534](https://github.com/killjoy00/votepredict/pull/1534)
merged as commit `d310a3ba2f3c634910b0b71ae052609e32fd20b0` with protected
source-recovery marker `SENATE864_ELECTIONS_2023_ORIGINAL_GUARDED_V1`.
[Successful GitHub Actions run #39831554208](https://github.com/killjoy00/votepredict/actions/runs/39831554208),
on that exact SHA, completed independent keyless source proofs, application
checks, focused regression tests, high-severity dependency audit, protected
Neon production reconciliation and **independent post-write read-back** at
`2026-10-22T18:31:44.428Z` (receipt artifact
`senate864-elections-2023-original-production-verified`, artifact ID
`12449217877`). The workflow independently authenticated the seven original
PDF/text fingerprints and all ten source rolls before opening production
credentials.

Within a bounded, explicit `REPEATABLE READ READ ONLY` production snapshot
(explicit `ROLLBACK`), all seven exact source documents matched by URL,
SHA and meeting date, with **0 previously materialized candidate events
and 0 named choices** on the seven selected meeting dates. Historical
membership identities and seven Senate bill references were resolved without
surname-only matching. Only **one original question** satisfied the
source-specific parliamentary proof: **February 7, 2023 SF3 A35 amendment,
failed 6–8, with 14 original named YEA/NAY sides**.

The guarded **SERIALIZABLE** transaction rechecked the same source, session,
committee/date, question and member/choice identities, then committed
**1 new committee event and 14 explicit individual choices**. No pre-existing
event or choice was modified or removed; **0 classification corrections**
were necessary. A separate `REPEATABLE READ READ ONLY` transaction with
explicit `ROLLBACK` confirmed the original question as exactly stored,
**14/14 choices present**, and **zero additional writes on replay**.
Source-choice ordinals were not fabricated. Official hearing-day timestamps
with next-day eligibility and same-day exclusion were preserved.

**Production source-to-stored read-back by year** (each row is a live
before/after result from the successful protected execution, not an estimate):

| Hearing year | Events before → after | Explicit choices before → after | New events | New choices |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 38 → 38 | 259 → 259 | 0 | 0 |
| 2023 | **35 → 36** | **217 → 231** | **1** | **14** |
| 2024 | 56 → 56 | 297 → 297 | 0 | 0 |
| 2025 | 53 → 53 | 539 → 539 | 0 | 0 |
| **2022–2025** | **182 → 183** | **1,312 → 1,326** | **1** | **14** |

The 2023 named-vote-bearing materialized event count changed **24 → 25**;
hearing-date-timing-classified events changed **2 → 3**. The source holds remain
**9 questions / 119 printed YEA/NAY choice occurrences**, and have **not**
been promoted, deduplicated by voting slate or claimed as absent from storage.
These fixed original-source counts do **not** imply population-wide Minutes
motion completeness or authorization to expand the cohort.

**CI and dependency chronology:** source proof, `npm run check` and
focused tests passed the earlier
[prepatch source run #39824307748](https://github.com/killjoy00/votepredict/actions/runs/39824307748),
but that attempt and standard CI were blocked by the then-critical Next.js
16.4.0 audit. After main pinned patched Next.js **16.4.2** and matching SWC
dependencies, [PR #1534 source-only CI #39830904035](https://github.com/killjoy00/votepredict/actions/runs/39830904035)
and [standard PR CI #39830903943](https://github.com/killjoy00/votepredict/actions/runs/39830903943)
both passed, including the production dependency audit. Exact post-merge
[production run #39831554208](https://github.com/killjoy00/votepredict/actions/runs/39831554208)
also passed all gates and its protected write/readback job. Older failed
attempts did **not** write to production.

**Bounded stopping rule met:** the one separately authenticated source
question is now reconciled and verified in production. Do not expand these
seven Minutes or reconstruct the nine held questions without new
independent exact-question evidence. Existing historical event IDs and
choices, Senate floor, serving/weights/training/evaluation freezes, Vercel,
and scheduler state are unchanged. **Issue #864 remains open** because this
one repaired question is not a population-wide completeness certificate.

