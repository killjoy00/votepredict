# Issue #718 — self-service 2021 Senate public-records pass

_Checked: 2026-10-08. This is an outcome-blind **discovery audit only**; zero new historical feature/evidence rows._

## Standing operator restriction — no contact or requests

**DO NOT CONTACT THE MINNESOTA LEGISLATIVE REFERENCE LIBRARY OR ANY OTHER OFFICE TO REQUEST 2021 MINUTES.** The project owner has expressly and repeatedly ruled out external outreach for this work. Do **not** email, call, draft or queue emails/letters, submit forms, request digitization, organize an in-person visit, use intermediaries, or ask the owner again to authorize a records request. Work **only** with publicly accessible online material that can be accessed independently. If the only path to a record requires staff assistance or private access, mark it `unavailable_self_service` and stop that source lane. This restriction is not an invitation to prepare another outreach package.

Earlier #784/#785/#786 request-package and offline-intake artifacts remain immutable historical/provenance infrastructure, **not outstanding to-dos or permission to solicit records**. Reusing a date/bill targeting table for public online discovery is fine; executing its original "please locate/digitize" wording is not. No email, outreach, or request was sent during this pass.

## Frozen target boundary (unchanged)

Canonical https://github.com/killjoy00/votepredict/issues/718#issuecomment-6042877121: top ten 2021 Senate committee groups, 85 committee/target associations, 62 unique target events, 57 unique bills, 4,154 *potential* uncovered member-event rows. These are opportunities, not recovered evidence. The source request package (GitHub Actions artifact `11496898656`, archive SHA-256 `c7d6d274dd734878efbb830a1c8c17a35afb1503e30ca4917cefc8e1d39fb26e`) is used **only as an immutable target/date index**. Original association CSV: `historical-density-2021-senate-print-minute-request-targets-v1.csv`.

Each independently found meeting below was checked against the CSV for the same committee, explicit bill identifier and `request_window_start <= meeting_date < request_window_end_exclusive`. These checks do **not** establish that the bill was discussed, that a senator spoke, or that the recording itself has been fetched/verified.

## Independent public-source findings

Public Minnesota Senate audio archive: [Granicus 2021 historical audio listings](https://mnsenate.granicus.com/ViewPublisher.php?view_id=2). The Senate's official committee agendas are independently indexed by the same archive; the eight links below are exact **2021** meeting agendas naming frozen target bills. They were not provided privately and required no contact.

| Meeting date | Senate committee | Bills explicitly listed on agenda and inside frozen pre-vote windows | Distinct frozen candidate-event associations | Source |
| --- | --- | --- | ---: | --- |
| 2021-01-12 | Civil Law and Data Practices Policy | `SF26` | 1 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=5664&view_id=2) |
| 2021-02-04 | Civil Law and Data Practices Policy | `SF193`, `SF395`, `SF529` | 4 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6032&view_id=2) |
| 2021-02-11 | Civil Law and Data Practices Policy | `SF440` | 1 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6148&view_id=2) |
| 2021-02-18 | Civil Law and Data Practices Policy | `SF672` | 1 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6256&view_id=2) |
| 2021-03-09 | Civil Law and Data Practices Policy | `SF1470`, `SF1807` | 2 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6545&view_id=2) |
| 2021-03-16 | Civil Law and Data Practices Policy | `SF226` | 1 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6681&view_id=2) |
| 2021-04-13 | Finance | `SF958`, `SF1098`, `SF970` | 5 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6960&view_id=2) |
| 2021-04-21 | Finance | `SF383`, `SF1160` | 2 | [2021 indexed agenda](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=7022&view_id=2) |

**Bounded result:** 8 distinct public meeting-agenda pages / **14 unique bill identifiers** / **17 distinct target-event associations** with strict date-window overlap. The 17 associations are a *subset* of the existing 85 frozen target associations and **must not be added to the 4,154 potential-row count**. Finance contributes 7 associations; Civil Law and Data Practices Policy contributes 10. This is online agenda discovery, not meeting-transcript or print-minute recovery.

Independent availability references:

- [Minnesota Legislative Reference Library legislative media archive](https://www.lrl.mn.gov/media/) describes Senate audio from 1991 onward and video from 2001 onward; individual meetings may not have both formats.
- [Public Senate video caption search](https://www.lrl.mn.gov/media/captions) provides automatically generated text and warns of errors. Captions require exact recorded speaker and source-audio validation, never automatic attribution.
- [Minnesota Senate committee information](https://www.senate.mn/committees) says official pre-2022 committee minutes are not provided as the ordinary self-service digital minutes collection. [LRL legislative history resource list](https://www.lrl.mn.gov/history/hist_resource) identifies 1999–2022 Senate print holdings. **That does not authorize contacting the Library**.
- The [Senate video archive](https://mnsenate.granicus.com/ViewPublisher.php?view_id=1) warns that legacy 2016–2022 Granicus archives are slated for deletion December 31, 2026. Prefer LRL public archive references and capture openly downloadable source bytes lawfully if available; do not infer that a particular video or caption is recoverable.
- Compare only exact official bill versions available before target: e.g. the [Revisor SF958 2021 status/version page](https://www.revisor.mn.gov/bills/92/2021/0/SF/958/) distinguishes its April 12 and April 13 engrossments and April 14 vote. Same-day version/excerpt evidence remains excluded absent independently proven intra-day ordering.

## Evidence status / limits of this pass

- `public_agenda_identified = 8`; `frozen_target_associations_with_dated_agenda = 17`; `source_recording_bytes_verified = 0`; `speaker_attributions_verified = 0`; `semantically_reviewed_member_statements = 0`; `new_evidence_rows = 0`; `integration_ready = 0`.
- A posted agenda may list a bill that was postponed or not addressed. It does not prove deliberation, sponsorship, a member statement or direction. Audio/video listings do not prove the exact recording payload was retrievable during this audit.
- I did not download or independently hash archived media bytes, inspect a full transcript, or verify a speaker utterance. This audit cannot claim that a verified strict-pre-vote statement exists.
- The 2021 **official print minutes** were not obtained. Public 2021 hearing *audio, video or captions* are a separate potentially useful provenance class and must not be mislabeled as official print minutes.
- No target vote outcomes were used; no production database was read/written; no Vercel, feature writes, model fitting, serving, or model-weight changes.

## Next permitted self-service actions

1. Starting with the eight links above, inspect public archive playback/download and caption availability. Reuse existing bounded read-only source infrastructure in `src/evidence/minnesota-senate-media-archive.ts`, `src/evidence/minnesota-senate-media.ts`, and `scripts/probe-senate-media-caption-source.ts`; don't duplicate an exhausted probe.
2. If a recording is publicly downloadable, independently record and hash exact bytes, meeting date, committee, source URL and retrieval/capture timestamp. Match each exact target by the immutable bill/date window; omit same-day target records unless independent ordering proves earlier availability.
3. Review the actual content for **explicit** bill mention and attributable member-specific directional statement. A caption alone, agenda title, referral, procedural motion, committee membership or later outcome must never create a stance. Fail closed if speaker, policy direction, timing or provenance is uncertain.
4. Pass only independently verified candidates to the existing semantic review gate. Preserve `contextOnly=true`, `mechanicallyActionable=false`, `modelWeight=0`, `integrationReady=false` until separate approved integration. **No model/serving change is authorized.**
5. If the public online record cannot be read or verified, report the exact unavailable/ambiguous count and stop. **No library contact, outreach, digitization request or manual acquisition escalation.**

## Follow-up: v1.8 target overlap and pinned public-audio byte probe (2026-10-08)

**Frozen-v1.8 evidence target computation only; no speaker/statement evidence found yet.** Independently inspected canonical GitHub Actions run [37647888556](https://github.com/killjoy00/votepredict/actions/runs/37647888556), matrix artifact `11494634289`. Confirmed immutable target set **135,457 rows** and canonical compressed NDJSON SHA-256 `42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700` and decompressed NDJSON SHA-256 `2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b`. Filter was explicit `2021-2022` **Senate** chamber, frozen exact bill ID in each official public 2021 agenda, frozen vote date **strictly after** agenda date, and no existing v1.8 exact-bill or reviewed directional feature on the member-event row.

| Public 2021 Senate agenda date | Frozen exact bills | Distinct matching later Senate events | Uncovered v1.8 Senate member-event rows |
| --- | --- | ---: | ---: |
| Jan 12 | SF26 | 1 | 67 |
| Feb 4 | SF193, SF395, SF529 | 4 | 268 |
| Feb 11 | SF440 | 1 | 67 |
| Feb 18 | SF672 | 1 | 67 |
| Mar 9 | SF1470, SF1807 | 2 | 134 |
| Mar 16 | SF226 | 1 | 67 |
| Apr 13 | SF958, SF1098, SF970 | 5 | 335 |
| Apr 21 | SF383, SF1160 | 2 | 134 |
| **Total** | **14 distinct bill IDs** | **17 distinct Senate target events** | **1,139 unique still-uncovered member-event rows** |

**These are entirely theoretical overlap opportunities, not a claimed source/quote yield** and not additions to the v1.8 `9 / 35,510` verified 2021–22 directional baseline. The 17 distinct Senate events here result from an exact-vote filter and should not be confused with the earlier 17 agenda-to-frozen-association hits from the 85 print-minute targeting associations.

### Pinned initial public source leads — bounded byte accessibility, NOT audio content

The [public Senate historical audio index](https://mnsenate.granicus.com/ViewPublisher.php?view_id=2) contains links that appear to correspond to three of the official dated agendas above. They are **candidate links**, not separately verified exact audio-to-meeting identities. April 13 Finance has two indexed audio entries, and April 21 Finance multiple parts; these three links do not represent a claim to complete recordings.

| Meeting | Agenda | Exact pinned MP3 candidate |
| --- | --- | --- |
| Civil Law Feb 4 | [clip 6032](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6032&view_id=2) | [MP3 candidate](https://archive-video.granicus.com/mnsenate/mnsenate_7edfc4ff-545c-4f41-af4c-53476171dbe1.mp3) |
| Finance Apr 13 | [clip 6960](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6960&view_id=2) | [MP3 candidate](https://archive-video.granicus.com/mnsenate/mnsenate_91f9beb5-353d-4047-be35-4bb7f4803654.mp3) |
| Finance Apr 21 | [clip 7022](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=7022&view_id=2) | [part-1 MP3 candidate](https://archive-video.granicus.com/mnsenate/mnsenate_1e0d21bb-646c-489e-bdef-fe7ee6ad4c29.mp3) |

The **one-time** [`historical-2021-senate-public-audio-byteprobe.yml`](../../.github/workflows/historical-2021-senate-public-audio-byteprobe.yml) is triggered when its own workflow file is first added to `main` (or through an explicit later manual dispatch). It attempts a **single 64-KiB HTTP Range GET per exact URL**, permits no redirected/custom hosts, cancels larger bodies, classifies HTTP/transport issues separately and hashes only retrieved prefix bytes. The report never records audio/transcript content and always returns `fullRecordingsVerified=0` and `directionalEvidenceRowsAdded=0`. No GitHub secret, production DB, Vercel, Library contact or archive-crawl mode is used.

A byte-prefix MP3 signature **does not establish a complete recording, its publication date, agenda-to-recording identity, exact spoken content or attribution**; if available, those checks would need a separate explicitly bounded full-source recovery and independent semantic review. If the probe reports HTTP/DNS/redirect failures, those are *source-accessibility findings from that specific runner*, not proof no archive exists.

### Independent House public floor-video alternative (not yet reviewed)

The official [2021–22 Minnesota House floor video archive](https://www.house.mn.gov/htv/archivesHFS.asp?ls_year=92) exposes bill-specific time markers. Its Apr 21, 2021 SF958 segment precedes a later Apr 22 House target vote, so it is a **candidate for source retrieval** only: no audio bytes, bill-specific words, attributable legislator statement, historic timestamp order, or directional evidence has been established. The Apr 22 [Session Daily report on HF1524/SF958](https://www.house.mn.gov/sessiondaily/Story/15922) is **same-day with the Apr 22 vote** and must not be used for that vote without an independent intra-day proof. Do not use current mutable pages as retrospective availability evidence. Never infer stance from floor agenda, bill labels, committee actions, or vote outcomes.

**Success criterion remains: genuinely recovered, hashed, independently available strict-pre-vote source, explicit named-member and bill mention, clear directional statement, and separate semantics.** Pending that, the 2021–22 strict directional count remains **9**; new evidence rows **0**.

## Conformance

Outcome-blind read-only desk research on official public web indexes plus local deterministic comparison to the frozen target CSV. No source bytes or speaker-level evidence claimed. Repo documentation is the only output; no source, production or evaluation result mutation.
