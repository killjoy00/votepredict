# Issue #718 — Cohort-2 2025–26 House applicability tranche-9 working review notes

**NONCANONICAL, read-only, non-serving.** These source-bounded observations are a
manual-review handoff and do not themselves make any candidate applicable.

## Frozen inputs and deterministic evidence boundary

- Canonical starting `main`: `cc457efad0c1c061e211f14d440ca8a16588002e`, candidate PR #840.
- Cohort-2 candidate audit push run **37832386938**, archive artifact **11574520636**.
- Exact candidate ZIP SHA-256 `be7841eb4a8e674dbfccfe1c0ad812ffb8b879788f62fb74fac92140b6878ee5`.
- Embedded candidate output content proof `94075055e81b5ffca109b31ef8a8359b3dfe3599ad2464476b3d45f649b6da00`.
- Exactly 249 candidate review-key set proof `8711d9c01aad8ba7b2d26d3ca89f294dfee6b9cc9769abc12e66e31aa2471de1`.
- Frozen member source run **37789611806**, semantic artifact **11555527900**,
  archive `sha256:fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b`,
  content proof `fdbcb6061ad1f8fe79db1525345627f638a450227d68c5e72890d7e82dfc4cb1`.
- Deterministic rank **201–225**; **25** target vote events, May **12–16, 2026**.
  Target event-set SHA `ee804ad6c0d65f64848a96c716e000146ca09e74ac00e31ca4a2be9d08896c3e`,
  preceding rank 176–200 SHA `107c41146c0359bc186012674f663db64b4f791bb4fc4b7ac96e5d9dc90e3916`.
- **42 independent novel sources × 25 events = 1,050** eligible claim/event pairs.
  Exactly **23** events with strictly pre-vote official Revisor versions and **2** without
  a version (HF3825, HF4384); **249** nominated, **717** not nominated, **84**
  baseline source-version fail-closed. 18 candidate bills, 41 public members/groups.
  The two missing-version events cannot be rescued by same-day or later text.
- PR-head and merge checks green on exact SHAs; artifact integrity 23/23 passed.
  Candidate nomination is **not applicability**, does not use voting outcomes,
  and cannot resolve internal historical membership IDs from public LRL identifiers.

## Preliminary *exact source × exact bill version* policy matches to adjudicate

1. **Hussein / HF2433**: strict 2025-04-30 second engrossment; K–12 education
   finance and appropriations funding statewide school programs. His frozen
   public-school-resourcing source is broad but specifically about well-funded
   public schools. Review actual appropriations and administrative vs new status.
   https://www.revisor.mn.gov/bills/94/2025/0/HF/2433/versions/2/
2. **Kresha / HF2433**: that same engrossment adds $5 million per year to
   career-and-technical education consortia and $500,000 per year for public
   high-school EMT coursework/certification grants; this is substantially closer
   to Kresha's linked *education reform for career pathways* than earlier
   environmental internship grants. Verify grant character and scope independently.
3. **Wolgamott / HF4074**: strict May 11 second engrossment, actual ARTICLE 3
   teacher-retirement changes (St. Paul employee contributions 11.5% to 10.5%
   for basic, 9% to 8% for coordinated, +$3.4m additional annual state aid,
   easier retire-and-return eligibility at 59½, expanded suspended annuity
   earnings relief). Material teacher-pension reform, not just mentions of TRA
   in a public-employee pension omnibus.
   https://www.revisor.mn.gov/bills/94/2026/0/HF/4074/versions/2/
4. **Hussein / HF3900**: strict May 4 second engrossment proposes a
   constitutional change and school-fund distribution policy expressly
   intended to increase funding to all school districts; prospective,
   *not enacted* and not a different Equal Rights Amendment.
   https://www.revisor.mn.gov/bills/94/2026/0/HF/3900/versions/2/
5. **Harder / HF3426**: strict April 20 first engrossment spends Environment
   and Natural Resources Trust Fund money on conservation/restoration/programs.
   https://www.revisor.mn.gov/bills/94/2026/0/HF/3426/versions/1/
6. **Robbins / HF3426**: same frozen bill has substantive grants anti-fraud
   monitoring, preaward risk assessment and annual grant manager training;
   independent source broad state fraud oversight, not Rarick's two-part claim.
7. **Robbins / HF4252**: newly pinned **third** engrossment posted May 4;
   check *this* exact version's added §136A.1212 allowing fraud/information/
   inspection-based denial of state aid/grants. Do not auto-transfer prior
   second-engrossment decision without new verification.
   https://www.revisor.mn.gov/bills/94/2026/0/HF/4252/versions/3/
8. **Robbins / SF4760**: exact April 22 second engrossment permits new BCA
   investigative subpoenas for fraud including state-funded/state-administered
   programs; same bill identity and version as earlier tranche-7 source,
   but independently pin May 12 target and the exact current candidate review key.
   https://www.revisor.mn.gov/bills/94/2026/0/SF/4760/versions/2/

No row is accepted merely by appearance in this list; use candidate reviewKey,
source, member and strict pre-vote bill text to make any final override.

## Exact fail-closed boundaries requiring manual attention

- **Rarick / SF4760**: Department of Commerce private insurance fraud
  referral plus BCA statewide fraud tools may not satisfy the source's joined
  *state-agency incident reporting AND fraud prevention* proposition. Keep
  fail-closed unless both are proven together, not assembled from unrelated
  program spheres.
- **Kresha / HF3426**: conservation-funded youth STEM/career exposure
  overlaps topic but does not independently establish the exact linked
  *education reform* proposition; preserve ambiguity, unlike HF2433 CTE.
- **Kresha / HF4252**: private career-school licensure, distance-ed quality
  rules and auditing do not necessarily establish *expanding student career
  opportunities*; separately consider fail closed.
- **Wolgamott / HF2433**: general K–12 funding and teacher-salary eligibility
  in an EMT school grant do not by themselves prove competitive teacher pay,
  safe workplaces, or fair pensions for teachers statewide. Could be
  unrelated/ambiguous.
- **Hill/Noor / SF3210**: newly protected *reasonable disability
  accommodations* are not independently a change to government treatment of
  LGBTQ, racial/ethnic or immigrant identity groups, even if the existing
  underlying Human Rights Act mentions those categories.
  https://www.revisor.mn.gov/bills/94/2025/0/SF/3210/versions/1/
- **HF3489**: K–12 field-trip supervision and educator grooming offenses
  not automatically infant childcare-provider abuse safeguards or parental
  education about abuse of infants.
- **HF4138**: social-media accounts for minors and AG enforcement
  not parental education on infant abuse or expanding public access to
  Attorney General office data.
- **HF2433 / Lawrence**: reviewed K–12 appropriations and references to
  school attendance cannot be construed as the *chronic truancy/absenteeism
  tracking* bill he endorsed absent a concrete new reporting provision.
- **HF4074**: teacher-pension Article 3 is real; unrelated general
  public retirement contributions, state employee benefits and voluntary
  first responder references do not establish PFML/telework/medical assistance.
- **SF4282**: forecast corrections across K12, DCYF, DHS, Metro Mobility
  do not silently implement the *Great Start* named childcare affordability
  law, a state-operated public healthcare replacement for insurers, a
  home-school counseling expansion or infant-abuse parent education;
  same exact SF4282 version appears at two target vote dates, so preserve
  separate exact review keys.
- **HF4252 / Dippel**: $500k PFAS cleanup at Lake Superior College
  firefighter training center is not Hastings municipal drinking-water
  treatment, regardless of shared PFAS term.
- **SF2373**: minor league baseball pay exemption and building-code licensing
  don't establish state policy on teacher pensions, household taxes, or
  named small-city water projects.
- **HF4188**: private financial products/virtual-currency fraud controls
  are not state-funded program fraud oversight or state-agency reporting
  tools; don't substitute broad consumer protection for HOA/CIC law.

## Scope of remaining review

All **18** bills need a grounded per-bill default rationale, including
HF1141, HF2433, HF3067, HF3426, HF3489, HF3900, HF4017, HF4074,
HF4138, HF4188, HF4239, HF4240, HF4252, SF2373, SF3210, SF3432,
SF4282, SF4760. The long K12, teacher retirement, higher education and
public-safety bills must be examined at the precise provisions implicated
by the 249 member statements. Maintain the exact **249** review keys and
explicitly fail closed for ambiguous actor, program, chronology and direction.

Do not use target vote outcomes. Do not call production databases,
Vercel or modify any feature rows, integration flags, model weights,
model-fitting or serving. Preserve `contextOnly=true`,
`mechanicallyActionable=false`, `modelWeight=0`,
`integrationReady=false` and unresolved internal membership identity.

**Next:** create checked-in review manifest with explicit exact-key overrides,
dedicated reviewed freezer, regression tests and workflow; inspect PR-head
artifact; CI on final PR head; guarded merge; CI on exact merge SHA;
independently inspect canonical artifact; only then #718 manual review milestone.
