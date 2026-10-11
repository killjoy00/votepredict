# PUBLIC 25-page original media discovery → historical archive evidence bridge

**Track D #987/#946. Research only, public original publisher pages and public Wayback HTTP bodies.** No private VotePredict source documents, production media seeds, member vote data, models or training. Work on the [previously merged 25-page source-discovery list](senate-media-2021-25-public-broader-source-discovery.json) (five displayed-publisher-year pages each for 2021–2025).

## What connects now, and what cannot be concluded

The old selected 31 MPR/Reformer pages, 18 Senate caucus/interview original-page leads and these **25 new exact publisher URLs** are distinct *curated samples*, not a complete Minnesota senator-year news census. The previous 18-source original replay work recovered 24 exact historical HTML versions across 13 URLs; the separate original HTML phrase audit rechecked six of them, finding six of seven short cues. The **25 newer URLs have not yet been historically verified at all** in that prior work.

The [bounded 25-URL public Wayback tool](../../src/evidence/senate-media-broader-original-wayback.ts) and [metadata-only action](../../.github/workflows/senate-media-25-original-wayback.yml) now bridge this gap. They do not amend the original 31/18 sample workflows or any application evidence tables.

### One exact public original URL → one bounded index → optional original body SHA

- Require **exactly 25 ledger leads** with **five per displayed year**, two named/counted speaker-labels only on the original 2022 Bigham/Eken page, explicit holds for three unlabeled/mixed-chamber collective statements, official legislator-history URLs, publisher domain pairings and all negative historic-proof flags unchanged.
- Restrict original URLs to **HTTPS senatedfl.mn, www.mnsenaterepublicans.com, minnesotareformer.com**. No redirect following, query parameters, userinfo or external host aliases. Never ingest discovered links from webpage HTML.
- For each selected URL, make exactly one **2021–2025 CDX index exact-match request**, up to **20 dated entries** and **100KB** response (do not collapse same-digest distinct capture times), then at most **two earliest exact timestamped raw `id_` Wayback replays**, each up to **2.5MB** with HTTP timeout and concurrency limits.
- Reject mismatched original URL/index response status/MIME/digest, redirects, denied archives, too-short/oversized responses, changed SHA-1 replay payload or any other uncertainty. Only an actual **byte-for-byte CDX indexed SHA-1 consistent original HTTP body** produces an observed *raw original* SHA-256, body byte length and original archived capture UTC.
- Output a **metadata-only seven-day research artifact** with all **25** index statuses, up to two capture replay statuses and original SHA receipts; never upload full archived HTML/audio, private data, senator quote paragraphs, or any allegedly verified votes. Persist real SHA manifests in a separate review step once exact public workflow run and artifact are inspected.

The priority pilot focuses on **Karla Bigham and Kent Eken's January 31, 2022 separately labeled Senate DFL release; Ann Rest's April 26, 2023 independent Minnesota Reformer reporting; Patricia Torres Ray's November 2021 statement; Jen McEwen's 2024 page; and Doron Clark's 2025 page**. The PR branch workflow uses **all 25** and two replay attempts to produce broad selected sample coverage, while an owner can dispatch the pilot/full research on main.

### Quote-specific review gate after original SHA verification

Current publisher material confirms the January 31, 2022 Senate DFL page presents distinct quotation paragraphs attributed to **Sen. Karla Bigham** and **Sen. Kent Eken**. That is **two speaker turns in one publisher article**, not a collective quotation and not two source documents. Original *Minnesota Reformer* April 26, 2023 reporting by Michelle Griffith quotes **Sen. Ann Rest** directly multiple times; **Sen. Matt Klein is named in a photo caption** and other state legislators are contextual persons, not automatically separate quoted senators. Rest's reported expectation about caucus support is a **reported quotation**, not proof that a recorded roll call actually occurred or that all colleagues voted that way.

Once original archived SHA receipts are obtained: request the **exact successful archived original URLs**, re-check their actual raw body SHA-256 and CDX indexed SHA-1, then check **short minimal phrases** separately under each original and named speaker. A text presence result is narrower than actual audio authentication or independent human speaker approval. Do not backdate any currently visible page phrase to its displayed publication date merely because a later Wayback original version contains that phrase.

**Three collective holds remain absolute even if their archived HTML is recovered**: 2023 Senate-and-House Blandin strike statement, 2024 Senate-and-House Inclusive Democracy Caucus statement, and the unassigned 2025 Senate Republican caucus release. An archived group statement never becomes an independently spoken statement by each listed member.

No statewide denominator can be calculated from either these 25 new leads or 31+18 earlier selected sources; missing/denied CDX results are **unknown historical original retrievals**, not missing historical articles or missing senator statements.

Run the public-only probe on a local checkout:

    node --import tsx scripts/probe-senate-media-25-original-wayback.ts --scope all --replay-count 2 --output artifacts/senate-media-25-original-public-proof.json

Required quality gate: exact final PR-head full CI (clean migrations, tests, typecheck, build, production dependency audit), actual public archive workflow success, independent public metadata-artifact verification and durable historical receipt before squash merge. Keep public research issues #987 and #946 open and owner-closed #912 closed.
