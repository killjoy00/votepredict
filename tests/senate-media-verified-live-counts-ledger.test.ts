/**
 * #912: internal arithmetic and evidence-scope guard for a VERIFIED live
 * sanitized GitHub Actions / Neon SQL count report. This test NEVER connects
 * to Neon, and MUST NOT be cited as independent production verification.
 * The actual source is protected run #38093691235.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const data=JSON.parse(readFileSync(
  'docs/evaluation/senate-media-verified-live-neon-capture-year-counts.json','utf8',
)) as {
  version:string;
  source:{
    workflowRunId:number; workflowRunUrl:string;
    exactSourceRevision:string; lastSuccessfulStage:string;
  };
  scope:Record<string,unknown>;
  studyCaptureYears:Record<string,{
    contextRows:number;distinctSourceDocumentsWithinYear:number;
  }>;
  totals:{
    study2021To2025ContextRows:number;
    study2021To2025DistinctDocsSummedByYear:number;
    outsideStudyYearsContextRows:number;
    allCaptureYearsContextRows:number;
    distinctDocsSummedAcrossAllCaptureYears:number;
  };
  allowedUse:string;
};

test('actual read-only Neon media aggregate ledger is pinned to the source run, not a synthetic fixture',()=>{
  assert.equal(data.version,'senate-media-verified-neon-live-aggregate-2021-25-v1');
  assert.equal(data.source.workflowRunId,38093691235);
  assert.equal(data.source.workflowRunUrl,
    'https://github.com/killjoy00/votepredict/actions/runs/38093691235');
  assert.equal(data.source.exactSourceRevision,
    '71bb9000389b49019d5c71b05209f5a111277098');
  assert.equal(data.source.lastSuccessfulStage,'sql_transaction_rolled_back');
});

test('live 2021-2025 capture-year arithmetic reconciles with all 948 context rows',()=>{
  assert.deepEqual(Object.keys(data.studyCaptureYears),['2021','2022','2023','2024','2025']);
  assert.deepEqual(Object.entries(data.studyCaptureYears).map(([year,r])=>[
    year,r.contextRows,r.distinctSourceDocumentsWithinYear,
  ]),[
    ['2021',131,122],['2022',182,163],['2023',155,132],
    ['2024',118,103],['2025',208,168],
  ]);
  const sum=(field:'contextRows'|'distinctSourceDocumentsWithinYear')=>
    Object.values(data.studyCaptureYears).reduce((n,v)=>n+v[field],0);
  assert.equal(sum('contextRows'),794);
  assert.equal(sum('distinctSourceDocumentsWithinYear'),688);
  assert.equal(data.totals.study2021To2025ContextRows,sum('contextRows'));
  assert.equal(data.totals.study2021To2025DistinctDocsSummedByYear,
    sum('distinctSourceDocumentsWithinYear'));
  assert.equal(data.totals.outsideStudyYearsContextRows,154);
  assert.equal(data.totals.allCaptureYearsContextRows,948);
  assert.equal(sum('contextRows')+data.totals.outsideStudyYearsContextRows,
    data.totals.allCaptureYearsContextRows);
  assert.equal(data.totals.distinctDocsSummedAcrossAllCaptureYears,805);
  assert.ok(data.totals.distinctDocsSummedAcrossAllCaptureYears>=688);
  assert.ok(data.totals.distinctDocsSummedAcrossAllCaptureYears<=948);
});

test('stored live count scope refuses statewide completeness, global source uniqueness and quotes',()=>{
  const s=data.scope;
  assert.equal(s.projectIdentityVerified,true);
  assert.equal(s.existingNeonDefaultBranchVerified,true);
  assert.equal(s.deployedProductionBindingIndependentlyVerified,false);
  assert.equal(s.requiredSixEvidenceAndRosterTablesReadable,true);
  assert.equal(s.sqlTransactionReadOnlyVerified,true);
  assert.equal(s.globallyStrictSelectOnlyRole,false);
  assert.equal(s.postgresTransactionRolledBack,true);
  assert.equal(s.productionRowsModified,false);
  assert.equal(s.privateSourceRowsOrArticleBodiesExported,false);
  assert.equal(s.firstPublicByProvenForEverySource,false);
  assert.equal(s.missingnessDenominatorKnown,false);
  assert.equal(s.statewideMediaPublicationUniverseKnown,false);
  assert.equal(s.verifiedHumanSenatorQuotesFromThisQuery,0);
  assert.equal(s.actualExistingNamedSenatorQuotesUnknown,true);
  assert.equal(s.crossYearSourceDocumentDeduplicationPerformed,false);
  assert.equal(s.sourceKind,'wayback_local_trade_news');
  assert.equal(s.metadataContextType,'local_trade_news');
  assert.ok(data.allowedUse.includes('not a quotation count'));
  assert.doesNotMatch(JSON.stringify(data),/sourceDocumentId|rawBodyBase64|NEON_API_KEY|databasePassword/);
});
