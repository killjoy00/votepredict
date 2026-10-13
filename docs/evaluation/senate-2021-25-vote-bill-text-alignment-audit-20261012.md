# Minnesota Senate 2021–2025: exact vote-to-text evidence audit

**Audit date:** October 12, 2026. **Baseline main SHA:** bef22e2b4a5685e428581a3dc10f4a15ccbf2e57. **Scope:** public sources, code, prior SHA-backed research, and synthetic offline checks only. No protected database access, historical imports, model/serving modifications, deployments, or official outreach.

## Architecture and concrete defects

| Component | Existing strengths | Deficiency |
| --- | --- | --- |
| migrations/0002_historical_votes.sql; src/lib/db/schema.ts | Per-event motion text, session, chamber, bill ID, amendment reference, recorded outcome, individual votes, official source document | No explicit vote-event-to-bill-version/amendment relationship or independently verified historical public-by |
| src/sources/minnesota/senate-journals.ts | v3 keeps separate passage, amendment, procedural/motion observations and in-memory amendment refs; preserves legacy passage identity | Nearest preceding bill-number heuristic is not independently verified exact text; no amendment body recovery |
| scripts/ingest-senate-history.ts | Persists journal PDF SHA and motion context, reconciles named members | **Bug:** parsed amendmentRef was not stored in vote_events.amendment_ref; fixed on this branch for FUTURE import only |
| src/evidence/minnesota-senate-committee-minutes.ts and scripts/backfill-senate-committee-minutes.ts | v3 recognizes separately anchored repeated-roll actions | Legacy event keys depend on observationIndex. Replaying additional actions with ON CONFLICT UPDATE may relabel stored votes. Explicit HOLD; no rerun |
| src/sources/minnesota/revisor.ts | Extracts numbered Revisor introduction and engrossment versions with normalized-text hashes | Numeric-only version URL pattern omits unofficial engrossments and conference reports; lacks rejected amendment texts and conference variants |
| scripts/enrich-revisor-bills.ts; src/forecasting/runtime.ts | Stored dated version texts, source URLs, hashes and historical analogue date filtering | Version text/hashes can be overwritten on conflict; dated selector can use same-day postedOn <= event day, insufficient for independently proven earlier publication or sequence |
| src/sources/minnesota/senate-journals.ts; src/operations/historical-house-research-summary-backfill.ts | PDF text extraction from official Senate Journal and House Research analyses | Previously hashed potentially worker-detached bytes, risking empty-body SHA provenance; fixed for new fetches with original SHA pinned for HF100 only. Stored legacy source identities not audited |

**Design boundary:** The live Revisor parser feeds historical replay and live forecasting. Modifying its version universe could change selected historical texts or predictions without the user-authorized evaluation. This PR therefore adds a completely separate offline version catalog/alignment/diff helper. No production selector is changed.

## Official example: HF100 (2023, 93rd Legislature)

Primary status and history: https://www.revisor.mn.gov/bills/93/2023/0/HF/100/

Official bill text families:

- Numbered introduction plus 1st–12th engrossments: **13** version listings. Introduction https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/0/; 11th engrossment https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/11/ (Apr 25); 12th https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/12/ (May 20).
- Unofficial Senate engrossment **two** listings: https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/1/ (Apr 26) and https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/2/ (Apr 28).
- Conference committee reports **two** listings: https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ccr/0/ (May 16) and https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ccr/A/ (May 17). The **alphabetic A path** is important: a numeric CCR parser would still miss it.
- Revisor companion SF73 https://www.revisor.mn.gov/bills/93/2023/0/SF/73/ is *not* proof of text identity.

**Scoped structural count:** 17 official listings = 13 numbered + 2 UE + 2 CCR; the existing numeric-only parser cannot recognize **four** nonnumeric-family paths. Four parser-family omissions do **not** prove four missing persisted database rows.

| Date | Distinct official Senate decision | Tally / official result | Exact-text caveat |
| --- | --- | --- | --- |
| Apr 28, 2023 | Lay on table | 33–34, failed | Procedural; not a policy endorsement |
| Apr 28, 2023 | Re-refer to Finance | 33–34, failed | Procedural; same tally as table motion is NOT same event |
| Apr 28, 2023 | Passage of HF100 | 34–33, passed | Text as amended; second UE has same-day posting only, not a proven pre-vote availability time |
| May 19, 2023 | Reject conference report | 32–34, failed | Vote concerned *rejection* of report, not standalone bill passage |
| May 19, 2023 | Adopt conference report / repass | 34–32, passed | CCR 0 versus CCR A and the actual vote-time artifact require exact journal-to-text corroboration; May 20 engrossment is later |

The Revisor's additional May 19 third-reading action shows 34–32. Do not manufacture an extra independent named roll from that status entry without official Senate journal event identity verification. The action list links original printed journal pages. **This audit did not inspect stored event rows.**

### Follow-up: full original April 28, 2023 Senate floor motion sequence

A direct reading of the [original Senate Journal, Day 59 (PDF)](https://www.senate.mn/journals/2023-2024/20230428059.pdf), **printed pages 6883–6891**, recovers substantially more motion identity than Revisor's short status summary. It identifies FIVE separate proposed floor amendments, one result-only (voice) adopted amendment, four named recorded amendment rolls, two named procedural rolls, and one named final-passage roll: **eight separate decisions, seven recorded individual-division events**. The tally sequence is original-document source order rather than a same-bill topical aggregation.

| Original source order | Printed journal page | Specific question, named mover | Named tally | Official outcome | What text was considered / disposition |
| ---: | ---: | --- | ---: | --- | --- |
| 1 | 6883–6884 | Port amendment | no named roll | adopted | Wording of numerical limits and certain funding/program provisions, explicitly against first unofficial engrossment; no individual senator position reconstructed |
| 2 | 6884–6885 | Hauschild local retailer/city restriction amendment | 38–28 | adopted | Explicit proposed restrictions on cannabis outlet densities, potential city opt-out and sales hours; **enters later amended text state** |
| 3 | 6886 | Hauschild tax-escalation amendment | 27–37 | rejected | Proposed change to 12% and step-up to 20%; **never enters adopted legislative text state in this floor sequence** |
| 4 | 6887 | Johnson motion to lay HF100 on the table | 33–34 | failed | Procedural question; YEA = table the bill, not support for a specific cannabis provision |
| 5 | 6887–6888 | Hauschild drug-recognition training and funding amendment | 35–30 | adopted | Different appropriations/trunk highway financing; **enters later amended text state** |
| 6 | 6888–6889 | Hoffman appropriations amendment | 65–1 | adopted | Changes specified $4m amounts to $5.5m; **enters later amended text state** |
| 7 | 6889–6890 | Pratt motion to re-refer to Finance | 33–34 | failed | Separate procedural question with same 33–34 tally as tabling |
| 8 | 6890–6891 | Final passage of HF100, **as amended** | 34–33 | passed | Encompasses the four adopted floor amendments; rejected tax proposal explicitly excluded. Full assembled bill-text SHA remains unverified |

For **all five amendment motions**, the Journal explicitly names the **first unofficial engrossment** as the underlying paper. Revisor lists [that original version](https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/1/) with an April 26 posted date and [the second unofficial engrossment](https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/2/) with an April 28 posted date. This proves that *the Journal described the first as the amendment baseline*; it **does not** prove the second was already available when votes were cast on April 28, or that this ledger has a reconstructable, original-byte verified complete text for each moment.

The permanent source-only ledger [data/evaluation/senate-2023-hf100-apr28-official-motion-sequence-v1.json](../../data/evaluation/senate-2023-hf100-apr28-official-motion-sequence-v1.json) preserves **eight** independent event anchors, page locators, motion types, adoption/rejection states, named-versus-voice distinction, original bill-paper reference and explicit unknown timestamps/source hashes. **These are not the stored event external keys.** The pure [source-state reconstructor](../../src/evidence/minnesota-official-motion-sequence.ts) computes exactly which amendments were adopted BEFORE each subsequent question and refuses to promote the rejected proposal. Synthetic regressions guard eight actions, seven named rolls, one voice action, cumulative policy-state ordering, conflicting dispositions, provenance, and duplicated/positional keys.

The accompanying source-only [original-Journal verifier](../../src/evidence/minnesota-hf100-original-source-verifier.ts) checks original PDF-extracted action anchors, ordered tallies, proposed text cues and results against the fixed ledger. The [no-secret GitHub read-only original-PDF workflow](../../.github/workflows/senate-hf100-apr28-original-motion-text-proof.yml) **independently succeeded after repairing a real source-integrity bug**: [original-source verification run #38355438815](https://github.com/killjoy00/votepredict/actions/runs/38355438815), October 13, 2026. The exact original government PDF is **4,472,460 bytes**, raw PDF SHA-256 `9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3`, and independent extracted text SHA-256 `d07e50d4bd185f4fdebcb5ac8f857a232c83c672a2d990572aeec1ae5998856d`. The checker verified all eight distinct source actions, seven named tallies, and the one adopted voice action from the real official PDF. Source PDF and text hashes are now pinned in the source-only ledger; re-acquisitions must independently match.

**Discovered source-provenance defect requiring historical caution.** An initial text-success workflow [#38355244312](https://github.com/killjoy00/votepredict/actions/runs/38355244312) returned SHA-256(empty) `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` and **0 PDF bytes** despite parsing the full journal text and named tallies. Root cause: `fetchSenateJournal` calculated raw-source digest/size *after* the PDF worker potentially detached the `Uint8Array`. This PR fixes the raw byte hash/size calculation **before** parser/worker creation, adds simulated-buffer-detachment tests, and makes the original-source audit fail on empty, malformed, mismatched, or SHA-drift receipts. Independently, the House Research legislative-summary PDF backfill (`src/operations/historical-house-research-summary-backfill.ts`) exhibited the same hash-after-worker pattern and is repaired **for future fetches only**. The existing Senate committee minute fetcher passes a **copy** of its original byte buffer into the parser, so it does not share this exact source mutation pathway.

**Impact boundary:** Existing stored `source_documents` SHA-256 identities, `bill_versions` and House Research summary receipts have **not** been audited row-by-row. An incorrect hash in previous source acquisitions is a credible lineage hazard, **not independently proven corruption of every existing journal, roll, report or historical evidence row**. No production DB or historic ingestion was read or changed. Preserve all old revisions; any source-document repair requires separate authorized protected SELECT-only source-to-stored comparison and append-only lineage reconciliation. Neither original source SHA nor the observed source motion sequence independently proves historical before-vote public-by clocks or private stored-event parity.



### Follow-up: official May 19 HF100 conference report, THREE roll calls, and midnight legislative-day clock

The original [74th-day May 19 Senate Journal](https://www.senate.mn/journals/2023-2024/20230519074.pdf), printed pages **9817–10084** (report text pp9817–10083; three decisions pp10083–10084), and separate official [Senate May 19 legislative floor log](https://www.leg.mn.gov/archive/leg/floorlogs/senate/2023/20230519slog.pdf), PDF page 2, independently prove **three distinct named divisions**. These must not be collapsed because the latter two recorded identical 34–32 totals:

| Sequence | Exact Senate legislative motion | Named roll | Floor-log local clock | Recorded result and YEA interpretation |
| ---: | --- | --- | --- | --- |
| 1 | Rasmusson motion to **reject** the conference report and return HF100 to conference committee | 32–34 | **11:13 p.m.** | Failed; a YEA supports *rejecting and reopening conference*, not the report |
| 2 | Port motion to **adopt** the conference report, replacing legislative provisions | 34–32 | **12:45 a.m.** | Adopted; a YEA supports accepting the report as a whole |
| 3 | Formal third-reading **repassage** of HF100 as amended by conference committee | 34–32 | **1:19 a.m.** | Passed; a YEA supports repassage *of the amended vehicle*, not every provision |

The clerks' **legislative day is May 19** even though the latter two recorded motions are **after midnight** and naturally correspond to an **inferred May 20 local calendar date**. This is a real example where a simple `vote_events.occurred_on` DATE or Revisor status date loses motion sequence and clock granularity; the official floor-log clock is not itself proof of an absolute UTC timestamp nor of when legislative text first became publicly accessible. A 12:45 a.m. report-adoption tally should never be used as a stand-in for the distinct 1:19 a.m. repassage tally.

**Two independent complete original government PDFs SHA-proven.** Dedicated [original dual-source run #38356387990](https://github.com/killjoy00/votepredict/actions/runs/38356387990) independently downloaded and checked:

- Full **714-page** original Senate Journal: **10,452,382 bytes**, raw SHA-256 `58d5e75bfe0a2181957e69a2f9a70f8bdfc5d88414a8234cc89f438d3c730d25`, extracted text SHA-256 `4612929e0aa374d8c583f8c573ceb3a410df6a279cb5bc31b7a515e21104a385`.
- Exact original Senate floor-log PDF: **96,361 bytes**, raw SHA-256 `c38ebfc43d8150742c44ee2541c596822a85757e3838de806bbdad8381e94c7e`, extracted text SHA-256 `b1e5654d8fe7a06b381fc1c3f7414e7017d658f40f6b1cca6ac741c32b3bfdf7`.
- The Senate Journal's **complete conference committee replacement text** from "Delete everything after the enacting clause" up to the report's ending was independently delimited and source-hashed: **726,984 normalized characters**, original-document extracted-text SHA-256 **`d54bdb5cfd025ed02e8809c092a1fe9ed8e9d7b26386a9d2332aa047dce422ba`**. This authenticates the particular printed paper considered on the Senate floor, **not** yet which Revisor `/versions/ccr/0/` versus `/versions/ccr/A/` is fully identical to the 726,984-character extracted version.

The metadata-only [conference report source ledger](../../data/evaluation/senate-hf100-2023-conference-three-rolls-v1.json), [pure source verifier](../../src/evidence/minnesota-hf100-conference-source-verifier.ts), and [live source/clock proof](../../scripts/audit-hf100-may19-original-conference.ts) preserve **three separate yes-vote meanings**, original clock chronology, raw/document/text hashes and exact unknown first-public-by, with synthetic adverse evidence tests. Historical *stored* DB event identity and individual member parity remain **unverified**; protect accepted records. No raw 714-page PDF, floor log, complete conference text or named roster has been committed here.


## Official example: HF5247 transportation omnibus (2024)

[Existing independently source-verified research](./senate-media-2024-hf5247-actual-transport-policy-version-crosswalk-20261012.md) documents an important policy-provision change, not a generic “transportation vote” label.

| Source document | Exact public Revisor link | Previously verified original SHA-256 | Selected provision evidence |
| --- | --- | --- | --- |
| Third engrossment | https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/3/pdf/ | acdf6e4f5b1d288a55022bfbfa9be68d7760c6257fca22a33801f9b50e5cef4b | Four selected distinguishing translated-DVS policy cues absent from full body |
| First unofficial Senate engrossment | https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ue/1/ | 0ac7ca21c2b31fb617fd39e9d03f07de0d7547ba9c6762e763182061759fa0ce | Those same selected cues absent |
| Conference committee report | https://www.revisor.mn.gov/bills/93/2024/0/HF/5247/versions/ccr/0/pdf/ | 61e758157d10fbde5a1873376e274604c394b103a0e22cf58f569ffb7fb48663 | Individual “equivalent materials,” “qualifying language,” “deputy registrar” cues present; the prior study's strict four-part compound phrase check remained false |

The prior original-source research verified **three distinct Senator Hawj YEA roll calls**: May 7 third reading (55–10); May 19 conference decision (34–12); May 19 amended third reading (34–14). It expressly **excluded interpreting May 7 as a vote for the translated-DVS-materials SF3257 provision**. May 19 is a conditional, not definitively time-eligible, crosswalk: no demonstrated exact text-publication minute before the two rolls; a later enrolled/engrossed version cannot replace the earlier acted-on source. These original source hashes are pre-existing receipts, **not new source re-downloads in this audit**.

## Exact identity warning: February 14, 2024 Education Policy

[Original government Minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/educ/20240214/educ_20240214_Minutes.pdf) and [prior independent SHA-authenticated review](./senate-864-2024-education-repeated-amendment-six-rolls.md) record numbered amendments **10, 2, 3, 5, 6, 9**, each separately put to a **4 YEA / 6 NAY failed** roll with the **same ten member choices**. Earlier parser candidate observations: **2**; actual original named amendment motions: **6**; discrepancy: **4 candidate observations** for this exact PDF. That is not a finding of four confirmed absent or corrupted production vote_events rows. Event-key replay is expressly held by [the existing positional-key risk report](./senate-864-parser-v3-positional-event-key-replay-hold.md).

## Numbers with true scope

| Observed/audited population | Verified or previously source-authenticated finding | Statewide inference? |
| --- | --- | --- |
| HF100 Revisor versions (one bill) | 17 listed, 4 structurally missed by old numeric-only discovery regex | No |
| HF100 Apr 28 original Senate journal printed pages 6883–6891 | **8 distinct source actions: 5 amendment decisions (4 adopted, 1 rejected), 2 procedural decisions, 1 passage; 7 named divisions and 1 voice-only action** | No stored-row identity/parity or statewide coverage claim |
| HF100 May 19 legislative-day conference sequence | **3 separately named source rolls: 32–34 rejection, 34–32 report adoption, 34–32 final repassage** | Original government log crosses midnight; no verified DB stored-row parity or precise UTC clock |
| Feb 14 2024 Education Minutes | 6 source amendment motions; 2 earlier parser candidates; 4 source-candidate gap | No |
| Prior #864 electronic linked Senate Minutes corpus for 2022–25 | 1,452 original PDF links/source bodies independently reverified | **Not** official all-meeting or all-vote denominator |
| Earlier vs v3 named parser candidates in above corpus | 104 versus 112 (**8** additional candidate observations) | **Not** new stored rows or complete official vote count |
| Prior electronic meeting index with no linked Minutes PDF | 141 entries | Do not assume no votes |
| 2021 official printed Minutes, 2022 print/electronic parity | Unresolved | Not zero |
| Whole 2021–25 exact-motion/verifiable-text, bill-only, missing amendment, procedural-error, wrong-version, omnibus unresolved counts | **Unknown** until authorized full official-event universe plus protected read-only stored mapping | No invented denominators |

Previous source audit: [#864 original-pdf and database reconciliation design](./senate-committee-source-to-db-reconciliation.md). Required SELECT-only export is deliberately not run without separate reviewed authorization. No numeric aggregate from a sample is substituted for the missing population.

## Changes included in this branch

The pure **src/evidence/minnesota-vote-text-alignment-audit.ts** does not query production data. It finds *all three official URL families* in Revisor status HTML (including alphabetic CCR IDs), rejects cross-bill and untrusted source links, and tags independently verified public-by **null** rather than treating “Posted on” as certified publication time.

It audits vote-to-text links on exact event identity, same session/bill, original source hashes, reported motion locator, recognized amendment text and exact reference **or independently reviewable page/sequence anchor for unnumbered Senate amendments**, unique conference report, and no later-version substitution. It requires explicitly reviewed *independent primary-source proof* to mark a reviewed link. This is **consistency validation of a supplied human-reviewed source mapping**, not independent text authentication by itself. Results always disallow inferring support for a provision, whether passage or procedural.

A separate deterministic line-based version diff emits source-backed before/after SHA-256, original line deltas, excerpt/truncation metadata and an explicit **unclassified** policy-change label. Long omnibus texts return **needs_chunking**, not an inaccurate comprehensive comparison or generated policy verdict.

The Senate ingester **future-write mapping only** now persists its already-parsed amendment reference without altering event keys, rosters, or acceptance tests. **Do not rerun** legacy journal/committee imports, apply DB migrations, overwrite historic vote rows, or ship this audit into serving. Synthetic and SQL-contract regression tests guard the changes.

## Ranked open defects and next gain

**P0: append-only event-text link layer** — design a reviewed relational table associating exact vote event, base/companion bill text, amendment or conference report, source URLs+SHA, official motion/journal locator, considered/adopted/rejected/withdrawn/superseded state, version date and separately nullable proven public-by, reviewer/method/version, and conflicting revisions. Never join to “latest” by default.

**P0: safe committee-event key reconciliation** — source-original-to-protected-stored SELECT-only inspection before parser v3 2022–25 backfill. If old motion anchors were never preserved, HOLD rather than inventing a match.

**P1: recover acted-on papers and ordered bill lineage** — HF100 Senate amended paper and exact May 19 CCR, HF5247 May 7/19 source-time eligibility, amendment originals, fiscal notes and section-referenced committee analyses; distinguish proposed, adopted, rejected and later enacted status. Compare bounded article/section text using primary hashes and official locators rather than guessed topic labels.

**P1: close as-of risk after separate authorization** — runtime historical candidate selection currently allows same-day “posted” version at a date-only roll and an update-on-conflict hash. Introduce explicit as-of provenance and immutable content revisions under separately reviewed serving migration; no serving changes in this branch.

**P2: complete official event universe** — 2021 print minutes, possible 2022 print-only, missing linked Minutes meetings and official journal amendments/reconsiderations; preserved count-only/voice observations are not invented named senator votes.

**Recommendation: improve the existing event-to-text linkage first.** The archive already contains significant vote and bill-text raw material, but the relationship from a motion to the exact text is unproved. Targeted additional **primary text/availability collection** remains essential for missing amendments, substitutes, conference papers and print minutes. Hold any production migration, re-ingestion or model use until separately authorized and independently validated.
