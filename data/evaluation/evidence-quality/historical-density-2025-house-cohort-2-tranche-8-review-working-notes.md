# Issue #718 — 2025 House cohort-2 tranche-8 semantic review working notes

**NONCANONICAL / outcome-blind.** These notes initiate the separate manual review after
canonical candidate screen #838. No candidate is yet reviewed or applicable solely
because it was nominated by a deterministic textual screen. Do not derive any model
weight or production feature from these context-only public LRL records.

## Immutable candidate source

- Exact canonical `main` at review start: `357b80e3044c44c007e0e12314d0338801d78429`.
- Canonical candidate audit run `37823971961`, candidate artifact **11569574820**.
- ZIP SHA-256 `a1394fc20a1849dc7a793652eadb102beeef494069db11a28b5ababcacd327cb`.
- Candidate content proof `33b0b3a5e6cc2fb048602327ddf8c1871f9b23a8ace41043e973b41ef751b47e`.
- Candidate review-key set SHA-256 `b2fc7027148305840b5ed147f37b8ac849af10e0a9f3ec2c779e22f58262fcd2`.
- Original semantic aggregate run `37789611806`, artifact **11555527900**, ZIP
  `sha256:fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b`,
  content proof `fdbcb6061ad1f8fe79db1525345627f638a450227d68c5e72890d7e82dfc4cb1`.
- Immutable Evidence Quality matrix artifact **11436413885**.
- Ranked targets **176–200**, **25** events, **2026-05-06 through 2026-05-11**,
  exact event-set SHA `107c41146c0359bc186012674f663db64b4f791bb4fc4b7ac96e5d9dc90e3916`.
  Exact preceding rank-151–175 event-set SHA
  `3d994198b510f648867bb0804b25ff201328c6dd0628d901ff33579b43f1378f`.
- **42** novel independently frozen source propositions × **25** events = **1,050**
  eligible pairs; **21** official strictly pre-vote Revisor versions,
  **4** events with no strict-prevote version.
- **202** nominated / **680** not nominated / **168** source-version fail-closed.
  Exactly **17** nominated bill identities, **42** candidate public members and **42**
  candidate semantic groups. **202** unique review keys. Automatic applicable/aligned **0**.
- PR-head run `37823484864` + CI `37823484684` green at head
  `959082abc3a17098409a54f8421d8cb5a37821d9`.
  Post-merge run `37823971961` + CI `37823972046` green at exact merge SHA.
  Independent PR-head and post-merge artifact checks: **18/18 PASS** each.

## Distribution and risk of lexical false positives

- **SF4612**: 42 nominations. Huge 3rd engrossment of state-health, human-services
  and Children/Youth/Families policy, first published 2026-04-30;
  https://www.revisor.mn.gov/bills/94/2026/0/SF/4612/versions/3/
  Comprehensive per-proposition review is required. Newly proposed drop-in child-care
  provider ratios/licensing/supervision can be genuinely relevant to **child safety**,
  but are **not automatically** Scott's abuse-specific safeguards, West's parental
  infant-abuse education, Bierman's **hospital** patient-to-staff ratios, or the
  *Great Start Affordability Act*. Verify the actor, beneficiary, program and precise
  new text (rather than merely carried-forward rules). Healthcare eligibility,
  opioid/payment-withholding and pharmacy changes also require separate claim matching.
- **SF4244**: 40 nominations; 3rd engrossment technical/conforming corrections
  across varied statutes. Generic terms are particularly prone to false nominations;
  do not accept a reference to a prior statute as new substantive policy.
- **SF476**: 32 nominations, 3rd engrossment posted 2026-04-24;
  https://www.revisor.mn.gov/bills/94/2025/0/SF/476/versions/3/
  Substantive aging/disability services, protective services, continuity of care
  following payment withholds; do not import cohort-1 Virnig disability decisions
  (Virnig is not in cohort-2 frozen 42). Test Robbins fraud-oversight and
  Liebling direct-public-program-administration claims against **changed** provisions,
  not keyword matches.
- **SF4476**: 29 nominations, 3rd engrossment posted 2026-05-07;
  https://www.revisor.mn.gov/bills/94/2026/0/SF/4476/versions/3/
  Aging/disability continuity, behavioral health and long-term care regulation,
  with existing credible-allegation-of-fraud payment-withholding language.
  Require exact amended new text for Robbins (oversight) and Scott (childcare-facility
  abuse safeguards). Disability-context programs are not Liebling's replacement
  of private-insurer administration by direct state administration.
- **SF856**: 19 nominations, exact **10th engrossment** posted 2025-05-09;
  https://www.revisor.mn.gov/bills/94/2025/0/SF/856/versions/10/
  Proposes independent statewide Office of the Inspector General, consolidation of
  anti-fraud investigative functions, public audit reports, freeze powers and
  interagency oversight. This is a **strong subject-specific candidate** for
  `robbins_state_fraud_oversight_transparency` (preliminary, NOT adjudicated).
  Rarick's source combines **stricter reporting requirements imposed on state
  agencies** and fraud-prevention tools. An office that publicly reports or requires
  agencies to advertise fraud-tip tools does not automatically fulfill the
  *state-agency fraud incident reporting* component. Keep this combined proposition
  fail-closed unless both components are independently proven.
- **SF3432**: 10 nominations; emergency-vehicle identifying-insignia removal and
  protective-services appropriations are not ambulance medical-assistance
  *no-transport reimbursement*, Baby Box authorization, or remote-work policy.
- **HF4102**: 6 nominations; State Patrol compensation study and volunteer chaplains,
  not PFML or state-employee remote work.
- **HF4195**: 6 nominations; youth-intervention grants, not the named Great Start Act
  or Safe Haven Baby Boxes; inspect child-care-program provisions before decision.

## Targeted fraud match to review precisely

- **HF3682**, target vote **2026-05-07**, exact **2nd engrossment**
  posted **2026-04-22**; version text SHA-256
  `351337d5d9ac24b4854df3fcbb1ec9b936f7e9a754931e7d3a428446b5565bdf`.
  Official text https://www.revisor.mn.gov/bills/94/2026/0/HF/3682/versions/2/
  explicitly amends Minn. Stat. 16B.97 to require a **grantee fraud-risk rating
  system** with corresponding grant-management requirements across executive agencies;
  authorizes money for policy/templates/training. Cohort-2 candidate review keys:
  - `robbins_state_fraud_oversight_transparency|HF3682|2026-05-07|351337d5d9ac24b4854df3fcbb1ec9b936f7e9a754931e7d3a428446b5565bdf`
  - `rarick_state_agency_fraud_reporting|HF3682|2026-05-07|351337d5d9ac24b4854df3fcbb1ec9b936f7e9a754931e7d3a428446b5565bdf`
  Robbins's broad state fraud oversight likely has a direct policy match.
  Rarick requires **fraud reporting by agencies AND prevention tools**. Risk
  ratings address prevention but do not themselves require agencies to report
  suspected fraud incidents. Do not transfer the Robbins result to Rarick.

## Other specific candidate bills for complete review

- HF3131: cancer-related disability parking (2 nominated fraud positions): medical
  certification is not state-program fraud-reporting or fraud-investigation oversight.
- HF3298: underground petroleum storage-tank pipe reimbursement program: a fuel/
  environmental cleanup reimbursement is not Backer's ambulance no-transport payment
  and not a Mound-specific clean-water investment.
- HF3295: broadcasting Open Meetings through social media is not stricter agency
  fraud reporting.
- HF4348: local thermal energy networks classified as public waterworks/improvements
  are not named Mound clean-water funding.
- HF4240: election administration and absentee-voting rules not expanded public AG data
  access, National Guard building resources, or disabled-veteran tax exclusions.
- HF4546: budget forecast adjustments of DHS and DCYF require detailed checking
  before ruling on combined *Great Start* or childcare abuse propositions.
- HF82: athletic trainer licensing scope is not sex-based girls' athletics eligibility.
- SF3637: optometrist-authorized window glazing rules are not infant-abuse education.

## Review deliverables and non-negotiable gates

1. Manually inspect all **202** candidate source propositions and exact official
   strict-pre-vote bill versions, including 42/40/32/29 huge omnibus clusters.
2. Build per-bill **fully reasoned default rationale** and explicit applicable or
   ambiguous override keyed to the **exact reviewKey**. If a new policy's
   scope/actor/timing is doubtful, fail closed; no automatic nominations become
   applicable. Preserve same-day exclusion and avoid target outcomes.
3. Add checked-in cohort-2 tranche-8 reviewed decisions, separate review freezer
   script, regression tests, and dedicated workflow pinned to candidate ZIP/content
   and review-key digest. Rejoin all 202 exact candidate claims to the frozen semantic
   aggregate and carry complete frozen excerpts, URLs, bill SHA and original records
   into the reviewed artifact. No old tranche-7 counts/hashes/IDs.
4. **Both** dedicated reviewed workflow and normal CI green on exact *final PR head*.
   Download/inspect the PR-head artifact and recompute content/key proofs.
5. Refresh `main` and PR head/base; guarded merge with `expected_head_sha`; verify
   `main` exactly the merge SHA.
6. Both workflows green on exact merge SHA; independently inspect canonical artifact.
   Only then post **review** milestone to issue #718.

**Production/model boundary:** no target-vote outcomes, source strictly before vote
and same-day excluded, no cross-bill identity transfers, internal historical
membership unresolved. Every record remains `contextOnly=true`,
`mechanicallyActionable=false`, `modelWeight=0`, `integrationReady=false`.
No production DB access/write, Vercel, features, model fitting/weights, or serving.
