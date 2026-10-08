# Cohort-2 tranche-6 semantic review working notes (NONCANONICAL)

Issue: #718. This is an outcome-blind, pre-review handoff, **not** a completed
semantic decision manifest and **not** evidence for a model or production feature.
Do not use a default `not_applicable` decision for all candidates until the
complete exact-source review has been frozen and validated.

## Frozen source pins

- Canonical candidate audit: run `37810812989`, artifact `11564384052`.
- Archive SHA-256: `5229e7cea919d127de0ded4e229d60ec7dcd6f3e0daa45f9c81758a4ac0cf3cf`.
- Audit content proof: `cd51b25e85453493374074c94d16b6c89c7f9aad8aa62221016b701f81ff41e1`.
- Candidate review-key proof: `a4b50b76692e36d6e8e15af11eeb832ae7d8329b819220a008670be21fb412b2`.
- Target ranks 126–150, 25 events, target SHA `eafb3980bdbe20a94da1150e673e8d9218753bcea7f696863fc598f9b4abc072`.
- 1,050 eligible pairs: 148 candidates, 818 not nominated, 84 source-version fail-closed.
- 16 candidate bills, 37 public members, 37 semantic groups; 23 verified versions, 2 no strict pre-vote version.
- Upstream semantic aggregate: artifact `11555527900`, SHA-256 `fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b`.

## Source-verified potential applicable pairs — require final adjudication

All three below use official strict-prevote **HF3426 first engrossment posted April 20, 2026**
for a target vote April 30, 2026; version text SHA-256
`ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd`.
Version: https://www.revisor.mn.gov/bills/94/2026/0/HF/3426/versions/1/

1. `harder_conservation_programs|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd`.
   Source: Harder, "I’m proud to support policies that strengthen conservation programs and ensure Minnesota’s environment remains healthy for future generations."
   HF3426 allocates Environment and Natural Resources Trust Fund resources to conservation,
   habitat restoration, environmental education and natural resources programs, and adjusts
   grants administration. This is more than vocabulary overlap. Candidate **aligns**, pending
   final review against the precise program scope.
2. `robbins_state_fraud_oversight_transparency|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd`.
   Robbins's frozen claim supports stronger state fraud oversight, transparency and
   accountability. HF3426 sections 7–11 require public-grant staff financial-reconciliation
   and fraud-prevention training, unannounced grant monitoring, preaward risk assessments,
   reconciliations, and quarterly grantee reporting. These are genuine public-program
   controls. Candidate **aligns**, pending final review.
3. `kresha_career_pathway_education_reform|HF3426|2026-04-30|ac7e9362ec9f8e85beef6072449a32b2b0e90e2c1ef0c336361f9c1eb33d9abd`.
   Source: "I am committed to having robust conversations and creating education reforms
   that improve career pathway opportunities." HF3426 funds secondary-school environmental
   STEM pathways, experiential learning, natural-resource professional links, mentoring
   and youth apprenticeships/internships. This is substantively about student career
   pathways; final reviewer must assess whether these appropriations meet the source
   proposition's education-**reform** scope rather than only incidental workforce programming.
   **Provisional; do not mark applicable yet.**

## Important fail-closed review questions

- **Rarick / HF3426:** Source requires *state-agency fraud-reporting requirements* **and**
  additional prevention tools. HF3426's grantee reports and DNR grant-manager controls are
  not automatically stricter fraud reporting by state agencies. Do not transfer the Robbins
  finding to Rarick.
- **Bahner / SF3622:** The exact pre-vote 2nd engrossment concerns the Common Interest
  Ownership Act and may have substantive changes to association/purchaser obligations.
  Source supports HOA/CIC consumer protection and oversight, not any CIC technical change.
  Determine whether *new provisions*, rather than carried-forward purchaser notices,
  substantively establish strengthened protection before deciding.
- **HF3489:** Child-protection and grooming provisions apply mainly to education/teacher
  licensure, and do not automatically prove Scott's infant/childcare-facility safeguards
  or West's provider-to-parent infant-abuse education.
- **HF4188 and SF3868:** Private commercial/insurance/virtual-currency consumer fraud
  protections cannot silently become state-program fraud oversight. Evaluate exact
  actor, program and beneficiary.
- **HF3426 other claims:** Zoo bison/conservation funding is not an operating-room expansion;
  statewide grants are not named Hastings/Mound/Minneapolis water appropriations; the
  community grant program is not necessarily Koegel's named Empowering Small Communities
  Program. Avoid scope creep.
- Distinct candidate bills still requiring per-bill confirmation:
  HF3766, HF3875, HF3970, HF4052, HF4075, HF4146, HF4224, HF4455,
  HF4493, SF3887 and SF3958. Their frozen identity titles suggest mostly
  unrelated travel insurance, judiciary, civil law, telecommunication,
  firearm-order, drill-core, discharge notice, Ramsey County personnel,
  pharmacist licensing, watershed insurance and disaster reporting matters,
  but **titles alone are not a final semantic adjudication**.

## Next PR changes required before any merge

Review all 148 nominated pairs against their exact frozen source statement and strict
pre-vote official bill version. Build the dedicated tranche-6 reviewed decision manifest,
review freezer, regression test and workflow by adapting tranche-5 **without stale
tranche indices, prior counts, SHAs, artifact IDs or review-key proofs**.
Require normal CI and dedicated workflow green on exact final PR head;
inspect the PR-head artifact, then only guarded-merge with expected head.
Require both workflows green again on exact merge SHA; inspect canonical merge artifact;
only then add a tranche-6 **review** milestone to issue #718.

Safety boundary: `contextOnly=true`, `mechanicallyActionable=false`,
`modelWeight=0`, `integrationReady=false`; public LRL identity only.
Never read vote outcomes or production DB; do not use Vercel, write features,
fit models or change serving.
