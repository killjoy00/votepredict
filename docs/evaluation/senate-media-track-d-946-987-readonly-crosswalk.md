# Track D #946 / #987 — original public archive bodies vs existing bounded media context

Scope: [#946](https://github.com/killjoy00/votepredict/issues/946) Minnesota Reformer `/briefs/` and [#987](https://github.com/killjoy00/votepredict/issues/987) MPR News `/episode/` historical source-prefix gaps, 2021–2025.

## What this audit now measures

An explicitly bounded **18 archived original HTTP HTML version / 14 distinct original URL** sample is entirely reconstructed from **previously merged independent public original SHA1-index + replayed HTTP body SHA256 receipts**. The protected task does **not** crawl the 2026 web, fetch publishers or use current publisher edits to backdate proof:

| Issue | Archived original body versions | Distinct publisher original URLs | Source inputs |
| --- | ---: | ---: | --- |
| #946, Minnesota Reformer `/briefs/` | **12** | **10** | 9 initial authenticated historic brief captures in [31-URL public original receipt](senate-media-2021-25-exact-public-replay-receipts-20261010.json), plus 3 independently authenticated *different* historical raw body versions from [4-pair brief/dated investigation](senate-media-reformer-four-historic-brief-dated-alias-receipts-20261011.json) |
| #987, MPR News `/episode/` and one `/story/` control | **6** | **4** | 5 authenticated current-sample historical originals over three interview URLs in [six MPR interview receipt](senate-media-mpr-six-interviews-public-reconciliation-20261011.json), plus the original [February 19, 2024 Grant Hauschild `/episode/`](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) already in the 31-URL original receipt |
| **Total** | **18** | **14** | Already pinned source receipts; no additional content or person labels |

Reformer cases are distributed by **publisher-displayed year** across all 2021–25; MPR interview authenticated captures in this exact sample are 2021, 2023 and 2024. This **does not** mean no 2022/2025 senator MPR material existed, only that the selected MPR 2022/2025 exact original URLs lacked independently authenticated historical archived HTML bodies when the input receipts were created.

**Two non-interchangeable dates:** each public original's `capturedUtc` is a genuine *archive observation time of those bytes*, not the publisher's first-public time, original interview/broadcast time, or the day a later-added transcript existed. For example, the 2024 Kunesh October original lacks the selected historical transcript cues that appear in December; this audit treats those two capture bodies **as separate identities**. Likewise the 2023 driver-license Reformer `/briefs/` captured version is NOT automatically the same as the dated `/2023/02/21/` story. None of the four candidate Reformer brief/dated pairs receives a deduplicated historical-article label.

## How the real stored-coverage measurement works

The independent `.github/workflows/senate-media-track-d-946-987-scoped-readonly.yml` runs:
1. An unprivileged reviewed-commit job verifies exact public inputs, known real original SHA witnesses, all 18 selected keys, fixed issue/domain/path and 2021–25 timestamp limits, immutable read-only SQL and adverse case tests. No secret is exposed in this job.
2. Only **after this independent keyless check succeeds**, and only on the first execution of a deliberately marked reviewed `main` commit, the existing `evidence-readonly-sandbox` environment gives the one-off task the existing VotePredict Neon management credentials. It discovers the **existing independently marked default branch**, verifies its selected database and role, executes `REPEATABLE READ READ ONLY`, and explicitly `ROLLBACK`.
3. Exactly **one static parameterized `SELECT`**, grouped on **only those 18 publicly known original article capture IDs** with a 19-row cap, compares the pinned public original URL, exact `id_` archive capture URL and UTC, original indexed archive SHA1, raw HTTP body SHA256, publisher/source family and optional source seed metadata to matching records in **`source_documents` plus `evidence_items` where `contextType=local_trade_news` and `source_kind=wayback_local_trade_news`**.
4. Only safe per-*public-original-ID* counts and statuses can be printed: **exact original stored in this scoped media context**, **only another version/metadata for same original URL**, **conflicting stored source identity**, or **not observed in the bounded context scope**. The database never returns `source_documents.id`, `evidence_items.id`, person, article text, private source URL, raw SHA or private row content to the caller. No JSONL source export is generated. The published aggregate receipt explicitly does **not** certify full media collection, missing real stories, source-first availability, or historical model eligibility.

This specifically uses the repo owner's existing in-scope guarded read-only audit path, **not** the separate `scripts/reconcile-mpr-interviews-private-context.mjs` operator-only utility. That older private utility still forbids operator JSONL exports in public CI. This new flow's source-identity joins happen entirely inside the protected DB and return only aggregates; neither code path publishes private source IDs/rows.

## What this must not change or overclaim

- No collector seed or topical-priority path update (both issues explicitly require separate change approval), no history reprocessing, ingestion, databases writes, schema changes, launch or Vercel operations.
- No quote/speech approval, source-person name inference, Senate membership/vote classification, confidence or model-weight adjustment.
- No invented "missed article" counts. **Not observed in this exact, filtered context query** does not imply absence from other `source_documents` kinds, independent media/article pipelines, or the public record.
- Zero automatically resolved Reformer historic aliases even if later current-site redirects make brief/dated URLs appear equivalent. Exact historical originals from both paths would be needed for an alias finding.
- The current 44-seed local trade-news export is **not a census** of all Minnesota news or Senate statements. These 14 original URL examples are intentionally nonrepresentative.
- The issue checklists are **not entirely complete** after this stage: actual original publisher full-universe year sampling, approved editorial quotation identities and archive audio/transcript completeness remain further research.

The durable receipt and two issue comments must record actual guarded-run results, never infer private coverage status merely from PR merge or no source label in the public manifests.
