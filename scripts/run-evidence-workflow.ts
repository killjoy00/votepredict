/**
 * Parameterized keyless evidence source/acquisition and audit dispatcher.
 * Entrypoints are selected from a fixed source catalog, never from a shell
 * expression or user-supplied script name. No Neon credentials or DB writes.
 */
import { spawnSync } from 'node:child_process';
import { assertEvidencePlan, planEvidenceAcquire, planEvidenceAudit, type EvidencePlan } from '../src/operations/evidence-workflow-catalog.js';

function run(plan: EvidencePlan): void {
  assertEvidencePlan(plan);
  for (const command of plan.commands) {
    const testFile = command.path.startsWith('tests/');
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', ...(testFile ? ['--test'] : []), command.path, ...command.args],
      { shell: false, stdio: 'inherit', env: process.env, timeout: 1_500_000 },
    );
    if (child.error || child.status !== 0) {
      throw new Error('A selected evidence operation did not pass; no later operations were executed');
    }
  }
}
export function runEvidenceWorkflowFromEnvironment(env: Record<string, string | undefined>): void {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_REPOSITORY !== 'killjoy00/votepredict' ||
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('Evidence workflows must dispatch from the reviewed main branch in GitHub Actions');
  }
  if (env.EVIDENCE_WORKFLOW_KIND === 'acquire') {
    if (env.EVIDENCE_DRY_RUN !== 'true' && env.EVIDENCE_DRY_RUN !== 'false') throw new Error('dry_run must be boolean');
    const plan = planEvidenceAcquire({
      sourceType: env.EVIDENCE_SOURCE_TYPE ?? '',
      session: env.EVIDENCE_SESSION ?? '',
      memberOrBatch: env.EVIDENCE_MEMBER_OR_BATCH ?? '',
      dryRun: env.EVIDENCE_DRY_RUN === 'true',
    });
    run(plan);
    return;
  }
  if (env.EVIDENCE_WORKFLOW_KIND === 'audit') {
    run(planEvidenceAudit({ auditName: env.EVIDENCE_AUDIT_NAME ?? '', scope: env.EVIDENCE_SCOPE ?? '' }));
    return;
  }
  throw new Error('Unrecognized evidence workflow kind');
}
runEvidenceWorkflowFromEnvironment(process.env);
