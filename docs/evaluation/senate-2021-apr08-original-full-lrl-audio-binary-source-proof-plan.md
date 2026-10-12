# Issue #864 — April 8, 2021, four original Senate committee audio source-binary gate

**Scope: original public Minnesota Senate COMMITTEE recorded hearing audio, read-only source authentication.** This expands the authenticated original April 8 historical hearing audit without claiming motion-level votes, Senate floor actions, attendance or historical public-by.

## Already confirmed before a full recording download

The April 12, 2021 Senate Journal original-source proof [#38171360478](https://github.com/killjoy00/votepredict/actions/runs/38171360478) strictly authenticated **three separate Rule 12.10 committee amendment rolls**, not three whole-bill votes:

| Journal date | Committee and bill | Distinct motion | Original printed count/result |
|---|---|---|---|
| Apr 12 report | Transportation, SF1159 | **Dibble amendment** | 4 YEA / 6 NAY, not adopted |
| Apr 12 report | Transportation, SF1159 | **McEwen amendment** | 4 YEA / 6 NAY, not adopted, different motion with same first roll's named-voter sides |
| Apr 12 report | Judiciary, SF970 | **Pappas amendment** | 3 YEA / 6 NAY, not adopted |

Both independent exact-SHA 2021 Senate committee bill-log original acquisitions (initial [#38176218037](https://github.com/killjoy00/votepredict/actions/runs/38176218037); second strict [#38176684980](https://github.com/killjoy00/votepredict/actions/runs/38176684980)) date the **SF1159 and SF970 bill-level committee actions to April 8, 2021**, with earlier April 6/7 discussion-only entries. Both original April 8 LRL archived Senate media pages and three Granicus agendas were separately byte-authenticated in [#38177903789](https://github.com/killjoy00/votepredict/actions/runs/38177903789).

Three independent original Granicus MP3 leads for the day returned HTTP 403. However the next strictly independently authenticated genuine original LRL player-source [run #38178990727](https://github.com/killjoy00/votepredict/actions/runs/38178990727) (merged [#1159](https://github.com/killjoy00/votepredict/pull/1159)) acquired **four 65,536-byte initial MP3 samples** directly from [public LRL hearing recordings](https://www.lrl.mn.gov/media/), each HTTP 206, audio/mpeg, ID3 signature, distinct source SHA. Each original MP3 prefix SHA is pinned in [permanent metadata](source-proof/senate-2021-apr08-four-original-lrl-audio-prefix-access-success.json) and `src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.ts`.

## Original LRL hosted audio (four exact source URLs)

| LRL indexed 2021-04-08 hearing | Exact official original MP3 source URL | Original first 64-KiB SHA256 |
|---|---|---|
| Transportation Finance and Policy (SF1159) | [`cmte_fintrans_040821.mp3`](https://www.lrl.mn.gov/audio/senate/2021/cmte_fintrans_040821.mp3) | `8e2f01c874816f79811facc762146232f34d044a5db1cefecda4795dce04103f` |
| Judiciary and Public Safety Finance and Policy (SF970), first | [`cmte_jud_040821.mp3`](https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821.mp3) | `74b5c8c5580a805dfdebfbef803df02c0715e04075ba490983f38ec55e0b455a` |
| Judiciary, second | [`cmte_jud_040821a.mp3`](https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821a.mp3) | `0930c662d0b95ad73b661e6fd37f1549e6d64704d55d3c617ae2c3d14682f4f1` |
| Judiciary, third | [`cmte_jud_040821b.mp3`](https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821b.mp3) | `b777ba4adde388217111376ecedae4d37f353875ffa52846dbb3e67630e514d7` |

First original media-prefix Actions artifact **#11717117508** independently downloaded ZIP **1,824 bytes**, SHA256 `6033f00e19e96e6ef98831f554a536f409f1fcc4299a7536c0cbc2b6ac6ca321`; JSON `source.json` **7,875 bytes**, SHA256 `8190d67341493cfaf010fe9365276c046d155a0bd266f2c85e88a4069ad0fd1e`. These small artifact fingerprints are **not the SHA of entire MP3s**. The evidence has four **prefixes** but **zero fully original-authenticated recordings** before the new audit.

Separate exact original Judiciary first-segment LRL automatically generated captions `cmte_jud_040821.mp4` have already been independently acquired twice (strict second source [#38178393419](https://github.com/killjoy00/votepredict/actions/runs/38178393419)) as **436,144 bytes, SHA256 `6e37f661cb4ced4d33fdce7ed5af0a38cd57f9580efcf55ce5bc90e6ed92e84a`**, with three unverified **Pappas + amendment** same-caption-row review offsets at **00:58:23, 01:06:44, 01:22:23**. These auto-caption offsets remain **review leads only**; no caption row says the matched sentence is the roll-call outcome or that Pappas's specific Journal amendment occurred at that exact timestamp.

## New separate original **full** audio acquisition

The one-time [`senate-2021-apr08-four-original-lrl-full-audio-binary-proof.yml`](../../.github/workflows/senate-2021-apr08-four-original-lrl-full-audio-binary-proof.yml) runs after its initial workflow-file addition to `main` (not the PR test). It attempts exactly **four** original public full MP3 downloads, each sequentially and bounded to **160 MiB** total bytes with a per-source request deadline. It hashes every byte of the original audio file in an ephemeral GitHub Actions runner, independently requires the full download's **first 65,536 bytes match the already pinned original first-run 64-KiB SHA** and MP3 signature, and attempts a local `ffprobe` duration.

The job **deletes all four source MP3s** from the runner's temporary folder and publishes **only metadata** (full original byte count, SHA256, file duration if available, prefix identity and source-access failures). No audio/video, caption transcript, public named-voter sides or private credentials may be uploaded or committed.

**Acceptance is strict and per-file**: HTTP 403/404/timeout, partial/wrong content, oversized MP3, incomplete content-length, nonmatching original pinned 64-KiB source SHA or ffprobe duration unavailable **do not become fictitious source proof**. An original file may be marked fully byte-authenticated only after it completely downloads within the cap and matches the independent initial SHA; an unavailable duration may remain null if ffprobe is missing or fails. First original MP3 *full* SHA values and durations are unknown **until the actual separate source run and downloaded artifact are inspected**. A green PR CI alone **does not** certify original audio acquisition.

## Next actual historical committee-motion gate (not established by hashes)

Once a complete original audio recording is independently acquired and playback/timecoded, **listen to the specific amendment presentation, name of mover, motion disposition and named 4–6/3–6 committee roll** and cross-reference the separate April 12 original Journal. Only that content review (or independently acquired original dated 2021 official printed committee minutes) can warrant promotion of an individual amendment's `occurred_on` date, per the owner-selected historical day-only availability rule (next-day eligibility only, not same-day timing). The indexed hearing date, MP3 filename, audio-file SHA or an untrusted caption **alone is insufficient**.

**Out-of-scope safeguards**: no source-to-private DB row parity yet, no 2021 original print-minute official denominator, no 2022 print/electronic parity, no attendance/absent zero, no production SELECT/write, models, forecast, training, serving, scheduler, Senate floor or 2027 expansion. Absolutely no contact with the Minnesota LRL, Senate or other office for records. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) remains **OPEN**.

## Completed **first whole-original** source proof — October 11, 2026 (UTC run October 12)

The independent actual [original full binary Actions run #38187776601](https://github.com/killjoy00/votepredict/actions/runs/38187776601) **COMPLETED SUCCESS** following merged [PR #1168](https://github.com/killjoy00/votepredict/pull/1168). All **four** exact public LRL MP3s were downloaded completely (HTTP 200 and exact Content-Length), independently reverified their previously original-authenticated 65,536-byte prefix SHA, hashed byte-for-byte and securely removed from the ephemeral source runner. Original source failures: **zero**. These are now genuine **first complete-source original SHA** receipts; an independently SHA-pinned **second** full-source acquisition and durations are separate gates.

| Actual first-complete original source | Full bytes | First full-original SHA-256 |
|---|---:|---|
| SF1159 Transportation `cmte_fintrans_040821.mp3` | 118,836,368 | `ec5f1ca5183ec0e9b40dfa9f5e30c0b3ae2fc13afefcd935856715430013a8ef` |
| SF970 Judiciary first `cmte_jud_040821.mp3` | 106,416,620 | `97cbe4438cb4f541f2202cb53a27f72098152107617fe4e21622227b79af9cbc` |
| SF970 Judiciary second `cmte_jud_040821a.mp3` | 116,669,459 | `818e8ddcaad73674444dd39d8033a9887ffc4dadc1e95009817539fe65f91013` |
| SF970 Judiciary third `cmte_jud_040821b.mp3` | 85,774,553 | `160483667a070a19b6d5b33df8cc1457a2c97a2ac16de831a0882a82a4aea028` |

The independent first full-source artifact #11719963805 was downloaded and re-hashed separately: ZIP **1,606 bytes** SHA256 `57ecb1dfc1c57deb7e5e85e19580f92688552d649ca026fcf18960bb5c371eb7`, `source.json` **5,914 bytes** SHA256 `099952b1f0d42856c3b3930f04fb7af806160d2a47ec7264f1a0ef1384cc4168`. Permanent [machine-readable full-original first-source proof](source-proof/senate-2021-apr08-four-original-lrl-mp3-first-complete-source-success.json) includes all four full original and prefix SHAs, no transcript or raw MP3.

**Explicit first-run `ffprobe` limitation**: the job log states `ffprobe unavailable: duration will remain null; MP3 digest proof still meaningful`. The four **duration values are all null due to missing runner dependency**, not proof that the full original audio is invalid. No claim that the three previous original Judiciary auto-caption review timecodes (00:58:23, 01:06:44, 01:22:23) fall inside the first actual audio recording's playable duration can be made yet.

The **separate second-original** one-shot [`senate-2021-apr08-four-lrl-full-original-sha-strict-second-duration.yml`](../../.github/workflows/senate-2021-apr08-four-lrl-full-original-sha-strict-second-duration.yml) explicitly installs `ffmpeg`/`ffprobe` and fails unless **each** of the four complete downloaded MP3 original binary byte counts and complete SHA-256 match the frozen first full-source originals **and** every `ffprobe` duration is available. It records whether the previous first-Judiciary auto-caption cue offsets even fit inside that original recording (range plausibility only, not speech/motion certification). Even a successful full original SHA/duration does **not** establish that a specific Dibble/McEwen/Pappas amendment roll was spoken at that time.

No production data read/write, archived vote rows, member choices, models, forecasts, scheduler, floor, 2027 or governmental contact changed. Individual motion `occurred_on`, historical first-published-by, printed absences, official 2021 print-minutes denominator and 2022 print/electronic parity remain unresolved. Issue [#864](https://github.com/killjoy00/votepredict/issues/864) stays **OPEN**.
