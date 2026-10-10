# Issue #864 — legacy Senate committee evidence hearing-date repair (review-only)

**Status:** a source-scoped offline repair-candidate planner and ROLLBACK-only SQL preview. No production export was obtained, no UPDATE was executed, no frozen evaluation or serving artifacts were altered.

## Why simply re-ingesting old committee minutes is unsafe

The already merged [hearing-day policy](./senate-committee-hearing-date-policy.md) (#865) assigns the actual meeting date as historical available-on for named YEA/NAY rolls, count-only divisions, and voice/unanimous/result-only committee actions. It excludes same-day date-only forecast use.

Older persisted evidence_items are known to have NULL published_at and false meetingDateIsAvailability / asOfEligible under the previous policy. Durable ingestion hashes the publishedAt field into its ingestion SHA. Blindly re-running backfill-senate-committee-minutes with the newly dated evidence could therefore create a **duplicate**. vote_events.occurred_on was already correctly set to the hearing date. Count-only/voice votes must never turn into individual recorded YEA/NAY.

## Source-bound SELECT-only export

The [read-only committee export template](../../scripts/export-senate-committee-hearing-legacy-readonly.sql) is only for a separately authorized SELECT-only role against an independently confirmed correct historical database. **No such authorization or export is present in this conversation.** The SQL exports only source document / evidence UUIDs, exact official source URL/SHA256, source/event day metadata, type/flags/identifier information, and the vote-event occurrence days linked to that source. It does not export evidence claims, minutes text, individual voter names, addresses, donor details or private contact data.

It exports **already-dated siblings as well as legacy rows**, so duplicate natural identities are visible to the planner.

Privately and only after the operator has a separately approved read-only database export:

    psql -X -A -t -v ON_ERROR_STOP=1 -f scripts/export-senate-committee-hearing-legacy-readonly.sql > private-senate-committee-evidence.jsonl

Then run the **offline local-only** planner with no database library, network calls or environment-secret lookup:

    node --import tsx scripts/plan-senate-committee-hearing-repair-offline.ts --input private-senate-committee-evidence.jsonl --plan private-committee-hearing-repair-plan.json --sql private-committee-hearing-repair-DRYRUN.sql

Do **not** upload any real private SQL export or generated plan to public GitHub/Actions/chat, and do not paste identifying private row IDs into issue comments.

## Independent safety checks

A review candidate requires ALL of:
- original official LRL electronic Minutes-PDF URL under Senate 2022–2025 with an exact dated YYYYMMDD directory, original source SHA256, officialArchive=true and sourceVerified=true;
- source metadata hearing date, item meeting date and official PDF path date exactly equal;
- one allowed committee observation subtype: named roll call (member-resolved fact), count-only (no member context), voice, unanimous or motion-result-only context (never member inferred);
- preserved neutral/non-mechanical constraints, modelWeight=0, valid old SHA and stable observation identity;
- for named and count-only rolls, an existing matching vote_events hearing-day source reference, and no conflicting source-event days;
- explicitly old published_at NULL and both hearing-date-availability and historical-eligibility flags false, no contradictory availability date and **no same-observation sibling row**.

Already corrected, conflicting-date, unverified-source, missing-identity, 2021 print-only, wrong-office, invalid action semantics and duplicate evidence are **not** automatically repairable.

## What the dry-run preview proposes (and does not do)

The generated SQL uses an exact evidence ID, source ID/hash/URL, old ingestion SHA and stable observation identity in a guarded update. It proposes the approved hearing timestamp YYYY-MM-DDT23:59:59.999Z plus the selected v1 metadata for availableOn, eventOccurredOn, asOfEligible, sameDayEligible=false, availability proof, date granularity and a legacy-ingestion-key provenance field. It never inserts evidence, fabricates votes, changes member choices, updates the frozen corpus or alters vote_events.

**It ends with ROLLBACK, not COMMIT, by design.** It is not an approved production migration. A separately authorized operator must inspect the full private export, source and target snapshots and backup; deliberate production transaction approval is not provided here.

As an additional guard, durable ingestion now checks the original committee source-document and stable per-observation identity, under a transaction-level advisory lock, **before** relying on the old/new date-sensitive SHA. A single unchanged observation is safely reused without changing its publication time; multiple matches or different claim/stance/semantic subtype fail closed, instead of inserting a second row. All noncommittee source families preserve their existing identity behavior.

## Separate true coverage requirements

We still lack an owner-authorized database snapshot, so **actual legacy rows and approved correction count are unknown**. The [public committee source census](./senate-committee-2021-25-official-meeting-census.md) independently enumerates electronic meeting headings and original-minute links for 2022–2025, but has no authoritative 2021 print meeting denominator, no reconciled 2022 printed-versus-online records, and no exhaustive original PDF vote-content-to-evidence reconciliation.

After independent source PDF action audit, a proper source-to-DB reconciliation must compare exact year/committee/date/minutes PDF/source SHA and individual named-member YEA/NAY, count-only divisions, voice/unanimous/result-only motions, missing/failed/unparseable documents and database evidence/vote rows. Do not equate zero online documents with no meetings.

Issue #864 stays OPEN. No production DB read/write, Vercel/Neon action, public-office contact, forecast, scheduler, 2027 work or Senate floor parser change is performed.
