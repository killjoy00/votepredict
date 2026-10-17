# Exact Senate questions, papers and historical roles

Migration 0035 adds a research layer for the 2021–22, 2023–24 and 2025–26 Minnesota Senate. It preserves accepted vote events, member choices, source-document identities, serving models and frozen evaluations. It does not replay positional event keys.

## What is linked

`senate_vote_paper_current_v` preserves source-local question/proposal identity with original extracted-character locators, full literal proposed amendments, explicit base-version references, outcomes and the ordered keys of amendments adopted earlier **in the same journal**. Rejected proposals remain inspectable and never enter that adopted list. Voice actions remain distinct without invented named choices. The list is not claimed to be a complete cross-day or assembled legislative text state.

`senate_vote_paper_exact_raw_v` links only uniquely matching raw questions. `senate_vote_paper_exact_event_v` links accepted events by source URL, session/date/bill, question wording, stated tally, and the entire normalized named ballot. Ambiguous repeated questions/ballots remain unresolved, even when their proposals differ. No connection is based solely on bill number, tally, latest edition or positional ordinal. If accepted and raw records use different source rows at the same URL, the connection is visible only after a fresh government-PDF download matches the retained extracted text. Fresh PDF byte SHA and size are retained independently; legacy source fingerprints are preserved.

Changing source payloads hides their old derived actions/links. Changing an accepted event or its ballot invalidates its link fingerprint. Source scans and failed verification attempts are fingerprinted and bounded so unavailable sources do not permanently crowd out the remaining work.

Nested amendment/withdrawal sequences that are not fully separated are held rather than combined into an exact proposal. Source-local prior-adoption lists include recovered actions only; they are not exhaustive when a source sequence remains unresolved.

`senate_vote_paper_components_current_v` connects an explicitly named base locator to captured text for that bill. Conflicting retained text hashes at the same version URL hold that representation rather than selecting a latest body. HTML and PDF representations preserve their separate original bytes and extracted-text hashes. Full assembled amended-bill text remains explicitly **unverified**. A linked question or amendment is not automatically a complete final-passage paper.

## Historical text and role dates

The collector stages exact numbered, unofficial-engrossment and conference-report URLs, including official PDF representations, from existing text stores and explicit journal references. Exact base references are also queued for current original-body acquisition. A current download proves current wording, not historical availability.

Historical jobs acquire actual original archived bodies, not just CDX timestamps. They keep original URLs, replay URLs, capture clocks, body hashes and parsing outcomes. Source host/path, bill identity and historical session are checked. An archive response with a contradictory Memento clock is held. Bill text is captured only from the requested version with legislative body content; latest-version and wrong-bill pages are rejected. Matching old bodies can supply `archived_observed_at` without overwriting retained wording. Archive attempts and source jobs preserve unavailable/unparsed outcomes; those are evidence gaps, not successful historical captures.

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

The initial run scans up to four 1,000-document batches, independently verifies up to 12 original journals, fetches up to 60 explicitly named base URLs and checks up to 30 historical archive jobs. Later runs use smaller budgets. Archive jobs alternate between text/role families and all three biennia. Committee URL variants are discovery leads whose bodies must independently pass session-specific parsing. Counts and hashes are logged; raw bodies, ballots, UUIDs and credentials are not emitted.
