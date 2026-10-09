/**
 * Issue #847 — verify VotePredict's Neon project identity using a credential
 * stored solely in a protected GitHub Actions environment.
 *
 * READ ONLY: exactly one GET to the pinned Neon Management API origin.
 * Does not list branches, create branches, open database connections, retrieve
 * connection strings, or use the unrelated Pack 1 Neon integration.
 */
export const PROJECT_CHECK_APPROVAL = 'VERIFY_VOTEPREDICT_NEON_PROJECT';

type NeonProjectResponse = {
  project?: {
    id?: unknown;
    name?: unknown;
  };
};

export interface NeonProjectCheckReport {
  schemaVersion: 'votepredict-neon-project-identity-gate-v1';
  verified: true;
  repository: 'killjoy00/votepredict';
  projectIdMatched: true;
  projectNameMatched: true;
  apiKeyScopeVerified: false;
  sandboxBranchCreated: false;
  productionDatabaseAccessed: false;
  evidenceWritten: false;
  limitations: string[];
}

export interface NeonProjectCheckInput {
  apiKey?: string;
  projectId?: string;
  repository?: string;
  ref?: string;
  eventName?: string;
  approved?: string;
}

interface SafeFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
type SafeFetch = (url: string, options: RequestInit) => Promise<SafeFetchResponse>;

function guardedInputs(input: NeonProjectCheckInput): {
  apiKey: string;
  projectId: string;
} {
  if (
    input.repository !== 'killjoy00/votepredict' ||
    input.ref !== 'refs/heads/main' ||
    input.eventName !== 'workflow_dispatch' ||
    input.approved !== PROJECT_CHECK_APPROVAL
  ) {
    throw new Error('Neon project verification requires manual approval on VotePredict main');
  }
  const apiKey = input.apiKey?.trim();
  const projectId = input.projectId?.trim();
  if (!apiKey || !projectId) {
    throw new Error('Protected VotePredict Neon credentials are missing');
  }
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+){1,8}$/.test(projectId) ||
      projectId.length > 100) {
    throw new Error('VotePredict Neon project ID format is invalid');
  }
  return { apiKey, projectId };
}

/**
 * Inject a request client in unit tests; only a concrete GitHub
 * workflow run may supply real environment credentials.
 */
export async function verifyVotePredictNeonProject(
  input: NeonProjectCheckInput,
  request: SafeFetch = fetch,
): Promise<NeonProjectCheckReport> {
  const { apiKey, projectId } = guardedInputs(input);
  const url = 'https://console.neon.tech/api/v2/projects/' + projectId;
  let response: SafeFetchResponse;
  try {
    response = await request(url, {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
    });
  } catch {
    // Never print request details, a connection string, or driver errors.
    throw new Error('Neon project identity request failed; no database query was made');
  }
  if (!response.ok || response.status !== 200) {
    throw new Error('Neon project identity request was not authorized or available');
  }
  let payload: NeonProjectResponse;
  try {
    payload = await response.json() as NeonProjectResponse;
  } catch {
    throw new Error('Neon project identity response was not parseable');
  }
  const project = payload?.project;
  if (!project || project.id !== projectId) {
    throw new Error('Neon project ID does not match the protected GitHub configuration');
  }
  const normalizedName = typeof project.name === 'string'
    ? project.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (!normalizedName.includes('votepredict')) {
    // In particular, never accept the separately connected Pack 1 project.
    throw new Error('Neon project name does not identify VotePredict; fail closed');
  }
  return {
    schemaVersion: 'votepredict-neon-project-identity-gate-v1',
    verified: true,
    repository: 'killjoy00/votepredict',
    projectIdMatched: true,
    projectNameMatched: true,
    apiKeyScopeVerified: false,
    sandboxBranchCreated: false,
    productionDatabaseAccessed: false,
    evidenceWritten: false,
    limitations: [
      'Authenticated project-details GET confirms access, not the API key permission scope',
      'Project ID and name are checked against the GitHub environment and VotePredict name; no branch has been approved or created',
      'GitHub environment protection, Neon branch isolation, sandbox role and database connectivity require separate verification',
    ],
  };
}
