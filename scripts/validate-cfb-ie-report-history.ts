import {
  acquireCfbPcfHistoricalReportProofs,
  cfbPcfSegmentEndYear,
} from '../src/evidence/cfb-pcf-report-history.js';
import { firstProvenCfbFinanceAvailability } from '../src/evidence/cfb-report-finance-mapper.js';
import { CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS } from '../src/evidence/cfb-ie-historical-targets.js';
import {
  parseCfbIndependentExpenditureCsv,
} from '../src/evidence/cfb-independent-expenditure-history.js';
import {
  discoverCampaignFinanceDownloadUrls,
  fetchCampaignFinanceBulkText,
} from '../src/evidence/campaign-finance-live.js';

const TARGET_REGISTRATIONS=CFB_IE_HISTORICAL_PROOF_TARGET_REGISTRATIONS;

async function main(){
  const urls=await discoverCampaignFinanceDownloadUrls();
  const text=await fetchCampaignFinanceBulkText(urls.independentExpenditures);
  const rows=parseCfbIndependentExpenditureCsv(text,{fromYear:2021,toYear:2026});
  const targets=[];

  for(const registrationNumber of TARGET_REGISTRATIONS){
    const targetRows=rows.filter(row=>row.spenderRegistrationNumber?.trim()===registrationNumber);
    const segmentYears=[...new Set(targetRows
      .map(row=>cfbPcfSegmentEndYear(row.year))
      .filter((value):value is 2022|2024|2026=>value!==null))]
      .sort((a,b)=>a-b);

    for(const segmentEndYear of segmentYears){
      const segmentRows=targetRows.filter(row=>cfbPcfSegmentEndYear(row.year)===segmentEndYear);
      try{
        const acquired=await acquireCfbPcfHistoricalReportProofs({
          registrationNumber,
          segmentEndYear,
          maxReports:24,
        });
        const reports=acquired.reports.map(report=>({proof:report.proof,text:report.text}));
        let matched=0;
        for(const row of segmentRows){
          const match=firstProvenCfbFinanceAvailability({
            registrationNumber,
            transactionDate:row.transactionDate,
            kind:'expenditure',
            amount:row.amount,
            totalAmount:row.totalAmount,
            affectedCommitteeName:row.affectedCommitteeName,
            affectedCommitteeRegistrationNumber:row.affectedCommitteeRegistrationNumber,
          },reports);
          if(match)matched+=1;
        }
        targets.push({
          registrationNumber,
          segmentEndYear,
          sourceRows:segmentRows.length,
          referencesDiscovered:acquired.referencesDiscovered,
          selectedReports:acquired.selectedReports,
          proofsParsed:acquired.reports.length,
          proofFailures:acquired.failures.length,
          rowsMatched:matched,
          rowsFailClosed:segmentRows.length-matched,
          failureSamples:acquired.failures.slice(0,8),
        });
      }catch(error){
        targets.push({
          registrationNumber,
          segmentEndYear,
          sourceRows:segmentRows.length,
          referencesDiscovered:0,
          selectedReports:0,
          proofsParsed:0,
          proofFailures:1,
          rowsMatched:0,
          rowsFailClosed:segmentRows.length,
          failureSamples:[{
            reportName:'source-contract',
            error:error instanceof Error?error.message:String(error),
          }],
        });
      }
    }
  }

  console.log(JSON.stringify({
    cfbIeHistoricalReportValidation:{
      targetRegistrations:TARGET_REGISTRATIONS,
      targets,
      totals:{
        sourceRows:targets.reduce((sum,row)=>sum+row.sourceRows,0),
        referencesDiscovered:targets.reduce((sum,row)=>sum+row.referencesDiscovered,0),
        selectedReports:targets.reduce((sum,row)=>sum+row.selectedReports,0),
        proofsParsed:targets.reduce((sum,row)=>sum+row.proofsParsed,0),
        proofFailures:targets.reduce((sum,row)=>sum+row.proofFailures,0),
        rowsMatched:targets.reduce((sum,row)=>sum+row.rowsMatched,0),
        rowsFailClosed:targets.reduce((sum,row)=>sum+row.rowsFailClosed,0),
      },
      policy:{
        readOnly:true,
        databaseWrites:false,
        historicalAvailabilityRequiresOfficialReportProof:true,
        reportMustDemonstrateExactRow:true,
        transactionDateIsAvailability:false,
        sameDayReplayExcluded:true,
        mechanicallyActionable:false,
        modelWeight:0,
        servingChanged:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?(error.stack??error.message):String(error));
  process.exitCode=1;
});
