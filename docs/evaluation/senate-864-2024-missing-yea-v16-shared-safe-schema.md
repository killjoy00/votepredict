# #864 — V15 post-ROLLBACK scalar output HOLD and V16 identical reviewed schema repair

The [first-attempt protected V15 main workflow #38313341472](https://github.com/killjoy00/votepredict/actions/runs/38313341472) used reviewed merge SHA `54bad5ae509fac74f0125d2bfb3f8b4af0aab205`. **Original-source presecret: SUCCESS**, including 21 source SHA artifacts and two independently complete LRL year-2024 service original HTML acquisitions with the same semantic SHA; **protected read-only job: HOLD at `final_scalar_output_safety`**, after the static `explicit_rollback` stage; keyless receipt [automatically posted](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6133317820). **No accepted private YEA-to-official-service classification was emitted.** Do not reconstruct or infer a private status from the failed job. The V15 HOLD remains permanent, with no DB row mutation, member names or original source text exported.

## Reproducible deterministic code error

The V15 protected producer returned:
```ts
schemaVersion: 'senate-864-2024-single-yea-private-person-source-v15'
```
But the independently reviewed strict 33-field serializer required:
```ts
V15_SAFE_SCHEMA_VERSION =
 'senate-864-2024-one-yea-lrl-original-year-roster-v15'
```
Thus the code *must reject* this protected result at `final_scalar_output_safety` regardless of any private comparison outcome. This is an **output contract bug**, not positive/negative evidence on whether the original 2024 missing YEA person matches an official Senate 2024 service-year entry.

## Minimal V16 first-attempt correction

A separately reviewed `V16` main SHA is necessary (V15 was one-shot and must NOT be rerun or rewritten). The V16 protected script differs only in its versioned one-shot markers / filenames and in importing the *existing, already reviewed* V15 serializer **and its source-of-truth schema constant**:

```ts
import {serializeApprovedYeaV15SafeScalars,V15_SAFE_SCHEMA_VERSION} from
 '../src/evidence/senate-864-2024-yea-v15-lrl-semantic-safe-scalars.js';
// at the protected return:
schemaVersion: V15_SAFE_SCHEMA_VERSION,
// after the explicit READ ONLY rollback:
serializeApprovedYeaV15SafeScalars(safe)
```

The V16 receiver **intentionally continues to require the exact V15 33-field schema version**, rather than inventing a second validator or accepting arbitrary input. The new V16 regression tests *pin the actual protected return expression and import* against this one schema constant, test the accepted 33-field fixture, all privacy and static phase allowlists, and reject private fields, unsupported exact-day claims or any historic root-cause claim. The 21 immutable original Minutes/OCR source SHA manifests, two presecret complete authentic government LRL HTML originals, strict 2024 name+term/district semantic equality and protected fresh third original, original missing 2024 PDF exact raw SHA and bounded 3 tries, initial three source/event/choice SQL queries plus existing two bounded name/roster queries, `REPEATABLE READ READ ONLY`, `ROLLBACK`, distinct raw HTML caveat, and all V10 unmatched-stored-roster invariants are **unchanged**.

The only public V16 result allowed is the exact **same** anonymized safe 33-field source/service-year classification after the protective rollback and separate keyless validator; any failure produces a previously allowlisted static phase, with no member names, source identifiers, PDF text, choice hash, raw directory HTML or SQL error. The missing vote's actual Senate hearing-day service, historic source name or alias resolution, reason for stored-row omission, verified deployed-production branch and row repair remain **UNKNOWN even if the year-service name matches**.

The entire 2022–25 linked electronic corpus **1,452 original PDFs** has independent source SHA proof, but *eight extra parser-v3 named observations are still not eight proven missing stored events*. Historic Senate positional event-key rebackfill remains blocked by [merged PR #1260](https://github.com/killjoy00/votepredict/pull/1260). The external full vote denominator remains open: indexed 141 meetings without linked electronic Minutes PDF, 2021 printed Minutes and 2022 print/electronic discrepancies.

**No production write or backfill/rekey, no deployment, model/forecast/serving/scheduler/2027 change or outside official contact. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
