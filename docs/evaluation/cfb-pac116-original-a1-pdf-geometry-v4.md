# #864 — Original PDF A1–PAC table geometry verification for 116 campaign contributions

**Scope:** Minnesota Senate 2021–2025 canonical *incoming campaign contributions* from two registered PACs with independently attested first-party/legal identities **as observed in October 2026**. This is not an analysis of PAC political advocacy, not a general news crawler, and not evidence of financial causation of a vote.

## Why a third check

The first protected campaign-finance audit (PR #1408, run #39002428756) reproduced **116 unique** canonical PAC-related contributions across **299** stored evidence copies; **113** had possible candidate/filing-year report versions, **3** did not, and **0** had exact original PDF schedule-entry links. **114** carry old historical `asOfEligible` labels that were not independently certified.

The source-column shadow (PR #1410, run #39003033541) examined **243 original report versions**, **18,495 receiving-committee/year canonical row comparisons**, **2,269** arithmetically supported generic candidate spans and **12,487** multiple-amount spans lacking sufficient arithmetic/header proof. It found **zero** unique PAC row candidates. This could mean poor text extraction, a missing receiving-committee filing, legally unitemized contributions, image-only forms, report-version differences, or genuine absence. None can be assumed from a generic parser result.

The Minnesota CFB's [2023 candidate Year-End A1–PAC original form](https://cfb.mn.gov/pdf/forms/cf_reports/2023_Candidates_YearEnd.pdf), pages 10–11, explicitly identifies the registered *political committee/fund*, requires a registration number, and uses separate Date received, Registration, Name/address, Col. 1 Cash, Col. 2 In-kind, and Col. 3 Total fields. A generic plain-line search loses this table geometry.

## Verified original-PDF geometry contract (v4)

- Only the **two** independently dual-original-attested *current* PAC registration IDs may select the 116-row cohort, with source hashes/observed timestamps checked again. The third held PAC is excluded.
- Reuse the **existing** 830 official report identities (813 unique SHA-256 bodies), exact report-version/recipient/year index, cached immutable original PDF bodies, and corresponding raw page text in Neon. Every PDF body used in the geometry check is **rehashed in memory** and matched to its expected official full-body SHA and byte length.
- Discover pages with an actual *SCHEDULE A1–PAC* header and a literal PAC registered identity (or source-only Education/Chamber keyword as a discovery backstop). An instructions page or an A1 individual/lobbyist or B1 expenditure page is never used as an A1–PAC source.
- Analyze PDF **vector table geometry** using the existing locked `pdf-parse` package's `getTable({partial: [...]})` on the original PDF bytes, rather than flattened text or invented coordinate guesses. Only accept an unambiguous separate printed Date, PAC Registration, Name/address and **Col. 3 Total** column. The registered donor number must appear **in the registration column** of the same table row as the received date and specific amount. The printed legal name must corroborate the canonical/CFB legal donor label. No inherited prior-row donor identity, unverified alias, or separate-page amount is automatically treated as the target's source.
- Compare against **all** candidate receipts for that receiving committee and filing year, not only the PAC subset. Unknown, contradictory, same-registration/date/amount competing rows are held, never silently filtered.
- Count original and amended report versions **separately**. A transaction verified in two versions may not be attributed to an early version without independently proving the specific version contained that entry.
- The protected runner emits only **aggregate counts** of eligible A1 pages, parsed vector tables, PDF SHA checks, exact same-row source hits, conflicts, unreadable/undecomposable pages, deferred pages and remaining unverified records. It never exports donor names, PDFs, per-row matches, original page screenshots, raw coordinates, committee identities or amounts to public GitHub logs.

This is a **read-only diagnosis of currently available original PDF contents**. It does **not** establish that an exact original PDF body was publicly available before a historical vote; the CFB historical release clock, PAC legal affiliation date and member/bill issue stance remain separate evidence requirements. A same-row geometry match by itself does not upgrade `asOfEligible` or `published_at`.

## Protected execution

The additive research-only geometry module and test run in no-secret PR CI and again in a separate main SHA preflight. Only a first-attempt reviewed `main` merge bearing the existing marker `SENATE_864_CFB_PAC_116_FINANCE_READONLY_V1` can start the protected existing-Neon audit, using the existing `evidence-readonly-sandbox` credentials and independently resolved production-primary identity. Work executes in a bounded `REPEATABLE READ READ ONLY` transaction with explicit `ROLLBACK`. No migration, source ingestion, financial evidence update, stored eligibility rewrite, prediction, model change, Vercel deployment or additional scheduled collector is authorized.

**Remaining:** For any row the PDF vector extractor cannot resolve, actual human reading/rendered page inspection or separately verified official exact-transaction bulk archival evidence would still be required; this automated job should report that gap rather than pretend a text/table machine has visually authenticated handwriting.
