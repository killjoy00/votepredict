/**
 * #912: user-controlled, GitHub-environment-only readiness gate for the
 * historical Senate media export. No credential values or source data escape.
 * This module never connects to Postgres or writes to Neon.
 */
export const SENATE_MEDIA_NEON_READINESS_VERSION = 'senate-media-neon-readonly-readiness-v1';
export const SENATE_MEDIA_NEON_APPROVAL = 'VERIFY_SENATE_MEDIA_READONLY';
const PROJECT_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,8}$/;
const BRANCH_ID = /^br-[a-z0-9-]{3,80}$/;

export interface SanitizedMediaNeonReadiness {
  version: typeof SENATE_MEDIA_NEON_READINESS_VERSION;
  projectIdentityVerified: boolean;
  projectEndpointAndBranchVerified: boolean;
  sqlRoleSelectOnlyVerified: boolean;
  mediaExportPerformed: false;
  originalArticleBytesAccessed: false;
  evidenceSourceRowsRead: false;
  productionDatabaseWritten: false;
  sandboxOrProductionBranchCreated: false;
  status:
    | 'project_verified_readonly_database_url_required'
    | 'project_verified_approved_branch_required'
    | 'project_verified_role_preflight_ready';
}

export function assertMediaReadinessManualApproval(env: NodeJS.ProcessEnv): void {
  if (env.GITHUB_REPOSITORY !== 'killjoy00/votepredict'
    || env.GITHUB_REF !== 'refs/heads/main'
    || env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
    || env.VOTEPREDICT_MEDIA_APPROVAL !== SENATE_MEDIA_NEON_APPROVAL) {
    throw Error('Manual main-branch, protected-environment approval is mandatory');
  }
}

export interface ApprovedMediaSqlDestination {
  host: string;
  username: string;
  database: string;
}

export function parseMediaSqlDestination(value: string): ApprovedMediaSqlDestination {
  let uri: URL;
  try { uri = new URL(value); }
  catch { throw Error('Restricted Postgres URL is malformed'); }
  const role = decodeURIComponent(uri.username);
  const database = decodeURIComponent(uri.pathname.slice(1));
  const sslmode = uri.searchParams.get('sslmode');
  if (!['postgres:', 'postgresql:'].includes(uri.protocol)
    || !uri.hostname || !uri.hostname.endsWith('.neon.tech')
    || !role || !uri.password || !database || database.includes('/')
    || uri.hash || uri.hostname.includes('-pooler.')
    || (sslmode !== null && sslmode !== 'require')
    || uri.searchParams.has('options')
    || uri.searchParams.has('service')
    || uri.searchParams.has('host')) {
    throw Error('Require an explicit, TLS-protected, direct Neon Postgres URI with a restricted role');
  }
  // Role privilege checks occur inside an actual read-only SQL transaction.
  // Reject common owner names before a connection; never silently use a root role.
  if (/(?:^|_)(?:owner|admin|superuser)(?:_|$)/i.test(role))
    throw Error('Refusing owner, superuser or admin Postgres role');
  return {
    host: uri.hostname,
    username: role,
    database,
  };
}

type EndpointRecord = {
  host?: unknown;
  branch_id?: unknown;
  project_id?: unknown;
  type?: unknown;
};
type EndpointResponse = { endpoints?: unknown };
interface SafeFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
type SafeFetch = (url: string, init: RequestInit) => Promise<SafeFetchResponse>;

export function validateApprovedMediaBranchId(value: string): string {
  if (!BRANCH_ID.test(value)) throw Error('Approved Neon branch ID missing or invalid');
  return value;
}

/** Authenticate DB URL host AND approved branch against the verified project. */
export async function assertProjectEndpointBelongsToApprovedBranch(
  input: {
    apiKey: string;
    projectId: string;
    branchId: string;
    databaseHost: string;
  },
  request: SafeFetch = fetch,
): Promise<void> {
  if (!input.apiKey || !PROJECT_ID.test(input.projectId))
    throw Error('Verified VotePredict Neon project credentials required');
  validateApprovedMediaBranchId(input.branchId);
  if (!/^[a-z0-9.-]+$/.test(input.databaseHost) || !input.databaseHost.endsWith('.neon.tech'))
    throw Error('Invalid Neon database host');
  let response: SafeFetchResponse;
  try {
    response = await request(
      'https://console.neon.tech/api/v2/projects/' + input.projectId + '/endpoints',
      {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
        headers: {Accept: 'application/json', Authorization: 'Bearer ' + input.apiKey},
      },
    );
  } catch {
    throw Error('Neon endpoint ownership metadata request failed');
  }
  if (!response.ok || response.status !== 200)
    throw Error('Neon endpoint ownership metadata was not available');
  let data: EndpointResponse;
  try { data = await response.json() as EndpointResponse; }
  catch { throw Error('Neon endpoint ownership metadata was malformed'); }
  if (!Array.isArray(data?.endpoints) || data.endpoints.length > 200)
    throw Error('Neon endpoint ownership result invalid');
  const accepted = data.endpoints.some((row: EndpointRecord) =>
    row && typeof row === 'object'
    && row.host === input.databaseHost
    && row.branch_id === input.branchId
    && row.project_id === input.projectId
    && (row.type === 'read_write' || row.type === 'read_only')
  );
  if (!accepted) throw Error('Database host not independently bound to approved VotePredict Neon branch');
}

/** Logs/summaries deliberately contain booleans, NEVER DB names, roles or URLs. */
export function mediaNeonReadinessReport(
  status: SanitizedMediaNeonReadiness['status'],
): SanitizedMediaNeonReadiness {
  return {
    version: SENATE_MEDIA_NEON_READINESS_VERSION,
    status,
    projectIdentityVerified: true,
    projectEndpointAndBranchVerified: status === 'project_verified_role_preflight_ready',
    sqlRoleSelectOnlyVerified: status === 'project_verified_role_preflight_ready',
    mediaExportPerformed: false,
    originalArticleBytesAccessed: false,
    evidenceSourceRowsRead: false,
    productionDatabaseWritten: false,
    sandboxOrProductionBranchCreated: false,
  };
}
