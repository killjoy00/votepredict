# Issue #864 — 9 original 2023–24 Senate committee roll-call PDFs: corrected source closeout

All **nine** original, independently SHA-pinned electronic Minnesota Senate committee Minutes PDFs identified by the no-label audit [#913](https://github.com/killjoy00/votepredict/pull/913) were re-fetched again. The original-document and embedded-text SHA-256 values matched the original source archive [run #38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841), zero drift/errors. The one-time [corrected run #38084229868](https://github.com/killjoy00/votepredict/actions/runs/38084229868) completed successfully in both source-only jobs after PR [#923](https://github.com/killjoy00/votepredict/pull/923) fixed literal lowercase `absent` status recognition in the offline (non-ingesting) parser [#915](https://github.com/killjoy00/votepredict/pull/915).

| Cohort | Original PDFs | Exact named/tally-matched candidate blocks | Named YEA/NAY source entries | Separate Pass/Absent nonvotes |
| --- | ---: | ---: | ---: | ---: |
| 2023 Senate Elections | 7 | 10 | 133 | 7 |
| 2024 Senate Rules / Ethical Conduct | 2 | 2 | 14 | 0 |
| **Total** | **9** | **12** | **147** | **7** |

No source names, PDF bodies, full text, or plaintext choice lists were checked into GitHub. Prior original archive ZIPs and precise *rerun artifact* ZIP/JSON SHA-256s, original PDF/text SHA hashes, indexed official hearing dates and exact offsets for all twelve provisional source vote blocks are pinned in [source ledger](./source-proof/senate-committee-nine-originals-corrected-roll-source-ledger.json) and [source-offset review queue](./source-proof/senate-committee-nine-tally-matched-source-action-review-queue.json), with immutable tests.

## What source-specific motions the result captures

2023 Elections original Minutes source counts by indexed date: January 17 one; February 7 **three**; February 14 **two**; February 21 one; March 2 one; March 7 one; March 14 one. All ten individual 2023 source blocks have explicit named YEA/NAY directions whose counts now match a source-reported numeric tally after separately excluding absentee/Pass statuses. All ten remain **provisional source blocks**, not ten accepted additional votes.

The official Senate [February 7 published hearing minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17523&ls=93) contain distinct action passages for the A36/Oral amendment context (6 YEA / 8 NAY), A35 amendment (6/8) and SF3 committee recommendation (8/6). The source alternates between 'Oral Amendment' and 'A36 Amendment' for the first action; exact amendment label is *not settled*. The [February 14 published hearing minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17600&ls=93) separate SF1515 and SF1507 recommendations (both 8/5), and show Senator Anderson as absent, **not** a named YEA or NAY. Matching numeric tallies across two bills or two amendment passages must not collapse them into one motion.

2024 Rules and Administration February 20 contains an explicitly named **4 YEA / 6 NAY** roll on an A2 amendment to **Committee Resolution CR008**, not a Senate bill final-passage position. Its source also spells Rest's first name differently in the attendance and vote columns, requiring official roster normalization before permanent member identity claims. 2024 Rules and Administration Subcommittee on Ethical Conduct May 7 contains an explicitly named **0 YEA / 4 NAY** vote on a motion about an ethics complaint; that motion is procedural/ethics, not policy bill stance. See the respective [official Rules PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/rules/20240220/Rules_20240220_Minutes.pdf) and [official Ethical Conduct PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/rulesethical/20240507/rulesethical_20240507_Minutes.pdf).

## Gating work

The offline named-source parser demonstrates **mechanically reproducible explicitly attributed choices and agreement with numeric source tallies**. It does **not** alone establish exact historical senator membership, whether source motion labels are unambiguous, all original action duplicates, or historical public-by timing and row equality against the private evidence database. No source candidates were promoted to production. Original Senate committee vote is distinct from Senate floor passage vote. The official 2021 printed Minutes archives, possible 2022 print/electronic discrepancies, 141 linked-Minutes gaps, 138 alternative media-record playback and complete 2021–25 official vote denominator remain unresolved. Do not extrapolate this cohort into an all-vote completeness claim.

**No production/private DB reads or writes, models, predictions, training, serving, scheduler, 2027 pipeline changes or office contact. Keep #864 OPEN.**
