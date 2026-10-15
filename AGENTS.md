# VotePredict repository guidance for coding agents

## End-to-end completion without owner bottlenecks

The repository owner explicitly prefers that agents carry authorized work through implementation, tests, review, merge and any requested launch without requiring the owner to write special GitHub issue comments, click manual GitHub Actions dispatch buttons, paste secrets or repeatedly approve ordinary steps. On October 15, 2026 the owner specifically asked that no routine work in this repository be gated on their personal intervention.

For **new read-only audits and routine CI workflows**, prefer automatically triggered jobs on reviewed `main` commits, with independent keyless verification and strict scope checks before a secret-bearing job. Keep GitHub secrets in their existing protected environments, never in logs, PR text, artifacts or source code. Report deterministic safe success/failure results and keep a documented path to retries through a freshly reviewed commit.

For **requests to merge or deploy**, complete the approved action and verify the actual final state when tools and repository permissions permit. Use existing automated CI, branch-protection rules, code checks and deploy/test verification as safeguards rather than inserting a custom owner-authored approval comment or one-off manual secret gate. Read and honor task-specific limits on production mutations, model/forecast updates, historic data eligibility and external contact.

This owner preference is **not blanket approval for unrelated destructive changes**, unauthorized secret access, unrequested production data writes, new model training/serving changes, or bypassing security and GitHub platform branch/environment protection requirements. If a separately configured required reviewer or unavailable API truly blocks execution, state exactly which platform requirement remains instead of claiming the pipeline ran. Never weaken protected-branch or secret-isolation controls merely to remove a prompt.

## Senate historical source audits

Issue #864 involves original 2021-2025 Minnesota historical Senate records and 2026 current context. Keep all original dates, person/district terms, source fingerprints and evidence types distinct. A candidate-owned campaign statement does not certify a Senate vote or an automatically admissible forecast feature; historic archive capture date is not necessarily first authoring/publication. Treat absence in a bounded database query as an observation, not proof the original statement never existed. Query existing Neon only inside documented read-only transactions with explicit rollback and private-data-safe results unless a separate concrete user request expressly authorizes a mutation.
