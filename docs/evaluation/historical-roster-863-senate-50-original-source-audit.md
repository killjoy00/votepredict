# #863: Senate 50-event committee tally source review

This is a read-only source audit for [#863](https://github.com/killjoy00/votepredict/issues/863), not an alteration of stored historical labels or a prospective model.

Protected existing Neon read-only main run [#39172012304](https://github.com/killjoy00/votepredict/actions/runs/39172012304) independently located all 50 old internal tally discrepancies and rolled back the transaction.

## Exact initial classification

- **49** Senate committee amendment/motion records contain numeric aggregate `yea_count/nay_count` but **zero** individual `member_votes` rows.
- **1** Senate Judiciary committee amendment on **2024-02-21, SF3534** has `6–4` numeric aggregate and **5 YEA / 4 NAY** individual stored choices. This *may* require source-to-database identity follow-up, not an automatic missing-vote label change.
- No event is a final floor-passage roll call. **47 amendments, three motions**, all with `committeeVote=true`, all `senate_committee_minutes`, all links under the Minnesota Legislative Reference Library HTTPS host.
- Session counts: 2021–22 = 10, 2023–24 = 36, 2025–26 = 4.

**Interpretation:** Aggregated recorded committee division counts do not imply that the source provides each individual member's vote, nor that the database lost names. A committee roll/record and a final Senate floor-passage vote are separate outcomes. Missing individual name rows may be an accurate *known missingness* representation.

## Public original-source independent check

The original protected source census produced exactly **30 distinct official committee-minutes PDF URLs**, pinned along with the 50 event-level public/aggregate identifiers in `data/evaluation/historical-roster-863-senate-50-public-source-targets.json`. A separate, credential-free reviewed-main job:

1. Accepts **only these 30 enumerated fixed official `www.lrl.mn.gov/archive/minutes/senate/...pdf` URLs**, over HTTPS, with bounded response bodies, no redirects and a two-worker concurrency limit.
2. Downloads original PDF bytes, authenticates the PDF header and SHA-256, and extracts readable official text with the repo's established `pdf-parse` mechanism.
3. Compares each 50-event stored aggregate with the original source's independently parsed tally and distinguishes a **unique printed named roll**, **numeric count without parsed names**, **multiple candidate matches**, and **unmatched/unavailable source**.
4. Persists exact source document hashes, retrieval status and event-level classification into a non-serving report artifact. No raw member names, vote-outcome labels, DB/Neon credentials or forecast vectors are exported.

This is deliberately fail-closed when the original PDF is unavailable, scanned without extractable text, or contains more than one same-tally motion. Numeric match without unique bill/motion anchoring is **not** proof of an exact individual event; 2026 PDF retrieval is **not** 2021–25 source publication time.

The outstanding source-to-database test after original PDF analysis, if a uniquely named roll differs from member records, must remain a separately reviewed original/action identity reconciliation. No automatic raw vote repair is authorized merely from this report.

**Safety:** Leave frozen Quick historical forecast membership cutoff (T−1) and actual official oath-day T membership distinct; do not reopen #718, change votes, serving models or Vercel.
