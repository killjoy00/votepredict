# #864 — Seven *actually served* Minnesota senators: 24 dated issue excerpt leads

This is an **original-source research audit**, not a statewide senator-year denominator, historical feature authorization, production evidence-ingest manifest, or a forecast output. It extends the six-senator / 20-excerpt audit from #982 with the four authenticated Nicole Mitchell 2022 campaign statements in #989. Never-served people are excluded from the senator-facing report.

## Authenticated short excerpt leads, with independently distinct dates

| Verified actual Senate member | Research excerpts | Historical exact-text public-by (when authenticated) | Original source class |
| --- | ---: | --- | --- |
| Nicole Mitchell (SD47, 2022 campaign) | 4 | **2022-02-01T00:55:54Z**; independently repeated 2022-11-05T16:03:01Z | Candidate-owned original archived priorities page |
| Carla Nelson (SD24, 2022 campaign) | 6 | **2022-10-06T16:15:31Z**; independently repeated 2022-10-06T16:48:45Z | Two original archived campaign pages |
| Ann Johnson Stewart (SD45, 2024 campaign) | 4 | **2024-09-04T05:28:50Z** | Candidate-owned original archived priorities page |
| Keri Heintzeman (SD6, 2025 campaign) | 3 | **2025-04-24T16:32:55Z** | Candidate-owned original archived campaign homepage |
| Michael Holmstrom Jr (SD29, 2025 campaign) | 3 | **2025-08-26T22:26:50Z**; **NOT** proven pre-primary that day | Candidate-owned original archived platform |
| Rob Kupec (SD4, 2022 questionnaire) | 2 | **Unknown**; actual publisher bytes observed **2026-10-10**, day precision | Candidate-written publisher questionnaire, **not** campaign website |
| Michael Kreun (SD32, 2022 questionnaire) | 2 | **Unknown**; actual publisher bytes observed **2026-10-10**, day precision | Candidate-written publisher questionnaire, **not** campaign website |

**The audit computes counts from individually validated excerpt records:** seven actual Senate members, **24 exact short excerpts**, **20 historically authenticated original campaign-site excerpts**, and **four publisher questionnaire excerpts observed in 2026 only**. It reopens **seven independent original archived HTML page versions** and checks **30 source-body excerpt occurrences** (12 Carla + eight Nicole + ten other served-senator excerpts).

The exact UTC acquisition times for the two 2022 Carla pages are **2026-10-11T00:32:35.786Z** and **2026-10-11T00:33:09.669Z**. For Nicole the corresponding actual UTC downloads were **2026-10-11T01:04:48.050Z** and **2026-10-11T01:04:49.147Z**. Historic replay timestamps are not author-first-posted timestamps. For the original 2024–25 site acquisitions and 2022 publisher responses, only the previously recorded **2026-10-10 day-precision observation** is preserved in the current fixed research manifests; an exact UTC acquisition instant is left explicitly **null**, not invented. All first-authored timestamps remain **null**.

The newspaper-style October 7 and 19, 2022 dates printed on the publisher questionnaires are **not independent proof that the exact currently served source responses existed in 2022**. Those four excerpts do not qualify as authenticated historical sources. Similarly, the 2025-08-26 Holmstrom Wayback capture does not establish visibility **before the same-day primary cutoff**. Even genuinely earlier historical captures are not automatically forecast-eligible: that would require a specified forecast cutoff, valid person/member and original document mapping, and separate authorization.

## Genuine original sources and the service identity gate

The pull-request audit downloads original public-source artifacts by **pinned run ID** before computing the report:

- [Minnesota LRL original Senate directory and special swearing](https://github.com/killjoy00/votepredict/actions/runs/38094976711) — original HTML SHA-256 and source observation timestamp are verified; actual service, not candidacy or winning, determines named inclusion.
- [Carla original October 2022 source pages](https://github.com/killjoy00/votepredict/actions/runs/38098726687) — independent original CDX SHA-1 digest checks and six issue excerpts on **both** pages.
- [Nicole original February and November 2022 priorities](https://github.com/killjoy00/votepredict/actions/runs/38100551887) — independent original CDX SHA-1 digest checks and four issue excerpts on **both** pages.
- [Ann/Keri/Holmstrom original 2024–25 campaign HTML](https://github.com/killjoy00/votepredict/actions/runs/38086478508) — each original SHA-256, independently pinned historical CDX digest, real original URL and exact visible excerpt rechecked in this unified audit.
- [2022 candidate-submitted publisher questionnaire source acquisition](https://github.com/killjoy00/votepredict/actions/runs/38089571113) — previously acquired original 2026 publisher responses, not an authenticated 2022 page version.

A positive run of the dedicated workflow, [audit-senate-seven-served-dated-issues.yml](../.github/workflows/audit-senate-seven-served-dated-issues.yml), requires the **real** original HTML bodies and original LRL directory/swearing records. Mock HTML with the same wording must fail SHA-256/CDX validation. The output JSON retains each named actual senator's official service identity, cycle/district, exact excerpt, conservative interpretation, source class/URL/file/hash, historical CDX digest when authenticated, original observed UTC instant **or precisely labeled day**, proven public-by/capture time **or null**, original author-first-publication **null**, source run/artifact IDs, and non-admission flags.

The offline entrypoint is [audit-senate-seven-served-dated-campaign-sources-offline.ts](../scripts/audit-senate-seven-served-dated-campaign-sources-offline.ts); it refuses absent or duplicate original input paths and existing output files. The PR action downloads sources from fixed original runs, executes the offline auditor and retains the nonproduction JSON ledger as a 30-day action artifact.

## Open gaps — why #864 remains OPEN

A source count of 24 is not a denominator and does not establish statewide coverage. Remain open: (1) official **actual senator-by-service-interval and calendar year 2021–2025** inventory (including midterm transitions and ever-served persons' losing campaigns); (2) original 2020/22 SOS **candidate filing export** with contemporaneous campaign website column, not seven-column results; (3) more original campaign platform versions for verified former/current senators, including alternate original Kupec issue-page archives with prior HTTP 503/timeout expressly **unknown**, not absent; (4) precise separate member/source-document/evidence-table reconciliation and cutoff-specific historical eligibility. No production Neon/Vercel writes, model retraining, scheduled source collectors, changed frozen evaluations or forecast serving changes occurred.
