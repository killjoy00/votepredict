# Evidence cleanup inventory (Step 0 + PR 1)

Baseline: `9a97326b1fee310cb4f98b44d358e56f240a134b`. Static dependency inspection of the checked-out main branch before any research move. No production database or deployment commands were run.

## Scope and methodology

We collected tracked files using git ls-files and parsed TS/JS import/export edges (including literal dynamic import, require and type import) with the TypeScript compiler parser. Module names resolve using the tsconfig alias and bundler module resolution. YAML 1.2 parsing identified triggers, local reusable-workflow calls, scripts named in workflows, GitHub environments, and references to secrets. Reachability starts in all src/app, src/forecasting, src/lib and src/operations modules; scripts invoked by automatic/called workflows; and package scripts documented as routine in README.md or docs/OPERATIONS.md. For safety this inventory also treats scripts invoked from PROTECTED and unusual-event workflows as retained/live, even when not automatic. Manual-only and test-only reachability is recorded separately.

Files are not candidates merely because their names suggest an old Senate/Campaign Finance batch. Static reachability is a conservative safety test and does not establish whether a workflow has ever executed. No analysis depended on credentials or production data.

## Totals and stop condition

| Baseline item | Count |
|---|---:|
| Evidence modules before PR 1 | 304 |
| Evidence modules in the operational or protected dependency closure | 288 |
| Static nonlive module candidates | 16 |
| Conservatively retained because evaluation imports it | 1 |
| Evidence modules moved in PR 1 | 15 |
| Evidence modules remaining in src/evidence after PR 1 | 289 |
| Scripts moved with archival modules | 8 |
| Tests moved with archival modules | 16 |
| All workflow YAML | 685 |
| AUTOMATIC | 454 |
| CALLED | 0 |
| PROTECTED (not automatic/called) | 177 |
| AMBIGUOUS-LIVE unusual events | 30 |
| MANUAL-ONLY, unprotected | 24 |
| Workflow files referencing secrets.NEON_API_KEY | 36 |
| Workflow files referencing evidence-readonly-sandbox | 36 |
| Tracked scripts at baseline | 819 |
| Tracked tests at baseline | 757 |
| Audit and evaluation docs retained | 574 |

STOP CONDITION: 285 operational/protected-reachable evidence modules (286 counting an additional historical evaluation dependency) is dramatically above the target of 20-40. Existing workflow triggers are real: 453 have automatic push/PR/schedule triggers, while another 177 contain secrets or environments. Historical one-off code called from these is LIVE under the stated rules. PR 1 therefore preserves it rather than forcing the target. Separately reviewing/deactivating automatic historical audit triggers and consolidating protected workflows is needed before a larger code move; this would be a change to workflow behavior requiring its own review.

## Workflow classification policy

- AUTOMATIC: configured push/pull_request/pull_request_target/schedule trigger. This is a configured trigger, not evidence a job ran.
- CALLED: local workflow_call referenced by an AUTOMATIC workflow (transitively).
- PROTECTED: secret expression or GitHub environment, including workflows with workflow_dispatch only. Retained intact.
- AMBIGUOUS-LIVE: another event trigger such as workflow_run or repository_dispatch. Retained because its reachability is not safely ruled out.
- MANUAL-ONLY: no automatic, called or protected condition. Archive eligible in PR 3 only, after equivalent parameterized dispatch workflows are established.
- Both environment names and secret variable NAMES below are metadata only. No values are collected. A protected workflow can also be automatic; the primary class shows AUTOMATIC in that case.

## Live evidence sources (retained in src/evidence)

One line per retained module; the right side explains one discovered operational root or explicit exception.

- `src/evidence/ai-gateway-provider.ts` — `runtime`
- `src/evidence/bill-statement-extractor-v3.ts` — `workflow .github/workflows/quick-evidence-statement-v3-audit.yml`
- `src/evidence/bill-statement-extractor-v4.ts` — `workflow .github/workflows/quick-evidence-statement-v4-audit.yml`
- `src/evidence/bill-statement-extractor.ts` — `workflow .github/workflows/historical-density-2025-house-member-primary-bodies.yml`
- `src/evidence/campaign-archive-source-recovery.ts` — `workflow .github/workflows/acquire-senate-campaign-archive-public-sources.yml`
- `src/evidence/campaign-finance-live.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/campaign-finance-snapshot.ts` — `documented npm data:cfb:evidence`
- `src/evidence/campaign-finance-store.ts` — `runtime`
- `src/evidence/campaign-site-discovery.ts` — `runtime`
- `src/evidence/cfb-2021-22-served-d25-36-yearend-original-proof.ts` — `workflow .github/workflows/cfb-2021-22-served-d25-36-yearends.yml`
- `src/evidence/cfb-2021-22-served-sd25-36-30-amendments.ts` — `workflow .github/workflows/cfb-2021-22-served-sd25-36-30-amendments.yml`
- `src/evidence/cfb-2021-22-served-senator-amendments.ts` — `workflow .github/workflows/cfb-2021-22-served-26-amendment-originals.yml`
- `src/evidence/cfb-2021-22-served-senator-yearend-original-proof.ts` — `workflow .github/workflows/cfb-2021-22-served-yearend-originals.yml`
- `src/evidence/cfb-2021-24-senate-viewer-report-counts.ts` — `workflow .github/workflows/cfb-2021-24-senate-viewer-report-counts.yml`
- `src/evidence/cfb-2022-senate-original-ce-pdf-proof.ts` — `workflow .github/workflows/cfb-2022-senate-24-original-ce-pdf-proofs.yml`
- `src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.ts` — `workflow .github/workflows/cfb-2021-22-served-d25-36-yearends.yml`
- `src/evidence/cfb-2022-served-d25-36-original-ce.ts` — `workflow .github/workflows/cfb-2021-22-served-d25-36-yearends.yml`
- `src/evidence/cfb-2022-served-senators-next-original-ce.ts` — `workflow .github/workflows/cfb-2021-22-served-yearend-originals.yml`
- `src/evidence/cfb-2023-24-archived-pdf-publicby-proof.ts` — `workflow .github/workflows/cfb-2023-24-exact-version-wayback-publicby.yml`
- `src/evidence/cfb-2023-24-board-contemporaneous-yearend-filing-counts.ts` — `workflow .github/workflows/cfb-2023-24-original-board-yearend-operations.yml`
- `src/evidence/cfb-2023-24-eight-recovered-16-yearend-originals.ts` — `workflow .github/workflows/cfb-2023-24-16-sources.yml`
- `src/evidence/cfb-2023-24-eight-served-eleven-amendments.ts` — `workflow .github/workflows/cfb-2023-24-11-amended-pdf-source-proof.yml`
- `src/evidence/cfb-2023-24-held-source-pdf-diagnostics.ts` — `workflow .github/workflows/cfb-2023-24-two-held-pdf-source-diagnostics.yml`
- `src/evidence/cfb-2023-24-official-committee-status-proof.ts` — `workflow .github/workflows/cfb-22-historical-committee-registration-2024-board-proof.yml`
- `src/evidence/cfb-2023-24-original-10a245-committee-termination.ts` — `workflow .github/workflows/cfb-2023-24-original-10a245-committee-law.yml`
- `src/evidence/cfb-2023-24-original-revenue-pcr-proof.ts` — `workflow .github/workflows/cfb-original-2023-24-revenue-pcr-committee-identity.yml`
- `src/evidence/cfb-2023-24-served-28-yearend-originals.ts` — `workflow .github/workflows/cfb-2023-24-16-sources.yml`
- `src/evidence/cfb-2023-24-sixteen-parent-authenticated-amendments.ts` — `workflow .github/workflows/cfb-2023-24-11-amended-pdf-source-proof.yml`
- `src/evidence/cfb-2023-24-yearend-statutory-thresholds.ts` — `workflow .github/workflows/cfb-2023-24-original-yearend-legal-calendar-sources.yml`
- `src/evidence/cfb-2023-hoffman-original-board-committee-proof.ts` — `workflow .github/workflows/cfb-2023-hoffman-original-signed-board-committee-proof.yml`
- `src/evidence/cfb-2023-official-sos-senate-roster-service.ts` — `workflow .github/workflows/cfb-2023-original-sos-senate-roster-source.yml`
- `src/evidence/cfb-2024-eight-unobserved-verified-senator-viewers.ts` — `workflow .github/workflows/cfb-2024-eight-verified-senator-viewer-gap-discovery.yml`
- `src/evidence/cfb-2024-original-senate-seating-source.ts` — `workflow .github/workflows/cfb-2024-original-senate-seating-source.yml`
- `src/evidence/cfb-2025-dated-senate-registration-cohort.ts` — `workflow .github/workflows/cfb-2025-dated-senate-report-refs.yml`
- `src/evidence/cfb-2025-senate-special-original-pdf-proof.ts` — `workflow .github/workflows/cfb-2025-senate-special-original-pdf-proof.yml`
- `src/evidence/cfb-2025-served-sd29-seven-amendments.ts` — `workflow .github/workflows/cfb-2025-served-sd29-seven-amendment-pdfs.yml`
- `src/evidence/cfb-2025-served-sd6-report-obligation-case.ts` — `workflow .github/workflows/cfb-2025-served-sd6-obligation-source-reconciliation.yml`
- `src/evidence/cfb-2025-served-special-final-pdf-proof.ts` — `workflow .github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml`
- `src/evidence/cfb-2025-served-special-final-termination-markers.ts` — `workflow .github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml`
- `src/evidence/cfb-2025-served-two-ordinary-year-end-originals.ts` — `workflow .github/workflows/cfb-2025-served-two-ordinary-yearend-originals.yml`
- `src/evidence/cfb-2025-two-served-senators-special-yearend-conditional-duty.ts` — `workflow .github/workflows/cfb-2025-two-served-senators-conditional-yearend-duty.yml`
- `src/evidence/cfb-864-finance-db-reconciliation-v47.mjs` — `workflow .github/workflows/senate-864-source830-neon-finance-census-v47.yml`
- `src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs` — `workflow .github/workflows/senate-864-cfb-pdf-registry-neon-v48.yml`
- `src/evidence/cfb-board-filing-history.ts` — `workflow .github/workflows/source-expansion-cfb-filing-proofs.yml`
- `src/evidence/cfb-bulk-availability-repair.ts` — `workflow .github/workflows/source-expansion-cfb-bulk-availability-repair.yml`
- `src/evidence/cfb-candidate-finance-history.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-candidate-finance-membership-tail.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-candidate-finance-target-batches.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-candidate-membership-resolution.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-candidate-report-history.ts` — `workflow .github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml`
- `src/evidence/cfb-candidate-report-inventory.ts` — `workflow .github/workflows/cfb-2021-24-senate-viewer-report-counts.yml`
- `src/evidence/cfb-current-candidate-registry-join.ts` — `workflow .github/workflows/cfb-candidate-committee-list-source-shape.yml`
- `src/evidence/cfb-current-report-acquisition.ts` — `workflow .github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml`
- `src/evidence/cfb-historical-calendar-inventory.ts` — `workflow .github/workflows/cfb-2021-25-historical-calendar-index-probe.yml`
- `src/evidence/cfb-historical-official-filings.ts` — `runtime`
- `src/evidence/cfb-historical-release-audit.ts` — `workflow .github/workflows/cfb-2025-candidate-report-reference-probe.yml`
- `src/evidence/cfb-ie-historical-targets.ts` — `workflow .github/workflows/audit-cfb-availability-debt.yml`
- `src/evidence/cfb-independent-expenditure-history.ts` — `workflow .github/workflows/cfb-ie-historical-bounded-repair.yml`
- `src/evidence/cfb-lobbying-principal-history.ts` — `workflow .github/workflows/source-expansion-cfb-lobbying-principals.yml`
- `src/evidence/cfb-lobbying-summary-upper-bound.ts` — `workflow .github/workflows/cfb-lobbying-summary-upper-bound-salvage.yml`
- `src/evidence/cfb-pcf-report-history.ts` — `workflow .github/workflows/cfb-ie-historical-bounded-repair.yml`
- `src/evidence/cfb-report-availability.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-report-finance-mapper.ts` — `workflow .github/workflows/cfb-candidate-finance-bounded-repair.yml`
- `src/evidence/cfb-report-pdf-proof.ts` — `workflow .github/workflows/probe-514-cfb-ie-historical-report-body-proof.yml`
- `src/evidence/cfb-sd6-2025-report-pdf-probe.ts` — `workflow .github/workflows/cfb-sd6-2025-report-pdf-proof-probe.yml`
- `src/evidence/cfb-senate-2021-22-independent-calendar-audit.ts` — `workflow .github/workflows/cfb-2021-22-independent-senate-report-calendar-probe.yml`
- `src/evidence/cfb-senate-2021-22-year-end-source-proof.ts` — `workflow .github/workflows/cfb-2021-22-independent-senate-report-calendar-probe.yml`
- `src/evidence/cfb-senate-district-registration-inventory.ts` — `workflow .github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml`
- `src/evidence/cfb-two-terminated-original-report-investigation.ts` — `workflow .github/workflows/cfb-two-terminated-senate-original-2025-26-reports.yml`
- `src/evidence/deep-revision.ts` — `runtime`
- `src/evidence/diagnostics.ts` — `runtime`
- `src/evidence/durable-ingestion.ts` — `runtime`
- `src/evidence/evidence-quality-archive-audit-cohort.ts` — `workflow .github/workflows/evidence-quality-pre-vote-archive-proof.yml`
- `src/evidence/evidence-quality-archive-proof-canonical-v2.ts` — `workflow .github/workflows/evidence-quality-pre-vote-archive-proof-canonical-v2.yml`
- `src/evidence/evidence-quality-archive-proof-retry.ts` — `workflow .github/workflows/evidence-quality-pre-vote-archive-availability-fallback.yml`
- `src/evidence/evidence-quality-archive-proof.ts` — `workflow .github/workflows/evidence-quality-pre-vote-archive-availability-fallback.yml`
- `src/evidence/evidence-quality-classifier.ts` — `workflow .github/workflows/evidence-quality-backfill.yml`
- `src/evidence/evidence-quality-granular-availability-repair.ts` — `workflow .github/workflows/evidence-quality-granular-availability-repair.yml`
- `src/evidence/evidence-quality-historical-availability.ts` — `workflow .github/workflows/evidence-quality-granular-availability-repair.yml`
- `src/evidence/evidence-quality-historical-consumer.ts` — `workflow .github/workflows/evidence-quality-historical-coverage-audit.yml`
- `src/evidence/evidence-quality-recovery-exhaustion.ts` — `workflow .github/workflows/evidence-quality-pre-vote-candidate-inventory.yml`
- `src/evidence/evidence-quality-session-daily-review.ts` — `workflow .github/workflows/import-session-daily-evidence-quality.yml`
- `src/evidence/evidence-quality-single-source-recovery.ts` — `workflow .github/workflows/probe-historical-density-2021-single-source.yml`
- `src/evidence/evidence-quality-store.ts` — `workflow .github/workflows/evidence-quality-backfill.yml`
- `src/evidence/evidence-quality.ts` — `workflow .github/workflows/evidence-quality-backfill.yml`
- `src/evidence/failed-wayback-adjacent-probe.ts` — `workflow .github/workflows/probe-514-failed-wayback-adjacent.yml`
- `src/evidence/historical-archive-provider.ts` — evaluation dependency; retained under task prohibition on evaluation changes
- `src/evidence/historical-density-p2-applicability.ts` — `workflow .github/workflows/historical-density-p2-canonical-pipeline.yml`
- `src/evidence/historical-density-p2-canonical.ts` — `workflow .github/workflows/historical-density-p2-canonical-pipeline.yml`
- `src/evidence/historical-density-p2-remaining-applicability.ts` — `workflow .github/workflows/historical-density-p2-remaining-applicability-audit.yml`
- `src/evidence/historical-fiscal-note.ts` — `workflow .github/workflows/source-expansion-historical-fiscal-notes.yml`
- `src/evidence/historical-public-availability.ts` — `workflow .github/workflows/evidence-quality-granular-availability-plan.yml`
- `src/evidence/house-attachment-historical-density-archive-probe.ts` — `workflow .github/workflows/historical-density-house-attachment-ambiguous-retry.yml`
- `src/evidence/house-attachment-historical-density-archive-retry.ts` — `workflow .github/workflows/historical-density-house-attachment-ambiguous-retry.yml`
- `src/evidence/house-attachment-historical-density-selector.ts` — `workflow .github/workflows/historical-density-house-attachment-ambiguous-retry.yml`
- `src/evidence/house-committee-archive.ts` — `workflow .github/workflows/historical-density-house-attachment-selector.yml`
- `src/evidence/house-committee-attachment-content.ts` — `workflow .github/workflows/historical-density-house-attachment-selector.yml`
- `src/evidence/house-committee-attachment-wayback-bulk.ts` — `workflow .github/workflows/source-expansion-house-attachment-wayback.yml`
- `src/evidence/impact.ts` — `runtime`
- `src/evidence/issue-position-extractor.ts` — `workflow .github/workflows/senator-corpus-autopilot.yml`
- `src/evidence/legislative-speech.ts` — `runtime`
- `src/evidence/linear-batch-cursor.ts` — `workflow .github/workflows/senate-864-positional-event-key-gates.yml`
- `src/evidence/live-campaign-finance-refresh.ts` — `runtime`
- `src/evidence/local-trade-news-history.ts` — `workflow .github/workflows/senate-media-mpr-six-interviews-public-reconciliation.yml`
- `src/evidence/member-primary.ts` — `workflow .github/workflows/historical-density-2025-house-member-primary-inventory.yml`
- `src/evidence/minnesota-bill-context.ts` — `runtime`
- `src/evidence/minnesota-committee-rollcall.ts` — `runtime`
- `src/evidence/minnesota-election-context.ts` — `runtime`
- `src/evidence/minnesota-floor-conference.ts` — `runtime`
- `src/evidence/minnesota-hf100-conference-source-verifier.ts` — `workflow .github/workflows/senate-hf100-may19-original-conference-proof.yml`
- `src/evidence/minnesota-hf100-original-source-verifier.ts` — `workflow .github/workflows/senate-hf100-apr28-original-motion-text-proof.yml`
- `src/evidence/minnesota-official-motion-sequence.ts` — `workflow .github/workflows/senate-hf100-apr28-original-motion-text-proof.yml`
- `src/evidence/minnesota-senate-committee-minutes.ts` — `workflow .github/workflows/probe-senate-committee-vote-yield.yml`
- `src/evidence/minnesota-senate-committee-source.ts` — `workflow .github/workflows/historical-density-2023-24-senate-electronic-minute-target-overlap.yml`
- `src/evidence/minnesota-senate-media-archive.ts` — `workflow .github/workflows/historical-density-2021-senate-print-minute-target-priority.yml`
- `src/evidence/minnesota-senate-media.ts` — `workflow .github/workflows/probe-senate-caption-speaker-markers.yml`
- `src/evidence/organization-publication-history.ts` — `workflow .github/workflows/source-expansion-organization-publications.yml`
- `src/evidence/persisted-deep-research.ts` — `runtime`
- `src/evidence/policy.ts` — `runtime`
- `src/evidence/preloaded-context.ts` — `runtime`
- `src/evidence/prior-cycle-finance-context.ts` — `runtime`
- `src/evidence/production-refresh.ts` — `runtime`
- `src/evidence/provider.ts` — `runtime`
- `src/evidence/public-evidence-refresh.ts` — `runtime`
- `src/evidence/public-http.ts` — `runtime`
- `src/evidence/public-news.ts` — `runtime`
- `src/evidence/quick-evidence-v3-manual-reference.ts` — `workflow .github/workflows/quick-evidence-statement-v3-audit.yml`
- `src/evidence/repository.ts` — `runtime`
- `src/evidence/senate-2020-22-official-general-census.ts` — `workflow .github/workflows/acquire-senate-2020-22-public-originals.yml`
- `src/evidence/senate-2021-22-rule1210-three-original-journal-rolls.ts` — `workflow .github/workflows/senate-2021-original-sf1-committee-rule1210.yml`
- `src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.ts` — `workflow .github/workflows/senate-2021-apr08-four-lrl-full-original-sha-strict-second-duration.yml`
- `src/evidence/senate-2021-apr08-judiciary-caption-original-cue-review.ts` — `workflow .github/workflows/senate-2021-apr08-judiciary-strict-caption-cue-second-source.yml`
- `src/evidence/senate-2021-apr08-lrl-original-media-player-sources.ts` — `workflow .github/workflows/senate-2021-apr08-lrl-original-media-player-source-prefixes.yml`
- `src/evidence/senate-2021-apr08-original-media-source-gates.ts` — `workflow .github/workflows/senate-2021-apr08-judiciary-strict-caption-cue-second-source.yml`
- `src/evidence/senate-2021-apr08-rule1210-hearing-action-crosscheck.ts` — `workflow .github/workflows/senate-2021-apr08-original-bill-log-strict-second-pass.yml`
- `src/evidence/senate-2021-apr12-original-committee-redacted-layout.ts` — `workflow .github/workflows/senate-2021-apr12-original-rule1210-redacted-layout.yml`
- `src/evidence/senate-2021-apr12-rule1210-sf1159-sf970-lead-probe.ts` — `workflow .github/workflows/senate-2021-apr12-original-rule1210-redacted-layout.yml`
- `src/evidence/senate-2021-apr12-three-rule1210-original-amendments.ts` — `workflow .github/workflows/senate-2021-apr12-three-original-rule1210-amendment-rolls.yml`
- `src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.ts` — `workflow .github/workflows/senate-2021-apr12-three-rule1210-strict-original-second-pass.yml`
- `src/evidence/senate-2021-original-journal-misc-rule1210-index-source.ts` — `workflow .github/workflows/senate-2021-misc-journal-rule1210-index-original.yml`
- `src/evidence/senate-2021-rule1210-sf2-sf566-sf1457-original.ts` — `workflow .github/workflows/senate-2021-rule1210-sf2-sf566-sf1457-original.yml`
- `src/evidence/senate-2021-rule1210-sf910-original-journal-committee.ts` — `workflow .github/workflows/senate-2021-rule1210-sf910-original-journal.yml`
- `src/evidence/senate-2021-rule1210-two-original-journal-committee-rolls.ts` — `workflow .github/workflows/senate-2021-rule1210-two-original-committee-rolls.yml`
- `src/evidence/senate-2021-state-government-mar10-sf450-online-source.ts` — `workflow .github/workflows/senate-2021-mar10-sf450-online-original.yml`
- `src/evidence/senate-2022-candidate-survey-attribution-audit.ts` — `workflow .github/workflows/verify-senate-2022-survey-originals.yml`
- `src/evidence/senate-2022-feb08-caption-source-retry.ts` — `workflow .github/workflows/senate-2022-feb08-original-caption-retry.yml`
- `src/evidence/senate-2022-finance-apr07-original-seven-roll-verify.ts` — `workflow .github/workflows/senate-2022-finance-apr07-original-seven-roll-pdf-proof.yml`
- `src/evidence/senate-2022-propertytaxes-mar30-sf3882-online-roll.ts` — `workflow .github/workflows/senate-2022-mar30-sf3882-propertytaxes-online-original.yml`
- `src/evidence/senate-2022-verified-served-domain-archive.ts` — `workflow .github/workflows/acquire-senate-2022-served-domain-wide.yml`
- `src/evidence/senate-2023-apr27-third-caption-strict-source.ts` — `workflow .github/workflows/senate-2023-apr27-third-caption-strict-cues.yml`
- `src/evidence/senate-2023-taxes-third-original-caption-source.ts` — `workflow .github/workflows/senate-2023-apr27-third-caption-original.yml`
- `src/evidence/senate-2023-transportation-apr03-sf3157-source.ts` — `workflow .github/workflows/senate-2023-transportation-apr03-sf3157-html-entities-retry.yml`
- `src/evidence/senate-2024-education-repeated-amendment-rolls.ts` — `workflow .github/workflows/senate-2024-education-repeated-original-rolls.yml`
- `src/evidence/senate-2025-elections-apr08-a10-source.ts` — `workflow .github/workflows/senate-2025-elections-apr08-a10-source.yml`
- `src/evidence/senate-2025-elections-apr08-a11-source.ts` — `workflow .github/workflows/senate-2025-elections-apr08-a11-scoped-retry.yml`
- `src/evidence/senate-2025-elections-apr08-second-ten-zero-one-source.ts` — `workflow .github/workflows/senate-2025-elections-apr08-other-10-0-1-retry.yml`
- `src/evidence/senate-2025-elections-eight-motion-context.ts` — `workflow .github/workflows/senate-2025-elections-eight-original-motion-contexts.yml`
- `src/evidence/senate-2025-elections-feb06-filed-a2-original-source.ts` — `workflow .github/workflows/senate-2025-elections-feb06-filed-a2-original.yml`
- `src/evidence/senate-2025-elections-remaining-thirteen-attendance.ts` — `workflow .github/workflows/senate-2025-elections-four-originals-thirteen-attendance.yml`
- `src/evidence/senate-2025-elections-two-held-original-attendance.ts` — `workflow .github/workflows/senate-2025-elections-two-held-original-attendance.yml`
- `src/evidence/senate-864-2022-25-official-original-minutes-overlay.ts` — `workflow .github/workflows/senate-864-all-source-action-inventory.yml`
- `src/evidence/senate-864-2022-housing-orphan-minutes-original-pdf.ts` — `workflow .github/workflows/senate-864-2022-housing-orphan-original-pdf.yml`
- `src/evidence/senate-864-2023-online-missing-minutes.ts` — `workflow .github/workflows/senate-864-2023-online-missing-minute-originals.yml`
- `src/evidence/senate-864-2023-remaining-clerk-original-source.ts` — `workflow .github/workflows/senate-864-2023-remaining-50-original-clerk.yml`
- `src/evidence/senate-864-2024-25-three-high-gap-clerk-source.ts` — `workflow .github/workflows/senate-864-high-gap-2024-25-original-clerk-minutes.yml`
- `src/evidence/senate-864-2024-lrl-year-service-directory-semantic-v14.ts` — `workflow .github/workflows/senate-864-2024-single-yea-semantic-lrl-v15.yml`
- `src/evidence/senate-864-2024-lrl-year-service-directory-v12.ts` — `workflow .github/workflows/senate-864-2024-single-yea-bounded-pdf-lrl-v13.yml`
- `src/evidence/senate-864-2024-lrl-year-service-directory.ts` — `workflow .github/workflows/senate-864-2024-single-yea-lrl-service-v11.yml`
- `src/evidence/senate-864-2024-original-pdf-bounded-v13.ts` — `workflow .github/workflows/senate-864-2024-single-yea-bounded-pdf-lrl-v13.yml`
- `src/evidence/senate-864-2024-yea-v10-roster-safe-scalars.ts` — `workflow .github/workflows/senate-864-2024-single-yea-backfill-roster-v10.yml`
- `src/evidence/senate-864-2024-yea-v11-lrl-safe-scalars.ts` — `workflow .github/workflows/senate-864-2024-single-yea-bounded-pdf-lrl-v13.yml`
- `src/evidence/senate-864-2024-yea-v15-lrl-semantic-safe-scalars.ts` — `workflow .github/workflows/senate-864-2024-single-yea-semantic-lrl-v15.yml`
- `src/evidence/senate-864-2024-yea-v9-safe-scalars.ts` — `workflow .github/workflows/senate-864-2024-single-yea-exact-output-v9.yml`
- `src/evidence/senate-864-2026-incumbent-source-parity.mjs` — `workflow .github/workflows/senate-864-2026-49-incumbent-existing-neon-parity-v2.yml`
- `src/evidence/senate-864-2026-verified-positions.mjs` — `workflow .github/workflows/senate-864-2026-current-direct-position-publisher-qa.yml`
- `src/evidence/senate-864-568-zero-action-original-triage.ts` — `workflow .github/workflows/senate-864-next64-zero-action-original-source-recall.yml`
- `src/evidence/senate-864-72-historical-source-ingest-plan.mjs` — `workflow .github/workflows/senate-864-72-original-pages-neon-import.yml`
- `src/evidence/senate-864-72-neon-readback.mjs` — `workflow .github/workflows/senate-864-72-original-pages-neon-import.yml`
- `src/evidence/senate-864-72-original-neon-draft.mjs` — `workflow .github/workflows/senate-864-72-original-pages-neon-import.yml`
- `src/evidence/senate-864-72-protected-event.mjs` — `workflow .github/workflows/senate-864-72-original-pages-neon-import.yml`
- `src/evidence/senate-864-95-historical-source-neon-parity.mjs` — `workflow .github/workflows/senate-864-95-historical-source-neon-readonly.yml`
- `src/evidence/senate-864-95-original-archive-url-diagnostics.mjs` — `workflow .github/workflows/senate-864-95-historical-source-neon-readonly.yml`
- `src/evidence/senate-864-all-source-action-inventory.ts` — `workflow .github/workflows/senate-864-all-source-action-inventory.yml`
- `src/evidence/senate-864-clerk-written-source-db-audit.ts` — `workflow .github/workflows/senate-864-all-clerk-stored-readonly.yml`
- `src/evidence/senate-864-committee-coverage-gap-gates.ts` — `workflow .github/workflows/senate-864-independent-committee-year-ledger.yml`
- `src/evidence/senate-864-eleven-original-printed-minutes-overlay.ts` — `workflow .github/workflows/senate-864-all-source-action-inventory.yml`
- `src/evidence/senate-864-held-original-pdf-print-identity.ts` — `workflow .github/workflows/senate-864-19-held-original-lrl-pdf-diagnostic.yml`
- `src/evidence/senate-864-historical-site-excerpt-asof.mjs` — `workflow .github/workflows/senate-864-campaign-website-asof-minimal.yml`
- `src/evidence/senate-864-independent-committee-meeting-ledger.ts` — `workflow .github/workflows/senate-864-independent-committee-year-ledger.yml`
- `src/evidence/senate-864-lrl-2024-service-semantic-v14.ts` — `workflow .github/workflows/senate-864-2024-single-yea-semantic-lrl-v15.yml`
- `src/evidence/senate-864-nonstandard-lrl-minutes-source.ts` — `workflow .github/workflows/senate-864-nonstandard-official-minutes-29-source.yml`
- `src/evidence/senate-864-original-motion-action-boundaries.ts` — `workflow .github/workflows/senate-864-26-embedded-original-motion-boundary-review.yml`
- `src/evidence/senate-864-original-motion-cue-review.ts` — `workflow .github/workflows/senate-864-26-embedded-original-motion-boundary-review.yml`
- `src/evidence/senate-864-other-24-original-clerk-probe.ts` — `workflow .github/workflows/senate-864-other-24-original-clerk-2022-25.yml`
- `src/evidence/senate-864-pre2018-commoncrawl-provenance.mjs` — `workflow .github/workflows/senate-864-pre2018-independent-commoncrawl-campaign-site-probe.yml`
- `src/evidence/senate-864-rules-sf1-alias-hypotheses.ts` — `workflow .github/workflows/senate-864-2023-rules-sf1-stored-readonly.yml`
- `src/evidence/senate-864-rules-sf1-source-to-db-parity.ts` — `workflow .github/workflows/senate-864-2023-rules-sf1-stored-readonly.yml`
- `src/evidence/senate-864-source-db-sanitized-compare.ts` — `workflow .github/workflows/senate-864-2024-single-yea-backfill-roster-v10.yml`
- `src/evidence/senate-864-website-signal-neon.mjs` — `workflow .github/workflows/senate-864-campaign-website-asof-minimal.yml`
- `src/evidence/senate-864-website-signal-readback.mjs` — `workflow .github/workflows/senate-864-campaign-website-asof-minimal.yml`
- `src/evidence/senate-authenticated-campaign-excerpt-audit.ts` — `workflow .github/workflows/acquire-2022-six-further-actually-served-senators-originals.yml`
- `src/evidence/senate-bill-ingebrigtsen-historic-27-original-site-excerpts-proof.ts` — `workflow .github/workflows/audit-bill-ingebrigtsen-27-exact-historical-original-policy-quotes.yml`
- `src/evidence/senate-campaign-winner-membership-reconciliation.ts` — `workflow .github/workflows/audit-senate-campaign-neon-readonly-once.yml`
- `src/evidence/senate-capture-dated-2020-22-original-campaign-109-excerpts.ts` — `workflow .github/workflows/audit-109-senator-2020-22-capture-dated-policy-quotes.yml`
- `src/evidence/senate-carla-nelson-2022-original-platform-audit.ts` — `workflow .github/workflows/audit-carla-2022-original-platform-proof.yml`
- `src/evidence/senate-committee-100-no-label-roll-review.ts` — `workflow .github/workflows/senate-committee-100-no-label-roll-source.yml`
- `src/evidence/senate-committee-138-caption-surface.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-138-mtgid-head-source.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-138-record-html-metadata.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-15-named-ocr-review.ts` — `workflow .github/workflows/senate-committee-15-named-roll-integrity.yml`
- `src/evidence/senate-committee-19-original-date-attendance-review.ts` — `workflow .github/workflows/senate-committee-19-original-date-attendance.yml`
- `src/evidence/senate-committee-2022-caption-motion-source.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-2023-24-scanned-catchup.ts` — `workflow .github/workflows/senate-committee-2023-24-remaining-scans-ocr.yml`
- `src/evidence/senate-committee-2023-caption-motion-source.ts` — `workflow .github/workflows/senate-2023-64-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-2023-elections-attendance-headers.ts` — `workflow .github/workflows/senate-committee-seven-2023-attendance.yml`
- `src/evidence/senate-committee-2023-elections-roll-roster-audit.ts` — `workflow .github/workflows/senate-committee-2023-elections-roll-roster.yml`
- `src/evidence/senate-committee-2024-caption-motion-source.ts` — `workflow .github/workflows/senate-2024-41-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-2025-elections-15-roster-review.ts` — `workflow .github/workflows/senate-committee-2025-elections-15-roster.yml`
- `src/evidence/senate-committee-2025-judiciary-ocr-roll-proof.ts` — `workflow .github/workflows/senate-864-2025-judiciary-full-original-neon-v5.yml`
- `src/evidence/senate-committee-41-strong-roll-original-review.ts` — `workflow .github/workflows/senate-2025-elections-four-originals-thirteen-attendance.yml`
- `src/evidence/senate-committee-caption-motion-cues-v2.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-caption-motion-cues.ts` — `workflow .github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml`
- `src/evidence/senate-committee-date-section.ts` — `workflow .github/workflows/senate-committee-141-missing-minutes-alternate-pages.yml`
- `src/evidence/senate-committee-dated-media-link-proof.ts` — `workflow .github/workflows/senate-committee-141-media-href-resolution.yml`
- `src/evidence/senate-committee-final-ocr-cohort.ts` — `workflow .github/workflows/senate-committee-final-152-scanned-ocr.yml`
- `src/evidence/senate-committee-hearing-repair-plan.ts` — `runtime`
- `src/evidence/senate-committee-meeting-census.ts` — `workflow .github/workflows/senate-committee-2021-25-electronic-meeting-census.yml`
- `src/evidence/senate-committee-meeting-timing.ts` — `workflow .github/workflows/senate-864-positional-event-key-gates.yml`
- `src/evidence/senate-committee-missing-minutes-official-queue.ts` — `workflow .github/workflows/senate-864-2023-online-missing-minute-originals.yml`
- `src/evidence/senate-committee-nine-no-label-counted-rolls.ts` — `workflow .github/workflows/senate-committee-nine-unparsed-numeric-originals.yml`
- `src/evidence/senate-committee-original-pdf-action-audit.ts` — `workflow .github/workflows/senate-committee-2022-25-original-pdf-action-audit.yml`
- `src/evidence/senate-committee-scanned-ocr-pilot.ts` — `workflow .github/workflows/senate-committee-2025-judiciary-original-named-roll-proof.yml`
- `src/evidence/senate-committee-source-to-db-reconciliation.ts` — `workflow .github/workflows/senate-864-2025-judiciary-full-original-neon-v5.yml`
- `src/evidence/senate-committee-strict-caption-cue-summary.ts` — `workflow .github/workflows/senate-2025-22-caption-motion-cues-v2.yml`
- `src/evidence/senate-committee-supplemental-named-roll-review.ts` — `workflow .github/workflows/senate-2025-elections-four-originals-thirteen-attendance.yml`
- `src/evidence/senate-committee-unparsed-roll-review.ts` — `workflow .github/workflows/senate-committee-100-no-label-roll-source.yml`
- `src/evidence/senate-commoncrawl-historical-recovery.ts` — `workflow .github/workflows/acquire-senate-campaign-archive-public-sources.yml`
- `src/evidence/senate-commoncrawl-warc-proof.ts` — `workflow .github/workflows/acquire-senate-campaign-archive-public-sources.yml`
- `src/evidence/senate-five-additional-served-2022-original-candidate-quote-audit.ts` — `workflow .github/workflows/audit-five-additional-2022-original-candidate-site-exact-quotes.yml`
- `src/evidence/senate-five-further-2022-capture-dated-62-original-campaign-excerpts.ts` — `workflow .github/workflows/audit-five-further-senator-62-original-2022-capture-dated-quotes.yml`
- `src/evidence/senate-five-new-served-2022-97-capture-dated-exact-campaign-excerpts.ts` — `workflow .github/workflows/audit-five-new-senators-2022-original-97-policy-capture-dates.yml`
- `src/evidence/senate-former-member-archive.ts` — `workflow .github/workflows/probe-514-senate-former-member-archive.yml`
- `src/evidence/senate-four-more-2022-original-capture-dated-77-excerpts.ts` — `workflow .github/workflows/audit-four-more-senators-77-original-capture-dated-2022-excerpts.yml`
- `src/evidence/senate-four-new-2022-original-campaign-excerpt-proof.ts` — `workflow .github/workflows/audit-four-new-2022-served-campaign-exact-issue-quotes.yml`
- `src/evidence/senate-justin-eichorn-2016-original-12-quote-proof.ts` — `workflow .github/workflows/audit-justin-eichorn-2016-original-12-exact-issues-policy-quotes.yml`
- `src/evidence/senate-kent-eken-2020-13-historical-campaign-excerpt-proof.ts` — `workflow .github/workflows/audit-kent-eken-2020-original-13-policy-excerpts.yml`
- `src/evidence/senate-lrl-2021-25-calendar-year-service-window.ts` — `workflow .github/workflows/audit-senate-lrl-2021-25-service-year-overlap.yml`
- `src/evidence/senate-lrl-explicit-historic-person-proofs.ts` — `workflow .github/workflows/audit-senate-statewide-campaign-sources.yml`
- `src/evidence/senate-media-bigham-eken-2022-original-speaker-audit.ts` — `workflow .github/workflows/senate-media-bigham-eken-2022-original-cues.yml`
- `src/evidence/senate-media-broader-original-wayback.ts` — `workflow .github/workflows/senate-media-25-original-wayback.yml`
- `src/evidence/senate-media-eight-early-original-text-audit.ts` — `workflow .github/workflows/senate-media-eight-early-original-phrases.yml`
- `src/evidence/senate-media-historical-phrase-presence.ts` — `workflow .github/workflows/senate-media-historical-original-phrases.yml`
- `src/evidence/senate-media-independent-reporter-15-wayback.ts` — `workflow .github/workflows/senate-media-independent-reporter-15-wayback.yml`
- `src/evidence/senate-media-independent-reporter-dual-original-phrase-audit.ts` — `workflow .github/workflows/senate-media-independent-two-reporter-speaker-phrases.yml`
- `src/evidence/senate-media-new-public-remarks-wayback.ts` — `workflow .github/workflows/senate-media-new-public-remarks-wayback.yml`
- `src/evidence/senate-media-pinned-public-passage-audit.ts` — `workflow .github/workflows/senate-media-pinned-original-passage-proof.yml`
- `src/evidence/senate-media-public-discovery-gaps.ts` — `workflow .github/workflows/senate-media-public-wayback-proof-batch.yml`
- `src/evidence/senate-media-public-proof-batch.ts` — `workflow .github/workflows/senate-media-public-wayback-proof-batch.yml`
- `src/evidence/senate-media-public-wayback-probe.ts` — `workflow .github/workflows/senate-media-public-wayback-proof-batch.yml`
- `src/evidence/senate-media-readonly-export.ts` — `workflow .github/workflows/senate-864-existing-neon-key-cross-track-counts.yml`
- `src/evidence/senate-media-reformer-four-original-url-alias-proof.ts` — `workflow .github/workflows/senate-media-reformer-four-original-aliases.yml`
- `src/evidence/senate-media-rest-2023-original-quote-audit.ts` — `workflow .github/workflows/senate-media-rest-2023-original-quote-cues.yml`
- `src/evidence/senate-media-seven-independent-articles-original-quote-audit.ts` — `workflow .github/workflows/senate-media-seven-further-reporter-phrases.yml`
- `src/evidence/senate-media-three-missing-newsroom-brief-original-audit.ts` — `workflow .github/workflows/senate-media-three-missing-reformer-briefs.yml`
- `src/evidence/senate-media-three-reporter-original-quote-audit.ts` — `workflow .github/workflows/senate-media-3-reporter-original-quote-cues.yml`
- `src/evidence/senate-nick-frentz-2022-26-original-capture-dated-campaign-issue-proof.ts` — `workflow .github/workflows/audit-nick-frentz-2022-original-26-capture-dated-quotes.yml`
- `src/evidence/senate-nicole-mitchell-2022-original-issue-proof.ts` — `workflow .github/workflows/audit-senate-nicole-2022-original-priorities.yml`
- `src/evidence/senate-official-ever-served-directory.ts` — `workflow .github/workflows/acquire-2022-ever-served-senate-campaign-pages.yml`
- `src/evidence/senate-only-dated-campaign-issue-leads.ts` — `workflow .github/workflows/audit-senate-only-dated-campaign-issues.yml`
- `src/evidence/senate-ruud-2013-chamberlain-2022-26-original-excerpts-proof.ts` — `workflow .github/workflows/audit-ruud-chamberlain-26-historical-first-party-exact-site-excerpts.yml`
- `src/evidence/senate-served-2022-25-original-campaign-statement-expansion.ts` — `workflow .github/workflows/audit-senate-expanded-original-campaign-statements.yml`
- `src/evidence/senate-seven-served-person-dated-campaign-coverage.ts` — `workflow .github/workflows/audit-senate-seven-served-dated-issues.yml`
- `src/evidence/senate-six-served-person-dated-campaign-coverage.ts` — `workflow .github/workflows/audit-senate-six-served-dated-issues.yml`
- `src/evidence/senate-sos-original-candidate-website-table.mjs` — `workflow .github/workflows/senate-864-original-sos-2020-22-website-table-field-audit.yml`
- `src/evidence/senate-statewide-winner-campaign-source-coverage.ts` — `workflow .github/workflows/audit-senate-statewide-campaign-sources.yml`
- `src/evidence/senate-three-new-served-2022-original-campaign-issue-proof.ts` — `workflow .github/workflows/audit-senate-three-new-served-2022-original-statement-excerpts.yml`
- `src/evidence/senate-three-unobserved-2022-campaign-original-archive.ts` — `workflow .github/workflows/senate-864-three-unobserved-original-campaign-sites.yml`
- `src/evidence/senate-two-2021-serving-2020-41-original-capture-dated-policy-proof.ts` — `workflow .github/workflows/audit-two-former-senators-2020-original-41-policy-dated-excerpts.yml`
- `src/evidence/senate-two-more-2021-serving-2020-campaign-47-original-quote-proof.ts` — `workflow .github/workflows/audit-two-2021-serving-senators-2020-original-47-policy-quotes.yml`
- `src/evidence/session-daily-archive.ts` — `runtime`
- `src/evidence/sos-senate-historical-candidate-inventory.ts` — `workflow .github/workflows/audit-senate-campaign-neon-readonly-once.yml`
- `src/evidence/structured-public-refresh.ts` — `runtime`
- `src/evidence/targeting.ts` — `runtime`
- `src/evidence/temporal-statement-history.ts` — `runtime`
- `src/evidence/types.ts` — `runtime`
- `src/evidence/wayback-availability.ts` — `workflow .github/workflows/evidence-quality-pre-vote-archive-availability-fallback.yml`
- `src/evidence/wayback-campaign-version-plan.ts` — `workflow .github/workflows/acquire-senate-campaign-archive-public-sources.yml`
- `src/evidence/wayback-public-evidence-backfill.ts` — `workflow .github/workflows/probe-514-failed-wayback-adjacent.yml`
- `src/evidence/wayback.ts` — `workflow .github/workflows/acquire-2022-ever-served-senate-campaign-pages.yml`

## Evidence modules moved out of src/evidence

These 15 source files had no automatic/runtime/protected import path and no non-research code import path.

- `src/evidence/campaign-issue-platform-audit.ts` → `research/evidence/campaign-issue-platform-audit.ts`
- `src/evidence/cfb-2023-24-71-version-disclosure-barriers.ts` → `research/evidence/cfb-2023-24-71-version-disclosure-barriers.ts`
- `src/evidence/cfb-2025-senate-special-12-due-vs-received-audit.ts` → `research/evidence/cfb-2025-senate-special-12-due-vs-received-audit.ts`
- `src/evidence/cfb-senate-pinned-ledger-coverage.ts` → `research/evidence/cfb-senate-pinned-ledger-coverage.ts`
- `src/evidence/minnesota-vote-text-alignment-audit.ts` → `research/evidence/minnesota-vote-text-alignment-audit.ts`
- `src/evidence/senate-2025-special-primary-audit.ts` → `research/evidence/senate-2025-special-primary-audit.ts`
- `src/evidence/senate-864-fourteen-written-minute-source-holds.ts` → `research/evidence/senate-864-fourteen-written-minute-source-holds.ts`
- `src/evidence/senate-864-positional-event-key-replay-risk.ts` → `research/evidence/senate-864-positional-event-key-replay-risk.ts`
- `src/evidence/senate-864-public-social-post-source-boundary.mjs` → `research/evidence/senate-864-public-social-post-source-boundary.mjs`
- `src/evidence/senate-864-verified-motion-addition-plan.ts` → `research/evidence/senate-864-verified-motion-addition-plan.ts`
- `src/evidence/senate-media-archive-rehydration.ts` → `research/evidence/senate-media-archive-rehydration.ts`
- `src/evidence/senate-media-batch-reconciliation.ts` → `research/evidence/senate-media-batch-reconciliation.ts`
- `src/evidence/senate-media-offline-proof-reconciliation.ts` → `research/evidence/senate-media-offline-proof-reconciliation.ts`
- `src/evidence/senate-media-remarks-audit.ts` → `research/evidence/senate-media-remarks-audit.ts`
- `src/evidence/senate-primary-ballot-observation-audit.ts` → `research/evidence/senate-primary-ballot-observation-audit.ts`

## Script and test movement ledger

Every script/test in the dependency closure of the moved evidence modules was moved using git mv. Tests remain runnable as opt-in research tests and no longer participate in npm test.

- `scripts/audit-campaign-issue-platforms-offline.ts` → `research/scripts/audit-campaign-issue-platforms-offline.ts`
- `scripts/audit-cfb-senate-pinned-ledgers-offline.ts` → `research/scripts/audit-cfb-senate-pinned-ledgers-offline.ts`
- `scripts/audit-senate-2025-special-primary-offline.ts` → `research/scripts/audit-senate-2025-special-primary-offline.ts`
- `scripts/audit-senate-media-remarks-offline.ts` → `research/scripts/audit-senate-media-remarks-offline.ts`
- `scripts/audit-senate-primary-ballot-observations-offline.ts` → `research/scripts/audit-senate-primary-ballot-observations-offline.ts`
- `scripts/reconcile-senate-media-batches-private.ts` → `research/scripts/reconcile-senate-media-batches-private.ts`
- `scripts/reconcile-senate-media-offline-private.ts` → `research/scripts/reconcile-senate-media-offline-private.ts`
- `scripts/rehydrate-senate-media-archive-private.ts` → `research/scripts/rehydrate-senate-media-archive-private.ts`
- `tests/campaign-issue-platform-audit.test.ts` → `research/tests/campaign-issue-platform-audit.test.ts`
- `tests/cfb-2023-24-71-version-disclosure-barriers.test.ts` → `research/tests/cfb-2023-24-71-version-disclosure-barriers.test.ts`
- `tests/cfb-2025-senate-special-12-due-vs-received-audit.test.ts` → `research/tests/cfb-2025-senate-special-12-due-vs-received-audit.test.ts`
- `tests/cfb-senate-pinned-ledger-coverage.test.ts` → `research/tests/cfb-senate-pinned-ledger-coverage.test.ts`
- `tests/minnesota-vote-text-alignment-audit.test.ts` → `research/tests/minnesota-vote-text-alignment-audit.test.ts`
- `tests/senate-2025-special-primary-audit.test.ts` → `research/tests/senate-2025-special-primary-audit.test.ts`
- `tests/senate-864-fourteen-written-minute-source-holds.test.ts` → `research/tests/senate-864-fourteen-written-minute-source-holds.test.ts`
- `tests/senate-864-positional-event-key-risk.test.ts` → `research/tests/senate-864-positional-event-key-risk.test.ts`
- `tests/senate-864-public-social-post-source-boundary.test.mjs` → `research/tests/senate-864-public-social-post-source-boundary.test.mjs`
- `tests/senate-864-verified-motion-addition-plan.test.ts` → `research/tests/senate-864-verified-motion-addition-plan.test.ts`
- `tests/senate-media-archive-rehydration.test.ts` → `research/tests/senate-media-archive-rehydration.test.ts`
- `tests/senate-media-batch-reconciliation-cli.test.ts` → `research/tests/senate-media-batch-reconciliation-cli.test.ts`
- `tests/senate-media-batch-reconciliation.test.ts` → `research/tests/senate-media-batch-reconciliation.test.ts`
- `tests/senate-media-offline-proof-reconciliation.test.ts` → `research/tests/senate-media-offline-proof-reconciliation.test.ts`
- `tests/senate-media-remarks-audit.test.ts` → `research/tests/senate-media-remarks-audit.test.ts`
- `tests/senate-primary-ballot-observation-audit.test.ts` → `research/tests/senate-primary-ballot-observation-audit.test.ts`

## Evaluated exception and excluded script candidates

The static graph initially marked src/evidence/historical-archive-provider.ts nonlive, but src/evaluation/historical-deep-impact-replay.ts imports it, and the task forbids modifying evaluation sources or results. It therefore stays put. Historical-deep evaluation scripts and their still-dispatchable manual workflows also remain in their existing locations. Other scripts not in the operational/protected graph are listed below for separate review but are out of scope for PR 1 unless they depend on an archived evidence module.

- `scripts/analyze-historical-deep-house-journal-post-holdout.ts`
- `scripts/apply-house-outcomes.ts`
- `scripts/audit-authenticated-senate-campaign-excerpts-offline.ts`
- `scripts/audit-bill-features.ts`
- `scripts/audit-cfb-historical-release-offline.ts`
- `scripts/audit-evidence-operating-posture.ts`
- `scripts/audit-forecast-target-selection.ts`
- `scripts/audit-historical-deep-expansion-actionability.ts`
- `scripts/audit-historical-deep-expansion-source-gaps.ts`
- `scripts/audit-revisor-action-history.ts`
- `scripts/audit-revisor-source-passage-search.ts`
- `scripts/audit-senate-commoncrawl-offline.ts`
- `scripts/audit-sos-senate-campaign-inventory-offline.ts`
- `scripts/build-deep-replay-cohort.ts`
- `scripts/classify-historical-deep-house-journal-holdout-mechanics.ts`
- `scripts/classify-historical-deep-house-journal-mechanics.ts`
- `scripts/classify-historical-deep-procedural-mechanics.ts`
- `scripts/collect-historical-deep-expansion-sources.ts`
- `scripts/collect-historical-deep-house-journal-holdout-sources.ts`
- `scripts/collect-historical-deep-house-journal-sources.ts`
- `scripts/collect-historical-deep-pilot-sources.ts`
- `scripts/diagnose-gambling-model.ts`
- `scripts/evaluate-analogue-lift.ts`
- `scripts/evaluate-coalition-chamber.ts`
- `scripts/evaluate-deep-vs-quick.ts`
- `scripts/evaluate-full-universe-stage-baseline.ts`
- `scripts/evaluate-historical-deep-expansion-impact-replay-v2.ts`
- `scripts/evaluate-historical-deep-expansion-impact-replay.ts`
- `scripts/evaluate-historical-deep-impact-replay.ts`
- `scripts/evaluate-historical-deep-targeted-impact-replay.ts`
- `scripts/evaluate-historical-quick-replay.ts`
- `scripts/evaluate-member-history-cap.ts`
- `scripts/export-revisor-source-passage-snapshot.ts`
- `scripts/export-senate-media-readonly.ts`
- `scripts/extract-historical-deep-discovery-candidates.ts`
- `scripts/extract-historical-deep-expansion-candidates-v2.ts`
- `scripts/extract-historical-deep-expansion-candidates.ts`
- `scripts/extract-quick-evidence-committee-rollcalls.ts`
- `scripts/ingest-house-history.ts`
- `scripts/ingest-live-revisor-status.ts`
- `scripts/ingest-live-revisor-universe.ts`
- `scripts/ingest-lrl-memberships.ts`
- `scripts/inspect-bill-analogues.ts`
- `scripts/inspect-house-votes.ts`
- `scripts/inspect-senate-journals.ts`
- `scripts/plan-campaign-wayback-versions-offline.ts`
- `scripts/plan-senate-campaign-archive-source-recovery-offline.ts`
- `scripts/plan-senate-committee-hearing-repair-offline.ts`
- `scripts/probe-senate-media-2022-standalone-parents-bills-primary.mjs`
- `scripts/probe-senate-media-2023-hf100-crossparty-candidates.mjs`
- `scripts/probe-senate-media-2023-hf100-crossparty-originals.mjs`
- `scripts/probe-senate-media-2023-hf100-no-originals.mjs`
- `scripts/probe-senate-media-public-wayback.ts`
- `scripts/reconcile-house-member-votes.ts`
- `scripts/reconcile-member-votes.ts`
- `scripts/reconcile-senate-campaign-winners-offline.ts`
- `scripts/reconcile-senate-committee-actions-offline.ts`
- `scripts/recover-house-outcomes.ts`
- `scripts/rehearse-lifecycle-p8-daily-capture.ts`
- `scripts/report-senate-media-public-discovery-gaps.ts`
- `scripts/run-production-evidence-refresh.ts`
- `scripts/run-production-public-evidence-refresh.ts`
- `scripts/run-production-revisor-introduction-audit.ts`
- `scripts/run-production-revisor-universe-refresh.ts`
- `scripts/score-historical-deep-expansion-discovery-v2.ts`
- `scripts/score-historical-deep-house-journal-mechanics.ts`
- `scripts/score-historical-deep-procedural-mechanics.ts`
- `scripts/seed-evidence-bills.ts`
- `scripts/smoke-official-sources.ts`
- `scripts/verify-lifecycle-p8-frozen-model-offline.ts`

## Refresh modules: inputs, outputs, tables and live callers

These four similarly named modules do not represent one equivalent job; PR 2 needs parity fixtures before merging any overlap. Tables include direct queries and side effects reached via imported ingestion helpers.

| Module | Inputs and source scope | Outputs/tables touched | Direct callers |
|---|---|---|---|
| `src/evidence/structured-public-refresh.ts` | runStructuredPublicRefresh(options): MN House Session Daily, committee minutes, conference committees, SOS election files, House bill summaries and fiscal notes; configurable session/member/bill slices. | Looks up legislative_sessions, memberships, legislators, chambers, bills, vote_events, evidence_items; writes ingestion_runs and durable evidence_items through helpers. | `src/evidence/public-evidence-refresh.ts` |
| `src/evidence/public-evidence-refresh.ts` | runPublicEvidenceRefresh({batchSize, forceCampaignFinance, now, execution}): current-member rotating public sites, statements and news plus structured sources and finance. | Reads memberships, legislative_sessions, legislators, chambers, bills; writes ingestion_runs and evidence_items through durable ingestion. | `scripts/run-direct-public-evidence-refresh.ts`, `src/app/api/operations/public-evidence-refresh/route.ts` |
| `src/evidence/production-refresh.ts` | runProductionEvidenceRefresh(): production public context/member/bill-version orchestration. | Reads memberships, legislators, chambers, bills, bill_versions, bill_feature_sets; writes ingestion_runs and evidence through helpers. | `src/app/api/operations/evidence-refresh/route.ts` |
| `src/evidence/live-campaign-finance-refresh.ts` | runLiveCampaignFinanceRefresh(): load current CFB campaign finance snapshot; reconcile member identities. | Reads memberships, legislative_sessions, chambers, legislators; records ingestion_runs and finance-backed durable evidence through its helper calls. | `src/app/api/operations/evidence-refresh/route.ts`, `src/evidence/public-evidence-refresh.ts` |

## Bill-statement extractor versions: inputs, outputs, tables and live callers

All return DurableEvidenceDraft records from text and explicitly referenced bill/member inputs; no extractor directly queries or writes a database table. Differences lie in support/oppose language matching, actor boundaries and excluded limited-object/year context.

| Module | Input → output and behavior | Direct callers |
|---|---|---|
| `src/evidence/bill-statement-extractor.ts` | ExtractBillStatementsInput → DurableEvidenceDraft[]; baseline v2 explicit bill-reference support/oppose extraction | `scripts/backfill-house-member-primary-history.ts`, `scripts/backfill-senate-member-primary-history.ts`, `scripts/backfill-wayback-public-evidence.ts`, `scripts/recover-historical-density-2025-house-member-primary-bodies.ts`, `src/evidence/bill-statement-extractor-v3.ts`, `src/evidence/bill-statement-extractor-v4.ts`, `src/evidence/public-evidence-refresh.ts`, `tests/bill-statement-extractor.test.ts` |
| `src/evidence/bill-statement-extractor-v3.ts` | ExtractBillStatementsInput → DurableEvidenceDraft[]; v3 uses intervening-actor/limited-object guards | `scripts/audit-quick-evidence-statement-v3.ts`, `tests/bill-statement-extractor-v3.test.ts` |
| `src/evidence/bill-statement-extractor-v4.ts` | ExtractBillStatementsInput → DurableEvidenceDraft[]; v4 tightens phrase/limited-object and year-context matching | `scripts/audit-quick-evidence-statement-v4.ts`, `tests/bill-statement-extractor-v4.test.ts` |

Production public-evidence code continues to use the base extractor; v3/v4 have workflow-mediated audit callers. Do not remove versions or merge refreshers in PR 1. Capture fixture input → expected evidence records for all live call sites before the PR 2 behavioral refactor.

## Workflow-by-workflow inventory (all workflow YAML)

Secret column lists variable names, not credential material. The last two columns explicitly identify the requested protected Neon API key and readonly environment. All existing YAML remains unchanged in PR 1.

| Workflow file | Class | Triggers | Secrets referenced (names) | Environments | NEON_API_KEY | evidence-readonly-sandbox |
|---|---|---|---|---|---|---|
| `.github/workflows/acquire-2022-ever-served-senate-campaign-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-2022-six-further-actually-served-senators-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-2022-six-more-actual-senator-original-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-bill-ingebrigtsen-historic-original-issues-page.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-bruce-anderson-2022-exact-original-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-eight-more-actual-senators-2022-original-campaign-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-five-2021-senators-2020-original-campaign-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-justin-eichorn-2016-2020-original-issues-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-nick-frentz-2022-contemporaneous-campaign-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-rarick-seven-2021-campaign-issue-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-ruud-2013-chamberlain-2022-exact-indexed-original-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-ruud-chamberlain-2012-2022-historic-original-candidate-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-2020-22-public-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-2022-served-domain-wide.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-2022-twelve-verified-served-original-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-864-five-thin-owned-campaign-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-864-four-original-publisher-candidate-qa.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-864-last-three-and-doron-originals-four-parallel.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-campaign-archive-public-sources.yml` | AUTOMATIC | pull_request, issue_comment | none | none | no | no |
| `.github/workflows/acquire-senate-dornink-documented-original-campaign-domain.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-eight-three-parallel-archive-tracks.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-final-nine-specific-archived-candidate-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-first-20-uncovered-original-campaign-sites.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-five-final-candidate-sources-five-parallel.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-five-uncovered-2020-22-first-party-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-five-uncovered-media-publisher-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-kupec-2022-exact-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-last16-targeted-historic-candidate-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-second-20-uncovered-original-campaign-sites.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-six-served-2020-original-campaign-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-senate-three-served-2022-campaign-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-six-followup-2022-senator-campaign-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-six-new-2022-served-senators-original-sites.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-three-2021-served-senators-2020-historic-original-pages.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/acquire-two-more-2021-senators-2020-original-campaign-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/apply-evidence-quality-migration.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-109-senator-2020-22-capture-dated-policy-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-bill-ingebrigtsen-27-exact-historical-original-policy-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-carla-2022-original-platform-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-cfb-2025-two-served-special-final-termination-markers.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-cfb-availability-debt.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-cfb-candidate-finance-eligibility.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-five-additional-2022-original-candidate-site-exact-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-five-further-senator-62-original-2022-capture-dated-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-five-new-senators-2022-original-97-policy-capture-dates.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-four-more-senators-77-original-capture-dated-2022-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-four-new-2022-served-campaign-exact-issue-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-justin-eichorn-2016-original-12-exact-issues-policy-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-kent-eken-2020-original-13-policy-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-nick-frentz-2022-original-26-capture-dated-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-prior-cycle-evidence-carry-forward.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-ruud-chamberlain-26-historical-first-party-exact-site-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-2020-original-gaps-and-95-served-coverage.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-2021-publication-recovery.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-senate-68-original-2020-22-campaign-page-receipts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-864-bakk-wiger-tomassoni-25-original-publisher-direct-positions.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-864-wesenberg-klein-13-original-2022-site-positions.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-bruce-anderson-14-full-original-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-campaign-neon-readonly-once.yml` | PROTECTED | issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/audit-senate-carlson-hawj-17-first-party-original-html.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-dornink-35-original-candidate-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-expanded-original-campaign-statements.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-first-20-nine-original-site-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-kiffmeyer-newman-kreun-33-historic-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-last16-five-original-73-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-lrl-2021-25-service-year-overlap.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-nicole-2022-original-priorities.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-only-dated-campaign-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-pha-doron-21-original-site-cdx-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-roger-chamberlain-2016-original-10-and-seven-source-context.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-rosen-2004-original-vml-campaign-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-second20-15-original-campaign-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-seven-served-dated-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-six-2020-26-new-original-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-six-served-dated-issues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-statewide-campaign-sources.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-three-new-served-2022-original-statement-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-three-original-publisher-20-direct-speaker-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senate-wiger-tomassoni-bakk-20-original-publisher.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-senator-evidence-corpus.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/audit-two-2021-serving-senators-2020-original-47-policy-quotes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/audit-two-former-senators-2020-original-41-policy-dated-excerpts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-22-independent-senate-report-calendar-probe.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-2021-22-served-26-amendment-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-22-served-d25-36-yearends.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-22-served-sd25-36-30-amendments.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-22-served-yearend-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-24-preserve-396-source-metadata.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-24-senate-viewer-report-counts.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2021-25-historical-calendar-index-probe.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-2022-senate-24-original-ce-pdf-proofs.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2022-served-d13-24-original-ce.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2022-served-d25-36-original-ce.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-11-amended-pdf-source-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-16-amended-pdf-sources.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-16-sources.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-exact-version-wayback-publicby.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-original-10a245-committee-law.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-original-board-yearend-operations.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-original-yearend-legal-calendar-sources.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-served-28-yearend-original-pdfs.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-24-two-held-pdf-source-diagnostics.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-hoffman-original-signed-board-committee-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2023-original-sos-senate-roster-source.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2024-eight-verified-senator-viewer-gap-discovery.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2024-original-senate-seating-source.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-candidate-report-reference-probe.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-2025-dated-senate-report-refs.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-senate-special-original-pdf-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-served-sd29-seven-amendment-pdfs.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-served-sd6-obligation-source-reconciliation.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-served-special-final-original-pdf-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-served-two-ordinary-yearend-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-2025-two-served-senators-conditional-yearend-duty.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-22-historical-committee-registration-2024-board-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-candidate-committee-list-source-shape.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-candidate-finance-bounded-repair.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/cfb-ie-historical-bounded-repair.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/cfb-lobbying-summary-upper-bound-salvage.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/cfb-original-2023-24-revenue-pcr-committee-identity.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-sd6-2025-report-pdf-proof-probe.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-senate-2021-22-year-end-source-pilot.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-senate-district-inventory-once.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/cfb-senate-roster-source-recon.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-sos-2022-senate-ballot-denominator-predicates.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/cfb-two-terminated-senate-original-2025-26-reports.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/ci.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/current-floor-model-research.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/deploy-production.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/district-context-frozen-screen.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evaluate-introduction-timing-v3.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-2027-readiness-audit.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-gap-inventory.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-neon-github-credential-preflight.yml` | AUTOMATIC | push, workflow_dispatch | DATABASE_URL_UNPOOLED, EVIDENCE_READONLY_SANDBOX_URL, NEON_API_KEY | none | YES | no |
| `.github/workflows/evidence-neon-readonly-sandbox.yml` | PROTECTED | workflow_dispatch | EVIDENCE_READONLY_SANDBOX_URL | evidence-readonly-sandbox | no | YES |
| `.github/workflows/evidence-quality-backfill.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-granular-availability-plan.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-granular-availability-repair.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-historical-coverage-audit.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-historical-feature-freeze.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-human-audit.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-legacy-statement-audit.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-dedup-audit.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-batch2.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-batch3.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-batch4.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p1-supplement-02.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p1-supplement-03.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p1-supplement.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p2-supplement-01.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p2-supplement-02.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export-p2-supplement-03.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-manual-export.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-pre-vote-archive-availability-fallback.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/evidence-quality-pre-vote-archive-proof-canonical-v2.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/evidence-quality-pre-vote-archive-proof-canonical.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/evidence-quality-pre-vote-archive-proof.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/evidence-quality-pre-vote-candidate-inventory.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-session-daily-recovered-review-cohort.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-session-daily-review-cohort-supplement-02.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-session-daily-review-cohort.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-source-snapshot.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/evidence-quality-training-pre-vote-archive-proof.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/frozen-bill-context-diagnostic.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/frozen-combined-quick-evidence-diagnostic.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/frozen-committee-rollcall-diagnostic.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/frozen-conferee-diagnostic.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/full-universe-production-eval.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-2021-house-sf958-audio-audit.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-2021-senate-public-audio-byteprobe.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-2021-sf958-targeted-excerpts.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-discovery-extraction.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-discovery-manifest.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-discovery-score.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-expansion-actionability-audit.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-candidate-extraction-v2.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-candidate-extraction.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-cohort.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-expansion-discovery-manifest.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-expansion-discovery-score-v2.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-discovery-score.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-expansion-impact-replay-v2.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-impact-replay.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-source-bundle.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-expansion-source-gap-audit.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-holdout-cohort.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-house-journal-holdout-mechanics.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-holdout-score.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-house-journal-holdout-source-bundle.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-mechanics-score.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-mechanics.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-post-holdout.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-house-journal-source-bundle.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-impact-replay.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-pilot-manifest.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-procedural-mechanics-score.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-procedural-mechanics.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-source-bundle.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-deep-target-audit.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-target-strategies.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-deep-targeted-impact-replay.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-intake-protocol.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-local-intake.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-request-package.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-semantic-review-packet.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-semantic-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2021-senate-print-minute-target-priority.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-electronic-minute-target-overlap.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-electronic-minute-top20.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-minute-text.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-1.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-10.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-11.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-12.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-13.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-14.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-15.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-16.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-17.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-18.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-19.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-2.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-20.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-3.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-4.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-5.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-6.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-7.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-8.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2023-24-senate-top20-semantic-review-tranche-9.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-audit.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-1-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-1.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-10-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-10.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-11-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-11.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-2-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-2.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-3-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-3.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-4-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-4.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-5-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-5.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-6-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-6.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-7-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-7.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-8-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-8.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-9-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-cohort-2-tranche-9.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-integration-readiness.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-2-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-2.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-3-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-3.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-4-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-4.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-5-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-5.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-6-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-6.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-7-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-7.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-8-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranche-8.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranches-9-11-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-applicability-tranches-9-11.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-member-primary-bodies.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-member-primary-inventory.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap15-overlay.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap16-identity.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap16-member-votes.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap16-outcomes.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap16-support.yml` | AUTOMATIC | workflow_dispatch, push | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-density-2025-house-replay-gap16.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-aggregate.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-tranche-1.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-tranche-2.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-tranche-3.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-tranche-4.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2-tranche-5.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort-2.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review-cohort.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-semantic-review.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-house-vote-universe-audit.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-2025-single-official-source.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-cross-session-gap-inventory.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-house-attachment-ambiguous-retry.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/historical-density-house-attachment-archive-probe.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/historical-density-house-attachment-selector.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-density-p2-canonical-pipeline.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-pilot-text-recovery.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-density-p2-recovery-inventory.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-density-p2-remaining-applicability-audit.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-remaining-canonical-pipeline.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-remaining-semantic-review-cohort.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-remaining-semantic-review.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-remaining-text-recovery.yml` | AUTOMATIC | push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-density-p2-semantic-review-cohort.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-evidence-closeout.yml` | PROTECTED | workflow_dispatch, issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-feature-matrix-v1-8.yml` | AUTOMATIC | pull_request, push, workflow_dispatch | none | none | no | no |
| `.github/workflows/historical-finance-two-clock-diagnostic.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-house-conferee-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-house-research-summary-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-post-salvage-diagnostic.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-quick-production-eval.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/historical-senate-conferee-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/import-historical-density-p2-manual-evidence-quality.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/import-manual-evidence-quality.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/import-session-daily-evidence-quality.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/import-supplemental-manual-evidence-quality.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/introduction-scorecard-production-audit.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-bill-language-screen.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-external-availability.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-external-evidence-screen.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-external-selection-control.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p2-audit.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p3-snapshot.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p4-baselines.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p5-evidence.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p6-end-to-end.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p7-lineage.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p7-outcome.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/lifecycle-p8-prospective-model.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/member-history-cap-drift-evaluation.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/member-history-cap20-holdout-replay.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/member-history-decay-evaluation.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/member-history-decay180-holdout-replay.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/member-history-decay180-passage-safety.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/mpr-private-context-reconcile-offline-tests.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/opening-day-readiness.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/passage-fragility-prospective.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/passage-fragility-reference.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/passage-fragility-screen.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/passage-tail-risk-screen.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/prepare-2027-introduction-artifact.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-514-cfb-ie-historical-report-body-proof.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-514-cfb-ie-historical-report-contract.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-514-cfb-lobbying-later-capture-upper-bound.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-514-cfb-lobbyist-report.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-514-cfb-lobbyist-wayback-proof.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-514-failed-wayback-adjacent.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-514-senate-floor-log-speaker-cues.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-514-senate-former-member-archive.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-bulk-wayback-upper-bound.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2021-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2021-untouched-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-final3-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-mpls-forward-proof-retry.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5b-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5c-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5d-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5e-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5f-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5g-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-next5h-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-seiu-proof-retry.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-top5-new-proof.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-ie-2024-wccw-proof-retry.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-cfb-legacy-download-catalog.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-historical-density-2021-single-source.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-senate-2021-minute-acquisition-manifest.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/probe-senate-2021-publications-from-profile-anchors.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/probe-senate-caption-speaker-markers.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-caption-speaker-structure.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-committee-vote-yield.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-floor-caption-attribution.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-media-archive-coverage.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-media-caption-source.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-media-discovery-contract.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-media-enumeration-contract.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/probe-senate-media-enumeration.yml` | AMBIGUOUS-LIVE | issue_comment | none | none | no | no |
| `.github/workflows/process-history-model-research.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/process-history-one-shot.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/production-database-connectivity.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/production-forecast-scheduler.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/production-runtime-smoke.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/public-evidence-quick-screen.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/public-evidence-refresh.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/quick-evidence-committee-rollcall-extraction.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/quick-evidence-committee-rollcall-manifest.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/quick-evidence-statement-v3-audit.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/quick-evidence-statement-v4-audit.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2021-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2021-new-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-clean-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-final-clean2-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5b-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5c-clean94-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5d-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5e-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5f-clean38-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5f-partial-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5g-clean21-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-cfb-ie-2024-next5h-clean9-exact-proofs.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/repair-local-trade-news-extraction-identity.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-authorship-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-initial-text-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-introduction-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-introduction-direct-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-introduction-house-tail.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-introduction-sharded-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-process-backfill.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/revisor-source-passage-audit.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-2021-apr08-four-lrl-full-original-sha-strict-second-duration.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-four-lrl-original-full-audio-sha.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-four-original-lrl-full-audio-binary-proof.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-judiciary-acoustic-overlap-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-judiciary-strict-caption-cue-second-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-lrl-granicus-original-media-probe.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-lrl-original-media-player-source-prefixes.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-original-bill-log-strict-second-pass.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr08-original-committee-bill-action-crosscheck.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr12-original-rule1210-redacted-layout.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr12-sf1159-sf970-original-rule1210-leads.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr12-three-original-rule1210-amendment-rolls.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-apr12-three-rule1210-strict-original-second-pass.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-mar10-sf450-online-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-misc-journal-rule1210-index-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-original-sf1-committee-rule1210.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-sf2-sf566-sf1457-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-sf910-original-journal.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-sf910-original-redacted-forensics.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-sf910-original-retry-reversed-header.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-sf910-original-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-rule1210-two-original-committee-rolls.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-special1-sf9-committee-amendment-rule1210.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-special1-sf9-original-redacted-forensics.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2021-special1-sf9-original-retry-reversed-header.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2022-11-unlinked-caption-motion-cues.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2022-feb08-original-caption-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2022-finance-apr07-original-seven-roll-pdf-proof.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2022-mar30-sf3882-propertytaxes-online-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2022-original-sf2909-committee-rule1210.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-64-unlinked-caption-motion-cues.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-apr27-third-caption-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-apr27-third-caption-strict-cues.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-transportation-apr03-sf3157-html-entities-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-transportation-apr03-sf3157-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2023-two-failed-caption-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2024-41-unlinked-caption-motion-cues.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2024-education-repeated-original-rolls.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-2025-22-caption-motion-cues-v2.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-22-unlinked-caption-motion-cues.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-apr08-a10-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-apr08-a11-scoped-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-apr08-a11-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-apr08-other-10-0-1-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-apr08-other-10-0-1-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-eight-original-motion-contexts.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-feb06-filed-a2-original.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-four-originals-thirteen-attendance.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-elections-two-held-original-attendance.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-2025-jan22-caption-motion-cue-retry.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-864-103-original-2022-25-candidate-issue-fragments-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-109-original-2025-government-pdf-source-v39.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-11-official-annual-finance-v44.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-13-served-2023-24-original-amended-yearend-pdfs-v18.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-19-held-original-lrl-pdf-diagnostic.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2022-first-12-original-pdf-serving-audit-v15.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2022-housing-orphan-original-pdf.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2022-original-amended-receipts-ledger-v31.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2022-original-amendment-summary-v30.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2023-online-missing-minute-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2023-remaining-50-original-clerk.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2023-rules-sf1-original-roll-source-qa.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2023-rules-sf1-stored-readonly.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-backfill-roster-v10.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-bounded-pdf-lrl-v13.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-exact-output-v9.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-lrl-service-original-v12.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-lrl-service-v11.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-phased-readonly-v8.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-readonly-v7.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-semantic-lrl-v15.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2024-single-yea-shared-safe-schema-v16.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2025-70-serving-original-viewer-inventory-v34.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2025-judiciary-full-original-neon-v5.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2025-judiciary-postrollback-v6.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2026-49-incumbent-existing-neon-parity-v2.yml` | AUTOMATIC | pull_request, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2026-49-incumbent-existing-neon-parity.yml` | AUTOMATIC | pull_request, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-2026-current-direct-position-publisher-qa.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-2026-duckworth-public-original-source-probe.yml` | MANUAL-ONLY | none | none | none | no | no |
| `.github/workflows/senate-864-2026-protected-neon-13-reconciliation.yml` | PROTECTED | issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-240-pending-government-pdf-source-v41.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-255-exact-report-version-expansion-v16.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-26-embedded-original-motion-boundary-review.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-36-original-priority-cfb-pdf-bodies-v35.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-36-source-PDF-body-integrity-v36.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-38-served-original-amended-YE-2021-22-v20.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-388-original-pdf-content-and-date-v42.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-388-original-pdf-content-audit-v42.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-430-original-amended-source-audit-v21.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-434-official-cfb-original-amended-audit-v24.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-435-exact-official-PDF-evidence-v28.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-475-committee-year-source-matrix-v23.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-57-serving-senator-cfb-registration-leads-v17.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-72-original-pages-neon-import.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-721-indexed-filing-records-v33.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-81-original-distinct-action-segmentation.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-81-original-motion-anchor-review.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-830-590-original-source-PDF-verification-v40.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-830-dated-availability-v46.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-830-full-source-PDF-verification-v41.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-830-indexed-2025-yearend-v38.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-95-historical-source-neon-readonly.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-95-original-page-recovery.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-all-clerk-stored-readonly.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-all-source-action-inventory.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-campaign-website-asof-minimal.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-cfb-2021-22-public-original-csv-v1.yml` | AUTOMATIC | pull_request, push, issue_comment | none | none | no | no |
| `.github/workflows/senate-864-cfb-298-official-report-version-v19.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-95-served-report-crosswalk-v14.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-authenticated-parity-v5.yml` | AUTOMATIC | pull_request, push, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-cfb-candidate-parity-v6.yml` | AUTOMATIC | pull_request, push, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-cfb-full-original-alternatives-v9.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-legacy-pdf-publicby-v13.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-pdf-registry-neon-v48.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-cfb-pinned-originals-v4.yml` | AUTOMATIC | pull_request, push, issue_comment | none | none | no | no |
| `.github/workflows/senate-864-cfb-public-alt-archives-v7.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-public-crawl-originals-v8.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-served-report-version-v12.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-cfb-wayback-access-v3.yml` | AUTOMATIC | pull_request, push, issue_comment | none | none | no | no |
| `.github/workflows/senate-864-committee-source-coverage-gates.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-complete-ocr-source-neon-parity.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-exact14-written-minute-gaps.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-existing-neon-key-cross-track-counts.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-finance-archive-upperbound-v3.yml` | AUTOMATIC | pull_request, push, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-finance-evidence-confidence-ui-v29.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-finance-proof-metadata-v2.yml` | AUTOMATIC | pull_request, push, issue_comment | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-finance-row-readonly-pilot.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-followup-11-original-action-cues.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-fourteen-source-form-layout-v43.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-full-original-parser-v3.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-high-gap-2024-25-original-clerk-minutes.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-high-gap-original-bill-log-proof.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-independent-2020-22-commoncrawl-sos-recovery.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-independent-committee-year-ledger.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-large-no-pdf-official-calendar-discovery.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-last-three-independent-original-disqualification-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-lrl-two-public-originals-v14.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-newman-2020-commoncrawl-secondary-original-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-newton-2021-original-pdf-retry-v37.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-next64-zero-action-original-source-recall.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nine-five-owner-resolution-v45.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nine-five-source-review-proof-v43.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nine-held-four-extra-original-pdfs-v22.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nine-original-report-holds-audit-v42.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nine-original-report-second-look-v42.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-nonstandard-official-minutes-29-source.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-original-sos-2020-22-website-table-field-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-other-24-original-clerk-2022-25.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-policy-depth-matrix-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-positional-event-key-gates.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-practical-indexed-filings-v32.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-pre2018-independent-commoncrawl-campaign-site-probe.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-public-financial-summary-tab-v44.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-public-social-statement-identity-boundary.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-remaining149-ocr-original-source-recall.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-remaining323-embedded-original-source-review.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-roster-session-boundary-diagnostic.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-single-choice-tally-side-readonly-v3.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-six-held-original-retry-v4.yml` | AUTOMATIC | pull_request, push | none | none | no | no |
| `.github/workflows/senate-864-six-uncovered-served-cfb-original-pdfs-v26.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-sos-2020-22-filed-website-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-sos-2020-22-original-senate-only-websites.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-sos-original-results-page-postback-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-source-to-neon-parity.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-source830-neon-finance-census-v47.yml` | AUTOMATIC | pull_request, push | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-864-three-final-original-candidate-owned-sites-archive.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-three-sparse-16-historical-caucus-remarks-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-three-sparse-original-caucus-publisher-probe.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-three-unobserved-original-campaign-sites.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-tracks123-source-to-db-readiness.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-weak-and-doron-original-archive-source-audit.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-864-zero-action-568-original-source-recall.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/senate-committee-100-no-label-roll-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-138-caption-surface.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-138-media-record-html.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-138-mtgid-head.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-141-media-href-resolution.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-141-missing-minutes-alternate-pages.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-141-unparsed-roll-review.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-15-named-roll-integrity.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-19-original-date-attendance.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2021-25-electronic-meeting-census.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2022-25-original-pdf-action-audit.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2023-24-remaining-scans-ocr.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2023-elections-roll-roster.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2025-elections-15-roster.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-2025-judiciary-original-named-roll-proof.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-24-scanned-originals-ocr-sample.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-41-strong-roll-original-source.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-41-supplemental-named-choice-review.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-final-152-scanned-ocr.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-four-non-elections-source-check.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-nine-unparsed-numeric-originals.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-seven-2023-attendance.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-committee-six-scanned-minutes-ocr-pilot.yml` | AUTOMATIC | push | none | none | no | no |
| `.github/workflows/senate-hf100-apr28-original-motion-text-proof.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-hf100-may19-original-conference-proof.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-2022-25-mpr-caucus-breadth-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-2022-parental-rights-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-25-original-wayback.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-3-reporter-original-quote-cues.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-benson-kunesh-audio-six-direct-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-bigham-eken-2022-original-cues.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-bigham-eken-written-turns.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-eight-caucus-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-eight-early-original-phrases.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-four-more-original-mpr-speaker-turns.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-hawj-hf5247-official-journals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-hawj-hf5247-public-omnibus-bridge.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-hawj-mcewen-original-written-quotes.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-hf5247-2024-bilingual-version-crosswalk.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-historical-original-phrases.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-independent-reporter-15-wayback.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-independent-two-reporter-speaker-phrases.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-miller-enterprise-original-qa-turns.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-2022-radio-and-caucus-source-20211011.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-2025-pha-coleman-3play-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-cdn-original-mp3.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-episode-original-embeds.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-feed-transcript-bridge.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-five-year-commoncrawl-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-hauschild-3play-original-pdf.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-hauschild-later-originals.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-kunesh-2023-original-in-turn.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-kunesh-historic-speaker-turns.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-original-mp3s.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-mpr-six-interviews-public-reconciliation.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-neon-api-readonly-counts.yml` | AUTOMATIC | push, workflow_dispatch | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-media-neon-readonly-preflight.yml` | PROTECTED | workflow_dispatch | NEON_API_KEY, VOTEPREDICT_MEDIA_READONLY_DATABASE_URL | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/senate-media-new-public-remarks-wayback.yml` | AUTOMATIC | workflow_dispatch, pull_request | none | none | no | no |
| `.github/workflows/senate-media-pinned-original-passage-proof.yml` | AUTOMATIC | workflow_dispatch, issue_comment, pull_request | none | none | no | no |
| `.github/workflows/senate-media-public-wayback-proof-batch.yml` | AUTOMATIC | workflow_dispatch, issue_comment, pull_request | none | none | no | no |
| `.github/workflows/senate-media-reformer-four-original-aliases.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-rest-2023-original-quote-cues.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-seven-further-reporter-phrases.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senate-media-three-missing-reformer-briefs.yml` | AUTOMATIC | pull_request, workflow_dispatch | none | none | no | no |
| `.github/workflows/senator-committee-minutes-backfill.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/senator-corpus-autopilot.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/senator-floor-rollcall-backfill.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/senator-issue-position-backfill.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/session-daily-historical-backfill.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-bulk-availability-repair.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-finance-coverage-audit.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-finance-historical-tranches.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-finance-tail-handoff.yml` | AMBIGUOUS-LIVE | workflow_run | none | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-finance-watchdog.yml` | AUTOMATIC | schedule, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-finance.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-history-validation.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-candidate-viewer-probe.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-current-report-validation.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-disclosure-audit.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-filing-proofs.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-ie.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-lobbying-principals.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-cfb-lobbyist-report-probe.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-cfb-lobbyist-wayback-proof-probe.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/source-expansion-historical-fiscal-notes.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-archive.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-attachment-content.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-attachment-wayback.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-committee-process-audit.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-fiscal-note-audit.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-house-member-history.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-local-trade-news.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-organization-publications.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-senate-former-member-archive.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-senate-member-history.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-expansion-wayback.yml` | PROTECTED | issue_comment, workflow_dispatch | VERCEL_TOKEN | none | no | no |
| `.github/workflows/source-smoke.yml` | MANUAL-ONLY | workflow_dispatch | none | none | no | no |
| `.github/workflows/sync-evidence-quality-sponsorship-support.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/sync-reviewed-baseline-evidence-quality.yml` | PROTECTED | issue_comment | VERCEL_TOKEN | none | no | no |
| `.github/workflows/validate-cfb-ie-report-history.yml` | AMBIGUOUS-LIVE | issue_comment, workflow_dispatch | none | none | no | no |
| `.github/workflows/verify-senate-2022-survey-originals.yml` | AUTOMATIC | pull_request | none | none | no | no |
| `.github/workflows/verify-votepredict-neon-project.yml` | PROTECTED | workflow_dispatch | NEON_API_KEY | evidence-readonly-sandbox | YES | YES |
| `.github/workflows/weekly-evidence-cleanup-health.yml` | PROTECTED | workflow_dispatch | VERCEL_TOKEN | none | no | no |

## Unprotected manual-only workflow archive candidates for PR 3

No workflow YAML moves occur in PR 1; the following are research/workflows-archive candidates only when replaced, and their called scripts must remain dispatchable until then.

- `.github/workflows/historical-deep-discovery-extraction.yml`
- `.github/workflows/historical-deep-expansion-actionability-audit.yml`
- `.github/workflows/historical-deep-expansion-candidate-extraction-v2.yml`
- `.github/workflows/historical-deep-expansion-candidate-extraction.yml`
- `.github/workflows/historical-deep-expansion-discovery-score-v2.yml`
- `.github/workflows/historical-deep-expansion-impact-replay-v2.yml`
- `.github/workflows/historical-deep-expansion-impact-replay.yml`
- `.github/workflows/historical-deep-expansion-source-bundle.yml`
- `.github/workflows/historical-deep-expansion-source-gap-audit.yml`
- `.github/workflows/historical-deep-house-journal-holdout-mechanics.yml`
- `.github/workflows/historical-deep-house-journal-holdout-source-bundle.yml`
- `.github/workflows/historical-deep-house-journal-mechanics-score.yml`
- `.github/workflows/historical-deep-house-journal-mechanics.yml`
- `.github/workflows/historical-deep-house-journal-post-holdout.yml`
- `.github/workflows/historical-deep-house-journal-source-bundle.yml`
- `.github/workflows/historical-deep-impact-replay.yml`
- `.github/workflows/historical-deep-procedural-mechanics-score.yml`
- `.github/workflows/historical-deep-procedural-mechanics.yml`
- `.github/workflows/historical-deep-source-bundle.yml`
- `.github/workflows/historical-deep-targeted-impact-replay.yml`
- `.github/workflows/quick-evidence-committee-rollcall-extraction.yml`
- `.github/workflows/revisor-source-passage-audit.yml`
- `.github/workflows/senate-864-2026-duckworth-public-original-source-probe.yml`
- `.github/workflows/source-smoke.yml`

## Historical evaluation documentation index (all baseline files)

The audit writeups below remain in docs/evaluation unchanged. They preserve the findings, even when one-off source code is moved out of src. Files in data/evaluation and all other data directories are not moved.

- `docs/evaluation/2021-senate-public-source-audit.md`
- `docs/evaluation/cfb-2021-22-11-served-senators-amended-pdf-original-source-plan.md`
- `docs/evaluation/cfb-2021-22-38-actual-senators-original-amended-yearend-pdfs-v20.md`
- `docs/evaluation/cfb-2021-22-alternative-archive-source-paths-v7.md`
- `docs/evaluation/cfb-2021-22-authenticated-original-stored-parity-v5.md`
- `docs/evaluation/cfb-2021-22-candidate-original-parity-v6.md`
- `docs/evaluation/cfb-2021-22-full-original-range-and-arquivo-v9.md`
- `docs/evaluation/cfb-2021-22-independent-archived-original-csv-proof-v1.md`
- `docs/evaluation/cfb-2021-22-independent-commoncrawl-originals-v8.md`
- `docs/evaluation/cfb-2021-22-one-senate-committee-year-end-original-report-probe.md`
- `docs/evaluation/cfb-2021-22-pinned-original-byte-v4-and-parity-plan.md`
- `docs/evaluation/cfb-2021-22-sd25-36-thirty-amended-report-source-acquisition.md`
- `docs/evaluation/cfb-2021-22-senate-annual-filing-independent-original-calendars.md`
- `docs/evaluation/cfb-2021-22-served-11-amendment-26-permanent-review.md`
- `docs/evaluation/cfb-2021-22-served-d25-36-18-yearend-original-acquisition.md`
- `docs/evaluation/cfb-2021-22-served-d25-36-30-amended-permanent-source-review.md`
- `docs/evaluation/cfb-2021-22-served-d25-36-yearend-original-permanent-review.md`
- `docs/evaluation/cfb-2021-22-served-eleven-original-yearend-permanent-source-review.md`
- `docs/evaluation/cfb-2021-22-verified-senators-20-yearend-originals-plan.md`
- `docs/evaluation/cfb-2021-22-wayback-access-triage-v3-checkpoint.md`
- `docs/evaluation/cfb-2021-24-senate-396-viewer-source-count-checkpoint.md`
- `docs/evaluation/cfb-2021-25-298-original-amended-cfb-report-versions-51-serving-senators-v19.md`
- `docs/evaluation/cfb-2021-25-430-original-amended-Senate-report-version-evidence-v21.md`
- `docs/evaluation/cfb-2021-25-51-stale-source-pdf-queue-reconciliation.md`
- `docs/evaluation/cfb-2021-25-830-estimated-website-availability-dates-v46.md`
- `docs/evaluation/cfb-2021-25-95-served-senator-report-version-panel-crosswalk-v14.md`
- `docs/evaluation/cfb-2021-25-95-served-senators-official-CFB-registration-crosswalk-v17.md`
- `docs/evaluation/cfb-2021-25-archive-calendar-discovery-and-sd6-source-conflict.md`
- `docs/evaluation/cfb-2021-25-exact-pdf-legacy-host-publicby-v13.md`
- `docs/evaluation/cfb-2021-25-finance-archive-upperbound-v3-checkpoint.md`
- `docs/evaluation/cfb-2021-25-finance-stored-eligibility-v8-revalidation-checkpoint.md`
- `docs/evaluation/cfb-2021-25-finance-stored-proof-key-v2-audit.md`
- `docs/evaluation/cfb-2021-25-five-government-senator-name-variants-2022-PDF-followup-v29.md`
- `docs/evaluation/cfb-2021-25-four-accepted-three-correspondence-two-unknown-five-later-dates-v45.md`
- `docs/evaluation/cfb-2021-25-minnesota-senate-official-finance-filing-version-audit-v31.md`
- `docs/evaluation/cfb-2021-25-official-candidate-report-reference-inventory.md`
- `docs/evaluation/cfb-2021-25-pdf-registry-eligibility-triage-v48.md`
- `docs/evaluation/cfb-2021-25-practical-Senate-filing-expansion-v37.md`
- `docs/evaluation/cfb-2021-25-practical-senate-filing-use-v32.md`
- `docs/evaluation/cfb-2021-25-protected-neon-finance-row-prefix-pilot.md`
- `docs/evaluation/cfb-2021-25-public-finance-evaluation-release-floor-vs-publicby.md`
- `docs/evaluation/cfb-2021-25-senate-388-pdf-summary-and-chronology-review-v42.md`
- `docs/evaluation/cfb-2021-25-senate-830-indexed-590-PDF-source-recovery-v40.md`
- `docs/evaluation/cfb-2021-25-senate-830-indexed-830-PDF-full-source-recovery-v41.md`
- `docs/evaluation/cfb-2021-25-senate-830-original-indexed-filing-sources-v38.md`
- `docs/evaluation/cfb-2021-25-senate-eligibility-revalidation-audit.md`
- `docs/evaluation/cfb-2021-25-senate-filing-count-evidence-discovery.md`
- `docs/evaluation/cfb-2021-25-senate-nine-PDFs-five-date-contradictions-v43.md`
- `docs/evaluation/cfb-2021-25-senate-official-district-registration-discovery.md`
- `docs/evaluation/cfb-2021-25-senate-pinned-source-ledger-coverage.md`
- `docs/evaluation/cfb-2021-25-senate-statewide-registration-proof-checkpoint.md`
- `docs/evaluation/cfb-2021-25-served-report-version-unified-v12.md`
- `docs/evaluation/cfb-2021-25-served-senator-committee-year-coverage-audit.md`
- `docs/evaluation/cfb-2021-25-source-255-official-pdf-version-and-service-proof-v16.md`
- `docs/evaluation/cfb-2021-25-source830-neon-finance-date-reconciliation-v47.md`
- `docs/evaluation/cfb-2022-first-12-original-reports-served-person-review-v15.md`
- `docs/evaluation/cfb-2022-next-served-senators-original-finance-pdf-acquisition.md`
- `docs/evaluation/cfb-2022-sd25-36-served-original-finance-acquisition.md`
- `docs/evaluation/cfb-2022-senate-original-pre-election-24-pdf-source-plan.md`
- `docs/evaluation/cfb-2022-served-d13-24-original-finance-source-review.md`
- `docs/evaluation/cfb-2022-served-d25-36-original-finance-source-review.md`
- `docs/evaluation/cfb-2023-24-22-original-board-specific-committee-registration-history.md`
- `docs/evaluation/cfb-2023-24-71-source-version-statutory-publication-barriers.md`
- `docs/evaluation/cfb-2023-24-exact-original-pdf-version-archive-publicby-research.md`
- `docs/evaluation/cfb-2023-24-original-10a245-administrative-committee-termination-history.md`
- `docs/evaluation/cfb-2023-24-original-board-statewide-yearend-obligation-counts.md`
- `docs/evaluation/cfb-2023-24-original-revenue-pcr-committee-evidence.md`
- `docs/evaluation/cfb-2023-24-primary-yearend-law-calendar-disclosure-clock-audit.md`
- `docs/evaluation/cfb-2023-24-senate-22-proven-2022-members-yearend-source-coverage.md`
- `docs/evaluation/cfb-2023-24-thirteen-serving-senators-yearend-version-pdf-v18.md`
- `docs/evaluation/cfb-2023-26-drazkowski-anderson-termination-source-audit.md`
- `docs/evaluation/cfb-2023-hoffman-signed-original-board-committee-evidence.md`
- `docs/evaluation/cfb-2023-secretary-of-state-senate-roster-22-finance-identity-crosscheck.md`
- `docs/evaluation/cfb-2024-senate-original-seating-22-serving-finance-identity-crosscheck.md`
- `docs/evaluation/cfb-2025-actual-senators-special-yearend-conditional-duty.md`
- `docs/evaluation/cfb-2025-dated-senate-report-reference-cohort.md`
- `docs/evaluation/cfb-2025-senate-12-special-ce-pdf-source-checkpoint.md`
- `docs/evaluation/cfb-2025-senate-85-report-reference-source-checkpoint.md`
- `docs/evaluation/cfb-2025-senate-district-6-report-pdf-calendar-tranche.md`
- `docs/evaluation/cfb-2025-senate-special-original-ce-pdf-source-plan.md`
- `docs/evaluation/cfb-2025-served-sd6-original-filings-vs-legal-obligations.md`
- `docs/evaluation/cfb-2025-served-two-special-cycle-final-original-source-proof.md`
- `docs/evaluation/cfb-2025-special-senate-12-early-filed-due-date-release-audit.md`
- `docs/evaluation/cfb-2025-two-served-senators-special-final-termination-marker-original-source-review.md`
- `docs/evaluation/cfb-2025-two-served-senators-yearend-originals-conditional-permanent-source-proof.md`
- `docs/evaluation/cfb-2026-current-candidate-registry-senate-join.md`
- `docs/evaluation/cfb-ordinary-report-statutory-release-policy.md`
- `docs/evaluation/cfb-sos-2022-senate-ballot-filing-denominator-predicate-plan.md`
- `docs/evaluation/deep-replay-cohort.md`
- `docs/evaluation/deep-vs-quick-harness.md`
- `docs/evaluation/evidence-program-scorecard.md`
- `docs/evaluation/evidence-quality-sponsorship-support-v1.md`
- `docs/evaluation/historical-2021-22-pivot-decision-2026-10-09.md`
- `docs/evaluation/historical-deep-archive-provider.md`
- `docs/evaluation/historical-deep-discovery-extractor.md`
- `docs/evaluation/historical-deep-discovery-scoring.md`
- `docs/evaluation/historical-deep-discovery.md`
- `docs/evaluation/historical-deep-expansion-candidate-extraction.md`
- `docs/evaluation/historical-deep-expansion-cohort.md`
- `docs/evaluation/historical-deep-expansion-discovery-manifest.md`
- `docs/evaluation/historical-deep-expansion-impact-replay-v2.md`
- `docs/evaluation/historical-deep-expansion-impact-replay.md`
- `docs/evaluation/historical-deep-expansion-outcome-score-v2.md`
- `docs/evaluation/historical-deep-expansion-outcome-score.md`
- `docs/evaluation/historical-deep-expansion-parser-v2.md`
- `docs/evaluation/historical-deep-expansion-source-bundle.md`
- `docs/evaluation/historical-deep-house-journal-holdout-validation-v1.md`
- `docs/evaluation/historical-deep-house-journal-mechanics-score-v1.md`
- `docs/evaluation/historical-deep-house-journal-mechanics-v1.md`
- `docs/evaluation/historical-deep-impact-replay.md`
- `docs/evaluation/historical-deep-pilot.md`
- `docs/evaluation/historical-deep-procedural-mechanics-v1.md`
- `docs/evaluation/historical-deep-source-catalog.md`
- `docs/evaluation/historical-deep-target-audit.md`
- `docs/evaluation/historical-deep-target-strategies.md`
- `docs/evaluation/historical-deep-targeted-impact-replay.md`
- `docs/evaluation/historical-evidence-density-program.md`
- `docs/evaluation/historical-quick-replay.md`
- `docs/evaluation/introduced-bill-lifecycle-program.md`
- `docs/evaluation/lifecycle-p8-daily-offline-prototype.md`
- `docs/evaluation/lifecycle-p8-revisor-receipts-and-frozen-model.md`
- `docs/evaluation/member-history-cap20-prospective-score-v1.md`
- `docs/evaluation/member-history-cap20-prospective-v1.md`
- `docs/evaluation/member-history-decay180-production-promotion.md`
- `docs/evaluation/prospective-evaluation-readiness-2026-10-09.md`
- `docs/evaluation/public-source-expansion-program.md`
- `docs/evaluation/senate-2021-2022-rule1210-sf1-sf2909-special-sf9-original-committee-source-review.md`
- `docs/evaluation/senate-2021-25-four-bucket-source-debt-closeout.md`
- `docs/evaluation/senate-2021-25-tracks123-historical-source-to-db-readiness.md`
- `docs/evaluation/senate-2021-25-vote-bill-text-alignment-audit-20261012.md`
- `docs/evaluation/senate-2021-apr08-four-lrl-original-audio-source-authentication.md`
- `docs/evaluation/senate-2021-apr08-judiciary-original-acoustic-overlap-research.md`
- `docs/evaluation/senate-2021-apr08-original-full-lrl-audio-binary-source-proof-plan.md`
- `docs/evaluation/senate-2021-apr08-original-judiciary-pappas-caption-cue-recovery.md`
- `docs/evaluation/senate-2021-apr08-original-lrl-audio-video-player-source-gate.md`
- `docs/evaluation/senate-2021-apr08-sf1159-sf970-committee-action-day-crosscheck.md`
- `docs/evaluation/senate-2021-apr08-three-committee-amendments-archived-media-source-triage.md`
- `docs/evaluation/senate-2021-apr12-rule1210-three-original-amendments-authoritative-handoff.md`
- `docs/evaluation/senate-2021-apr12-sf1159-sf970-original-rule1210-source-leads.md`
- `docs/evaluation/senate-2021-apr12-sf1159-two-sf970-one-rule1210-original-amendment-rolls.md`
- `docs/evaluation/senate-2021-apr12-three-rule1210-committee-original-strict-second-pass.md`
- `docs/evaluation/senate-2021-official-journal-misc-rule1210-index-original-discovery.md`
- `docs/evaluation/senate-2021-rule1210-official-journal-two-committee-named-rolls.md`
- `docs/evaluation/senate-2021-rule1210-sf2-sf566-sf1457-three-committee-roll-source-review.md`
- `docs/evaluation/senate-2021-rule1210-sf910-vs-sf1470-identical-sides-source-review.md`
- `docs/evaluation/senate-2021-state-government-mar10-sf450-original-online-5-3-source.md`
- `docs/evaluation/senate-2022-11-no-minutes-original-caption-procedural-cues.md`
- `docs/evaluation/senate-2022-11-original-caption-end-to-end-source-closeout.md`
- `docs/evaluation/senate-2022-feb08-exact-failed-caption-source-retry.md`
- `docs/evaluation/senate-2022-finance-apr07-seven-electronic-rolls-review.md`
- `docs/evaluation/senate-2022-finance-apr07-seven-original-electronic-roll-pdf-audit.md`
- `docs/evaluation/senate-2022-mar30-propertytaxes-sf3882-original-online-roll.md`
- `docs/evaluation/senate-2022-print-2023-transportation-a49-audiovisual-source-gates.md`
- `docs/evaluation/senate-2023-64-no-minutes-original-caption-motion-cue-review.md`
- `docs/evaluation/senate-2023-64-original-caption-strict-procedural-source-closeout.md`
- `docs/evaluation/senate-2023-apr27-taxes-third-original-caption-source-review.md`
- `docs/evaluation/senate-2023-apr27-third-caption-strict-motion-cues.md`
- `docs/evaluation/senate-2023-apr27-third-original-caption-strict-cue-closeout.md`
- `docs/evaluation/senate-2023-elections-seven-attendance-source-closeout.md`
- `docs/evaluation/senate-2023-transportation-apr03-sf3157-seven-original-rolls.md`
- `docs/evaluation/senate-2023-two-previously-failed-caption-record-retry.md`
- `docs/evaluation/senate-2024-41-unlinked-original-caption-procedural-cue-review.md`
- `docs/evaluation/senate-2025-22-strict-caption-original-cue-source-closeout.md`
- `docs/evaluation/senate-2025-22-unlinked-original-caption-procedural-cue-review.md`
- `docs/evaluation/senate-2025-apr09-energy-sf2393-caption-vs-official-bill-action-review.md`
- `docs/evaluation/senate-2025-elections-apr08-other-ten-zero-one-original-source-investigation.md`
- `docs/evaluation/senate-2025-elections-apr08-sf2384-a10-separated-original-source-review.md`
- `docs/evaluation/senate-2025-elections-apr08-sf2384-a11-separated-original-source-review.md`
- `docs/evaluation/senate-2025-elections-eight-original-motion-context-first-failure-retry.md`
- `docs/evaluation/senate-2025-elections-eight-original-motion-source-semantic-closeout.md`
- `docs/evaluation/senate-2025-elections-feb06-five-roll-motion-context.md`
- `docs/evaluation/senate-2025-elections-feb06-sf529-filed-a2-original-acquisition.md`
- `docs/evaluation/senate-2025-elections-feb11-mar25-apr08-eight-original-motion-context-review.md`
- `docs/evaluation/senate-2025-elections-feb13-mar27-source-identity-attendance-review.md`
- `docs/evaluation/senate-2025-elections-fifteen-original-roster-proof-closeout.md`
- `docs/evaluation/senate-2025-elections-four-other-originals-thirteen-attendance-closeout.md`
- `docs/evaluation/senate-2025-elections-four-other-originals-thirteen-roll-attendance.md`
- `docs/evaluation/senate-2025-elections-two-held-original-source-closeout.md`
- `docs/evaluation/senate-2025-jan22-one-caption-cue-retry.md`
- `docs/evaluation/senate-2025-original-captions-procedural-cue-v2-source-review.md`
- `docs/evaluation/senate-864-2020-22-cross-provider-original-archive-and-SOS-reconciliation.md`
- `docs/evaluation/senate-864-2021-print-and-141-unlinked-meetings-remaining-evidence.md`
- `docs/evaluation/senate-864-2022-25-eight-new-original-minutes-and-zero-action-32-qa.md`
- `docs/evaluation/senate-864-2022-25-missing-vote-extraction-review.md`
- `docs/evaluation/senate-864-2022-25-remaining-written-minute-recovery.md`
- `docs/evaluation/senate-864-2022-25-remaining149-ocr-zero-action-originals.md`
- `docs/evaluation/senate-864-2023-jan24-rules-sf1-two-original-named-roll-parser-repair.md`
- `docs/evaluation/senate-864-2023-missing-pdf-alternate-senate-online-originals.md`
- `docs/evaluation/senate-864-2024-education-repeated-amendment-six-rolls.md`
- `docs/evaluation/senate-864-2024-missing-yea-v10-original-backfill-roster.md`
- `docs/evaluation/senate-864-2024-missing-yea-v11-independent-lrl-service.md`
- `docs/evaluation/senate-864-2024-missing-yea-v13-bounded-original-pdf-and-safe-hold.md`
- `docs/evaluation/senate-864-2024-missing-yea-v15-lrl-service-facts-protected.md`
- `docs/evaluation/senate-864-2024-missing-yea-v16-shared-safe-schema.md`
- `docs/evaluation/senate-864-2024-missing-yea-v9-exact-safe-output.md`
- `docs/evaluation/senate-864-2024-one-missing-yea-v8-phase-only-protected-hold.md`
- `docs/evaluation/senate-864-2024-original-lrl-directory-v11-hold-v12-public-probe.md`
- `docs/evaluation/senate-864-2025-judiciary-8-choice-original-full-source-v5.md`
- `docs/evaluation/senate-864-2025-judiciary-postrollback-numeric-v6.md`
- `docs/evaluation/senate-864-2026-49-current-source-protected-parity.md`
- `docs/evaluation/senate-864-2026-49-incumbent-source-parity-and-duckworth.md`
- `docs/evaluation/senate-864-2026-current-67-sitting-direct-position-coverage-and-specific-remarks.md`
- `docs/evaluation/senate-864-2026-per-district-source-to-evidence-v2.md`
- `docs/evaluation/senate-864-2026-thirteen-verified-direct-statements-integration.md`
- `docs/evaluation/senate-864-95-historical-neon-readonly-audit.md`
- `docs/evaluation/senate-864-all-1452-original-pdf-ocr-neon-parity-v2.md`
- `docs/evaluation/senate-864-alternative-2020-public-social-and-caucus-speaker-discovery-20261012.md`
- `docs/evaluation/senate-864-candidate-website-asof-minimal.md`
- `docs/evaluation/senate-864-existing-neon-key-readonly-source-baseline.md`
- `docs/evaluation/senate-864-five-sparse-senators-new-original-issues-review.md`
- `docs/evaluation/senate-864-fourteen-remaining-written-minute-source-dates.md`
- `docs/evaluation/senate-864-independent-committee-year-reconciliation.md`
- `docs/evaluation/senate-864-lrl-2024-two-original-semantic-sha-v14.md`
- `docs/evaluation/senate-864-mn-sos-2020-22-original-website-field-and-existing-records-request.md`
- `docs/evaluation/senate-864-original-2020-2022-mn-sos-senate-candidate-listing-vs-website-export.md`
- `docs/evaluation/senate-864-parser-v3-positional-event-key-replay-hold.md`
- `docs/evaluation/senate-864-pre2018-independent-commoncrawl-original-site-checkpoint.md`
- `docs/evaluation/senate-864-protected-neon-original-source-parity.md`
- `docs/evaluation/senate-864-senator-roster-session-boundary-diagnostic.md`
- `docs/evaluation/senate-864-sf1-neon-parity-and-81-source-motion-review.md`
- `docs/evaluation/senate-864-single-missing-choice-tally-side-v3.md`
- `docs/evaluation/senate-864-six-original-pdf-v3-holds-recheck-v4.md`
- `docs/evaluation/senate-864-three-high-gap-2024-25-independent-online-clerk-reconciliation.md`
- `docs/evaluation/senate-864-three-parallel-historical-source-audits-20261015.md`
- `docs/evaluation/senate-864-three-sparse-2020-22-original-caucus-16-remarks-checkpoint.md`
- `docs/evaluation/senate-864-wiger-tomassoni-bakk-authenticated-originals-not-senate-campaign-20261012.md`
- `docs/evaluation/senate-committee-100-no-label-original-roll-cues.md`
- `docs/evaluation/senate-committee-138-caption-original-source-two-run-closeout.md`
- `docs/evaluation/senate-committee-138-dated-media-href-verification.md`
- `docs/evaluation/senate-committee-138-mtgid-head-probe.md`
- `docs/evaluation/senate-committee-138-official-media-record-html-qa.md`
- `docs/evaluation/senate-committee-138-original-caption-source-availability.md`
- `docs/evaluation/senate-committee-138-original-caption-surface-first-run-closeout.md`
- `docs/evaluation/senate-committee-141-missing-minutes-alternate-source-triage.md`
- `docs/evaluation/senate-committee-141-no-minutes-dated-review-queue.md`
- `docs/evaluation/senate-committee-141-unparsed-roll-signal-review.md`
- `docs/evaluation/senate-committee-15-ocr-named-roll-original-integrity.md`
- `docs/evaluation/senate-committee-19-original-date-absentee-contradictions.md`
- `docs/evaluation/senate-committee-2021-25-official-meeting-census.md`
- `docs/evaluation/senate-committee-2022-25-original-pdf-action-census.md`
- `docs/evaluation/senate-committee-2023-24-final-scanned-originals.md`
- `docs/evaluation/senate-committee-2023-elections-14-roster-source-audit.md`
- `docs/evaluation/senate-committee-2023-elections-roster-source-proof-closeout.md`
- `docs/evaluation/senate-committee-2023-elections-seven-original-attendance-review.md`
- `docs/evaluation/senate-committee-2025-elections-15-roster-source-review.md`
- `docs/evaluation/senate-committee-24-originals-second-ocr-audit.md`
- `docs/evaluation/senate-committee-30-scanned-source-proof-and-2025-judiciary-roll.md`
- `docs/evaluation/senate-committee-41-strong-roll-original-semantic-review.md`
- `docs/evaluation/senate-committee-broader-source-phase2-closeout.md`
- `docs/evaluation/senate-committee-final-152-ocr-source-closeout.md`
- `docs/evaluation/senate-committee-final-152-scanned-ocr.md`
- `docs/evaluation/senate-committee-four-non-elections-motion-context-review.md`
- `docs/evaluation/senate-committee-four-non-elections-original-source-verification-closeout.md`
- `docs/evaluation/senate-committee-hearing-date-policy.md`
- `docs/evaluation/senate-committee-legacy-hearing-evidence-repair.md`
- `docs/evaluation/senate-committee-nine-new-counted-original-2023-24.md`
- `docs/evaluation/senate-committee-nine-original-named-vote-candidates-source-closeout.md`
- `docs/evaluation/senate-committee-scanned-minutes-ocr-feasibility.md`
- `docs/evaluation/senate-committee-source-to-db-reconciliation.md`
- `docs/evaluation/senate-committee-supplemental-named-roll-source-review.md`
- `docs/evaluation/senate-media-2021-2024-independent-reporter-two-dual-speaker-original-phrase-queue.json`
- `docs/evaluation/senate-media-2021-25-attribution-audit.md`
- `docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-25-broader-original-wayback-bridge.md`
- `docs/evaluation/senate-media-2021-25-eight-early-original-speaker-phrase-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-25-eight-further-original-phrase-queue.json`
- `docs/evaluation/senate-media-2021-25-exact-public-replay-receipts-20261010.json`
- `docs/evaluation/senate-media-2021-25-final-seven-reporter-original-review-and-speaking-corrections.md`
- `docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json`
- `docs/evaluation/senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-25-independent-reporter-expansion-and-early-speaker-review.md`
- `docs/evaluation/senate-media-2021-25-new-public-original-replay-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-25-parallel-public-discovery-and-original-phrase-review.md`
- `docs/evaluation/senate-media-2021-25-pinned-historical-original-phrase-review-queue.json`
- `docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json`
- `docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json`
- `docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.md`
- `docs/evaluation/senate-media-2021-25-public-historical-original-phrase-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-25-reporter-speaker-correction-and-alias-originals.md`
- `docs/evaluation/senate-media-2021-25-seven-reporter-authentic-original-quote-receipts-20261011.json`
- `docs/evaluation/senate-media-2021-and-2024-independent-dual-speaker-historic-text-receipts-20261011.json`
- `docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json`
- `docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.md`
- `docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.json`
- `docs/evaluation/senate-media-2022-benson-audio-six-publisher-originals-20261011.md`
- `docs/evaluation/senate-media-2022-bigham-eken-authentic-historical-two-speaker-html-receipts-20261011.json`
- `docs/evaluation/senate-media-2022-bigham-eken-historical-original-speaker-queue.json`
- `docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.json`
- `docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.md`
- `docs/evaluation/senate-media-2022-radio-and-2021-25-caucus-20261011.json`
- `docs/evaluation/senate-media-2022-radio-and-2021-25-caucus-20261011.md`
- `docs/evaluation/senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.json`
- `docs/evaluation/senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.md`
- `docs/evaluation/senate-media-2023-2025-interview-official-bill-chronology-crosscheck.json`
- `docs/evaluation/senate-media-2023-2025-interview-official-bill-chronology-crosscheck.md`
- `docs/evaluation/senate-media-2023-hf100-democratic-yes-crossparty-originals-20261012.json`
- `docs/evaluation/senate-media-2023-hf100-democratic-yes-crossparty-originals-20261012.md`
- `docs/evaluation/senate-media-2023-hf100-no-primary-20261012.json`
- `docs/evaluation/senate-media-2023-hf100-no-primary-20261012.md`
- `docs/evaluation/senate-media-2023-rest-historical-original-quote-fragment-queue.json`
- `docs/evaluation/senate-media-2024-hauschild-north-star-early-social-statement-crosscheck.json`
- `docs/evaluation/senate-media-2024-hauschild-north-star-early-social-statement-crosscheck.md`
- `docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.json`
- `docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.md`
- `docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.json`
- `docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.md`
- `docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json`
- `docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-report-20261012.md`
- `docs/evaluation/senate-media-2024-hf5247-actual-transport-policy-version-crosswalk-20261012.json`
- `docs/evaluation/senate-media-2024-hf5247-actual-transport-policy-version-crosswalk-20261012.md`
- `docs/evaluation/senate-media-2024-north-star-current-speech-official-crosscheck.json`
- `docs/evaluation/senate-media-2024-north-star-current-speech-official-crosscheck.md`
- `docs/evaluation/senate-media-2025-road-signs-official-proceedings-crosscheck.json`
- `docs/evaluation/senate-media-2025-road-signs-official-proceedings-crosscheck.md`
- `docs/evaluation/senate-media-bigham-eken-original-written-turns-20261011.json`
- `docs/evaluation/senate-media-bigham-eken-original-written-turns-20261011.md`
- `docs/evaluation/senate-media-eight-caucus-originals-20261011.json`
- `docs/evaluation/senate-media-eight-caucus-originals-20261011.md`
- `docs/evaluation/senate-media-four-more-original-mpr-speaker-turns-20261011.json`
- `docs/evaluation/senate-media-gh-neon-access.md`
- `docs/evaluation/senate-media-historical-proof-to-senator-year-workflow.md`
- `docs/evaluation/senate-media-miller-enterprise-original-speaker-qa-20261011.json`
- `docs/evaluation/senate-media-miller-enterprise-original-speaker-qa-20261011.md`
- `docs/evaluation/senate-media-mpr-2021-2024-original-html-versus-audio-evidence-20261011.md`
- `docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json`
- `docs/evaluation/senate-media-mpr-2025-pha-coleman-3play-originals-20261011.json`
- `docs/evaluation/senate-media-mpr-2025-pha-coleman-3play-originals-20261011.md`
- `docs/evaluation/senate-media-mpr-cdn-original-audio-20261011.json`
- `docs/evaluation/senate-media-mpr-feed-transcript-bridge-20261011.json`
- `docs/evaluation/senate-media-mpr-feed-transcript-bridge-20261011.md`
- `docs/evaluation/senate-media-mpr-five-year-commoncrawl-reporter-original-receipts-20261011.json`
- `docs/evaluation/senate-media-mpr-five-year-commoncrawl-reporter-originals-20261011.md`
- `docs/evaluation/senate-media-mpr-hauschild-3play-transcript-pdf-provenance-20261011.json`
- `docs/evaluation/senate-media-mpr-hauschild-3play-transcript-pdf-provenance-20261011.md`
- `docs/evaluation/senate-media-mpr-hauschild-later-historical-transcript-cue-receipts-20261011.json`
- `docs/evaluation/senate-media-mpr-kunesh-2023-original-in-turn-20261011.json`
- `docs/evaluation/senate-media-mpr-kunesh-2023-original-in-turn-20261011.md`
- `docs/evaluation/senate-media-mpr-kunesh-original-speaker-turns-20261011.json`
- `docs/evaluation/senate-media-mpr-kunesh-original-speaker-turns-20261011.md`
- `docs/evaluation/senate-media-mpr-original-mp3-unavailable-index-receipts-20261011.json`
- `docs/evaluation/senate-media-mpr-private-context-reconcile-runbook-20261011.md`
- `docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json`
- `docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.md`
- `docs/evaluation/senate-media-neon-one-key-readonly-counts.md`
- `docs/evaluation/senate-media-new-public-remarks-wayback-runbook.md`
- `docs/evaluation/senate-media-original-wayback-rehydration.md`
- `docs/evaluation/senate-media-private-batch-reconciliation.md`
- `docs/evaluation/senate-media-private-export-runbook.md`
- `docs/evaluation/senate-media-public-article-discovery-2021-25.json`
- `docs/evaluation/senate-media-public-article-discovery-2021-25.md`
- `docs/evaluation/senate-media-public-discovery-shadow-gaps.md`
- `docs/evaluation/senate-media-public-exact-wayback-probe.md`
- `docs/evaluation/senate-media-reformer-four-historic-brief-dated-alias-receipts-20261011.json`
- `docs/evaluation/senate-media-reformer-four-historical-brief-dated-alias-queue-20261011.json`
- `docs/evaluation/senate-media-rest-2023-exact-public-historical-html-quote-receipts-20261011.json`
- `docs/evaluation/senate-media-seven-remaining-authentic-independent-reporter-quote-queue-20261011.json`
- `docs/evaluation/senate-media-three-independent-newsroom-historical-multi-speaker-queue-20261011.json`
- `docs/evaluation/senate-media-three-original-reformer-brief-historical-recovery-receipts-20261011.json`
- `docs/evaluation/senate-media-three-reporter-original-historical-phrase-receipts-20261011.json`
- `docs/evaluation/senate-media-three-unverified-reformer-brief-original-archive-hypotheses-20261011.json`
- `docs/evaluation/senate-media-verified-live-neon-capture-year-counts.json`
- `docs/evaluation/senate-media-verified-live-neon-capture-year-counts.md`
- `docs/evaluation/senate-three-unobserved-2022-original-campaign-source-pilot.md`
- `docs/evaluation/source-proof/cfb-2021-22-38-actually-served-132-yearend-versions-v20.psv`
- `docs/evaluation/source-proof/cfb-2021-22-38-actually-served-original-viewer-yearend-coverage-v20.psv`
- `docs/evaluation/source-proof/cfb-2021-22-38-original-yearend-source-checkpoint-v20.json`
- `docs/evaluation/source-proof/cfb-2021-22-five-senator-name-variants-ten-official-yearend-originals-v32.psv`
- `docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json`
- `docs/evaluation/source-proof/cfb-2021-22-served-11-20-original-ye-pdf-proof.psv`
- `docs/evaluation/source-proof/cfb-2021-22-served-11-20-original-ye-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-22-served-amendment-26-pdf-source.psv`
- `docs/evaluation/source-proof/cfb-2021-22-served-amendment-26-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2021-22-served-d25-36-18-original-yearend-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-22-served-d25-36-30-amended-report-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2021-22-served-d25-36-30-amended-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-24-95-serving-senators-276-more-official-indexed-period-references-v33.psv`
- `docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv`
- `docs/evaluation/source-proof/cfb-2021-24-senate-396-source-viewer-count-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-25-110-government-PDF-source-recovery-checkpoint-v40.json`
- `docs/evaluation/source-proof/cfb-2021-25-110-new-government-PDF-source-retrieval-v40.psv`
- `docs/evaluation/source-proof/cfb-2021-25-240-government-PDF-source-recovery-checkpoint-v41.json`
- `docs/evaluation/source-proof/cfb-2021-25-240-new-government-PDF-source-retrieval-v41.psv`
- `docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv`
- `docs/evaluation/source-proof/cfb-2021-25-388-content-review-checkpoint-v42.json`
- `docs/evaluation/source-proof/cfb-2021-25-388-report-level-summary-and-date-review-v42.psv`
- `docs/evaluation/source-proof/cfb-2021-25-51-actually-serving-principals-298-exact-report-version-pdfs-v19.psv`
- `docs/evaluation/source-proof/cfb-2021-25-51-priority-queue-source-resolution.psv`
- `docs/evaluation/source-proof/cfb-2021-25-57-additional-serving-senator-original-candidate-registration-leads-v17.psv`
- `docs/evaluation/source-proof/cfb-2021-25-85-serving-senators-430-exact-official-original-amended-report-versions-v21.psv`
- `docs/evaluation/source-proof/cfb-2021-25-85-serving-senators-434-exact-original-amended-report-versions-v24.psv`
- `docs/evaluation/source-proof/cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv`
- `docs/evaluation/source-proof/cfb-2021-25-92-original-to-official-latest-receipts-comparisons-v42.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-actual-serving-senators-475-committee-year-statutory-duty-unknown-matrix-v23.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-445-official-filing-version-inventory-v32.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-480-PDF-bodies-v36.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-original-and-amended-reports-v33.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-480-downloaded-v38.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-590-downloaded-v40.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-served-report-version-crosswalk-checkpoint-v14.json`
- `docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senator-report-version-source-crosswalk-v14.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-475-committee-year-duty-unknown-v25.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-475-committee-year-duty-unknown-v28.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-51-source-authentic-CFB-report-principals-v19.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v21.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v24.psv`
- `docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-86-authentic-90-viewer-principals-v28.psv`
- `docs/evaluation/source-proof/cfb-2021-25-board-yearend-all-entity-count-context.json`
- `docs/evaluation/source-proof/cfb-2021-25-calendar-archive-house64a-source-proof.json`
- `docs/evaluation/source-proof/cfb-2021-25-nine-still-unverified-summary-secondary-gov-source-v42.psv`
- `docs/evaluation/source-proof/cfb-2021-25-nine-unresolved-PDF-review-checkpoint-v42.json`
- `docs/evaluation/source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json`
- `docs/evaluation/source-proof/cfb-2021-25-official-annual-financial-summary-double-source-v44.json`
- `docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv`
- `docs/evaluation/source-proof/cfb-2021-25-served-senator-committee-year-coverage-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2021-25-served-senator-committee-year-coverage.psv`
- `docs/evaluation/source-proof/cfb-2021-25-served-senator-next-source-pdf-targets.psv`
- `docs/evaluation/source-proof/cfb-2022-24-36-serving-priority-original-PDF-binaries-v36.psv`
- `docs/evaluation/source-proof/cfb-2022-24-36-source-original-PDF-byte-SHA-checkpoint-v36.json`
- `docs/evaluation/source-proof/cfb-2022-four-extra-amended-independent-original-source-checkpoint-v22.json`
- `docs/evaluation/source-proof/cfb-2022-four-extra-amended-original-PDF-SHA-source-v22.psv`
- `docs/evaluation/source-proof/cfb-2022-original-amendment-financial-summary-two-source-checkpoint-v31.json`
- `docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv`
- `docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2022-served-d25-36-original-ce-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2022-served-d25-36-original-ce-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2022-three-senate-original-amended-double-authenticated-receipts-summary-v31.psv`
- `docs/evaluation/source-proof/cfb-2022-three-senate-original-to-latest-amendment-receipts-deltas-v31.psv`
- `docs/evaluation/source-proof/cfb-2023-24-13-serving-original-amended-source-checkpoint-v18.json`
- `docs/evaluation/source-proof/cfb-2023-24-22-committee-signed-board-contemporaneous-status-matrix.psv`
- `docs/evaluation/source-proof/cfb-2023-24-22-committee-signed-board-contemporaneous-status-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv`
- `docs/evaluation/source-proof/cfb-2023-24-eight-more-senators-27-source-report-reference-targets.psv`
- `docs/evaluation/source-proof/cfb-2023-24-eight-verified-senators-11-amended-original-pdf-source-ledger.psv`
- `docs/evaluation/source-proof/cfb-2023-24-eight-verified-senators-11-amendment-original-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-exact-original-pdf-archive-publicby-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-original-board-memo-mixed-filer-yearend-count-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-original-board-memos-ye-statewide-aggregate-filing-obligations.psv`
- `docs/evaluation/source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-original-revenue-pcr-committee-identity.psv`
- `docs/evaluation/source-proof/cfb-2023-24-original-revenue-pcr-committee-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-original-revisor-10a245-administrative-termination-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-original-revisor-10a245-six-year-admin-termination-source-ledger.psv`
- `docs/evaluation/source-proof/cfb-2023-24-parent-authenticated-16-amendment-pdf-source-ledger.psv`
- `docs/evaluation/source-proof/cfb-2023-24-parent-authenticated-16-amendment-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-legal-release-and-publicby-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv`
- `docs/evaluation/source-proof/cfb-2023-24-thirteen-served-43-original-amended-yearend-pdfs-v18.psv`
- `docs/evaluation/source-proof/cfb-2023-24-two-held-original-source-get-post-identity-diagnostics.psv`
- `docs/evaluation/source-proof/cfb-2023-24-two-held-original-source-identity-diagnostic-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-24-verified-served-28-original-yearend-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2023-24-verified-served-28-original-yearend-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-hoffman-original-board-action-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2023-original-sos-22-real-senators-roster-independent-service-proof.psv`
- `docs/evaluation/source-proof/cfb-2023-original-sos-senate-22-crossyear-service-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2024-eight-verified-senators-original-viewer-responses.psv`
- `docs/evaluation/source-proof/cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2024-original-senate-22-two-section-2024-service-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2024-original-senate-seating-chart-22-member-two-section-crossyear-proof.psv`
- `docs/evaluation/source-proof/cfb-2025-70-original-viewer-109-new-versions-checkpoint-v38.json`
- `docs/evaluation/source-proof/cfb-2025-70-serving-senators-109-extra-original-indexed-YE-versions-v38.psv`
- `docs/evaluation/source-proof/cfb-2025-70-serving-senators-130-original-government-viewer-versions-v38.psv`
- `docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv`
- `docs/evaluation/source-proof/cfb-2025-doron-clark-double-independent-2026-original-gov-PDF-checkpoint-v27.json`
- `docs/evaluation/source-proof/cfb-2025-doron-clark-full-original-ye-PDF-source-v27.psv`
- `docs/evaluation/source-proof/cfb-2025-senate-12-special-due-vs-received-historical-release-floor-audit.json`
- `docs/evaluation/source-proof/cfb-2025-senate-12-special-original-pdf-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2025-senate-12-special-original-pdf-source-ledger.psv`
- `docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json`
- `docs/evaluation/source-proof/cfb-2025-served-sd29-seven-amended-version-pdfs.psv`
- `docs/evaluation/source-proof/cfb-2025-served-sd29-seven-amended-version-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2025-served-senators-2-special-cycle-final-original-pdf-ledger.psv`
- `docs/evaluation/source-proof/cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2025-two-served-senators-yearend-original-pdf-ledger.psv`
- `docs/evaluation/source-proof/cfb-2025-two-served-senators-yearend-originals-conditional-duty-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2025-two-served-special-final-termination-marker-original-psv.psv`
- `docs/evaluation/source-proof/cfb-2025-two-served-special-final-termination-marker-original-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-2026-public-current-senate-registration-dates.psv`
- `docs/evaluation/source-proof/cfb-2026-public-current-senate-registry-checkpoint.json`
- `docs/evaluation/source-proof/cfb-sos-2022-senate-ballot-67-district-source-checkpoint.json`
- `docs/evaluation/source-proof/cfb-two-current-terminated-senate-original-2025-26-financial-report-versions.psv`
- `docs/evaluation/source-proof/senate-2021-22-rule1210-sf1-sf2909-special-sf9-two-original-success-one-failure.json`
- `docs/evaluation/source-proof/senate-2021-25-four-bucket-acceptance-gap-scorecard.json`
- `docs/evaluation/source-proof/senate-2021-25-tracks123-verified-current-readiness.json`
- `docs/evaluation/source-proof/senate-2021-apr08-four-lrl-whole-mp3-strict-second-original-sha-durations-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-four-original-lrl-audio-prefix-access-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-four-original-lrl-mp3-first-complete-source-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-judiciary-original-full-audio-acoustic-overlap-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-judiciary-pappas-strict-second-original-caption-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-lrl-granicus-first-original-media-captions-access-success.json`
- `docs/evaluation/source-proof/senate-2021-apr08-two-original-committee-bill-log-first-source-success.json`
- `docs/evaluation/source-proof/senate-2021-apr12-redundant-two-motion-third-original-failure-superseded.json`
- `docs/evaluation/source-proof/senate-2021-apr12-sf1159-sf970-original-pdf-leads-probe-success.json`
- `docs/evaluation/source-proof/senate-2021-apr12-sf1159-sf970-original-redacted-layout-success.json`
- `docs/evaluation/source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json`
- `docs/evaluation/source-proof/senate-2021-apr12-two-amendments-second-run-repeated-motion-failure.json`
- `docs/evaluation/source-proof/senate-2021-apr12-two-original-amendments-first-run-failure.json`
- `docs/evaluation/source-proof/senate-2021-misc-journal-rule1210-ten-index-original-success.json`
- `docs/evaluation/source-proof/senate-2021-rule1210-sf2-sf566-sf1457-original-three-source-success.json`
- `docs/evaluation/source-proof/senate-2021-rule1210-two-official-journal-rolls-original-success.json`
- `docs/evaluation/source-proof/senate-2021-sf910-original-two-genuine-failures-preserved.json`
- `docs/evaluation/source-proof/senate-2021-sf910-rule1210-original-third-run-success.json`
- `docs/evaluation/source-proof/senate-2021-special1-sf9-original-rule1210-second-run-success.json`
- `docs/evaluation/source-proof/senate-2021-state-government-mar10-sf450-online-original-success.json`
- `docs/evaluation/source-proof/senate-2022-11-original-caption-combined-source-checkpoint.json`
- `docs/evaluation/source-proof/senate-2022-25-committee-original-minutes-source-ledger.json`
- `docs/evaluation/source-proof/senate-2022-apr07-finance-two-original-pdf-sha-parser-hold.json`
- `docs/evaluation/source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json`
- `docs/evaluation/source-proof/senate-2022-print-2023-a49-media-committee-source-gates.json`
- `docs/evaluation/source-proof/senate-2023-64-original-caption-strict-cue-source-checkpoint.json`
- `docs/evaluation/source-proof/senate-2023-apr27-third-original-caption-strict-cue-source-checkpoint.json`
- `docs/evaluation/source-proof/senate-2023-elections-seven-original-attendance-ten-roll-ledger.json`
- `docs/evaluation/source-proof/senate-2023-elections-ten-roster-matched-source-rolls-ledger.json`
- `docs/evaluation/source-proof/senate-2023-transportation-apr03-original-html-first-parse-failure.json`
- `docs/evaluation/source-proof/senate-2023-transportation-apr03-sf3157-seven-roll-original-success.json`
- `docs/evaluation/source-proof/senate-2025-22-strict-caption-original-cue-source-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-apr09-energy-sf2393-caption-action-provisional-source-ledger.json`
- `docs/evaluation/source-proof/senate-2025-elections-apr08-a10-original-source-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-elections-apr08-a11-original-first-failure-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-elections-apr08-a11-original-scoped-success-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-elections-apr08-other-ten-zero-one-original-double-fetch-failure.json`
- `docs/evaluation/source-proof/senate-2025-elections-apr08-other-ten-zero-one-original-first-failure-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-elections-eight-original-motion-context-success-ledger.json`
- `docs/evaluation/source-proof/senate-2025-elections-feb06-sf0529-filed-a2-original-first-failure-checkpoint.json`
- `docs/evaluation/source-proof/senate-2025-elections-feb13-mar27-original-attendance-source-proof.json`
- `docs/evaluation/source-proof/senate-2025-elections-fifteen-historical-roster-source-ledger.json`
- `docs/evaluation/source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json`
- `docs/evaluation/source-proof/senate-864-2022-24-25-other-24-original-clerk-two-run-source-receipts.json`
- `docs/evaluation/source-proof/senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json`
- `docs/evaluation/source-proof/senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json`
- `docs/evaluation/source-proof/senate-864-2022-housing-unlinked-official-original-minutes-pdf-receipt.json`
- `docs/evaluation/source-proof/senate-864-2023-14-senate-online-original-html-source-receipts.json`
- `docs/evaluation/source-proof/senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json`
- `docs/evaluation/source-proof/senate-864-2023-fifty-government-clerk-source-receipts.json`
- `docs/evaluation/source-proof/senate-864-2023-fifty-original-clerk-three-run-union-receipts.json`
- `docs/evaluation/source-proof/senate-864-2024-25-high-gap-official-bill-log-original-source-receipt.json`
- `docs/evaluation/source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json`
- `docs/evaluation/source-proof/senate-864-2025-judiciary-eight-of-eight-v6-protected-receipt.json`
- `docs/evaluation/source-proof/senate-864-323-embedded-original-source-artifact-manifest.json`
- `docs/evaluation/source-proof/senate-864-568-zero-action-32-original-pdf-sha-audit-receipts.json`
- `docs/evaluation/source-proof/senate-864-eleven-original-same-day-LRL-minutes-recovery.json`
- `docs/evaluation/source-proof/senate-864-protected-roster-session-boundary-v1-receipt.json`
- `docs/evaluation/source-proof/senate-864-remaining149-ocr-original-recall-v1.json`
- `docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-53-no-pdf-official-index.json`
- `docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts-v2.json`
- `docs/evaluation/source-proof/senate-864-three-high-gap-2024-25-original-source-receipts.json`
- `docs/evaluation/source-proof/senate-864-v1-protected-committee-source-db-parity-receipt.json`
- `docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json`
- `docs/evaluation/source-proof/senate-864-v5-protected-neon-seven-family-baseline.json`
- `docs/evaluation/source-proof/senate-committee-138-caption-combined-successful-original-source-proof.json`
- `docs/evaluation/source-proof/senate-committee-138-original-caption-surface-first-run-ledger.json`
- `docs/evaluation/source-proof/senate-committee-141-dated-alternate-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-141-unlinked-original-meeting-roster.json`
- `docs/evaluation/source-proof/senate-committee-141-unparsed-roll-review-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-19-tally-matched-provisional-roll-review-queue.json`
- `docs/evaluation/source-proof/senate-committee-2023-24-final-25-scanned-ocr-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-24-scanned-originals-source-manifest.json`
- `docs/evaluation/source-proof/senate-committee-30-scanned-ocr-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-final-152-ocr-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-four-non-elections-motion-context-ledger.json`
- `docs/evaluation/source-proof/senate-committee-four-non-elections-original-source-run-provenance-ledger.json`
- `docs/evaluation/source-proof/senate-committee-nine-originals-corrected-roll-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-nine-tally-matched-source-action-review-queue.json`
- `docs/evaluation/source-proof/senate-committee-phase2-41-15-original-source-ledger.json`
- `docs/evaluation/source-proof/senate-committee-phase2-media-and-supplemental-ledger.json`
- `docs/evaluation/source-proof/senate-three-unobserved-2022-original-firstparty-archive-source-checkpoint.json`

## Verification limits and safety

- Static import parsing left 0 unresolved local import specifiers and observed 0 nonliteral dynamic module-import/require calls.
- Secret values, database records, migration execution and production writes were not accessed by the inventory.
- No workflow, permissions block, protected GitHub environment, branch rule, forecast model, evaluation record, or historical eligibility rule was modified.
- Research TypeScript has a dedicated tsconfig and is excluded from production tsconfig and CI tests. No research code is bundled by Next.js.
- The public Vercel automation pause from issue #732 remains intact.

## Historical path compatibility

Two minimal compatibility entrypoints remain at scripts/audit-senate-media-remarks-offline.ts and scripts/reconcile-senate-media-offline-private.ts, delegating to their research/scripts implementations. The first path is an existence contract in the unchanged historical source-proof readiness JSON and required CI test; changing it would modify an evaluation record. Neither compatibility entrypoint is scheduled or part of the Next.js bundle.
