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
