# Evidence research archive

This archive contains historical investigations moved with git mv from the application source, scripts and tests. The root tsconfig and Next.js build exclude research and npm test does not pick up research/tests.

- evidence/: audit-only source modules
- scripts/: historic one-off invocations (review credentials and dry-run behavior before running)
- tests/: historic tests runnable separately with node --import tsx --test research/tests/*.test.ts
- workflows-archive/: reserved for PR 3, not active GitHub Actions

To validate archived TypeScript separately, run npm exec -- tsc -p research/tsconfig.json. Keep the working directory at the repository root to resolve data and fixtures. No archive script should be dispatched against production by this PR.
