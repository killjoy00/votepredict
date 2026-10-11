# #864 — independent check of 2023 April 27 Senate Taxes THIRD original caption track

The [2023 Senate no-Minutes caption source cohort](./senate-2023-64-no-minutes-original-caption-motion-cue-review.md) surfaced one source-coverage hole separate from the five audio-only recordings and January 10 empty-caption result: the official **April 27, 2023 Senate Taxes** media record has **three** `showcaptions` links, but the previous original-source review recorded only the **first two** (a per-record cap of two). Do not silently convert the third link into a duplicate, zero words, an inaccessible recording, or a second/third distinct motion.

## Exact existing source evidence

- Original date/committee from 2023 official LRL indexed page: [April 27 Taxes indexed hearing](https://www.lrl.mn.gov/minutes/comm?commid=26142-0&year=2023&body=senate&date=4%2F27%2F2023)
- Exact original official [media record `mtgid=1048125`](https://www.lrl.mn.gov/media/file?mtgid=1048125).
- Original 2023 LRL media-page HTML SHA256 **82f26b59ad2210b3b46682a7000a9c237473a71359c3fd72645889b4d86fcf08**.
- Actual previous original full-source [run #38103766440](https://github.com/killjoy00/votepredict/actions/runs/38103766440) concluded **FAILURE** due to unrelated January/February source GET timeouts. Its independently downloaded original 2023 JSON body (**64,282 bytes**) SHA256 is **a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4**.
- The two independently SHA-proven previous April 27 caption payloads: **312b36d875952203c1605b3926550d730e2d66ab33f6dd9fc2b34693cb6cdc68** and **90141a530077bfdf1c8b79a86f80b860c39af786e60de9710ab67cc0e8846321**; together **524,678** original caption bytes and **3,116** machine-caption timestamp markers. These hashes and totals **do not** cover the third link.

## New exact one-time read-only source probe

The [bounded workflow](../../.github/workflows/senate-2023-apr27-third-caption-original.yml) restores **three** independently SHA-pinned earlier official GitHub Actions source artifacts: the original indexed 2023 hearing/URL list (run #38079233118), all prior authentic 2023 LRL media HTML hashes (run #38081463362) and the exact first two-caption source proof (run #38103766440). Every original source JSON body must match its original full SHA before the code proceeds.

Only `mtgid=1048125` is re-fetched. It must match the original original page HTML SHA and have exactly three safe same-host `showcaptions` requests in the **same original HTML byte body**. The third request at **index 2** is the only API payload fetched. The current third original returned caption bytes are bounded to **1.5 MiB**, no redirect following, only official text/html, and only its SHA256, bytes, timestamp-marker count and source status are saved. The first two original source payloads are **not re-downloaded** or falsely treated as a second vote. On HTTP timeout, changed source SHA or unsupported response, retain a failure/unknown and do not silently classify the hearing as devoid of actions.

A nonempty timestamp-bearing caption is still only automatic caption markup, with no verified audio/video playback, named senator speaker, parliamentary identity, recorded individual sides or bill stance. If the third source is accessible, its provenance belongs in a permanent source ledger only after independently downloading and verifying its actual one-time source-run artifact ZIP and JSON hashes. The separate main 2023 cue review based on 63 previously authenticated caption streams still correctly excludes this until source authentication and human semantic verification.

No private/production database access, senator member-vote import, model, training, forecast, serving, scheduler, Senate floor/2027 changes or office contact. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
