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
