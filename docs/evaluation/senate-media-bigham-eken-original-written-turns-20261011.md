# Track D: two separate historical written senator statements in one Bigham/Eken 2022 caucus article

**Public original-publisher article research, October 11, 2026 (America/Chicago).** The [merged original-source cohort #1212](https://github.com/killjoy00/votepredict/pull/1212) first SHA1/SHA256 authenticated two historical archive versions of this original [Jan-2022-displayed Minnesota Senate DFL caucus announcement](https://senatedfl.mn/senators-karla-bigham-and-kent-eken-named-senate-dfl-whips-for-2022-legislative-session/). It established separate nearby original issue-cue and full-name matches for **Karla Bigham** and **Kent Eken**, but did **not** yet authenticate each cue inside its own specifically attributed written quotation.

## New genuine result: two individually owned original printed quoted fragments

An independent replay and exact raw-source integrity gate now confirm that on **both** original publisher bodies a short legislative-priorities fragment appears inside a quoted statement **after the matching exact full-name attribution** within the **same historical HTML paragraph**. The evidence checker requires the phrase to occur between the pair of quotation marks that follow **`said Senator Karla Bigham`** or **`said Senator Kent Eken`**, respectively. It rejects an intervening attribution to the other senator, phrase on another paragraph or in a reporter's introduction, and non-visible script, style or template text.

The two originals each expose **seven visible content paragraphs** checked by the bounded parser. Each selected cue matches **exactly one** quoted paragraph with its own senator attribution, **zero** matching paragraphs attributed to another speaker.

- **Karla Bigham:** phrase about uniting the caucus around legislative priorities appears **88 characters after** the printed `said Senator Karla Bigham` full-name marker inside its own quoted sentence.
- **Kent Eken:** phrase about unique challenges facing rural communities appears **87 characters after** the printed `said Senator Kent Eken` marker inside his own quoted sentence.

This is stronger than the earlier page-wide phrase and senator-nearby result: **two short individual historically printed direct statement candidates are now authenticated inside their separate original publisher-attributed quotation spans**. They appear in **one article URL and two historical source versions**, **not two articles nor four different remarks**. Full human review of complete verbatim quotations, independent spoken audio and exact legislative votes remain unperformed.

## Raw original source provenance

| Original archive capture UTC | Indexed original raw SHA-1 (base32) | Downloaded raw SHA-256 | Bytes | Own attributed printed quote |
| --- | --- | --- | ---: | --- |
| `2022-03-11T19:51:03Z` | `W6T26AXVFFZJHAPPTOFAAZB6NDQWKV76` | `026e8becb82577a34cc27388faed93048a6f247991853ba3f60f1a5287268131` | 154251 | Bigham 88 / Eken 87 chars after own label |
| `2022-06-29T12:45:13Z` | `54ASOGEJRZQXKNSVI3XQKOTBVNTH4ON5` | `7a2621bdbe093c90c594af36124f53203399504758ce48c07eaec168afb9f06b` | 151424 | Bigham 88 / Eken 87 chars after own label |

Raw archive HTML was requested at each exact previously pinned `web.archive.org/web/<capture>id_/<original publisher URL>` with redirect handling set to manual, response status 200 and HTML MIME enforced, a 2.5 MB byte limit, SHA-1 recomputed against the indexed digest, plus independently pinned downloaded raw SHA-256 and bytes checked. A mismatch or unavailable original becomes **UNKNOWN** and cannot certify individual ownership.

The earliest independently verified historical original showing both bounded quoted fragments is **2022-03-11T19:51:03Z**. The modern publisher display date **2022-01-31** is not independently authenticated as the precise original-publication time. Do not backdate the selected words to January 31 or use them to forecast any earlier event. Both quotations are general 2022 Senate DFL leadership and issue-priority remarks, **not specific bill votes** or automatic forecast input.

## Reproducibility and security controls

- Original-provenance and quote-boundary code: [scripts/probe-senate-media-bigham-eken-original-written-attribution.mjs](../../scripts/probe-senate-media-bigham-eken-original-written-attribution.mjs).
- Synthetic adversarial tests: [tests/senate-media-bigham-eken-original-written-attribution.test.mjs](../../tests/senate-media-bigham-eken-original-written-attribution.test.mjs); seven cases cover wrong original source URL, changed hashes/bytes, switched senator identity, hidden markup, wrong named quote, unquoted or cross-paragraph fragment, redirects, invalid MIME and unavailable archives.
- Permanent real-body receipt tests: [tests/senate-media-bigham-eken-original-real-receipts.test.mjs](../../tests/senate-media-bigham-eken-original-real-receipts.test.mjs), which bind the actual source UTC, SHA-1, SHA-256, bytes and independent per-senator quote-boundary counts to the previously authenticated #1212 source versions.
- First successful public live source workflow [#38204122407](https://github.com/killjoy00/votepredict/actions/runs/38204122407), original research head `29437bbec9b722f1d1a9b8706e1b394d8e2bcf62`, metadata-only public artifact `11726951085`; seven synthetic adversarial tests passed. Require both **final-head live source workflow and full repository CI** before merging.
- Machine-readable only-original-verification source receipt: [senate-media-bigham-eken-original-written-turns-20261011.json](senate-media-bigham-eken-original-written-turns-20261011.json). No original copyrighted article bytes or full quotation persisted.

## Next evidence targets

The highest leverage within the same Track D scope is bounded direct written-statement attribution for Hawj's March 2024 transportation and McEwen's April 2024 mining legislation positions, followed by exact forecast-cutoff checks against only later legislative votes (not the past hearing/testimony), plus restoring true 2022 Benson/Kunesh named MPR original audio and searching additional prospective senators' written releases. 2025 Pha/Coleman and historical 2024 Hauschild transcript/audio also remain UNKNOWN. No private VotePredict corpus has been inspected.

Net additions here: **0 new article URLs, 0 new historical archive versions, 2 individually attributed historical short written quotation fragments** within a single existing source. **Zero** human-approved complete senator quotes, independently authenticated recorded speech, or Senate roll-call votes.

No production database, ingesters, collectors, schedules, model, serving, prediction changes or private data were touched.