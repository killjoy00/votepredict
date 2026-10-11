import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {APR12_THREE_STRICT_ORIGINAL as source} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-redundant-two-motion-third-original-failure-superseded.json',
 'utf8'
));
const authoritative=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json',
 'utf8'
));

test('the original April12 Journal contains three certified distinct amendment motions, not two',()=>{
 assert.equal(source.motions.length,3);
 assert.equal(proof.authenticatedCorrection.strictOriginalNamedCommitteeRolls,3);
 assert.equal(authoritative.strictSecondPass.verifiedMotionCount,3);
 assert.equal(authoritative.strictSecondPass.runId,38171360478);
 assert.equal(authoritative.strictSecondPass.conclusion,'success');
 assert.equal(authoritative.strictSecondPass.sourceErrors,0);
 assert.deepEqual(source.motions.map(m=>[m.bill,m.mover,m.printedYea,m.printedNay]),
  [['SF1159','Dibble',4,6],['SF1159','McEwen',4,6],['SF970','Pappas',3,6]]);
 assert.deepEqual(authoritative.motions.map((m:{
  bill:string;mover:string;printedYea:number;printedNay:number
 })=>[m.bill,m.mover,m.printedYea,m.printedNay]),
  [['SF1159','Dibble',4,6],['SF1159','McEwen',4,6],['SF970','Pappas',3,6]]);
 const [dibble,mcewen,pappas]=source.motions;
 assert.notEqual(dibble.originalMotionNormalizedOffset,mcewen.originalMotionNormalizedOffset);
 assert.notEqual(dibble.originalMotionNeighborhoodSHA256,mcewen.originalMotionNeighborhoodSHA256);
 assert.equal(dibble.originalYeaNamesSHA256,mcewen.originalYeaNamesSHA256);
 assert.equal(dibble.originalNayNamesSHA256,mcewen.originalNayNamesSHA256);
 assert.notEqual(dibble.originalYeaNamesSHA256,pappas.originalYeaNamesSHA256);
 assert.equal(proof.authenticatedCorrection.sameSF1159NamedVoterSideHashesDoNotImplyDuplicateMotion,true);
 assert.equal(proof.authenticatedCorrection.originalPDFSHA256,source.originalPDFSHA256);
 assert.equal(proof.authenticatedCorrection.originalEmbeddedTextSHA256,source.originalEmbeddedTextSHA256);
 assert.equal(proof.authenticatedCorrection.independentlyDownloadedOriginalStrictZIPSHA256,
  authoritative.strictSecondPass.zipSHA256);
 assert.equal(proof.authenticatedCorrection.independentlyDecodedOriginalStrictJSONSHA256,
  authoritative.strictSecondPass.decodedJSONSHA256);
});

test('all three invalid two-motion source runs retain failure conclusions and artifact provenance',()=>{
 assert.deepEqual(proof.retiredProbeFailures.map((r:{originalSourceRunId:number})=>r.originalSourceRunId),
  [38172259470,38172682467,38173089761]);
 assert.ok(proof.retiredProbeFailures.every((r:{originalSourceRunConclusion:string})=>
  r.originalSourceRunConclusion==='failure'));
 const third=proof.retiredProbeFailures[2];
 assert.equal(third.originalPDFReceived,true);
 assert.equal(third.originalPDFBytes,11063699);
 assert.equal(third.originalArtifactId,11714807052);
 assert.equal(third.independentlyDownloadedZIPBytes,789);
 assert.equal(third.independentlyDecodedJSONBytes,1086);
 assert.equal(third.originalProvisionalSideResults,null);
 assert.equal(third.strictNamedRollAuthenticationFromThisJob,false);
 assert.equal(third.originalFailureReason,'SF1159 authentic motion-and-voter window SHA mismatch');
 assert.match(third.independentlyDownloadedZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(third.independentlyDecodedJSONSHA256,/^[a-f0-9]{64}$/);
 assert.equal(proof.dispositions.allFailedSourceRunsRemainFailures,true);
 assert.equal(proof.dispositions.issue864RemainsOpen,true);
 assert.equal(proof.dispositions.noPrivateProductionMemberVoteReconciliationOrBackfill,true);
});

test('superseded two-motion runtime and one-time Actions workflows are not retained',()=>{
 for(const file of [
  'src/evidence/senate-2021-apr12-rule1210-two-amendment-side-discovery.ts',
  'scripts/probe-senate-2021-apr12-original-two-amendment-sides.ts',
  'tests/senate-2021-apr12-rule1210-two-amendment-side-discovery.test.ts',
  '.github/workflows/senate-2021-apr12-two-original-amendment-side-sha-probe.yml',
  '.github/workflows/senate-2021-apr12-two-original-amendment-side-sha-retry.yml',
  '.github/workflows/senate-2021-apr12-two-original-amendments-sha-third-run.yml'
 ])assert.equal(existsSync(file),false,file+' should be retired');
 assert.equal(existsSync('src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.ts'),true);
 assert.equal(existsSync('docs/evaluation/source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json'),true);
});
