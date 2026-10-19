# #864 authoritative historical source-to-database completion ledger

Maintained reconciliation for **2021–2025 Minnesota Senate**. Initial reviewed main:
`5dc567397de8c4acfffe34417d444802c5a8b6db`; current protected snapshot **2026-10-19T15:14:11.167Z**
at **`a606969debe0ebd9ec41aa57d9372771c41f4182`**, [39275444868](https://github.com/killjoy00/votepredict/actions/runs/39275444868), protected job `118139505759`.
**#864 remains OPEN:** unknown official denominators and unresolved source-to-database joins
prevent closure under its actual acceptance criteria. Completed actionable subtracks are
marked complete below; this is not a claim of complete history.

The [durable aggregate receipt](source-proof/senate-864-completion-readback-20261019.json)
and [senator/year/source media matrix](source-proof/senate-864-media-senator-year-source-20261019.csv)
are appendices of this one maintained ledger. Older linked reports remain dated receipts,
not competing current completion ledgers. A workflow success, source inventory or empty
query does not establish completeness.

## Calendar-year reconciliation

Year means committee hearing date, finance metadata transaction/report calendar year, or
website/media archive observation year. Target-vote years are reported separately.
A 2021 report may be received/released in 2022; pre-2021 website captures may inform later
votes. Observation is not authenticated first publication. UNKNOWN never means zero.

| Family/year | Denominator and authenticated source scope | Actual stored read-back / discrepancy | Availability, eligibility and next action |
|---|---|---|---|
| Committee 2021 | Printed meeting/motion denominator UNKNOWN; selected official Journal originals only | Full source-to-stored parity UNKNOWN; no complete print acquisition | A-PRINT / A-2021 below; hearing-day availability, next-day eligibility. |
| Committee 2022 | 337 indexed meeting dates / 334 written-source dates / 3 source gaps; true all-motion denominator UNKNOWN | 38 materialized events / 28 declared named events / 259 explicit stored choices | Complete individual/motion parity UNKNOWN. |
| Committee 2023 | 517 indexed meeting dates / 516 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 35 materialized events / 24 declared named events / 217 explicit stored choices | SF1 2 motions/20 choices repaired and verified. |
| Committee 2024 | 300 indexed meeting dates / 299 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 49 materialized events / 25 declared named events / 227 explicit stored choices | Separate 10-source/9-stored YEA discrepancy held. |
| Committee 2025 | 438 indexed meeting dates / 437 written-source dates / 1 source gaps; true all-motion denominator UNKNOWN | 33 materialized events / 29 declared named events / 305 explicit stored choices | Complete individual/motion parity UNKNOWN. |
| Finance 2021 | 121 indexed PDF versions / 121 within-year unique bodies; legally owed filings UNKNOWN | Contributions 2,091 / 5,794; spending 1,543 / 4,425; IE 7 / 35 (canonical / copies) | 10,014 legacy eligible copies / 5,947 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2022 | 346 indexed PDF versions / 344 within-year unique bodies; legally owed filings UNKNOWN | Contributions 2,588 / 9,503; spending 3,386 / 9,987; IE 326 / 1,630 (canonical / copies) | 17,067 legacy eligible copies / 2,247 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2023 | 110 indexed PDF versions / 108 within-year unique bodies; legally owed filings UNKNOWN | Contributions 1,651 / 2,493; spending 1,506 / 2,150; IE 0 observed / 0 observed (canonical / copies) | 4,272 legacy eligible copies / 1,847 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2024 | 123 indexed PDF versions / 118 within-year unique bodies; legally owed filings UNKNOWN | Contributions 1,563 / 2,659; spending 1,535 / 2,070; IE 27 / 135 (canonical / copies) | 4,699 legacy eligible copies / 1,550 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Finance 2025 | 130 indexed PDF versions / 122 within-year unique bodies; legally owed filings UNKNOWN | Contributions 3,027 / 16,666; spending 1,983 / 6,163; IE 31 / 155 (canonical / copies) | 22,503 legacy eligible copies / 21,120 possible early-date flags; 0 tracked exact-version public-by proofs. |
| Campaign websites 2021 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 31 ready excerpts observed in 2021; 616/616 freshly matched overall, 50 people / 65 original page bodies | Strict observation-before-target rule; earlier observations can inform later targets. No absence inference from 0 ready observations. |
| Campaign websites 2022 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 426 ready excerpts observed in 2022; 616/616 freshly matched overall, 50 people / 65 original page bodies | Strict observation-before-target rule; earlier observations can inform later targets. No absence inference from 0 ready observations. |
| Campaign websites 2023 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 0 ready excerpts observed in 2023; 616/616 freshly matched overall, 50 people / 65 original page bodies | Strict observation-before-target rule; earlier observations can inform later targets. No absence inference from 0 ready observations. |
| Campaign websites 2024 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 0 ready excerpts observed in 2024; 616/616 freshly matched overall, 50 people / 65 original page bodies | Strict observation-before-target rule; earlier observations can inform later targets. No absence inference from 0 ready observations. |
| Campaign websites 2025 | All owned pages/text denominator UNKNOWN; bounded 95-person manifest and 1,197 materialized excerpts across cycles | 5 ready excerpts observed in 2025; 616/616 freshly matched overall, 50 people / 65 original page bodies | Strict observation-before-target rule; earlier observations can inform later targets. No absence inference from 0 ready observations. |
| Media 2021 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 131 stored contexts / 122 within-year source documents / 52 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2022 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 182 stored contexts / 163 within-year source documents / 118 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2023 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 155 stored contexts / 132 within-year source documents / 124 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2024 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 118 stored contexts / 103 within-year source documents / 88 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |
| Media 2025 | All attributable published statements UNKNOWN; 44 curated source seeds, bounded sampling | 208 stored contexts / 168 within-year source documents / 155 with publisher dates | Contextual mentions, not certified speaker statements; publication and observation clocks kept separate. |

Committee date coverage is **1,586/1,592**, not the older 1,578/1,592. The original
14 written-source gaps are now **8 recovered + 6 held**. Prior [#1363](https://github.com/killjoy00/votepredict/pull/1363), main
`245501d9e19f92b16262fbb9b25cf341f05d52e7`, [38946174902](https://github.com/killjoy00/votepredict/actions/runs/38946174902) verified
**8 changed / 8 exact literal raw-source read-backs / 108 raw parser records**.
Those 108 records are not 108 certified distinct motions or inferred individual choices.

Stored committee counts above cover materialized events explicitly marked
`committeeVote=true`, not all raw parser views. Only the two new SF1 events carry
all three hearing-date timing metadata flags measured by this audit; absence of these
flags on an older event alone does not prove incorrect eligibility. No bulk flag rewrite.
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

The 2024 missing-YEA V16 remains a specific source **10 choices / stored 9** discrepancy:
independent exact historical identity/alias and hearing-day service are still unproved.
No new official identity evidence appeared in this pass; no surname-only assignment.

A final single-source read-back addressed the already authenticated February 14, 2024
Education Policy example ([#1470](https://github.com/killjoy00/votepredict/pull/1470)): **1 exact stored original document / 1 candidate
stored event / 0 uniquely labelled stored amendments / 1 unanchored event**.
The official two-page PDF proves six numbered failed 4–6 amendments (10, 2, 3, 5, 6, 9),
60 named-choice occurrences, plus a later recommendation without named sides.
One generic stored event cannot establish which numbered question it represents.
This is a precise original-motion-to-stored-event join HOLD, not proof that a selected
set of five or four motions is safely addable. Equal voter slates/tallies or legacy
ordinal keys do not resolve it. No replay, rekey or new member inference was performed.

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
30,249 copies have one candidate-year version, 22,421 multiple candidate versions,
4,165 no candidate report version. A sole candidate PDF is not printed-row proof;
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
relaxation, proximity experiments, envelope change or promoted candidate. Other 23
candidates retain incomplete receiving-committee/year donor-comparator holds; the
four date/amount collisions do not establish legal identity.

### Campaign websites: storage verification and frozen experiment preparation complete

Fresh read-back verifies **616/616 exact literal excerpts**, stable person identity,
original URL/full SHA, authenticated archive observation timestamp/indexed digest,
context/neutral type and required non-serving flags. **0 missing, mismatched, extra
or duplicate ingestion keys**. There are **50 people / 65 original page bodies /
616 exact person+literal features**, with 0 exact literal duplicate copies. Overlapping
excerpts are still not independent samples.

154 ready excerpts were observed before 2021, 31 in 2021, 426 in 2022 and 5 in 2025.
The 581 primary-reason holds partition as missing original URL 147, body SHA 266,
indexed digest 113 and official person 55; underlying missingness may overlap.
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
generalization. **No outcomes tested, fitted model or predictive-lift claim**; no serving
weights, training or immutable evaluation freeze changed.

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
- **2024 YEA:** [V16 report](senate-864-2024-missing-yea-v16-shared-safe-schema.md), `e19134daeea054254a4a32ac8a8f8e9335462b05`; [successful run 38357471669](https://github.com/killjoy00/votepredict/actions/runs/38357471669): 9-choice intersection, zero conservative roster/alias matches, exact service day/root cause unproved. Successful workflow does not resolve identity.
- **Finance acquisition/dating COMPLETE:** [830-version original source ledger](source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv), [practical dates](../../data/cfb-2021-25-830-estimated-availability-v46.json). **830 indexed versions / 813 globally unique bodies**, not 830 legally owed filings. [V48 registry](cfb-2021-25-pdf-registry-eligibility-triage-v48.md), `13c14c6297ee5a02458064c8af9ee5df548370b0`, [successful run 38797421452](https://github.com/killjoy00/votepredict/actions/runs/38797421452). Prior 58,555 eligible **copies** / 32,711 possible early dates are diagnostic, not proven invalid transactions; [V47 scope](cfb-2021-25-source830-neon-finance-date-reconciliation-v47.md). Later schedule audit: 20,544 canonical candidate transactions / 61,581 evidence copies in its narrower scope; 10,737 contributions / 36,932 copies; 9,807 expenditures / 24,649 copies; IE 391 / 1,955 separately. The same-snapshot scope reconciliation below now reproduces these exact totals.
- **PAC focused hold:** [PR 1417](https://github.com/killjoy00/votepredict/pull/1417), [1418](https://github.com/killjoy00/votepredict/pull/1418), [1421](https://github.com/killjoy00/votepredict/pull/1421), latest `0f0b0ff30dacdc834e2f7db22d5c571eb7518479`, [successful protected run 39083967656](https://github.com/killjoy00/votepredict/actions/runs/39083967656). Two comparator-complete candidates each have one candidate version, **0 certified printed rows and 0 authenticated historical version-public-by**. Separate gates: original labelled row boundaries/fields/report identity; independently dated original/amended publication chronology. Other 23 candidates remain held by incomplete receiving-committee/year donor comparators. No weaker comparator or proximity match permits promotion.
- **Campaign import COMPLETE at its receipt:** [minimal policy](senate-864-candidate-website-asof-minimal.md), [PR 1321](https://github.com/killjoy00/votepredict/pull/1321), `9a97326b1fee310cb4f98b44d358e56f240a134b`; [run 38803307035](https://github.com/killjoy00/votepredict/actions/runs/38803307035), protected job `116658761429`: **616 inserted, 616 exact literal/provenance/flag read-backs, 398 linked to 72 freshly reverified originals, 581 holds**, sample as-of rows 8. The 72 earlier records are provenance receipts. **1,285 is aggregate research metadata, 1,197 itemized excerpts, 88 not materialized**; no invented text. Original-site leads for 92/95 people do not mean all 92 have usable pre-vote features. Wiger/Tomassoni/Bakk website originals remain unavailable; publisher quotations do not replace them.
- **Media bounded accounting:** [verified capture-year read-back](senate-media-verified-live-neon-capture-year-counts.md), `71bb9000389b49019d5c71b05209f5a111277098`, [run 38093691235](https://github.com/killjoy00/votepredict/actions/runs/38093691235): **794 in-range contexts + 154 outside = 948**, not 948 quotations. [Repeated protected denominator](senate-media-track-d-946-987-protected-coverage-20261018.md), [run 39185450015](https://github.com/killjoy00/votepredict/actions/runs/39185450015). [All-source-kind comparison](senate-media-track-d-946-987-cross-source-results-20261018.md), `85c2cec06a31e32350e728cd29649b338f975a56`, [run 39190098548](https://github.com/killjoy00/votepredict/actions/runs/39190098548): **0/23 exact selected archive-version matches across 46 source kinds**, not 23 unique articles or statements. No Reformer/MPR recovery restart, crawl expansion or reopened accepted disposition.



## Stable holds and exact reopening evidence

| Hold | Required evidence to reopen | Current disposition |
|---|---|---|
| A-PRINT | Complete authenticated 2021 print meeting/motion inventory and 2022 print/electronic reconciliation | Denominators UNKNOWN. No office contact or manual audio request. |
| A-2021 | Newly available official written motion/hearing-day proof for the three held April amendment hearing days | No inferred date or voice/attendance/member sides. |
| A-SIX | Exact official written Minutes for 2022-03-15 Housing; 2022-08-10 and 2022-10-03 Environment Finance; 2023-04-13 and 2024-05-16 Environment/Climate/Legacy; 2025-05-12 Subcommittee on Committees | Six source holds, separately from eight already recovered dates. No generic archive restart. |
| A-YEA2024 | Independent official full identity/alias and service on the exact original hearing day | Keep source 10 / stored 9; no surname-only assignment. |
| A-EDUCATION | Unique original numbered question-to-current stored event anchor plus hearing-day member-side parity | Exact PDF stored, one generic event unanchored; cannot safely choose additions/relabels from repeated slates or ordinal keys. |
| A-MOTION | Distinct source parliamentary questions, explicit named sides where printed, historical identities and unique current stored matching | Other four v3 gains and 81/323 candidate review cohorts remain source/segmentation holds, not automatic motions or importer replay. |
| B-OBLIGATION | Effective filer/entity identities, report-type duties/exemptions and authoritative owed-report inventory by year | Legally owed denominator UNKNOWN; indexed PDFs are not obligations. |
| B-LEGACY | Exact transaction-to-original-version containment or independently authenticated regulatory row disclosure, plus appropriate historical release/observation bound | 58,555 eligible-copy claims remain revalidation debt; no speculative withdrawal, promotion or exact-version attachment by year. |
| B-PAC2 | Independent original printed-row attestation (date, registered entity, legal name, correct total) and, separately, independently dated publication of that exact original/amended version | Two stable source/chronology gates; exact two-case inspection STOPPED. |
| B-PAC23 | Complete receiving-committee/year official registered donor comparator identities | 23 full-comparator holds retained; no weaker matches. |
| C-581 | Missing original URL/body SHA/indexed archive digest/observation/person provenance for each held record | 581 held; no subjective sincerity gate or invented aggregate-only excerpts. |
| C-EXPERIMENT | Future deliberately isolated outcome evaluation under frozen v1, with specified leakage and coverage checks | Protocol/pre-vote cohort preparation complete; outcome testing was not authorized in this pass and no lift is claimed. |
| D-ATTRIBUTION | Exact source-contained named passage, historical speaker membership, supported publication/observation clocks for a specifically identified source version | Contextual mentions and declared metadata are not certified speech. Preserve selected-source exclusions; no Reformer/MPR/general-crawl restart. |

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
| [#1470](https://github.com/killjoy00/votepredict/pull/1470) bounded Education anchors + same-snapshot finance scopes | `a606969debe0ebd9ec41aa57d9372771c41f4182` | All 10 dedicated checks including PostgreSQL passed; CI [39274952995](https://github.com/killjoy00/votepredict/actions/runs/39274952995) / independent [39274953069](https://github.com/killjoy00/votepredict/actions/runs/39274953069); final protected [39275444868](https://github.com/killjoy00/votepredict/actions/runs/39275444868) SUCCESS, job 118139505759; independent main job 118138445409 |

Final source artifact: `12196953355`, ZIP SHA-256
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
- [x] Finish exact two-case PAC inspection and stop at separate containment/publication holds.
- [x] Verify all 616 literal website records and non-serving flags; freeze protocol and prepare reproducible pre-vote cohort.
- [x] Finalize bounded media accounting by senator/year/source and preserve existing exclusions.
- [x] Record merged versus executed versus verified outcomes; update one consolidated #864 checklist linked here.
- [ ] True official denominators and complete original-to-stored parity across all four families.

**#864 cannot close.** Acquisition/practical dating, SF1, 616-excerpt storage verification,
protocol/cohort preparation and bounded PAC/media disposition passes are complete in their
stated scopes. Unknown denominators, six written gaps, unresolved member/source-motion joins,
legacy finance eligibility and held website/media provenance still prevent historical completeness.
No indefinite parser/archive continuation is proposed.

No forecasting/serving models or weights, training, immutable evaluation freezes, accepted Senate
floor processing, Vercel deployment or scheduler reactivation changed. No offices were contacted
and no manual audio listening was requested.
