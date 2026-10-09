# Issue #864 — Historical Senate finance: regulator calendar index and SD6 conflicting sources

**Date:** October 9, 2026. **Scope:** public Minnesota Campaign Finance and Public Disclosure Board calendar discovery for 2021–2025, with a two-document original-PDF pilot for the 2025 Senate District 6 special-election calendar. No database reads or writes, private data, model changes, scheduler changes, unapproved backfill, or public-office contact.

## Separate finance completeness requirement

The Board's [official calendar archive index](https://register.cfb.mn.gov/filer-resources/disclosure-publications/calendars/calendars-archive/) currently lists calendar sections headed **2023**, **2024**, **2025** (and 2026, excluded), covering different special-election, filer-category, and ordinary calendars. **There are no 2021 or 2022 campaign-finance sections on the currently visible archive page** (checked 2026-10-09). That is **not evidence those years' calendars never existed**: they must remain marked year_not_listed, never inferred as a zero count or replaced with another year's calendar.

The existing [public-source ledger](./source-proof/cfb-2025-senate-district6-report-pdfs.json) independently proves original PDF hashes, exact received dates and distinct statutory due dates for one Senate committee (registration 19205 in 2025). Such calendar dates must not be copied to other Senate special elections, years or filers without exact authoritative sources.

The new pure archive parser reads the regulator's official HTML, records its fetched-body SHA-256, lists year- and family-specific links with exact official original PDF URLs, and reports explicit year-not-listed or malformed-source states. It does **not** infer due dates, report filing obligation or public availability from the link title. **The calendar index is not the official registered-filer or required-report denominator.**

## Discovered 2025 calendar archive office-label inconsistency

The live October 9, 2026 archive source inventory lists **10** calendar links for 2025, of which the original parser labeled **5** as Senate special elections. One archive anchor literally reads **“Senate District 64A special election”** and links to [the CFB's original 2025 64A calendar](https://register.cfb.mn.gov/pdf/calendars/2025_special_election_64A.pdf). But a Senate district is not designated with an A/B suffix, and the original PDF identifies **House District 64A** rather than Senate. We must not count an archive anchor as independent office proof.

The corrected inventory therefore distinguishes **four valid numeric Senate special-election link labels**, **one ambiguous archive office label**, and **three explicitly House-labeled special election links** for 2025. The remaining two entries are a general calendar and local-election influence disclosure calendar. The **10 links remain 10 source references**; none count mandated filings or Senate candidates.

The public source capture now makes **one additional bounded original CFB PDF request** to prove the 64A title from original PDF bytes, recording its SHA-256/size/fetched-at and a narrow exact title check. If that request fails, chamber resolution remains *unverified* and is recorded as a failure. This is metadata-only and does not alter the other archives, historical release dates, or any candidate identity. The original CFB archive's title is preserved literally as provenance alongside the discrepancy, not silently rewritten.

## Conflicting official SD6 period cutoffs: no silent adjudication

Two distinct official CFB sources require independent original-byte verification:

1. [Standalone Senate District 6 special-election calendar](https://register.cfb.mn.gov/pdf/calendars/2025_special_election_6.pdf), linked from the Board's public archive. Search-indexed sources suggest final-report period ended **May 14, 2025**, but its original PDF bytes have not yet been captured and verified by this project.
2. [Senate District 6 candidate packet, March 25, 2025](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf), already downloaded and hashed in #870–872. The *public subsidy agreement* says the election cycle ended **May 14**; the packet's own final-page **disclosure calendar** says the final report period ended **May 20**. Both statements appear in the same regulator PDF.

The independently acquired registration 19205 special-cycle final report covers **January 1–May 14, 2025** and was received **May 26**; the following ordinary 2025 year-end report begins **May 15** and was received **January 30, 2026**. The periods are contiguous; they do not establish a missing row or a historical disclosure time. The original year-end report still has a conservative earliest legal release day of **February 3, 2026** (day after its actual due date), not the day after early filing.

**No source here independently settles the governing final-period wording or establishes an official erratum or version/publication history.** Both calendars appear to give the special final report a **May 27** due date, with a **May 28** conservative legal release floor. An independently proven period wording discrepancy should be escalated as a regulator-document/version debt, not silently merged into a row's coverage or converted to a missing contribution.

## Scope of this small PR

- src/evidence/cfb-historical-calendar-inventory.ts: deterministic archive-year source inventory for 2021–2025 only, URL host/path allowlist, preserved calendar families and null/unknown counters; exact original-SD6-PDF metadata comparison using source URLs, content SHA-256, original byte length, dated capture, correct document title and a fully contextual final-report period expression. A May 14 election date outside the final-report expression cannot be used as proof.
- scripts/capture-cfb-2021-25-calendar-index-and-sd6-version.ts: at most **four read-only public CFB requests**, one official archive listing and the two distinct SD6 PDF sources. Source hashes, size, per-document status and verified date claims are persisted. **No source PDF bytes or raw parsed PDF text, donor data or credentials** go into the artifact.
- tests/cfb-historical-calendar-inventory.test.ts: synthetic coverage of archive-year absences, wrong-domain links, duplicate source entries, source conflicts, both period-end variants, PDF spoofing, ambiguous text, and eligibility fail-closed constraints.
- .github/workflows/cfb-2021-25-historical-calendar-index-probe.yml: a **one-time** public source probe triggered solely by first addition of its workflow file to main. No cron, job scheduler, data service or forecast integration.

Inspect GitHub workflow artifact: per-year **year listing status**, report-category **calendar links**, and **both original PDF statuses**. A successful Actions job does **not** itself certify those original PDFs were obtainable: require per-source proof and absence of acquisition failures.

The Board's nightly current committee lists and candidate transaction CSV downloads are not independently verified historical Senate registrant universes; treating their existing rows as the roster would exclude committees that made no disclosable expenditures/contributions. **The official 2021–2025 filer roster and required/received report denominators remain null.** The absence of 2021–22 sections on this archive page requires independent regulator-source recovery, not manufactured due dates.

Next: independently locate verified historical candidate/Senate registration listings including former and terminated committees, all 2021–25 Senate special-calendar years, actual required and filed reports, and specific original report-to-transaction row containment. Compare against historical stored timestamps only after separately authorized private, read-only export. **#864 remains open; no automatic historical eligibility repair.**
