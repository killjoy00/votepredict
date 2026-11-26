# 2027 opening roster audit (read only)

The opening-term roster is a seat-accounting problem, not a minimum headcount.
Minnesota has 134 House districts (1A–67B) and 67 Senate districts. The official
term begins January 4, 2027; regular session convenes January 12. The existing
nominal biennium partition remains 2027-01-01 through 2028-12-31.

Run the bounded public LRL audit only when source requests are appropriate:

```sh
node --import tsx scripts/audit-2027-opening-roster.ts
```

This fetches the 95th Legislature's directory and one detail page per listed
person. It uses no database, credentials, Vercel, paid APIs, or model execution.
The report covers each expected district, duplicate and conflicting term blocks,
missing or invalid term dates, out-of-term records, cross-seat identities and
source-reported oath dates. No missing seat is called vacant without independent
authoritative evidence. A future oath date is a reported date, not an oath event.

Even 201 single-candidate seats do not certify the active roster. Reconcile the
results against certified election outcomes (including final recounts), the
official chamber rosters and actual oath records. Account for genuine vacancies
explicitly using authoritative source evidence. Do not make up a legislator to
fill a seat or change historical models. The initial LRL import now enforces district-level integrity in the roster transaction. Independent certified election, vacancy and oath reconciliation remain tracked in #287.

Official source references:
- https://www.sos.mn.gov/election-administration-campaigns/data-maps/2026-election-by-the-numbers/
- https://www.sos.mn.gov/elections-voting/election-results/2026/2026-general-election-results/2026-state-recounts/
- https://www.leg.mn.gov/leg/faq/faq?id=175
- https://www.house.mn.gov/hinfo/news.asp
- https://www.house.mn.gov/ (House members-elect roster)
- https://www.lrl.mn.gov/legdb/results?body=Both&gender=&q=&search=session&sess=95

The November 26, 2026 source review found published 95th Legislature LRL
individual records and a House members-elect roster. It did not establish
complete directory coverage, final recount outcomes for every district, or the
2027 House voting-system native session key. Do not infer that numeric key from
prior years. The source review did not run this audit against the live directory.

November 26 recheck: the Secretary of State's downloadable district results are distinct from final recount certification. The statewide Senate District 4 recount report (recountId=62) remains explicitly unofficial despite full precinct reporting. The House 32A recount report (recountId=61) likewise carries an unofficial warning; verify the actual canvass certificate. Senate District 33 is reported certified November 19. Do not treat provisional winners or a future oath date as settled opening-day evidence.

## First House votes

The explicit `--session=2027-2028` House history importer resolves the numeric native key from the official regular-session index only, verifies the summary heading and vote page bill/date scope, and rejects `--skip-existing` for the live biennium because previously observed bill pages can receive new votes. The 2027 Senate identity namespace remains unchanged. Start with a bounded source-only dry run after publication; do not activate production collection through this document.

## November 26 live checkpoint

The secret-free public-source checkpoint in [run 45885033629](https://github.com/killjoy00/votepredict/actions/runs/45885033629) successfully observed 201 LRL directory references, valid SOS district exports for all 134 House and 67 Senate districts (387 and 201 candidate rows respectively), and empty official Revisor search results for both chambers. The House index did not publish a 2027 numeric key and the Senate index request failed. These are point-in-time observations, not proof of future source completeness or roster certification.

Run the separate opening-roster detail reconciliation only when the public directory is populated. It is capped at 201 detail pages, paced sequentially, and stops after five detail errors. It reports each identity mismatch and source-reported term/oath issue, records the SHA-256 of decoded HTML (not original wire bytes), and never certifies or activates the roster. Its isolated GitHub workflow is manual-only on main; the initial dedicated PR performs one observation. No recurring source requests are scheduled.
