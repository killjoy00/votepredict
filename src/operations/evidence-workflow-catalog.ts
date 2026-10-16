/**
 * Static, reviewed dispatch catalog for a bounded subset of research workflows.
 * No user-controlled script path, command, URL, shell, SQL, or output path.
 *
 * Additional source families require their own vetted generic adapters before
 * their historical workflow definitions can be archived.
 */
export type EvidenceSourceType = 'official-source-smoke' | 'revisor-source-passage';
export type EvidenceAuditName = 'official-source-smoke' | 'revisor-source-passage' | 'quick-evidence-extractor';
export type EvidenceScope = 'all' | '302' | '300' | '257';

export interface EvidenceAcquireInputs {
  sourceType: string;
  session: string;
  memberOrBatch: string;
  dryRun: boolean;
}
export interface EvidenceAuditInputs {
  auditName: string;
  scope: string;
}
export interface EvidenceCommand {
  /** An exact checked-in script/test path; never derived from a user input. */
  path: string;
  args: readonly string[];
}
export interface EvidencePlan {
  commands: readonly EvidenceCommand[];
  artifactPath: string | null;
}
export const REVISOR_SOURCE_SNAPSHOT_PATH = 'artifacts/revisor-source-passage-snapshot.json' as const;

function requireSession(session: string): asserts session is '302' | '300' | '257' {
  if (session !== '302' && session !== '300' && session !== '257') {
    throw new Error('Official source smoke session must be 302, 300, or 257');
  }
}
export function planEvidenceAcquire(input: EvidenceAcquireInputs): EvidencePlan {
  if (input.memberOrBatch !== 'all') {
    // Those legacy scripts are all-source batches and have no safe member filter.
    throw new Error('This source adapter requires member_or_batch=all; no silent partial selection');
  }
  if (input.sourceType === 'official-source-smoke') {
    requireSession(input.session);
    return {
      commands: [{ path: 'scripts/smoke-official-sources.ts', args: [input.session] }],
      artifactPath: null,
    };
  }
  if (input.sourceType === 'revisor-source-passage') {
    if (input.session !== 'all') throw new Error('Revisor passage source requires session=all (six pinned chamber scopes)');
    return {
      commands: [
        { path: 'scripts/audit-revisor-source-passage-search.ts', args: [] },
        ...(!input.dryRun ? [{ path: 'scripts/export-revisor-source-passage-snapshot.ts', args: [] }] : []),
      ],
      artifactPath: input.dryRun ? null : REVISOR_SOURCE_SNAPSHOT_PATH,
    };
  }
  throw new Error('Unknown evidence source type');
}
export function planEvidenceAudit(input: EvidenceAuditInputs): EvidencePlan {
  if (input.auditName === 'official-source-smoke') {
    requireSession(input.scope);
    return { commands: [{ path: 'scripts/smoke-official-sources.ts', args: [input.scope] }], artifactPath: null };
  }
  if (input.scope !== 'all') throw new Error('This audit requires scope=all');
  if (input.auditName === 'revisor-source-passage') {
    return { commands: [{ path: 'scripts/audit-revisor-source-passage-search.ts', args: [] }], artifactPath: null };
  }
  if (input.auditName === 'quick-evidence-extractor') {
    return {
      commands: [
        { path: 'tests/bill-statement-extractor.test.ts', args: [] },
        { path: 'tests/bill-statement-extractor-v3.test.ts', args: [] },
        { path: 'tests/bill-statement-extractor-v4.test.ts', args: [] },
        { path: 'tests/bill-statement-compat.test.ts', args: [] },
      ],
      artifactPath: null,
    };
  }
  throw new Error('Unknown audit name');
}

/** Fail before spawning if any value is malformed or attempts path traversal. */
export function assertEvidencePlan(plan: EvidencePlan): void {
  if (plan.commands.length < 1 || plan.commands.length > 4) throw new Error('Invalid action count');
  const allowed = new Set([
    'scripts/smoke-official-sources.ts',
    'scripts/audit-revisor-source-passage-search.ts',
    'scripts/export-revisor-source-passage-snapshot.ts',
    'tests/bill-statement-extractor.test.ts',
    'tests/bill-statement-extractor-v3.test.ts',
    'tests/bill-statement-extractor-v4.test.ts',
    'tests/bill-statement-compat.test.ts',
  ]);
  for (const item of plan.commands) {
    if (!allowed.has(item.path) || item.args.some(a => !['302', '300', '257'].includes(a))) {
      throw new Error('Evidence workflow command not in checked-in allow-list');
    }
  }
  if (plan.artifactPath !== null && plan.artifactPath !== REVISOR_SOURCE_SNAPSHOT_PATH) {
    throw new Error('Artifact path not approved');
  }
}
