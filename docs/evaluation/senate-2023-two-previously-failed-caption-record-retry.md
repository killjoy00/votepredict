# #864 — exact two-record 2023 Taxes media-source retry

**Only two already-indexed, originally HTML-SHA-authenticated official Minnesota LRL media records.** No 2021 print, 2022 print/electronic expansion, new recordings, media-body downloads, private DB, forecast, training or production changes.

The [first exact original caption audit run #38103766440](https://github.com/killjoy00/votepredict/actions/runs/38103766440) correctly reported **FAILURE**: in 2023 it revalidated only **62/64** HTML pages. The two remaining `fetch failed` network errors are:

| Original official indexed hearing | Committee | Exact official media ID | Independently re-observed original HTML SHA256 |
| --- | --- | --- | --- |
| 2023-01-12 | Taxes | `1046920` | `b16bf3a4a626701c007e2a6921ffd44679d372b3e01e72b9ee17e48effdcd73e` |
| 2023-02-08 | Taxes | `1047266` | `c2c3e0c92ab5a5cd108004003082c94d05a2b66e596b439edf0745842a71cb04` |

This new [strict one-time workflow](../../.github/workflows/senate-2023-two-failed-caption-retry.yml) restores **three previously authenticated source artifacts**: official 2023 hearing-to-media identities [run #38079233118](https://github.com/killjoy00/votepredict/actions/runs/38079233118), original 2023 HTML record source [run #38081463362](https://github.com/killjoy00/votepredict/actions/runs/38081463362), and the actual **incomplete** 2023 original caption-run JSON **artifact #11688587941**, exact JSON SHA256 `a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4`.

The script refuses all but those **two** verified original IDs, original year/date/committee/URL and exact prior `fetch failed` identities. It safely fetches the *two* LRL source HTML pages (maximum 600,000 bytes, no redirects, explicit content-type check), demands the original prior HTML SHA match, and optionally checks at most two safe same-host small caption HTML payloads per source. Only response-type/status/timed timestamp-marker counts, payload hashes and unknown/failure statuses go into the output; **no original HTML bodies, caption words, transcript passages, names or video/audio** are saved.

A successful targeted retry can resolve only these two prior network availability gaps; it **cannot** turn all 138 archived media leads into independently verified original AV playback or actual member choices. Keep the **five 2023 audio-only** and **two 2022/2023 HTML caption responses with zero timed rows** as separate unresolved paths. Time-stamped auto captions remain error-prone and require human speaker/motion/source adjudication. The full 2021–25 official committee recorded vote denominator is still unknown. No government-office contact or changes to original source/forecast/production; **issue #864 remains OPEN**.
