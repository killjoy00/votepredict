# #864: six new actually-serving senators, 2022 candidate campaign originals

## Scope and status (October 11, 2026)

A new, independently identified six-person candidate research batch not in the existing **496 exact excerpts / 39 Senate-serving people** checkpoint. Every person is verified as an **actual 2023 Minnesota state senator** against the original full Minnesota Legislative Reference Library Senate service directory, downloaded in Actions run `38094976711`, artifact `11685387674`, original HTML SHA-256 `bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51`. Districts are election/2023 service labels, not distinct identities when redistricting occurs.

| Actual senator | 2023 Senate district | Candidate-domain discovery lead (NOT verified 2022 source) | Potential source section |
|---|---:|---|---|
| Paul Utke | 5 | https://paulutke.com/ | https://www.paulutke.com/issues.html |
| Gene Dornink | 23 | https://genedorninkforsenate.com/ | https://genedorninkforsenate.com/ |
| Melissa Wiklund | 51 | https://wiklundforsenate.com/ | https://www.wiklundforsenate.com/ |
| Jim Abeler | 35 | https://jimabeler.com/ | https://www.jimabeler.com/ |
| Scott Dibble | 61 | https://scottdibble.com/ | https://www.scottdibble.com/ |
| Bobby Joe Champion | 59 | https://thechampion4change.com/ | https://www.thechampion4change.com/ |

## What the source workflow actually tests

The one-time, PR-specific GitHub Actions workflow rehashes the independent government original and observed-UTC receipt **before any candidate domain network request**. For each approved host, the job obtains a real historical Wayback CDX index between Jan 1 and Nov 7, 2022, saves the original index JSON and request status, selects up to four issue/priority/home/etc. paths from at most 300 indexed source rows, and replays **original archived HTML**. It accepts each original HTML only if actual downloaded bytes match the independently obtained CDX SHA-1 Base32 digest, retaining their SHA-256 and the actual original archive capture UTC. The full original bytes, immutable metadata and any errors are published as a temporary source-only Actions artifact; source-quote selection comes **later in a separate independently audited research PR**.

## Critical exclusions

- A currently live campaign site and even a retained 2022 district label is **not** original 2022 evidence. No current text has been backdated.
- A Wayback CDX 200 response can still be unparseable; an empty/capped/unavailable index or a failed replay does **not** prove lack of a policy page.
- Original archive capture UTC establishes a statement's public-by time **only when the exact wording is verified inside the authentic candidate-owned original HTML**; it does not prove when first drafted/posted.
- A claim to have co-authored, supported or voted for legislation is just a candidate **claim**, never an independently proven recorded vote.
- This phase deliberately yields **zero admitted policy positions**. Do not add these six to the statement-covered 39-person total until full-source human issue excerpts are selected and independently byte/re-hash audited.
- No production database reads or writes, Neon, Vercel, 2027 program, live forecasts, model changes, source ingestion, private records, outreach or scheduler activation. Issue #864 remains open.

## After acquisition

Read the genuine source artifact; independently check the CDX captures, original HTML source-byte hashes, surname identity and exact policy section text. Create the next small **separate** research-ledger PR with strictly short exact excerpts, source URLs, archived capture UTC, old-cycle context and a full offline quote audit requiring green full repo CI on final head. Account separately for genuine pages with **zero** qualifying attributable statements and for failed archive retrievals.
