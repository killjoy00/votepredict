import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(
 '.github/workflows/senate-864-2025-judiciary-full-original-neon-v5.yml','utf8');
const marker='SENATE_864_JUDICIARY_2025_FULL_ORIGINAL_NEON_ONESHOT_20261012_V5';

function block(start:string,end:string){
 const a=workflow.indexOf('  '+start+':\n'),b=workflow.indexOf('  '+end+':\n',a+1);
 assert.ok(a>=0&&b>a,'Protected review job names must be unique');
 return workflow.slice(a,b);
}
function reporter(){
 const lines=workflow.split('\n'),start=lines.indexOf('          script: |');
 assert.ok(start>=0);
 assert.equal(lines.lastIndexOf('          script: |'),start);
 const body:string[]=[];
 for(let i=start+1;i<lines.length;i++){
  const raw=lines[i]!;
  if(raw!==''&&!raw.startsWith('            '))break;
  body.push(raw===''?'':raw.slice(12));
 }
 assert.ok(body.length>65,'Complete issue reporter must remain present');
 return body.join('\n');
}
test('2025 Judiciary fully independent source artifact and 20 V2 SHA metadata sources are pinned',()=>{
 assert.match(workflow,/senate-2025-judiciary-original-named-roll-source-proof/);
 assert.match(workflow,/run-id: 38070395356/);
 assert.match(workflow,/11676168658/);
 assert.match(workflow,/sha256:841dc184b1596a2af00a7652910c31fa903cde258b85d3cdb4e0ff1d08aeb703/);
 assert.equal((workflow.match(/uses: actions\/download-artifact@v4/g)||[]).length,22);
 assert.equal((workflow.match(/Pin existing original government source artifact [0-9]+ of 20/g)||[]).length,20);
 assert.match(workflow,/--source-preflight/);
 assert.match(workflow,/github.run_attempt == 1/);
 assert.match(workflow,new RegExp(marker));
});
test('V5 main protected receipt only after main SQL/timing/CI audit; Neon secret only in protected job',()=>{
 const source=block('pinned-source-preflight','main-presecret-proof');
 const presecret=block('main-presecret-proof','protected-existing-neon-readonly');
 const protectedStep=block('protected-existing-neon-readonly','keyless-sanitized-issue-receipt');
 const prJobs=block('pr-synthetic-tests','pinned-source-preflight');
 assert.doesNotMatch(source,/secrets.NEON_API_KEY|--protected/);
 assert.doesNotMatch(presecret,/secrets.NEON_API_KEY|--protected/);
 assert.doesNotMatch(prJobs,/secrets.NEON_API_KEY|--protected/);
 assert.match(protectedStep,/environment: evidence-readonly-sandbox/);
 assert.match(protectedStep,/secrets.NEON_API_KEY/);
 assert.match(protectedStep,/needs: \[pinned-source-preflight,main-presecret-proof\]/);
 assert.match(protectedStep,/VOTEPREDICT_864_JUDICIARY_2025_V5_MARKER_PRESENT/);
 const migration=presecret.indexOf('run: npm run db:migrate');
 const check=presecret.indexOf('run: npm run check');
 const sql=presecret.indexOf('scripts/verify-senate-864-source-db-sql-local.ts');
 const audit=presecret.indexOf('npm audit --omit=dev --audit-level=high');
 assert.ok(migration>0&&check>migration&&sql>check&&audit>sql);
 assert.match(presecret,/postgres:18-alpine/);
 assert.match(protectedStep,/--protected/);
 assert.match(workflow,/github.event.pull_request.head.repo.full_name == 'killjoy00\/votepredict'/);
});
test('strict keyless script is valid async JavaScript, publishes both FULL 8/8 and HOLD and does not leak names',()=>{
 const source=reporter();
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction('github',source));
 assert.match(source,/FULL_8_OF_8/);
 assert.match(source,/HOLD/);
 assert.match(source,/issue_number:864/);
 assert.match(source,/parentIssueStillOpen/);
 assert.match(source,/noDatabaseWrites/);
 assert.match(source,/Unexpected private fields/);
 assert.doesNotMatch(source,/NEON_API_KEY|normalized_member_name|SELECT \*/);
});
