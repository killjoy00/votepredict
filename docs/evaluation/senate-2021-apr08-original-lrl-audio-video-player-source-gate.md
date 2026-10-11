# #864 — 2021 April 8 Senate committee original LRL media-player source accessibility gate

**Research-only original historic source-address audit.** The [first genuine April 8 LRL + Senate agenda source run](https://github.com/killjoy00/votepredict/actions/runs/38177903789) authenticated two 2021 original, publicly accessible **Minnesota Legislative Reference Library historical media pages** and three original Granicus committee meeting agendas. The [independent second original April 8 Judiciary caption](https://github.com/killjoy00/votepredict/actions/runs/38178393419) reproduced exactly the complete 436,144-byte source SHA and three Pappas/amendment automatic caption cue offsets (00:58:23, 01:06:44, 01:22:23), but not any individual exact Journal-amendment date or authentic recorded audible motion.

**Problem:** All three previously indexed Senate Granicus MP3 URLs returned **HTTP 403** from the real first source runner. The two genuine independently retrieved LRL media HTML pages, however, contain original audio and video player tags:

- [Transportation Finance and Policy, April 8, 2021](https://www.lrl.mn.gov/media/file?body=s&cid=3102&date=04%2F08%2F2021): originally authenticated 89,044-byte HTML SHA256 `a204640dcc0ea751fc867ae673492302a48b3dac4c0747475fab1c1ecc2291ce`, **one** audio, **one** video tag;
- [Judiciary and Public Safety Finance and Policy, April 8, 2021](https://www.lrl.mn.gov/media/file?body=s&cid=3099&date=04%2F08%2F2021): 96,070-byte original HTML SHA256 `98d4a9be8e08963121f332dcda6fbc602a07dc4a237b633011fc40a1ca2a4194`, **three** audio, **two** video tags.

The LRL's public player URLs could be an alternate self-service path to original media needed to decide the historical day of **three distinct** Rule 12.10 Senate committee motions (SF1159 Dibble, SF1159 McEwen, SF970 Pappas) reported later in the April 12 Journal. The player tags alone do not prove the exact contents of any original recording or that a particular amendment was debated or voted during that session.

## Strict separate public original-source workflow

The new one-time `senate-2021-apr08-lrl-original-media-player-source-prefixes.yml` original-source job:

1. Fetches **only two original official LRL historical media HTML pages**, individually rechecking exact **original byte length and entire SHA256** recorded in the genuine first source artifact.
2. Parses genuine `audio`, `video`, `source` and media-like `iframe` references in those original pages. The script reports source URL origin (LRL vs other public host) and source-path/reference SHA metadata. URLs with third-party credentials, query tokens or unknown hosts are not replayed or disclosed as full URLs.
3. **Only for genuine `https://www.lrl.mn.gov` or `https://lrl.mn.gov` media source URLs**: at most **six** per original page, send a single HTTP Range request and immediately cancel after **at most 65,536 bytes**; emit response HTTP status, content type, source-prefix SHA, MP3/MP4 signature, and whether the server honored Range. The entire audio/video is **not** acquired and no speech/transcript is derived.
4. Emits metadata-only Actions artifact; genuine source failures remain source failures, not silently reclassified as “no original recording.”

This is a discovery/provenance phase. If an LRL media prefix is genuinely authenticated, the next separate step is to identify a legal, bounded original recording playback source and inspect **the exact introduced amendment and committee roll result**. No caption row, agenda or limited media signature justifies asserting a Pappas/Dibble/McEwen vote timestamp. A playable original 2021 media clip alone still needs visual/audio reconciliation with the separately original-Journal-authenticated roll, and historical public-by timing is distinct from a current media source fetch timestamp.

**Permanent controls:** no member vote side lists from captions/audio, no inferences from attendance, no private stored vote-event or `member_vote` reconciliation, no production DB reads/writes, models, forecasts, training, serving, scheduler, Senate floor vote expansion, 2027 or government/Library outreach. Official 2021 LRL **printed minutes** are a separate unacquired record and 2022 print/electronic parity is not proven. The true statewide official 2021–2025 committee action/vote denominator remains unknown. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
