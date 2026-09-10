# Data repair and validation — 2026-09-10

The full repository extractor audit covered all 1,594 dated bill versions. After matching JSONB optional-field semantics, 243 versions differ substantively in their gambling fields. The current extractor recognizes 251 gambling versions, versus 252 previously stored. No raw vote export or source text is included here.

`deterministic-v2.1` identifies rows rebuilt by the actual TypeScript extractor. It preserves the earlier extractor rows, records a SHA-256 of the exact source text, and records the extraction method. The isolated Neon branch received 1,594 new rows; production application follows branch validation and merge. Reproduce the read-only audit with `node --import tsx scripts/audit-bill-features.ts --input-dir=PATH`; `--manifest=PATH` saves the repair manifest. `features:bills:backfill -- --dry-run` performs extraction without writes.

Member histories and calibration are now isolated by chamber in the chronological evaluator. The production runtime queries history from the requested chamber only. The gambling diagnostic also supplies chamber identity. Neither experimental model is promoted by these changes.

The authenticated system scheduler check can verify an already completed ledger without forcing its next schedule due. An explicit authenticated POST checks Deep research for the sole system-owned smoke forecast and returns only aggregate counts and a sanitized failure category. It is separate from automatic daily scheduler GET requests.

Local validation: TypeScript passed; 111 tests passed, one database integration test skipped locally. CI runs the integration test against disposable Postgres before merge. Historical evaluations and journal outcome recovery are in progress.
