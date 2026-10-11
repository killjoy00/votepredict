# #864: six further actual Minnesota senators — original archived 2022 campaign pages

## Evidence question and date rule

Continue expanding campaign-issue first-party **original pages for people who actually served in Minnesota Senate**, without treating redistricted district numbers as new people. For any exact candidate-owned policy text in authenticated historical HTML, **the real Wayback original capture UTC is a sufficient attributable/public-by date**. We do not demand a first-authored timestamp. Domain/page names observed in 2026 alone never prove 2022 content, and old-cycle copy is not newly authored just because still online in 2022.

This one-shot acquisition-only PR uses [the independent original Minnesota LRL Senate-directory source](https://www.lrl.mn.gov/legdb/senate_dir) from original public [Actions run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact 11685387674. Actual original HTML SHA-256 and dated source receipt must match, and **all six people must be separately demonstrated to have served the State Senate in 2023** *before* any public archive request.

| Actual state senator | 2022 Senate district | Candidate-owned domain lead | Lead caveat |
|---|---|---|---|
| Heather Gustafson | 36 | https://voteheathergustafson.com/priorities | Current campaign website and public voter guides; historic 2022 text not yet authenticated |
| Julia Coleman | 48 | https://www.colemanforsenate.com/issues | Known incumbent Senate campaign, but current page and copyright do not establish original 2022 text |
| Zach Duckworth | 57 | https://www.voteduckworth.com/issues | Longstanding original issue page may retain previous 2020 content |
| Nick Frentz | 18 | https://www.frentzformnsenate.com/about/ | Candidate-owned historic Senate re-election site, distinguish current 2026 updates |
| Alice Mann | 50 | https://dralicemann.com/priorities/ | Candidate issue page from Senate campaign site, verify actual early original HTML |
| John Hoffman | 34 | https://www.johnhoffmanmn.com/ | **Corrected domain discovery**: prior `johnhoffmanforsenate.com` fixed-domain 2022 CDX search gave no results; 2026 SOS listed `johnhoffmanmn.com`, which is only a historical search lead |

The last item is an especially important retry: a previous *different* candidate-domain search returning zero 2022 originals should not be mistaken for absence of the senator's campaign website.

## Original archive procedure

Read [the fixed six-source fixture](../data/evaluation/senate-six-further-actual-2022-original-campaign-domain-leads-v1.json) and run [the public, source-only original acquisition](../scripts/run-six-further-actual-senator-2022-campaign-originals.ts). After all six individual actual Senate-service checks pass on original LRL HTML, query each domain's Wayback CDX for genuine originals **January 1 to November 7, 2022**, bounded to **300** archive rows per domain and **four** selected replays/domain (**24 total maximum**). Prioritize issue/platform/vision/priorities policy paths and candidate-owned main pages. Require actual original archived HTTP 200 HTML bytes and SHA-1 Base32 equality with the **independently acquired original Wayback CDX indexed payload digest**. Record original URL, precise historical UTC, original page SHA-256, original source file, dated status/error receipts, and independent 2026 original source acquisition time.

An unavailable/capped/empty CDX index or a page whose bytes fail to match its separate original index digest means **coverage unknown or original-page proof absent**, not a negative candidate position. Any still-live old-cycle policy text is date-attributable when its original archived 2022 page contains it, but the old-cycle context stays labeled so it is not misrepresented as a newly issued Senate 2022 position. Current SOS filed website attributes for the **2026** ballot are not filed-candidate campaign websites proven for **2022**.

PR-only [original-source Actions](../.github/workflows/acquire-2022-six-further-actually-served-senators-originals.yml) retain original public HTML and dated CDX/source receipts in a 30-day artifact. This source discovery does **not** individually authenticate candidate issue excerpt text; exact issue snippets should be reviewed, dated and rechecked against the actual originals in a separate statement-level ledger with official service membership.

No private database, Neon/Vercel, model training, forecasts, evidence insertion, 2027 operation, scheduled archive searches or office contact. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **open**; a sample of some true Senate member original sites is not the statewide historical denominator.
