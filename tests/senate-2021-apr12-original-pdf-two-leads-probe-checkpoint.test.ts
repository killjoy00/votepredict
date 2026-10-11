import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-sf1159-sf970-original-pdf-leads-probe-success.json','utf8'
));
test('genuine April12 original PDF/ZIP/JSON verified but not yet certified named committee votes',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.actualGithubActions.conclusion,'success');
 assert.equal(proof.actualGithubActions.originalSourceErrorCount,0);
 assert.equal(proof.actualGithubActions.runId,38169533978);
 assert.equal(proof.actualGithubActions.independentlyDownloadedZIPBytes,1199);
 assert.equal(proof.actualGithubActions.independentlyExtractedJSONBytes,2689);
 assert.equal(proof.originalSource.originalPDFBytes,11063699);
 for(const digest of [
  proof.originalSource.originalPDFSHA256,
  proof.originalSource.originalExtractedTextSHA256,
  proof.originalSource.originalNormalizedTextSHA256,
  proof.actualGithubActions.independentlyDownloadedZIPSHA256,
  proof.actualGithubActions.independentlyExtractedJSONSHA256
 ])assert.match(digest,/^[0-9a-f]{64}$/);
 assert.deepEqual(proof.exactIndexPublicationLeads.map((x:{bill:string})=>x.bill),
   ['SF1159','SF970']);
 const [a,b]=proof.exactIndexPublicationLeads;
 assert.equal(a.originalRule1210MotionContextValidatorPassed,false);
 assert.equal(a.sourcePrintedYea,null);
 assert.equal(b.sourceMotion,'Pappas amendment to SF970');
 assert.equal(b.originalRule1210MotionContextValidatorPassed,true);
 assert.equal(b.originalRule1210MotionNormalizedTextOffset,1531950);
 assert.match(b.originalMotionTextSHA256,/^[0-9a-f]{64}$/);
 for(const row of [a,b]){
  assert.equal(row.sourcePrintedYea,null);
  assert.equal(row.sourcePrintedNay,null);
  assert.equal(row.sourcePrintedAbsent,null);
  assert.equal(row.individualSenatorSideSHA,null);
 }
 assert.equal(proof.sourceLimitations.successfulSourceProbeIsNotNamedRollCertification,true);
 assert.equal(proof.sourceLimitations.noClaimOfTwoAuthenticatedNamedRolls,true);
 assert.equal(proof.sourceLimitations.issue864MustRemainOpen,true);
 assert.equal(proof.sourceLimitations.noProductionOrPrivateDBReadsOrWrites,true);
});
