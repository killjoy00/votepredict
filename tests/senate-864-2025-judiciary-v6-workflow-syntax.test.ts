import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(
 '.github/workflows/senate-864-2025-judiciary-postrollback-v6.yml','utf8');
const marker='SENATE_864_JUDICIARY_2025_POSTROLLBACK_NUMERIC_ONESHOT_20261012_V6';
function job(begin:string,end:string){
 const a=source.indexOf('  '+begin+':\n');
 const b=source.indexOf('  '+end+':\n',a+1);
 assert.ok(a>=0&&b>a,'Required main/protected job boundary missing');
 return source.slice(a,b);
}
function getKeylessScript(){
 const at=source.split('\n').indexOf('          script: |');
 assert.ok(at>=0,'Expected keyless issue reporter');
 assert.equal(source.split('\n').lastIndexOf('          script: |'),at);
 const arr:string[]=[];
 for(const line of source.split('\n').slice(at+1)){
  if(line!==''&&!line.startsWith('            '))break;
  arr.push(line===''?'':line.slice(12));
 }
 assert.ok(arr.length>75,'Complete V6 numeric-only issue reporter required');
 return arr.join('\n');
}
test('distinct V6 first-attempt marker, exactly 21 SHA-pinned independent government metadata artifacts',()=>{
 assert.match(source,new RegExp(marker));
 assert.doesNotMatch(source,/SENATE_864_JUDICIARY_2025_FULL_ORIGINAL_NEON_ONESHOT_20261012_V5/);
 assert.equal((source.match(/Pin existing original government source artifact [0-9]+ of 20/g)||[]).length,20);
 assert.equal((source.match(/uses: actions\/download-artifact@v4/g)||[]).length,22);
 assert.match(source,/run-id: 38070395356/);
 assert.match(source,/run-id: 38066441841/);
 assert.match(source,/sha256:841dc184b1596a2af00a7652910c31fa903cde258b85d3cdb4e0ff1d08aeb703/);
 assert.match(source,/11676168658/);
 assert.match(source,/--source-preflight/);
 assert.match(source,/github.run_attempt == 1/);
 assert.match(source,/github.event.pull_request.head.repo.full_name == 'killjoy00\/votepredict'/);
});
test('Neon API key is never available on PRs or main presecret runs; isolated protected step only',()=>{
 const pr=job('pr-synthetic-tests','pinned-source-preflight');
 const sourceStep=job('pinned-source-preflight','main-presecret-proof');
 const before=job('main-presecret-proof','protected-existing-neon-readonly');
 const protectedStep=job('protected-existing-neon-readonly','keyless-sanitized-issue-receipt');
 for(const str of [pr,sourceStep,before])assert.doesNotMatch(str,/secrets.NEON_API_KEY|--protected/);
 assert.match(protectedStep,/environment: evidence-readonly-sandbox/);
 assert.match(protectedStep,/secrets.NEON_API_KEY/);
 assert.match(protectedStep,/needs: \[pinned-source-preflight,main-presecret-proof\]/);
 assert.match(protectedStep,/VOTEPREDICT_864_JUDICIARY_V6_MARKER_PRESENT/);
 assert.match(protectedStep,/--protected/);
 const migrate=before.indexOf('run: npm run db:migrate');
 const full=before.indexOf('run: npm run check');
 const sql=before.indexOf('scripts/verify-senate-864-source-db-sql-local.ts');
 const audit=before.indexOf('npm audit --omit=dev --audit-level=high');
 assert.ok(migrate>0&&full>migrate&&sql>full&&audit>sql);
 assert.match(before,/postgres:18-alpine/);
 assert.match(sourceStep,/actions\/upload-artifact@v4/);
});
test('V6 keyless receipt script is valid async JavaScript, exact whitelist and no names/keys',()=>{
 const script=getKeylessScript();
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction('github',script));
 assert.match(script,/Unexpected private field/);
 assert.match(script,/FULL_8_OF_8/);
 assert.match(script,/HOLD/);
 assert.match(script,/sourceEventTallyMismatchCategories/);
 assert.match(script,/priorV5HeldIssueReceiptId/);
 assert.match(script,/issue_number:864/);
 assert.match(script,/noDatabaseWrites/);
 assert.doesNotMatch(script,/secrets.NEON_API_KEY|normalized_member_name|postgresql:\/\/|SELECT \*/);
});

function reporterFixture(parity:'FULL_8_OF_8'|'HOLD'='FULL_8_OF_8'){
 const js=getKeylessScript();
 const keys=js.match(/const keys=\('([^']+)'\)\.split\(' '\);/);
 const booleans=js.match(/const bKeys=\('([^']+)'\)\.split\(' '\);/);
 assert.ok(keys&&booleans,'Explicit exact field and boolean whitelists required');
 const obj:Record<string,unknown>={};
 for(const k of keys[1]!.split(' '))obj[k]=0;
 for(const k of booleans[1]!.split(' '))obj[k]=true;
 Object.assign(obj,{
  schemaVersion:'mn-864-2025-judiciary-postrollback-v6-safe-numeric-diagnostic',
  issue:864,priorV5HeldRunId:38266959992,
  priorV5HeldIssueReceiptId:6126911116,
  priorV2ProtectedRunId:38201074454,priorV4ProtectedRunId:38262800243,
  independentlyVerifiedOriginalJudiciaryArtifactId:11676168658,
  original2025JudiciaryYea:7,original2025JudiciaryNay:1,
  original2025JudiciaryChoiceHashes:8,
  originalPdfHashProofsAvailable:1452,
  storedPdfHashMatches:1452,
  sourceDetailedCandidateRolls:153,sourceDetailedNamedChoiceTokens:989,
  original2025DetailedRolls:33,original2025DetailedChoices:305,
  matched2025DetailedRolls:parity==='FULL_8_OF_8'?33:32,
  matched2025DetailedChoices:parity==='FULL_8_OF_8'?305:297,
  missingSingleSourceYeaChoices:1,
  individual2025FingerprintParity:parity,
  explicitHoldReason:parity==='FULL_8_OF_8'?'COMPLETE':'TALLY_OR_EVENT_MATCH_UNVERIFIED',
 });
 return obj;
}
async function evaluateKeylessReporter(payload:Record<string,unknown>){
 const old:Record<string,string|undefined>={};
 const settings={
  SOURCE_RESULT:'success',VERIFY_RESULT:'success',
  PROTECTED_RESULT:'success',SAFE_RESULT:Buffer.from(JSON.stringify(payload),'utf8').toString('base64'),
  GITHUB_SHA:'1234567890abcdef1234567890abcdef12345678',
  GITHUB_RUN_ID:'38269000000',
 };
 for(const [k,v] of Object.entries(settings)){
  old[k]=process.env[k];
  process.env[k]=v;
 }
 const observed:Record<string,unknown>[]=[];
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 try {
  await new AsyncFunction('github',getKeylessScript())({
   rest:{issues:{createComment:async (arg:Record<string,unknown>)=>{observed.push(arg);}}},
  });
  return observed;
 }finally{
  for(const [k,v] of Object.entries(old)){
   if(v===undefined)delete process.env[k];
   else process.env[k]=v;
  }
 }
}
test('strict numeric-only keyless reporter executes both full and held synthetic receipts without private fields',async()=>{
 const complete=await evaluateKeylessReporter(reporterFixture());
 assert.equal(complete.length,1);
 assert.equal(complete[0]!.issue_number,864);
 assert.match(String(complete[0]!.body),/FULL_8_OF_8/);
 assert.match(String(complete[0]!.body),/COMPLETE/);
 const held=await evaluateKeylessReporter(reporterFixture('HOLD'));
 assert.equal(held.length,1);
 assert.match(String(held[0]!.body),/HOLD/);
 assert.match(String(held[0]!.body),/TALLY_OR_EVENT_MATCH_UNVERIFIED/);
});
test('strict keyless reporter rejects unexpected private source member key without publishing',async()=>{
 const obj=reporterFixture();
 obj.normalized_member_name='synthetic-do-not-export';
 await assert.rejects(()=>evaluateKeylessReporter(obj),/Unexpected private field/);
});

test('the complete V6 keyless JavaScript remains indented as a YAML block scalar',()=>{
 const lines=source.split('\n');
 const start=lines.indexOf('          script: |');
 assert.ok(start>=0);
 const unindented=lines.slice(start+1)
  .map((line,i)=>({number:i+start+2,line}))
  .filter(x=>x.line.trim()!==''&&!x.line.startsWith('            '));
 assert.deepEqual(unindented,[],'No unindented JavaScript may invalidate the GitHub Actions workflow');
});
