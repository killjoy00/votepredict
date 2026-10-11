# #864 — original source-bound caption availability for all 138 indexed Senate media leads (two-run proof)

**All 138 original dated official LRL media record HTML pages were independently SHA-reverified across TWO separately recorded source runs.** This is **not** 138 verified audio/video playbacks, named committee motions or member votes. This source-availability evidence pertains only to electronic Senate 2022–2025 indexed hearing dates without Minutes links; 2021 printed official Senate minutes and complete 2022 print/electronic parity remain unknown.

Original full [run #38103766440](https://github.com/killjoy00/votepredict/actions/runs/38103766440) **FAILED** because two 2023 Taxes original source pages could not be downloaded. Its separate [permanent original first-run ledger](./source-proof/senate-committee-138-original-caption-surface-first-run-ledger.json) faithfully retains 136/138 source HTML SHA checks, 129 timed-caption response pages and its nine source holds.

The exact targeted [source retry #38104325591](https://github.com/killjoy00/votepredict/actions/runs/38104325591) **SUCCEEDED**, re-fetching **only the two original prior-failed official records** with separately pinned original hearing/date/committee/record URL and HTML SHA:
- 2023-01-12 Taxes record `1046920`, 1,612 timestamp markers from an original caption payload.
- 2023-02-08 Taxes record `1047266`, 3,233 timestamp markers from an original caption payload.

Its original artifact **11688688635** was independently downloaded and checked: ZIP SHA256 **514c359aeb5c5743ec6538137d9359fe1a82bba186a14eccc2efdedc5ecbc588**, uncompressed 2,704-byte JSON SHA256 **4c4564531edd35c1c14cf1cc08defc62e107516c1cd371dfd1b9b6e428eeff4e**. Both source HTML SHA256 and actual caption-response body SHA256 are permanently preserved in [combined source proof](./source-proof/senate-committee-138-caption-combined-successful-original-source-proof.json), with fail-closed [regression](../../tests/senate-committee-138-combined-caption-original-source-proof.test.ts).

| Official hearing year | Exact indexed media leads | Original record HTML SHA reverified across both runs | Pages returning timed caption markup | Lacking timed caption markup |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 11 | 11 | 10 | 1 |
| 2023 | 64 | 64 | 58 | 6 |
| 2024 | 41 | 41 | 41 | 0 |
| 2025 | 22 | 22 | 22 | 0 |
| **Total** | **138** | **138** | **131** | **7** |

The seven remaining **caption-availability holds** are:
- 2022-03-15 Housing Finance and Policy, record `1046040`: safe caption HTML body but zero timed rows.
- 2023-01-10 Taxes, `1046896`: same zero-timed-row result.
- Five 2023 audio-only original pages with no safe `showcaptions` video request: Feb 21 Taxes `1047437`, Mar 7 Taxes `1047599`, Mar 14 Taxes `1047707`, Apr 13 Environment/Climate/Legacy `1048027`, Apr 13 Taxes `1048030`.

Across the actual source responses there were **361,175 `data-time` markers**. Those are raw generated-caption *timestamp markup* occurrences, not 361,175 spoken statements, not 131 votes, and not a distinct motion count. Original audio/video was **not actually replayed** in these actions. No original captions or media bodies, person names, recorded vote sides or sensitive source text were committed.

## Source-to-vote next gate

The next useful step is **bounded original time-localized hearing-content review**, starting with timestamped caption **cues** (candidate agenda/motion/roll-call locations) and separate actual media playback or transcript accuracy checks, followed by human senator/motion/sides adjudication where possible. Caption misspelling, speaker switches, date-granular cutoff, amendments and repeated motion descriptions must remain explicit. Never synthesize individual YEA/NAY from caption timing, party, meeting attendance, voice/unanimous or aggregate motions. No official 2021–25 vote denominator exists yet.

The cross-bucket [historical acceptance scorecard](./senate-2021-25-four-bucket-source-debt-closeout.md) also keeps campaign finance legal filer/report totals, campaign issue-website versions and independent media-quote source denominators unproven. Existing private historical evidence row equality requires separate SELECT-only authorization.

**Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.** No private/production DB access, member-vote import, Senate floor expansion, model, forecast, training, serving, scheduler, 2027 work or public-office contact.
