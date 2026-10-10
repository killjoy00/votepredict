import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditSenateCampaignIssuePlatforms,
  type CampaignAuditInputs,
  type CampaignArchiveCapture,
} from '../src/evidence/campaign-issue-platform-audit.js';

const id = '11111111-1111-1111-1111-111111111111';
const original = 'https://example.org/issues/education';
const excerpt = 'I support investing in our schools.';
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const baseRoster: CampaignAuditInputs['roster'] = [{ membershipId: id, senatorName: 'Example Senator', sessionSlug: '2021-2022' }];
const sites: CampaignAuditInputs['sites'] = [{ membershipId: id, campaignYear: 2020, url: 'https://example.org/',
  status: 'documented', registrySourceUrl: 'https://www.sos.state.mn.us/example' }];
function snapshot(timestamp: string, digest: string, options: Partial<CampaignArchiveCapture> = {}): CampaignArchiveCapture {
  const at = timestamp.slice(0, 4) + '-' + timestamp.slice(4, 6) + '-' + timestamp.slice(6, 8)
    + 'T' + timestamp.slice(8, 10) + ':' + timestamp.slice(10, 12) + ':' + timestamp.slice(12, 14) + '.000Z';
  const pageText = 'Here is my platform. ' + excerpt;
  return { membershipId: id, campaignYear: 2020, originalUrl: original,
    archiveUrl: 'https://web.archive.org/web/' + timestamp + 'id_/' + original, capturedAt: at,
    archiveDigest: digest, selectedByV3: true, snapshotStatus: 'fetched',
    contentSha256: sha('original HTML content ' + timestamp),
    pageText, pageTextSha256: sha(pageText), pageType: 'issue', originalPostedOn: '2020-10-10', ...options };
}
function input(overrides: Partial<CampaignAuditInputs> = {}): CampaignAuditInputs {
  const capture = snapshot('20210316112233', 'A');
  return { roster: baseRoster, sites, captures: [capture],
    statements: [{ membershipId: id, archiveUrl: capture.archiveUrl, policyFamily: 'education',
      excerpt, attribution: 'candidate', stance: 'supports' }],
    discoveries: [{ membershipId: id, seedUrl: 'https://example.org/', requestedLimit: 400, returnedCount: 2, status: 'complete' }],
    ...overrides };
}

test('only the verified archive capture proves historical public-by, not the original post date', () => {
  const report = auditSenateCampaignIssuePlatforms(input());
  const row = report.memberships[0];
  assert.equal(row.provenAttributedStatements, 1);
  assert.equal(row.statements[0].earliestProvenPublicBy, '2021-03-16T11:22:33.000Z');
  assert.equal(row.statements[0].originalPostedOn, '2020-10-10');
  assert.equal(row.originalPostDatesAreAvailabilityProof, false);
  assert.equal(report.scope.reconciliationCertified, false);
  assert.equal(row.coverageStatus, 'audited_sample_only');
});

test('reports when later-yearly-only selection silently omitted a changed issue page', () => {
  const earlier = snapshot('20210401010101', 'PAGE-ONE', { selectedByV3: false, snapshotStatus: 'not_selected',
    contentSha256: null, pageText: null, pageTextSha256: null });
  const later = snapshot('20210903010101', 'PAGE-TWO');
  const report = auditSenateCampaignIssuePlatforms(input({ captures: [earlier, later], statements: [] }));
  assert.equal(report.totals.unselectedVersionGroups, 1);
  assert.deepEqual(report.memberships[0].unselectedVersionGroups, [{
    urlYear: original + '|2021', distinctDigests: 2, v3SelectedDigests: 1,
  }]);
  assert.ok(report.memberships[0].gapCodes.includes('OLDER_URL_YEAR_VERSIONS_UNSELECTED'));
  assert.ok(report.memberships[0].gapCodes.includes('NO_PROVEN_ATTRIBUTABLE_STATEMENT'));
});

test('never translates a missing site, archive, or statement into evidence of no position', () => {
  const report = auditSenateCampaignIssuePlatforms(input({ sites: [], captures: [], statements: [], discoveries: [] }));
  const row = report.memberships[0];
  assert.equal(row.provenAttributedStatements, 0);
  assert.deepEqual(row.gapCodes, [
    'NO_CAMPAIGN_URL_INVENTORY', 'NO_VERIFIABLE_ARCHIVE_CAPTURE', 'NO_VERIFIED_ISSUE_PAGE_TEXT',
    'DISCOVERY_CENSUS_NOT_EXPORTED', 'NO_PROVEN_ATTRIBUTABLE_STATEMENT',
  ]);
  assert.equal(report.totals.membershipsWithoutProvenAttributedStatement, 1);
  assert.equal(report.scope.officialRosterDenominatorVerified, false);
});

test('unverified text hashes, unrelated excerpts, and third-party quotations fail closed', () => {
  const capture = snapshot('20220215134000', 'GOOD', { pageTextSha256: sha('wrong') });
  const other = snapshot('20211215134000', 'OTHER', { pageText: 'I support highways.' ,pageTextSha256: sha('I support highways.') });
  const report = auditSenateCampaignIssuePlatforms(input({ captures: [capture, other],
    statements: [
      { membershipId: id, archiveUrl: capture.archiveUrl, policyFamily: 'education', excerpt, attribution: 'candidate', stance: 'supports' },
      { membershipId: id, archiveUrl: other.archiveUrl, policyFamily: 'education', excerpt, attribution: 'third_party', stance: 'supports' },
    ] }));
  assert.equal(report.memberships[0].provenAttributedStatements, 0);
  assert.ok(report.memberships[0].gapCodes.includes('STATEMENT_PROOF_UNVERIFIED'));
  assert.ok(report.memberships[0].gapCodes.includes('CAPTURE_TEXT_OR_HASH_UNVERIFIED'));
});

test('CDX cap and failures are explicit; unknown campaign year is not guessed from a Senate session', () => {
  const report = auditSenateCampaignIssuePlatforms(input({
    sites: [{ ...sites[0], campaignYear: null, status: 'unavailable' }],
    discoveries: [
      { membershipId: id, seedUrl: sites[0].url, requestedLimit: 400, returnedCount: 400, status: 'complete' },
      { membershipId: id, seedUrl: original, requestedLimit: 400, returnedCount: 0, status: 'failed' },
    ],
  }));
  const codes = report.memberships[0].gapCodes;
  assert.ok(codes.includes('CAMPAIGN_YEAR_UNKNOWN'));
  assert.ok(codes.includes('CDX_DISCOVERY_LIMIT_REACHED'));
  assert.ok(codes.includes('ARCHIVE_DISCOVERY_FAILURE'));
  assert.ok(codes.includes('SITE_PROVENANCE_UNVERIFIED'));
});

test('an archive capture made in 2026 cannot prove an issue position was public by 2025', () => {
  const future = snapshot('20260105111111', 'FUTURE');
  const report = auditSenateCampaignIssuePlatforms(input({ captures: [future],
    statements: [{ membershipId: id, archiveUrl: future.archiveUrl,
      policyFamily: 'education', excerpt, attribution: 'candidate', stance: 'supports' }] }));
  assert.equal(report.memberships[0].provenAttributedStatements, 0);
  assert.equal(report.memberships[0].statements[0].earliestProvenPublicBy, null);
  assert.equal(report.memberships[0].capturesDiscoveredInScope, 0);
});

test('invalid capture timestamp / archive URL binding cannot establish public availability', () => {
  const mismatch = snapshot('20211211121314', 'MISMATCH', { capturedAt: '2021-12-10T12:13:14.000Z' });
  const report = auditSenateCampaignIssuePlatforms(input({ captures: [mismatch],
    statements: [{ membershipId: id, archiveUrl: mismatch.archiveUrl,
      policyFamily: 'education', excerpt, attribution: 'candidate', stance: 'supports' }] }));
  assert.equal(report.memberships[0].provenAttributedStatements, 0);
  assert.ok(report.memberships[0].gapCodes.includes('CAPTURE_IDENTITY_INVALID'));
});

test('unknown membership references and duplicate roster members are rejected', () => {
  assert.throws(() => auditSenateCampaignIssuePlatforms(input({
    roster: [...baseRoster, ...baseRoster],
  })), /Duplicate membership/);
  assert.throws(() => auditSenateCampaignIssuePlatforms(input({
    captures: [snapshot('20210316112233', 'A', { membershipId: 'other' })],
  })), /Unrecognized membership/);
});

test('candidate ownership with an unknown campaign year cannot establish a proven statement', () => {
  const c = snapshot('20210401010101', 'PAGE', { campaignYear: null });
  const report = auditSenateCampaignIssuePlatforms(input({
    sites: [{ ...sites[0], campaignYear: null }],
    captures: [c],
    statements: [{ membershipId: id, archiveUrl: c.archiveUrl, policyFamily: 'education',
      excerpt, attribution: 'candidate', stance: 'supports' }],
  }));
  assert.equal(report.memberships[0].provenAttributedStatements, 0);
  assert.ok(report.memberships[0].gapCodes.includes('CAMPAIGN_YEAR_UNKNOWN'));
});

test('duplicate capture identity is rejected instead of using arbitrary text from duplicates', () => {
  const capture = snapshot('20210401010101', 'PAGE');
  assert.throws(() => auditSenateCampaignIssuePlatforms(input({
    captures: [capture, { ...capture, pageText: 'contradictory text' }],
  })), /Duplicate archive capture/);
});

test('a 2026 campaign cycle statement may be archived in 2025 for historical analysis', () => {
  const capture = snapshot('20251201010101', 'PAGE', { campaignYear: 2026 });
  const report = auditSenateCampaignIssuePlatforms(input({
    roster: [{ ...baseRoster[0], sessionSlug: '2025-2026' }],
    sites: [{ ...sites[0], campaignYear: 2026 }],
    captures: [capture],
    statements: [{ membershipId: id, archiveUrl: capture.archiveUrl, policyFamily: 'education',
      excerpt, attribution: 'candidate', stance: 'supports' }],
  }));
  assert.equal(report.memberships[0].provenAttributedStatements, 1);
  assert.deepEqual(report.memberships[0].auditedCalendarYears, [2025]);
});

test('offline CLI writes a deterministic private JSON report without any runtime credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'campaign-issue-audit-'));
  try {
    const rows = input();
    for (const [name, value] of Object.entries(rows)) {
      writeFileSync(join(dir, name + '.jsonl'), (value ?? []).map((v: unknown) => JSON.stringify(v)).join('\n') + '\n');
    }
    const output = join(dir, 'result.json');
    execFileSync('node', ['--import', 'tsx', 'scripts/audit-campaign-issue-platforms-offline.ts',
      '--roster', join(dir, 'roster.jsonl'), '--sites', join(dir, 'sites.jsonl'),
      '--captures', join(dir, 'captures.jsonl'), '--statements', join(dir, 'statements.jsonl'),
      '--discoveries', join(dir, 'discoveries.jsonl'), '--output', output], { timeout: 15_000, stdio: 'pipe' });
    const result = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(result.totals.membershipsWithProvenAttributedStatement, 1);
    assert.equal(result.scope.productionReads, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
