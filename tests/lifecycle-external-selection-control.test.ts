import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLifecycleExternalSelectionRows } from '../src/evaluation/lifecycle-external-selection-control.js';

function snapshot(reconstructable:boolean){
  return {snapshotId:'s1',bill:{billId:'b1',session:'2025-2026',chamber:'house',identifier:'HF1'},cutoff:{asOfDateExclusive:'2025-02-10',granularity:'date',sameDayExcluded:true,reason:'before_transition'},features:{lifecycleState:'introduced',daysSinceIntroduction:10,daysSincePreviousTransition:10,daysRemainingInBiennium:500,priorProcessEventCount:0,priorProcessStageCounts:{},priorCompanionIdentifiers:[],latestEligibleBillVersion:null,authorship:{reconstructable,membershipIds:reconstructable?['m1']:null,parserVersion:'x'},evidenceFamilyCounts:{}},targets:{transitionOnCutoffDate:{stageKinds:[],toState:null,terminalOutcome:null},eventualSourceChamberPassage:false,eventualReachesSourceChamberPassageVote:false,terminalOutcome:'session_expired_without_source_chamber_passage'},lineage:{introductionParserVersion:null,processParserVersion:'revisor-process-v2',processAuditVersion:null,processStatus:null,passageLabelVersion:'x',priorProcessSourceDocumentSha256:[],priorProcessSourceUrls:[]}} as any;
}
const p5Model={schemaVersion:'lifecycle-p5-retained-prospective-v1',model:'core_minus_companion',families:['process_detail','bill_version'],fittedThroughSession:'2021-2022',targets:{source_chamber_passage:{target:'source_chamber_passage',trainingRows:1,trainingPositives:0,baseline:{overall:.1,chamber:{house:.1},stage:{'house|introduced':.1},group:{}},tokenStats:[]},reach_floor_eligibility:{target:'reach_floor_eligibility',trainingRows:1,trainingPositives:0,baseline:{overall:.1,chamber:{house:.1},stage:{'house|introduced':.1},group:{}},tokenStats:[]},reach_source_chamber_passage_vote:{target:'reach_source_chamber_passage_vote',trainingRows:1,trainingPositives:0,baseline:{overall:.1,chamber:{house:.1},stage:{'house|introduced':.1},group:{}},tokenStats:[]}}} as any;

test('selection-control author evidence requires reconstructable authorship and excludes same-day evidence',()=>{
  const accepted=[
    {evidenceId:'e1',sourceDocumentId:'d1',billId:null,membershipId:'m1',session:'2025-2026',family:'author_district_context',availableOn:'2025-02-09',sourceKind:'x',evidenceKind:'context',stance:null,rule:'x'},
    {evidenceId:'e2',sourceDocumentId:'d2',billId:'b1',membershipId:null,session:'2025-2026',family:'official_bill_summary',availableOn:'2025-02-10',sourceKind:'x',evidenceKind:'context',stance:null,rule:'x'},
  ] as any;
  const yes=buildLifecycleExternalSelectionRows({snapshots:[snapshot(true)],accepted,p5Model});
  assert.equal(yes[0].authorshipReconstructable,1);
  assert.equal(yes[0].authorDistrictContext,1);
  assert.equal(yes[0].officialBillSummary,0);
  const no=buildLifecycleExternalSelectionRows({snapshots:[snapshot(false)],accepted,p5Model});
  assert.equal(no[0].authorshipReconstructable,0);
  assert.equal(no[0].authorDistrictContext,0);
});
