# #864 — Direct 2026 Senate policy statements: 13 original publisher verifications and exact-store integration

**Review evidence status: October 14, 2026 (UTC).** This is a first-party source-verification and narrowly scoped evidence-integration record. It is not a verified March–May original-publication ledger, not a claim of 13 new database rows, and not a historical 2021–2025 capture.

## Precise population and date choice

- **13 original publisher pages** had complete live original HTML downloaded, a SHA-256 pinned, an exact personally attributed visible passage matched and the publisher's displayed day located on October 14. Source QA: [run 38501897295](https://github.com/killjoy00/votepredict/actions/runs/38501897295) and [run 38502764093](https://github.com/killjoy00/votepredict/actions/runs/38502764093).
- Each claim's **first independently evidenced public-by is its successful October 14 UTC GET timestamp**. The earlier article date is retained only in metadata. A forecast cutoff before the successful original GET is **not allowed** to see the claim. This is conservative: it makes no assertion that an article first appeared on October 14.
- Exactly **15 DFL source URLs that returned HTTP 403** are intentionally excluded rather than assumed false; **SD22 Rich Draheim's accessible page with no matching selected literal quote** is also held. **SD37 Warren Limmer, SD49 Steve Cwodzinski and SD52 Jim Carlson** have no accepted new personally quoted claim in this source cohort and receive no imputed position.
- The 13 new eligible source observations cover **13 distinct sitting senators**, with three exact whole-bill association candidates (SF3602, SF5032, SF5101). A senator's own description of a vote is **not an independently certified named official roll call**. Other scope-only references, particularly Dahms' **failed SF4188 reinsurance amendment** and Nelson's **Carter's Law section in SF4760**, do **not** create a whole-bill direction or linked bill stance.

## Pinned sources and independent public-by

| Senator | Publisher's displayed day (not availability) | Independently observed original public by (UTC) | Bounded bill linkage | Source |
| --- | --- | --- | --- | --- |
| SD1 Mark T. Johnson | 2026-03-02 | 2026-10-14T02:36:23.699Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/senate-republicans-propose-tax-relief-that-makes-a-difference/) |
| SD2 Steve Green | 2026-05-01 | 2026-10-14T02:36:24.641Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/an-update-before-we-hit-the-end-of-session/) |
| SD5 Paul J. Utke | 2026-05-06 | 2026-10-14T02:46:26.384Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/the-health-of-healthcare-in-minnesota/) |
| SD11 Jason Rarick | 2026-05-27 | 2026-10-14T02:36:25.981Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/a-productive-end-to-a-short-session/) |
| SD13 Jeff R. Howe | 2026-02-23 | 2026-10-14T02:46:26.410Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/howe-continues-effort-to-update-window-tinting-laws-improving-accessibility-for-those-with-permanent-prescriptions/) |
| SD15 Gary H. Dahms | 2026-05-01 | 2026-10-14T02:46:26.411Z | SF4188 (failed amendment) | [Original](https://www.mnsenaterepublicans.com/senator-dahms-fights-to-keep-health-care-affordable-for-minnesotans/) |
| SD20 Steve Drazkowski | 2026-04-23 | 2026-10-14T02:46:26.412Z | SF5032 (whole proposal) | [Original](https://www.mnsenaterepublicans.com/senate-taxes-committee-approves-sen-drazkowskis-take-it-back-act-to-recover-stolen-fraud-money/) |
| SD21 Bill Weber | 2026-04-17 | 2026-10-14T02:46:26.412Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/weber-living-in-minnesota-is-taxing/) |
| SD24 Carla J. Nelson | 2026-04-21 | 2026-10-14T02:46:26.414Z | SF4760 (section only) | [Original](https://www.mnsenaterepublicans.com/sen-nelson-celebrates-senate-passage-of-carters-law/) |
| SD26 Jeremy R. Miller | 2026-04-23 | 2026-10-14T02:46:26.415Z | SF5101 (whole proposal) | [Original](https://www.mnsenaterepublicans.com/miller-presents-bill-to-help-minnesota-compete-for-major-sports-events/) |
| SD31 Calvin K. Bahr | 2026-03-24 | 2026-10-14T02:36:26.456Z | SF3602 (self reported vote) | [Original](https://www.mnsenaterepublicans.com/capitol-update-march-24-2026/) |
| SD32 Michael E. Kreun | 2026-05-11 | 2026-10-14T02:36:26.901Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/senate-sends-bill-to-establish-office-of-inspector-general-to-governor/) |
| SD54 Eric R. Pratt | 2026-03-10 | 2026-10-14T02:46:26.419Z | policy only (policy only) | [Original](https://www.mnsenaterepublicans.com/pratt-supports-commonsense-measures-to-make-life-affordable-for-minnesota-families/) |

Machine-readable exact quote, personal cue, raw HTML SHA-256, byte length, stance wording, scope qualification and blocked-page exclusions are in [the verified 13-record integration ledger](../../data/evidence/senate-864-2026-verified-direct-positions-v1.json). Earlier broader research remains separate: [67-sitting-person source coverage](senate-864-2026-current-67-sitting-direct-position-coverage-and-specific-remarks.md).

## Actual VotePredict evidence reconciliation implementation

[Deterministic validator and planner](../../src/evidence/senate-864-2026-verified-positions.mjs) pins the 13 source receipts against the original research and rejects all excluded originals. [Production-store reconciliation script](../../scripts/reconcile-senate-864-2026-verified-positions.mjs) reads only the 13 known URL families/allowed harmless URL spelling aliases, 13 current Senate district memberships, and three precise whole-bill IDs. No discovery or 15 previously blocked-page refetch is performed.

The script performs a single **READ ONLY REPEATABLE READ** transaction with explicit **ROLLBACK** by default. It distinguishes:

1. A new verified person quote requiring insertion;
2. A prior exact person-attributed statement already in the evidence store — **skip**, not a duplicate;
3. An exact same-whole-HTML-SHA prior statement carrying an unjustified earlier date — preserve its old value in provenance metadata and **repair only its published-at availability to the verified October 14 timestamp**;
4. A genuinely independently authenticated earlier public version — **keep its earlier verified availability**;
5. A conflicting senator attribution, missing/ambiguous membership or bill ID, multiple preexisting quote rows, or earlier quote on a **different source version** — **HOLD**, never guess or override.

An article's plain context excerpt does not count as an existing directly attributed policy position. New reviewed evidence uses `evidence_kind=direct_statement`, its **actual successful original-observation instant** for `published_at`, `source_kind=member_primary_article`, pinned exact raw-original SHA-256, the current 2025–26 senator membership, its exact bounded stance and scope, and **`contextOnly=true`, `mechanicallyActionable=false`, `modelWeight=0`**. It is available for provenance and dossier review after the cutoff but does **not** automatically revise a probability, train an election model, rewrite a previous forecast, or generate a synthetic recorded vote.

### Running the reconciliation in a trusted VotePredict environment

The repository CI runs the [offline regression suite](../../tests/senate-864-2026-verified-direct-positions.test.mjs); this is **not** a production DB check. The existing local credentials described below must be held privately by an authorized VotePredict operator; they must never be copied into the repo, issue, chat, or GitHub artifact.

```bash
npm ci --no-fund --no-audit
npm run check
export VOTEPREDICT_PRODUCTION_ENV_FILE=/absolute/private/path/votepredict-production.env
node --import tsx scripts/reconcile-senate-864-2026-verified-positions.mjs --dry-run
```

Inspect the output: all 13 public districts must appear, with separate exact-source **INSERT**, **EXISTING**, **REPAIR** or **HOLD** dispositions. Do not interpret prospective inserts as completed rows. If the run was checked and explicitly authorized against the correct production app database, the same immutable commit can be applied using an independently verified successful CI check:

```bash
export VOTEPREDICT_864_13_MANUAL_OPERATOR_APPROVAL='[senate-864-2026-verified-13-apply-v1-20261014]'
export VOTEPREDICT_864_13_INDEPENDENT_CI=true
export VOTEPREDICT_864_13_REVIEWED_COMMIT_SHA="$(git rev-parse HEAD)"
node --import tsx scripts/reconcile-senate-864-2026-verified-positions.mjs --apply
node --import tsx scripts/reconcile-senate-864-2026-verified-positions.mjs --dry-run
```

The script refuses `--apply` without one of the explicit owner/reviewed-commit authorization gates, and internally checks that a trusted manual operator's reviewed SHA exactly matches the checked-out commit. An apply executes **one transaction**, serializes concurrent imports, inserts no quoted article bodies, and makes no changes for HOLD cases. A final read-only pass should show each integrated statement as matched (or a separately reported HOLD). **Do not report integration complete until actual store results and the serving database identity have been verified.**

## Current execution boundary

As of this documentation update, the original publisher fetches and offline integration tests were completed, but **no direct connection or result from VotePredict's live evidence database was available to this coding session**. The 13 source observations are fully prepared for reconciliation; the number of new/reused/repaired stored rows is **unknown until the protected run actually executes**. The 15 blocked sources and three senator no-quote cases are intentionally out of this work.
