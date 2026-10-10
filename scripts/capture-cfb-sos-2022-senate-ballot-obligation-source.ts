/**
 * #864 parallel track 2. One-time official ballot-predicate reconciliation:
 * 2 dated 2022 SOS Senate election results TXT files + 67 official 2022
 * CFB Senate district selection pages. Never claim primary file contains
 * uncontested candidate filings or ballot status proves 10A.20 liability.
 *
 * node --import tsx scripts/capture-cfb-sos-2022-senate-ballot-obligation-source.ts \
 *   --output artifacts/cfb-sos-2022-senate-ballot-obligation-predicate.json
 */
import { createHash } from 'node:crypto';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
  cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage,
} from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  SOS_2022_OFFICIAL_SENATE_FILES, CFB_SOS_2022_SENATE_RECONCILIATION_VERSION,
  cfbSos2022SourceSha256,deriveCfb2022OriginalSegmentRegistrationSet,
  parseSos2022SenateElectionResults,reconcileCfb2022SenateBallotPredicates,
  type CfbSenate2022Candidate,
} from '../src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';

const CHECKPOINT='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
function safeError(e:unknown):string {
  if(!(e instanceof Error))return 'unknown_source_error';
  if(/timeout|abort/i.test(e.message))return 'timeout_or_abort';
  if(/HTTP [45]\d\d/i.test(e.message))return 'source_http_error';
  if(/layout|duplicate|identity|malformed|cohort/i.test(e.message))return 'source_schema_or_identity_mismatch';
  return e.name.slice(0,70)||'other_failure';
}
async function officialText(election:'general'|'primary'){
  const url=SOS_2022_OFFICIAL_SENATE_FILES[election];
  const resp=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 cfb-sos-independent-2022-senate-ballot-predicate'},
    redirect:'follow',signal:AbortSignal.timeout(40_000),
  });
  const final=new URL(resp.url),expected=new URL(url);
  if(!resp.ok||final.protocol!=='https:'||final.hostname!=='electionresultsfiles.sos.mn.gov'
    ||final.pathname!==expected.pathname||final.search!==expected.search)
    throw Error('Official 2022 SOS results source identity or HTTP error');
  const declared=Number(resp.headers.get('content-length'));
  if(declared>150_000)throw Error('SOS official source too large');
  const bytes=new Uint8Array(await resp.arrayBuffer());
  if(bytes.length<500||bytes.length>150_000)throw Error('SOS source returned wrong size');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const rows=parseSos2022SenateElectionResults({election,sourceUrl:url,text});
  return {
    rows,
    provenance:{election,sourceUrl:url,finalUrl:resp.url,
      sha256:cfbSos2022SourceSha256(bytes),bytes:bytes.length,
      officialRowsExcludingWriteIn:rows.length,
      distinctStateSenateDistricts:new Set(rows.map(r=>r.district)).size,
      retrievedAt:new Date().toISOString()},
  };
}
async function officialCfbPage(district:number){
  const sourceUrl=cfbSenateDistrictPageUrl(district,2022);
  const resp=await fetch(sourceUrl,{
    headers:{'user-agent':'VotePredict/2.0 source-only-2022-senate-district-ballot-join'},
    redirect:'follow',signal:AbortSignal.timeout(30_000),
  });
  const final=new URL(resp.url);
  if(!resp.ok || final.hostname!=='register.cfb.mn.gov' ||final.protocol!=='https:'
    ||final.pathname.replace(/\/$/,'')!==new URL(sourceUrl).pathname.replace(/\/$/,''))
    throw Error('Official CFB Senate district 2022 viewer source identity mismatch');
  const declared=Number(resp.headers.get('content-length'));
  if(declared>3_000_000)throw Error('CFB district page too large');
  const bytes=new Uint8Array(await resp.arrayBuffer());
  if(bytes.length<500||bytes.length>3_000_000)throw Error('CFB district page size invalid');
  const html=new TextDecoder('utf-8').decode(bytes);
  const parsed=parseCfbSenateDistrictCandidatePage({
    district,segmentEndYear:2022,
    sourceUrl:final.toString(),
    fetchedAt:new Date().toISOString(),
    htmlSha256:createHash('sha256').update(bytes).digest('hex'),
    html,responseBytes:bytes.length,
  });
  if(!['candidate_labels_observed','no_candidate_labels_visible'].includes(parsed.status))
    throw Error('Official CFB district source parser could not verify Senate scope');
  return {
    district,sourceUrl,sha256:parsed.htmlSha256,bytes:bytes.length,
    retrievedAt:parsed.retrievedAt,status:parsed.status,
    candidates:parsed.candidates.map(c=>({
      district,registrationNumber:c.registrationNumber,
      candidateName:c.candidateDisplayName,
    })) as CfbSenate2022Candidate[],
  };
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Use --output artifacts/<new>.json');
  const out=resolve(args[1]);
  if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
    throw Error('Output restricted to new metadata-only JSON artifact');
  const original=JSON.parse(readFileSync(CHECKPOINT,'utf8'));
  const sourceRegistrations=deriveCfb2022OriginalSegmentRegistrationSet(original);
  const sourceFailures:Array<{source:string;errorKind:string}>=[];
  const [general,primary]=await Promise.all([
    officialText('general').catch(e=>{sourceFailures.push({source:'sos-2022-general',errorKind:safeError(e)});return null;}),
    officialText('primary').catch(e=>{sourceFailures.push({source:'sos-2022-primary',errorKind:safeError(e)});return null;}),
  ]);
  const pages:Array<Awaited<ReturnType<typeof officialCfbPage>>>=new Array(67);
  let next=1;
  async function worker(){
    while(next<=67){
      const district=next++;
      try{pages[district-1]=await officialCfbPage(district);}
      catch(e){sourceFailures.push({source:'cfb-2022-senate-district-'+district,errorKind:safeError(e)});}
      await new Promise(done=>setTimeout(done,100));
    }
  }
  await Promise.all([worker(),worker()]);
  let audit:ReturnType<typeof reconcileCfb2022SenateBallotPredicates>|null=null;
  let auditError:string|null=null;
  const validPages=pages.filter((p):p is Awaited<ReturnType<typeof officialCfbPage>>=>Boolean(p));
  if(general && primary && validPages.length===67 && sourceFailures.length===0){
    try{
      const roster=validPages.flatMap(p=>p.candidates);
      audit=reconcileCfb2022SenateBallotPredicates({
        cfbCandidates:roster,sourcePinnedOriginal2022Registrations:sourceRegistrations,
        sosPrimary:primary.rows,sosGeneral:general.rows,
      });
    }catch(e){auditError=safeError(e);}
  }
  const result={
    schemaVersion:CFB_SOS_2022_SENATE_RECONCILIATION_VERSION,
    capturedAt:new Date().toISOString(),
    original494RegistrationSourceCheckpoint:CHECKPOINT,
    original2022SegmentRegistrationCount:sourceRegistrations.size,
    publicSourceObservations:{
      sosGeneral:general?.provenance??null,
      sosContestedPrimary:primary?.provenance??null,
      cfbDistricts:validPages.sort((a,b)=>a.district-b.district).map(p=>({
        district:p.district,sourceUrl:p.sourceUrl,sourceHtmlSha256:p.sha256,
        sourceHtmlBytes:p.bytes,sourceRetrievedAt:p.retrievedAt,
        sourceStatus:p.status,distinctCandidateRegistrationsObserved:p.candidates.length,
      })),
      cfbDistrictsAttempted:67,cfbDistrictsVerified:validPages.length,
      cfbCandidateRegistrationsObserved:validPages.flatMap(p=>p.candidates).length,
      sourceFailures:sourceFailures.sort((a,b)=>a.source.localeCompare(b.source)),
      auditError,
    },
    ballotReconciliation:audit,
    safeguards:{
      originalSOSResultsTextStored:false,
      originalCfbHtmlStored:false,
      rawDonorOrTransactionDataStored:false,
      publicCandidateDisplayNamesOnly:true,
      sosElectionResultOrBallotInfoMayNotBeUsedInHistoricalForecastInputs:true,
      noProductionNeonOrVercelAccess:true,
      noModelsOrServingChanges:true,
      noSchedulerOr2027Changes:true,
      issue864RemainsOpen:true,
    },
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({
    version:result.schemaVersion,
    sosGeneralCandidates:general?.rows.length??null,
    sosPrimaryContestedCandidateRows:primary?.rows.length??null,
    officialCfbDistrictPagesVerified:validPages.length,
    2022SenateCfbRegisteredViewerIds:result.original2022SegmentRegistrationCount,
    generalCandidateDistrictAndNameMatches: audit?.sourceCounts.generalBallotCandidateNameDistrictMatchesToCfb2022Viewer??null,
    primaryContestedCandidateMatches:audit?.sourceCounts.contestedPrimaryNameDistrictMatchesToCfb2022Viewer??null,
    sosGeneralNamesWithoutCfbMatch:audit?.sourceCounts.sosGeneralCandidateRecordsWithoutSafeCfbMatch??null,
    sourceFailures:sourceFailures.length,auditError,
    Senate2022LegallyRequiredReports:null,
    historic2022CommitteeYearDenominator:null,
    productionMutation:false,
    output:out,
  },null,2));
  if(!audit || auditError || sourceFailures.length>0)process.exitCode=1;
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
