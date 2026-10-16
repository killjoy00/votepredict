# Minnesota Senate identity and bill linking (2021–2026)

This is a best-effort **raw linking** layer, not verification, stance scoring,
forecasting, evidence certification or a model feature change. Existing text and
the preexisting senator or bill identity columns are preserved.

## Joins and match rules

| Source | Senator link | Bill link |
| --- | --- | --- |
| senate_raw_statements | membership_id for a single named senator; senate_statement_member_mentions for multiple names | bill_id for a single reference; senate_statement_bill_mentions for multiple |
| senate_committee_testimony_raw | membership_id **only** for an explicitly Senator-labeled witness or Senate organization, not unrelated testifiers | existing bill_id preserved; newly recorded bill_match_method |
| mn_senate_election_raw_results | existing membership_id preserved, new membership_match_method, session scoped by election/service year | No bill identifiers published |
| mn_senate_questionnaire_captures | existing membership_id preserved, new membership_match_method, session scoped to Senate campaign/service cycle | Raw questionnaire Q/A preserved as published, no bill number field |
| source_documents Senate raw vote metadata | senate_raw_vote_member_mentions for each named mover/voter | senate_raw_vote_bill_mentions for every numbered vote record |
| senate_committee_attachment_text_captures | No per-senator name is stored on a shared capture. Join by source_url to senate_committee_testimony_raw | Join to testimony rows by source_url; do not invent a bill on the binary capture |

The person resolver uses existing legislators, memberships and
membership_source_aliases, never another person registry. It handles Sen.,
Senator, middle initials, nicknames and compound surnames such as Maye Quade
and Oumou Verbeten. Returned methods are **exact**, **alias**,
**surname_unique_in_session**, **district**, **unresolved**. Same-session
surname collisions remain unresolved unless a unique near name or district
breaks the tie. Every new printed alias is inserted with its evidence source URL.

Bill references normalize to SF/HF identifiers within one legislative session.
The bill resolver returns **exact**, **normalized**, or **unresolved**.
Existing linked IDs are never overwritten; **existing_preserved** means a
preexisting ID was intentionally kept rather than changed to a different
best-effort match. Statements without a printed publication date or unambiguous publisher URL year
can use the archival observation timestamp from migration 0020 as an explicitly
labeled **archive_capture_upper_bound** session fallback. The raw
`published_on` field is **never changed**. `session_match_method` records
`published_on`, `url_year`, `archive_capture_upper_bound`, or `unresolved`.
This fallback identifies the session implied by *when the archived text was seen*,
not a certified writing or first-publication session, and must not be used as
historical first-availability proof. November general Senate elections
are mapped to the following service biennium; special elections to the current
service biennium.

The bill_companions table contains explicit SF/HF pairs from official
Minnesota Revisor Bill Status XML fields COMPANION_TYPE and
COMPANION_NUMBER, with source_url and fetched_at. A resumable
senate_bill_companion_scans table records attempts with no companion or a
printed HF identifier without an existing same-session bill row. Every later
run re-resolves `target_missing` directly against the stored printed identifier;
matching official House bills create the pair without repeating a Revisor HTTP
request, preserving the original source URL and fetched timestamp.

A second, additive migration `0023_senate_statement_session_provenance.sql`
tracks session provenance and completed official search ranges. When the raw
bill-reference match rate is below 90% for a session with five or more references,
or saved House companion targets are missing, the repair job imports the official
Revisor XML Senate and House bill catalog for all three sessions, scanning bill
numbers 1–12000 in 500-number ranges. Existing `bills` rows are never updated;
only missing canonical SF/HF rows are inserted. Each range's source URL, hash,
fetch timestamp and counts are committed atomically with its inserts in
`senate_revisor_bill_catalog_ranges`, so throttled runs resume without refetching
finished ranges. It does not ingest bill text or create vote events, model features,
or forecast targets. The bill_inclusion_mentions table records literal phrases:
"laid over for possible inclusion", "incorporated into", and
"see article X of", with source document and date. Mentions are not inferred
omnibus membership claims.

## Protected production and reporting

Two additive, idempotent migrations:
`0022_senate_identity_bill_linking.sql` and
`0023_senate_statement_session_provenance.sql`.
The production workflow requires a reviewed first-attempt main push containing
the marker **SENATE_IDENTITY_BILL_LINK_PRODUCTION**, a keyless independently
successful main job, and the existing evidence-readonly-sandbox environment.
Both runners require exact migration-ledger checksums and use the drift gate.
The original runner applies 0022; the repair runner applies 0023 and uses the
new marker `SENATE_IDENTITY_BILL_REPAIR_PRODUCTION`. It runs once, on a
reviewed first-attempt main push carrying that marker (there is no recurring
schedule). The repair job completes the catalog if coverage is low, re-runs the
raw identity links, repairs missing companions and runs a bounded Revisor
companion scan. All Revisor requests share a serial minimum 1150-ms pacing
budget; HTTP 429/503 halts that external work for the run rather than
accelerating retries. Up to 600 unscanned SF records are attempted per run;
any unfinished work is retried with a fresh reviewed marker commit.
Match-rate readback executes in a REPEATABLE READ READ ONLY transaction with
ROLLBACK. Forecasting, serving, votes and feature tables are not changed.

The production job prints **SENATE_IDENTITY_BILL_LINK_PRODUCTION** with
**report.byTableAndSession** (table, session, method, total, matched),
**report.top50UnresolvedNames**, **report.companions**,
**report.inclusions**, **report.attachmentAssociations**,
**report.statementSessionMethods**, and **report.billInventory**.
For each table/session, match rate is the sum of matched divided by the sum
of total over all match-method categories. Multi-mention edge tables count
mentions, not unique source documents or senators.

### Production rates by table, session and method

**Awaiting actual protected production readback.** Do not enter invented rates.
This section must be updated from the completed job output.

### 50 most frequent unresolved printed names

**Awaiting actual protected production readback.** The protected report uses
the raw name frequencies across statement mentions, explicitly designated
senator testimony witnesses, candidate results, candidate questionnaires and raw-vote name mentions.

### Limitations

Archive-capture-based session assignment is only an observation-time fallback;
future evaluation consumers must not silently equate this with publication year.
Raw text may contain ordinary phrases such as “amendment incorporated into the
bill”; textual inclusions are literal mentions, not adjudicated omnibus links.
Unsuccessful Senate election candidates have no serving membership and remain
unresolved. Official Revisor catalog ranges are bounded to numbers 1–12000 and
may return fewer published bills than the numeric upper bound.

An unresolved result is expected for candidate nonmembers, names with no
unique session membership, bills missing from the matching session,
undated statements, official companion targets not in existing bills, and
attachments lacking a per-senator author field. No hand verification is
performed or implied.
