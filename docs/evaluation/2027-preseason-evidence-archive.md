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


## Second manual protected-data intake: November 26, 2026 (Chicago)

PR #1624 passed CI and merged. A source-by-source browser review of the remaining 30 projected incoming members identified explicit candidate-attributed positions for 29, with one unresolved member. The original two pilot manifests independently bind the same 51 unique targets and projected roster SHA-256. All 95 prior acquisition metadata receipts (46 distinct members) were also imported, preserving their separate acquisition times, exact URLs and original observed digests, without claiming the original entity bytes are stored or that the rendered pages match those bytes.

Batch `2026-11-26-incoming-policy-review-v2` was committed using the same restricted effective-role transaction and independently verified afterward. The temporary role-switch grant was revoked within the transaction, leaving the original NOLOGIN role and creator grant posture unchanged.

| Media type suffix | Records | Members | Statement paraphrases | Sorted record digest set SHA-256 |
|---|---:|---:|---:|---|
| `2027-preseason-browser-policy-review+json` | 29 | 29 | 125 | `fc4c49515a017e53ece1f2248f0fa32207af5672457138ad4445202fa7e1f58f` |
| `2027-preseason-pilot-metadata+json` | 95 | 46 | 0 | `92d4e223ffb7aaac6bbd25c9c0810a068e51d0f4302d76aff53cda47049670c6` |
| `2027-preseason-policy-review-gap+json` | 1 | 1 | 0 | `15b51e6b913918dc22b9e38b6a1f52928befa8753feadffe491a928e17737eda` |

Across both batches, independently read back 174 records, 50 distinct members with 204 source-attributed policy paraphrases, 123 acquisition metadata receipts (95 original pilot + 28 later keyless probe including eight failures), and one explicit unresolved source gap. All records are hash-verified, non-serving, zero weight and disallow canonical writes. These are review candidates; broad priorities and specific policy commitments are retained distinctly, without asserting a vote on any specific bill. No raw original bodies are retained by either manual import.

**Remaining member:** Dominick "Nick" Ronnenberg (LRL 15669, projected House 23A). The state candidate filing identifies his campaign website, which the pilot fetched but the browser reviewer could not read. His VOTE411 questionnaire reports no responses. Secondary rating sites and unattributed summaries were excluded, and no position was inferred from party. Record the missing evidence rather than manufacturing a position. All 51 have been accounted for; 50 have policy-review statements. The projected roster remains uncertified.

Next: pursue an accessible first-person statement for Ronnenberg, broaden depth beyond one reviewed document per member (especially the 18 MHP questionnaires), archive original bytes using the protected archive workflow, and perform independent semantic/timing/identity validation before any canonical admission. No forecast model or production execution change. 


## Housing questionnaire depth and prior state-service audit — November 26, 2026

All 18 exact Minnesota Housing Partnership candidate questionnaires in the frozen pilot inventory were revisited in the public browser. Each policy observation identifies the individual questionnaire URL, projected seat and candidate identity, question number, prior acquisition metadata, and a paraphrase of the **candidate's answer** (never the publisher's question). Three questionnaire records supplement earlier review of the same page without duplicating previously recorded topic keys. Other overlaps are corroboration/related positions, not independent vote signals. No inference from party, absence, or broad endorsement of the publisher's platform. Uncommitted, exploratory and contradictory answers are explicitly non-directional; in particular Gulley's Q4 contains internally conflicting statewide-zoning language, and Olson's Q5 provides no specific proposal.

Batch `2026-11-26-incoming-housing-review-v3`: 18 append-only `application/vnd.votepredict.2027-preseason-housing-questionnaire-review+json` records; 103 observations, 89 directional candidates, 14 non-directional; 3 same-source supplements. Restricted effective-role transaction committed and independent readback verified all hashes and non-serving flags. Sorted SHA-256 set digest `79758b8e6a452625b8af0cd5bf12abe12a019bff3b064cccca76385f73b893d0`. All three batches now have **192 archive records, 50/51 incoming members with policy review, 307 source-attributed statement observations** (including the 14 explicitly nondirectional and potentially overlapping positions), not 307 independent positions. No raw original bodies, canonical rows or model features activated.

Ronnenberg's official filing URL and both hostname variants were retried; neither renders in the browser. VOTE411 and iVoterGuide record no answers. Secondary ratings and campaign summaries, including AI-generated summaries, remain inadmissible. The gap remains explicit.

A production read-only audit joined exact LRL keys for all 51 incoming targets to prior memberships, vote events and source documents. Only Jeremy Munson has existing prior state membership/votes: 402 distinct bill-linked 2021–2022 House votes, 145 `house_vote_detail` source documents, January 28, 2021 through May 22, 2022. Do not reimport these as new evidence. Official LRL records establish missing older House terms: [Dorholt](https://www.lrl.mn.gov/legdb/fulldetail?ID=15393), 2013–2014, 14B; [Cantrell](https://www.lrl.mn.gov/legdb/fulldetail?ID=15524), 2019–2020, 56A; [Munson](https://www.lrl.mn.gov/legdb/fulldetail?ID=15496), 2018 (oath Feb 20) and 2019–2020, 23B. The official [House votes index](https://www.house.mn.gov/Votes) links native regular-session keys 239, 246 and 249. The existing production corpus starts in 2021. Older terms are not included in the supported production historical corpus.

Added a separate credential-free, PR-only **historical source pilot**: verify index native key, LRL session directory unique surname and exact historic term/district; select at most 16 bills evenly by ordered official bill inventory per regular session, not by policy topic or vote result; check original response digest and size, exact bill/session/date, recorded roll totals, distinct names and journal page; extract only named yea/nay rows during exact prior service. No inferred absence, no claim of exhaustive coverage, no special-session coverage yet, no raw content logs, no production write or training-corpus expansion. The 2017–2018 summary page failed to load in browser but official index link exists; live CI must verify it. No assumption that machine access will succeed. A separate source validation and archival path is still required before admitting older votes. Retire one-shot workflow after recording results.


## Older House named-vote pilot — November 26, 2026 (Chicago)

PR #1626 passed CI, Forecast evidence remediation and credential-free historical source pilot (run 45934541467, job 140294611235, commit cbf2c9cd6ac6062d07f50c05706f3d988868a3be), then merged. The official House index and LRL directory/profile proofs verified all four target prior-service terms (three people). The collector attempted 43 requests, 4,607,679 bytes; 14 validated vote-detail documents, 25 parsed roll events, 23 named member votes. It encountered seven rejected 2013–14 bill pages, eleven rejected 2017–18 bill pages, and one 2019–20 session-level summary failure after verifying both memberships. No Cantrell vote was recovered yet. Do not count missing votes as absences or infer a bill outcome.

| Prior session | Official bill inventory | Selected bills | Accepted documents | Named votes |
|---|---:|---:|---:|---:|
| 2013–2014 (Dorholt) | 369 | 16 | 9 | 20 |
| 2017–2018 (Munson, from Feb 20, 2018 only) | 257 | 16 | 5 | 3 |
| 2019–2020 (Munson/Cantrell) | Unverified | 0 | 0 | 0 |

Batch `2026-11-26-incoming-historical-votes-v1` committed to production through the same restricted effective-role transaction; count/digest and non-serving flags independently verified, temporary SET role grant revoked. 38 records: one full pilot metadata manifest, 14 source document receipts and 23 named-roll review records (20 Dorholt, 3 Munson). Original response digests and LRL source lineage are recorded; original bodies not retained, no canonical votes or serving rows written.

| Media type suffix | Records | Sorted record digest set SHA-256 |
|---|---:|---|
| `2027-preseason-historical-vote-pilot+json` | 1 | `4f3046ad52d654a63877742f7c2729d1e4e60aa2aec7ea30324d5ba57e0ed3f9` |
| `2027-preseason-historical-vote-document+json` | 14 | `02a30de61af62548e0c57e4b68d288b05af6e4af876fcad67fedd59ddc08ab3e` |
| `2027-preseason-historical-vote-review+json` | 23 | `b6552c7dab9c0dcd33404d7475f39025cf4a3c293acac87964597ff864017581` |

Cumulative archive: 230 records (192 prior + 38); 50/51 reviewed incoming members, 307 policy observations and 23 additional historical named votes. These are separate kinds of staged evidence, not 330 independent model features. Existing 402 canonical Munson 2021–22 votes untouched.

Recovery branch prioritizes 2019–20, selects up to 32 regular-session bills, retries exactly the 18 rejected earlier bills without recollecting accepted documents; retains the 72-request, 32 MiB and five-minute bounds. The House regular-session list explicitly includes recorded floor actions; resolutions such as HC2 are real non-bill items (see https://www.house.mn.gov/htv/archivesHFS.asp?ls_year=91). The new selector counts only recognized HR/SR/HC/SC resolution identifiers separately, still rejects any unrecognized row rather than assuming validity, and logs safe aggregate summary shape diagnostics. This is a bounded hypothesis for the unclassified 2019–20 summary failure, not a confirmed diagnosis. More precise failure codes now distinguish fetch, summary, roster and roll validation. Named-roll and identity rules unchanged. No raw bytes in public logs, no DB credentials, no production writes by the pilot. Original-byte archival and semantic admission remain gated. Retire the first one-shot workflow; record this recovery pilot's actual results before merging.


## Historical recovery and reuse of existing protected Neon authentication

#1627 passed CI and the historical recovery run 45935861102/job 140298803177. The 2019–20 summary contained exactly 186 bills plus one HC resolution; the corrected selector verified this scope. 20 accepted pages, 54 events, 108 named votes (54 Munson and 54 Cantrell) and 30 explicitly rejected pages; no relaxation of identity/tally checks. Batch `2026-11-26-incoming-historical-votes-v2` committed and independently verified in production: 129 additional archive records, 108 unique new votes, 20 document receipts, 1 run manifest. Record-set digests respectively `09a86e40e628afeb48643789145d03eb37d1e8e6ec6ef3c058b34bebe7e1eaef`, `334a97a86f022b4b714d5cf5a2821e7c085ea5e030af32c921192fab7a20a6c3`, `d133362d737f252119573a722005453dac8f259cf2b36062469c60a785561cce`. Combined 359 staged archive records, 307 policy observations, 131 distinct historical named votes (Dorholt 20, Munson 57, Cantrell 54); not an exhaustive roll corpus. Existing 402 canonical Munson 2021–22 votes untouched.

Repository audit found the existing `NEON_API_KEY` and `evidence-readonly-sandbox` protected environment used by `forecast-evidence-remediation.yml`, `senate-864-72-original-pages-neon-import.yml`, and `senate-raw-votes-neon-collect.yml`. Replace the separate-credential requirement for this bounded preseason operation with that established main-only pattern. Pin the verified existing project/default primary/database/owner endpoint, no Vercel, new secret, login activation or persistent role grant. Protected job runs only after its own full disposable PostgreSQL check and explicit archive dispatch or unique marked exact main push (user approved continuing). The existing owner credential is resolved only inside the protected runner; source fetches occur first. In one bounded transaction temporarily grant SET with INHERIT false to the existing NOLOGIN archive role, switch role, validate exact 37-migration ledger and absence of other writes, append original blobs and review receipts, restore the original membership grant state and commit; any unexpected role state or failure rolls back. Source body logs/artifacts prohibited; hashes and count metadata only. Default dispatch plan-only; no recurring schedule. Separate long-term unattended role remains optional.

User supplied Ronnenberg's campaign link. Add the clean existing official filing URL as the first target, bound to the frozen 51-member cohort and the prior pilot receipt; omit the social tracking query. Total 29 exact URLs, 22 target identities, 2 MiB/source, 32 MiB aggregate, three-minute acquisition deadline, one batch/day. The earlier 28-source pilot found 20 readable machine responses; cannot promise all will be fetchable now. No canonical evidence admission or forecasting changes. Independent database readback and source review required after this canary.
