/**
 * #847: one explicitly approved, expiring schema-only Neon branch, with NO
 * production rows, NO database connection and NO compute endpoint.
 * Only GitHub Actions' protected VotePredict environment supplies credentials.
 *
 * Neon schema-only is Beta. A plain Neon branch is NOT safe here: it carries
 * parent data. Always send init_source: "schema-only" and verify the result.
 */
export const SCHEMA_ONLY_APPROVAL = 'CREATE_VOTEPREDICT_SCHEMA_ONLY_SANDBOX';
export const SCHEMA_ONLY_PREFIX = 'vp-evidence-847-schema-';
export const MAX_SANDBOX_HOURS = 24;

export interface SchemaOnlyCreateInput {
  apiKey?: string;
  projectId?: string;
  repository?: string;
  ref?: string;
  eventName?: string;
  approved?: string;
  runId?: string;
}
export interface SchemaOnlySandboxReport {
  schemaVersion: 'votepredict-neon-schema-only-sandbox-v1';
  projectNameVerified: true;
  sourceWasDefaultBranch: true;
  branchId: string;
  branchName: string;
  initSource: 'schema-only' | 'parent-schema';
  expiresAt: string;
  expiryVerified: true;
  noComputeEndpointVerified: true;
  noDataCopyBySchemaOnlyMode: true;
  keyProjectScopeVerified: false;
  noDatabaseQuery: true;
  noEvidenceWrite: true;
  productionUntouched: true;
  requiresAdditionalApprovalForSQLAndIngestion: true;
}

type ApiFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};
type ApiFetch = (url: string, init: RequestInit) => Promise<ApiFetchResponse>;
type Branch = {
  id?: unknown; name?: unknown; default?: unknown; protected?: unknown;
  init_source?: unknown; expires_at?: unknown; parent_id?: unknown;
};
const base = 'https://console.neon.tech/api/v2';
function safeObject(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? v as Record<string, unknown> : null;
}
function isBranchId(value: unknown): value is string {
  return typeof value === 'string' && /^br-[a-z0-9-]{3,75}$/.test(value);
}
function safeInput(input: SchemaOnlyCreateInput): {
  apiKey: string; projectId: string; branchName: string;
} {
  if (input.repository !== 'killjoy00/votepredict' ||
      input.ref !== 'refs/heads/main' ||
      input.eventName !== 'workflow_dispatch' ||
      input.approved !== SCHEMA_ONLY_APPROVAL) {
    throw new Error('A manual VotePredict main-branch schema-only approval is required');
  }
  const projectId = input.projectId?.trim() ?? '';
  const apiKey = input.apiKey?.trim() ?? '';
  if (!apiKey || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,8}$/.test(projectId) ||
      projectId.length > 60) {
    throw new Error('The protected VotePredict Neon key and project ID are required');
  }
  if (!/^[0-9]{8,20}$/.test(input.runId ?? '')) {
    throw new Error('A genuine numeric GitHub Actions run ID is required');
  }
  return { apiKey, projectId, branchName: SCHEMA_ONLY_PREFIX + input.runId };
}
function checkedExpiration(expires: unknown, target: string, now: number): expires is string {
  if (typeof expires !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(expires)) return false;
  const expiry = Date.parse(expires);
  return Number.isFinite(expiry) &&
    expiry >= now + (MAX_SANDBOX_HOURS - 0.25) * 60 * 60 * 1_000 &&
    expiry <= now + (MAX_SANDBOX_HOURS + 0.1) * 60 * 60 * 1_000 &&
    Math.abs(expiry - Date.parse(target)) <= 120_000;
}
export async function createVotePredictSchemaOnlySandbox(
  input: SchemaOnlyCreateInput,
  request: ApiFetch = fetch,
  now = Date.now(),
): Promise<SchemaOnlySandboxReport> {
  const { apiKey, projectId, branchName } = safeInput(input);
  const url = base + '/projects/' + projectId;
  const headers = {
    Accept: 'application/json',
    Authorization: 'Bearer ' + apiKey,
  };
  const json = async (path: string): Promise<Record<string, unknown>> => {
    let response: ApiFetchResponse;
    try {
      response = await request(url + path, {
        method: 'GET', headers, redirect: 'error',
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(9_000),
      });
    } catch {
      throw new Error('Neon read-only management preflight failed');
    }
    if (!response.ok || response.status !== 200) {
      throw new Error('Neon read-only management preflight was not authorized');
    }
    try {
      const body = safeObject(await response.json());
      if (!body) throw new Error('bad');
      return body;
    } catch {
      throw new Error('Neon management metadata was invalid');
    }
  };

  // Do not derive project identity merely from a caller-provided project ID.
  const projectResult = await json('');
  const project = safeObject(projectResult.project);
  if (project?.id !== projectId ||
      typeof project.name !== 'string' ||
      !project.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes('votepredict')) {
    throw new Error('Neon project identity is not independently VotePredict');
  }

  // Inspect only management metadata; do not query production tables.
  const inventory = await json('/branches?limit=10000');
  if (!Array.isArray(inventory.branches) ||
      (safeObject(inventory.pagination)?.next ?? null) !== null) {
    throw new Error('Neon branch inventory must be complete before provisioning');
  }
  const branches = inventory.branches.map(safeObject);
  if (branches.some(b => b === null)) {
    throw new Error('Neon branch metadata was invalid');
  }
  const defaults = branches.filter(b => b?.default === true);
  if (defaults.length !== 1 || !isBranchId(defaults[0]?.id)) {
    throw new Error('Unable to identify exactly one Neon default schema source');
  }
  if (branches.some(b => typeof b?.name === 'string' &&
                          b.name.startsWith(SCHEMA_ONLY_PREFIX))) {
    throw new Error('An existing #847 sandbox must be reviewed or expired before creating another');
  }

  const expiresAt = new Date(now + MAX_SANDBOX_HOURS * 60 * 60 * 1_000)
    .toISOString().replace('.000Z', 'Z');
  // Explicitly NO compute endpoints. init_source is REQUIRED: the default
  // Neon branch type duplicates parent rows and is not permitted.
  const requestBody = {
    branch: {
      name: branchName,
      parent_id: defaults[0].id,
      init_source: 'schema-only',
      expires_at: expiresAt,
      protected: false,
    },
    endpoints: [],
  };
  let response: ApiFetchResponse;
  try {
    response = await request(url + '/branches', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    // POST is non-idempotent; NEVER retry automatically. If an HTTP response
    // was lost after creation, TTL and branch-name inspection are needed.
    throw new Error('Schema-only create result unknown; inspect Neon branches; do not retry');
  }
  if (!response.ok || response.status !== 201) {
    throw new Error('Neon rejected schema-only branch creation; no normal-branch fallback');
  }
  let created: Branch | null = null;
  try {
    created = safeObject((await response.json() as Record<string, unknown>)?.branch);
  } catch {
    throw new Error('Branch response unreadable; inspect matching branch before retry');
  }
  const createdId = created?.id;
  // Clean up ONLY a branch created with this unique run-specific name.
  // Never delete the default branch or an arbitrary returned branch ID.
  const canCleanup = isBranchId(createdId) && created?.name === branchName &&
    createdId !== defaults[0].id;
  if (!canCleanup) {
    throw new Error('Branch response identity is uncertain; inspect Neon before any retry');
  }
  let verified: Branch | null = null;
  try {
    const result = await json('/branches/' + createdId);
    verified = safeObject(result.branch);
    if (!verified || verified.id !== createdId || verified.name !== branchName ||
        verified.default !== false || verified.protected !== false ||
        (verified.init_source !== 'schema-only' &&
         verified.init_source !== 'parent-schema') ||
        !checkedExpiration(verified.expires_at, expiresAt, now)) {
      throw new Error('Schema-only type, expiry or branch safety could not be verified');
    }
    const endpointsResult = await json('/branches/' + createdId + '/endpoints');
    if (!Array.isArray(endpointsResult.endpoints) ||
        endpointsResult.endpoints.length !== 0) {
      throw new Error('Unexpected compute endpoint on schema-only evidence sandbox');
    }
  } catch {
    // A newly created, name-and-ID-verified branch is the only deletion target.
    // This is a cleanup of THIS run's disposable resource, never a production
    // branch. If cleanup fails, operators must inspect Neon before retrying.
    try {
      const deletion = await request(url + '/branches/' + createdId, {
        method: 'DELETE', headers, redirect: 'error',
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      if (!deletion.ok || ![200, 202, 204].includes(deletion.status)) {
        throw new Error('cleanup rejected');
      }
    } catch {
      throw new Error('Sandbox verification failed and cleanup is unconfirmed; inspect Neon before retry');
    }
    throw new Error('Sandbox verification failed; freshly created branch cleanup requested');
  }

  return {
    schemaVersion: 'votepredict-neon-schema-only-sandbox-v1',
    projectNameVerified: true,
    sourceWasDefaultBranch: true,
    branchId: createdId,
    branchName,
    initSource: verified!.init_source as 'schema-only' | 'parent-schema',
    expiresAt: verified!.expires_at as string,
    expiryVerified: true,
    noComputeEndpointVerified: true,
    noDataCopyBySchemaOnlyMode: true,
    keyProjectScopeVerified: false,
    noDatabaseQuery: true,
    noEvidenceWrite: true,
    productionUntouched: true,
    requiresAdditionalApprovalForSQLAndIngestion: true,
  };
}
