# #864 — 2024 unlinked Senate minutes: 41 original caption procedural cue study

**Research scope:** the Minnesota LRL's **41 2024 Senate committee meetings with dated official media record leads but no linked electronic Minutes PDF**. The 42nd 2024 unlinked meeting, **May 16 Environment/Climate/Legacy**, has **no dated media lead** and is not represented as covered. The original 2024 printed Senate record and every possible committee motion remain outside this source-only caption scan.

## Original, independently archived inputs

Three separate prior original-source acquisition layers must all match exactly before any source-caption words may be inspected:

- Original 2024 meeting-to-media-index proof, [run #38079233118](https://github.com/killjoy00/votepredict/actions/runs/38079233118), artifact **11679701503**, JSON SHA256 `fd09197149998c792bb6c6195c59811d6b14cb4cdcd9f783055bff287035eef2`; original official hearing day, committee and mtgid IDs.
- Original 2024 official media page HTML SHA archive, [run #38081463362](https://github.com/killjoy00/votepredict/actions/runs/38081463362), artifact **11680254175**, JSON SHA256 `b32b49fcb3d85184a357fead01df1319698cd8505dfa2f562fed7e55d4f00fe0`.
- Original 2024 successful 41-page caption availability shard from [run #38103766440](https://github.com/killjoy00/votepredict/actions/runs/38103766440), artifact **11688174345** independently downloaded and SHA256 checked: ZIP `abb6130e6c9b5cdb5600453ba86ac94dc88a3bc22976e1518b084824eada1305`, decoded **42,908-byte JSON** `5bcc3c7b15d80ddfe37b34b7b2df025251f8ea9f91cf35ecfffe0fdf93402ccd`. That original shard has 41/41 source page HTML SHA matches and 41/41 caption payloads with **122,128 timestamp markers**, but the *four-year* workflow was overall FAILURE due to two unrelated 2023 source fetch errors, repaired separately. Do not rewrite its historical outcome.

| 2024 committee | Original indexed media leads without Minutes |
| --- | ---: |
| Taxes | 23 |
| State and Local Government and Veterans | 13 |
| Jobs and Economic Development | 3 |
| Energy, Utilities, Environment and Climate | 1 |
| Health and Human Services | 1 |
| **Total** | **41** |

## One-time original content review and limits

The [one-shot GitHub source job](../../.github/workflows/senate-2024-41-unlinked-caption-motion-cues.yml) downloads ONLY those three prior authenticated source artifacts and refetches their 41 original public `www.lrl.mn.gov/media/file?mtgid=` pages. Each original HTML must exactly match the prior independent HTML SHA before the allowed official caption request is attempted; the caption payload's *entire raw byte body* must independently match its previously recorded original SHA256, exact payload byte count and `data-time` marker count.

The scan searches only bounded explicit procedural phrases such as *call the roll*, *I move*, *motion prevailed*, *recommendation to pass* and *say aye*. Neither topic discussion nor HTML tag attributes qualify as a motion. It uses the **strict v2 visible-text parser** merged in [PR #1019](https://github.com/killjoy00/votepredict/pull/1019): each segment starts *after the complete HTML opening tag*, not in the middle of `data-time` markup. Only explicit parliamentary grammar qualifies; ordinary phrases such as “strategic move that positions” or “move to clean energy” do not. It groups repetitive matching phrases into **30-second × cue-category** research windows and caps the ephemeral review packet at **120 windows per hearing**, recording overflow. The ephemeral 30-day metadata artifact includes only cue category, candidate timestamp, exact nearby visible-text SHA256 and repeated-marker count. **No raw caption words, previews, full HTML, original audio/video, senator-name speaker assertions or individual YEA/NAY sides are persisted.**

**Source uncertainties are explicit:** automatically generated Senate captions may mistranscribe bills or senators, duplicate procedural descriptions, omit votes or confuse speakers. A match is not proven audio playback, exact motion text, distinct committee event, named-senator choice, final bill position, or historical public-by for forecasts. Original committee clerk minutes and contemporaneous official agenda/report should be independently cross-checked where possible. New failures cause source run failure and a precise failure queue, not a zero-vote label.

The separately verified 2025 22-meeting caption-content review and prior 2023/2024 original PDF audit are distinct. The 2021 print-only and 2022 mixed print/electronic official vote denominator remains UNKNOWN, along with complete 2021–25 Senate campaign-finance legal filings, candidate website and media-quote coverage and authorized per-row DB reconciliation. Nothing here reads/writes production or private DB, changes models/training/forecast/serving/scheduler, expands to Senate floor/2027, or contacts government offices. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
