# Minnesota Senate committee vote/action timing — historical 2021–2025

Decision for [historical completeness issue #864](https://github.com/killjoy00/votepredict/issues/864): **use the public committee hearing date as the available-on date of committee votes and motions recorded in official minutes**. This is the historical research convention selected by the owner; no separate publication timestamp for the written minutes is a prerequisite for dating the meeting action.

Implementation: `src/evidence/senate-committee-meeting-timing.ts` is a single validated date-only contract, applied by `scripts/backfill-senate-committee-minutes.ts` to all three ingestion cases:

| Minute observation | Hearing day | Historical availability | Member YEA/NAY inference |
| --- | --- | --- | --- |
| Named roll call | `vote_events.occurred_on` and `evidence_items.published_at` day = hearing date | Hearing date | Only explicitly named recorded choices |
| Count-only roll call/division | Same | Hearing date | **No individual votes** |
| Voice vote, unanimous motion or result-only action | Context evidence day = hearing date | Hearing date | **No individual votes** |

`source_documents.fetched_at` remains the actual later collection time for provenance, not an alternative date for the vote. `metadata.meetingDateIsAvailability=true`, `metadata.availableOn=YYYY-MM-DD`, `metadata.availabilityProof=public_senate_committee_meeting`, `metadata.asOfEligible=true`, `metadata.dateGranularity=day` are explicit.

**No intraday inference:** the stored `published_at` ends in `23:59:59.999Z` solely to encode the asserted hearing **calendar date** for existing date-based storage. This is **not** a claimed real meeting timestamp or an assertion about the PDF upload time. `sameDayEligible=false` remains mandatory. A vote or remark at a committee meeting on date T can affect **date-exclusive T+1** research but not predictions with a date-only cutoff at T. This avoids learning a committee vote later in the day before an earlier floor vote on the same date.

**Source coverage remains separate:** the collection does not contain official 2021 print minutes. The 2022 online collection may differ from print. This rule dates **collected, source-verified** committee votes; it neither fabricates missing meetings nor implies every motion recorded a per-senator vote.

**Existing-row migration not executed:** this PR updates the offline-tested parser/backfill rule. It does **not** connect to production, change existing `evidence_items`, or rewrite frozen historical evaluation data. Existing records ingested with `meetingDateIsAvailability=false` remain under the old rule until a separately reviewed, idempotent historical correction. Blindly rerunning the backfill against those rows could duplicate `evidence_items` because their ingestion identity hashes include `published_at`; do **not** rerun production ingestion before a controlled audit and repair plan. `vote_events.occurred_on` was already the hearing date and requires no change.

The Senate floor source and frozen scoring/training code remain unchanged. Campaign-finance legal-release timing, campaign-website inventories and attributable press remarks are the other distinct historical workstreams tracked by #864.
