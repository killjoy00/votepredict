# P8 supplied-universe gap audit and two-day offline rehearsal

Tracking: [#310](https://github.com/killjoy00/votepredict/issues/310). Increment after the [sealed official-XML receipt and frozen-model verifier](lifecycle-p8-revisor-receipts-and-frozen-model.md).

**Status: synthetic/offline diagnostic only. No 2027–28 real source captured, no live activation, no probabilities, no outcomes, no serving or production database interaction.**

## Why this is needed

The existing Revisor receipt adapter accepts an externally provided list of bill identities and correctly refuses to infer a bill from a future receipt. However, a successful daily capture of that supplied list does not prove it includes **every** bill introduced by the target cutoff. If one bill is omitted from a caller-provided list, an otherwise valid immutable daily file has no basis for identifying the omission.

`src/evaluation/lifecycle-p8-universe-coverage.ts` now separately seals a deterministic, externally supplied **bill index** with stable bill IDs, normalized HF/SF identifiers, source URL/digest, individual first-observation timestamps, and a cutoff in America/Chicago. The index and daily capture are individually integrity-checked; duplicated IDs/identifiers, future first observations, foreign source hosts, changed manifest bytes, unknown bill IDs in a daily file, wrong day, and post-cutoff source observations all fail closed.

The audit reports, by House/Senate and total, how many indexed bills appear in the immutable daily capture and how many have observed parsed process sources. A bounded list of missing public HF/SF identifiers exposes precisely which synthetically enrolled bills failed to produce a row. It does not write missing rows automatically.

A second function compares **two already sealed daily captures**. It flags previously captured bills disappearing from a later day and changes to the original first-observation clock; it does not backfill an earlier day or read stage outcomes.

## Critical provenance boundary

The enumerator list is **not independently authenticated government enumeration**. Its source URL and SHA-256 are metadata supplied by the caller, not proof that an authentic source body contains the full official inventory. Accordingly, every audit receipt explicitly records `independentOfficialDenominatorVerified=false`, `publicationTimeIndependentlyVerified=false`, `primaryProspectiveScoringAllowed=false`, and `productionCaptureActivated=false`. Computed coverage denominators are *only the supplied list*, not the frozen 95/90/95% prospective scoring gate. The collection adapter and model freeze remain unchanged.

Full activation still requires (a) a source-byte-verified, complete authoritative 2027–28 bill enumeration at each cutoff, (b) an independently authenticated official session calendar and first-observed bill text, (c) durable independently append-only storage and clock/permission monitoring, (d) an exact archived copy of the original frozen P8 model bytes, and (e) a separately approved capture operating path consistent with #732. None is faked by these fixtures.

## Deterministic rehearsal

Run without secrets, external network, Neon, Vercel, schedulers or access to 2027 material:

```bash
node --import tsx --test tests/lifecycle-p8-universe-coverage.test.ts
node --import tsx scripts/rehearse-lifecycle-p8-universe-coverage.ts
```

The runnable script creates **two synthetic 2027 calendar-day** immutable capture files in a temporary directory, deliberately omits one of three supplied bills on the first day, verifies its missingness, captures all three on the next day, verifies source-observation continuity and identical replay idempotency, and removes the temporary files. Both snapshots remain strictly outcome-blind: no member-vote label, revealed P8 score, new trained model, or prospective production activation.

The existing pinned model-byte verifier and official-XML receipt adapter remain separate. This is the missingness/continuity **readiness test**, not a replacement for either source attestation or the frozen evaluation protocol.
