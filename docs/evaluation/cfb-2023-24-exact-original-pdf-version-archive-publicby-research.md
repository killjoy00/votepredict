# Original CFB 2023/24 report version — Wayback exact historical public-by feasibility pilot

**Issue #864, public source only, October 11, 2026.** Investigated whether a historical Internet Archive capture can independently prove a specific official Minnesota Campaign Finance and Public Disclosure Board 2023/24 **year-end report PDF version** was publicly accessible by a precise as-of date.

A candidate viewer page captured in 2024 or 2025 is **not** proof that the archived webpage exposed the exact PDF and amendment now in the CFB's 2026 official viewer. Neither today's CFB PDF response, its Board-printed receipt day nor statutory due+8AM public release floor proves when the specific historic PDF became public. A credible contemporaneous public-by observation requires: archived URL with **exact** CFB registration/year/period/segment/amendment identity, actual **archived binary PDF bytes**, archived PDF **SHA256 identical** to an independently authenticated original CFB body, authenticated original source identity (no hold), and a capture timestamp **after** the original 8AM Central release gate and any later receipt-date uncertainty. The [fail-closed evidence class and original version tests](../src/evidence/cfb-2023-24-archived-pdf-publicby-proof.ts) enforce this.

## Original four bounded version probes

Our original source authenticated **71** 2023/24 version references in the 22-person verified Senate panel. Instead of making 71 low-yield archive calls, the research examined these four **exact PDF viewer-version URLs**:

| Original version ID | Existing CFB original source status | Wayback exact CDX result |
| --- | --- | --- |
| `18430:23:pcc:YE:0:0` Putnam original | Original authentic PDF | Valid CDX response `[]`; no exact captured PDF found |
| `18430:23:pcc:YE:0:1` Putnam amendment #1 | **HOLD** first-page committee registration unverified | Valid CDX `[]`; hold unchanged |
| `17919:23:pcc:YE:0:0` Frentz original | Original authentic PDF | Valid CDX `[]`; no exact captured PDF found |
| `16964:24:pcc:YE:0:3` Housley third 2024 amendment | Original authentic amended PDF, Board receipt Oct 6 2025 | Valid CDX `[]`; no exact captured PDF found |

The original Internet Archive [CDX endpoint](https://web.archive.org/cdx/search/cdx) was accessed in the source run for **four independently constructed exact URL queries**, restricted to captures during 2024–2026 and HTTP 200 response listings. **All four returned a valid empty JSON array `[]`**, 3 bytes (`[]` followed by a newline), original response SHA256 `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570`. These were **verified valid empty responses**, not website errors. Therefore no archived PDF binaries were available via these exact CDX queries to compute/compare original source SHA. For all four pilot versions, **historical actual PDF public-by remains UNKNOWN**.

This does **not** show that the filings were legally nonpublic then, that there are no captures at other paths or URL parameter arrangements, or that the reports did not exist. The website's dynamic report viewer is also accessible by **POST** (not necessarily archived by Wayback), and CDX canonicalization, robots policies or alternative original government hostnames could yield different observations. Do not generalize the four negative exact-URL results to 71 versions.

The [per-target CDX query SHA, archive response SHA/bytes and source-run checkpoint](source-proof/cfb-2023-24-exact-original-pdf-archive-publicby-checkpoint.json) and [bounded original-source workflow](../.github/workflows/cfb-2023-24-exact-version-wayback-publicby.yml) make this pilot repeatable. Original CFB financial PDFs, donor names, archived page contents and CDX raw response were not persisted. The 2023/24 legal filing-duty denominator is still unknown, and **0/71 exact CFB report versions** has separately authenticated historical public-by evidence as a result of this research. Historic forecast eligibility stays false.

Recommended next source families: historical dated Board report listings or CFB source API/period-specific listing archives with true version IDs; archive of an **actual PDF binary** under alternate GET form/host; contemporaneous third-party mirrored **same original PDF binary** verified by matching SHA and independently dated capture. No public-by timestamp should be added without such independent evidence.

No production DB writes, model/training, forecasting, scheduler, serving, donor rows, contacts or 2027 updates. Keep **issue #864 OPEN**.
