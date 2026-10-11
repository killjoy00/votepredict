# #864 Finance Track A — next 20 original 2021–2022 Senate candidate year-end reports

**Source acquisition only. Not yet authenticated until the one-time original-source job succeeds.** Follow-up to [22 originally verified 2022 pre-election C/E reports for eleven actual serving senators](cfb-2022-served-d13-24-original-finance-source-review.md) and the [permanent source ledger](source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv).

## Why this specific cohort

The permanent 396-response official CFB viewer provenance ledger contains, for these eleven independently LRL-confirmed Minnesota state senators and the same eleven verified CFB registrations, exactly **nine original-version (amendment 0) 2021 year-end YE0.0 references** and **eleven original-version 2022 YE0.0 references**. They are *new potential PDF targets*, not evidence that twenty distinct physical PDFs have already been authenticated. Do not count a viewer reference as an independent filed/owed report proof.

The [one-time acquisition workflow](../.github/workflows/cfb-2021-22-served-yearend-originals.yml) starts with **original official SOS 2022 Senate general-result bytes**, the **original LRL official Senate service directory**, **twelve original 2022 Senate CFB district candidate rosters**, and the **permanently hashed 396-row original reports-tab API ledger**, then reuses the already reviewed strict serving-person selector from merged #1012. It refuses source substitution and rejects committee/name joins not independently matched to people who actually served, including midyear and redistricted people.

It separately requires the **two previous C/E source checkpoint ledgers**, holding all 24 earlier SD1–12 and 22 newer SD14–24 original report identifiers, so previously authenticated report identities cannot be repeated. It selects only nine 2021 original YE report references and eleven 2022 original YE report references and reopens their actual source PDFs after confirming unchanged original 2026 CFB candidate report-viewer API response SHA-256 values.

For every actually downloaded original PDF, the source workflow checks:

- Exact official CFB PDF URL, original PDF magic, binary SHA256, bounded byte length, independently observed UTC retrieval timestamp.
- Original first-page principal-campaign-committee title, registration number, Senate office, **original printed district** (either 2022 ballot district or original LRL independently verified district for that exact senator in the particular reporting year), precise period of January 1–December 31 of the report year, and original Board receipt date.
- Independent original 2022 CFB candidate disclosure calendar, with its binary SHA256 matching the [2022 source-authenticated packet](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf); it contains both **2021 year-end due January 31, 2022** and **2022 year-end due January 31, 2023**. These legal due dates are *not* automatically a historical public-by proof.
- Conservative no-earlier-than public-availability bound, using both legally due and actually filed/Board-received dates. Missing source proof, wrong year, conflicting registration/district, or missing original PDF fails closed and remains an explicit gap.

The output is strictly **metadata-only**: source URL, report ID, Senate-serving person, registration/district, hash, byte length, source acquisition UTC time, first-page covered interval, Board-received date, legally due date, conservative legal availability floor and verification state. No report body, donors, amounts, transactions, addresses, nonserving candidate names, raw SOS result counts or forecast inferences are saved.

All **20 source statuses remain unverified until a successful original-source job**, and source failures are retained rather than silently dropped. Even a successful PDF with a source-observed 2026 acquisition timestamp does **not** prove historic public-by date for a 2022 or 2023 model cutoff. No production Neon/Vercel reads/writes, manual source admission, model training, prediction serving, scheduler or 2027 activity. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) open. Track B historical active-committee and legally required filings remain null and do not block Track A.
