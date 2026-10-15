# Issue #864 — recover 2023 no-linked-LRL-Minutes meetings from official Senate online Clerk minutes

**Source-recovery strategy:** the *original Minnesota Senate website's archived committee hearing Minutes HTML* is a genuinely different public official source family from the LRL electronic Minutes-PDF index and from the LRL meeting media/caption pages. The independent 2023 LRL census listed **64 actual indexed committee/date meetings without linked electronic minutes**, including **37 Taxes** and **22 Agriculture, Broadband and Rural Development**. We do **not** turn that LRL missing *PDF* link into a no-minutes, no-recorded-motion or no-vote conclusion.

The preliminary online Senate lookup located actual archived **Clerk Minutes** pages for 14 exact LRL no-PDF committee dates. Example government source pages:

- [2023-03-20 Agriculture, Broadband and Rural Development original Clerk minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17807&ls=93): multiple distinct SF2128 amendment decisions (A-1, A-2 and A-3) and recommendation actions, separate SF2513 and other amendment decisions. The source states *motion prevailed*, without automatically proving any specific senator voted yea or nay.
- [2023-03-01 Taxes original Clerk minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17695&ls=93): SF1811 A23-0028 amendment motion prevailed, distinct from subsequent layover.
- [2023-03-01 Agriculture original Clerk minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17657&ls=93): SF1879 A-1 amendment; SF1879 as-amended recommendation; SF2218 A-1 amendment. These are separate decisions.
- [2023-01-10 Taxes original Clerk minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17328&ls=93): original described hearing discussions; no automated no-vote inference.
- [2023-04-17 Taxes original Clerk minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17987&ls=93): SF3208 A4 adopted without a named tally; SF73 A138 amendment **and** the subsequent SF73 recommendation each have a **separately recorded aggregate 6 YEA / 3 NAY / 1 absent roll call**. The published text does not name how individual senators voted. Treat these as two source-distinct count-only decisions, not as individual votes.

Other exact public Senate 2023 hearing IDs, all date-keyed against the independently SHA-verified LRL original no-Minutes ledger, are recorded in the audited allowlist: February 1, 13 and 15 Agriculture; January 12 and March 2, 7, 9, 14 and 16 Taxes. There are **14 unique meeting identities**, in two high-gap committees. None are synthetic committee names or same-day wrong-committee substitute records.

## Verifiable implementation and source safety

The [source validator](../../src/evidence/senate-864-2023-online-missing-minutes.ts) and [one-time original fetch](../../scripts/capture-senate-864-2023-online-missing-minutes.ts) are intentionally narrow:

1. Fetch the **existing authenticated original 1,592-meeting LRL index payload** from run 38065594898; verify exact prior SHA256 and the frozen **141 no-linked-PDF meeting identities** using existing, tested code. Every target **must** match exactly one 2023 no-PDF committee, date and unique hearing ID.
2. Fetch only the 14 reviewed original HTTPS Minnesota Senate hearing-minute HTML URL identities (explicit hearing ID; 2023 legislative session 93; actual Minutes). No redirects to other hosts/sites, no unknown IDs, strict MIME, 1.2 MiB streaming caps, text integrity, and independently recorded 2026 retrieval date.
3. Independently verify real Clerk Minutes header, **exact committee and hearing day**, plus attendance-context section. Hash original entire HTML body, then hash normalized text. Preserve actual hearing day as event-day evidence; **earliest 2023 HTML-publication date remains UNKNOWN**, not asserted equal to hearing day merely because content is available now.
4. Extract only bounded, source-attributable **result-only and explicitly count-only parliamentary motions**: unique mover/motion/result paragraph, next bill heading and amendment marker where the original actually supports them, original nearby passage SHA, source action text excerpt, explicit result, and original normalized-text offset. Outcome-only statements **do not prove a numeric tally, named YEA/NAY, unanimity or voice vote**. A separate explicit motion-local roll-call numeric tally may support **aggregate YEA/NAY counts** only, without inferring any specific person's choice; the parser rejects contextless or ambiguous numeric statements. No individual votes are inferred from attendance. Unrecognized actions remain unknown and can be manually audited later. Some discussion-only original minutes correctly yield *zero parser-recognized* actions **without** asserting zero real votes.
5. Publish the source-to-meeting/motion JSON ledger plus categorized unresolved holds, with raw original source bodies and any private database rows excluded. No production DB, existing old event-key replay, models, forecasts, schedulers, source-time publication claims, floor votes, or agency outreach.

The [tests](../../tests/senate-864-2023-online-missing-minutes.test.ts) protect against wrong committee/day, cross-bill attribution, conflated amendments, wrong source URLs, inferred member rows, mistaken zero-vote statements and unsupported publication dates.

**How to verify actual original-source execution:** [PR source-only CI workflow](../../.github/workflows/senate-864-2023-online-missing-minute-originals.yml). Its generated downloadable original-source receipt contains each returned official full-body SHA and extracted motion candidates. Do not declare a source independently reverified until that run passes. Keep source SHA failures or unexpectedly changed original HTML as **HOLD**, not no meeting/minutes.

## Proven original first-pass and context-count safeguards

The first independent exact-source run [#38339492898](https://github.com/killjoy00/votepredict/actions/runs/38339492898) already recovered **14/14 original Senate HTML bodies** with zero source holds and **33 first-pass result-only candidates**, before the new aggregate-vote grammar was introduced. Source interpretation under the revised parser must be reported against a **new exact original CI receipt** (old run counts must not be silently updated). The April 17 published source independently demonstrates at least two distinct count-only aggregate rolls, 6–3 with one recorded absent member, and therefore explains why treating every `motion prevailed` as wholly result-only loses supported tally information. The new parser tests prohibit a roll-call phrase or numeric tally floating outside the matched motion from becoming a member vote. The official all-motions denominator and all individual positions remain unknown.

## Verified result and permanent source hash manifest

The reviewed [exact source-only original run #38339994639](https://github.com/killjoy00/votepredict/actions/runs/38339994639) **SUCCEEDED** after the amended-roll grammar repair. **All 14/14 original Senate Clerk hearing-minutes HTML bodies** were independently fetched and verified against the frozen LRL 2023 missing-PDF index; **zero source holds** and **8/8 narrowed original/no-inference tests passed**. The source parser conservatively recognized **33 motion-result candidates: 31 result-only plus two explicit aggregate/count-only roll calls**. Both count-only rolls are **2023-04-17 Taxes, SF73 A138 amendment and the distinct SF73 recommendation, each 6–3 with one printed absent**. No original named-member YES/NO decisions were inferred or exported, and this audit is not the official complete roll-call denominator.

Permanent machine-readable, per-hearing **raw original HTML SHA-256, normalized-text SHA-256, exact public Senate hearing ID/URL, Clerk committee/day, 2026 fetch receipt, and parser category counts** are committed in [14 immutable original-source receipt entries](./source-proof/senate-864-2023-14-senate-online-original-html-source-receipts.json). The [temporary actual source-to-motion artifact #11786463448](https://github.com/killjoy00/votepredict/actions/runs/38339994639/artifacts/11786463448) is pinned by archived ZIP artifact SHA-256 and contains the per-action source-microtext/offset outcome evidence; ZIP SHA-256 is 8a0f31a90127ad099ff8ab52e718bd13e586f3de08f94d2bbad9e2413c635518. Regression tests check all 14 original SHA receipts, exact meeting identities and the 31/2 partition so that short-lived Actions artifact expiry does not erase the original acquisition proof.

The 2023 LRL index still has **64 meetings with no linked electronic PDF**. Of those, **14 now have separately authenticated original Senate online written Minutes** from this bounded research; the other **50 have not been authenticated through this *new* source route**. This is not a claim that the other 50 have no Clerk minutes or that the original 14 have no LRL printed-volume counterpart. 2021 separate printed volumes, 2022 print/electronic differences, the 2024 missing-YEA identity and safe stored-row parity remain **UNKNOWN**. Exact historical original Senate online page first-public-by date stays **null**, not equated to current retrieval or the hearing date.

### Independent per-committee denominator crosswalk for the unrecovered 50

The [per-original-indexed-meeting 64-row crosswalk](./source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json) joins the frozen official 2023 LRL 64-no-PDF roster to exactly the 14 original Clerk-HTML source receipts, preserving **all 50 still unverified alternative-source meeting identities** by precise official committee/date. No source unverified means no meeting/vote:

| Committee | LRL indexed, no linked PDF | Clerk HTML authenticated | Alternate HTML not yet authenticated |
|---|---:|---:|---:|
| Agriculture, Broadband and Rural Development | 22 | 5 | 17 |
| Education Finance | 3 | 0 | 3 |
| Environment, Climate, and Legacy | 1 | 0 | 1 |
| Jobs and Economic Development | 1 | 0 | 1 |
| Taxes | 37 | 9 | 28 |
| **2023 official electronic no-PDF meetings** | **64** | **14** | **50** |

The same crosswalk pins the 14 original SHA/doc IDs, 31 result-only and two count-only candidate counts, and explicit null values rather than invented missing-source actions for the 50 other meetings. The validation test rejects duplicated committee/date rows, unlinked wrong-year source pages or dropped official LRL denominators.

## Next bounded expansion if original-source authentication succeeds

The proof pipeline can then expand its allowlist against the **remaining 50 indexed 2023 no-LRL-PDF committee meetings** (the 14 are 9 Taxes and 5 Agriculture; remaining groups include the other 28 Taxes, 17 Agriculture and five other committees). Because original 2023 official hearing-page IDs are not implied by LRL mtgid IDs, require independent match of original URL/hearing ID, exact committee and date before adding. Prioritize the high-action-density original caption windows on March 15/29 Agriculture and April 17 Taxes. Recorded hearing minutes are much stronger for distinct paper motions than a generic caption saying “all those in favor,” but **a result-only Clerk minutes paragraph is still not a named roll call**.

The 2024/2025 no-PDF hearings, printed 2021/2022 LRL uncertainty, parser-v3 positional event-key replay HOLD, one 2024 absent stored YEA and source-to-current-private-storage equality remain separately unresolved. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
