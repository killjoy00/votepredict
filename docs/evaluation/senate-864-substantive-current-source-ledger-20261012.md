# #864: 2021–2025 Senate individual-position evidence, person/year/bill-specific follow-up (2026-10-12)

## Scope and verified denominator

Research-only continuation of the Minnesota Senate public-source project. The *prior successful independent original-source audit* [Actions #38261292249](https://github.com/killjoy00/votepredict/actions/runs/38261292249) created the latest actual-serving 95-person matrix, after 13 new verified site excerpts: **95 senators / 92 with authenticated candidate-owned historical site excerpts / 1,285 selected original research excerpts**. Senator identity is grounded in the original full LRL Senate service directory (whole HTML SHA256 \`bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51\`). Ten senators have five or fewer selected website excerpts (not ten senators without positions). Three unmatched Senate campaign sites remain Wiger, Tomassoni, Bakk; previously authenticated genuine publisher/caucus sources do not count as candidate-owned campaign sites.

The 44 curated media publishers and 948 *context* rows (794 capture-year 2021–25, 154 outside) are **not** 948 senator-owned direct quotations. Ref: \`docs/evaluation/senate-media-2021-25-attribution-audit.md\`. This increment does not imply that the media corpus, committee archive, individual videos, news interviews or independent legislators' newsletters were comprehensively re-audited.

## New work: source-first, direct-quote, decision-specific LEADS

The 9 rows in \`data/evaluation/senate-864-substantive-firstparty-current-original-leads-v1.json\` refer to **8 underlying distinct named first-party statement events**. Each currently retrievable publisher page includes an explicit named speaker/quote. Only short selected original snippets are in the ledger. All 9 rows deliberately say **UNKNOWN historical public-by**, **NULL original complete archived SHA** and **FALSE forecast eligibility**; none is newly original-historically authenticated and none is automatically a verified individual ballot.

| Person / year | Primary original-publisher page | Relevant legislative choice and evidence caveat |
|---|---|---|
| Jordan Rasmusson / 2023 | [Jan 11 tax conformity](https://www.mnsenaterepublicans.com/senator-jordan-rasmusson-senate-passes-tax-conformity-bill-cuts-taxes-for-individuals-and-small-businesses/) | Explicit **qualified support**: values conformity benefits while objecting that Social Security tax relief for retirees was omitted. After same-day Senate passage; exact legislative bill/version identifier requires a separate government crosswalk. |
| Michael Kreun / 2023 | [Feb 2 SF4 carbon-free power mandate](https://www.mnsenaterepublicans.com/democrat-blackout-bill-raises-energy-costs-lowers-reliability/) | Opposes energy approach because of affordability/reliability; source page has individual Kreun quote, not merely a party-wide policy paragraph. |
| Michael Kreun / 2023 | [Apr 18 SF551/SF862 Hwy65 redesign and funding](https://www.mnsenaterepublicans.com/kreun-bill-funding-hwy-65-safety-improvements-heard-in-transportation-committee/) | Named safety/funding rationale to Transportation Committee; one underlying statement reused across two related bills, not two separately counted public positions. |
| Bill Weber / 2023 | [Jan 29 2023 PRO Act response](https://www.mnsenaterepublicans.com/senator-weber-responds-to-the-passage-of-the-democrats-extreme-abortion-bill/) | Explicit HF1 opposition **after** Jan 28 passage, not proven pre-vote. Valuable for public rationale but not a historical pre-Jan28 feature. |
| Susan Pha / 2023 | [Jan 28 PRO Act passage response](https://senatedfl.mn/senator-susan-pha-celebrates-passage-of-pro-act-as-victory-for-reproductive-freedoms/) | Expressly supports SF1 / HF1, but post-passage quote and self-description of her ballot are not an independently authenticated named journal vote. |
| Bonnie Westlin / 2023 | [Mar 28 Uniform Electronic Wills Act](https://senatedfl.mn/senator-bonnie-westlin-ushers-bill-to-simplify-estate-planning-through-passage-in-the-senate/) | Named support for **HF244 / SF1030**; page reports Mar 22 unanimous 67–0; requires original personally named journal and original pre/post-vote source proof. A deliberately **ordinary / unanimous** decision control. |
| Kari Dziedzic / 2023 | [Mar 27 bipartisan housing and health measures](https://senatedfl.mn/senate-majority-leader-kari-dziedzic-says-two-more-strongly-bipartisan-measures-pass-senate-monday/) | Personally backs Port homelessness-prevention legislation and describes fiscal rationale, $50m referenced in publisher body. Exact bill version/official individual vote crosswalk not performed here. |
| Susan Pha / 2025 | [Mar 13 SF1750 HOA/CIC hearing](https://senatedfl.mn/bipartisan-homeowners-association-and-common-interest-communities-reforms-passes-senate-housing-committee/) | Individual direct quote advocating homeowner guardrails, board transparency and conflict-of-interest reforms. Committee *passage* does not establish her personal committee ballot. |

These were intentionally selected across ordinary, negotiated, fiscal, committee and contested issues. Date displayed on the page does **not** prove what its body said before an earlier prediction cutoff. “Currently retrieved” is separate from “original archived bytes independently authenticated”; this increment has no new archived original HTML receipt.

## Historical ORIGINAL anchors carried forward, never double-count as new sources

- [2022 parents' rights first-party original + 3 individually named standalone affirmative Senate votes](senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.md): Michelle Benson SF2666 (36–31), Paul Gazelka SF2575 (37–30), Roger Chamberlain SF2729 (67–0). Earliest entire-content indexed publisher original **Feb 14, 2022 23:24:11 UTC**; named original Journal bills and vote labels independently tested. First publication minute and every subsequent bill-text revision NOT proven.
- [2023 Dahms/Gruenhagen HF100 named NO](senate-media-2023-hf100-no-primary-20261012.md): original first-party separate March publisher captures plus the individual **April 28** Senate Journal named NAY roster. Dahms *criticized earlier SF73*, whereas the recorded final-passage bill was **HF100 as amended**. Gruenhagen original was broad cannabis-policy opposition; neither is an identical-version oath. This is source-to-vote evidence, not a human-verified exact full recorded speech.
- [2024 Hawj and McEwen separately bounded written direct remarks](senate-media-2024-hawj-mcewen-original-written-quote-report-20261012.md): Hawj source names SF4056/SF3257/SF3250, McEwen names SF1416. Earliest independently authenticated original *captures* March 24 and April 22, both **after** their referenced hearings; no automatic specific omnibus member vote or retroactive prediction window.
- [Previously independently hashed original 16 short direct-source snippets](../../data/evaluation/senate-864-kari-weber-newman-16-new-original-caucus-remarks-v1.json) from 6 prior original caucus pages cover Dziedzic, Bill Weber, and Scott Newman (including **2020** statements not to be misfiled as 2021 authored facts). Separate joint Dziedzic/Champion speech from an individual-only quote.

## New offline extraction / normalization and tested matrix

\`scripts/audit-senate-864-substantive-public-positions-offline.mjs\` has two independently callable modes:

1. Validate the new lead ledger alone (no network) with \`node scripts/audit-senate-864-substantive-public-positions-offline.mjs\`.
2. Download the *prior original government-and-site-source audited* Actions artifact (run #38261292249, artifact \`senate-864-five-thin-13-actual-2022-originals-1285-senator-site-excerpts-v1\`). Extract \`senate-864-95-person-historical-candidate-issue-depth-1285.json\`. Run
   \`\`\`sh
   node scripts/audit-senate-864-substantive-public-positions-offline.mjs \
     --coverage-json path/to/senate-864-95-person-historical-candidate-issue-depth-1285.json \
     --out /tmp/senate-864-95-person-year-issue-lead-matrix.json
   \`\`\`
   Expected counts: **95 actual servants**, **92** site-excerpt covered, **1,285** original short research excerpts, **9 lead rows**, **8 distinct underlying statements** and **5,085 person/service-year/issue** cells across 15 issue families.

The **generated** report classifies all unsearched cells as \`not_systematically_searched_in_this_increment\`, and visited-but-not-originally-archived first-party quotations as \`dated_first_party_named_quote_lead_ARCHIVE_UNKNOWN\`. Original historical issue topics in campaign-site ledgers are **person-level cross-year context** only; never synthetically attributed to an exact 2023 senator-floor statement. No statement's position is inferred from a partisan context mention or from an official bill sponsor name; the currently visible quote is the minimum lead.

Offline adversarial regression: \`node --test tests/senate-864-substantive-public-positions-offline.test.mjs\` — 14 separate cases checking identity/year, gov SHA, quoted speaker, article host, publication/decision date, PDF-vote independence, exact-source provenance, duplicate quoted bill crosswalk and unsearched ≠ no statement.

## Archive limits and high-value unblocked next retrievals

- **Current direct publisher source body is accessible, but exact whole archived original body and independent CDX indexed digest are NOT proven** for any of the 8 newly reviewed events. Attempts to directly open two exact Wayback CDX queries in the current research environment failed at the provider/access layer; *UNKNOWN* is not absence. A new independent original-byte runner is necessary before promotion.
- **Wiger / Tomassoni / Bakk:** genuine older historical originals were recovered but *incorrect office* (2008 Bakk gubernatorial page) or *repurposed content* (2019 Tomassoni site); broad re-probing those same candidate domains without new identifiers has low marginal value. Prefer legislator-floor/historic caucus/newsletters and previous first-person publisher archive. Do not increment candidate-owned Senate site denominator using publisher copies.
- **2021–22 floor/hearing speaker timestamps** and personally identifiable chamber/committee deliberations have yet to be enumerated senator-by-senator. Senator statements and member vote records must not be inferred from party totals, proxies, or news mentions.
- **Source-versus-decision version and conditions**: prioritize SF4 Kreun specific provision, SF551/SF862 public works appropriations, Rasmusson's Social Security exception, and Dahms SF73 versus amended HF100. Duplicate news recaps of the *same* underlying quote do not create distinct stances.
- **Prediction/public-by**: For every source, compare indexed original capture to the **actual decision event and exact bill version**, not merely the publisher header date; the same-day first posting minute remains unknown even for archived sources. Existing source-to-private-production evidence row matching is not authorized and was not attempted here.

No emails, outreach, records requests, contacts, production DB writes/reads, forecasts, backtests, model training, scheduler/collector changes, deployment, or serving changes. Parent [#864](https://github.com/killjoy00/votepredict/issues/864) stays **OPEN**.