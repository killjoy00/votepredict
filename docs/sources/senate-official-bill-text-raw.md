# Minnesota Senate official bill-version and amendment RAW text (2021–2026)

This is a separate **source-text archive**, not a forecast-ready version selector, a vote outcome correction or an amended bill reconstruction. It can be queried alongside the existing raw Senate vote views.

## Scope / order

1. Existing `senate_raw_vote_bill_mentions` bill IDs and official `bill_companions` bill-only associations, **not** a rebuilt bill catalog or member matching.
2. Status pages on `www.revisor.mn.gov` for the bill in its 2021/22, 2023/24 or 2025/26 biennium. Queue printed numbered, unofficial Senate engrossment and conference-report version paths; preserve case in alphabetic CCR suffix.
3. Existing Senate Journal and Senate committee minutes `source_documents.metadata.rawPrepassageVotes.text` for bill-linked printed proposed amendment language. Nothing is refetched for this source family. An embedded source-text offset identifies the raw snippet; no nearby-vote heuristics.

2025–2026 runs ahead of 2023–2024 and 2021–2022. Each protected run caps newly staged bills, official page discoveries, version fetches and existing raw-document scans. The next protected scheduled run continues. The single shared `RevisorPacer` serializes Revisor GETs at no faster than 1,150 ms. Throttle responses (429/503) stop the current batch without marking its pending record complete.

## Tables and meaningful date separation

- `senate_official_bill_text_discovery` — status-page work queue and failure/unavailable counts.
- `senate_official_bill_text_queue` — immutable printed version labels and official original version URLs. The queue status/attempt fields are operational, not raw text.
- `senate_official_bill_text_captures` — append-only original HTML body (for fetched versions), raw extracted bill text or raw printed proposed amendment text, original-body SHA-256, extracted-text SHA-256, source URL and locator, printed label, `fetched_at`, `posted_on`, `proceeding_on`, `archived_observed_at`, and source-fingerprint provenance. Unknown dates are NULL. For preexisting journals the original-body fingerprint is the existing `source_documents.content_sha256`; `source_document_id` identifies its prior capture. `created_at` is the new extraction timestamp; `fetched_at` is the original capture time.
- `senate_official_bill_text_journal_scans` — bounded, resumable source-document scan receipts, including missing words, extraction failures and exact-reference counts.
- `senate_official_bill_text_record_links` — literal amendment A-number links only when unique within an existing source document, linked to an already resolved bill record. Unnumbered or ambiguous links deliberately remain absent.
- `senate_raw_vote_official_bill_text_candidates` — same-session/bill text candidates for preexisting Senate raw vote mentions. The `relationship` column explicitly states they are **not** exact event-paper evidence.

Companions identify bills, **not identical wording**. The posted date alone does not prove pre-vote source availability. A proposed/rejected amendment is not part of adopted text. `bill_versions` remains unchanged and is only read as a deduplication comparison; captured versions preserve distinct source-body revisions.

## Query examples

```sql
-- Source-specific raw version candidates for a Senate record.
SELECT r.session_slug,r.occurred_on,r.bill_identifier_raw,r.vote_kind,
       r.amendment_ref,v.family,v.printed_label,v.posted_on,
       v.relationship,c.raw_text,c.original_body_sha256,c.extracted_text_sha256
FROM senate_raw_vote_records_v r
JOIN senate_raw_vote_official_bill_text_candidates v
  ON v.source_document_id=r.source_document_id
 AND v.record_ordinal=r.record_ordinal
JOIN senate_official_bill_text_captures c ON c.id=v.text_capture_id
WHERE r.bill_identifier_raw='HF100'
ORDER BY r.occurred_on,c.family,c.posted_on;

-- Only explicit one-to-one printed amendment-reference relationships.
SELECT r.occurred_on,r.bill_identifier_raw,r.amendment_ref,
       c.printed_label,c.source_url,c.source_locator,c.raw_text
FROM senate_raw_vote_records_v r
JOIN senate_official_bill_text_record_links l
  ON l.source_document_id=r.source_document_id
 AND l.record_ordinal=r.record_ordinal
JOIN senate_official_bill_text_captures c ON c.id=l.capture_id
WHERE r.vote_kind='amendment';
```

Neither query changes serving models or authorizes historical as-of eligibility. Never feed them into a forecast without a separately requested, independently scoped evaluation.

## Operational interpretation

Protected workflow: `.github/workflows/senate-official-bill-text-production.yml`; checked-main merge marker: `SENATE_OFFICIAL_TEXT_RAW_20261016`; scheduled every six hours after merge. The job independently runs all migrations and the full CI suite on disposable PostgreSQL, then discovers the existing, independently marked Neon default primary only inside `evidence-readonly-sandbox`. It fails on migration drift, incorrect database identity or access failures.

Read `SENATE_OFFICIAL_TEXT_RAW_READBACK` in the successful **protected** job. Counts include newly recovered versions, embedded amendment blocks, exact A-number links, conflicting/matched previously stored texts, discovered/queued/captured records by session and family, failures, unavailable records, unscanned source documents and unstaged eligible bills. A successful bounded run is not complete collection. A stopped-on-throttle run leaves unattempted work pending.

## Known limitations

Linked standalone amendment attachments not literally present in the previously stored Journal/minutes text, and unnumbered amendment-to-vote identity, remain backlog. This pipeline does not infer that any version was available before a Senate vote, infer adoption of a proposed amendment or certify textual equivalence between Senate and House companions. No live forecast inputs change.
