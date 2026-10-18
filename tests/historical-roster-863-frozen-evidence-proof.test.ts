import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ROSTER_863_PINNED_DIGESTS,ROSTER_863_PROOF_MARKER,
 checkRoster863ProofFreeze,auditRoster863FrozenProof,
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
test('no independent archive or source data can be inferred from CLI preflight',()=>{
 const output=execFileSync(process.execPath,[
  '--import','tsx','research/scripts/audit-863-frozen-directional-proof.ts',
  '--preflight'],{encoding:'utf8'});
 assert.match(output,/FROZEN_92_PROOF_PINNED_SOURCE_PREFLIGHT_OK/);
 assert.doesNotMatch(output,/postgres|NEON_API_KEY|forecast_prob|outcome_row/i);
});
