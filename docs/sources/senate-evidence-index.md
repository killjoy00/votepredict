# Senate research evidence: clocks, text and connections

Migration `0034_senate_evidence_repair.sql` repairs the research interface. It does not change serving probabilities, historical official votes, immutable forecast revisions, source bodies or the frozen evaluation matrices.

## Safe research entrypoint

```sql
SELECT * FROM senate_evidence_asof(:cutoff_date, :target_membership_id);
```

The function uses `observed_on < cutoff_date`: the entire target day is excluded. It carries a person's earlier-session evidence across stable `legislator_id`; it never assigns a challenger to an incumbent. Bill-level context is also returned, so callers must select relevant bills/topics and resolve overlapping official/raw observations before creating a feature matrix. A member mention is not a speaker or stance assertion. The unrestricted `senate_evidence_v` remains a source index, not an automatically deduplicated training dataset.

## Content availability versus event dates

| Family | Research clock and text |
| --- | --- |
| Official floor and raw committee/journal actions | Official event/hearing date, with date-exclusive cutoff. Keep amendment/procedural/passage meanings distinct; no inferred individual choices from voice votes. |
| Introduction authors | Every original journal introduction author, including authors absent from the current XML table. Journal date and printed order only. |
| Author changes | Separate dated `bill_author_added` / `bill_author_removed` journal events. A future removal never appears as a suffix on an earlier row. Semantic source keys, not positional vote-event rewrites. |
| Current XML author state | `bill_author_snapshot` at snapshot fetch date. Current role/order is never backdated to an earlier add or introduction. |
| Press articles | Full `raw_text`. Use the stored original archive observation where available, otherwise original fetch; a displayed article dateline does not date every word. |
| Questionnaires | Full ordered question/answer text. Use archived-response observation or fetch, never submission or an unverified publication assertion. |
| Scorecards, grades, organizational positions and publisher-reported votes | First matching original archived **body** or source fetch. A year in a URL, old CDX date, printed vote date or displayed publication date alone cannot date the snapshot. |
| Bill text captures | Full `raw_text` at capture/archived observation; posting assertions and Revisor XML insertion dates remain source metadata, not proof of current-body availability. |
| Testimony attachments | Use the earliest retained extracted body and its capture clock; never date newly fetched document wording to an older hearing. Original witness/hearing actions retain their hearing dates. |
| Candidate website words | Explicitly provenance-qualified literal website research lane and authenticated archive observation, without subjective stance certification. |
| Other stored public excerpts | Full excerpts from Senate member-linked durable evidence, conservatively dated to stored content observation. Legacy eligibility flags do not backdate them; finance is excluded. |
| Election results / district returns | Official recorded election facts under their existing event-date policy. District plans remain distinct. |

Current source rows remain intact. More conservative research dates can reduce historical coverage; that is preferable to silently leaking newer words. Missing first-public evidence remains unknown. Nullable or date-only provenance is never promoted into a precise timestamp.

## Committee and leadership roles

`senate_role_evidence_v` exposes the existing official/LRL source observations with member, session, role, committee, original words, source hash, observation date, stated source date and separately nullable effective start/end dates. The shared index includes `committee_role` and `leadership_role`. Unknown tenure is **not** expanded to the whole biennium. A historical page observed today does not establish when its wording was public. These are role observations, not a promise that a role remains current forever. Repeated same-body role ingestion now preserves the earliest retained fetch timestamp.

## Collection-to-consumer connection

The flat raw-vote views and official-text scanner include recovered `mn_senate_committee_minutes_pdf` documents. The incremental link repair connects raw statement/member/bill mentions and raw vote identities using the existing session-scoped resolver. Original text, non-null identities and official vote tables are preserved. Fingerprinted receipts include successful no-mention sources, avoid rescanning completed batches, and are not recorded if the underlying source changes during processing. Unresolved identities remain unresolved.

`.github/workflows/senate-evidence-repair-production.yml` runs on a reviewed marker-bearing main merge and bounded hourly continuation (`23 * * * *` UTC). Every run independently checks main, migrations, full CI and production dependency audit before the existing protected Neon environment. It applies only migration 0034 against the verified predecessor ledger, then performs idempotent bounded linking, journal author-event recovery and capped exact-body scorecard archive proof checks. SQL readbacks use READ ONLY / ROLLBACK; logs contain counts, not source words, people, UUIDs or credentials. No Vercel activation occurs.

## We have bill text; exact vote-paper identity is separate

```sql
SELECT text_source, count(*), count(DISTINCT bill_id)
FROM senate_bill_text_inventory_v GROUP BY text_source;
```

This inventory exposes both `bill_versions.raw_text` and append-only official raw captures. Legacy mutable bill-version bodies have NULL `observed_on` because their current words cannot safely inherit a creation or printed posting date after possible overwrites. The official raw store preserves numbered versions, unofficial engrossments, conference reports and any recovered proposed amendment blocks.

Having full text for a bill does **not** prove which paper a particular vote considered. Existing exact amendment-reference links remain explicit; same-bill candidates, companions, nearest dates and latest versions are not silently converted into exact vote-to-text matches. Complete event-to-version/adopted-amendment lineage remains separately measurable work.

## Historical lineage

Migrations 0032 and 0033 and their original frozen artifacts remain unchanged. The old scorecard CDX-date table is discovery metadata only; the repaired view no longer consumes it. New `senate_scorecard_content_observations` must match snapshot SHA before an earlier date is accepted. Historical candidate finance eligibility and model-promotion policies are unchanged.
