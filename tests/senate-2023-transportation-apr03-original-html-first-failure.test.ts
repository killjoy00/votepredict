import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2023-transportation-apr03-original-html-first-parse-failure.json',
 'utf8'
));
test('original April 3 2023 HTML successfully acquired, but roll parser FAILED at A28',()=>{
 assert.equal(p.schemaVersion,'senate-2023-transportation-apr03-sf3157-original-html-first-parse-failure-v1');
 assert.equal(p.issue,864);
 assert.equal(p.eventDate,'2023-04-03');
 assert.equal(p.committee,'Transportation');
 assert.equal(p.bill,'SF3157');
 const x=p.firstOriginalSourceRun;
 assert.equal(x.githubActionsRunId,38158242090);
 assert.equal(x.sourceRunnerPR,1078);
 assert.equal(x.sourceRunnerMergeCommit,'4f77962b0fc6d629d964f5682ea67dbdcb352a48');
 assert.equal(x.conclusion,'failure');
 assert.equal(x.originalArtifactId,11708857555);
 assert.equal(x.originalArtifactName,'senate-2023-transportation-apr03-sf3157-original-seven-rolls');
 assert.equal(x.independentlyDownloadedZipSha256,
  '6a4d5998d2dd250b3fc82197325ffb22165130eef5c27bdef7fe48b31d6cbe55');
 assert.equal(x.originalZipBytes,916);
 assert.equal(x.originalDecodedJsonSha256,
  '3f2bdd8aa68a6fd32ecf13b0d3362eb52fef8ca38125f2110b504ce6e6b0546b');
 assert.equal(x.originalDecodedJsonBytes,1242);
 assert.equal(x.actualOfficialOriginalHtmlRetrieved,true);
 assert.equal(x.originalHtmlBytes,78781);
 assert.equal(x.originalHtmlSha256,'efbcf9bf503fcde638854a244748959e89ed336079099a51a44a16bb9bc1c203');
 assert.equal(x.normalizedOriginalTextSha256,'ede07baa4f72e29b009310039bc8cde0011bc0148ab530b711b1e9a7542f7a82');
 assert.equal(x.sourceSevenOriginalNamedRollsSuccessfullyParsed,false);
 assert.equal(x.preciseOriginalParseFailure,'Original named roll has no bounded disposition for A28');
 assert.equal(x.noSuccessfulOriginalVoteCertificationFromThisRun,true);
});
test('strict source bounds retained, printed A49 vs A26 NOT silently repaired',()=>{
 for(const [k,v] of Object.entries({...p.repairSafety,...p.holds}))
  assert.equal(v,true,k);
});
