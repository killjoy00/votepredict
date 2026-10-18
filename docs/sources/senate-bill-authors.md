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

### Verified second bounded Revisor batch: October 16, 2026

[Production run #38980045574](https://github.com/killjoy00/votepredict/actions/runs/38980045574)
concluded **success**. The collector attempted **1,787** of a requested maximum
3,000 official bill lookups; **1,785 succeeded**, two incurred retryable source
errors, none returned not-found, and no throttle stop occurred. It correctly
stopped at the enforced **65-minute collection budget**, rather than claiming
all 3,000 requests or allowing an unbounded production job. The latest run
stored **3,922 extracted XML author entries**, which can overlap journal rows.

The protected production readback confirms:

| Session | Successful official XML scans, cumulative | Distinct raw Senate author rows | Existing membership links |
| --- | ---: | ---: | ---: |
| 2021-2022 | 0 | 2,937 | 2,936 |
| 2023-2024 | 0 | 2,133 | 2,133 |
| 2025-2026 | 5,133 | 12,509 | 12,509 |
| **Total** | **5,133 / 28,938 (17.74%)** | **17,579** | **17,578** |

**23,805 bill targets remain without success/not-found receipts**, including
retryable source errors. Exactly **zero stored journals** remain unprocessed.
The scanner still prioritizes 2025-2026 Senate files; no HF bill has been
scanned, and older biennia are still awaiting Revisor XML status scans. A
successful workflow is not a claim that overall collection is complete.

### Verified third bounded Revisor batch: October 16, 2026

[Production run #38987337164](https://github.com/killjoy00/votepredict/actions/runs/38987337164)
concluded successfully at 8:44 PM Central. It attempted all **3,000** official
Revisor bill lookups, with **2,998 successes**, two retryable source errors,
no source throttling, and no time-budget cutoff. The run stored 7,865 author
entries, many of which can overlap earlier official or journal captures.
The protected readback reports:

| Session | Cumulative successful Revisor XML scans | Distinct raw Senate author rows | Membership-linked |
| --- | ---: | ---: | ---: |
| 2021-2022 | 0 | 2,937 | 2,936 |
| 2023-2024 | 2,825 | 8,549 | 8,546 |
| 2025-2026 | 5,306 | 12,797 | 12,797 |
| **Total** | **8,131 / 28,938 (28.10%)** | **24,283** | **24,279** |

At that verified readback, **20,807 SF and linked-HF targets** still needed
successful/not-found receipts; **zero stored Senate journals** were pending.
House authors and 2021-2022 SF XML had not yet been processed. A successful
bounded batch is not the same as completing the whole collection.

### Automatically guarded continuation from reviewed main

Owner-authorized ongoing collection is now configured to run **once every two
hours**, on the approved repository default branch only, using GitHub's
`schedule` trigger at `37 */2 * * *` (UTC). An ordinary, separately
reviewed merge commit containing `SENATE_BILL_AUTHORS_PRODUCTION` can also
start one immediate run. **Unreviewed `workflow_dispatch` remains forbidden.**
Scheduling simply reuses the same exact workflow and code already reviewed
on `main`; it cannot point to a feature branch or bypass PR protection.

Both routes first run independent, keyless main verification: exact SHA,
disposable database migrations, full project check/tests, and high-severity
production dependency audit. Only successful checks permit the existing
protected `evidence-readonly-sandbox` Neon job, with exact roster/catalog
preflight, immutable complete migration-ledger checksum validation, guarded
production drift gate, and read-only repeatable-read readback.

The scheduled event is checked for exact cron text, repository, default
branch, authorized workflow ref, main ref, SHA, first attempt, and successful
independent checks before database connection discovery. Scheduled runs never
enable the separate journal-only mode. Existing single-concurrency queue
with `cancel-in-progress: false` prevents overlapping writes, and every
batch keeps a maximum of 3,000 official bill lookups, a 65-minute collector
budget, minimum 1,150ms serial request spacing, hard 429/503 stop, and
idempotent receipts. Nothing writes forecasts, vote serving, models, or
features.

GitHub scheduled events may be delayed or missed; a separate periodic
continuation check can review actual Actions runs and, if needed, submit
a minimal new reviewed marker PR rather than skip safety gates. A run is
**fully complete only if its protected readback reports**
`remaining_unscanned: 0` **and** `remaining_journals: 0`. Successful
bounded runs normally report `bounded_partial`.

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
A scheduled default-branch event or a first-attempt, non-forced main merge
commit containing the marker **SENATE_BILL_AUTHORS_PRODUCTION** must pass
independent-main CI before running in existing evidence-readonly-sandbox. The runner performs
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

A GitHub scheduled run on reviewed main or a fresh reviewed marker-bearing
merge can continue from existing successful/not-found scan receipts.
Never trigger an unreviewed direct dispatch, a forced empty push,
overlapping Revisor jobs or an uncontrolled parallel crawl.

### Verified October 18 finish-line checkpoint and guarded final continuation

[Scheduled protected production run #39123928861](https://github.com/killjoy00/votepredict/actions/runs/39123928861)
completed at 7:46 AM Central on October 18, 2026. Its *actual protected
readback* found **27,082 successful first-party Revisor bill XML scans out of
28,938 SF and linked-HF targets (93.59%)**, with **1,856 unscanned/retryable
targets** and **zero pending stored Senate journals**. The bounded batch
attempted 2,802 official lookups: 2,795 succeeded, seven encountered retryable
source errors, none were a hard 429/503 throttle, and the collector correctly
stopped at the 65-minute time budget. These are bill receipts, not counts of
unique authors, and **bounded_partial** remains the correct status.

| Session | Target SF + companion HF bills | Successful XML scans | Remaining targets / retryable failures |
| --- | ---: | ---: | ---: |
| 2021-2022 | 8,652 | 6,826 | 1,826 |
| 2023-2024 | 10,481 | 10,467 | 14 |
| 2025-2026 | 9,805 | 9,789 | 16 |
| **Total** | **28,938** | **27,082** | **1,856** |

The owner requested an immediate final bounded continuation rather than
waiting for a potentially delayed GitHub cron. A **fresh reviewed main merge**
containing the workflow's exact **SENATE_BILL_AUTHORS_PRODUCTION** commit
marker may launch one more batch through independent main CI and existing
protected Neon gates. Keep the 3,000-request cap, 65-minute cutoff, serial
1,150-ms source pacing, ledger/drift checks, source-throttle stops and
idempotent receipts. No change to forecasting, serving, votes or features.
**Do not claim completion until the new protected receipt explicitly shows
remaining_unscanned: 0 AND remaining_journals: 0.** Retry any
persistent source errors in a subsequent separately safeguarded pass.

### Owner-directed pause for manual review: October 18, 2026

**This section supersedes earlier scheduled-continuation instructions.**
The latest [protected collection run #39143427734](https://github.com/killjoy00/votepredict/actions/runs/39143427734)
finished October 18, 2026 at 11:16 AM Central. Its protected readback
reported 28,897 successful official XML scan receipts out of 28,938 target
bills (99.86%), zero pending stored journal scans, **41 outstanding
retryable source errors**, no Revisor 429/503 throttle, and a safe
bounded-partial outcome. All 28,938 targets had been attempted by then.

| Session | Targets | Successful source scans | Retryable source errors |
| --- | ---: | ---: | ---: |
| 2021-2022 | 8,652 | 8,640 | 12 |
| 2023-2024 | 10,481 | 10,468 | 13 |
| 2025-2026 | 9,805 | 9,789 | 16 |
| **Total** | **28,938** | **28,897** | **41** |

At the owner's explicit request, the recurring bill-authorship collection
schedule is **disabled** for a human-led review of these 41 exceptions. The
workflow is kept for *future manual, separately reviewed* continuation via
a new main-branch merge with the exact existing production launch marker,
independent CI, protected Neon gates, and source rate limits. This pause
merge must **not** contain the launch marker; it does **not** trigger
another production collection. The two ChatGPT authorship continuation
watch tasks were separately disabled. Other VotePredict workflows are
out of scope and are not paused.

**Manual review protocol:** Obtain the actual 41 bill identifiers,
session, chamber, prior HTTP status, last checked timestamp and retry
attempt count from a bounded production **read-only** query against
senate_bill_author_scans joined to bills and legislative_sessions. Group
failures by response type and source year. Inspect official Revisor status
XML and bill status HTML with polite, serial requests only if needed.
Distinguish a genuinely unavailable status, a transient upstream failure,
an XML identity/format mismatch, and a wrong catalog/session or companion
mapping. Record each case and proposed remedy; do not fabricate authors
or dates, and do not automatically retry/write to production without a
separately reviewed recovery decision. A 41-case exception inventory is
not proof that 41 official bills have no authors.
