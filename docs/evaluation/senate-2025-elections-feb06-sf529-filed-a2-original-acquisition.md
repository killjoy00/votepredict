# #864 — 2025-02-06 Elections SF529: original filed A2 amendment acquisition

**Source-only follow-up; no vote import, no new denominator.**

The [original February 6 Elections minutes](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_Minutes.pdf) were previously SHA-verified: exact PDF SHA256 \`054c81c01271e8ef6513f57c29e95cbdb4f3984a8b0676effe6a83f0f812469d\`, exact extracted text SHA256 \`99301546122e3bdb2013302b384e4dd3c2bb15d66056efb1888c66c541758750\`, original source run [#38098600457](https://github.com/killjoy00/votepredict/actions/runs/38098600457). Its [motion-context review](senate-2025-elections-feb06-five-roll-motion-context.md) distinguishes (1) Lucero's *oral* A2 text insertion motion at offset **1991**, failed **5–6**, from (2) Mathews's subsequently recorded **A2** amendment motion at offset **2250**, also failed **5–6** with identical printed individual sides. **The two printed original motion paragraphs do not independently prove two distinct certified vote events.**

The [official Minnesota Legislative Reference Library Elections index](https://www.lrl.mn.gov/minutes/comm?commid=10073-0&year=2025) separately lists **\`sf0529-a2-amendment\`** as a document for the actual **February 6, 2025** meeting and links an exact original source file:

**\`https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_SF0529-A2-Amendment.pdf\`**

This filed A2 document may help determine the actual amendment text/version and distinguish it from the separately described *oral* insertion. A filename, listed attachment, or author's name does **not** independently verify the Mathews mover, adoption/failure, individual sides, or whether the roll was repeated in the published minutes.

## One-time genuine original-byte source proof

The [one-time acquisition workflow](../../.github/workflows/senate-2025-elections-feb06-filed-a2-original.yml) retrieves ONLY that exact original URL on first introduction to main. The [bounded source guard](../../src/evidence/senate-2025-elections-feb06-filed-a2-original-source.ts) enforces the exact requested and final URL (no redirect), HTTP 200, PDF MIME, PDF header and EOF, streaming maximum 5,000,000 bytes, and independent Node SHA256/byte count. Synthetic regression tests cover alternate URLs, redirected replies, invalid MIME/status, malformed/fake PDF magic, too-small/too-large sources and missing EOF.

The one-time Actions artifact deliberately contains **the true original filed-amendment PDF bytes plus metadata JSON** for independent re-download, PDF render/visual inspection and separate SHA256 checks of (a) original PDF, (b) uncompressed original JSON and (c) returned artifact ZIP. The original PDF is a public *amendment document*, not any senator-by-side roll list. It will **NOT be committed** to the Git repository. The original paper/replay timestamp and historical-public-by of the filed document are not inferred from hearing date, retrieval or filename.

**Do not call the source byte-authenticated until the real original workflow has run, and its actual artifact ZIP, PDF and JSON are independently downloaded and SHA256 verified.** A workflow/checkpoint alone is not an authenticated source. If original access or contents fail, retain a dated failure/hold; do not change URL to a similarly named modern document or relax MIME/redirect safety.

**Additional distinct motion acceptance gates**: compare original filed A2 text with both original SF529 motion descriptions and the actual time-localized [February 6 Senate hearing media](https://www.lrl.mn.gov/minutes/comm?commid=10073-0&year=2025) where available. Preserve separately original document (filed) identity, oral amendment wording, motion identity, mover, named member sides, attendance, distinctness, repeated printed votes and independent media confirmation. Do not silently combine Mathews/Lucero or count all five February 6 printed roll paragraphs as a certified denominator.

Official-minutes action available-on uses actual **February 6, 2025** per project convention, with same-day forecast cutoff excluded absent independently known motion time; first observed original filed-document retrieval in 2026 is **not** proof of a specific first-public-by timestamp.

No production/private database, member_vote import, training, models, serving, forecasts, scheduler, Senate floor, 2027 or government-office outreach. Statewide 2021–2025 committee denominator remains UNKNOWN, including 2021 print-only and 2022 print/electronic provenance holds. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) remains OPEN.
