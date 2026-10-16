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

From the protected repair run on 2026-10-16, after the journal roster re-parse
([run 38944846939](https://github.com/killjoy00/votepredict/actions/runs/38944846939),
status `committed_and_readback_verified`). Rates are matched ÷ total across all
match methods. Edge tables count mentions.

| Table | 2021–22 | 2023–24 | 2025–26 |
| --- | --- | --- | --- |
| senate_raw_vote_member_mentions (movers + voters) | 30,326 / 30,347 (99.93%) | 74,930 / 74,952 (99.97%) | 41,163 / 41,178 (99.96%) |
| senate_raw_vote_bill_mentions | 2,574 / 2,574 (100%) | 5,379 / 5,379 (100%) | 3,861 / 3,861 (100%) |
| senate_statement_member_mentions | — | 1,988 / 2,157 (92.2%) | 2,082 / 2,424 (85.9%) |
| senate_statement_bill_mentions | — | 423 / 423 (100%) | 539 / 539 (100%) |
| senate_committee_testimony_raw.bill | — | 13,433 / 13,433 (100%) | 11,578 / 11,583 (99.96%) |
| mn_senate_election_raw_results | 87 / 340 | 69 / 205 | 17 / 85 |
| mn_senate_questionnaire_captures | — | 8 / 16 | 12 / 67 |

**Journal roster re-parse** (`src/operations/senate-journal-raw-reparse.ts`)
ran in this job. It re-read all 337 stored journal documents with the session
roster:

- Names grew from 134,329 to 135,126, as run-together columns split into
  individual members.
- Roll calls whose names did not match the printed tally fell from 278 to 0.
- Unresolved raw-vote names fell from 1,198 to 58.

Raw-vote member links are mostly `alias`, meaning a journal surname form
learned on an earlier run, or `surname_unique_in_session`. Election and
questionnaire totals include losing candidates and write-ins, who never served
and correctly stay unresolved. Only one testimony row is a senator witness
(linked).

Other readback counts:

- **Companions** (official Revisor XML): 13,485 of 15,455 Senate bills have a
  linked House companion (2021–22: 4,042; 2023–24: 4,947; 2025–26: 4,496). The
  other 1,970 list no companion. None are `target_missing`, and there were no
  source failures.
- **Bill inventory** (existing `bills`): SF 4,610 / 5,535 / 5,310 and
  HF 4,905 / 5,488 / 5,162 for 2021–22 / 2023–24 / 2025–26. Coverage was
  high enough that no Revisor catalog import was needed.
- **Inclusion mentions**: "laid over for possible inclusion" 113 / 530 / 398,
  and "incorporated into" 1 / 0 / 6. Almost none name the target omnibus bill,
  because the source text does not.
- **Statement sessions**: all 2,959 statements are placed by a printed
  `published_on`. No archive-date fallback was needed.
- **Attachments**: 13,675 (2023–24) and 12,760 (2025–26) captured files. Of
  these, 12,371 and 10,554 join to a bill through testimony `source_url`.
  None carry a senator.

### Unresolved printed names

After the re-parse, raw votes are essentially fully linked (58 unresolved). What
remains is mostly statement text that is not a sitting senator:

- **WRITE-IN** election rows (139), which are expected.
- **People who are not senators**, named after a "Senator"-like prefix in
  press text: U.S. senators (Klobuchar, Tina Smith), House members and
  testifiers.
- **Statement extraction artifacts**: a senator's name followed by the next
  word ("Julia Coleman Senator Julia", "Sandy Pappas Applauds Passage",
  "Nicole Mitchell Trial"), memorial names ("David J. Tomassoni Memorial"),
  and the word "District".
- **Misspellings beyond the one-edit rule** ("Ingebrigsten", "Dornik",
  "Housely", "Papas"), and "Kari Dziedzic" outside her service dates.

The resolver already handles possessives ("Mitchell's"), doubled surnames,
common nicknames and one-edit misspellings of long surnames. A tighter
statement name extractor could recover most of the trailing-word artifacts.

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
