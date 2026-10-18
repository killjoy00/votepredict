import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ROSTER_863_PINNED_DIGESTS,ROSTER_863_PROOF_MARKER,
 checkRoster863ProofFreeze,auditRoster863FrozenProof,indexRoster863ArchiveProofs,
} from '../research/scripts/audit-863-frozen-directional-proof.js';
import {execFileSync} from 'node:child_process';

test('all archived inputs are original independently pinned digest identities',()=>{
 assert.equal(checkRoster863ProofFreeze(),true);
 assert.equal(new Set(Object.values(ROSTER_863_PINNED_DIGESTS)).size,7);
 assert.equal(ROSTER_863_PROOF_MARKER,
  'ROSTER_863_FROZEN_92_PROOF_V1_20261018');
});
test('no partial matrix, fabricated 92-row list or unverified upstream can pass',()=>{
 const f={
  manifest:{schemaVersion:'evidence-quality-historical-feature-matrix-v1.8-manifest',
    coverage:{matrixRows:135457,combinedNonzeroRows:92,
      exactNonzeroRows:38,reviewedApplicabilityNonzeroRows:54},
    digests:{matrixGzipSha256:ROSTER_863_PINNED_DIGESTS.matrixGzip,
      matrixCanonicalNdjsonSha256:ROSTER_863_PINNED_DIGESTS.matrixRaw}},
  rows:[],signals:[],repair:{},readiness:{},p2remaining:{}
 };
 assert.throws(()=>auditRoster863FrozenProof(f),/drift/);
 assert.throws(()=>auditRoster863FrozenProof({...f,
  manifest:{...f.manifest,coverage:{...f.manifest.coverage,
   combinedNonzeroRows:91}}}),/drift/);
});
test('multiple separately authenticated excerpts on the same target remain one row',()=>{
 const key='11111111-1111-1111-1111-111111111111|22222222-2222-2222-2222-222222222222';
 const a={evidenceId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  earliestVerifiedCapturedAt:'2024-03-10T10:00:00.000Z',
  provenTargetRowKeys:[key]};
 const b={evidenceId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  earliestVerifiedCapturedAt:'2024-02-26T10:00:00.000Z',
  provenTargetRowKeys:[key]};
 const reverse=indexRoster863ArchiveProofs([a,b]);
 const sorted=indexRoster863ArchiveProofs([b,a]);
 assert.equal(reverse.size,1);
 assert.equal(reverse.get(key)?.length,2);
 assert.deepEqual(reverse.get(key),sorted.get(key));
 assert.equal(reverse.get(key)?.[0]?.evidenceId,b.evidenceId);
 assert.throws(()=>indexRoster863ArchiveProofs([a,a]),/Duplicate evidence item identity/);
 assert.throws(()=>indexRoster863ArchiveProofs([{...a,earliestVerifiedCapturedAt:'2024-03-10'}]),
  /Malformed independently matched excerpt/);
});
test('no independent archive or source data can be inferred from CLI preflight',()=>{
 const output=execFileSync(process.execPath,[
  '--import','tsx','research/scripts/audit-863-frozen-directional-proof.ts',
  '--preflight'],{encoding:'utf8'});
 assert.match(output,/FROZEN_92_PROOF_PINNED_SOURCE_PREFLIGHT_OK/);
 assert.doesNotMatch(output,/postgres|NEON_API_KEY|forecast_prob|outcome_row/i);
});
