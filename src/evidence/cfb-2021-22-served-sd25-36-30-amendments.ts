/**
 * #864 / finance Track A: new original 2021-22 CFB amendment PDF versions
 * for MN Senate districts 25-36, only for 11 real people whose actual
 * Senate service was independently authenticated in the prior original-source
 * acquisition and preserved in two permanent C/E + year-end PDF SHA ledgers.
 *
 * All references must be in the original 2022-segment 396-response CFB
 * candidate viewer ledger; every amendment must have a verified 2021/22
 * original PDF parent. The legal-report denominator stays unknown.
 */
import {createHash} from 'node:crypto';
import {cfbElectronicReportAvailableOn}
  from './cfb-report-availability.js';
import {load2022PinnedOriginalViewerRows}
  from './cfb-2022-served-d25-36-original-ce.js';
import {
  auditActualSenatorAmendmentPdf,
  amendmentViewerReference,
  checkAuthenticatedAmendmentChains,
  type SenatorAmendmentSourceTarget,
  type OriginalSenatorFinanceReport,
  type CfbHistoricalAmendedPdfSource,
} from './cfb-2021-22-served-senator-amendments.js';

export {
  auditActualSenatorAmendmentPdf, amendmentViewerReference,
  checkAuthenticatedAmendmentChains,
};
export type {CfbHistoricalAmendedPdfSource,SenatorAmendmentSourceTarget};
export const SD25_36_30_AMENDMENT_SOURCE_VERSION=
  'mn-cfb-2021-22-served-sd25-36-30-original-amendment-pdf-source-v1' as const;
export const SD25_36_AMENDMENT_REFERENCE_COUNTS={
  '21:YE':3,'22:YE':13,'22:C':7,'22:E':7,
} as const;
const sha256=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const goodSha=(s:string)=>/^[0-9a-f]{64}$/.test(s);
const validDate=(s:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T00:00:00Z');
  return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s;
};
interface CeCheckpoint {
  verifiedReports:{ledgerUtf8Sha256:string;verifiedOriginalReportPdfCount:number;
    verifiedDistinctSenators:number;sourceFailures:number;};
  actualServedSenators:Array<{
    district:number;officialName:string;registrationNumber:string;
    officialDistrictRosterHtmlSha256:string;originalCfBReportsTabApiSha256:string;
  }>;
  pinnedOfficialSources:{independentCfb2022Calendar:{sha256:string}};
}
interface YeCheckpoint {
  permanentSourceLedger:{sha256:string};
  population:{authenticatedDistinctOriginalPdfBinaries:number;failures:number;
    independentlyActualSenators:number};
  independentlyObservedOriginalSources:{cfb2022Calendar:{sha256:string}};
}
export interface SourcesForSd25to36Amendment {
  originalCePsv:string;originalYePsv:string;originalViewerPsv:string;
  ceCheckpoint:CeCheckpoint;yeCheckpoint:YeCheckpoint;
}
function parseVerifiedOriginals(
  input:SourcesForSd25to36Amendment,
):OriginalSenatorFinanceReport[]{
  if(sha256(input.originalCePsv)!==input.ceCheckpoint.verifiedReports?.ledgerUtf8Sha256
    ||input.ceCheckpoint.verifiedReports.verifiedOriginalReportPdfCount!==22
    ||input.ceCheckpoint.verifiedReports.verifiedDistinctSenators!==11
    ||input.ceCheckpoint.verifiedReports.sourceFailures!==0
    ||sha256(input.originalYePsv)!==input.yeCheckpoint.permanentSourceLedger?.sha256
    ||input.yeCheckpoint.population?.authenticatedDistinctOriginalPdfBinaries!==18
    ||input.yeCheckpoint.population.failures!==0
    ||input.yeCheckpoint.population.independentlyActualSenators!==11)
    throw Error('Verified original C/E or year-end source PDF ledger SHA/count mismatch');
  const officialCalendarSha='3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25';
  if(input.ceCheckpoint.pinnedOfficialSources.independentCfb2022Calendar.sha256!==officialCalendarSha
    ||input.yeCheckpoint.independentlyObservedOriginalSources.cfb2022Calendar.sha256!==officialCalendarSha)
    throw Error('Original official CFB reporting-calendar proof drift');
  const originals:OriginalSenatorFinanceReport[]=[];
  for(const kind of ['CE','YE'] as const){
    const body=kind==='CE'?input.originalCePsv:input.originalYePsv;
    const rows=body.trimEnd().split('\n');
    if(!body.endsWith('\n')||rows.length!==(kind==='CE'?22:18))
      throw Error('Wrong permanent authenticated original report PDF ledger scope');
    for(const row of rows){
      const p=row.split('|');
      if(p.length!==12)throw Error('Permanent original source-ledger report column count drift');
      const [id,person,elect,printed,binary]=p;
      const segments=(id??'').split(':');
      if(segments.length!==6||segments[2]!=='pcc'
        ||!['21','22'].includes(segments[1]??'')
        ||(kind==='CE'?!['C','E'].includes(segments[3]??''):segments[3]!=='YE')
        ||segments[4]!=='0'||segments[5]!=='0'||!person||!goodSha(binary??''))
        throw Error('Permanent source-ledger original PDF identity invalid');
      const year=(2000+Number(segments[1])) as 2021|2022;
      const period=segments[3] as 'YE'|'C'|'E';
      const ballot=Number(elect),old=Number(printed);
      if(!Number.isInteger(ballot)||ballot<25||ballot>36||ballot===31
        ||!Number.isInteger(old)||old<1||old>67)
        throw Error('Non-confirmed Senate district in original source ledger');
      const coverageStart=p[kind==='CE'?6:7]!;
      const coverageEnd=p[kind==='CE'?7:8]!;
      const received=p[kind==='CE'?8:9]!;
      const due=p[kind==='CE'?9:10]!;
      const floor=p[kind==='CE'?10:11]!;
      const expectedEnd=period==='YE'?year+'-12-31'
        :period==='C'?'2022-07-18':'2022-10-24';
      const expectedDue=period==='YE'?(year+1)+'-01-31'
        :period==='C'?'2022-07-25':'2022-10-31';
      if(coverageStart!==year+'-01-01'||coverageEnd!==expectedEnd
        ||due!==expectedDue||![received,due,floor].every(validDate)
        ||received<coverageEnd||floor!==cfbElectronicReportAvailableOn(received,due))
        throw Error('Prior original reporting calendar/coverage/receipt discrepancy');
      originals.push({id:id!,registrationNumber:segments[0]!,person,
        year,period,electionDistrict:ballot,printedOriginalDistrict:old,
        pdfSha256:binary!,receivedOn:received,coveredFrom:coverageStart,
        coveredThrough:coverageEnd,dueOn:due,
        conservativeOriginalNotBeforeOn:floor});
    }
  }
  if(originals.length!==40||new Set(originals.map(x=>x.id)).size!==40
    ||new Set(originals.map(x=>x.pdfSha256)).size!==40)
    throw Error('Prior 40 original verified report PDF SHA uniqueness mismatch');
  return originals;
}
export function selectServedSd25to36AmendmentVersions(
  input:SourcesForSd25to36Amendment,
){
  const originals=parseVerifiedOriginals(input);
  const roster=input.ceCheckpoint.actualServedSenators;
  const originalById=new Map(originals.map(x=>[x.id,x]));
  if(roster?.length!==11||new Set(roster.map(x=>x.registrationNumber)).size!==11)
    throw Error('Original LRL proven eleven Senate-member registration cohort mismatch');
  const uniqueRegs=new Set(originals.map(x=>x.registrationNumber));
  if(uniqueRegs.size!==11||roster.some(x=>!uniqueRegs.has(x.registrationNumber))
    ||new Set(originals.map(x=>x.person)).size!==11)
    throw Error('Originals and member roster contain mismatched people');
  const api=load2022PinnedOriginalViewerRows(input.originalViewerPsv);
  if(api.size!==270)throw Error('Pinned historical 396-original API source scope drift');
  const targets:SenatorAmendmentSourceTarget[]=[];
  const counts:Record<string,number>={};
  for(const member of roster){
    if(!goodSha(member.officialDistrictRosterHtmlSha256)
      ||!goodSha(member.originalCfBReportsTabApiSha256))
      throw Error('Original official CFB district page or viewer SHA missing');
    const own=originals.filter(x=>x.registrationNumber===member.registrationNumber);
    if(own.length<3||own.length>4||own.some(x=>x.person!==member.officialName
      ||x.electionDistrict!==member.district))
      throw Error('Original PDF senator/person/Census district join mismatch');
    const historical=api.get(member.registrationNumber);
    if(!historical||historical.apiSha!==member.originalCfBReportsTabApiSha256)
      throw Error('Pinned original CFB viewer API response hash drift');
    for(const parent of own){
      const apiKey=parent.id.split(':').slice(1).join(':');
      if(!historical.keys.has(apiKey))
        throw Error('Prior authenticated original PDF not in exact CFB API reference inventory');
    }
    const amendmentKeys=[...historical.keys]
      .filter(x=>/^(21|22):pcc:(YE|C|E):0:[1-9]\d*$/.test(x)).sort();
    for(const key of amendmentKeys){
      const parts=key.split(':');
      const id=member.registrationNumber+':'+key;
      const parentId=member.registrationNumber+':'+parts.slice(0,4).join(':')+':0';
      const original=originalById.get(parentId);
      if(!original)throw Error('CFB amendment has no independently authenticated original report PDF');
      const amendmentIndex=Number(parts[4]);
      if(original.registrationNumber!==member.registrationNumber
        ||original.period!==parts[2]||original.year!==2000+Number(parts[0])
        ||!Number.isSafeInteger(amendmentIndex)||amendmentIndex>8)
        throw Error('Amendment parent/report identity or index mismatch');
      targets.push({id,originalId:parentId,original,actualSenator:original.person,
        registrationNumber:member.registrationNumber,
        year:original.year,period:original.period,amendmentIndex,
        originalReportsViewerBodySha256:historical.apiSha,
        originalCfbDistrictRosterSha256:member.officialDistrictRosterHtmlSha256});
      const k=parts[0]+':'+parts[2];counts[k]=(counts[k]??0)+1;
    }
  }
  const expected:Record<string,number>=SD25_36_AMENDMENT_REFERENCE_COUNTS;
  if(targets.length!==30||new Set(targets.map(x=>x.id)).size!==30
    ||Object.keys(counts).length!==4||Object.entries(expected).some(([k,n])=>counts[k]!==n))
    throw Error('Original 30 amendment viewer references no longer match 3/13/7/7 pinned scope');
  const byParent=new Map<string,number[]>();
  for(const t of targets)byParent.set(t.originalId,
    [...(byParent.get(t.originalId)??[]),t.amendmentIndex]);
  for(const versions of byParent.values()){
    const sorted=versions.sort((a,b)=>a-b);
    if(sorted.some((v,i)=>v!==i+1))
      throw Error('Missing or duplicated intermediate amendment PDF version reference');
  }
  targets.sort((a,b)=>a.original.electionDistrict-b.original.electionDistrict
    ||a.year-b.year||a.period.localeCompare(b.period)||a.amendmentIndex-b.amendmentIndex);
  return {targets,originals,selectedActualSenators:roster.length,
    registrationsWithAmendments:new Set(targets.map(t=>t.registrationNumber)).size,
    pinnedViewerOriginalResponses:api.size,amendmentReferenceCounts:counts,
    legallyOwedReportDenominator:null};
}

/** A fresh acquisition only succeeds if all original 30 amended PDF first
 * pages and chained versions pass authentication. A report-format exception
 * is evidence to HOLD, never grounds for accepting a guessed amendment. */
export function verifyServedSd25to36AmendmentSourceOutcome(
  reports:ReadonlyArray<ReturnType<typeof auditActualSenatorAmendmentPdf>>,
){
  const pass=reports.filter(r=>r.status==='amendment_pdf_and_original_identity_authenticated');
  const chain=checkAuthenticatedAmendmentChains(reports);
  const hashes=pass.map(r=>r.amendedPdfSha256!);
  const unique=reports.length===30&&new Set(reports.map(r=>r.id)).size===30
    &&new Set(hashes).size===hashes.length;
  return {status:unique&&pass.length===30&&chain.valid
    ?'all_30_pdf_amendment_first_pages_authenticated' as const
    :'source_pdf_or_amendment_identity_unresolved' as const,
    verified:pass.length,holds:reports.length-pass.length,
    complete:unique&&pass.length===30&&chain.valid,
    distinctAmendmentPdfBinaries:new Set(hashes).size,
    fullOriginalToAmendmentChainsVerified:chain.valid,
    chainViolations:chain.violations,
  };
}
