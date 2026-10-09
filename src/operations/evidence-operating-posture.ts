/**
 * Issue #847: offline, repository-only Vercel/evidence operating posture audit.
 * Intentionally NOT a general YAML parser or a live Vercel cron audit.
 * Unexpected workflow syntax fails closed. No network, database or secret access.
 */
export const PAUSED_VERCEL_WORKFLOWS = [
  'deploy-production.yml',
  'production-runtime-smoke.yml',
  'production-forecast-scheduler.yml',
  'opening-day-readiness.yml',
  'public-evidence-refresh.yml',
  'passage-fragility-prospective.yml',
  'weekly-evidence-cleanup-health.yml',
  'prepare-2027-introduction-artifact.yml',
  'audit-cfb-availability-debt.yml',
  'audit-senate-2021-publication-recovery.yml',
  'revisor-introduction-backfill.yml',
  'production-database-connectivity.yml',
  'revisor-introduction-house-tail.yml',
  'evaluate-introduction-timing-v3.yml',
  'revisor-introduction-sharded-backfill.yml',
  'evidence-2027-readiness-audit.yml',
  'lifecycle-p8-prospective-model.yml',
] as const;

const JOB_GUARD = "inputs.run_vercel == true && github.ref == 'refs/heads/main'";

export interface EvidencePostureFinding { path: string; reason: string }
export interface EvidencePostureWorkflow {
  path: string; triggers: string[]; jobCount: number; gatedJobCount: number;
}
export interface EvidenceOperatingPostureReport {
  schemaVersion: 'evidence-operating-posture-static-audit-v1';
  protectedWorkflowCount: number;
  protectedWorkflows: EvidencePostureWorkflow[];
  sandboxReadonlyWorkflow: {
    manualOnly: boolean;
    approvalGuardPresent: boolean;
    vercelDependencyPresent: boolean;
    sandboxCredentialPathPresent: boolean;
  };
  configuredVercelGitDeploymentsDisabled: boolean;
  configuredVercelCronEntries: number | null;
  liveVercelCronStatus: 'unverified_not_queried';
  evidenceRefresh: {
    workflowDispatchOnly: boolean;
    dependsOnVercelEnvironmentPull: boolean;
    directDatabaseWorkerPresent: boolean;
    productionRefreshExecuted: false;
  };
  findings: EvidencePostureFinding[];
  passed: boolean;
}

function topLevelBlock(yaml: string, key: string): string | null {
  const lines = yaml.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => line === key + ':');
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[^\s#][^:]*:/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

function eventNames(block: string): string[] {
  return Array.from(block.matchAll(/^  ([a-z][a-z0-9_-]*):(?:\s*.*)?$/gm), m => m[1]);
}

function jobSegments(block: string): { name: string; source: string }[] {
  const matches = [...block.matchAll(/^  ([a-zA-Z][a-zA-Z0-9_-]*):\s*$/gm)];
  return matches.map((match, index) => ({
    name: match[1],
    source: block.slice((match.index ?? 0) + match[0].length,
      index + 1 < matches.length ? matches[index + 1].index : undefined),
  }));
}

export function auditEvidenceOperatingPosture(
  readFile: (path: string) => string,
): EvidenceOperatingPostureReport {
  const findings: EvidencePostureFinding[] = [];
  const protectedWorkflows: EvidencePostureWorkflow[] = [];
  const add = (path: string, reason: string) => { findings.push({ path, reason }); };
  const read = (path: string): string | null => {
    try { return readFile(path); } catch {
      add(path, 'required repository file unavailable');
      return null;
    }
  };

  let evidenceWorkflow = '';
  for (const filename of PAUSED_VERCEL_WORKFLOWS) {
    const path = '.github/workflows/' + filename;
    const source = read(path);
    if (source === null) continue;
    if (filename === 'public-evidence-refresh.yml') evidenceWorkflow = source;
    const triggerBlock = topLevelBlock(source, 'on');
    if (triggerBlock === null) add(path, 'missing or unsupported top-level on trigger');
    const triggers = triggerBlock === null ? [] : eventNames(triggerBlock);
    if (triggers.length !== 1 || triggers[0] !== 'workflow_dispatch') {
      add(path, 'paused workflow must use workflow_dispatch as its sole trigger');
    }
    if (triggerBlock !== null) {
      const flag = triggerBlock.match(/^      run_vercel:\s*\n((?: {8}.*(?:\n|$))*)/m);
      if (!flag || !/^        required: true\s*$/m.test(flag[1]) ||
          !/^        type: boolean\s*$/m.test(flag[1]) ||
          !/^        default: false\s*$/m.test(flag[1])) {
        add(path, 'manual run_vercel must be a required boolean defaulting false');
      }
    }
    const jobsBlock = topLevelBlock(source, 'jobs');
    const jobs = jobsBlock === null ? [] : jobSegments(jobsBlock);
    if (jobs.length === 0) add(path, 'missing or unsupported jobs definition');
    let gatedJobCount = 0;
    for (const job of jobs) {
      const guards = job.source.match(/^    if:\s*(.+)$/gm) ?? [];
      if (guards.length !== 1 || guards[0].trim() !== 'if: ' + JOB_GUARD) {
        add(path, 'job ' + job.name + ' missing exact approval and main-branch guard');
      } else gatedJobCount++;
    }
    protectedWorkflows.push({ path, triggers, jobCount: jobs.length, gatedJobCount });
  }

  // Independently review the new Vercel-free, non-production read-only path.
  // This must not silently become an automatic evidence refresh or call the
  // paused ingestion worker.
  const sandboxWorkflowPath = '.github/workflows/evidence-neon-readonly-sandbox.yml';
  const sandboxSource = read(sandboxWorkflowPath) ?? '';
  const sandboxTrigger = topLevelBlock(sandboxSource, 'on');
  const sandboxEvents = sandboxTrigger === null ? [] : eventNames(sandboxTrigger);
  const manualOnly = sandboxEvents.length === 1 && sandboxEvents[0] === 'workflow_dispatch';
  const sandboxJobBlock = topLevelBlock(sandboxSource, 'jobs');
  const sandboxJobs = sandboxJobBlock === null ? [] : jobSegments(sandboxJobBlock);
  const sandboxIf = sandboxJobs.length === 1
    ? sandboxJobs[0].source.match(/^    if: >-\n((?: {6}[^\n]+\n?)+)/m)?.[1] ?? ''
    : '';
  const approvalGuardPresent =
    sandboxJobs.length === 1 &&
    sandboxJobs[0].name === 'audit' &&
    sandboxIf.replace(/\s+/g, ' ').trim() ===
      "github.ref == 'refs/heads/main' && inputs.run_readonly == true && inputs.approval_phrase == 'READ_ONLY_SANDBOX_AUDIT'" &&
    /^    environment: evidence-readonly-sandbox\s*$/m.test(sandboxSource) &&
    sandboxSource.includes('      run_readonly:') &&
    /run_readonly:[\s\S]*?type: boolean[\s\S]*?default: false/.test(sandboxTrigger ?? '') &&
    sandboxSource.includes('VOTEPREDICT_EVIDENCE_RO_SCOPE: sandbox');
  const vercelDependencyPresent =
    /VERCEL_TOKEN|vercel@|vercel env pull|run-direct-public-evidence-refresh|deploy --prod|cron\/forecasts/i
      .test(sandboxSource);
  const sandboxCredentialPathPresent =
    sandboxSource.includes('secrets.EVIDENCE_READONLY_SANDBOX_URL') &&
    sandboxSource.includes('vars.EVIDENCE_READONLY_SANDBOX_ROLE') &&
    sandboxSource.includes('scripts/audit-evidence-neon-readonly.ts --connect');
  if (!manualOnly || !approvalGuardPresent || vercelDependencyPresent || !sandboxCredentialPathPresent) {
    add(sandboxWorkflowPath,
      'sandbox health workflow must remain manual, explicitly approved, Vercel-free and read-only');
  }

  let configuredVercelGitDeploymentsDisabled = false;
  let configuredVercelCronEntries: number | null = null;
  const rawConfig = read('vercel.json');
  if (rawConfig !== null) {
    try {
      const config = JSON.parse(rawConfig) as {
        git?: { deploymentEnabled?: unknown }; crons?: unknown;
      };
      configuredVercelGitDeploymentsDisabled = config.git?.deploymentEnabled === false;
      if (!configuredVercelGitDeploymentsDisabled) {
        add('vercel.json', 'automatic Vercel Git deployments must remain disabled');
      }
      configuredVercelCronEntries = config.crons === undefined
        ? 0 : Array.isArray(config.crons) ? config.crons.length : null;
      if (configuredVercelCronEntries !== 0) {
        add('vercel.json', 'repository config must not register a Vercel cron');
      }
    } catch { add('vercel.json', 'invalid JSON configuration'); }
  }

  const block = topLevelBlock(evidenceWorkflow, 'on');
  const events = block === null ? [] : eventNames(block);
  const workflowDispatchOnly = events.length === 1 && events[0] === 'workflow_dispatch';
  const dependsOnVercelEnvironmentPull = /vercel(?:@[0-9][^\s]*)?\s+env\s+pull/.test(evidenceWorkflow);
  const directDatabaseWorkerPresent = evidenceWorkflow.includes('scripts/run-direct-public-evidence-refresh.ts');
  if (!dependsOnVercelEnvironmentPull) {
    add('.github/workflows/public-evidence-refresh.yml',
      'credential path changed; re-audit documented refresh contract');
  }
  if (!directDatabaseWorkerPresent) {
    add('.github/workflows/public-evidence-refresh.yml',
      'expected database worker changed; re-audit before activation');
  }

  const docs: { path: string; bad: (source: string) => boolean; reason: string }[] = [
    {
      path: 'docs/EVIDENCE-INGESTION.md',
      bad: s => !s.includes('**Current cadence: suspended.**') ||
        s.includes('invokes the protected production runtime every six hours'),
      reason: 'legacy automatic evidence-refresh cadence remains in current instructions',
    },
    {
      path: 'docs/DEPLOYMENT.md',
      bad: s => s.includes('It is triggered by completion of the') ||
        !s.includes('**Current deployment posture: paused and manual-only.**'),
      reason: 'deployment instructions must require intentional manual dispatch',
    },
    {
      path: 'README.md',
      bad: s => s.includes('performs the Vercel production deployment.') ||
        !s.includes('Vercel automation is paused'),
      reason: 'README must not claim automatic CI-triggered production deployment',
    },
    {
      path: 'docs/PROJECT_STATUS.md',
      bad: s => s.includes('Hourly production forecast polling: GitHub Actions') ||
        !s.includes('evidence refresh is suspended'),
      reason: 'project status must describe the paused scheduler and refresh',
    },
  ];
  for (const doc of docs) {
    const content = read(doc.path);
    if (content !== null && doc.bad(content)) add(doc.path, doc.reason);
  }

  return {
    schemaVersion: 'evidence-operating-posture-static-audit-v1',
    protectedWorkflowCount: PAUSED_VERCEL_WORKFLOWS.length,
    protectedWorkflows,
    sandboxReadonlyWorkflow: {
      manualOnly,
      approvalGuardPresent,
      vercelDependencyPresent,
      sandboxCredentialPathPresent,
    },
    configuredVercelGitDeploymentsDisabled,
    configuredVercelCronEntries,
    liveVercelCronStatus: 'unverified_not_queried',
    evidenceRefresh: {
      workflowDispatchOnly,
      dependsOnVercelEnvironmentPull,
      directDatabaseWorkerPresent,
      productionRefreshExecuted: false,
    },
    findings,
    passed: findings.length === 0,
  };
}
