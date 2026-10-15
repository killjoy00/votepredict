# #864 - 95 actually-serving Minnesota senators: protected source-to-Neon historical audit

**Scope October 15, 2026:** 2021-2025 Senate historical evidence; read-only project/legislator/member/source coverage. No Neon or Vercel mutations, model changes, backtest promotion, elections forecasts, scheduler, agency contact or source ingestion.

## Proven original population

The independent original Minnesota Legislative Reference Library actual Senate service directory and historical research establish 95 distinct people who served in 2021-25; 339 service-person-years, 92 with selected authentic historic candidate-owned website research excerpts, and 1,285 selected short excerpts. Original official government body SHA256: bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51.

Original selected research [GitHub run 38260920551 / artifact 11752575710](https://github.com/killjoy00/votepredict/actions/runs/38260920551/artifacts/11752575710). Archive digest SHA256 29c0030649fae371fbc4e434156705de3327315102af4afcb1957a20e1bf00b9; independently read complete JSON SHA256 e47a363cf01a03b08d163768629d23b683438f27fab4200fbf5a6202f87e33c9. The committed public metadata-only [95-person manifest](../../data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json) preserves names, actual service years and selected all-cycle excerpt counts.

## Exact protected comparison

The dedicated audited runner uses the existing protected GitHub Actions NEON_API_KEY plus public variable VOTEPREDICT_NEON_PROJECT_ID. It authenticates the existing VotePredict named Neon project and independently marked default branch, selects its existing database and existing compute. The resolved connection URI is used only in private runner memory. One REPEATABLE READ READ ONLY transaction verifies the actual SQL database and role, required table presence and SELECT privileges, and runs three hardcoded, capped SELECTs before an explicit ROLLBACK.

The 95 original people are conservatively reconciled by name/limited public alias against existing legislators and Senate memberships in 2021-22, 2023-24 and 2025-26, across all stored membership IDs for each matched person. Ambiguous/missing unique person IDs are HOLD (not zero). The stored evidence summary includes existing Senate campaign_site_page + issue_position rows, distinct campaign source documents and stored published_at metadata-year categories, plus separate member_primary_article context counts. Historic authenticated original-page leads are extracted from 29 previously authenticated public campaign-ledger JSON files only when a page has direct individual attribution, an original source URL and whole-source HTML SHA256. The private comparison checks exact source URL AND original binary SHA, then URL-only and exact URL not observed; it never equates the aggregate 1,285 selected research excerpts with exact persisted quote matches.

Original publisher HTML SHA mismatch or an exact URL not observed is not proof that a statement did not exist or was never ingested under another URL/source family. A source capture timestamp is an original public-by observation, not verified author-first-published time. A campaign statement about past legislative activity is not an official roll-call vote. Stored member primary articles are not all independently human-validated historical personal statements. Historical model feature/prediction eligibility is not inferred.

The secret-bearing job has no GitHub issue-write privilege. It exports only exactly 95 validated **ordinal, bounded numeric/category results** after rollback, with no DB names, politician-name strings from SQL, source URLs, record IDs, source SHA or excerpts. A separate keyless reporter joins ordinal entries to the public authenticated names and posts the issue table to #864.

## Owner one-shot trigger

After an independently tested review PR merges into main, create this **exact new issue #864 comment** from the GitHub account killjoy00:

[senate-864-95-historical-neon-readonly-20261015-v1]

The [GitHub Actions workflow](../../.github/workflows/senate-864-95-historical-source-neon-readonly.yml) first runs independent keyless CI on exact main SHA, including fresh disposable PostgreSQL migrations and four SELECT-only EXPLAIN plans without ANALYZE, synthetic identity/source checks, full npm check and production dependency audit. Only if all pass does it enter existing GitHub protected environment evidence-readonly-sandbox, honoring any human review approvals. First-attempt, owner identity, issue number, exact comment, main SHA and prior CI success are checked by both Actions and runner. No ordinary PR, fork, schedule, second attempt or unmarked comment can touch the key.

If a protected condition fails, a separate keyless issue comment reports a fixed-safe failure phase, not fabricated counts. Do not rerun a privileged job to bypass the first-attempt gate.

## Acceptance limits

The 95-person historical **database aggregate and authenticated original-page fingerprint comparison** is not a statement-by-statement 1,285 quote certificate or an exhaustive Minnesota candidate/issue/year inventory. The 29 selected ledgers do not each map every excerpt to an independent URL plus original SHA; the uncovered URLs and snippets remain source-reconciliation debt. The authenticated selected historic-senator service denominator is not the stored membership denominator, and the currently stored published_at year is not independently verified original publication or retro forecast as-of evidence.

The owner states Vercel and the selected Neon project share the deployed serving database. This protected audit accepts that owner assertion and independently authenticates Neon project/branch/database identity; it does not retrieve Vercel's secret connection URI to prove a fresh credential equality.

No data writes, backfills, retraining, serving/forecast changes, production deployment, agency contact or scheduler activation. Keep issue #864 open for exact historical quote-by-quote adjudication and uncovered first-party, independently reported, official roll and finance evidence.
