import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLifecycleExternalFeatureRows } from '../src/evaluation/lifecycle-external-evidence-screen.js';

const model={schemaVersion:'lifecycle-p4-prospective-stage-v1',model:'lifecycle-stage-empirical-v1',fittedThroughSession:'2021-2022',trainingRows:1,trainingPositives:0,overallProbability:0.1,chamberProbabilities:{house:0.1},chamberStateProbabilities:{'house|introduced':0.1}} as any;
function snapshot(cutoff='2025-02-10'){
  return {snapshotId:'s1',bill:{billId:'b1',session:'2025-2026',chamber:'house',identifier:'HF1'},cutoff:{asOfDateExclusive:cutoff,granularity:'date',sameDayExcluded:true,reason:'before_transition'},features:{lifecycleState:'introduced',daysSinceIntroduction:10,daysSincePreviousTransition:10,daysRemainingInBiennium:500,priorProcessEventCount:0,priorProcessStageCounts:{},priorCompanionIdentifiers:[],latestEligibleBillVersion:null,authorship:{reconstructable:true,membershipIds:['m1'],parserVersion:'x'},evidenceFamilyCounts:{}},targets:{transitionOnCutoffDate:{stageKinds:[],toState:null,terminalOutcome:null},eventualSourceChamberPassage:false,eventualReachesSourceChamberPassageVote:false,terminalOutcome:'session_expired_without_source_chamber_passage'},lineage:{introductionParserVersion:null,processParserVersion:null,processAuditVersion:null,processStatus:null,passageLabelVersion:'x',priorProcessSourceDocumentSha256:[],priorProcessSourceUrls:[]}} as any;
}
const predict=()=>0.1;

test('external lifecycle rows exclude same-day evidence',()=>{
  const rows=buildLifecycleExternalFeatureRows({snapshots:[snapshot()],baselineModel:model,baselinePredict:predict,accepted:[
    {evidenceId:'e1',sourceDocumentId:'d1',billId:'b1',membershipId:null,session:'2025-2026',family:'official_bill_summary',availableOn:'2025-02-09',sourceKind:'x',evidenceKind:'context',stance:null,rule:'x'},
    {evidenceId:'e2',sourceDocumentId:'d2',billId:'b1',membershipId:null,session:'2025-2026',family:'official_conferee',availableOn:'2025-02-10',sourceKind:'x',evidenceKind:'context',stance:null,rule:'x'},
  ] as any});
  assert.equal(rows[0].features.official_bill_summary,1);
  assert.equal(rows[0].features.official_conferee,0);
});

test('author context requires reconstructable historical authorship',()=>{
  const withAuthors=buildLifecycleExternalFeatureRows({snapshots:[snapshot()],baselineModel:model,baselinePredict:predict,accepted:[
    {evidenceId:'e1',sourceDocumentId:'d1',billId:null,membershipId:'m1',session:'2025-2026',family:'author_verified_news',availableOn:'2025-02-01',sourceKind:'x',evidenceKind:'context',stance:null,rule:'x'},
  ] as any});
  assert.equal(withAuthors[0].features.author_verified_news,1);
  const noAuthors={...snapshot(),features:{...snapshot().features,authorship:{reconstructable:false,membershipIds:null,parserVersion:null}}};
  const without=buildLifecycleExternalFeatureRows({snapshots:[noAuthors],baselineModel:model,baselinePredict:predict,accepted:[] as any});
  assert.equal(without[0].authorEvidenceItems,0);
});
