# Issue #718 — final cohort-2 House tranche 11 semantic review notes

**NONCANONICAL RESEARCH ONLY.** No candidate is a model feature or a positive alignment by lexical match.

## Exact pinned sources and chronology
- Starting `main`: `a460acc595a3b2222beff47620892755aa347777`, candidate-audit PR #844.
- Canonical final candidate run **37839924268**, artifact **11576828710**, archive `sha256:b6ff18a1c4dd93bac6179ebc454a160db7ac68b7840aa4713523e056bc7d169b`, audit content proof `072b44fdc09980bbee25b1f807164361af612113d1f3551bc59ef9efc4397ecd`. **29 exact nomination keys** SHA `b6eb850b70a1d50beb3f5e343b0444c09b479169b27abec1140e477ee50653bc`.
- Frozen 42 semantic member-issue source groups artifact **11555527900**, ZIP `sha256:fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b`, content `fdbcb6061ad1f8fe79db1525345627f638a450227d68c5e72890d7e82dfc4cb1`.
- Original Evidence Quality v1.7 matrix artifact **11436413885**, 135,457 rows; ten earlier target hashes independently verified.
- Final ranked target **251–264**, 14 events; target SHA `3d4d83276928f170726e2a499c2422eac2ede373f711bcdcfdca29c542e95242`, previous tranche SHA `87cfaaec13743d7c7d97f2ea3b69f5f2cfb389320e356a4893991827ba023848`. Twelve events with 133 uncovered membership rows and two with 132; 13 targets March 2025, one April 2026. True dates **2025-03-03 to 2026-04-20**.
- 42×14 = **588** theoretical combinations; exclude **114** whose source statement was not available strictly before vote; **474** eligible (**432 in 2025, 42 in 2026**). Among these: **29 nominated / 375 not nominated / 70 no strictly prior official Revisor version** (HF1058, HF1410); 12 events have verified prior Revisor text.
- Final screen spans **10** bill identities and **18** semantic source groups/public members. Automatic decisions = 0; source excerpt and target vote outcome use = none.

## Direct substantive matches requiring exact-key review

1. **Bernie Perryman / HF4, target 2025-03-17**, exact 2nd engrossment posted 2025-03-10, bill text hash `2d8bc31c73f5eca6b3f775a670597b3a7e97dd1098199f4b9b7cfa71dc5e6cb5`. Official https://www.revisor.mn.gov/bills/94/2025/0/HF/4/versions/2/. Bill proposes a *voter-contingent constitutional Minnesota tax relief fund* for projected surplus revenue exceeding 105% of expenditures, returned through one-time taxpayer refunds **or** one-time tax reductions. His frozen source: co-authored constitutional amendment to guarantee future budget surpluses returned to citizens. Strong positive **as a proposed change**, not existing law; do not claim all returned necessarily as cash refunds.
2. **Kristin Robbins / HF3826, target 2026-04-20**, 2nd engrossment posted 2026-04-07, bill hash `ad53562ff7410b899f9cd34ecb296233ed98852b70d45beb0c4b1d5428e92e6c`. Official https://www.revisor.mn.gov/bills/94/2026/0/HF/3826/versions/2/. Newly expands Minnesota AG **and** county attorneys' subpoena powers into records for financial crime and fraud investigations expressly including **state-funded or state-administered programs/services**. Direct match to Robbins's broad governmental fraud oversight and accountability claim. But this is **law-enforcement access**, NOT publicly accessible AG Office data (Niska), and not the combined state-agency **fraud incident reporting plus prevention tools** (Rarick).

## Fail-closed ambiguity

- **Marion Rarick / HF3826**: adding AG/county investigation tools for public-program fraud may help detection but does not require stricter ongoing **state-agency incident reporting** of fraud. Her frozen source joins two parts; no directional action unless both are proved.
- **Melissa Hortman / HF25, 2025-03-13**: strict 2nd engrossment posted March 3, the *Supporting Women Act* creates pregnancy/maternity home grants and bars grantees from encouraging, providing or referring to abortion care. Hortman source covers resisting federal **attacks on both abortion access and transgender Minnesotans**. Grant eligibility may affect abortion referral access but does not clearly prohibit abortion services generally nor directly protect the other constituency. Cannot resolve the full claim as aligned or conflicting from a grant-program restriction alone.
- **Melissa Hortman / HF24**: introduced text says born-alive infants following abortion receive emergency care and recognition after birth; this regulates post-birth care rather than the legality/accessibility of abortion or protections for trans residents. Treat as **not applicable**, not automatic abortion-rights conflict.

## Bill-level fail-closed / not-applicable rationales to carry into manifest
- **HF1034** — district aeronautics/commercial transportation technical pilot program grant, not counseling/guidance for *homeschooled elementary* students (Clardy).
- **HF1401** — expands definition of *endangered missing person* under BCA missing persons law, not authorization of Safe Haven infant surrender boxes (Novotny), nor providers' mandatory parent education about infant abuse (West).
- **HF1443** — Minnesota corporation governance powers/compensation rules, not Smith's *CEO pay more than 50× median worker* company tax.
- **HF24** — born-alive infant medical care post-delivery, not Hortman's compound abortion-access and transgender protection source.
- **HF25** — maternity-home/pregnancy-center grants with exclusion of abortion providers and referrals; lacks new HOA/CIC consumer-rights statutes, mandated hospital safe staffing ratios, gas/delivery tax repeal, PFML entitlement protection, disabled-veteran property-tax exclusion, state-funded purchase of medical debts or provider education to parents about recognizing/reporting **infant abuse**. The frozen one Hortman item explicitly ambiguous.
- **HF3826** — state-funded program financial-fraud investigatory subpoenas substantively match Robbins; does **not** fund Minneapolis water/public housing combined, publicly release AG-office data, authorize Safe Haven Baby Boxes, set company CEO median-pay-ratio taxes; Rarick compound incident-reporting + prevention ambiguity is separate.
- **HF4** — constitutional taxpayer-surplus fund matches Perryman only; it is not Finke's *inclusive Equal Rights Amendment*, Rehrauer's named disabled-veteran exclusion increase or Smith's corporate pay-ratio tax.
- **HF438** — Crane Lake Water and Sanitary District local authority, not city of **Mound** clean-water protection/investment (Myers).
- **HF747** — Minnesota business corporation governance/rights of *common shareholders*, not HOA/CIC condominium *common-interest* property protections (Bahner), inclusive constitutional ERA (Finke), or Minnesota AG public data release (Niska).
- **SF1552** — private warehousing/financial auditing regulatory reports, not AG Office public records disclosure or CEO-to-worker pay-disparity tax (Niska/Smith).

## Non-serving gated deliverables
All 29 nomination keys require review with exact version posted **strictly before** vote. Add checked-in full decision manifest, reviewed freezer rejoining **complete** original candidate/source records, regression tests and dedicated workflow. Head dedicated + normal CI on exact final head, independently inspect report, guarded `expected_head_sha` merge, same two checks on **exact merge SHA** and canonical post-merge artifact, only then manual review milestone on issue #718.

No target vote outcomes, same-day unproved version, cross-bill/person identity transfer, inferred public LRL→internal historical membership, production DB, Vercel, feature rows, model fitting/weights or serving modifications. Keep `contextOnly=true`, `mechanicallyActionable=false`, `modelWeight=0`, `integrationReady=false`.
