# Senate evidence coverage and vote-to-text reconciliation

The bounded coverage pass is complete. It reconciles the retained official vote population, repairs an audit source-classification defect, and supplies a reproducible senator × session × issue map plus a 24-cell timing investigation queue. It does **not** complete cumulative amended bill reconstruction or add newly authenticated source observations. No production rows, model weights, frozen experiments, forecast probabilities, scheduler or Vercel settings were changed.

Snapshot: **October 29, 2026, 4:12:06 p.m. Central / 21:12:06 UTC**. All six queries ran in one independently checked `REPEATABLE READ READ ONLY` transaction with a 30-second per-statement limit and explicit `ROLLBACK`. The final combined read succeeded in approximately 13 seconds. An earlier correlated query exceeded its limit and returned no audit; preaggregating the first proof-qualified observation removed that repeated scan. No timeout or timing-proof requirement was relaxed in the final query.

## Current vote-to-text reconciliation

| Session | Journal events | Journal member choices | Committee events | Committee member choices |
|---|---:|---:|---:|---:|
| 2021–22 | 444 | 29,241 | 40 | 270 |
| 2023–24 | 1,100 | 71,644 | 128 | 1,141 |
| 2025–26 | 591 | 38,711 | 53 | 539 |
| Total | **2,135** | **139,596** | **221** | **1,950** |

The **2,356 accepted events** reconcile exactly. No unresolved, wrong-session, wrong-chamber or out-of-term membership assignment was observed among their member choices under the retained membership dates. This is a database consistency observation, not authentication of a complete official historical universe.

The prior paper-gap audit recognized committee events through the older `rawPrepassageVotes.sourceType` field. **186** committee events have the stored `senate_committee_minutes` source kind without that field, and were classified as `other_source`. The audit now recognizes all three committee source kinds, matching migration 0037's venue distinction. This changes audit classification only; the earlier repaired serving evidence view remains unchanged.

| Exclusive Journal question stage | Events |
|---|---:|
| Exact fingerprint-valid question link | **1,354** |
| Bill unresolved | 372 |
| Same original source/day/bill, unlinked | 373 |
| Bill papers exist on other dates | 29 |
| No parsed paper for bill | 7 |
| Total | **2,135** |

Exact question coverage is **63.4% of Journal events**; using the mixed accepted population gives **57.5% of 2,356**. Neither is a full bill-text coverage rate. The prior 99-link recovery and other question repairs remain reflected in this readback; this pass added **zero** event links. The 221 committee events remain distinct: 30 unresolved bills, 116 with no parsed bill paper, 75 with papers only on other dates. They do not become missing floor links.

There are **2,445** current paper-action records, **1,556** labeled amendment, and **96** current explicit base-component relations. These populations include source-local/derived actions and cannot be subtracted from accepted vote counts. Only **35 exact-linked events** have a captured explicit base component in the gap audit. The schema certifies **zero complete assembled amended states**. Base-component relations are not necessarily distinct base texts or pre-vote observations.

The HF100 April 28, 2023 accepted pilot has six exact-linked accepted events: four amendments with base captures, one motion and one passage. The separately source-authenticated eight-action sequence includes voice/source actions outside that six-event accepted subset. Preserve its five proposals, four adopted and one rejected, original first unofficial engrossment, and source-local adoption order. Existing source-only work already includes three Port structural-pair previews and nine successor-edition wording checks (eight previously verified) across all four adopted amendments; those are not cumulative text assembly.

The prior [original fiscal amount-delta audit](../sources/senate-vote-papers-history.md#hf100-hauschild-public-safety-original-fiscal-amount-delta-audit) also identifies a specific **$500,000 second-year discrepancy**: the total appropriation increases by $5,000,000 while the successor State Patrol line increases by $5,500,000. This report does not newly reauthenticate or resolve that original-source hold. Do not make up a balancing adjustment or use a later edition to settle an ambiguous original instruction. No full composite hash, cross-day amendment completeness or pre-vote publication proof is certified here. Do not substitute the latest bill edition or use nearby bill headings to assign the 372 unresolved events. See [#1498](https://github.com/killjoy00/votepredict/issues/1498) for the separately proved question batches and remaining original-source holds.

## Senator × session × issue map

- [Full map: 3,280 cells](source-proof/senate-person-session-issue-coverage-20261029.csv)
- [Snapshot, independent denominators, issue summaries and gap stages](source-proof/senate-forecast-coverage-20261029.json)
- [Bounded timing priority queue: 24 cells](source-proof/senate-coverage-timing-priority-20261029.csv)

The map includes every retained Senate membership in the three sessions: **67 + 68 + 70 = 205 membership/session rows**, each crossed with 15 broad issue families and one `unmapped_issue` category. Public legislator keys bind the stable person across sessions; district and membership session remain separate. Each cell reports recorded Journal member events, binary choices, retained website copies, distinct literal texts, proof-qualified literal texts, retained issue-context texts, and member events with at least one earlier proof-qualified website observation for the same mapped broad issue.

**How to read it:**

- Issue tags come from the union of retained `bill-features-v2` / `deterministic-v2.1` bill-version policy areas. They are descriptive indexing recorded today, **not historically available features**. Multiple issue tags overlap; summing cells across issues double-counts events. An omnibus bill's tag does not establish an individual amendment's topic or a statement's exact applicability.
- Website text uses the existing literal/archive/person research contract. It never requires a sincerity judgment or treats campaign text as a legislative vote. Only JSON boolean proof flags, matching archived clocks, source digest, CDX identity and the literal excerpt qualify. Admission grants research use only.
- A date-only vote uses **midnight UTC at the start of its date**. Same-day observations are excluded. Stable-person evidence can originate from another session's membership; qualification depends on the actual observation time, never that membership label. Bill-specific evidence must match the target bill. Distinct source copies of one literal do not multiply the number of covered member events.
- Retained literal/context counts describe the person's corpus and intentionally repeat across that person's session rows. They include later observations; only the event-specific pre-vote column applies a historical cutoff. Do not sum those repeated inventory counts to estimate corpus size.
- **162 narrower/unmatched website labels covering 372 retained copies** are explicitly listed in the JSON and retained in `unmapped_issue`. That category never produces a claimed same-issue pre-vote match. A zero in a mapped family may therefore reflect unmapped narrower text; inspect those labels before commissioning collection.
- Zero means no qualifying observation in this bounded join. It means **unknown**, not opposition, absence of a historical statement, an authenticated collection failure, or permission to fill a model feature with zero.
- Finance, media, the frozen v1.8 92 directional rows and the separate historical-quality 37-feature matrix are outside this map's admission lanes. It is not a replacement audit of those sources and does not change their freezes or permitted use. The entire-Journal denominator differs from the frozen evaluation target population.

| Broad issue | 2021–22 memberships with any earlier qualified website text at a retained mapped Journal event | 2023–24 | 2025–26 |
|---|---:|---:|---:|
| Elections | 2 / 67 | 9 / 68 | 9 / 70 |
| Local government | 2 / 67 | 5 / 68 | 5 / 70 |
| Housing | 5 / 67 | 15 / 68 | 15 / 70 |
| Judiciary / civil law | 8 / 67 | 13 / 68 | 13 / 70 |
| Agriculture | 10 / 67 | 10 / 68 | 10 / 70 |
| Education | 22 / 67 | 41 / 68 | 44 / 70 |

These ratios use the full retained membership denominator; they are descriptive reach, not issue-specific collection success rates. A person without a mapped recorded vote has no evaluation opportunity in that cell. The full map supplies those opportunity counts. Across mapped issues, **37 / 67**, **56 / 68**, and **60 / 70** memberships have at least one such pre-vote observation. These are website research opportunities, **not newly added directional feature rows**.

## Bounded next-source decisions

The 24-cell queue focuses on 2021–22 memberships with an existing mapped literal and a recorded issue opportunity but zero qualifying earlier observations. It takes at most two cells per issue, visiting issues with the lowest observed member reach first; within an issue it uses recorded opportunities, with stable public-key tie breaks. This prevents broad omnibus tags from consuming the entire queue. Examples include Paul Utke and Erin Murphy on elections, Jennifer McEwen and Jim Abeler on local government, and Aric Putnam and Jennifer McEwen on housing.

For a selected cell, inspect its existing exact original page/version and observation ledger first. A successful addition requires an authenticated observation **before a specific target vote**, bound to the literal and stable person. If the only retained capture is later, keep the row held; no earlier capture is presumed to exist. Newly mapped narrower labels require a reviewed explicit crosswalk and rerun, not automatic semantic matching. The queue is a finite investigation shortlist, not 24 promised recoveries or authorization for another broad archive sweep.

For vote-to-text, retain the 781 unresolved Journal question stages above as explicit exclusions. Exact original question/source/full-ballot uniqueness remains mandatory. Further HF100 full-text work must first resolve the documented second-year amount discrepancy from an explicit original adjustment or hold it, then finish cumulative predecessor application and a reproducible final hash. Existing isolated cross-line previews are retained, not repeated as new discoveries. Historical public availability remains a separate proof gate. The remaining structural question-ownership holds in #1498 do not become bill associations through this map.

Baseline modeling can proceed within its existing approved inputs. Testing incremental website effects can select a deliberately frozen cohort from the mapped research opportunities, with strict cutoff and held-out evaluation. This report does not train, start forecasts, or assert that additional evidence improves predictions.

## Reproduction and verification

`scripts/audit-senate-forecast-coverage.ts` reads an existing explicitly supplied database connection, establishes a repeatable-read/read-only transaction, performs six static bounded queries, verifies every event/session/kind against the independent paper-coverage view, checks complete roster/issue cells and subset counts, and explicitly rolls back before writing artifacts. It can also validate a connector aggregate readback whose transaction/rollback receipt was independently observed. `--print-queries` emits the same static query bundle for that connector path. No credential discovery, write, crawler or dispatch occurs in this command.

The JSON binds query-bundle and aggregate-readback SHA256 values and the full CSV SHA256. These artifacts preserve the returned descriptive snapshot, not an independently restorable database snapshot or a new forecast input manifest. A later rerun can change as retained sources evolve; freeze any actual evaluation inputs separately under the existing evidence-access contract.

Validation covers incomplete roster/issue populations, duplicate identities, invalid subset counts, a PostgreSQL fixture with committee isolation, unresolved membership, stable-person access, overlapping issues, bill mismatch, duplicate literals, same-day exclusion, unmapped labels, and SQL/reader proof equivalence including string-valued boolean holds. The repository CI supplies disposable PostgreSQL 18 for the integration case. Local typechecking and unit checks passed; exact-head CI is required before merge.
