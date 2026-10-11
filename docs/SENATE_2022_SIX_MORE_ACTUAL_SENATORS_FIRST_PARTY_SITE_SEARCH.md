# #864 — six MORE actually-serving MN senators: original 2022 candidate-site archives, not mutable 2026 copy

Now that [109 exact issues](SENATE_2020_22_ARCHIVE_CAPTURE_DATE_ATTRIBUTABLE_109_ISSUE_EXCERPTS.md) from the preceding twelve-person serving Senate cohort are independently attributed to their **original historical archive capture UTC**, expand original page discovery to another **six ACTUALLY SERVED Minnesota State senators**.

The original author-post timestamp is **not required**: the earliest original full archived webpage containing candidate-owned text and matching independent Wayback CDX SHA-1 is a genuine **public-by timestamp** for that original statement. A page that no longer exists in its 2026 version can still have perfectly authentic dated historical original HTML. A modern page *alone* is not historical evidence. Candidate-owned issue passages must still be separately exact-byte verified after a site replay is found.

## Specific six new senator persons with original 2022 domain leads

| Actual serving senator during 2023–24 | 2022 election district | Candidate-owned discovery domain (URL is a LEAD, not yet verified 2022 original) |
| --- | ---: | --- |
| John Marty | 40 | https://www.johnmarty.org/issues |
| Lindsey Port | 55 | https://www.lindseyportmn.com/priorities |
| Erin Murphy | 64 | https://www.murphyfor64.com/vision |
| Susan Pha | 38 | https://susanphaforsenate.com/ |
| Omar Fateh | 62 | https://www.omarfateh.org/vote (historical candidate campaign domain corroborated in archived public government Senate ethics records) |
| John Hoffman | 34 | http://johnhoffmanforsenate.com/ |

These domain discoveries DO NOT certify any domain as a 2022 original SOS candidate-filing campaign website. The original government official [Senate served person directory](https://www.lrl.mn.gov/legdb/senate_dir) has previously been independently acquired as public original HTML in [LRL source run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact **11685387674**. The new source runner must rehash that **exact original HTML** against its actual UTC original source receipt and independently verify **ALL SIX full person identities and their subsequent actual Senate service** before even the first Wayback network request. No assumption that being a candidate or being on a ballot qualifies as a legislator, and no exclusion merely because their district was redrawn.

## One-shot original historical acquisition limits and meaning

The [six-person fixed target fixture](../data/evaluation/senate-six-additional-served-2022-campaign-archive-domain-leads-v1.json) and [one-shot acquisition code](../scripts/acquire-six-more-actual-senator-2022-campaign-originals.ts) allow exactly six domain-wide real Wayback CDX searches, original captures **Jan 1 – Nov 7, 2022**, at most **300** source archive index rows for each, plus up to **four** actual original archived HTML replays per person (**24 maximum**). Candidate-owned issue/platform/vision/priorities page paths rank ahead of homepage and miscellaneous site links, but the bound is still **not a census**. Any HTTP 503/timeout, empty index, missing body, nonmatching original CDX payload SHA-1 or later revision is recorded honestly as an actual observed failure/unknown history, never as absence of campaign policy.

Original HTML is admitted only if it is actual HTTP 200, safe host/path, matched original date window, SHA-256 accounted and **matches the separate historic CDX SHA-1 Base32 digest**. The acquired ZIP and source manifest preserve immutable original HTML for 30 days, their actual retrieval UTC and original historical capture UTC **separately**. After successful acquisition, quote/source reconciliation should pin selected original URLs, capture dates, page hashes, exact issue text and policy category to the durable per-page receipt ledger, just as done in [#1016](https://github.com/killjoy00/votepredict/pull/1016) and [#1024](https://github.com/killjoy00/votepredict/pull/1024). **No separately verified quotes are asserted in this acquisition-only source tranche.**

## Important boundaries

No live 2026 candidate page is treated as a historical 2022 political position; prior-cycle copy still found during 2022 will retain that context even when its public-by date is independently certified. No official roll-call votes are inferred from candidate slogans or claimed accomplishments. No source automatically joins membership UUIDs, writes issue evidence, enters historical model features or modifies evaluations. No production Neon or Vercel, private DB reads/writes, scheduler, contact with public offices, model training or forecast changes. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) remains OPEN because source and production universe parity still require work.
