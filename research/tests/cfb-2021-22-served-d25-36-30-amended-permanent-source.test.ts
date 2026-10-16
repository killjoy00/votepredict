import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn}
  from '../../src/evidence/cfb-report-availability.js';
import {cfbReportViewerUrl}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  selectServedSd25to36AmendmentVersions,
  amendmentViewerReference,
  REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS,
} from '../../src/evidence/cfb-2021-22-served-sd25-36-30-amendments.js';

const BASE='docs/evaluation/source-proof/';
const CKPT=JSON.parse(readFileSync(BASE+
  'cfb-2021-22-served-d25-36-30-amended-source-checkpoint.json','utf8'));
const PSV=readFileSync(BASE+'cfb-2021-22-served-d25-36-30-amended-report-pdfs.psv','utf8');
const hash=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');
const FIELDS=[
  'id','actualSenator','electionDistrict2022','originalReportPrintedSenateDistrict',
  'amendedPdfPrintedSenateDistrict','originalReportId','originalReportSha256',
  'originalViewerApiSha256','amendedPdfSha256','amendedPdfByteLength',
  'amendedPdfAcquiredAt','amendedCoverageStartOn','amendedCoverageEndOn',
  'amendedBoardReceivedOn','originalReportStatutoryDueOn',
  'conservativeAmendedVersionNotBeforeOn','referenceClassification',
  'aliasOfAmendmentVersionId',
];
const rows=PSV.trimEnd().split('\n').map(line=>{
  const values=line.split('|');
  assert.equal(values.length,FIELDS.length,'Exact metadata-only source columns');
  return Object.fromEntries(FIELDS.map((name,i)=>[name,values[i]!])) as Record<string,string>;
});
const targetInput=()=>({
  originalCePsv:readFileSync(BASE+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  originalYePsv:readFileSync(BASE+'cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv','utf8'),
  originalViewerPsv:readFileSync(BASE+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8'),
  ceCheckpoint:JSON.parse(readFileSync(BASE+'cfb-2022-served-d25-36-original-ce-source-checkpoint.json','utf8')),
  yeCheckpoint:JSON.parse(readFileSync(BASE+'cfb-2021-22-served-d25-36-18-original-yearend-source-checkpoint.json','utf8')),
});
const selected=selectServedSd25to36AmendmentVersions(targetInput());

test('permanent ledger is byte-for-byte SHA-pinned to second independent CFB acquisition; 30 exact rows/29 binary fingerprints',()=>{
  assert.equal(CKPT.schemaVersion,'mn-cfb-2021-22-served-sd25-36-30-amended-pdf-permanent-source-v1');
  assert.deepEqual(CKPT.permanentSourceLedger.columns,FIELDS);
  assert.equal(PSV.endsWith('\n'),true);
  assert.equal(Buffer.byteLength(PSV,'utf8'),11489);
  assert.equal(CKPT.permanentSourceLedger.utf8Bytes,11489);
  assert.equal(hash(PSV),'5de332aed85aa00c0e4b5ad943ce13a31f586d7333671d519aa91ad0a0341723');
  assert.equal(CKPT.permanentSourceLedger.sha256,hash(PSV));
  assert.equal(rows.length,30);
  assert.equal(new Set(rows.map(r=>r.id)).size,30);
  assert.equal(new Set(rows.map(r=>r.amendedPdfSha256)).size,29);
  assert.equal(new Set(rows.map(r=>r.originalReportId)).size,19);
  assert.equal(new Set(rows.map(r=>r.actualSenator)).size,10);
  assert.equal(selected.targets.length,30);
  assert.equal(selected.originals.length,40);
  assert.equal(CKPT.population.actualSenateServingPeopleInSourceCohort,11);
  assert.equal(CKPT.population.independentlyAuthenticatedAmendmentSourceHeaders,30);
  assert.equal(CKPT.population.independentlyAuthenticatedDistinctAmendedPdfBinaries,29);
  assert.equal(CKPT.population.officialViewerReferencesAliasingAnIdenticalEarlierPdf,1);
  assert.equal(CKPT.population.sourcePdfIdentityHolds,0);
  assert.equal(CKPT.population.sourceFetchFailures,0);
});
test('all 30 original reference identities, official original parents, periods, districts, financial due dates and CFB API SHA are source pinned',()=>{
  const targets=new Map(selected.targets.map(t=>[t.id,t]));
  const counts:Record<string,number>={};
  for(const r of rows){
    const t=targets.get(r.id);
    assert.ok(t,'Original CFB source viewer must contain the exact version id: '+r.id);
    assert.equal(r.id,t.id);
    assert.equal(r.actualSenator,t.actualSenator);
    assert.equal(r.originalReportId,t.originalId);
    assert.equal(r.originalReportSha256,t.original.pdfSha256);
    assert.equal(r.originalViewerApiSha256,t.originalReportsViewerBodySha256);
    assert.equal(Number(r.electionDistrict2022),t.original.electionDistrict);
    assert.equal(Number(r.originalReportPrintedSenateDistrict),t.original.printedOriginalDistrict);
    assert.ok([t.original.electionDistrict,t.original.printedOriginalDistrict]
      .includes(Number(r.amendedPdfPrintedSenateDistrict)));
    assert.match(r.amendedPdfSha256,/^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(Number(r.amendedPdfByteLength))
      &&Number(r.amendedPdfByteLength)>=300);
    assert.notEqual(r.amendedPdfSha256,t.original.pdfSha256);
    assert.equal(r.amendedCoverageStartOn,t.original.coveredFrom);
    assert.equal(r.amendedCoverageEndOn,t.original.coveredThrough);
    assert.equal(r.originalReportStatutoryDueOn,t.original.dueOn);
    assert.ok(r.amendedBoardReceivedOn>=t.original.receivedOn);
    assert.equal(r.conservativeAmendedVersionNotBeforeOn,
      cfbElectronicReportAvailableOn(r.amendedBoardReceivedOn,t.original.dueOn));
    assert.match(r.amendedPdfAcquiredAt,/^2026-10-11T\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(r.amendedPdfAcquiredAt<=CKPT.sourceAcquisition.independentlyAcquiredAt);
    assert.match(cfbReportViewerUrl(amendmentViewerReference(t)),
      /^https:\/\/cfb\.mn\.gov\/rptViewer\/Main\.php\?/);
    const period=String(t.year)+':'+t.period;
    counts[period]=(counts[period]??0)+1;
  }
  assert.deepEqual(counts,{'2021:YE':3,'2022:YE':13,'2022:C':7,'2022:E':7});
  assert.equal(CKPT.population.distinctAuthenticatedOriginalParentsUsedByTheseReferences,19);
  assert.equal(CKPT.population.completeConsecutiveChronologicalOfficialViewerReferenceChains,true);
  const groups=new Map<string,typeof rows>();
  for(const r of rows)groups.set(r.originalReportId,
    [...(groups.get(r.originalReportId)??[]),r]);
  for(const group of groups.values()){
    group.sort((a,b)=>Number(a.id.split(':')[5])-Number(b.id.split(':')[5]));
    for(let i=0;i<group.length;i++){
      assert.equal(Number(group[i]!.id.split(':')[5]),i+1);
      if(i>0)assert.ok(group[i]!.amendedBoardReceivedOn>=group[i-1]!.amendedBoardReceivedOn);
    }
  }
});
test('Hoffman YE first and second official version references retain one and the same original 686801-byte PDF; later amendment #3 distinct',()=>{
  const pin=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const two=rows.filter(r=>r.amendedPdfSha256===pin.binarySha256);
  assert.equal(two.length,2);
  assert.deepEqual(two.map(r=>r.id).sort(),
    [pin.canonicalReferenceId,pin.aliasedReferenceId].sort());
  const earlier=rows.find(r=>r.id===pin.canonicalReferenceId)!;
  const alias=rows.find(r=>r.id===pin.aliasedReferenceId)!;
  const after=rows.find(r=>r.id==='17319:22:pcc:YE:0:3')!;
  assert.equal(earlier.originalReportId,pin.originalReportId);
  assert.equal(alias.originalReportId,pin.originalReportId);
  assert.equal(earlier.originalReportSha256,pin.originalReportSha256);
  assert.equal(alias.originalReportSha256,pin.originalReportSha256);
  assert.equal(Number(earlier.amendedPdfByteLength),pin.byteLength);
  assert.equal(Number(alias.amendedPdfByteLength),pin.byteLength);
  assert.equal(earlier.amendedBoardReceivedOn,pin.boardReceivedOn);
  assert.equal(alias.amendedBoardReceivedOn,pin.boardReceivedOn);
  assert.equal(earlier.referenceClassification,'distinct_authenticated_amended_pdf');
  assert.equal(earlier.aliasOfAmendmentVersionId,'');
  assert.equal(alias.referenceClassification,
    'official_amendment_version_reference_alias_of_identical_pdf');
  assert.equal(alias.aliasOfAmendmentVersionId,earlier.id);
  assert.notEqual(after.amendedPdfSha256,earlier.amendedPdfSha256);
  assert.equal(after.amendedBoardReceivedOn,'2023-07-21');
  assert.equal(CKPT.documentedBinaryAlias.pdfSha256,pin.binarySha256);
  assert.equal(CKPT.documentedBinaryAlias.pdfBytes,pin.byteLength);
  assert.equal(CKPT.documentedBinaryAlias.firstOfficialViewerVersionId,earlier.id);
  assert.equal(CKPT.documentedBinaryAlias.secondOfficialViewerVersionId,alias.id);
  assert.equal(CKPT.documentedBinaryAlias.actualCauseOfOfficialDuplicateUnproven,true);
  assert.equal(CKPT.population.completeDistinctBinaryRevisionChains,false);
});
test('no other duplicate, held identity, missing official viewer reference, or ambiguous historical eligibility is admitted',()=>{
  const normal=rows.filter(r=>r.referenceClassification==='distinct_authenticated_amended_pdf');
  const aliases=rows.filter(r=>r.referenceClassification!=='distinct_authenticated_amended_pdf');
  assert.equal(normal.length,29);
  assert.equal(aliases.length,1);
  assert.ok(normal.every(r=>r.aliasOfAmendmentVersionId===''));
  assert.ok(rows.every(r=>r.referenceClassification==='distinct_authenticated_amended_pdf'
    ||r.referenceClassification==='official_amendment_version_reference_alias_of_identical_pdf'));
  assert.equal(CKPT.population.historicalPublicByDateIndependentlyProvenForAnyAmendment,false);
  assert.equal(CKPT.population.statewideLegallyOwedReportDenominator,null);
  assert.equal(CKPT.safeguards.noAssumedHistoricalActualPublicBy,true);
  assert.equal(CKPT.safeguards.noRetrospectivePredictionEligibilityGranted,true);
  assert.equal(CKPT.safeguards.noProductionDatabaseReadOrWrite,true);
  assert.equal(CKPT.safeguards.noOriginalPdfBodiesStored,true);
  assert.equal(CKPT.safeguards.noPdfExtractedTextStored,true);
  assert.equal(CKPT.safeguards.noDonorPersonalOrTransactionDetailsStored,true);
  assert.equal(CKPT.safeguards.noNeverServedCandidateInformationStored,true);
  assert.equal(CKPT.safeguards.issue864RemainsOpen,true);
});
test('two independently retrieved official source artifacts, their raw ZIP/JSON hashes and exact-head CI are permanently pinned',()=>{
  const a=CKPT.sourceAcquisition,b=CKPT.priorIndependentObservation;
  assert.equal(a.mergedPr,1056);
  assert.equal(a.exactHead,'228fb39a2c2903e4bfdea098df0061167f93631c');
  assert.equal(a.mergeCommit,'ee97f4ab1e752690f3e2ac49a404bd02b0e3a670');
  assert.equal(a.fullCiRunId,38148567249);
  assert.equal(a.fullCiConclusion,'success');
  assert.equal(a.originalSourceRunId,38148567237);
  assert.equal(a.originalSourceConclusion,'success');
  assert.equal(a.artifactId,11706065910);
  assert.equal(a.zipBytes,9326);
  assert.equal(a.zipSha256,'c31042ae6abddcbd348250811e149b625f6e8c5e5e3d155e9b524383c12b56f4');
  assert.equal(a.sourceJsonBytes,99534);
  assert.equal(a.sourceJsonSha256,'bbf033118d0ae5ca14d76eeddaa39af827264a4c552e093cdfa70e793683c75e');
  assert.equal(b.originalSourceRunId,38147337575);
  assert.equal(b.workflowConclusion,'failure');
  assert.equal(b.zipBytes,8935);
  assert.equal(b.zipSha256,'06d167bbcd31a628a798405ac944a2938278ae93fe9344924b32d0c1908f58ff');
  assert.equal(b.sourceJsonBytes,93902);
  assert.equal(b.sourceJsonSha256,'d3d952465404db511ea93657d421bc0c83c705ff149d5c1ee9d9812b7c01d8c9');
  assert.equal(b.unchangedReportIdPdfHashByteCountOriginalParentBoardReceiptAndCoverageAcrossRuns,30);
  assert.equal(b.sourceFingerprintDiscrepancies,0);
  assert.equal(b.duplicateReferenceAliasReproduced,true);
  assert.equal(CKPT.originalSourceAnchors.independentlyObservedOfficialLRLSenateServiceSha256,
    '09e9adeb2c014853ec822cb63b88b1a0d550911c62cb16c7a95cea59647590b1');
  assert.equal(CKPT.originalSourceAnchors.independentlyObserved2022SosSenateResultsSha256,
    'eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74');
  assert.equal(CKPT.originalSourceAnchors.independentlyObserved2022CfbCalendarPdfSha256,
    '3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25');
});
