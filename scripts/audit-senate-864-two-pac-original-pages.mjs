/** Single bounded inspection of the two existing clean-comparator cases. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {main as existingSourceAudit} from './audit-cfb-pac116-original-a1-geometry-readonly.mjs';
import {selectTwoComparatorCompleteOriginalPages,inspectPrintedOriginalCells} from '../src/evidence/senate-864-pac-two-original-pages.mjs';
export const MARKER='SENATE864_TWO_PAC_EXACT_ORIGINAL_PAGE_GATES_20261019_V1';
async function main(){
 let phase='new_reviewed_main_scope';
 try{
  const e=process.env,event=JSON.parse(readFileSync(e.GITHUB_EVENT_PATH||'','utf8'));
  if(process.argv.length!==2||e.GITHUB_REPOSITORY!=='killjoy00/votepredict'||e.GITHUB_EVENT_NAME!=='push'||e.GITHUB_REF!=='refs/heads/main'||
   e.GITHUB_RUN_ATTEMPT!=='1'||e.SENATE864_INDEPENDENT_MAIN!=='true'||event.after!==e.GITHUB_SHA||event.head_commit?.id!==e.GITHUB_SHA||
   event.forced||event.deleted||event.repository?.full_name!=='killjoy00/votepredict'||!event.head_commit.message.includes(MARKER))throw Error('Protected scope gate');
  let receipt;
  phase='existing_unchanged_source_candidates_and_full_comparators';
  await existingSourceAudit({inspectTwoOriginalPages:async({client,cohort,allRows,reports,positionedOutcomes,registeredNames})=>{
   const tx=(await client.query("SELECT current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation")).rows[0];
   if(tx.ro!=='on'||tx.isolation!=='repeatable read')throw Error('Verified repeatable-read read-only transaction required');
   const cases=selectTwoComparatorCompleteOriginalPages(cohort,allRows,positionedOutcomes);
   phase='exact_two_whole_body_hashes_and_original_pages';
   const inspections=[],uniqueBodies=new Set(),uniquePages=new Set();let relatedVersions=0,missingReceived=0,publicBy=0,independentBulkRows=0;
   for(const c of cases){
    const report=reports.find(r=>r.reportVersionId===c.hit.reportVersionId);
    if(!report)throw Error('Exact selected report missing');
    uniqueBodies.add(report.pdfSha);uniquePages.add(report.pdfSha+'|'+c.hit.pageNumber);
    const stored=(await client.query('SELECT original_pdf,byte_length FROM cfb_finance_pdf_body_captures WHERE pdf_sha256=$1 AND byte_length BETWEEN 501 AND 30000000 LIMIT 2',[report.pdfSha])).rows;
    if(stored.length!==1||stored[0].original_pdf.length!==Number(report.pdfBytes)||
     createHash('sha256').update(stored[0].original_pdf).digest('hex')!==report.pdfSha)throw Error('Original body hash changed');
    const task=getDocument({data:new Uint8Array(stored[0].original_pdf),verbosity:0,disableFontFace:true,useSystemFonts:false});
    let pdf;
    try{
     pdf=await task.promise;
     if(c.hit.pageNumber<1||c.hit.pageNumber>pdf.numPages)throw Error('Selected original page missing');
     const page=await pdf.getPage(c.hit.pageNumber),first=await pdf.getPage(1);
     const words=await page.getTextContent({disableCombineTextItems:true});
     const firstWords=await first.getTextContent({disableCombineTextItems:true});
     const operators=await page.getOperatorList();
     const inspection=inspectPrintedOriginalCells({items:words.items,operators,row:c.row,registeredName:registeredNames.get(c.row.contributorReg),
      firstPageText:firstWords.items.map(x=>x.str||'').join(' '),report});
     inspections.push(inspection);page.cleanup();first.cleanup();
    }finally{if(pdf)await pdf.destroy();else await task.destroy();}
    // Report chronology is independent of transaction row containment. Current
    // receipt dates and original/amended viewer keys do not prove public-by.
    const versions=(await client.query(`SELECT board_received_on,historical_exact_version_public_by_proven
     FROM cfb_official_senate_pdf_versions WHERE committee_registration=$1 AND report_year=$2 LIMIT 831`,[c.row.filerReg,c.row.year])).rows;
    if(versions.length>=831)throw Error('Unbounded version chronology');
    relatedVersions+=versions.length;missingReceived+=versions.filter(v=>!v.board_received_on).length;
    publicBy+=versions.filter(v=>v.historical_exact_version_public_by_proven===true).length;
    const archive=(await client.query(`SELECT count(*)::int AS n FROM cfb_finance_bulk_archive_row_observations
     WHERE committee_registration=$1 AND transaction_year=$2 AND canonical_row_key=$3
     AND independently_observed_at<TIMESTAMPTZ '2026-01-01T00:00:00Z'`,[c.row.filerReg,c.row.year,c.row.rowKey])).rows[0];
    independentBulkRows+=archive.n;
   }
   receipt={version:'senate864-two-pac-source-gates-v1',selectedComparatorCompleteCases:2,originalBodyRehashOperations:2,sourceCasePageInspections:2,uniqueOriginalPdfBodies:uniqueBodies.size,uniqueOriginalPages:uniquePages.size,
    printedReportIdentityVerified:inspections.filter(x=>x.printedReportIdentityFieldsVerified).length,
    fourLiteralFieldsOnOriginalPage:inspections.filter(x=>x.allFourLiteralFieldsPresent).length,
    labelledPhysicalRowContainmentCertified:inspections.filter(x=>x.labelledSinglePrintedRowContained).length,
    physicalRowBoundaryHolds:inspections.filter(x=>!x.labelledSinglePrintedRowContained).length,
    relatedOriginalAmendedVersionObservations:relatedVersions,relatedVersionsWithoutReceivedDate:missingReceived,
    authenticatedHistoricalVersionPublicByProofs:publicBy,independentHistoricalBulkRowObservations:independentBulkRows,
    sourceContainmentAndHistoricalPublicationAreSeparate:true,noCandidatesPromoted:true,noComparatorRelaxation:true,
    noEnvelopeThresholdChanges:true,noMoreRecoveryWithoutNewSourceEvidence:true,
    physicalInspectionDisposition:inspections.map(x=>({printedIdentity:x.printedReportIdentityFieldsVerified,
     horizontalSourceRules:x.actualSourceHorizontalRules,verticalSourceRules:x.actualSourceVerticalRules,
     allFourFields:x.allFourLiteralFieldsPresent,physicalRow:x.labelledSinglePrintedRowContained,hold:x.hold})),
    historicalPublicationDisposition:publicBy===0?'HOLD_exact_original_amended_version_independently_dated_public_observation_required':'REVIEW_proof_scope_before_any_use'};
  }});
  // existingSourceAudit returns only after its explicit ROLLBACK.
  if(!receipt)throw Error('No exact original page result');
  console.log('SENATE864_TWO_PAC_ORIGINAL_PAGE_RECEIPT='+JSON.stringify({...receipt,verifiedReadOnlyRepeatableRead:true,explicitRollback:true}));
 }catch{console.error('SENATE864_TWO_PAC_HOLD_AT='+phase);process.exitCode=1}
}
if(process.argv[1]?.endsWith('/audit-senate-864-two-pac-original-pages.mjs'))void main();
