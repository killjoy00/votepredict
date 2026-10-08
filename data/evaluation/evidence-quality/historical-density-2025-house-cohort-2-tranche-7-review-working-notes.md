# Issue #718 — 2025 House cohort-2 tranche-7 semantic review working notes

**NONCANONICAL / outcome-blind.** This is a review handoff, not a completed decision
manifest. No candidate may be used as a model feature or marked applicable solely
because a lexical screen nominated it, and no source/target vote outcome is consulted.

## Immutable candidate source

- Exact canonical `main` at start: `273838d61dd3e32b351c28f20f46b8e7176bd61c`.
- Canonical candidate-audit workflow run: `37818931593`.
- Canonical artifact: `11569180060`.
- ZIP SHA-256: `1a80f0d5fabe6526a8b34e1dfc3ca01cab5236439ac02019499d0d1c82d5986d`.
- Candidate audit content proof: `1d8265f8d9f67ca35d1f46c369d84f07b7262984c880000fd0b2fc2d31d967e3`.
- Candidate review-key set SHA-256: `795b2caffcc871bde906213ca2557b62a49d84def52d4ce7e2c5d112a9ef526c`.
- Pinned cohort-2 semantic aggregate artifact: `11555527900`, ZIP digest `sha256:fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b`.
- Deterministic target index **7**, ranks **151–175**, 25 events between **2026-04-30 and 2026-05-04**, event SHA `3d994198b510f648867bb0804b25ff201328c6dd0628d901ff33579b43f1378f`.
- Preceding rank-126–150 event-set SHA `eafb3980bdbe20a94da1150e673e8d9218753bcea7f696863fc598f9b4abc072`.
- **42** novel cohort-2 source propositions, **1,050** eligible pairs.
- Source verification: **21** verified, **4** without strict-pre-vote version: HF3522, HF3679, HF3709, HF4492.
- Candidate screen: **169** candidate-for-review / **713** not nominated / **168** baseline fail-closed; **17** candidate bills, **39** candidate public members and **39** candidate semantic groups. No automatic applicable or aligned rows.

The four no-version events are not available for later manual rescue by looking at
same-day or subsequently posted text.

## Exact-source potential substantive matches (not final decisions)

Every key below refers to one **exact** frozen bill/version identity. Do not transfer
the claim to another bill or version. The member statements are normalized only for
display; the original semantic group and source rows/URLs remain frozen upstream.

1. **Bahner / SF1750**, vote 2026-04-30, 3rd engrossment posted **2025-05-07**,
   version SHA `507c078c9b020f046b73d0f1ebb112d01049c907abb5a0696c4a16cf7b1ada86`.
   Candidate key:
   `bahner_hoa_cic_consumer_protection_reform|SF1750|2026-04-30|507c078c9b020f046b73d0f1ebb112d01049c907abb5a0696c4a16cf7b1ada86`.
   Exact source supports HOA/CIC reforms strengthening consumer protection and oversight.
   Official pre-vote text: https://www.revisor.mn.gov/bills/94/2025/0/SF/1750/versions/3/
   Contains new unit-owner dispute resolution, constraints on owner fines/debt
   collection/fees, transparency and board conflict-of-interest rules. Strong
   **substantive-alignment candidate**, subject to full review.

2. **Robbins / HF3684**, vote 2026-05-04, 1st engrossment posted **2026-03-18**,
   version SHA `221715130568be0e8d320d4bc36881b88f90e5e6c99f18a13a4f7033748a33cb`.
   Candidate key:
   `robbins_state_fraud_oversight_transparency|HF3684|2026-05-04|221715130568be0e8d320d4bc36881b88f90e5e6c99f18a13a4f7033748a33cb`.
   Official pre-vote text: https://www.revisor.mn.gov/bills/94/2026/0/HF/3684/versions/1/
   Sets standards for Department of Veterans Affairs grants and grants commissioner
   power to withhold awards on fraud/investigation grounds, with reporting and scoring
   controls. Strong **state-program fraud-oversight candidate**, not automatically Rarick.

3. **Robbins / HF4252**, vote 2026-05-04, 2nd engrossment posted **2026-04-28**,
   version SHA `3f8ce2b77740c67ba6e55aca1889ceed08b0486520ef83d1de43a3f1f6a30033`.
   Candidate key:
   `robbins_state_fraud_oversight_transparency|HF4252|2026-05-04|3f8ce2b77740c67ba6e55aca1889ceed08b0486520ef83d1de43a3f1f6a30033`.
   Official pre-vote text: https://www.revisor.mn.gov/bills/94/2026/0/HF/4252/versions/2/
   Adds section 136A.1212 allowing denial of student aid/state grants for materially
   fraudulent applications, refused information/inspection and government-funding
   violations. Strong **public-grant fraud control candidate**.

4. **Robbins / SF4760**, vote 2026-04-30, 2nd engrossment posted **2026-04-22**,
   version SHA `6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f`.
   Candidate key:
   `robbins_state_fraud_oversight_transparency|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f`.
   Official pre-vote text: https://www.revisor.mn.gov/bills/94/2026/0/SF/4760/versions/2/
   Creates BCA subpoena authority in financial-crime/fraud investigations, explicitly
   including fraud in state-funded or state-administered programs. Strong
   **public-program investigative-capacity candidate**.

## Material review questions — preserve fail-closed distinction

- **Rarick / HF3684, HF4252, SF4760.** Her *exact* source requires both stricter
  fraud reporting by state agencies and additional prevention tools. Grantee-to-agency
  reporting in HF3684 and fraud-based student-aid denial in HF4252 do not themselves
  establish the required agency reporting rule. SF4760 has a Department of Commerce
  insurance-fraud referral obligation and separate BCA financial-crime powers; decide
  whether these are genuinely the *same* state-agency reporting/prevention proposition,
  not an assemblage of unrelated commercial-insurance and public-program tools.
  Candidate SF4760 exact key:
  `rarick_state_agency_fraud_reporting|SF4760|2026-04-30|6556496ef9fb1af977eb787b8b54c9ad3ddb53e5b0896077440e252ef7b6722f`.
  Fail closed if scope remains uncertain.
- **Kresha / HF3732**:
  `kresha_career_pathway_education_reform|HF3732|2026-05-04|d63e816a16cae41548b817b23d984b7aec1ee38d986ab1a8cbbb751f2b844a8e`.
  HF3732 youth job-skills programs and workforce training support provide genuine
  career readiness but might not prove the exact member claim's **education reform**
  requirement. Check amended vs carried-forward provisions.
- **Kresha / HF4252**: changes to private career schools/oversight are not
  automatically a reform that **expands career opportunities**; prove both if needed.
- **Koegel / HF3732**: DEED employment/economic development grants are not automatically
  the specifically named *Empowering Small Communities Program*. Do not swap
  generic small-city grant language for this named permanent program.
- **Mahamoud / HF1141**: statewide housing appropriations do not establish the
  combined *Minneapolis water-distribution and deeply affordable public-housing*
  proposition. No Minneapolis-specific water component was found in initial review.
- **SF4760 other candidates**: omnibus public safety data, victim assistance,
  probation, interlock, corrections and fraud terminology must not be projected onto
  unrelated childcare, civil rights, immigration, medical-debt, school attendance,
  Safe Haven Baby Boxes, local infrastructure, disability-tax or National Guard claims.
- **HF1082** and **HF3732** are large omnibus bills with 20 and 31 nominations.
  Require a careful policy-by-policy, actor-specific sweep before a default
  `not_applicable` rationale can be justified. Do not infer from titles.
- **Remaining nominated bills**: HF1141, HF1270, HF3532, HF3900, HF3919,
  HF3972, HF4063, HF4151, HF4462, SF3888, SF4807. Each needs a full exact-version
  review to ensure an incidental keyword does not mask a real policy match.

Cohort-1 tranche-7 (earlier reviewed 46-group source) is a **consistency anchor only**.
Its accepted Allen matches HF3684/HF4252/SF4760 cannot be blindly copied to
Robbins or Rarick; each cohort-2 claim needs its own independent adjudication.

## Next steps for PR

1. Independently read every exact frozen member proposition and every nominated
   official strict-pre-vote bill version; prove bill/program/actor/target scope.
2. Build a tranche-7 cohort-2 reviewed **decision manifest** with explicit
   bill-level rationales and item-level overrides, keeping ambiguous cases fail-closed.
3. Add pinned reviewed freezer, regression tests and dedicated workflow (adapt
   tranche-6 only after removing every stale index/ID/hash/count/label).
4. Enforce exactly **169** candidate keys and counts, frozen review-key SHA,
   input ZIP/content proof, 21/4 source verification, 17 bills/39 members,
   1,050 eligible pairs; do not invent the number of applicable overrides
   before review is finished.
5. Require dedicated freeze + normal CI on exact final PR head; download and
   independently inspect the generated artifact.
6. Guarded merge with `expected_head_sha` after rechecking main/head/base,
   then exact-merge dedicated + CI and canonical artifact inspection.
7. Only then comment the **review** milestone on #718. Never equate candidate
   audit completion with semantic applicability completion.

Safety: pre-vote independent source availability; no same-day evidence absent
independent ordering proof; no target vote outcomes; no bill-identity transfer;
public LRL identity only, internal membership unresolved;
`contextOnly=true`, `mechanicallyActionable=false`, `modelWeight=0`,
`integrationReady=false`; no production DB reads/writes, Vercel, features,
model fitting or serving changes.
