# #864 — observed 2025 Senate membership alias and actual existing-Neon source audit

The first **successfully executed, protected, existing-Neon-default-branch READ ONLY** source reconciliation ran October 10, 2026, after #947 merged to main. [GitHub Actions run #38089505309](https://github.com/killjoy00/votepredict/actions/runs/38089505309) verified the existing VotePredict Neon API project, default branch, SQL database/role identity, began repeatable-read **READ ONLY**, fetched bounded three-district 2025–26 records and explicitly **ROLLED BACK**. Result artifact \`senate-2025-campaign-issue-neon-readonly-v1\` / ID \`11683477900\` is restricted to the repo's authorized readers; private database membership UUIDs and source row IDs are **not copied into the source tree**.

## What was actually observed (not simulated)

The target three districts (6, 29, 45) have **five** 2025–26 Senate membership records in this Neon branch: three winning candidates under their terms plus two previous incumbents whose terms ended earlier. The campaign issue evidence filter returned **10** existing source/evidence rows, attributed to:
- **Keri Heintzeman / SD6:** two existing campaign-site issue rows. Two excerpt span overlaps with the newly verified old campaign page.
- **Michael Holmstrom Jr / SD29:** seven existing campaign-site issue rows. One excerpt span overlap.
- **Ann Johnson Stewart / SD45:** one existing campaign-site issue row. No excerpt span overlap.
- **Prior SD29 and SD6 incumbents:** zero matching bounded campaign-site issue rows.

The first identity parser uniquely matched two of the three elected candidates, despite the third being in the returned roster. The remaining difference is precise, not speculative: the existing database senator display name is **"Ann M Johnson Stewart"**, while the 2024 SD45 SOS election and original campaign page list **"Ann Johnson Stewart"**. New alias logic maps only **that exact expanded member name**, in **2025–26 Senate district 45**, to the official winner's name. It does NOT allow arbitrary fuzzy token matches, other middle initials, district reassignment, 2020 campaigning, opponent inheritance or premature source evidence insertion.

**Important source gap:** Across all **10** stored campaign issue rows, **zero existing source-document SHA-256 values match the four exact newly authenticated archived HTML bodies**. Three **excerpt text overlaps** are not same-source-page proofs. Several existing evidence published timestamps are later than the relevant 2025 election; they are NOT automatically historically eligible even though the same policy text appears in separate previously archived pages.

The runner used an existing Neon default branch, **not independently proven to equal the live deployed production DB**. That existing SQL role may have write grants but the audited transaction was READ ONLY and rolled back. No model, frozen evaluation or source/evidence table changes occurred. This PR uses the already downloaded, authenticated private metadata to reconcile the name alias **offline**; no additional DB query is required to reason about the rename.

## Remaining #864 acceptance

The 13 previously authenticated candidate-owned policy excerpts include 10 from three winners and 3 from the losing opponent Louis McNutt. No source row is inserted into production or accepted as a forecast feature merely because source text overlaps or a senator was elected later. Owner-controlled as-of source evidence and exact original archive hashes, all senators/campaign domains, historic 2020/22 filed website exports and any independent live production binding remain incomplete.

[Historical completeness issue #864](https://github.com/killjoy00/votepredict/issues/864) stays OPEN.
