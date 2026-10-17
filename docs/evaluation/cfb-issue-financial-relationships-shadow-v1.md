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


## V2 exact contemporary PAC registration evidence (next protected shadow)

Source verification for PAC attribution is now a separate, testable research
step rather than a name-matching heuristic. The official CFB
[large-contribution-notice index](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/large-contribution-notices/)
publicly prints 70001 (MN Chamber of Commerce Leadership Fd), 30558
(Education Minn PAC), and 30025 (MN AFL-CIO). The
[Minnesota Chamber elections page](https://www.mnchamber.com/your-voice/elections)
explicitly describes its *Leadership Fund PAC* and keeps Pro Jobs Majority
**independent expenditures** separate. The
[Education Minnesota PAC page](https://educationminnesota.org/advocacy/edmnvotes/political-action-committee/)
explicitly identifies its union PAC. The captured AFL-CIO news index alone
does **not** establish an exact analogous legal PAC identity, so 30025
remains held rather than matched by coincidental organization name.

Pinned, explicit registration-name and first-party PAC-phrase requirements
are in `data/evidence/cfb-issue-pac-attestation-candidates-v2.json`.
`src/evidence/cfb-issue-pac-original-attestations-v2.mjs`
re-hashes the *actual* previously stored 0031 original HTML bytes, verifies
approved origin, role, expected source ID and original observed timestamp,
then requires both the exact regulator printed name/registration and
first-party identification of a PAC. It yields **current-only** candidate
affiliation records no earlier than the later of both source observation
dates. No affiliation can be materialized for a replay cutoff on or before
the date those bytes were observed, even if the webpage carries a 2020 or
2023 publisher dateline. Any invalid hash, contradicting source version or
missing original PAC statement fails closed.

A ninth original source is pinned: the
[Education Minnesota February 25, 2026 press release on HF 2904](https://educationminnesota.org/news/press-release/educators-call-on-legislature-to-create-statewide-health-insurance-pool-for-school-employees/).
A deterministic neutral parser captures a literal **HF 2904** bill mention
with its original source hash and observed date; it does not infer a
legislative vote, direction, or historically pre-vote published position.
It also excludes retrospective publisher scorecard indexes from neutral
issue-publication discovery, preventing post-vote records being treated as
timely forecasts.

After each protected original-source capture (including weekly Mondays),
the workflow runs
`scripts/audit-cfb-pac-original-attestations-readonly.mjs` strictly within
the *existing* Neon database under `REPEATABLE READ READ ONLY` and explicit
`ROLLBACK`. It logs only aggregate counts of contemporary source-matched
PACs, unresolved PAC identities, historical contribution rows involving
currently identified entities, and neutral publisher bill mentions.
The last metric is not a pre-vote signal; historical money rows do not become
eligible merely because a current PAC identity was verified.

This stage intentionally requires **no new migration**, makes **no writes
to the v1 0031 source observations outside the existing append-only
collector**, and leaves issue-specific financial features unavailable for
retrospective replay pending independent old disclosure/organization
position proofs. Predictive validation remains a separate prospective
read-only shadow experiment.


## V3 bounded prospective first-party release discovery (2026-10-17)

The nine original captures proved a working append-only collector, but a weekly
refetch of fixed pages alone cannot discover new issue-specific publication URLs
before future Senate votes. V3 adds one pinned first-party index:

- Education Minnesota's [media-resources news release archive](https://educationminnesota.org/news/media-resources/) is captured as a RAW
  `first_party_historical_context` source under the existing 0031 ledger.
- Only links literally present as anchor hrefs in the freshly captured and
  SHA-reverified original HTML may be discovered. The allowed article origin
  is exactly `educationminnesota.org`; the path must match a publisher
  `/news/press-release/<article-slug>/` URL. Off-host, scheme-changing, search
  query, fragment, encoded path, script and comment links are rejected.
- At most **8 article URLs per run** are followed. Each one is subject to
  the same independent robots policy, serial polite rate limit, strict HTTPS
  redirect/content checks and raw UTF-8 byte+SHA snapshot process as the
  original pinned sources. Stable URL-derived IDs and the existing
  `(source_id,html_sha256)` unique constraint retain changed versions
  without duplicating unchanged originals.
- The reviewed-main protected workflow now runs **weekdays at 14:19 UTC**,
  with the existing manual recovery entry point and protected CI checks.
  Discovery configuration, implementation and safety tests are keyless checked
  before the existing credential-bearing source capture.
- A missing or unavailable archive page yields no discovered URLs and an
  aggregate status, not a claim that no publisher positions were made.
  Safe report fields count pinned/index/discovered attempts and captures;
  source text, URLs, contributor details and individual matches are never logged.

**Most important limitation:** discovery is raw archiving, **not** a
publisher position classifier. A captured article's original website dateline
is not authenticated as that page's earliest public date. This collector only
proves that the exact captured HTML bytes were seen by our collector on their
`observed_at` timestamp. No 2021-26 retrospective vote features are opened.
Captured article URLs must still be independently mapped to an exact Senate
bill, an unambiguous original pre-vote support/oppose statement, and verified
financial disclosure. Publisher summary scorecards and post-vote releases
remain ineligible for past-vote forecast replay. No serving model, materialized
as-of eligibility, transaction row evidence or forecast is touched.

The archive is not a complete enumeration of every future release: only the
first eight eligible URLs in its publisher-provided link order are observed
on a run. Count gaps and any robot/HTTP failures before asserting coverage.

One additional pinned issue-source page was independently located at the publisher:
[Education Minnesota, March 18 2026 health care cost crisis](https://educationminnesota.org/news/press-release/educators-demand-action-on-the-health-care-cost-crisis/).
Its text literally names **S.F. 2909 / H.F. 2904**; the neutral bill parser now
recognizes such dotted abbreviations. The source's 2026 dateline is not a
historical archive capture and cannot be used to backdate its observed bytes,
or certify a pre-vote stance. All captured original positions remain unverified
as to source-qualified pre-vote admissibility.
