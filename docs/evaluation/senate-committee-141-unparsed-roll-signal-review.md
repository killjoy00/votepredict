# Issue #864 — review priority for 141 Senate Minutes PDF roll-call signals not parsed as votes

The independent original [2022–25 source PDF action audit](./senate-committee-2022-25-original-pdf-action-census.md) adequately parsed embedded text from **1,245 official original** Senate electronic minutes PDFs. Its existing deterministic vote parser found many supported named/count-only rolls, but **141 parsed PDFs also contained a literal roll-call phrase while the parser found no supported recorded roll observation in that PDF**. These are *candidate semantic gaps*, not 141 verified unrecorded votes and not the 141 electronically indexed meetings with no Minutes link (that is a separate missingness bucket).

Exact source counts from the previously hashed four original year artifacts:
- 2022: 17 possible unparsed-roll documents, **2** also with YEA/NAY-style labels.
- 2023: 74, **14** with YEA/NAY-style labels.
- 2024: 26, **13** with YEA/NAY-style labels.
- 2025: 24, **12** with YEA/NAY-style labels.
- Total **141** source candidates, **41** with the stronger but still nonauthoritative AYE/NAY label cue.

The metadata-only [one-time queue workflow](../../.github/workflows/senate-committee-141-unparsed-roll-review.yml) downloads the *exact* earlier original-source GitHub Actions artifacts (run #38066441841). Each JSON must match the permanent source-ledger SHA-256, original-year embedded-text success count and exact possible-unparsed signal counts; no current public source fetch, image/OCR or private database access takes place. Every candidate receives original LRL source PDF URL/date, raw PDF/text hashes, cue counts and review priority. The priority heuristic ranks a positive YEA/NAY text-label cue ahead of repeated 'roll call' mentions and isolated mentions, but **does not certify individual member choices, distinct roll motions, or absence/presence of actual votes**.

This generates a stable review queue for a **subsequent manually validated source review**: inspect the original lines/pages around the cues; differentiate attendance roll calls from vote roll calls; verify any explicit named YEA/NAY choices against exact official original and motion context; retain named identity only with source-proven member attribution; leave count-only, voice/unanimous and outcome-only motions as contextual. Preserve hearing date for source action date and exclude same-day vote cutoff. No historical private DB reads/writes or model/forecast/serving/scheduler/2027 changes, and no office contact. 2021 print-only, 2022 print/electronic and 141 meetings with no linked original Minutes remain unresolved. Keep #864 open.

**Do not count the queue as missed votes or upgraded evidence** before original page-level semantic validation and separately authorized source-to-private-DB reconciliation.
