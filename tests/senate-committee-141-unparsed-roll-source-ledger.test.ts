import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const raw=readFileSync(new URL('../docs/evaluation/source-proof/senate-committee-141-unparsed-roll-review-source-ledger.json',import.meta.url),'utf8');
const report=JSON.parse(raw);
test('all four actual source artifact hashes retained and Git blob pinned',()=>{
  const blob=createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
  assert.equal(blob,'bcf7d6275f3537361f211d93121c663410a572c2');
  assert.equal(report.schemaVersion,'senate-committee-2022-25-original-unparsed-roll-signal-source-ledger-v1');
  assert.equal(report.issue,864);
  assert.equal(report.originalFullPdfSourceRun,38066441841);
  assert.equal(report.candidateQueueWorkflowRun,38075573031);
  assert.equal(report.parserQueuePr,890);
  assert.equal(report.parserQueueMergedMainSha,'f1bd91130fcb471d9367fd2151a5ff8ee7bfacdd');
  assert.equal(report.parserQueuePremergeCI,38075381200);
  assert.equal(report.parserQueuePostmergeCI,38075573043);
  assert.deepEqual(report.byYear.map((x:any)=>x.year),[2022,2023,2024,2025]);
  assert.deepEqual(report.byYear.map((x:any)=>x.candidatePdfCount),[17,74,26,24]);
  assert.deepEqual(report.byYear.map((x:any)=>x.candidatePdfWithAyeNayLabels),[2,14,13,12]);
  assert.deepEqual(report.byYear.map((x:any)=>x.artifactId),[11677689429,11678374068,11677594594,11678279098]);
  for(const y of report.byYear){
    assert.match(y.zipSha256,/^[0-9a-f]{64}$/);
    assert.match(y.jsonSha256,/^[0-9a-f]{64}$/);
    assert.match(y.originalSourceJsonSha256,/^[0-9a-f]{64}$/);
    assert.ok(y.candidatePdfWithAyeNayLabels<=y.candidatePdfCount);
  }
  assert.equal(report.byYear.reduce((n:number,y:any)=>n+y.candidatePdfCount,0),141);
  assert.equal(report.byYear.reduce((n:number,y:any)=>n+y.candidatePdfWithAyeNayLabels,0),41);
});

test('a possible unparsed roll-call phrase is never a fabricated vote or proof of source completeness',()=>{
  assert.equal(report.candidateTotal,141);
  assert.equal(report.candidateWithExplicitAyeNayTextLabel,41);
  assert.equal(report.reviewInterpretation.rollPhraseMeansVote,false);
  assert.equal(report.reviewInterpretation.ayeNayTextLabelMeansNamedMemberChoice,false);
  assert.equal(report.reviewInterpretation.differentFrom141MeetingsWithoutMinutesLinks,true);
  assert.equal(report.reviewInterpretation.originalDocumentSemanticReviewCompleted,false);
  assert.equal(report.reviewInterpretation.exactSourcePdfHashProofNeededForVotePromotion,true);
  assert.equal(report.reviewInterpretation.sourceToPrivateDatabaseJoinExecuted,false);
  assert.equal(report.limitations.original2021PrintMeetingAndVoteDenominator,null);
  assert.equal(report.limitations.year2022PrintElectronicMayDiffer,true);
  assert.equal(report.limitations.allOfficialRecordedCommitteeVoteDenominator,null);
  assert.equal(report.limitations.allOfficialCommitteeMeetingDenominator,null);
  assert.equal(report.limitations.productionDatabaseWrites,false);
  assert.equal(report.limitations.modelForecastServingOrSchedulersChanged,false);
});
