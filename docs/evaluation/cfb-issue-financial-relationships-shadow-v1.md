# #864 — issue-specific financial relationships (source-first shadow v1)

Status: **research only; source-level feasibility being measured**. Does not alter Quick/Deep, evidence eligibility, finance PDFs, historical replay weights, or forecasts.

## Research question

Do **disclosed, source-verified financial relationships with organizations that have an explicitly published position on a particular bill** add information about a Minnesota senator's subsequent YEA/NAY vote *after* controlling for the senator's existing base forecast, caucus and voting history?

This is an association hypothesis, not evidence that a donor caused or purchased a vote. Avoid value judgments or personal trait inferences.

## Three independent identity/provenance edges

1. **Registered finance entity -> legislator campaign committee.** Original canonical Minnesota CFB candidate contribution row, committee registration, contributor registration number, member identity, transaction date, amount and exact row key. Reused from the canonical bulk source. **Never** treat employer names or individual donors as the donor's affiliated political organization.
2. **Registered finance entity -> issuer organization.** Require both an official CFB registration record and a first-party organization statement establishing the specific PAC/fund's relationship. Preserve both full source URLs, SHA-256 hashes and *independently proven available-by dates*. The date the association began is independently represented; do not project a 2026 PAC affiliation backward into 2021.
3. **Issuer organization -> exact bill-specific published position.** Use `senate_scorecard_vote_positions`, resolved `bill_id`, full literal group position, source snapshot URL/SHA and verified publication/archived observation date. Recognize only an unambiguous direct *support*/*oppose* of the **whole bill**, not a vote on an amendment, procedural motion, a generic group ideology, post-hoc candidate grade, or author interpretation.

A qualified derived relationship exists only when **all three edges** are independently supported. Conflicting publisher positions or multiple legal-entity affiliations fail closed.

## Clock separation

- **Strict public-as-of:** the original contributed row is independently proved publicly available *strictly before* the vote/forecast date; the organization affiliation and exact position have independently supported published/observed-by dates strictly earlier than the same cutoff. Publication, report availability and row containment are separate claims.
- **Retrospective activity shadow:** the contribution may be known from a later filing if its underlying transaction occurred before the vote. It must be labeled retrospective and **can never claim historical model availability**. Crucially, the organization's exact bill position still requires an original pre-vote publisher observation, to avoid using a later scorecard's outcome-aware labeling as a predictive input.
- **Never** promote v2 PDF *candidate spans*, filing deadlines, transaction dates, estimated publication dates, or a report's historical period to exact row-public-by proof.

## Predeclared, null-aware feature family

When the joins are valid, compute independently for organizations with public **support** and **opposition** positions for the exact bill:

- Number of distinct source-verified registered financial organizations contributing to the member's committee;
- Number of qualifying contribution transactions; and
- `log1p` total qualifying contribution dollars (positive amounts only).

Do **not** call the difference between these quantities a vote stance. Return **null, not zero**, when no qualified relationship can be established. Return companion diagnostics describing coverage and excluded rows, not raw donor information. The prototype intentionally excludes independent expenditures and campaign expenditures from these incoming-contribution signals; IE `for`/`against` candidate behavior must be evaluated in its own feature family.

## Source-backed affiliation leads to verify, not historical feature inputs

The current official Minnesota CFB large-contribution notices list, among other entities, *MN Chamber of Commerce Leadership Fd* (registration **70001**), *Education Minn PAC* (**30558**) and *MN AFL-CIO* (**30025**).

- [Official CFB large-contribution notices](https://register.cfb.state.mn.us/reports-and-data/viewers/campaign-finance/large-contribution-notices/).
- [Minnesota Chamber first-party elections page](https://www.mnchamber.com/your-voice/elections): the Chamber describes its Leadership Fund PAC and separately identifies an affiliated independent-expenditure committee. These are **different types of financial activity**.
- [Education Minnesota first-party PAC page](https://educationminnesota.org/advocacy/edmnvotes/political-action-committee/): the union describes its PAC's own political and election operations.

These are **research leads only** until full source bodies, hashes, exact legal committee identity and observation timestamps have been separately acquired and verified. Current webpages establish no historical pre-2026 as-of relationship; a PAC's employer or organizational name does not certify its issue-specific position.

For later, broader taxonomy research, the CFB now publishes organization lobbying categories and specific subjects (see [CFB lobbying viewer](https://register.cfb.mn.gov/)). These categories are **topics of lobbying**, not proof an organization supported or opposed any specific bill. The Board's 2024 program introduced specific lobbying subjects; never fabricate them for earlier years.

## Data audit and acceptance gates

Protected `.github/workflows/senate-864-cfb-issue-financial-feasibility.yml` operates only against existing canonical finance evidence and publisher source tables, in `REPEATABLE READ READ ONLY` with explicit `ROLLBACK`. It emits only bounded aggregate counts: how many candidate contributions have stable registered donor IDs, how many independent spending rows have spender registration, how many explicit resolved whole-bill publisher positions exist, and how many *unverified name-match leads* deserve original source verification. **Name-match leads never authorize a derived feature.**

Before treating this feature as predictive:

1. Source-verify the priority legal-entity crosswalks and original publisher-position timestamps; measure the actual count of *non-null*, source-qualified member/bill/cutoff observations.
2. Freeze issue-specific membership rules, cutoffs, version, missingness treatment and baseline comparison **before** evaluating vote outcomes.
3. Compare against member/caucus/history-only baseline with separate House/Senate and uncertain-vote cohorts. Prefer prospective real forecasts and outcomes; retrospective gains on repeatedly inspected 2021-26 voting outcomes are hypothesis generation only.
4. Require better Brier/log loss and chamber passage guardrails on held-out/prospective data. If coverage is too sparse, report that failure and do not promote.
5. Keep all financial relationships neutral context with **zero serving weight** unless the separate prospective evaluation protocol explicitly authorizes promotion.

Prototype: `src/evidence/cfb-issue-financial-relationships-shadow.mjs`. Unit tests: `tests/cfb-issue-financial-relationships-shadow.test.mjs`. Source feasibility: `scripts/audit-cfb-issue-financial-feasibility-readonly.mjs`.

## V1 prospective original-source capture (2026-10-16)

The first protected feasibility audit had 4,194 Senate candidate-contribution
rows with registered donor IDs and 472 distinct registrations. The three
publicly observed current PAC registration leads appeared on 133 rows.
The scorecards have 62 explicit whole-bill positions on 46 bills **but zero
stored publication dates**. Thus no historically qualifying financial
relationship feature was demonstrated.

This follow-up adds a separate **raw source observation** lane, not historical
publication-date repairs. See:
- data/evidence/cfb-issue-finance-source-observation-manifest-v1.json
- src/evidence/cfb-issue-source-observation-v1.mjs
- migrations/0031_cfb_issue_finance_source_observations.sql
- .github/workflows/senate-864-cfb-issue-source-capture.yml

The pinned eight public official/first-party HTML sources cover the current CFB
committee list, the Chamber Leadership Fund PAC, a 2020 dated Chamber publisher
page, a retrospective Chamber scorecard index, the Education Minnesota PAC,
the AFL-CIO publisher news directory and 2023/2026 legislative priorities.
Fetching is HTTPS-allowlisted, robots-aware, serial, content-length-capped
and rate-limited. Independent disposable Postgres and CI checks precede
protected main-only source capture, once on merge and then **weekly on Monday
at 14:19 UTC**. A guarded manual recovery action is available.

The separate appendix-only table holds original HTML bytes, SHA-256,
source URL, final URL, source role and *observed_at* timestamp. Repeated
identical bytes preserve their earliest observed timestamp. New rows are
enforced at DB level as unverified_raw_observation, historically ineligible,
non-mechanical and zero-weight. Source datelines, archived publication
claims, 2020 or 2023 historical contexts, and 2025/2026 post-vote
scorecards can NEVER be silently reinterpreted as pre-vote observations.
No source/evidence/position/forecast table is updated by this collector.

### Public original organization research leads

- https://www.mnchamber.com/blog/chamber-political-programs-find-success
  has a publisher date November 9, 2020 and describes Leadership Fund PAC
  separately from Pro Jobs Majority independent expenditures. A current HTML
  fetch does not verify that today's identical bytes existed in 2020.
- https://mnaflcio.org/news/2023-legislative-priorities
  has an original-publisher date January 20, 2023, preceding some later votes.
  It names policy priorities but NOT an exact bill number.
- https://mnaflcio.org/news/2026-legislative-priorities
  is contemporary policy context, not proof a group supported any particular
  bill or the fact that a financial PAC represented the organization.
- https://www.mnchamber.com/2025-2026-legislative-voting-record
  is retrospective voting evaluation, not a historical pre-vote position.

The contemporary CFB registrations 70001 (Chamber Leadership Fund),
30558 (Education Minnesota PAC) and 30025 (MN AFL-CIO) remain **research
leads**, not a verified historical PAC ↔ publisher crosswalk. A future
separate original source-supported identity review must prove legal entity
and relationship temporal validity before feeding the v1 finance shadow.

Prospective feature use requires genuine original exact-bill publications
observed before 2027-28 votes, an independently verified financial entity
affiliation, transaction row-specific public-by proof, and held-out/prospective
scoring. No historical 2021-26 replay or serving forecast was changed.
