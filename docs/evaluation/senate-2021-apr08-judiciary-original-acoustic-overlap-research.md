# #864 — original 2021-04-08 Judiciary audio overlap gate

**Already complete, not to be repeated as a prefix-only claim:** the four genuine
Minnesota Legislative Reference Library Apr 8 2021 Senate MP3s were downloaded
**in their entirety twice**, bytes/SHA independently matching in Actions
[#38187776601](https://github.com/killjoy00/votepredict/actions/runs/38187776601)
and [#38188288307](https://github.com/killjoy00/votepredict/actions/runs/38188288307).
Permanent original hashes/durations:
[source proof](source-proof/senate-2021-apr08-four-lrl-whole-mp3-strict-second-original-sha-durations-success.json).
The old full-binary development branch is diverged from main and was incorporated
via merged PRs #1168, #1170 and #1171; do not reapply it to main.

## New, deliberately narrower source test

The two different exact original Judiciary binaries `cmte_jud_040821.mp3`
(01:50:51.037) and `cmte_jud_040821a.mp3` (01:50:51.011) differ in
full SHA and bytes, but just **0.026 seconds** in duration. The original
`cmte_jud_040821b.mp3` lasts 01:24:33.006. It is unknown if the contents
are overlapping alternative encodings, independent recordings, or excerpts.
Never assume the three suffixes represent sequential clocks.

The one-time
[source workflow](../../.github/workflows/senate-2021-apr08-judiciary-acoustic-overlap-source.yml)
uses [a reproducible source script](../../scripts/audit-senate-2021-apr08-judiciary-acoustic-overlap.mjs)
that **first reauthenticates all four complete original source MP3s** against
strict allowed URLs, 160-MiB bounds, first-64KiB pins, whole-file byte/SHA
pins and independently established durations. Only after this gate may the
three Judiciary sources be decoded to disposable mono 1kHz PCM and compared.

It searches for 36-second matching sampled speech in three source pairs
(first–a, first–b, a–b) using 1Hz and 8Hz audio RMS correlation. A positive
candidate also must pass actual decoded PCM sample correlation at millisecond
offsets. Multiple **nonidentical, separated** sample windows agreeing on one
relative time shift are required for `MULTIPLE_INDEPENDENT_SAMPLED_WINDOWS_ACOUSTICALLY_ALIGNED`.
An isolated match or lack of matches is **not** a whole-recording overlap proof
or a proof there is no common material.

The first Judiciary file has three previously independently SHA-authenticated,
but **untrusted automatic-caption cue** positions:

| First Judiciary MP3 | What the recorded source supports |
|---|---|
| 00:58:23 (3503 s) | Review the actual original speech ±1 minute |
| 01:06:44 (4004 s) | Review actual speech; NOT a roll-call timestamp |
| 01:22:23 (4943 s) | Review actual speech; NOT a Pappas motion certification |

The acoustic job checks those first-file cue windows against the **other two
original Judiciary parts**, reporting matched relative positions when supported.
These are *navigation leads*, not recognized speaker identity, spoken motion
or an authenticated roll-call result. It stores only JSON metadata (audio
hashes, timestamp candidates, correlations and explicit failure statuses).
**No raw MP3, decoded PCM, full captions, transcript, member-side lists or
private database content is uploaded.** All temporary media is deleted.

## Three amendment-specific holds

- **SF1159 Dibble:** Original [Transportation 02:16:19.357 audio](https://www.lrl.mn.gov/audio/senate/2021/cmte_fintrans_040821.mp3), no verified spoken motion or tally timecode. The original April 12 Senate Journal separately authenticates **4 YEA, 6 NAY, not adopted**.
- **SF1159 McEwen:** The *same* dated Transportation media source, a **separate amendment** with **4 YEA, 6 NAY, not adopted** reported April 12. Distinct motions must not be deduplicated.
- **SF970 Pappas:** Original [first Judiciary media](https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821.mp3), with the untrusted caption cues above; the April 12 Journal authenticates **3 YEA, 6 NAY, not adopted**. The exact spoken roll/motion is **not yet established**.

The authenticated Judiciary/Transportation LRL hearing archive dates and
original Senate bill committee logs are **2021-04-08**. The original Journal
*reported* the three motions **2021-04-12**. Committee bill-action day,
document report day, acoustic recording overlap, and individual **amendment
roll-call event day** are separate evidentiary claims. None of the audio
hashes/durations or sampled waveform similarities prove the last claim.
All **three `occurred_on=null`** pending authenticated original spoken
motion **and its vote disposition** or equally definitive dated minutes.
Historical original-public-by remains unknown; no same-day forecast usage,
even after a hearing is proved (next-day only).

No Neon/production reads or writes, member_vote imports, models/forecasts,
scheduler, Senate floor, 2027 work, or government office contact.
**Issue #864 stays OPEN.** A green PR CI is insufficient to certify source
acquisition. Inspect the independent *post-merge* original-source Actions run
and metadata artifact before freezing any new source result.
