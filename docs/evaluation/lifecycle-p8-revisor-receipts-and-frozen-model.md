# P8 offline Revisor observation receipts and frozen-model verification

Tracking: [#310](https://github.com/killjoy00/votepredict/issues/310). Built after the [2026-10-09 offline daily prototype](lifecycle-p8-daily-offline-prototype.md) for the owner-approved forecast-quality pivot.

**Current state: offline integration only, not 2027–28 prospective activation.** All unit tests use synthetic XML and mocked collection clocks. October 2026 cannot supply genuine 2027 legislative observations.

## Revisor XML source adapter

The repo already has official Minnesota Revisor introduction, process, and official-version parsers. `src/evaluation/lifecycle-p8-revisor-receipts.ts` connects them to the daily capture prototype rather than creating another crawler. The only allowed live retrieval shape (when explicitly called) is HTTPS `api.revisor.mn.gov/bills/v1/95/{2027|2028}/0/{HF|SF}/{bill}/` with a matching exact bill identity. No extra query strings, arbitrary hosts, redirects, credentials, retries, app DB, or Vercel entry points are allowed.

- `fetchAndSealP8RevisorReceipt` captures the **full original XML bytes**, calculates its SHA-256, then records a UTC `observedAt` **after the response body has been received**. It refuses malformed/foreign documents and excessive payloads; it has never been dispatched against 2027 sources in this PR.
- `persistP8RevisorReceipt` stores the original XML/receipt envelope as an **exclusive immutable local file**. It verifies the XML digest and canonical receipt digest before recording, preserving source identity, fetch time and content for future audit.
- `buildP8BillInputsFromOfficialReceipts` selects only receipts whose **collection date in America/Chicago precedes the daily cutoff**. It reparses the actual retained XML; matches Revisor's official introduction date, nonterminal dated process events and documented official version insert dates; preserves the **first receipt in which each eligible event/version was actually present**. It does not backfill a later-discovered stage merely because its official action date was earlier. Source-stage and bill-version text that was not separately acquired has `textHash=null` / `textLengthChars=null`, not fabricated text data.
- The integration bridge `buildVerifiedP8OfflineReceiptCapture` demands the **exact frozen model bytes** before generating an offline daily batch, sets source to `offline_observed_revisor_receipts`, and retains `predictionsComputed=false`, `productionCaptureActivated=false`, `outcomeRead=false`, `memberVoteLabel=null`. It verifies identity; **it does not apply the frozen model to predict**.

The adapter also requires a **separately supplied source-timestamped official calendar/adjournment datum**. This is an important unresolved trust boundary: the current adapter validates the URL, SHA format and earlier observation date, **but does not independently extract or authenticate that adjournment date from the calendar bytes**. No production P8 features should be admitted until an official as-of calendar extractor/source archive is reviewed. Similarly the caller must supply the complete independently verified authoritative introduced-bill universe and stable IDs. A few Revisor receipts cannot prove 95% introduction or 90% daily lifecycle coverage.

### What these timestamps do and do not establish

Revisor `ACTION_DATE` and document `DATE_INSERT` are official **event/publication labels**. The recorded `observedAt` is a **separate local source acquisition timestamp**, minted after the HTTP response; it is **not** proof of a historical broadcast/publication time from before the collection, nor a third-party timestamp authority. A SHA-256 digest authenticates retained bytes **against a pinned reference**, not the historical truth of when those bytes were publicly available. Current local files can be modified by their filesystem owner, so a future real program also needs independent append-only storage/clock audit, enforced capture permissions and expiry/retention design.

Mocked clocks used by tests deliberately simulate 2027 without claiming any such download occurred. No hidden retrospective reconstruction, source enumeration or current production dataset is being used.

## Frozen September 2026 P8 model — original bytes or fail closed

The canonical model remains [GitHub Actions run #35910925882](https://github.com/killjoy00/votepredict/actions/runs/35910925882), artifact **10772991611**, from commit `2733a6c8f96e88e1028dbcea7c5d9caac212ab08`. Independently recorded signatures:

| Layer | Immutable SHA-256 |
| --- | --- |
| Original artifact ZIP bytes | `72a42063a028114b4f6cbd8a356e74940eb00bdcda28a83cadf884aaa346061e` |
| **Extracted exact `model.json` raw bytes** | `850aa4344bfe1635622af95c8f0871a38cbc234dc23eb9ae50085da668fcfc76` |
| `SHA256(JSON.stringify(modelContent))` | `abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65` |
| Frozen `lifecycle-p8-prospective-plan-v1.json` | `2f4e936fe0977049a8f4212c48ee93405dd7b6dff59ee4f801f402a05f3dfd6d` |

`src/evaluation/lifecycle-p8-frozen-model-verify.ts` enforces the **exact raw file bytes**, internal model-content digest, embedded plan/code/intro-model identities, zero freeze-time target-session records, frozen P4/P5 component types, `member-eb-v1.2-decay180` conditional component, unchanged serving policy and **2028-07-01T00:00:00Z** reveal gate. It does not download, retrain, load environment secrets or score outcomes. An arbitrary JSON file with a correct-looking model version cannot pass.

To verify an original locally extracted model file, **without any network or DB access**:

```bash
# Extract model.json from the original pinned ZIP, after checking its ZIP digest.
npm run verify:lifecycle:p8:offline -- --model-json /path/to/original/model.json
```

The original GitHub Actions artifact is subject to expiration; **long-term durable frozen-model hosting remains unresolved**. The repository does **not** introduce a new replacement model or republish an assumed-equivalent reconstructed JSON file.

## What was tested, and what remains

Unit tests use synthetic Revisor official-schema XML and a mocked fetch receipt clock; they check exact host/path/bill restrictions, original XML hash, tamper detection, two observed copies of the same bill at different times, same-day exclusion even when the action occurred earlier, explicit calendar source timing, immutable local receipt replay and original-model hash-mismatch refusal. `inspectP8ModelDocument` has independent synthetic success/failure tests; the canonical raw-model check was additionally verified against the actual original P8 artifact outside CI, not by downloading it in CI.

A real capture adapter remains blocked until we have all of: (1) a *complete observed* 2027 introduction-universe manifest with source timestamps and stable IDs; (2) independently archived official calendar, initial text and stage data at collection time; (3) reliable external append-only receipt preservation; (4) separately reviewed and activated capture/scoring using pinned model bytes; (5) #732 Vercel/live-cron cost and access review. **No 2027 feature score, forecast probability, or evaluation metric was generated.** Keep the P8 activation checklist unchecked and the frozen July 2028 reveal and coverage gates intact.
