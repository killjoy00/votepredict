# #864 — 2022 April 7 Finance committee original minutes, 7 separate named roll passages

## Why this non-audio source gap is actionable

The original 2022 Minnesota Legislative Reference Library **electronic**
[April 7 Finance meeting minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2022/Fin/20220407/Fin_20220407_minutes.pdf)
publicly lists **seven named YEA/NAY roll paragraphs**. The
[pre-existing research ledger](source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json)
preserves the seven actions, printed counts and ambiguities, but explicitly
has **no independent original raw PDF SHA-256 or embedded-text SHA proof**.
The 2022 LRL index itself warns that the separately collected **print**
minutes and electronic minutes may each omit material. The seven electronic
paragraphs **are not the 2022 official print denominator or statewide
2021–2025 committee vote completeness**.

The seven original reported motions have exactly **67 explicit individual
YEA/NAY name occurrences** in the electronic text. Only original minutes
with an explicit named YEA or NAY support member-choice research; they must
not be confused with aggregate voice votes or attendance.

| Bill | Written motion and mover | Printed YEA/NAY | Printed absent | Important |
|---|---|---|---|---|
| SF3510 | Marty A17 amendment | 3–6 | 1 (Champion) | Not adopted |
| SF3510 | Lopez Franzen A16 amendment | 4–6 | 0 printed | Not adopted |
| SF3510 | Kent A15 amendment | 4–6 | 0 printed | Not adopted |
| SF4269 | Marty A15 amendment | 4–6 | 0 printed | Not adopted, distinct from SF3510 A15 |
| SF4269 | Marty oral amendment to A16 | 4–6 | 0 printed | **HOLD**: introduction is oral modification of A16; closing says A16 not adopted, do not silently relabel |
| SF4269 | Kent A17 amendment | 4–6 | **NULL** | No original roll-specific ABSENT line; hearing-opening attendance is not a substitute |
| SF4091 | Pratt recommendation to pass as amended | 5–3 | 2 (Kiffmeyer, Lopez Franzen) | Committee recommendation, **not Senate floor passage** |

The SF3510 A21 amendment was **withdrawn**. Voice adoptions,
recommendations, bill substitutions and withdrawn amendments may be separate
actions but cannot be transformed into named roll calls unless specifically
supported by named-side original text.

## Independent complete-source verification

The one-time, read-only
[original-PDF workflow](../../.github/workflows/senate-2022-finance-apr07-original-seven-roll-pdf-proof.yml)
runs **after its workflow-file introduction on main**, not as a claim
derived from PR CI. The
[original-source acquisition script](../../scripts/audit-senate-2022-finance-apr07-seven-original-electronic-rolls.ts)
only allows the exact LRL URL, an HTTPS 200 PDF with matching MIME and
%PDF signature, strict **8 MiB streaming bound**, no redirects and an
independently calculated complete original PDF SHA-256. It uses the
repository's existing PDF embedded-text extractor then
[an exact written roll parser](../../src/evidence/senate-2022-finance-apr07-original-seven-roll-verify.ts).
The parser fails closed unless all seven separated introduction/roll/AYES/
NAYS/tally/disposition passages match actual source text, the 67 named
tokens remain, printed-absent counts are exactly preserved and the oral
amendment ambiguity stays flagged. Duplicate amendment labels across bills
cannot collapse into a single motion.

No raw original PDF, full minutes text, readable senator YEA/NAY name
rosters or private rows leave the ephemeral GitHub runner. The Actions
artifact contains only source byte count/full SHA-256, extracted original
text SHA, normalization SHA, original motion-context SHA and individual
side-hash commitments, printed counts, separate amendment identification,
original-source retrieval errors and explicit holds.

**A separate new independent original PDF source SHA run or a source
artifact inspection is required before permanently declaring seven
motions cryptographically authenticated.** Green PR CI tests synthetic
motion fixtures only and does not verify original online source access.

## Date and policy boundaries

All seven documented official minutes actions have source meeting day
**2022-04-07**. Under the owner's historical event-day convention, eligible
official minutes actions have `occurred_on` and `available_on`
equal to that *hearing day* **after** their original action and
person-side identities have been independently proved. Same-day forecast
eligibility remains off without reliable motion-versus-vote clock
sequencing; only next-day consideration is possible. The first actual PDF
upload/publication clock is **not** inferred from the future source fetch.
The print/electronic completeness comparison remains **OPEN**, as do
the all-years official recorded-motion denominator and historical
source-to-existing-private-`vote_events`/`member_votes` parity.

No audio or video listening/transcription, no government or senator
contact, no production DB reads/writes, no historical member_vote import,
no model, 2027, forecast, serving, Senate floor or scheduler changes.
**Issue #864 stays OPEN.**

## First ORIGINAL complete-source receipt and parser hold (2026-10-12 UTC)

The [first post-merge original source run #38196825837](https://github.com/killjoy00/votepredict/actions/runs/38196825837)
**failed its full seven-roll acceptance gate**, although its strict first
genuine original government source retrieval **succeeded**. Downloaded
public `source.json` artifact **#11723219510** reports HTTP 200, genuine
full original PDF **140,671 bytes**, full-original PDF SHA-256
`213fbba6aa942cadc6a97fc70fb5e259790cdfadc91d4a645047da67e0dc0a6f`,
and parser-embedded text SHA-256
`804daf007ca99c7dd1d501b09199592d3509d203972054fec6511d30140760a8`.
Its source file was obtained successfully using the exact allowlisted
government URL, PDF MIME/header, finite bytes and no redirects.

**Why the first audit failed:** the actual original official text says
both **"did not prevail"** and **"does not prevail"** on separate roll
motion outcomes. The initial synthetic test grammar only recognized
"did not prevail" and thus **rejected the real written motion
disposition** with failure code `original motion disposition`.
This is a real parser failure, not missing testimony or a missing PDF.
The first source's seven names/rolls **were not certified** by the
failed strict source run.

The next independent source run is deliberately held to the exact
**first original PDF size, SHA-256 AND embedded text SHA-256** above.
The grammar and synthetic fixtures now explicitly include both authentic
negative disposition wordings, without accepting unrelated non-vote
phrases, changing the printed yes/no counts, or resolving the separately
ambiguous **SF4269 oral modification of A16 versus base-A16 closing**.
The updated one-time source workflow is only accepted on success after
landing on main. An artifact failure still means no source-proven
seven-motion success; original print parity, first public-by clock and
source-to-private-database reconciliation remain untouched and unknown.

No human audio listening or manual video review is sought for this track.
