import assert from 'node:assert/strict';
import test from 'node:test';
import ledger from '../data/evaluation/senate-six-2020-original-pages-26-new-exact-first-party-excerpts-v1.json' with {type:'json'};

test('#864 2020 six senators 26 new site snippets preserve original source chronology',()=>{
 assert.equal(ledger.issue,864);
 assert.equal(ledger.proof.officialActuallyServing2021Senators,6);
 assert.equal(ledger.proof.wholeOriginalCDXIndexes,6);
 assert.equal(ledger.proof.originalHTMLPages,24);
 assert.equal(ledger.proof.selectedPages,2);
 assert.equal(ledger.proof.additionalShortStatements,26);
 assert.equal(ledger.proof.sourceDatesOnlyPublicByNotFirstAuthorship,true);
 assert.equal(ledger.proof.StevePageContainsOld2016CopyNotFresh2020Policy,true);
 assert.equal(ledger.proof.allStatementsResearchOnly,true);
 assert.equal(ledger.proof.officialRecordedSenateVotesFromCandidateClaim,0);
 assert.equal(ledger.proof.productionDatabaseEvidenceForecastModelSchedulerChanges,0);
 assert.equal(ledger.proof.fullStatewideCensus,false);
 assert.equal(ledger.sourcePages.length,2);
 assert.equal(ledger.statements.length,26);
 const ids=new Set<string>(),quotes=new Set<string>();
 for(const e of ledger.statements){
  assert.ok(!ids.has(e.id)&&!quotes.has(e.exactExcerpt));
  assert.ok(e.exactExcerpt.length>=8&&e.exactExcerpt.length<=130);
  assert.ok(ledger.sourcePages.some(p=>p.id===e.pageId));
  ids.add(e.id);quotes.add(e.exactExcerpt);
 }
 assert.equal(ledger.statements.filter(x=>x.pageId==='kunesh2020vision').length,23);
 assert.equal(ledger.statements.filter(x=>x.pageId==='cwod2019news').length,3);
 assert.equal(ledger.sourcePages[0]?.captureUtc,'2020-08-04T23:27:35.000Z');
 assert.equal(ledger.sourcePages[1]?.captureUtc,'2019-07-01T18:36:30.000Z');
});
