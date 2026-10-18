# #863 SF3534 original roll call versus nine stored choices

**Audit-only.** This is a bounded follow-up to official Senate committee source review [Actions run #39173213086](https://github.com/killjoy00/votepredict/actions/runs/39173213086), not authorization to correct any stored roll call.

The original official [February 21, 2024 Senate Judiciary committee minutes](https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/20240221/Jud_20240221_minutes.pdf) have a **unique complete printed member roll** associated with a `SF3534` amendment and a 6 YEA / 4 NAY recorded result. Original captured PDF: 210,882 bytes, SHA-256 `a109e8cbdd2edacc705c4494c35bc096052e9ceb69e16fbbc296b36506dbfa5d`, independently reproduced by original source evidence run.

The separate 2026-10-18 **protected read-only** Senate historical source-vote census ([run #39172012304](https://github.com/killjoy00/votepredict/actions/runs/39172012304)) found the existing `SF3534` 2024-02-21 Senate committee amendment `vote_event` with aggregate 6–4 but only **5 YEA / 4 NAY** stored individually assigned choices. The missing name cannot be deduced from counts or surrounding prose.

A new one-shot reviewed-main protected **original document → exact vote-event** audit `scripts/audit-historical-roster-863-sf3534-named-readonly.ts` now:
1. Independently re-fetches the exact official PDF with no redirects and verifies the original 210,882-byte SHA **before** protected Neon access.
2. Requires exactly one printed 6–4 ten-member `SF3534` roll from the original and the prior exact event's opaque SHA fingerprint among a fixed, bounded, single-date Senate committee source query.
3. Compares original **publicly printed** names and side against the nine already-stored `source_member_name` or linked public legislator names, using strict Unicode-normalized whole-name identity, never surname-only inference.
4. Emits only the counts, public original-only unmatched name *if uniquely established*, side, and source-hash-parity Boolean. All protected DB identifiers, nine database names and connector credentials stay internal to the protected runner. The existing original transaction is `REPEATABLE READ READ ONLY`, ending in explicit `ROLLBACK`.

The result can distinguish **one source-named senator absent from stored individual votes** from a naming/identity bridge discrepancy. Even a uniquely missing original source-name is not authority to backfill a historical member vote or rewrite the frozen model without a subsequent separately reviewed, source-identity-verified scope. No #718 historical feature re-admission, no Vercel changes, no 2027 capture.

The other three currently unavailable originals belong to **2022 Finance** minutes (2022-02-10 SF2848; 2022-03-02 SF2302; 2022-05-19 HF3346) and remain explicitly source-unverified. They must not be counted as verified original roll calls in this audit's closeout.
