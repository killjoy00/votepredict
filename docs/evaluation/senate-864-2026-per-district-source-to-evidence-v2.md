# #864: 2026 Minnesota Senate incumbent election: individual stored source evidence read-only audit V2

**October 13, 2026.** Current election candidate population: **49 incumbent 2026 November Senate nominees** matched against official 2026 SOS filing/primary reconciliation from the existing [49-person public-source manifest](../../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json). Do not extend these statuses to other challengers or open-seat candidates.

## Proven V1 first private-source baseline

The previous [exact owner-gated, read-only, ROLLBACK-confirmed V1 comparison](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6140101805) on [GitHub Actions run 38359282711](https://github.com/killjoy00/votepredict/actions/runs/38359282711) against the independently selected **existing VotePredict Neon default-branch database** found:

- **25/49** chosen current research source URLs exactly matching a stored source URL **with at least one evidence row linked to an active Senate district/surname-matched membership**.
- **0/49** URL spelling-only matches.
- **0/49** chosen URLs present but without any named incumbent evidence row.
- **23/49** selected current URL spellings not observed in this bounded lookup. **This is NOT proof those candidates have no stored evidence or other source URLs.**
- **1/49** incumbent identity was **HOLD** under the limited active Senate membership/district/surname join. V1 intentionally did not report this person's name or the nature of the hold.
- The **4** source-independently verified live 2026 Duckworth original publisher pages matched stored source URLs **1/4**, linked current-Duckworth membership evidence **1/4**, exact short selected cue in stored excerpt **1/4**, **exact whole October 13 live original HTML SHA vs stored source SHA 0/4**. Distinct stored source transform or mutable publisher HTML could cause a byte mismatch; not evidence the original statement was absent.

These are in-scope *original selected source URL* intersections, NOT an exhaustive candidate-wide database evidence-count or 2026 published policy coverage.

The underlying public original publisher HTML bodies for all four Duckworth pages were independently fully GET/read and SHA-256 fingerprinted in [public run 38358491766](https://github.com/killjoy00/votepredict/actions/runs/38358491766), with exact source URLs, source byte sizes and whole-page SHA fingerprints pinned in [four-source source-proof ledger](../../data/evaluation/senate-864-2026-duckworth-four-live-publisher-original-sha-receipts-v1.json). These are **live Oct13** observations, not unmodified Jan/Mar/May original historical snapshots nor exact first-authored publication times.

## Why V2 and its outputs are different

The V1 protected job **already received the 49 individual public district statuses**, but its keyless issue reporter published only grouped counts; therefore it was not possible to responsibly name the 23 unobserved or the one identity hold from that receipt. Do **not guess from GitHub code search** (22/27) or a candidate suffix.

V2 adds one new independently reviewed, **static SELECT** inside the **same single READ ONLY REPEATABLE READ protected snapshot**:

1. Original bounded 49-district current 2025–26 Senate memberships, verifying start/end active at October 13 and names by district.
2. Existing source URL/evidence join for exactly **49** selected current public source URLs + **4** original Duckworth 2026 dated speaker-specific URLs, including source text contextType/sourceSubtype and stored published_at date metadata. Only fixed URL spelling aliases are permitted.
3. A strict at-most-210-current-membership **aggregate** COUNT SELECT of `issue_position` + `campaign_site_page` evidence rows, unique campaign source documents, `published_at` 2026/earlier/undated breakdown, plus all-source issue_position rows with stored 2026 metadata.

No new data are requested for other parties, open-seat candidates, historical finance donors, entire 2021–2025 serving membership inventory, legislative votes, media article bodies or private source-document full content.

### V2 individual status columns

A **keyless** reporter validates the numeric/boolean/enum-only protected result and joins its **public district identifiers** to the independently audited *public* 49 names **after** the protected transaction has rolled back. It reports one row for each:
- current public district/person name;
- selected source URL status: exact matched URL with current-senator-linked evidence, an equivalent URL spelling, URL present but not personally linked, URL spellings not observed, or current-membership **HOLD**;
- whether the existing evidence item for that source is specifically classified as an `issue_position` for the current senator and whether any stored source-specific item bears 2026 published_at metadata;
- current 2025–26 Senate membership stored campaign_site_page / issue_position item count, distinct source-document count, items tagged 2026, and all issue_position family items tagged 2026, all bounded numeric counts;
- if current membership cannot be independently matched: an explicit *fixed* reason class and **null** evidence count, never a misleading zero.

The existing corpus may include old incumbent evidence under **previous 2021–22 or 2023–24 membership IDs**. Current-term stored counts must not be presented as lifetime totals. An evidence item classified as `issue_position` and linked to a senator is an **existing database attribution**, not independent human verification of their actual stance. The `ei.published_at` calendar year is **stored source metadata, not independently proven page first-publication or model as-of eligibility**.

One conservative identity improvement removes suffix tokens (Jr/Sr/II/III) only **inside the V2 comparison**, still requiring the current district and surname. This may resolve a V1 formatting hold but must not be interpreted as independent government document proof; multiple or conflicting matching current membership rows are separately held.

## Execution and scope controls

- [Comparator](../../src/evidence/senate-864-2026-incumbent-source-parity.mjs) keeps its 49/716 historical authentic-source baseline, URL/source-binary boundaries and four Duckworth original-body SHA proof; V2 compares the additional aggregate rows entirely in private runner RAM. Its exported output is public district identifiers, bounded count integers/null, booleans and fixed status enums only.
- [Protected query V2](../../scripts/audit-senate-864-2026-49-incumbent-existing-neon-parity-v2.mjs) never writes to Neon, only connects to the existing verified VotePredict default-branch database under `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, checks SQL actual read-only role/DB identity, runs three SELECTs under strict row/statement-timeout caps, explicitly issues `ROLLBACK`, and prohibits private rows/URL/hash/credentials/names in any output.
- [Keyless reporter](../../scripts/render-senate-864-2026-49-incumbent-parity-v2-issue.mjs) is a separately testable independent safe-shape validator and report renderer. The keyless job has GitHub `issues: write` but **no Neon key/environment**; the protected job has Neon key/environment but **no issue write** and uploads no artifact or raw rows.
- [Workflow](../../.github/workflows/senate-864-2026-49-incumbent-existing-neon-parity-v2.yml) authorizes a protected run **only** on a single newly created issue #864 comment made by GitHub owner `killjoy00` with exact text:
  `[campaign-864-2026-49-incumbents-detail-readonly-20261013-v2]`
- Before any protected environment access, the exact main commit must pass a fresh independently executed **clean disposable localhost PostgreSQL migrations**, [all three fixed SELECTs EXPLAIN without ANALYZE](../../scripts/verify-senate-864-2026-incumbent-sql-local-v2.mjs), full `npm run check` and `npm audit --omit=dev --audit-level=high`. Ordinary PRs only run no-key offline tests/local disposable Postgres and public Duckworth source GET checks. No workflow_dispatch or schedule and no privileged reruns; protected GitHub environment reviewers, if configured, are never bypassed.
- Any Neon API/connection/SQL/validation failure, missing active membership, missing source and source hash mismatch is a **HOLD / bounded source observation**, never an assertion that the senator held no public position or no database item exists.

## Remaining limits even after a successful V2 receipt

1. Independent proof that queried Neon database equals the deployed VotePredict app's **actual** serving database, and that the selected source bytes match the originally published body at their claimed 2026 dates.
2. Direct full 49-person exact publisher HTML SHA and quote/speaker authentication (currently only the **four Duckworth sources** have independently original-publisher byte SHA from the Oct13 public probe); selected 49 current URL bodies and versions remain mostly unverified.
3. Earlier 2021–22/2023–24 stored membership campaign evidence, missing challenger and open-seat candidate coverage, complete 2026 policy platform statements and independently reviewed issue positions.

No new source records admitted to production, no backfill, model training, election predictions, scheduler or 2027 scope changes, no humans/emails/government contacts. Keep parent issue #864 open and do not declare full statewide/current 2026 candidate evidence complete.
