# Flat, linked Minnesota Senate raw votes (2021–2026)

These **read-only PostgreSQL views** expose the pre-passage Senate committee
minutes and Senate Journal records already captured in
`source_documents.metadata->'rawPrepassageVotes'`. They do **not** copy,
re-parse, de-duplicate, certify, classify, or backfill raw evidence. They do
not change `vote_events`, `member_votes`, forecasts, model features, or
serving. Migration: `0024_senate_raw_vote_views.sql`.

## Views and join keys

| View | Grain | Important joins |
| --- | --- | --- |
| `senate_raw_vote_records_v` | One JSON `records[]` element | `(source_document_id, record_ordinal)` joins the existing `senate_raw_vote_bill_mentions`; role `mover`, `name_ordinal=0` joins the existing member crosswalk |
| `senate_raw_member_votes_v` | One JSON `memberVotes[]` element | `(source_document_id, record_ordinal, role='voter', name_ordinal)` joins `senate_raw_vote_member_mentions` |
| `senate_vote_trail_v` | One raw record **or** one official `vote_events` row per queried bill path | `bill_id` = requested root; `matched_bill_id` = bill on the event; `via_companion` is true only for a stored `bill_companions` pair |

`record_ordinal` is the JSON record's **1-based `ordinal`**, or its
**1-based position** in `records[]` when absent. `name_ordinal` is the
**0-based position** in `memberVotes[]`. No member or bill identities are
resolved again. Missing existing links remain SQL NULL; raw spelling, motion
text, method, counts, outcomes, dates, and even mismatches are preserved.

The trail uses `entry_source='raw'` for the new flat records and
`entry_source='official'` for existing `vote_events`. Every companion
association is an **explicit** `bill_companions` row, not an inferred
relationship. A raw journal record and an official event may describe the same
underlying vote: both remain separate, with distinct row identifiers. For
official events, `venue` and `committee` are NULL (those columns do not
exist in `vote_events`); `chamber` and `source_type` identify the source.
A SQL view never guarantees order: always use an explicit `ORDER BY`.

## Live row counts, roll-call name coverage, link rates

This query reports **exact row counts per session and venue**, including
committee voice motions, the fraction of roll calls with at least one printed
name, named-member link rates, and bill link rates. It runs directly against
the live source documents; it is not a stored or frozen statistical table.

```sql
WITH voter_counts AS (
  SELECT source_document_id, record_ordinal,
         count(*) AS named_votes,
         count(membership_id) AS linked_votes
  FROM senate_raw_member_votes_v
  GROUP BY source_document_id, record_ordinal
)
SELECT r.session_slug, r.venue,
       count(*) AS record_rows,
       count(DISTINCT r.source_document_id) AS documents_with_records,
       count(*) FILTER (WHERE r.method = 'roll_call') AS roll_calls,
       count(*) FILTER (WHERE r.method = 'roll_call' AND vc.named_votes > 0)
         AS roll_calls_with_names,
       round(100.0 * count(*) FILTER
         (WHERE r.method = 'roll_call' AND vc.named_votes > 0)
         / nullif(count(*) FILTER (WHERE r.method = 'roll_call'), 0), 2)
         AS pct_roll_calls_with_names,
       coalesce(sum(vc.named_votes), 0) AS member_vote_rows,
       coalesce(sum(vc.linked_votes), 0) AS linked_member_vote_rows,
       round(100.0 * coalesce(sum(vc.linked_votes), 0)
         / nullif(sum(vc.named_votes), 0), 2) AS pct_member_links,
       count(*) FILTER (WHERE r.bill_identifier_raw IS NOT NULL) AS numbered_records,
       count(*) FILTER (WHERE r.bill_identifier_raw IS NOT NULL AND r.bill_id IS NOT NULL)
         AS linked_numbered_records
FROM senate_raw_vote_records_v r
LEFT JOIN voter_counts vc
  USING (source_document_id, record_ordinal)
GROUP BY r.session_slug, r.venue
ORDER BY r.session_slug, r.venue;
```

The one-shot production run prints these group counts and rate numerators
inside a `REPEATABLE READ READ ONLY` transaction followed by `ROLLBACK`.
The earlier linked-source readback (October 16, before this migration) observed
**30,326/30,347**, **74,930/74,952**, and **41,163/41,178** linked
*mover + voter mentions* by session (2021–22, 2023–24, 2025–26), and
**100%** of **2,574**, **5,379**, **3,861** bill-mention links, respectively.
Those are mention-edge totals, **not** the per-venue flat row counts above,
and should never be substituted for a query of the views.

## Example queries

### 1. One senator's named committee votes on one bill

Use existing `membership_id` and `bill_id` UUIDs, scoped to the same session.

```sql
SELECT r.occurred_on, r.committee, r.vote_kind, r.amendment_ref,
       r.motion_text, r.outcome, v.name_raw, v.choice, v.match_method,
       r.source_url
FROM senate_raw_vote_records_v r
JOIN senate_raw_member_votes_v v
  USING (source_document_id, record_ordinal)
WHERE r.bill_id = $1::uuid
  AND v.membership_id = $2::uuid
  AND r.venue = 'committee'
ORDER BY r.occurred_on, r.source_document_id, r.record_ordinal;
```

### 2. Committee-to-floor chronology of a bill and its documented companion

```sql
SELECT occurred_on, entry_source, venue, chamber, committee,
       matched_bill_id, via_companion, vote_kind, method, outcome,
       yea_count, nay_count, motion_text, source_url,
       source_document_id, record_ordinal, vote_event_id
FROM senate_vote_trail_v
WHERE bill_id = $1::uuid
ORDER BY occurred_on NULLS LAST, source_document_id,
         record_ordinal NULLS LAST, vote_event_id NULLS LAST;
```

The sequence is an **observed event chronology**, not evidence that one
motion caused another or that a companion bill was substituted.

### 3. Senator's agreement with their party on *named Senate floor* roll calls

This descriptive query treats the larger number of that party's recorded
`yea` or `nay` votes *on the same roll call* as its observed majority.
Ties, unnamed voters, and `other` choices are excluded. It is not a
position inference, party-whip record, or forecast feature.

```sql
WITH floor_votes AS (
  SELECT r.source_document_id, r.record_ordinal, v.membership_id,
         v.choice, m.party
  FROM senate_raw_vote_records_v r
  JOIN senate_raw_member_votes_v v
    USING (source_document_id, record_ordinal)
  JOIN memberships m ON m.id = v.membership_id
  WHERE r.venue = 'floor' AND r.method = 'roll_call'
    AND v.choice IN ('yea', 'nay')
),
party_tally AS (
  SELECT source_document_id, record_ordinal, party,
         count(*) FILTER (WHERE choice = 'yea') AS yes_votes,
         count(*) FILTER (WHERE choice = 'nay') AS no_votes
  FROM floor_votes
  GROUP BY source_document_id, record_ordinal, party
  HAVING count(*) FILTER (WHERE choice = 'yea')
      <> count(*) FILTER (WHERE choice = 'nay')
)
SELECT v.membership_id,
       count(*) AS floor_roll_calls_with_party_majority,
       count(*) FILTER (WHERE
         v.choice = CASE WHEN p.yes_votes > p.no_votes THEN 'yea' ELSE 'nay' END)
         AS agreements,
       round(100.0 * count(*) FILTER (WHERE
         v.choice = CASE WHEN p.yes_votes > p.no_votes THEN 'yea' ELSE 'nay' END)
         / nullif(count(*),0), 2) AS pct_agreement
FROM floor_votes v
JOIN party_tally p
  USING (source_document_id, record_ordinal, party)
WHERE v.membership_id = $1::uuid
GROUP BY v.membership_id;
```

### 4. Raw roll-call/member-join spot check

```sql
SELECT r.session_slug, r.occurred_on, r.venue, r.bill_identifier_raw,
       r.bill_id, r.yea_count, r.nay_count, r.names_match_tally,
       v.name_ordinal, v.name_raw, v.choice, v.membership_id
FROM senate_raw_vote_records_v r
LEFT JOIN senate_raw_member_votes_v v
  USING (source_document_id, record_ordinal)
WHERE r.source_document_id = $1::uuid
ORDER BY r.record_ordinal, v.name_ordinal;
```

## Important boundaries

* **Committee minutes voice votes have no individual member names.** Do not
  interpret NULL/absent `memberVotes[]` as abstentions or unanimous member votes.
  Some count-only roll calls likewise have no names.
* The metadata's `sourceDate` is `occurred_on`. `fetched_at` is not a
  historical vote date; an unknown source date remains NULL.
* Committee minutes sometimes contain separate narrative and action-summary
  records for one motion. Both stay in the source and views.
* The session-roster journal re-parse already aligns names with printed tallies;
  this migration does not run the parser or fix historical mismatches.
* `bill_inclusion_mentions` are literal phrases and **not** extra bill
  companions. Nothing in these views treats an inclusion phrase as a bill link.
* The views are current projections over mutable raw metadata. They are
  **not** immutable as-of snapshots or automatically forecast-eligible signals.
