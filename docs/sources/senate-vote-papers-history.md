# Exact Senate questions, papers and historical roles

Migration 0035 adds a research layer for the 2021–22, 2023–24 and 2025–26 Minnesota Senate. It preserves accepted vote events, member choices, source-document identities, serving models and frozen evaluations. It does not replay positional event keys.

## What is linked

`senate_vote_paper_current_v` preserves source-local question/proposal identity with original extracted-character locators, full literal proposed amendments, explicit base-version references, outcomes and the ordered keys of amendments adopted earlier **in the same journal**. Rejected proposals remain inspectable and never enter that adopted list. Voice actions remain distinct without invented named choices. The list is not claimed to be a complete cross-day or assembled legislative text state.

`senate_vote_paper_exact_raw_v` links only uniquely matching raw questions. `senate_vote_paper_exact_event_v` links accepted events by source URL, session/date/bill, question wording, stated tally, and the entire normalized named ballot. Ambiguous repeated questions/ballots remain unresolved, even when their proposals differ. No connection is based solely on bill number, tally, latest edition or positional ordinal. If accepted and raw records use different source rows at the same URL, the connection is visible only after a fresh government-PDF download matches the retained extracted text. Fresh PDF byte SHA and size are retained independently; legacy source fingerprints are preserved.

Changing source payloads hides their old derived actions/links. Changing an accepted event or its ballot invalidates its link fingerprint. Source scans and failed verification attempts are fingerprinted and bounded so unavailable sources do not permanently crowd out the remaining work.

Nested amendment/withdrawal sequences that are not fully separated are held rather than combined into an exact proposal. Source-local prior-adoption lists include recovered actions only; they are not exhaustive when a source sequence remains unresolved.

`senate_vote_paper_components_current_v` connects an explicitly named base locator to captured text for that bill. Conflicting retained text hashes at the same version URL hold that representation rather than selecting a latest body. HTML and PDF representations preserve their separate original bytes and extracted-text hashes. Full assembled amended-bill text remains explicitly **unverified**. A linked question or amendment is not automatically a complete final-passage paper.

## Population-wide vote-to-text gap audit (#1498)

The same independently gated, protected production readback now includes `coverage.gapAudit`, a **read-only** event-level reconciliation of **every accepted Senate vote event** in the three requested biennia. It is a classification of existing evidence, not an attempt to reconstruct an unspecified version or to overwrite accepted votes. It is checked against the already deployed `senate_vote_paper_coverage_v` denominator for **both** accepted event counts and exact event-paper question links; disagreement fails the protected run.

Each event falls into exactly one stage:

- `exact_question`: the preexisting unique official-question/full-named-ballot linkage is intact. Separate counters show literal proposed text, explicitly named base version, captured base representation, in-journal earlier adopted actions, and original-source verification. **None** is a certified complete assembled bill state.
- `same_source_day_bill_unlinked`: a parsed paper exists in the **same original document, bill and day**, but the exact question+ballot link did not pass. Audit the original question, distinct ballot/motion and possible parser defects; never auto-attach by date/bill.
- `same_bill_day_other_source`: paper exists for the same bill and date but not the accepted event's exact document source. A fresh government-source/PDF identity proof is needed, not simply identical vote tallies.
- `bill_papers_on_other_dates`: this bill has papers, but not on the event date. Publication date cannot substitute for acted-on text.
- `no_parsed_paper_for_bill`: existing paper parser has no source-local paper for this resolved bill. Retrieve/inspect the correct official journal, committee text, or missing paper only after identifying original source context.
- `no_resolved_bill`: the accepted event itself lacks a bill link; do not assume its text from neighboring proceedings.

The output breaks these categories down by session, existing vote kind and source family (`senate_journal`, `committee_minutes`, `other_source`), with at most 18 **public bill/day-only** examples and a bounded HF100 April 28, 2023 original-action pilot. It includes no raw journal text, named member choices, internal IDs, SQL connection strings, or source URLs. A committee-minute vote does not inherit a floor-journal paper link. A procedural vote may have a completely specified *question* without constituting a vote to enact particular policy language.

The original October 20, 2026 protected snapshot counted **2,308 accepted Senate votes and 890 exact question links** (455/658 passage, 225/1,218 amendment), **82 captured explicit base components**, and **zero certified complete assemblies**. These are baseline measures until the new readback is verified; source-local paper counts are not interchangeable with the event denominator.

Once the gaps are measured, first review journal-origin `same_source_day_bill_unlinked` votes by original question text, recorded ballot and amendment disposition. Every improvement must originate in authentic source evidence and pass exact-match conflict tests. The first source-backed pilot remains HF100 April 28, 2023: journal states first unofficial engrossment as the amendment base, with four amendments adopted and one rejected before final passage. The existing source-only PDF SHA ledger is not itself a stored event identity match. The live vote model and time-sensitive `senate_evidence_asof` remain untouched.

### Original-source HF100/HF1/HF7 individual cases

The guarded protected production readback also reports `coverage.caseAudit` from the
existing **verified REPEATABLE READ, READ ONLY transaction**. The diagnostic compares
stored current paper actions against accepted votes from the **same exact
official source URL and day**, even when the verified original and its accepted
vote events have separate database source-document rows. Cross-row matching is
permitted only where the paper original is independently verified. It recomputes normalized complete named ballot
signatures inside the transaction, and separates full-question matches from
unique-ballot-only candidates, unresolved bill identities, repeated ballots,
and absent candidate ballots. Only aggregate category counts and source
ordinal/kind/tally for the **HF100** pilot are emitted; member ballots, names,
internal IDs, URLs and source bodies are never logged.

The source-pinned cases are **HF100 on April 28, 2023**, **HF1 on January 27,
2023**, and **HF7 on February 2, 2023**. Unlinked but same-ballot events are
investigation candidates, *not* links: a vote on tabling a bill can share its
division with a motion to re-refer it, and repeated amendment divisions can
be identical. Prior original-PDF provenance remains required before any
new append-only event/paper link is created. The 2,308-event denominator
and existing official-vote integrity safeguards stay unchanged.

### HF100 first-unofficial printed-line anchor pilot (source-only)

A separate keyless original-source canary pairs the April 28, 2023 authenticated Senate Journal with the **official Revisor HF100 first unofficial engrossment PDF**, not a later engrossment or the live/last version. The canary preserves the full official PDF byte digest and verifies printed `page.line` coordinates against the extracted first-unofficial text. A source offset from the journal is not assumed to be a Revisor printed page number.

The targeted, in-memory proof is **strictly narrower than full amendment application**:

The downloaded Revisor original was independently verified in both PR workflows at SHA-256 `547d33380988ad84e1e8fdec6d421437f5eb699f51465bff111b4519f883369c` (5,716,766 bytes); the keyless canary now pins both values and must fail on changed source bytes.

- **Port (adopted):** four literal `before ... insert` operations anchor to their individually specified printed lines on pages 56 and 71. The first instruction explicitly means the **second** instance of “eight” on line 56.7. The remaining **15 instructions in the same adopted Port amendment are NOT interpreted**, so Port has only *partial anchor coverage*, not a completed amendment or state.
- **Hoffman (adopted):** one complete source instruction on page 296, line 19 deletes two occurrences of `$4,000,000` and inserts `$5,500,000` in their places. Both deleted anchors must occur **exactly twice on that one printed line**, be consumed exactly, and yield two added new anchors. The resulting single-line text is kept in memory and never persisted or represented as an assembled bill.
- **The two adopted Hauschild amendments:** not interpreted as patch instructions; they include structural or appropriation changes. The **rejected Hauschild amendment** is excluded from passage. The passage still carries the four original adopted source keys in exact order.

Expected verified research-only outcome: **five distinct printed base lines anchored; four partial Port insertions; two Hoffman line replacements; one of four adopted amendments completely instruction-checked **in isolation**; three other adopted amendments without full instruction proof; **all four** still held for composite application; zero full bill assemblies and zero newly linked accepted votes**. Any mismatching printed line, changed source wording, missing/duplicate anchor, original digest drift or reordered adoption chain fails the canary instead of silently choosing a nearby line or latest edition. This does **not** prove the full amended HF100 text that went to final passage, a complete text hash or historical publication-before-vote timing. No accepted event, serving model or database table is modified by the proof.

### HF100 Port instruction coverage continuation (source-only)

The follow-on original-source check enumerates **all 19** Port amendment instruction
headings in the original April 28, 2023 Journal order and binds each target to
its **original first-UE printed page.line**, never to an approximate neighboring
line or an implicitly renumbered post-amendment page. The independent PR canary
uses the already pinned original Revisor PDF bytes. Four previously checked
insertions stay hard-gated by the existing pilot.

Nine additional instructions are *eligible* for isolated local preview only:
four simple inserts/replacements on pages 146, 148, 177 and 251; the
page 291.26 replacement; and four local changes on page 292 (lines 1, 26,
27 and 28). Each earns a checked count **only** if its exact printed line,
complete literal anchor and any required occurrence cardinality agree. Text
layer fusion (for example `grantsissued` or `isfor`) is an explicit hold,
not permission to guess where spaces belong or replace a nearby token.
The six other Port instructions—page 144.22/23, page 175.7/8, and
page 291.27/28–32—are always held as structural or cross-line operations,
even when their original page/line coordinates exist.

This checker reports instruction-level aggregate outcomes. It deliberately
does **not** materialize, store, hash, certify, or publish a completed Port
amendment; it does not resolve renumbering, quoted multi-line replacement
layout, the two adopted Hauschild amendments, dependent appropriation
adjustments, the composite final-passage bill text or pre-vote web availability.
The one rejected Hauschild proposal remains outside the passage chain.
An unresolved new anchor reduces the verified-local count and raises the
held count; it never triggers a guessed amendment. No serving table or accepted
vote/event link changes.

## Historical text and role dates

The collector stages exact numbered, unofficial-engrossment and conference-report URLs, including official PDF representations, from existing text stores and explicit journal references. Legacy-store discovery prioritizes bills with Senate official votes or raw proceedings links; it does not spend the historical retrieval budget on every unrelated House bill. Exact base references are also queued for current original-body acquisition. Publisher redirects are followed only within the same explicit bill/edition/representation and biennium, or between the exact assignment-sheet paths on www.senate.mn and assets.senate.mn. Resolved source URLs are retained; off-site, wrong-bill and wrong-edition redirects are rejected before fetching. A current download proves current wording, not historical availability.

Historical jobs acquire actual original archived bodies, not just CDX timestamps. They keep original URLs, replay URLs, capture clocks, body hashes and parsing outcomes. Source host/path, bill identity and historical session are checked. An archive response with a contradictory Memento clock is held. Bill text is captured only from the requested version with legislative body content; latest-version and wrong-bill pages are rejected. Matching old bodies can supply `archived_observed_at` without overwriting retained wording. Archive attempts and source jobs preserve unavailable/unparsed outcomes; those are evidence gaps, not successful historical captures.

Both modern version paths and the original Revisor `text.php` URLs are searched. Legacy query fields must identify the same regular-session bill and explicit edition; latest, duplicate parameters and special sessions are excluded. Introduction URLs for Senate-voted/heard bills are staged even when the legacy text store retained only a mutable latest body. The small metadata-only `historical-capture-leads-v1.json` preserves one independently downloaded positive canary: HF100's January 5, 2023 introduction capture. Its exact archived body SHA/size must be independently matched again before ingestion. This verifies an observation upper bound, not the first publication moment or statewide coverage.

The assignment parser preserves wrapped committee headings and PDF column boundaries, so neighboring surnames are not combined. Regular members are recovered only from explicit column cells or unambiguous single-name rows.

Role recovery has three explicit bases:

- `role.authenticated_archive_observation`: the literal historical committee/leadership page or assignment PDF was observed at the retained archive capture.
- `role.official_action_date`: a dated official journal records an actual election/adopted leadership declaration, or official minutes explicitly identify a chair/vice chair. Nominations, witnesses' outside titles and generic reporting senators are not promoted into roles. This is a historical legislative-act fact, not a claim that a web page was published that day.
- `role.dated_roster_fetched_at`: a freshly downloaded original official assignment PDF explicitly dates its list within the requested biennium. Its stated role-fact date and the actual download clock are retained separately. A bare biennium/year is insufficient. The printed date does not backdate current wording in the strict as-of interface. `role_observed_on` remains available for an explicitly selected retrospective factual-role experiment, without pretending the PDF's historical public availability was proved.

`senate_role_history_v` retains both clocks, original words and nullable stated tenure dates. These observations also enter `senate_role_evidence_v` and the shared `senate_evidence_asof` interface. The date-exclusive cutoff excludes the entire target day. Point observations do not silently become whole-biennium or indefinite tenures. A prior role observation can be a historical feature; it does not establish that the member still held that role on a later vote date.

## Coverage and remaining uncertainty

```sql
SELECT * FROM senate_vote_paper_coverage_v ORDER BY session, vote_kind;
SELECT session_slug, kind, count(*), count(proposed_text)
FROM senate_vote_paper_current_v GROUP BY session_slug, kind;
SELECT observed_basis, count(*), count(membership_id)
FROM senate_role_history_v GROUP BY observed_basis;
```

The coverage denominator is accepted official Senate **events**, split by session and motion kind. Separate columns measure exact question identity, exact proposal text, original-source verification, any same-bill text observed before the vote day, and an explicit exact base observed before that day. None substitutes for complete amended state. Pipeline readback additionally separates senator/vote-day pairs with an earlier admissible role observation from those with only a retrospective dated-roster fact. Neither counts proven continuous tenures.

`complete_assembled_bill_text` is false and `availability_relation` is `at_vote_identity_not_pre_vote_publication_proof`. Officially considered wording, historical web availability, and introduction-time availability are different questions. An exhaustive modeling exercise must select the intended prediction horizon and eligibility rules explicitly. These views are not a deduplicated training matrix and do not change forecast weights.

## Execution and continuation

`.github/workflows/senate-paper-history-production.yml` runs after a reviewed main merge bearing `SENATE_PAPER_HISTORY_PRODUCTION`, then at `11 * * * *` UTC. It independently applies all migrations to disposable Postgres, runs full checks, verifies four pinned original Senate PDFs and audits production dependencies before entering the existing protected Neon environment. The production job checks primary identity and the complete checksum ledger, applies only 0035, performs bounded idempotent recovery, then uses READ ONLY / ROLLBACK for coverage. Main continuation can coexist with later reviewed migrations only when the complete ledger matches; it never silently skips pending migrations.

The initial run scans up to four 1,000-document batches, independently verifies up to 400 original journals within a ten-minute budget, fetches up to 60 explicitly named base URLs and checks up to 30 historical archive jobs. Later runs verify up to 30 journals within three minutes and use smaller acquisition budgets. A freshly reviewed push may immediately retry earlier canonical-URL failures while retaining the three-attempt cap. Archive jobs alternate between text/role families and all three biennia, prioritizing actual Senate floor-voted bills within each text family. Committee URL variants are discovery leads whose bodies must independently pass session-specific parsing. Counts and hashes are logged; raw bodies, ballots, UUIDs and credentials are not emitted.
