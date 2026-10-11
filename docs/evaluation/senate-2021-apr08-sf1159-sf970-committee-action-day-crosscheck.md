# #864 — April 8, 2021 official Senate committee bill-level actions vs April 12 Journal amendment reports

**Status: two genuine original Senate bill-log HTML sources successfully acquired and fingerprinted, not amendment-motion-day verification.** This historical public-source-only audit identifies **April 8, 2021** as the official Senate website's bill-level *committee action day* for both bills that have three distinct named committee-amendment rolls in the April 12, 2021 Journal. The [first real source run #38176218037](https://github.com/killjoy00/votepredict/actions/runs/38176218037) succeeded 2/2 with zero source errors; all original HTML byte counts and SHA-256 are preserved below. A separate SHA-pinned original re-acquisition is a second proof gate. **Do not silently assign the three individual amendment motions to April 8 based on the bill logs alone.**

## Cross-source identification

| Committee | Bill | Senate committee bill log — discussion only | Senate committee bill log — bill-level action | Original April 12 committee Journal |
|---|---|---|---|---|
| Transportation Finance and Policy | **SF1159** | **Apr 6, 2021** | **Apr 8, 2021**: amended, recommended to pass; log also says re-referred to Transportation Finance and Policy | p2086: **Dibble amendment**, 4 YEA / 6 NAY, not adopted; **separate McEwen amendment**, same 4/6 sides but different motion, not adopted |
| Judiciary and Public Safety Finance and Policy | **SF970** | **Apr 7, 2021** | **Apr 8, 2021**: amended and recommended to pass | p2147: **Pappas amendment**, 3 YEA / 6 NAY, not adopted |

The Senate's own dated entries label these sections **“UNOFFICIAL STATUS”**. They establish an independent Senate website observation of the bill-level April 8 action date but cannot provide the roll-call clock, amendment-specific hearing day, member absences, first-publication time, or individual public-by date.

The [original April 12 daily Senate Journal](https://www.senate.mn/journals/2021-2022/20210412036.pdf) and the strict [three-motion original-source handoff](senate-2021-apr12-rule1210-three-original-amendments-authoritative-handoff.md) are the authoritative motion texts/proposer identities/side hashes. **The April 12 Journal is a report dated April 12, not proof that these motions happened April 12.** The candidate April 8 bill-action day is not yet a verified vote-event `occurred_on` date.

## Original public Senate committee bill-log sources

- [Transportation Finance and Policy, 2021–2022 official Senate bill log, original SF1159 section](https://www.senate.mn/committees/committee_bill_log.html?cmte_id=3102&ls=92). Its displayed bill identity is `S.F.1159`, status `SF1159`; original entries include Feb 25 laid over, Apr 6 discussion only and Apr 8 amended recommendation.
- [Judiciary and Public Safety Finance and Policy, 2021–2022 official Senate bill log, original SF970 section](https://www.senate.mn/committees/committee_bill_log.html?cmte_id=3099&ls=92). Its displayed bill identity is **`S.F.0970`, status `SF0970`** (four-digit zero padding is significant to the exact source parser); original entries list Apr 7 discussion only and Apr 8 amended recommendation.

The [official Senate Revisor SF1159 history](https://www.revisor.mn.gov/bills/92/2021/0/SF/1159/) and [SF970 history](https://www.revisor.mn.gov/bills/92/2021/0/SF/970/) independently label the recorded Rule 12.10 committee rolls in the Apr 12 Journal. Those report dates remain distinct from Apr 8 Senate committee action status.

## Original HTML bytes and reproducible first-source proof (October 11, 2026)

The [first original Senate source workflow #38176218037](https://github.com/killjoy00/votepredict/actions/runs/38176218037), merged from [PR #1146](https://github.com/killjoy00/votepredict/pull/1146), **COMPLETED SUCCESS** and independently acquired both real original Senate HTML pages. The exact bytes, not just the website snippets, passed bill-local meeting day and result checks:

| Bill log original HTML | Bytes | SHA-256 |
|---|---:|---|
| SF1159 Transportation | **658,255** | `a993750509e0f5be5db4c0d9af186298a5328f830d1d6a4c2ccd9cc7ad70952e` |
| SF970 Judiciary | **414,785** | `f63ad26f43a7d4c086d14608d69ba236b9bb6c9be2e3e3970e0dcb9e7fa1d5c3` |

Original run artifact **#11716255550** was independently downloaded as ZIP **1,015 bytes**, SHA-256 `6b5fa556f16c7b52dde9a8950a8cb1cad0b8dd50b870804a7756e64e939d60f2`; decoded metadata `source.json` **2,727 bytes**, SHA-256 `45c6b89030e9d73ae598ef0bd7fc2356dbb01dd73fe41befde1472f78c61d0e7`. Permanent original-source metadata and hold definitions: [two-log first-original receipt](source-proof/senate-2021-apr08-two-original-committee-bill-log-first-source-success.json). The separate one-time second source workflow must reacquire and pass **both exact pinned original HTML SHA-256s and lengths**; original retrieval changes are a failure, not an excuse to edit historical observations.

**Only the bill-level April 8 action day is authenticated here.** All individual amendment `occurred_on` days, first-public-by times, 2021 print-minute parity, historical stored row comparisons, and 2022 print/electronic reconciliation remain unproved.

## Independently indexed historical hearing material, not yet heard

The original [Senate Granicus archive publisher index](https://mnsenate.granicus.com/ViewPublisher.php?view_id=2) separately lists these April 8 committee hearing agendas and archived audio recordings:

- [Transportation Finance and Policy, Thursday Apr 8 at 3 PM — archived agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6934&view_id=2), explicitly states **SF1159 hearing includes committee action** after public testimony Apr 6. [Archived original MP3 lead](https://archive-video.granicus.com/mnsenate/mnsenate_b2093896-2a28-44fd-9393-33fa3744382e.mp3). No playback/transcript or motion timing proof yet.
- [Judiciary and Public Safety Finance and Policy Apr 8 recording, segment 1 agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6938&view_id=2), [archived MP3 lead](https://archive-video.granicus.com/mnsenate/mnsenate_20d7c6b1-a4bc-4c26-ba19-5add98aa58fb.mp3). [Segment 2 agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6939&view_id=2), [archived MP3 lead](https://archive-video.granicus.com/mnsenate/mnsenate_8385ded0-146c-41c5-a50e-52056c5596ae.mp3). Both are unlistened/untranscribed research leads, not roll-call certificates.

**Next historical proof gate:** corroborate *each individual amendment*, not just the bill, against an original motion-level dated Senate audio passage or the original 2021 **print** committee minutes. When the motion day is demonstrated, the owner-selected historical availability convention uses that actual hearing calendar day (next-day eligibility only; no same-day timestamp inference). Original print minutes are not digitally collected by the LRL. No public office or library will be contacted in this research workflow.

## Safe code, verification and acceptance boundary

- `src/evidence/senate-2021-apr08-rule1210-hearing-action-crosscheck.ts` consumes the two fixed original HTML bill logs and fails on altered source committee, bill-local dates, result, or two-bill/three-motion mismatch. No raw PDF, vote-side names, or motion text are written. Synthetic tests deliberately attack unrelated-bill dates and absent target bill action.
- `scripts/probe-senate-2021-apr08-official-bill-actions.ts` streams exactly the two Senate HTML sources with a hard per-page 2 MB cap, fingerprints the original bytes and emits **metadata only**, with no official-site content body or private source rows in the artifact. The original first workflow completed SUCCESS and its artifact was independently checked; the separate strict second-source workflow enforces the genuine initial original HTML byte/SHA pins. Full PR CI alone never substitutes for inspecting each original-source job and downloaded artifact.
- `verifiedMotionOccurredOn=null` and `independentlyProvenHistoricalPublicBy=null` intentionally remain unresolved for all three roll paragraphs until an additional motion-level source. **Never infer attendance, printed absent zero, database missing votes or duplicate motions from this bill log.**
- No legacy evidence row updates, private production SELECT, database writes, floor expansion, current serving/forecast/model changes, scheduler, or 2027 work. Official 2021 Senate print-minutes meeting/vote denominator and 2022 print/electronic parity are unchanged. Issue [#864](https://github.com/killjoy00/votepredict/issues/864) stays **OPEN**.
