# #864 — 2023-01-24 Senate Rules SF1: two distinct official named roll passages

**Source:** January 24, 2023 Senate Rules and Administration original LRL committee Minutes, official PDF [Rules_20230124_Minutes.pdf](https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf).

**Independent prior byte-authentic government evidence:** exact source URL, `189,421` bytes, whole original PDF SHA256 `a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379`. Original source recall from #864 run [#38680095705](https://github.com/killjoy00/votepredict/actions/runs/38680095705), follow-up distinct motion passages in [#38751793822](https://github.com/killjoy00/votepredict/actions/runs/38751793822). Independently reauthenticated original embedded text, not a proposed inference from archived agendas.

## Failure being repaired

Frozen parser v3 recognized **zero individual named rolls** from this original, despite two separately printed `Members voting AYE` / `Members voting NO` passages with exact aggregate tallies:

1. Oral amendment to the SF1 committee report, proposing rereferral to Health and Human Services. Printed result: **4 AYE, 6 NO — amendment not adopted**.
2. Subsequent motion to adopt the Judiciary and Public Safety committee report for Senate File 1. Printed result: **6 AYE, 4 NO — committee report adopted**.

These are **two separate committee decisions**, even though they concern SF1 and may involve the same ten people with different sides. They are not two floor passage votes, and the first is not a vote *in favor of* final passage. Distinct roll call request anchors and original motion text separate these source events.

The new narrowly scoped parser recognizes *only* original individual senator-prefixed names on each explicitly labeled AYE/NO side, demands exact per-side printed tallies, refuses duplicate names/cross-side ambiguities and never manufactures named member decisions from counts or attendance. The new government-source CI regression retrieves this **exact raw official PDF again**, matches full SHA+byte length, reruns the parser and demands precisely two correctly scoped motions with totals, outcome and 10 explicitly named choices each. It emits only hashed motion anchors, counts and source proof; actual senator names remain in memory.

## Limits and database hold

This work changes source parsing and source-only tests. **No stored `vote_events`, `member_votes`, `source_documents` or production evidence are created or updated**. The historical senator-person ID crosswalk, parliamentary key mapping and exact source-to-stored parity remain unproven for these two source actions. The old importer uses an unstable source-URL-plus-position key and `ON CONFLICT DO UPDATE`; do **not** replay it against already stored Senate committee actions. This small parser fix alone cannot certify additional persisted individual votes, source-to-database completeness, availability for a specific forecast cutoff or any 2021 evidence.

Accept only with passing exact-head general CI, deterministic parser tests, and [the separate original PDF QA workflow](../../.github/workflows/senate-864-2023-rules-sf1-original-roll-source-qa.yml). Issue [#864](https://github.com/killjoy00/votepredict/issues/864) remains open for the remaining 2022–2025 source and stored database reconciliation.

## Actual independently re-fetched original PDF QA — verified

[Exact source workflow #38760672178](https://github.com/killjoy00/votepredict/actions/runs/38760672178), job 116510798000, **SUCCESS** on source parser commit `d7bcf245fdaf02f1363bcf96c1c6f7977100e729`:

- Independent government raw PDF **189,421 bytes** and full SHA256 `a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379` reproduced the prior audit with zero bytes drift.
- Actual embedded extracted text SHA256: `2a6eb9aced550ed193b4329fd33cc0fa8c59fd447c9be170ccc34ac36ead3544`.
- **Exactly two** original individually named vote observations parsed as `SF1`: (1) failed oral amendment, 4 AYE / 6 NO, 10 explicit choices; (2) adopted committee-report motion, 6 AYE / 4 NO, 10 explicit choices. No unnamed or imputed individual sides.
- Motion-context fingerprints, names withheld from log: `60665907a1a90d30908a0d2996bd63ffe8223412994d36bbcd3fc6243422ca4d` and `436866d98930a63e39623e0ef957d9e1e3b6e5a5414ce188dcdc488acac2cffa`.
- Actual source revealed **commas inside printed senator-prefixed names**; this explains why a synthetic-only name parser was insufficient. The final matcher permits comma punctuation *within* one explicitly prefixed name only, still requiring exact side totals and duplicate exclusions.

This audit authenticates two source actions; it does **not** independently authenticate database person IDs or prove either source action absent from production storage. No SQL, database credentials, import, model, forecast or Vercel action occurred. The final exact-head CI and the separately authenticated **2023 Rules source-PDF QA** must both pass before this scoped parser fix is merged. The repository's `#864 full original 1452 Senate parser v3 recheck` PR check runs synthetic/non-source gates only; its 16-shard, 1,452-government-PDF full-source reread is **not run on this pull request** and remains an explicit separate historical coverage gate. Do not describe that synthetic check as a completed full-source corpus audit.
