# Protected 2027 preseason evidence intake

The live worker requires the active 2027 roster and January 12 session gate. Before then, collect original public sources from the exact approved projected-roster cohort without creating memberships or evidence items. This implementation pins the November 26 roster hash and both reviewed lead manifests from #1618 and #1621: 28 distinct source URLs for 21 members (8 missing-profile sources plus 20 depth-review sources, seven previously observed but not privately archived). It does not recollect all 95 earlier source receipts yet.

The single bounded batch permits 28 exact HTTPS GETs, no redirects, cookies, credentials or paid APIs, 2 MiB/source, 32 MiB aggregate, six-minute fetch deadline. Original received entity bytes are checked against the parser digest. Store exact bytes plus a separate append-only review receipt using migration 0037; verify accepted timestamp and digest, require review of identity, source ownership, speaker, publication and actual answer before extraction. Name presence is only a hint. No party-based position or general-to-bill inference. Dates are publisher claims, not proof of prior availability. No original text, incidental contacts, credentials or raw bodies enter public Git/logs/artifacts. A keyless PR-only probe can emit metadata and failure counts but cannot retain private bodies or write any DB.

Protected archive workflow is dormant, manual and defaults to plan. Separate explicit repository approval and environment `votepredict-2027-preseason-archive`, exact green main SHA, separate direct Neon TLS-verified credential, role/fingerprint, migration ledger and restricted privilege checks are required. The dedicated role must have SELECT on migration ledger, SELECT/INSERT only on public.evidence_content_blobs and no other data mutations, role membership, owner rights or user-schema creation. No role is created here and no production transaction is attempted. One advisory-locked batch start per Chicago day; skip URLs with existing review receipts and retry on a later approved dispatch. A prior observation does not assert complete evidence, and failure never becomes a negative position. All records remain zero-weight, non-serving. No Vercel, no scheduler, no forecasting or canonical writes.

Next gate: verify the real dedicated role and DB binding, perform one explicitly approved protected archive batch, read back metadata and coverage, then use reviewed exact speaker/answer extraction and existing evidence admission rules under a separate role. Do not treat these receipts as model-ready positions. Archive all other verified pilot sources in later bounded batches only after the first canary succeeds. 


## First protected-data intake: November 26, 2026 (Chicago)

PR #1623 passed CI and the bounded keyless probe (Actions run 45919777117, job 140247481437) and merged. The probe attempted all 28 URLs, fetched 20 pages for 17 of 21 targets, and encountered eight access/timeout failures. It emitted metadata only. The previously merged Senate discovery PR #1622 is also green.

On explicit user request to get evidence in, a one-time direct database connector transaction imported **49 append-only records**, not canonical evidence items. The production database migration ledger matched the reviewed 37-migration digest exactly. The dedicated NOLOGIN role `votepredict_2027_preseason_archive` has only archive SELECT/INSERT and migration ledger SELECT; it has no archive mutation or other-table write privileges. The connector owner is the existing administrator of this role but lacked SET permission. A single transaction temporarily granted SET with INHERIT false, switched effective role, rechecked schema and restricted privileges, inserted only the scoped content records, checked counts and digests, reset role, and revoked the temporary grant before commit. Independent readback verified 49 records and the original role grant posture (creator admin option, no inheritance, no SET option). This was a narrowly scoped manual import, not activation of the separately gated GitHub workflow.

| Media type suffix | Records | Members | Policy statement paraphrases | Sorted record digest set SHA-256 |
|---|---:|---:|---:|---|
| `2027-preseason-keyless-probe-metadata+json` | 28 | 21 | 0 | `25dd1631c5e66f043882da4198c56bf5d5426d6dac8435c84280536781f61056` |
| `2027-preseason-browser-policy-review+json` | 21 | 21 | 79 | `ae5040b82ee1901a3755b57bdc33870e8c437387da2416f51295fded9585a0ff` |

Batch `2026-11-26-incoming-policy-review-v1`; committed 2026-11-27 03:12:55 UTC. Frozen projected roster SHA-256 `3b062058cbe77d2ff6caad8719a65535ad75849d48e0c627c9b460ef48df17bd`. Each browser-reviewed record contains a candidate-specific source URL, roster identity/seat, source locator, claimed date if available, and explicitly scoped policy paraphrases, never votes or bill-specific predictions. Reviewed the accessible browser-rendered candidate statements even where the machine fetch was blocked, including the PBS transcript with isolated speaker, named SNAP answers, voter-guide candidate answers (not publisher ratings), campaign issue pages and named local-media questionnaire answers. All 21 targets with reviewed source leads have at least one policy statement. The roster remains projected (not certified; Senate 4 is unresolved); no membership or canonical evidence row created. No original entity bytes retained, no raw-body hash claimed for browser rendering, no asserted equivalence of the separate probe digest to the browser-reviewed content, and no proof of earlier availability. All 49 records are non-serving, with canonical write disallowed and zero weight; the 79 paraphrases are review candidates, not 79 admitted model features.

Reproducible read-only batch check:

```sql
SELECT media_type,
       count(*) AS records,
       count(DISTINCT convert_from(body,'UTF8')::jsonb->>'lrlId') AS members,
       bool_and(encode(sha256(body),'hex')=sha256) AS digest_verified,
       bool_and(convert_from(body,'UTF8')::jsonb->>'servingEligible'='false'
                AND convert_from(body,'UTF8')::jsonb->>'canonicalWriteAllowed'='false'
                AND convert_from(body,'UTF8')::jsonb->>'rawBodyRetained'='false') AS non_serving,
       encode(sha256(convert_to(string_agg(sha256,',' ORDER BY sha256),'UTF8')),'hex') AS record_set_digest
FROM public.evidence_content_blobs
WHERE media_type IN ('application/vnd.votepredict.2027-preseason-keyless-probe-metadata+json',
                     'application/vnd.votepredict.2027-preseason-browser-policy-review+json')
  AND convert_from(body,'UTF8')::jsonb->>'batch'='2026-11-26-incoming-policy-review-v1'
GROUP BY media_type;
```

The separately guarded original-byte archive remains dormant and still requires a protected direct login credential and verified environment; the manual source review does not waive the original-byte or admission gates. Next: extend the same reviewed-statement treatment to the other 30 incoming members, acquire exact original bytes through the protected archive path, reconcile certified roster and validate subject, direction, timing and provenance before any canonical admission. Remove the completed one-shot keyless probe workflow; the run remains auditable. No forecasting, live feature change, Vercel, paid APIs or recurring schedule enabled.
