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
fill a seat or change historical models. This report is not an activation gate
yet; #287 tracks the separate cross-source gate and live bootstrap.

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
