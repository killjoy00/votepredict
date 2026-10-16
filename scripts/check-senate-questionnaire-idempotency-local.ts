/**
 * Destructive fixture writes are permitted ONLY in the CI disposable local
 * PostgreSQL service; this script rejects all other targets and never uses
 * protected production/Neon credentials.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import type {CandidateResponse} from '../src/sources/minnesota/senate-questionnaire-raw.js';
import {insertQuestionnaire,questionnaireReadback} from '../src/operations/senate-questionnaire-ingest.js';

async function main():Promise<void>{
  if(process.env.VOTEPREDICT_QUESTIONNAIRE_DISPOSABLE_TEST!=='true'
    ||process.env.CI!=='true')
    throw Error('Only explicitly approved disposable CI test may run');
  const rawUrl=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL??'';
  const url=new URL(rawUrl);
  if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'
    ||url.port!=='5432'||url.pathname!=='/votepredict'
    ||url.username!=='postgres'||url.password!=='postgres'
    ||url.search||url.hash)
    throw Error('CI test refuses nonlocal or unrecognized Postgres target');
  const pool=new Pool({connectionString:rawUrl,max:1,ssl:false,connectionTimeoutMillis:10000});
  const client=await pool.connect();
  try{
    const before=await questionnaireReadback(client);
    const capture=(content:string,answers:[string,string]):CandidateResponse=>({
      sourceId:'disposable-local-smoke',
      publisher:'Disposable local CI',
      sourceKind:'publisher_response',
      sourceUrl:'https://example.invalid/2026-state-senate-qa-local-fixture',
      electionCycle:2026,title:'Fixture only',candidateName:'Local CI Test Candidate',
      office:'Minnesota State Senate',district:'1',party:'DFL',
      displayedPublicationOn:'2026-09-20',
      displayedSubmittedOn:null,archiveCapturedAt:null,
      fetchedAt:new Date().toISOString(),contentType:'text/html',
      contentSha256:createHash('sha256').update(content).digest('hex'),
      rawContent:content,
      qa:[{ordinal:1,question:'Question 1?',answer:answers[0]},
          {ordinal:2,question:'Question 2?',answer:answers[1]}],
    });
    const one=capture('<main>Original response A</main>',['Answer A','Answer B']);
    const boilerplate=capture('<main>Updated site navigation, same Q&A A</main>', ['Answer A','Answer B']);
    const revised=capture('<main>Revised answer B</main>',['Answer A','Updated candidate answer B']);
    const revisedBoilerplate=capture('<main>Another unrelated site change, updated answer B</main>',
      ['Answer A','Updated candidate answer B']);

    assert.equal((await insertQuestionnaire(client,one)).inserted,true);
    assert.equal((await insertQuestionnaire(client,boilerplate)).inserted,false);
    assert.equal((await insertQuestionnaire(client,revised)).inserted,true);
    assert.equal((await insertQuestionnaire(client,revisedBoilerplate)).inserted,false);

    const after=await questionnaireReadback(client);
    assert.equal(after.totals.captures-before.totals.captures,2);
    assert.equal(after.totals.qaPairs-before.totals.qaPairs,4);
    assert.equal(after.totals.uniqueQaVersions-before.totals.uniqueQaVersions,2);
    assert.equal(after.totals.uniqueQaPairs-before.totals.uniqueQaPairs,4);
    assert.equal(after.totals.repeatQaSnapshots-before.totals.repeatQaSnapshots,0);
    console.log('QUESTIONNAIRE_DISPOSABLE_IDEMPOTENCY='+JSON.stringify({
      newVersions:2,distinctPairs:4,ignoredHtmlOnlyRevisions:2,
    }));
  }finally{
    client.release(true);await pool.end();
  }
}
void main().catch(()=>{
  console.error('QUESTIONNAIRE_DISPOSABLE_IDEMPOTENCY_FAILED');
  process.exitCode=1;
});
