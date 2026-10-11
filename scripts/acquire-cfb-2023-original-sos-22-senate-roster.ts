/**
 * #864 finance source-only: retrieve original SOS 2023-24 Legislature pocket
 * manual and independently cross-check all 22 previously 2022-serving
 * senators listed against the *2023* Senate roster, via original PDF.
 * No source PDF bytes, entire text, personal phone or office numbers saved.
 *
 * node --import tsx scripts/acquire-cfb-2023-original-sos-22-senate-roster.ts
 * --output artifacts/cfb-2023-original-sos-22-senate-roster.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {
 SOS_2023_SENATE_ROSTER_SOURCE_VERSION,SOS_2023_SENATE_ROSTER_PDF,
 inspectOriginal2023SosSenateRoster,
} from '../src/evidence/cfb-2023-official-sos-senate-roster-service.js';
const SOURCE='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
function errcode(e:unknown):string{
 const t=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(t)?'original_sos_source_timeout'
  :/HTTP [45]\d\d/i.test(t)?'original_sos_source_http_failure'
  :/Senate roster|Senate member|Senate section/i.test(t)?'original_sos_senate_roster_not_authenticated'
  :'original_sos_pdf_extraction_or_panel_integrity_failed';
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])
   throw Error('Only --output artifacts/<new>.json permitted');
 const output=resolve(a[1]);
 if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
   throw Error('Only new artifacts metadata JSON permitted');
 const ref=readFileSync(SOURCE,'utf8');
 const original=await fetch(SOS_2023_SENATE_ROSTER_PDF,{
   headers:{'user-agent':'Mozilla/5.0 VotePredict source-only 2023 MN legislative roster research',
     accept:'application/pdf'},
   redirect:'follow',signal:AbortSignal.timeout(65_000)});
 if(!original.ok)throw Error('Original MN Secretary of State PDF HTTP '+original.status);
 const final=new URL(original.url);
 if(final.protocol!=='https:'||final.hostname!=='www.sos.mn.gov')
   throw Error('Official SOS PDF redirected outside Secretary of State');
 const bytes=new Uint8Array(await original.arrayBuffer());
 const count=bytes.byteLength;
 if(count<15000||count>25_000_000
   ||new TextDecoder('ascii').decode(bytes.subarray(0,5))!=='%PDF-')
   throw Error('2023 original SOS pocket edition must be a valid bounded original PDF');
 const pdfSha=createHash('sha256').update(bytes).digest('hex');
 const {PDFParse}=await import('pdf-parse');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const parser=new PDFParse({data:bytes,CanvasFactory});
 let text:string;
 try{text=(await parser.getText()).text??'';}
 finally{await parser.destroy();}
 if(text.length<10000)throw Error('Original SOS pocket manual extracted insufficient text');
 const audit=inspectOriginal2023SosSenateRoster({
  source71Psv:ref,originalSosExtractedPdfText:text});
 const outputObj={
  schemaVersion:SOS_2023_SENATE_ROSTER_SOURCE_VERSION,
  issue:864,observedAt:new Date().toISOString(),
  originalOfficialDocument:{url:SOS_2023_SENATE_ROSTER_PDF,
    originalPdfSha256:pdfSha,originalPdfBytes:count,
    originalGovHostValidated:true,sourceKind:'original_state_SOS_2023_legislative_manual_pocket_edition'},
  sourcePanel:{path:SOURCE,gitBlobSha:'bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388',
    earlierIndependentlyActualServingIn2022:22},
  sourceRosterStructure:{originalSenateRosterSectionLocated:audit.exactOriginalSenateRosterSectionLocated,
    originalSenateMemberLines:audit.rosterMemberLineCount,
    distinctPreviouslyKnown22Actually2022ServingSenators:audit.previouslyVerified2022ActualServingSenators,
    independentlyMatched2023RosterMembers:audit.independentlyMatched2023RosterMembers,
    mismatches:audit.unmatched.map(x=>({reg:x.reg,name:x.name,district:x.district,matchingRows:x.exactSourceMatches}))},
  committeeRosterMatches:audit.matches.map(x=>({
     registrationNumber:x.reg,previouslyVerifiedActual2022Senator:x.name,
     district2022:x.district,originalSOS2023RosterName:x.sourcePrintedRosterName,
     originalSOS2023SenateDistrict:x.sourceRosterDistrict,
     source2023MembershipVerified:x.independentlyMatchedIn2023SenateRoster,
     originalSOSPdfSha256:pdfSha,
     actualMembershipOnAnyArbitrary2023VoteDate:null,
     actual2024SenateMembership:null,
     historicallyActiveCFBCommitteeRegistration:null,
     legallyOwedYE2023Or2024:null,
     originalCfbFinanceReportHistoricallyPublicBy:null,
   })),
  limitations:{original2023RosterSourceNot2024AtDateProof:true,
    actualSenateServiceOnSpecificVoteDateStillUnknown:true,
    legallyRequiredCommitteeFilingDenominator:null,
    reportActualPublicByNotEstablished:true,
    noForecastOrProductionEligibility:true},
  safeguards:{originalPdfOrFullExtractedTextPersisted:false,
    memberOfficesOrPhoneNumbersPersisted:false,
    donorNamesAndFinancialRowsPersisted:false,
    noProductionDatabaseReadWrite:true,
    noModelsForecastServingSchedulerOr2027Updates:true,issue864MustRemainOpen:true},
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(outputObj,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,document:'original MN SOS 2023 Senate pocket manual',
   sha256:pdfSha,bytes:count,
   membersExpected:22,sourceMatches:audit.independentlyMatched2023RosterMembers,
   printedRosterRows:audit.rosterMemberLineCount,
   unmatched:audit.unmatched.map(x=>({name:x.name,district:x.district})),
   output,productionWrites:0},null,2));
 if(audit.independentlyMatched2023RosterMembers!==22)process.exitCode=1;
}
main().catch(e=>{console.error(errcode(e));process.exitCode=1;});
