# Minnesota raw SF/HF bill authors (2021-2026)

## Scope and source provenance

This is **raw collection**, not position verification, historical evidence
certification, forecasting, model features or serving. The only new persistent
tables are from additive migration 0025_senate_bill_authors.sql.
Existing bill IDs, SF/HF companions, and Senate memberships are reused without
changing their source tables. No House person-to-Senate membership link is made.

Collect regular-session SF bills and their officially paired HF companions for
2021-2022, 2023-2024 and 2025-2026. Unpaired HF bills are intentionally outside
the specified "Senate bills and their House companions" target set. If the goal
expands to all House bills, change the target query in a separately reviewed PR.

The official [Revisor Bill Status API v1](https://www.revisor.mn.gov/bills/service)
contains the current ordered author list in BILL/AUTHORS/SENATE/AUTHOR or
BILL/AUTHORS/HOUSE/AUTHOR (usually MEMBER_NAME), and dated author
add/stricken announcements under BILL/ACTIONS/{chamber}/ACTION. The live XML
does **not consistently print explicit role or original author-added dates**.
The ordered first current author is designated "chief" following the published
list convention; later entries are "coauthor". If an AUTHOR_ROLE or similar
role field is printed, that takes priority. The author_order field preserves
the **current published list position**, not a reconstructed exact historical
order of being added. Dated action records set added_on/removed_on only
where explicitly published; original author dates remain NULL. For previous
strikes/second additions, the earliest add and latest strike fit in the flat
row while the complete action sequence remains in the full raw_xml snapshot.

The existing parser in src/sources/minnesota/revisor-authorship.ts handles
live status API author/action grammar. The raw adapter adds ordering, role
fields, source capture and Senate membership links with resolveSenator()
from the existing crosswalk. Ambiguous senators remain unresolved; House
names are unlinked. The XML provides the current author order and historical
dated actions, so an HTML status-page request is not made simply to reparse
the same fields. The HTML page does not offer missing original author dates.
Cases with absent/changed XML structure are documented gaps for a separately
reviewed targeted HTML fallback.

The raw Senate journal text at source_documents.metadata.rawPrepassageVotes.text
is mined without any network fetch. Only literal **prevailing** coauthor
addition or strike motions matching a bill number are added; this is not
proof of a legislative vote. Motions without recognizable names/outcomes,
multiple author-change clauses, and chief-author succession phrases needing
contextual pronoun resolution may be incomplete. A
senate_bill_author_journal_scans receipt saves the raw-text hash and counts.
If a journal document is later replaced, use a separately reviewed rescan;
a prior receipt is not silently treated as a new publication.

## Tables and idempotence

- senate_bill_author_snapshots: full official XML, exact URL, HTTP status,
  fetched_at and SHA-256; unique bill/fingerprint receipts.
- senate_bill_authors: one name per (bill_id, chamber, author_key); raw name,
  session, role, current list order, nullable published dates, source, snapshot
  and Senate membership/match method. Journal data supplements dates without
  replacing current XML roles. A stricken author may have no current list order.
- senate_bill_author_scans: success, not-found or retryable source-error
  result per bill. Reruns skip success and not-found receipts, and retry
  source errors **after** new bills. A 429/503 stops the run without a completed
  scan receipt.
- senate_bill_author_journal_scans: one hash/count receipt per stored journal
  document, preventing repeated parsing across reviewed marker runs.

The collector requests both possible year-specific status XML URLs in sequence,
always serially paced through RevisorPacer (minimum 1,150 ms per request).
Each protected collection run is capped at **3,000 bill lookups**, with a
**65-minute collector budget**, within the existing 90-minute protected job
limit. This leaves time for the migration drift check and final read-only
readback even when the Revisor's first-year or second-year response is slow.
All requests remain serial and use the existing minimum 1,150 ms pacing.
A 429 or 503 immediately stops fetching; the budget cutoff also ends a run
after its last committed bill. Neither condition loses persisted work.

Before any Revisor HTTP request, each run processes up to **500 existing
stored journals**, enough for all 257 pending journals at the first readback.
Journal text is mined from source_documents with no network request; journal
receipts remain idempotent. A reviewed main merge can include both
SENATE_BILL_AUTHORS_PRODUCTION and SENATE_BILL_AUTHORS_JOURNALS_ONLY to
request **zero bill lookups** for the first run, finishing the journal backlog
without the much slower Revisor scan. A later independently reviewed main
merge with only SENATE_BILL_AUTHORS_PRODUCTION resumes official bill scans,
still bounded at 3,000. There is no schedule or direct dispatch.

## Session inventory and production metrics

From the October 16, 2026 completed SF/HF companion-link report, **before
the authorship migration was deployed**:

| Session | Existing SF | Linked companion HF | Target bills to scan |
| --- | ---: | ---: | ---: |
| 2021-2022 | 4,610 | 4,042 | 8,652 |
| 2023-2024 | 5,535 | 4,947 | 10,482 |
| 2025-2026 | 5,310 | 4,496 | 9,806 |
| **Total** | **15,455** | **13,485** | **28,940** |

These were **precollection companion-inventory counts**, not claims that
authorship rows had been populated. The first official author readback below
is the authoritative point-in-time count; its target total is two lower than
this earlier inventory (one fewer HF target in 2023-2024 and in 2025-2026).
No reason for that difference is inferred without a catalog comparison.

### Verified first protected collection: October 16, 2026

[Production run #38953446404](https://github.com/killjoy00/votepredict/actions/runs/38953446404)
successfully passed exact-marker independent main, ledgered migration 0025,
post-migration drift, bounded serial Revisor fetches and read-only readback.
It is a **bounded partial** collection, not completed coverage.

| Session | Live SF + linked HF target | Revisor XML success scans | Current raw author rows (XML + stored journals) | Senate membership links | Coauthor share among successful XML-scanned bills |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2021-2022 | 8,652 | 0 | 726 | 726 / 726 (100%) | Not available (0 scanned) |
| 2023-2024 | 10,481 | 0 | 484 | 484 / 484 (100%) | Not available (0 scanned) |
| 2025-2026 | 9,805 | 350 | 1,275 | 1,275 / 1,275 (100%) | 188 / 350 (53.71%) |
| **Total** | **28,938** | **350** | **2,485** | **2,485 / 2,485 (100%)** | **188 / 350 (53.71%)** |

The official collector attempted **350/350 successful SF XML status lookups**;
no 404, source errors, 429 or 503 were observed. It parsed **817 official
current/action author entries**. Separately, **80 stored Senate journal
documents** yielded **1,691 author-change mentions linked to existing bills**.
These mentions can overlap an XML author row and are not additional unique
people or bills. Readback found **0 House author rows**, because the configured
priority processes SF bills before their linked HF companions.

**Remaining:** 28,588 target bills without successful/not-found Revisor scan
receipts and 257 unscanned stored journal documents. The next reviewed,
marker-bearing main merge can resume from these receipts; no schedule exists.
All 2,485 observed Senate author rows resolved to existing membership IDs,
but this is a first-batch rate, **not** a claim that unscanned authors or
all House people are resolved.

The readback emits targetBills, scannedBills, successBills, authorRows,
senateAuthorRows, senateLinked, houseAuthorRows, billsWithCoauthors,
coauthorShare and senateLinkRate. These figures may change as new evidence
is collected or the catalog changes. Do not extrapolate the coauthor share
to all 28,938 target bills.

### Verified journal-only protected collection: October 16, 2026

[Production run #38962989650](https://github.com/killjoy00/votepredict/actions/runs/38962989650)
successfully processed **all 257 stored Senate journals outstanding after the
first batch**, with zero official Revisor HTTP requests, no throttle and no
source errors. It found **5,650 literal author-change mentions and linked all
5,650 to existing bills**. The run recorded `remaining_journals: 0`.

Across the two runs, **337 / 337 currently indexed journal documents** have
receipts. The raw authorship layer contains the following distinct author rows
after journal processing, including 350 previously scanned SF bills:

| Session | Raw Senate author rows | Linked existing memberships | Official bill XML success scans |
| --- | ---: | ---: | ---: |
| 2021-2022 | 2,937 | 2,936 | 0 |
| 2023-2024 | 2,133 | 2,133 | 0 |
| 2025-2026 | 2,781 | 2,781 | 350 |
| **Total** | **7,851** | **7,850 (99.99%)** | **350** |

The **28,588 remaining bill lookups** did not change in this journal-only run.
The single unresolved Senate membership stays unresolved; no identity is
inferred. A journal receipt means the document was processed by the existing
literal parser, not that every possible author-change construction was
successfully recognized. The counters above are a point-in-time production
observation; if new source documents arrive they may require a new reviewed
scan.

### Verified first 3,000-lookup Revisor batch: October 16, 2026

[Production run #38964859570](https://github.com/killjoy00/votepredict/actions/runs/38964859570)
finished successfully with `requestedBillLookups=3000`. All **3,000 lookups
were attempted**, yielding **2,998 successful official XML scans**, zero
not-found responses, **two retryable source errors**, no 429/503 throttle,
and no time-budget stop. The work committed **7,738 extracted XML author
entries** (not all distinct from existing journal mentions). No previously
completed stored journals were rescanned.

| Session | Successful official XML scans, cumulative | Current distinct Senate author rows | Senate membership links |
| --- | ---: | ---: | ---: |
| 2021-2022 | 0 | 2,937 | 2,936 |
| 2023-2024 | 0 | 2,133 | 2,133 |
| 2025-2026 | 3,348 | 9,228 | 9,228 |
| **Total** | **3,348 / 28,938 (11.57%)** | **14,298** | **14,297** |

The production readback found **25,590 remaining target bill lookups**,
including the two retryable source errors, and **zero pending stored
journals**. There were 2,099 distinct scanned bills with a coauthor across
3,348 successful XML scans (62.69%); the observed 2025-2026 subset is not
representative of other biennia. House authors remained uncollected because
the existing Senate-first order had not exhausted the Senate catalog.

### Second reviewed 3,000-lookup Revisor continuation

The next first-attempt protected run resumes from the successful/not-found
receipts above, processing **at most 3,000 additional targets** at the
existing minimum 1,150 ms serial request interval. It uses the same 65-minute
collector budget, immediate 429/503 stop, exact-main CI gate and existing
protected Neon database. The two source-error entries may be retried after
fresh targets. Actual successful counts and remaining targets will be
reported by the next protected production readback; do not treat a run
request as proof of completion.

Definitions: coauthor share is distinct successfully scanned bills with at
least one coauthor, divided by successfully scanned bills. Senate link rate is
resolved Senate membership author rows divided by all Senate author rows;
House rows do not count. Remaining unscanned is SF+linked HF targets without
a success/not-found receipt, including retryable source failures. Remaining
journals separately counts stored journal documents not mined.

Known gaps: bill statuses without author lists, unresolved surname
collisions, old stricken authors absent from current order, printed role
ambiguity, initial author dates not published, source changes after receipt,
action-only authors whose original order is unknown, and ambiguous/unparsed
journal motions. A fetch date is never substituted for author-added date.

## Protected deployment and continuation

Production workflow: .github/workflows/senate-bill-authors-production.yml.
A first-attempt, non-forced main merge commit must include the marker
**SENATE_BILL_AUTHORS_PRODUCTION**, after independent-main CI has passed,
and then run within existing evidence-readonly-sandbox. The runner performs
read-only preflight, ledgered 0025 migration, migration drift gate, bounded
collection and read-only repeatable-read readback with ROLLBACK.
GitHub Actions reuses the existing protected Neon credentials and marked
default primary; no secrets are printed. Branch or environment protection
must not be bypassed.

Ordinary bounded runs report **bounded_partial**, not false completion.
Each run includes explicit remaining_unscanned, remaining_journals,
requestedBillLookups, collectionMode and stoppedForTimeBudget fields.
The runner verifies the **entire current release migration ledger**; agents
may add new, independently deployed additive migrations after 0025.
It will not apply another agent's migrations, rewrite applied checksums,
or suppress a drift mismatch. If the production ledger is behind the current
release, the protected run is held for that migration's own guarded deploy.

### First large Revisor continuation

The reviewed marker-bearing continuation following the journal-only run
requests up to **3,000 official bill lookups** without repeating any finished
journal or Revisor scan receipt. The 65-minute hard time budget, 1,150-ms
serial pacing, and 429/503 hard stop remain in force. A terminal run prints
the actual successful bill count and `remaining_unscanned`, rather than
assuming the full requested maximum was completed.

For each further batch, review a fresh marker-bearing main change, pass CI
and merge. The next bounded run resumes from existing scan receipts. Never
trigger an unreviewed direct dispatch, a forced empty push, overlapping
Revisor jobs or an uncontrolled parallel crawl.
