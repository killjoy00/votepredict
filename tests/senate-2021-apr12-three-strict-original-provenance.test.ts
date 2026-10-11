import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json','utf8'
));
test('three original separate April12 committee amendments independently authenticated by second PDF',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.original.originalPDFBytes,11063699);
 assert.equal(proof.firstPass.wasProvisionalNotIndependentCertification,true);
 assert.equal(proof.strictSecondPass.runId,38171360478);
 assert.equal(proof.strictSecondPass.conclusion,'success');
 assert.equal(proof.strictSecondPass.verifiedMotionCount,3);
 assert.equal(proof.strictSecondPass.sourceErrors,0);
 assert.equal(proof.strictSecondPass.zipBytes,1773);
 assert.equal(proof.strictSecondPass.decodedJSONBytes,5556);
 assert.equal(proof.firstPass.independentlyDownloadedZipBytes,1697);
 assert.equal(proof.firstPass.decodedJSONBytes,4548);
 assert.deepEqual(proof.motions.map((x:{bill:string;mover:string})=>[x.bill,x.mover]),
  [['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']]);
 assert.deepEqual(proof.motions.map((x:{printedYea:number;printedNay:number;printedAbsent:null})=>
  [x.printedYea,x.printedNay,x.printedAbsent]),[[4,6,null],[4,6,null],[3,6,null]]);
 const [first,second,third]=proof.motions;
 assert.notEqual(first.motionNormalizedOffset,second.motionNormalizedOffset);
 assert.notEqual(first.motionNeighborhoodSHA256,second.motionNeighborhoodSHA256);
 assert.deepEqual(first.memberSidesSHA256Only,second.memberSidesSHA256Only);
 assert.notDeepEqual(first.memberSidesSHA256Only,third.memberSidesSHA256Only);
 for(const d of [
  proof.original.originalPDFSHA256,proof.original.originalTextSHA256,
  proof.original.normalizedTextSHA256,
  proof.firstPass.zipSHA256,proof.firstPass.decodedJSONSHA256,
  proof.strictSecondPass.zipSHA256,proof.strictSecondPass.decodedJSONSHA256,
  ...proof.motions.flatMap((x:{
   motionNeighborhoodSHA256:string;memberSidesSHA256Only:{yea:string;nay:string}
  })=>[x.motionNeighborhoodSHA256,x.memberSidesSHA256Only.yea,x.memberSidesSHA256Only.nay])
 ])assert.match(d,/^[a-f0-9]{64}$/);
 assert.equal(proof.limits.reportDateNotOriginalMeetingDate,true);
 assert.equal(proof.limits.absentUnprintedNull,true);
 assert.equal(proof.limits.noDatabaseVoteReconciliationOrBackfill,true);
 assert.equal(proof.limits.issue864MustRemainOpen,true);
});
