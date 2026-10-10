# Issue #864 — Track 1: 2022 original pre-election report PDF authentication

**Parallel workstream, independent of the legally owed filing denominator.**

The original official 2022 Minnesota Senate candidate report viewer inventory identified 524 original-version 2022 financial reports (253 YE, 146 C pre-primary, 125 E pre-general). This PR chooses **exactly 12 source-pinned Senate candidate registrations, one each from districts 1–12**, with **24 original-version (amendment index zero) report references** (12 pre-primary C and 12 pre-general E). Official original reports_data API response hashes, 2022 Senate district roster HTML hashes, candidate registration IDs and Senate district numbers were previously acquired; this independent PR re-verifies their identities and retrieves the actual 24 source PDFs. There is no statewide sampling or selection bias claim: this is a small bounded source-proof cohort.

The **immutable dated original 2022 CFB candidate packet** contains a calendar specifically labeled for Senate, House and district-court candidates: https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf (PDF pages 5–6). The public current_year_senate_house_district_court.pdf URL is mutable and currently serves 2026, so it MUST NOT be used as historical 2022 proof.

Official 2022 applicable CFB candidate disclosure calendar (independently verified in the one-time source job):

| Original report category | Coverage end | Official due date | Next-day statutory nonpublic-until release floor |
|---|---|---|---|
| 2022 pre-primary C | July 18, 2022 | July 25, 2022 | July 26, 2022, 8:00 AM America/Chicago |
| 2022 pre-general E | October 24, 2022 | October 31, 2022 | November 1, 2022, 8:00 AM America/Chicago |

The original PDF's received-by-Board date may be after this legal floor. We report max(day after due, day after received) as a **conservative not-before bound only**, not proof the report was publicly available on that date. The report first-page PDF must independently match correct registration number, Senate district, principal campaign committee report category, exact original period coverage end, and parsed Board-received date. The workflow authenticates exact official CFB PDF magic, source URL, binary SHA256, byte length, original 2022 official calendar PDF hash, all without persisting the actual report text/PDF bytes or any donor/transaction details.

A CFB amendment=0 reference identifies an original VERSION of a report, **not** independent checkbox verification that a later PDF has no amendment, nor actual filing obligation, full financial row containment, or independently archived historical public-by time.

A failed fetch, identity, report-header or calendar verification fails the source workflow while preserving partial *metadata and specific failure statuses* as an artifact. It cannot promote a failed or missing PDF. There are no production Neon/Vercel reads/writes, backfills, scheduled jobs, inference/serving or model changes, 2027 changes, or contacts with offices; issue #864 remains open. Work on the 2022 original Secretary of State ballot + registration denominator proceeds in **a separate PR and workflow** so neither track blocks the other.
