# #864: Parallel track 2 — 2022 Minnesota Senate statutory filing denominator, first ballot-predicate source acquisition

This is an **independent legal-completeness track**. It must never block the separate original report PDF acquisition, and it must never turn election results into historically available campaign finance predictions.

### Two original Secretary of State elections sources

The Minnesota Secretary of State publishes official downloadable state-Senate text-file election results for:

- The 2022 August 9 primary: https://electionresultsfiles.sos.mn.gov/20220809/stsenate.txt (contested party primary results only; an unlisted primary candidate is NOT proof the candidate did not file for election).
- The 2022 November 8 general election: https://electionresultsfiles.sos.mn.gov/20221108/stsenate.txt (general ballots by all 67 state Senate districts, exclude statistical WRITE-IN aggregates from candidate-person counts).

The source script re-downloads those exact official 2022 TXT paths with redirect and size validation; it checks all 67 general Senate districts, vote/district/name layout and duplicate row identities, hashes original bytes, and stores only public candidate name, office district, party and vote totals in memory. No election result/vote totals are stored in the source artifact or fed to the model. Only public candidate name, district, party, match status and source version digests are kept.

In parallel, the source script re-downloads the **67 original CFB 2022-segment Senate district candidate selection pages** from https://register.cfb.mn.gov, cross-checking **all 270 uniquely observed committee registration numbers** against the original pinned 494-ID, 268-page CFB source inventory. This is an independently verified public roster retrieved in **2026**, *not* a proof the committees were registered throughout 2022 or that every Senate candidate registered a committee.

Candidate identity joins require **exact Senate district and normalized first and last names**. Extra middle names/initials are tolerated, but fuzzy/similarity/name-only comparisons are forbidden, and multiple same-person matches become explicit ambiguity. Unmatched candidate rows are reported, never erased. The source output distinguishes independently matched general-ballot participants from candidates observed in *contested* primaries. No result of an uncontested primary is inferred from absent primary-results data.

### What this enables

The CFB original 2022 candidate report-viewer inventory already contains **146 2022 pre-primary original-version C references and 125 pre-general E references** across its source-pinned 270 Senate registrations. This independent SOS/CFB identity reconciliation determines which candidates are explicitly evidenced on the general ballot, an important input toward deciding whether a 2022 pre-general campaign report obligation could apply. Future reconciliation must match each CFB registration to the actual dated **registration/termination episodes** and candidate affidavit/ballot filing history and then reconcile expected original reports to their verified PDFs. The SOS general result is a *necessary predicate* for some pre-general reports but is not by itself a legal duty. The SOS primary result covers **contested races only** and is not a complete filing roster.

For original regular 2022 Senate candidate reports, the independently dated CFB calendar found at https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf distinguishes pre-primary **July 25** and pre-general **October 31**, with the pre-general report not required for candidates who lost the primary. See Minnesota Statutes §10A.20, subdivision 2 (historical 2022 version), which also distinguishes non-ballot committees, and §10A.243 for termination. None of that can establish which reports were legally due without time-correct lifecycle and filing applicability.

**No 2022 Senate required-report denominator is asserted from these sources alone.** Historical original PDF verification, election-ballot legal predicates, and time-correct registration history are independent tasks. Source-failure, missing roster entries, missing registration from current-day CFB lists, unmatched names, and missing viewer references can never be interpreted as zero original filings or nonfilers.

No production database, Vercel, Neon, model or serving changes; no campaign contacts or 2027 expansion. Issue #864 stays open.
