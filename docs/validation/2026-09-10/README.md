# Data repair and validation — 2026-09-10

The repository extractor audit covered all 1,594 dated bill versions and found 243 substantive gambling-feature differences. The extractor recognizes 251 gambling versions, versus 252 previously stored. A separate `deterministic-v2.1` version preserves previous rows and records the actual source-text SHA-256 and repository extraction method. All 1,594 rebuilt rows were verified against the repair manifest on an isolated Neon branch, with zero differences.

Production feature application was stopped by automatic approval review after 200 new rows had been inserted. Earlier rows remain intact. The remaining 1,394 inserts require explicit production approval. Do not treat production as fully repaired.

The official House journal recovery matches bill identifier, date, Yes/No tally, and an explicit passage result. It recovered 685 of 722 outcomes: 674 passes and 11 failures. The 37 unmatched/ambiguous outcomes remain unknown. All 685 updates were applied on the test branch, retaining the original vote-source document and adding journal URL, source-document ID, content hash, extraction version and result text as outcome provenance. No House outcome changes have been applied to production.

Member history and calibration are isolated by chamber. Runtime model version `member-eb-v1.1` distinguishes that change. Ordinary floor thresholds are 68 House / 34 Senate, independent of imported roster length. These are ordinary-passage assumptions; special majorities still require dated measure-specific verification. The old member evaluator no longer substitutes inferred outcomes for missing official results. Sources: [Minnesota Constitution, Article IV section 22](https://www.revisor.mn.gov/constitution/) and [Minnesota Statutes 2.021](https://www.revisor.mn.gov/statutes/cite/2.021).

The gambling candidate still loses against its generic comparator after feature repair and chamber isolation: Brier deficit 0.003591 (15,851 observations), versus 0.009061 in the previous diagnostic. This comparison is diagnostic, not a fresh final test. No gambling coefficients were tuned or promoted.

Coalition parameters are now selected by a proper vote-count ranked probability score on validation data, using official tallies even when passage outcomes are unknown. The previous passage-only objective selected zero shocks on an almost all-pass sample and achieved approximately 11% coverage for nominal 80% intervals. Reported model scores are exploratory because these historical sessions were already inspected. No experimental model is promoted; the fresh-test, baseline, rule-verification and slice gates remain in place.

The deployed runtime check passed health, authenticated cron, unauthenticated rejection, and completed Quick-ledger verification. The explicit system-only Deep check fell back to Quick with `billing_required`, zero evidence and zero sources. Vercel AI Gateway billing remains an external blocker. The workflow records this as a failure, not a successful Deep validation. Automatic daily execution has not yet been observed since activation.

Reproduce feature extraction with `node --import tsx scripts/audit-bill-features.ts --input-dir=PATH --manifest=PATH`. Recover journal outcomes with `node --import tsx scripts/recover-house-outcomes.ts --input=EVENTS --journal-dir=JOURNALS --manifest=OUTPUT`. `scripts/apply-house-outcomes.ts` defaults to a dry run and requires `--apply` for writes. Its SQL updates only matching, previously unknown House passage events and stores source provenance atomically.

## Final exploratory scorecard

The latest-session slice contains 463 vote events, 446 known passage outcomes and 9 failures after journal recovery. The validation-selected shocks are common=2, coalition=2, bill=0. Nominal 80% count coverage is 76.0%, but passage Brier is 0.05237 versus 0.03470 for the existing residual model and 0.02018 for always-pass. Mean absolute Yes-count error is 22.47 versus 16.50 for the residual model. The candidate does not earn promotion. Improving interval width alone does not establish a better forecaster.

Local final validation: TypeScript passed; 115 tests passed, one database integration test runs in CI. Source transfers were compared byte-for-byte with the local verified files before merge.
