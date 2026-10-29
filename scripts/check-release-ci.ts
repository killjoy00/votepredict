import { assertGreenMainRelease } from '../src/operations/release-ci.js';

const sha = process.env.RELEASE_SHA ?? '';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GitHub Actions credential required for the release CI check');
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
// Scope to CI: hundreds of skipped historical workflows can otherwise hide it
// beyond the first page of the repository-wide run listing.
const response = await fetch(`https://api.github.com/repos/killjoy00/votepredict/actions/workflows/ci.yml/runs?head_sha=${encodeURIComponent(sha)}&event=push&per_page=10`,
  { headers, signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`Release CI lookup failed (${response.status})`);
const body = await response.json() as { workflow_runs?: unknown[] };
assertGreenMainRelease(sha, body.workflow_runs ?? []);
console.log('Exact current-main CI completed successfully; deployment gate passed.');
