import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read=(name:string)=>{const raw=readFileSync(new URL(
  '../docs/evaluation/source-proof/'+name,import.meta.url),'utf8');
  return {json:JSON.parse(raw),gitBlobSha:createHash('sha1')
    .update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex')};
};
const main=read('senate-committee-phase2-41-15-original-source-ledger.json');
const media=read('senate-committee-phase2-media-and-supplemental-ledger.json');
const review=read('senate-committee-19-tally-matched-provisional-roll-review-queue.json');
const sum=(rows:any[],key:string)=>rows.reduce((n,r)=>n+Number(r[key]),0);

test('original official strong-roll 41 and OCR 15 candidate proof ledgers are immutable',()=>{
  assert.equal(main.gitBlobSha,'fbb36e90fc20429945ec55626657bfd378b9c620');
  const s=main.json.strong41,n=main.json.named15;
  assert.equal(main.json.issue,864);
  assert.equal(s.runId,38078641464);
  assert.equal(s.pr,896);
  assert.equal(s.officialSourcePdfsReverified,41);
  assert.equal(sum(s.years,'originals'),41);
  assert.equal(s.originalPdfOrTextShaDrift,0);
  assert.equal(s.failedOriginalPdfs,0);
  assert.equal(n.runId,38079052118);
  assert.equal(n.pr,898);
  assert.equal(n.officialSourcePdfsReverified,10);
  assert.equal(n.namedRollParserObservations,15);
  assert.equal(n.explicitSourceNamedChoices,134);
  assert.equal(sum(n.years,'parserNamedRolls'),15);
  assert.equal(sum(n.years,'namedChoiceTokens'),134);
  assert.equal(n.mechanicalIntegrityViolations,0);
  for(const item of [...s.years,...n.years]){
    assert.ok(item.artifactId>0);
    assert.match(item.zipSha256,/^[a-f0-9]{64}$/);
    assert.match(item.jsonSha256,/^[a-f0-9]{64}$/);
  }
});

test('exact official media records and provisional named-vote candidates remain separate, not certified votes',()=>{
  assert.equal(media.gitBlobSha,'945d7aa8603207c1aed6ae4e7ec94cc7bf86061b');
  const m=media.json,s=m.supplementalSource,h=m.headSource;
  assert.equal(m.mediaSource.runId,38079233118);
  assert.equal(sum(m.mediaSource.perYear,'archivedMtgidLinks'),138);
  assert.equal(m.officialMeetingPagesWithoutLinkedMinutesPdf,141);
  assert.equal(m.mediaSource.meetingsWithNoMediaLink,3);
  assert.equal(m.mediaSource.exactMinutesPdfsRecovered,0);
  assert.equal(s.runId,38079646647);
  assert.equal(s.provisionalNamedVoteBlocks,86);
  assert.equal(s.explicitNamedSideChoiceTokensInBlocks,823);
  assert.equal(s.sourceTallyMatches,19);
  assert.equal(s.matchedSourceNamedSideChoiceTokens,196);
  assert.equal(s.sourceTallyMismatches,10);
  assert.equal(s.sourceTallyUnknown,57);
  assert.equal(s.sourceTallyMatches+s.sourceTallyMismatches+s.sourceTallyUnknown,86);
  assert.equal(sum(s.perYear,'provisionalBlocks'),86);
  assert.equal(sum(s.perYear,'sourceTallyMatches'),19);
  assert.equal(sum(s.perYear,'provisionalNamedSideChoiceTokens'),823);
  assert.equal(s.allCandidatesProvisional,true);
  assert.equal(h.runId,38079795850);
  assert.equal(sum(h.perYear,'mtgidHeadResponses'),138);
  assert.equal(sum(h.perYear,'http200HtmlResponses'),138);
  assert.equal(h.errors,0);
  assert.equal(h.recordPageRespondedNotVerifiedMediaPlayback,true);
  for(const item of [...m.mediaSource.perYear,...s.perYear,...h.perYear]){
    assert.ok(item.artifactId>0);
    assert.match(item.zipSha256,/^[a-f0-9]{64}$/);
    assert.match(item.jsonSha256,/^[a-f0-9]{64}$/);
  }
});

test('the 19 numerically matched high-review-priority candidates are not database-ready votes',()=>{
  assert.equal(review.gitBlobSha,'30f1c8ed6d2d2edcbbefadcf61f8019c1c435538');
  const j=review.json,rows=j.records;
  assert.equal(j.sourceRunId,38079646647);
  assert.equal(j.totalCandidateBlocks,19);
  assert.equal(j.explicitNamedSourceTokens,196);
  assert.equal(rows.length,19);
  assert.deepEqual(rows.reduce((out:any,x:any)=>{
    out[x.year]=(out[x.year]??0)+1;return out;
  },{}),{'2023':1,'2024':3,'2025':15});
  assert.equal(new Set(rows.map((x:any)=>x.officialSourcePdfUrl+'|'+x.sourceTextOffset)).size,19);
  assert.equal(sum(rows,'yeaNamed')+sum(rows,'nayNamed'),196);
  for(const row of rows){
    const u=new URL(row.officialSourcePdfUrl);
    assert.equal(u.protocol,'https:');
    assert.equal(u.hostname,'www.lrl.mn.gov');
    assert.ok(u.pathname.includes('/senate/'+row.year+'/'));
    assert.ok(u.pathname.includes('/'+row.hearingDate.replaceAll('-','')+'/'));
    assert.equal(row.sourceNumericTallyMatchesNames,true);
    assert.equal(row.humanVerifiedDistinctMotion,false);
    assert.equal(row.senatorRosterVerified,false);
    assert.equal(row.eligibleAsMemberVote,false);
  }
  assert.equal(j.notCertifiedRecordedVoteDenominator,true);
});

test('immutable source proof bars DB, modeling, inferred passages and unknown-print claims',()=>{
  assert.equal(main.json.humanValidationAndPrivateDbReconciliationNotCompleted,true);
  assert.equal(main.json.officialRecordedVoteDenominator,null);
  assert.equal(main.json.productionDatabaseReadOrWrite,false);
  const x=media.json.limitations;
  assert.equal(x.memberChoiceIdentityNotOfficiallyRosterMatched,true);
  assert.equal(x.sourceMotionDistinctnessNotHumanVerified,true);
  assert.equal(x.official2021PrintOnlySenateMinutesUnresolved,true);
  assert.equal(x.year2022PrintElectronicMismatchUnresolved,true);
  assert.equal(x.all2021_2025RecordedVoteDenominator,null);
  assert.equal(x.noSourceToProductionDatabaseReconciliation,true);
  assert.equal(x.noProductionDbReadOrWrites,true);
  assert.equal(x.noForecastModelServingSchedulersOr2027Changed,true);
});
