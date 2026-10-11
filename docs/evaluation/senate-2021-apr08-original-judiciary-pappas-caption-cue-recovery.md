# #864 — April 8, 2021 original Senate Judiciary caption recovery and strict Pappas motion review queue

**Scope: historical 2021 Minnesota Senate committee only, no floor vote, prediction, model or stored evidence import.** On April 12, 2021, the independently exact-original-authenticated Senate Journal reported **three separate committee amendments**: SF1159 Dibble (4–6 failed), SF1159 McEwen (**different motion**, 4–6 failed with identical original named-voter SHA sides), and SF970 Pappas (3–6 failed). **April 12 is the report date, not a certified motion-event day.**

## Original public 2021 April 8 Senate media source discovery — verified

The first genuine [original LRL/Senate source run #38177903789](https://github.com/killjoy00/votepredict/actions/runs/38177903789), introduced by merged [PR #1153](https://github.com/killjoy00/votepredict/pull/1153), **COMPLETED SUCCESS**, with the following independently original-source observations (full source metadata in [permanent first-run proof](source-proof/senate-2021-apr08-lrl-granicus-first-original-media-captions-access-success.json)):

| Primary original | First original bytes | First SHA-256 | Interpretation |
|---|---:|---|---|
| [Apr 8 Transportation Finance and Policy LRL media page](https://www.lrl.mn.gov/media/file?body=s&cid=3102&date=04%2F08%2F2021) | 89,044 | `a204640dcc0ea751fc867ae673492302a48b3dac4c0747475fab1c1ecc2291ce` | Exact committee and April 8 page header, one audio and one video tag, one auto-caption request |
| [Apr 8 Judiciary and Public Safety LRL media page](https://www.lrl.mn.gov/media/file?body=s&cid=3099&date=04%2F08%2F2021) | 96,070 | `98d4a9be8e08963121f332dcda6fbc602a07dc4a237b633011fc40a1ca2a4194` | Exact committee and April 8 page header, three audio and two video tags, two auto-caption requests |
| Senate Granicus Transportation [Apr 8 original agenda, clip 6934](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6934&view_id=2) | 2,874 | `dbe81f300affb35aaa25368a550f10258154c81c62db15f5e6c5248e93455a58` | Explicitly named **SF1159**, not a complete recording |
| Judiciary [clip 6938](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6938&view_id=2) | 3,078 | `71638dff52065ef1b6a5a1084e9c0fd88f536140b7a4553fa0789594dac8982f` | Explicitly named **SF970**, segment 1 original agenda |
| Judiciary [clip 6939](https://mnsenate.granicus.com/GeneratedAgendaViewer.php?clip_id=6939&view_id=2) | 3,078 | `19195564ad554bc78d051bbda75941f959dfa1d3823cdf562ca93eb7c6055530` | Explicitly named **SF970**, segment 2 original agenda |

**All three exact indexed Granicus MP3 URLs returned HTTP 403** in the GitHub Actions source run (no audio prefix bytes acquired). This does not mean the hearing audio does not exist. The indexed LRL media pages themselves independently expose separate audio and video indicators, **not authenticated underlying whole-recording bytes**.

First-source Actions artifact **#11716551428** was independently downloaded and checked as **2,395-byte ZIP** SHA256 `b7e499970e1dbe62a0cded2e913d5233bd4d1b0f4b41c21f1bb4c98556400343` and extracted **9,122-byte** `source.json` SHA256 `ba8a5e584999bc16819c0095e0a3f84cd03a40afa77bdcf27f537d7e6962b1b6`. These are artifact fingerprints, not the same as the full source bodies.

## Original Judiciary caption first-pass recovery — real source, speech **UNVERIFIED**

The same source run independently acquired **the actual first original** [April 8 Judiciary segment-1 LRL automatically generated caption endpoint](https://www.lrl.mn.gov/media/media_functions?type=getCaption&captionid=&strmp4=cmte_jud_040821.mp4): **436,144 bytes**, exact original SHA256 `6e37f661cb4ced4d33fdce7ed5af0a38cd57f9580efcf55ce5bc90e6ed92e84a`, **2,593 caption rows with data-time**, 2,594 table rows, 5,186 table cells, and **three** same-row unverified text cues mentioning **Pappas** alongside either an **amendment** or **roll call**. This is a real original-captions-source metadata finding. It is **NOT** original filmed speech, authenticated audible language, proof of the specific Pappas SF970 amendment happening April 8, or validated source member vote choices.

The other original caption leads were not acquired: Transportation `cmte_fintrans_040821.mp4`, and Judiciary segment 2 `cmte_jud_040821b.mp4` both returned first-run `network_or_source_error`, not a certified HTTP 404 or proof they do not exist.

### Strict second-source verification and timestamp-only review

- `src/evidence/senate-2021-apr08-judiciary-caption-original-cue-review.ts` pins the complete first-original caption **byte size and SHA256**. It requires a **real second independent fetch of exactly those original bytes** before accepting a timestamp cue as reproducible. A same-sized fake caption fails the SHA guard.
- `scripts/probe-senate-2021-apr08-second-original-caption-cues.ts` acquires only exact allowlisted public original caption URLs, bounded to 5 MB each. It extracts timecoded `Pappas + (amendment OR roll call)` **candidate rows** and thirteen-row neighborhood **SHA hashes** but emits **no raw sentence/transcript, other senator-side names or actual vote results**. It flags every candidate as `authenticMemberSpeechVerified=false` and `motionSpecificMeetingDateConfirmed=false`; this is an index for later playable source review, **not** a motion-day certificate.
- The same job makes exactly **one further attempt per two previously unavailable segments**. Any newly retrieved first-original payload from those files receives only provisional source-body bytes/SHA/cue counts, **not a two-independent-source certification**. Failures remain failures/unavailable for that run.
- The one-shot main push-to-workflow GitHub Action may succeed/ fail independently of the PR CI. Inspect actual separate [Actions workflows](https://github.com/killjoy00/votepredict/actions) and original downloaded artifact before claiming source re-verification or new caption recovery; a green CI build proves only code/tests.

## Interpretation and outstanding gates

The [original Senate April 8 official committee bill logs](senate-2021-apr08-sf1159-sf970-committee-action-day-crosscheck.md) and the LRL dated original media pages establish real **bill-level committee action and hearing media dated April 8**. Without matching **actual audible/video motion introduction, motion result and dated recording** or original **2021 printed committee minutes**, they do not individually pin the Dibble, McEwen or Pappas amendment event dates. The Journal's three original choice-side SHA commitments remain primary **reported votes**, not a basis for deducing same-day or member attendance.

The local metadata-only analysis cannot establish original caption publication time (archive page observed 2026), whether automated transcript generated today matches historical original audio, or legislative disclosure to a voter/target at time T. The owner-selected historical committee timing rule — actual hearing day as available-on, **next-day only** — applies only after a specific hearing event is proven. All three original amendment `occurred_on` fields remain **NULL**, independent historical first-public-by **NULL**, and no private source-to-existing DB comparison is authorized here.

Public self-service research only: **no email, calls, forms, outreach or digitization request to the Minnesota LRL, Senate or other offices**. No 2021 original print minute universe certified, no 2022 printed/electronic parity, no production database SELECT or writes, no `member_vote` import, forecasts, models, serving, scheduler, Senate floor expansion or 2027 changes. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) remains **OPEN**.
