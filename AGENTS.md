# Agent instructions — VotePredict

Applies to the entire repository. Read this before planning database work, historical-evidence repairs, workflows, migrations, or releases.

## Database deployment: standing owner authorization (2026-10-15)

**The owner has explicitly confirmed that this repository already has a GitHub Actions secret for database deployment/access. Use the EXISTING GitHub Actions secrets and workflow for database tasks. DO NOT ask the owner to supply credentials, create another Neon key, click a deploy button, or repeatedly approve routine database deployments. Proceed through implementation, tests, GitHub Actions, and deployment when those actions are in scope of the current task.**

This instruction is intentionally stronger than older notes that assumed GitHub could not access Neon. An unavailable ChatGPT Neon integration is **not** evidence that the repository lacks working database credentials. Existing protected GitHub jobs have successfully connected to the real VotePredict database using the existing credentials.

### Where the credentials live and how to use them

- GitHub Actions provides `secrets.NEON_API_KEY` and `vars.VOTEPREDICT_NEON_PROJECT_ID` in the existing approved workflow scope. Optional `vars.VOTEPREDICT_MEDIA_EXISTING_DATABASE` selects the existing database when necessary. Some repository jobs also check `secrets.DATABASE_URL_UNPOOLED`; do not assume that optional legacy key is present or necessary.
- Inspect `.github/workflows/evidence-neon-github-credential-preflight.yml`, `.github/workflows/evidence-neon-readonly-sandbox.yml`, and `src/operations/senate-media-neon-api-readonly.ts` before inventing a new connection path. The existing mechanism locates the real VotePredict Neon project, its independently marked **default** branch, existing database and existing compute; it does not create substitute projects, branches, or keys.
- Secrets are available **inside GitHub Actions**, not necessarily in a local shell, ChatGPT connector, or pull-request runner. For database work, implement and run the guarded workflow rather than asking the owner to paste a password. Keep credentials out of Git, logs, artifacts, test fixtures, issues, prompts and final answers.
- A read-only audit uses `REPEATABLE READ READ ONLY`, strict bounded fixed SQL, transaction identity checks and explicit `ROLLBACK`. A requested migration/deployment uses the project’s checked-in, independently tested, idempotent migration/apply process with version/ledger validation, a safe failure mode and a post-run verification. Do not use a read-only key for a write or silently downgrade safeguards.
- **Do the work without another conversational permission round-trip.** Build/test, create or update the required GitHub workflow/PR, merge when CI/policy permits, then run the relevant guarded GitHub Actions database job and report the **observed** outcome. If a required GitHub environment reviewer or branch-protection check genuinely blocks execution, report that concrete blocker; do not claim that a fresh secret or manual chat authorization is needed, and do not bypass GitHub protection.

### Scope and safety are separate from credential approval

The owner's standing authorization to **use the existing secret and perform requested database deployments** does not make a proposed data change automatically correct. Continue to honor the requested task boundaries, actual source evidence, schema/constraint checks, dry runs where appropriate, idempotency and post-deployment verification. Do not manufacture committee member votes from counts or voice votes, replay unsafe positional external keys, rewrite unrelated history, expand Senate floor votes, change serving/model weights, reactivate jobs, or deploy Vercel unless that action is specifically in scope.

For historical Minnesota Senate Issue [#864](https://github.com/killjoy00/votepredict/issues/864), original motion/roster-to-stored audits remain read-only until an exact, independently reconciled add-only repair is established. **Do not wait for the owner just to permit connecting to Neon and running the authenticated read-only audit.** When a tested, bounded database repair is part of a user-requested task, deploy it through the existing GitHub secret-backed workflow instead of requesting credentials or repeating an approval question. Preserve the 2021 print/2022 electronic source limitations and keep Issue #864 open until its real source/stored denominators reconcile.

See the [README operating note](README.md#current-operating-note) for the separate pause on Vercel application deployment; a Vercel pause does **not** disable the already credentialed GitHub-to-Neon database workflow.
