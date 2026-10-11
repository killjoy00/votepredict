# #864 — independent strict verification of three April 12, 2021 Senate committee amendments

**Not Senate floor voting; no private VotePredict vote-row import or backfill.**

The actual [April 12, 2021 Senate Journal](https://www.senate.mn/journals/2021-2022/20210412036.pdf) is the original publication. Original PDF is **11,063,699 bytes**, SHA256 `8dd34868badade8d3d4cd77ce11c6a632705bdd99a59509a5e4d23544f2d3d75` (first authenticated [run #38169533978](https://github.com/killjoy00/votepredict/actions/runs/38169533978)). Its embedded-text SHA256 is `dda780e4fc076f56ff9f271303ba81897b69813acfece416b7741aea64c41214`.

Separate name-redacted original source-shape verification [#38170280710](https://github.com/killjoy00/votepredict/actions/runs/38170280710) established THREE distinct Rule 12.10 motion paragraphs, not two generic indexed bill votes. First-pass per-member partition SHA discovery [#38170792094](https://github.com/killjoy00/votepredict/actions/runs/38170792094), after [PR #1130](https://github.com/killjoy00/votepredict/pull/1130), independently downloaded real source artifact #11713447702 (ZIP **1,697 bytes SHA256** `65e707c163b75d3ebd99764b3bb12c1cb50e1be5f9593ff00b122c0201d11d53`; decoded provisional.json **4,548 bytes SHA256** `68931e7cb02adc11782f0cf4977336a392820d0a33ad86acc92360bd9f520ed3`) and acquired original PDF with **0 source errors**.

| Specific original committee amendment | Committee | Journal page/report date | Original text YEA / NAY / absent | Source outcome | First-pass side hashes |
|---|---|---|---|---|---|
| **SF1159 — Dibble amendment** | Transportation Finance and Policy | 2086 / 2021-04-12 | **4 / 6 / unprinted null** | **Not adopted** | Provisional YEA `5c3ccbac...`; NAY `43abc6a1...` |
| **SF1159 — McEwen amendment** | Transportation Finance and Policy | 2086 / 2021-04-12 | **4 / 6 / unprinted null** | **Not adopted** | *Identical* provisional member-side digests but DIFFERENT motion/mover and source text neighborhood |
| **SF970 — Pappas amendment** | Judiciary and Public Safety Finance and Policy | 2147 / 2021-04-12 | **3 / 6 / unprinted null** | **Not adopted** | Provisional YEA `8e209fef...`; NAY `57dbdf62...` |

The 2021 Miscellaneous Journal Rule 12.10 index has one SF1159 reference but **two distinct actual amendment motions** printed under that bill, so one indexed bill page is NOT the number of individual committee recorded motions. Equally, identical individual voting sides do not collapse the Dibble and McEwen votes; nor may SF970 Pappas's committee amendment be confused with subsequent Senate floor amendment or full-bill passage.

## Strict new original source acquisition

The separate one-time verification is authorized only after green clean-migration / npm check / production audit on the exact PR head. On merge to main, a **second independent original PDF fetch** must enforce exact official URL, HTTP/MIME/no redirect, byte cap and original byte SHA256, original extracted-text SHA256, normalized-text SHA256 and exactly three source-order Rule 12.10 motion introductions. It separately pins all **three exact movership/bill identities**, adjacent printed YES/NO counts, seven? **Ten recorded voters in each SF1159 vote and nine in SF970**, no member overlaps, printed failed-amendment outcome, original normalized motion/result offsets, local committee-report heading, original passage-context SHA256 and hash-only member-side commitments.

The official source data can pass as **three fully original-certified named rolls** only if the actual distinct second source worker **completes successfully** and its real GitHub Actions ZIP/decoded JSON independently SHA-verify. A CI-green PR or first-pass SHA probe alone is insufficient. Any failure remains a failure and is preserved in its own source artifact, not papered over.

## Open constraints

The Journal's April 12 date is a Journal **report day** and does not independently prove original committee action clock, original source first public-by cutoff, or same-day historical forecast eligibility. The absent count is not printed; **null**, not zero. The printed LRL 2021 committee minute volumes have not been independently compared. These do not certify absent/private member_vote rows, a statewide denominator, statewide completeness percentage, or production changes. No raw original PDF/HTML body, historical readable member-voting-side lists, non-committee sources, protected database queries, training, forecasts, serving, or 2027 scope. **Issue #864 remains OPEN.**
