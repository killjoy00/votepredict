# Raw Senate pre-passage votes

Raw collection of Minnesota Senate votes that happen before final passage, kept for the
forecasting side to reference and judge later. Records are stored as found: partial records,
unclear outcomes and name/tally mismatches are kept and labeled, not dropped or verified.

## What is collected

| Venue | Source | What we keep |
|---|---|---|
| Committee | senate.mn hearing minutes (HTML), found through the senate.mn schedule API (`/api/schedule/allDates`, `/api/schedule/daily?date=`) | Full minutes text, hearing metadata (committee, date, agenda with testimony documents), the "Present" list, and every motion/vote the parser recognizes: roll calls with names, count-only roll calls, voice votes, motions with no stated outcome |
| Floor | Senate Journal PDFs | Full journal text and every roll call (amendments, motions, procedural votes and passage), including roll calls whose parsed names don't add up to the tally |

Not captured yet: floor voice votes (they are in the stored journal text but not parsed into
records), and broad coverage of committee roll calls that exist only in scanned LRL PDFs (the bounded recovery below covers eight documents).

## Running it

```bash
npm run data:senate:raw-votes -- --session 2025-2026                      # whole biennium, both venues
npm run data:senate:raw-votes -- --session 2023-2024 --source committee --from 2024-03-01 --to 2024-03-31
npm run data:senate:raw-votes -- --session 2025-2026 --skip-existing       # only documents not yet collected
npm run data:senate:raw-votes -- --session 2025-2026 --dry-run --out /tmp/senate-raw.jsonl   # no database
```

Uses `DATABASE_URL_UNPOOLED` or `DATABASE_URL`. Individual page failures are reported and
skipped; the run only fails if nothing was collected.

## Where it is stored

No new tables. Each fetched document is one `source_documents` row; everything raw lives under
`metadata.rawPrepassageVotes`:

- committee minutes: `source_kind = 'senate_committee_minutes_html'`, `content_sha256` = hash of the extracted minutes text
- recovered LRL PDFs: `source_kind = 'senate_committee_minutes_pdf'`, SHA of the original PDF; full text and separate extraction provenance under the same raw metadata key
- journals: `source_kind = 'senate_journal_pdf'`, `content_sha256` = hash of the PDF. This is the
  same row the strict journal ingest (`data:senate:ingest`) uses for that PDF; only the
  `rawPrepassageVotes` key is written, so that ingest's own metadata is left alone.

This collector never writes `vote_events` or `member_votes`.

Each record has: `venue` (committee/floor), `method` (roll_call/voice/unknown), `voteKind`
(amendment, committee_recommendation, procedural, motion, passage, other), `textForm`
(narrative, action_summary, tally_only, journal_roll_call), `billIdentifier`, `amendmentRef`,
`mover`, `motionText`, `outcome` (passed/failed, absent when the source doesn't say),
`yeaCount`, `nayCount`, `memberVotes` (names as printed, with yea/nay/other), and
`namesMatchTally`. Committee minutes often repeat a motion as a final "... - MOTION PREVAILED."
summary line, so a narrative record and an `action_summary` record can describe the same action.

## Reading it

```sql
SELECT sd.metadata->'rawPrepassageVotes'->>'sourceDate'               AS date,
       r->>'venue'                                                     AS venue,
       coalesce(sd.metadata->'rawPrepassageVotes'->'hearing'->>'committeeName',
                sd.metadata->'rawPrepassageVotes'->>'committeeName') AS committee,
       r->>'billIdentifier' AS bill, r->>'voteKind' AS kind, r->>'method' AS method,
       r->>'outcome' AS outcome, r->>'yeaCount' AS yeas, r->>'nayCount' AS nays,
       r->'memberVotes' AS member_votes, sd.source_url
  FROM source_documents sd,
       jsonb_array_elements(sd.metadata->'rawPrepassageVotes'->'records') r
 WHERE sd.metadata ? 'rawPrepassageVotes'
   AND r->>'billIdentifier' = 'SF3459';
```

For as-of use, filter on `sourceDate` (the hearing or journal date); `fetchedAt` is when we
collected it.

## Targeted official LRL minute recovery (October 16, 2026)

`data/collections/senate-minute-gap-recovery-20261016.json` preserves eight full-text PDFs missing from the older fourteen-date written-minute queue, including three OCR extractions. Original PDF/text hashes, explicit archive links, printed meeting dates and extraction provenance accompany the raw text. `scripts/recover-senate-minute-gaps.ts` imports these into the same raw metadata format, retaining existing captures and sibling source metadata. The one-shot protected workflow rechecks original PDF hashes before credential access, validates the current migration ledger, and verifies exact post-import text. No parsed raw record is automatically promoted to a legislative vote or forecasting feature. Six source dates remain unresolved; see the corpus `remainingGaps`.
