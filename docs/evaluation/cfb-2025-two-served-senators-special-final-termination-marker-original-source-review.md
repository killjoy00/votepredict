# #864 — original 2025 Senate special-cycle final PDFs: termination designation review

**Read-only source checkpoint. Only people who actually served in the Minnesota Senate. No source-to-database or historical-forecast admission.**

The [October 11, 2026 UTC original-source run](https://github.com/killjoy00/votepredict/actions/runs/38102244281) re-downloaded two **previously authenticated** CFB original report PDF versions and confirmed byte-for-byte SHA-256/length, Board-received dates, full extracted-text hashes, original CFB API response hashes and original LRL Senate service. The implementation from [PR #992](https://github.com/killjoy00/votepredict/pull/992) merged only after this exact-head source run and [full CI](https://github.com/killjoy00/votepredict/actions/runs/38102244225) passed.

| Actual served senator | Original report identity | Original binary SHA-256 | Re-observed UTC | Board received | Lexical evidence |
|---|---|---|---|---|---|
| Michael Holmstrom Jr, District 29 | `19229:25:pcc:YE:1:0` | `0cecaf71ada09c3cb7d12dd439438dc432c7998159250b7c62e85bfdb0e383b2` | **2026-10-11 01:34:30Z** | 2025-11-26 | 3 termination-related word occurrences (text offsets 830, 1550, 8522) |
| Amanda Hemmingsen-Jaeger, District 47 | `19233:25:pcc:YE:1:0` | `e96a87e4bd9d0583382ae2345fd597e7c8d6db7f919c91797516c975b1ca4ab1` | **2026-10-11 01:34:32Z** | 2025-11-20 | 3 termination-related word occurrences (offsets 834, 1558, 10883) |

The search returned **no explicit report-type declaration `Termination Report` in the first 6,500 extracted text characters** for either report. Termination-related words appear in generic report instructions or wording and DO NOT establish whether the final-report *selection* was checked. The result is neither proof of a termination nor proof of the absence of a termination. There is **no independently verified selected checkbox or original Board termination notice for either committee**.

## Why this distinction is required

The separate [original 2025 SD29 CFB disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf) and [SD47 disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf) expressly state that a 2025 ordinary year-end filing is required **unless the special-election cycle-final report is a termination report**. The independently authenticated original ordinary 2025 year-end reports cover **November 20–December 31, 2025**, and have receipt dates in January and February 2026; neither their presence nor the 2026 current registry absence of a termination date supplies independent historical confirmation about a November 2025 special-cycle final designation.

Under [2025 Minnesota Statutes §10A.243](https://www.revisor.mn.gov/statutes/2025/cite/10A.243), a principal campaign committee may terminate after disposing of assets in excess of $100 **by filing a final report explicitly identified as a termination report**. This inquiry has not independently read graphical checkbox selection nor a historic original CFB Board registration-termination notice. Hence **the condition remains unresolved for both**, and the person-specific legally owed year-end counts are still **`null`**, not automatically 0, 1 or 2.

## Evidence dating and provenance permanence

This checkpoint permanently retains [original archive metadata](source-proof/cfb-2025-two-served-special-final-termination-marker-original-source-checkpoint.json) and the [canonical two-row PDF identifier ledger](source-proof/cfb-2025-two-served-special-final-termination-marker-original-psv.psv), which is **474 bytes** (excluding its one final newline), SHA-256 `108730ea3e3aaac8deb3829f5acd4f39d1d59c5795551155454d6a31c555b95a`.

The original source run's ZIP (artifact **11687644644**) has SHA-256 `b4b84746952ca3853ea673fda2301cc85d4f42e2db5160f44245eb694ed32b55`; the exact **7,180-byte** original metadata JSON has SHA-256 `f7dab9154a7423d7b8abbd04a3c8e041a678d0d0d9b88fe6bc841cc93dacfc74`. The artifact is retained only temporarily, while this source metadata and its regression tests are permanent. These timestamps are **2026 acquisitions**, not independently proved historical public-by dates. No original PDF bodies, financial amounts, donors, transaction text, treasurer contact or unserved candidate names were retained.

**Next source acquisition:** visually or through authenticated original PDF form fields determine affirmative/negative termination selection; seek a dated original Board termination notice or historical registered-lifecycle record; potentially cross-check only independently unambiguous cash/asset threshold evidence. Do not infer legally required filing counts from 2026 current list or generic PDF text. Statewide 2021–25 committee and legal filing denominators remain `null`. Historic public-by proofs remain **0**. No Neon/Vercel production, model, retraining, scheduler, serving or 2027 changes. **Keep #864 open**.
