# #864 — Senate 2021–2025 membership rows vs actual legislative-session date boundaries (diagnostic only)

## Verified V5 snapshot

The successful protected [V5 historical count run #38196817626](https://github.com/killjoy00/votepredict/actions/runs/38196817626), [original issue receipt](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6116826026), and its machine-readable, source-linked checkpoint in [source-proof/senate-864-v5-protected-neon-seven-family-baseline.json](./source-proof/senate-864-v5-protected-neon-seven-family-baseline.json) report:

| Calendar year | Distinct stored Senate legislator IDs | Session-membership rows |
|---|---:|---:|
| 2021 | 67 | 67 |
| 2022 | 67 | 67 |
| 2023 | 90 | 198 |
| 2024 | 68 | 134 |
| 2025 | 70 | 136 |

These count different things and are **not** official Senate historical service totals or proofs of duplicates. In particular, the 2023 90-person/198-membership total is not automatically 90 serving senators; it is the result of an existing per-year filter over membership records from the 2021–22, 2023–24 and 2025–26 session slugs. Multiple session rows can refer to one person. The source audit does not independently check every person's election, actual swearing-in date, chamber tenure, departure, or vacancy.

## Separate, bounded read-only test

The protected one-time [workflow](../../.github/workflows/senate-864-roster-session-boundary-diagnostic.yml) runs three *fixed* grouped SELECTs from [source SQL](../../scripts/senate-864-roster-session-diagnostic-sql.ts), reproduced from the prior V5 calendar-year roster filter:

1. Year plus session (no more than 15 rows). Count membership records and distinct legislator IDs before/after explicitly intersecting membership dates, legislative-session dates, and calendar-year dates. Count rows where a session does not intersect the calendar year, missing session date boundaries, and membership dates outside their session date bounds.
2. Five calendar-year aggregate groups: reproduce V5 original membership and person counts plus session-clamped membership/person counts and rows associated with out-of-year sessions.
3. Five aggregated person-year cardinality groups, used internally only: number of people represented by multiple memberships/session slugs, excess session membership rows beyond distinct people, and whether more than one session-clamped row represents the same person. No individual IDs or names leave the SQL transaction.

These three aggregate queries deliberately preserve the **exact V5 Senate/slugs/date filter** for the baseline and additionally introduce a session-date clamp. The session-clamped counts are *diagnostic comparisons*, not authoritative officeholder facts. Session start/end metadata can itself be wrong, absent or less precise than individual term records. A per-person source-authenticated legislative service audit would still be required.

No changes to the actual stored memberships, historic officeholders, prediction data, scores, 2027 handling, training, evidence eligibility or forecasts are permitted here. SQL executes against the **existing VotePredict default Neon branch**, not a newly created project, branch or role, inside one `REPEATABLE READ READ ONLY` transaction with explicit `ROLLBACK`. No direct production database writes, source row exports, person names, districts, or UUIDs. Output is strictly limited to whitelisted numeric aggregates and fixed session/year labels.

## Review and execution gates

On pull requests: same-repo synthetic tests and the exact pinned prior V5 baseline; a disposable Postgres instance with migrations and three `EXPLAIN` **without** `ANALYZE` compilations. The Neon key must not be passed to pull requests.

On main: the unique `SENATE_864_SENATE_ROSTER_SESSION_READONLY_ONESHOT_20261012_V1` marker allows only the first attempt of the exact independently reviewed merge commit to pass pre-secret, full `npm run check`, disposable migrations/`EXPLAIN`, and production dependency audit. The protected environment then provides the existing key to the **single final query step only**. A distinct keyless job performs strict aggregate-only validation before publishing the issue #864 receipt. Failing SQL, old checkpoint drift, read-write connection, missing year group, or unexpected personal field is HOLD, not zero.

## Independently verified protected result

The [first-attempt exact-main run #38203733724](https://github.com/killjoy00/votepredict/actions/runs/38203733724)
succeeded on `0283a8d2e3860055164f0d665578ba73e99437fd` and
published the [sanitized original receipt](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6117769199).
The checked, immutable-source [numeric checkpoint](./source-proof/senate-864-protected-roster-session-boundary-v1-receipt.json)
retains all nine year/session group aggregates and the verified V5 comparison.

| Year | Prior distinct people / session memberships | Session-clamped distinct people / memberships | Membership rows from sessions outside this year |
| --- | ---: | ---: | ---: |
| 2021 | 67 / 67 | 67 / 67 | 0 |
| 2022 | 67 / 67 | 67 / 67 | 0 |
| 2023 | 90 / 198 | 67 / 67 | 131 |
| 2024 | 68 / 134 | 68 / 68 | 66 |
| 2025 | 70 / 136 | 70 / 70 | 66 |

The 2023 original V5 report included **66 records from the 2021–22 session**
and **65 from the 2025–26 session**, both of which do not intersect 2023.
The original V5 person counts are distinct legislators in all matching
membership rows; they were not established as actual serving senators in those
years. The new explicit session clamp explains their cardinality increase.

Many membership effective-start or effective-end dates also cross the boundaries
of their recorded sessions, which is a **separate data-quality or modeling
investigation**, not permission to truncate or rewrite service data.
The session-clamped cohort is not yet independently identity/date-matched to
the official roster or election and departure evidence. No forecast eligibility,
production deployment binding, schema, member rows, training or scoring was
changed. The READ ONLY transaction rolled back successfully. Parent #864 stays open.
