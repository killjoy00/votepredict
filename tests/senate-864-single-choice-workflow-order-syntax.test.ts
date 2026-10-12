import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(
 '.github/workflows/senate-864-single-choice-tally-side-readonly-v3.yml','utf8');
const v4Marker='SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V4';

function job(name:string,next:string){
 const begin=workflow.indexOf('  '+name+':\n');
 const end=workflow.indexOf('  '+next+':\n',begin+1);
 assert.ok(begin>=0&&end>begin,'Expected unique protected workflow job boundaries');
 return workflow.slice(begin,end);
}
function reporterScript(){
 const lines=workflow.split('\n');
 const at=lines.indexOf('          script: |');
 assert.ok(at>=0,'Expected exactly one keyless github-script block');
 assert.equal(lines.indexOf('          script: |',at+1),-1);
 const result:string[]=[];
 for(let i=at+1;i<lines.length;i++){
  const line=lines[i]!;
  if(line!==''&&!line.startsWith('            '))break;
  result.push(line===''?'':line.slice(12));
 }
 assert.ok(result.length>=70,'Expected complete keyless issue reporter');
 return result.join('\n');
}

test('a distinct first-attempt V4 marker replaced V3 in the protected workflow',()=>{
 assert.ok(workflow.includes(v4Marker));
 assert.doesNotMatch(workflow,/SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V3/);
 const protectedJob=job('protected-existing-neon-readonly','keyless-sanitized-issue-receipt');
 assert.match(protectedJob,/environment: evidence-readonly-sandbox/);
 assert.match(protectedJob,/VOTEPREDICT_864_SINGLE_CHOICE_MARKER_PRESENT:/);
 assert.match(protectedJob,/VOTEPREDICT_864_ONE_SHOT_MARKER_PRESENT:/);
 assert.match(protectedJob,/needs: \[pinned-source-preflight,main-presecret-proof\]/);
 assert.match(protectedJob,/secrets.NEON_API_KEY/);
 assert.match(protectedJob,/--protected/);
 const presecret=job('main-presecret-proof','protected-existing-neon-readonly');
 assert.doesNotMatch(presecret,/secrets.NEON_API_KEY|NEON_API_KEY|--protected/);
 assert.match(presecret,/github.run_attempt == 1/);
 assert.match(presecret,/contains\(github.event.head_commit.message/);
 assert.match(workflow,/github.event.pull_request.head.repo.full_name == 'killjoy00\/votepredict'/);
});

test('main presecret migrations precede full tests and disposable EXPLAIN, not vice versa',()=>{
 const body=job('main-presecret-proof','protected-existing-neon-readonly');
 const migrate=body.indexOf('run: npm run db:migrate');
 const full=body.indexOf('run: npm run check');
 const explain=body.indexOf('node --import tsx scripts/verify-senate-864-source-db-sql-local.ts');
 const audit=body.indexOf('run: npm audit --omit=dev --audit-level=high');
 assert.ok(migrate>0&&full>migrate&&explain>full&&audit>explain);
 assert.equal(body.split('run: npm run db:migrate').length,2);
 assert.match(body,/services:[\s\S]*postgres:/);
 assert.match(body,/github.run_attempt == 1/);
});

test('keyless receipt JS is syntactically valid async JS and cannot include secrets',()=>{
 const js=reporterScript();
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 assert.doesNotThrow(()=>new AsyncFunction('github',js));
 assert.match(js,/V4/);
 assert.match(js,/issue_number:864/);
 assert.match(js,/One READ ONLY REPEATABLE READ transaction/);
 assert.doesNotMatch(js,/NEON_API_KEY|postgresql:\/\/|SELECT \*|normalized_member_name/);
 assert.match(js,/Missing|missing/i);
});
