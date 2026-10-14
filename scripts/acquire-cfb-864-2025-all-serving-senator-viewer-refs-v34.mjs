/**
 * #864 fresh government CFB original 2026-segment candidate viewer audit,
 * 2025 report refs ONLY for the 70 actual-serving 2025 Senate members.
 * Public viewer API source-only and no PDF bodies or transaction data.
 * A reported candidate/source reference is useful regardless of available
 * PDF text; never infer historical 2025 public-by or statutory owed reports.
 */
import{readFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{audit721OfficialCFBSenateReports}from'./audit-cfb-864-721-official-senate-filing-refs-v33.mjs';
import{fetchCfbCandidateHistoricalReportReferenceSnapshot}from'../src/evidence/cfb-candidate-report-history.js';

export const SCHEMA='cfb-864-2025-70-actual-serving-senators-fresh-original-2026-viewer-source-v34';
const HEAD='CFB_864_2025_70_SERVING_SENATOR_LIVE_VIEWER_V34 ';
const VALID=/^[a-f0-9]{64}$/;
const ORIGIN='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const KNOWN='docs/evaluation/source-proof/cfb-2021-25-95-senators-721-indexed-original-and-amended-reports-v33.psv';

export function selectOfficial2025CfbReportIds(candidate,snapshot,alreadyIndexed){
 if(snapshot.registrationNumber!==candidate.registrationNumber||snapshot.segmentEndYear!==2026
  ||snapshot.sourceUrl!==ORIGIN+candidate.registrationNumber+'/2026/'
  ||!VALID.test(snapshot.responseSha256))
  throw Error('Candidate government original viewer 2026 source URL/registration/SHA wrong');
 const all=[],duplicates=[];
 const seen=new Set();
 for(const f of snapshot.references){
  if(f.year!=='25'||f.registrationNumber!==candidate.registrationNumber||f.type!=='pcc')continue;
  if(!/^[A-Za-z0-9_-]{1,15}$/.test(f.period)
   ||!/^[A-Za-z0-9_-]{1,10}$/.test(f.se)
   ||!Number.isSafeInteger(f.amendment)||f.amendment<0||f.amendment>99)
    throw Error('Official CFB 2025 source report index malformed');
  const id=[f.registrationNumber,f.year,f.type,f.period,f.se,f.amendment].join(':');
  if(seen.has(id)){duplicates.push(id);continue}
  seen.add(id);all.push(id);
 }
 all.sort();
 return{person:candidate.name,registrationNumber:candidate.registrationNumber,
  original2026ViewerResponseSHA256:snapshot.responseSha256,
  fetchedAt:snapshot.fetchedAt,viewerUrl:snapshot.sourceUrl,
  exactOfficial2025References:all,additionalUnindexedIds:all.filter(id=>!alreadyIndexed.has(id)),
  alreadyIndexedIn2021to25V33:all.filter(id=>alreadyIndexed.has(id)),
  repeatedVersionIdsInSource:duplicates,
  sourceStatus:'original_2026_cfb_candidate_viewer_acquired'};
}
function userSafeError(error){
 const value=error instanceof Error?error.message:String(error);
 if(/abort|timeout/i.test(value))return'official_viewer_timeout';
 if(/HTTP 429|HTTP 50[234]/i.test(value))return'official_viewer_transient_http';
 if(/HTTP 4\d\d/i.test(value))return'official_viewer_http_4xx';
 if(/redirect|identity|source|malformed|registration|snapshot|PDF|format|parse|JSON|tabcontent/i.test(value))
  return'official_candidate_viewer_structure_or_identity_error';
 return'official_viewer_unclassified_transport_error';
}
export async function acquire70Senate2025ViewerReferences(){
 const proof=audit721OfficialCFBSenateReports();
 if(proof.officialIndexedReportVersions!==721||proof.senatorsWithAtLeastOneSourceIndexedCFBReport!==95)
  throw Error('Earlier full 2021-25 original government CFB archive identity changed');
 const candidate=JSON.parse(readFileSync('data/cfb-senate-official-filings-2021-25-v33.json','utf8'));
 const targets=candidate.senators.filter(x=>x.servedYears.includes(2025))
  .sort((x,y)=>x.registrationNumber.localeCompare(y.registrationNumber));
 if(targets.length!==70||new Set(targets.map(x=>x.registrationNumber)).size!==70)
  throw Error('Original full 2025 official LRL Senate service cohort/committee registration changed');
 const older=new Set(readFileSync(KNOWN,'utf8').trimEnd().split('\n').map(x=>x.split('|')[0]));
 if(older.size!==721)throw Error('Original 721-source official CFB reference set not pinned');
 const results=Array(targets.length);
 let cursor=0;
 async function worker(){
  while(cursor<targets.length){
   const position=cursor++;
   const person=targets[position];
   let record;
   try{
    const snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot(person.registrationNumber,2026);
    record=selectOfficial2025CfbReportIds(person,snapshot,older);
   }catch(e){
    const reason=userSafeError(e);
    // Explicitly retain a request failure as unknown and do not treat it as
    // a person without a registration/report.
    record={person:person.name,registrationNumber:person.registrationNumber,
     viewerUrl:ORIGIN+person.registrationNumber+'/2026/',sourceStatus:reason,
     exactOfficial2025References:null,additionalUnindexedIds:null};
   }
   results[position]=record;
   await new Promise(resolve=>setTimeout(resolve,220));
  }
 }
 await Promise.all([worker(),worker(),worker(),worker()]);
 if(results.some(x=>!x)||new Set(results.map(x=>x.registrationNumber)).size!==70)
  throw Error('Lost actual-serving CFB 2025 principal registration during original source fetch');
 const successes=results.filter(x=>x.sourceStatus==='original_2026_cfb_candidate_viewer_acquired');
 const extra=successes.flatMap(x=>x.additionalUnindexedIds);
 if(new Set(extra).size!==extra.length||extra.some(x=>older.has(x)))
  throw Error('Original CFB government viewer 2025 report source duplicate/mismatch');
 return{schema:SCHEMA,capturedOn:new Date().toISOString(),
  independent2025ActualServingSenators:70,
  sourceGovOriginal2026SegmentCandidateViewersRequested:70,
  successfulGovernmentViewers:successes.length,
  officialViewerFetchAndPayloadHolds:70-successes.length,
  uniqueOfficial2025ReportIdsObserved:successes.reduce((n,x)=>n+x.exactOfficial2025References.length,0),
  previouslyIncluded2025ExactViewerVersions:successes.reduce((n,x)=>n+x.alreadyIndexedIn2021to25V33.length,0),
  additionallyNewGovOfficial2025VersionRefs:extra.length,
  originalFetchedGovViewerReportIdentityOnly:true,
  independentlyPublicBeforeAny2025VoteProven:0,
  govtPdfBodiesFetchedHere:0,
  officialStatutoryReportObligationsDenominator:null,
  noDonorOrVendorOrTransactionData:true,
  noProtectedDbOrPredictionEligibilityOrDeploymentChanges:true,
  results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No user-supplied names or URL overrides');
 const report=await acquire70Senate2025ViewerReferences();
 const line=JSON.stringify(report);
 if(line.length>100000||/%PDF-|donorName|transactionText/.test(line))
  throw Error('Only bounded original government index/SHA metadata permitted in CI');
 console.log(HEAD+line);
}
