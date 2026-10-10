# Issue #864: 2021–2025 Senate committee meeting and original-minutes source census

**Scope:** original, public, official Minnesota Legislative Reference Library (LRL) Senate **committee meeting listing** and linked minutes PDFs, 2021–2025. No source PDF text is downloaded in this first index census. No production evidence database accessed or rewritten, no prediction/model/2027/scheduler/office contact.

The [LRL official committee minutes catalog](https://www.lrl.mn.gov/minutes/) states:
- **2021:** Senate official minutes exist in **print**, but no public Senate electronic minutes index exists for that year. Neither an empty index nor an audio meeting entry can be treated as proof of no meeting or no recorded vote. Exact official meeting and recorded vote denominators remain unknown pending access to the independent print archive.
- **2022:** Senate staff compiled both **print and electronic** minutes, and the two collections **may differ**. The online index provides only a verified electronic subset, **not** the entire official meeting denominator.
- **2023–2025:** Senate official minutes were compiled electronically. The current linked index is the independently enumerable available online document surface, **not** automatic proof that each public meeting has minutes, every recorded action is recognized by the parser, or any database event was inserted. The source also says not all committees produce minutes.

## What the electronic source census measures

1. For each year 2022, 2023, 2024, 2025, download/hash the actual official yearly Senate committee index HTML and independently download/hash **every linked Senate committee page**, within hard bounds (max 120 indexed committee pages/year, fixed four-year scope, 4 concurrent page reads, per-HTTP byte cap). Report actual page acquisition failures and continue with explicit incomplete statuses.
2. Enumerate **dated committee meeting headings** from each committee page separately from **original Minutes-PDF hyperlinks**. A meeting listed without an electronic Minutes document is retained as **meeting_without_linked_minutes**, not interpreted as no vote. A Minutes-PDF URL without a recognized dated heading is retained and flagged as an anomaly, not silently dropped.
3. Preserve year / committee / meeting date / exact official committee-page URL / each exact original Minutes-PDF URL / original source page SHA-256 and acquisition time. Deduplicate duplicate links inside pages. Report year totals and detailed reviewable missing-link and source-failure lists, grouped under source identifiers.
4. Mark 2021 **print-only unenumerated**, and 2022 **mixed-source incomplete**. Explicitly keep complete historical meeting, vote and named roll-call denominators **null**, even if each linked HTML page parses successfully.
5. The one-shot [public-source GitHub Actions workflow](../../.github/workflows/senate-committee-2021-25-electronic-meeting-census.yml) writes a metadata-only source artifact. **The workflow being green is not equivalent to an all-committee/all-year completeness certificate.** Read the per-year source statuses and anomalies; no PDF vote content has been parsed in this tranche.

**Original discovery logic:** reuse existing, reviewed src/evidence/minnesota-senate-committee-source.ts index and Minutes-PDF link parser, supplemented by a new date-header parser, separate meeting listing and safe source grouping. No Senate floor parser or target evidence modified.

## Database correction is distinct work

The [hearing-date timing rule](./senate-committee-hearing-date-policy.md) was fixed in #865, but **legacy Senate committee evidence rows in private production were not repaired**. Existing evidence ingestion identity includes the old publishedAt value; an unreviewed reingest may create duplicates and corrupt provenance. This source census does not execute any database read or write. A separate immutable, source-bound, approval-gated correction and idempotent source-to-export reconciliation are necessary before an operator with authorized read/write roles can safely apply it.

A complete reconciliation requires independent **official indexed meeting** count by committee/year, per-minute original PDF bytes/parse/recorded-action counts, named vs count-only motions and source-linked **DB** rows, explicitly unavailable/unparsed print/electronic material, duplicate and unresolved identity counts. This inventory is the first independently sourced denominator; the printed 2021 and mixed 2022 boundaries prevent claims of all-record completeness until their true source universes can be inspected.

## Next gate

Run the bounded public index census. Inspect the actual committee-year counts and no-minutes gaps. Then run a separate per-original-minute bounded PDF action audit and reconcile a separately owner-authorized SELECT-only export of persisted Senate committee evidence, vote_events and member_votes. Stage a guarded correction plan; never run the old backfill wholesale to fix legacy event dates, and do not write to production without separate operator authorization. Issue #864 remains OPEN.
