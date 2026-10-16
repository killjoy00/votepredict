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
  from '../../src/evidence/cfb-report-availability.js';
import {load2022PinnedOriginalViewerRows}
  from './cfb-2022-served-d25-36-original-ce.js';
import {
  auditActualSenatorAmendmentPdf,
  amendmentViewerReference,
  checkAuthenticatedAmendmentChains as checkStrictAuthenticatedAmendmentChains,
  type SenatorAmendmentSourceTarget,
  type OriginalSenatorFinanceReport,
  type CfbHistoricalAmendedPdfSource,
} from './cfb-2021-22-served-senator-amendments.js';

export {auditActualSenatorAmendmentPdf, amendmentViewerReference};
export type {CfbHistoricalAmendedPdfSource,SenatorAmendmentSourceTarget};
export const SD25_36_30_AMENDMENT_SOURCE_VERSION=
  'mn-cfb-2021-22-served-sd25-36-30-original-amendment-pdf-source-v2' as const;
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

/**
 * Official 2022 John Hoffman YE references #1 and #2 were independently
 * downloaded on October 11, 2026 as separate CFB viewer requests, but
 * yielded byte-identical PDFs. The cause of the CFB alias is UNKNOWN.
 *
 * The exception is pinned to the *specific* original, viewer indices, SHA,
 * byte count and stamped date. A changed source must be reviewed, not
 * silently accepted as a second distinct report or a new alias.
 */
export const REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS={
  originalReportId:'17319:22:pcc:YE:0:0',
  originalReportSha256:'9021188adb7c834e0b28273b71fb72f2ceaabb18cbb2c56b1a0e93a6489e7485',
  canonicalReferenceId:'17319:22:pcc:YE:0:1',
  aliasedReferenceId:'17319:22:pcc:YE:0:2',
  binarySha256:'5a95df8f11a8b912b65d4befebd368cf00008e814844c69c3069c77fac7f8e2d',
  byteLength:686801,
  boardReceivedOn:'2023-05-28',
} as const;

type PdfAudit=ReturnType<typeof auditActualSenatorAmendmentPdf>;
function reviewedHoffmanAliasReconfirmed(audits:ReadonlyArray<PdfAudit>){
  const match=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const first=audits.filter(r=>r.id===match.canonicalReferenceId);
  const second=audits.filter(r=>r.id===match.aliasedReferenceId);
  if(first.length!==1||second.length!==1)return false;
  const a=first[0]!,b=second[0]!;
  return [a,b].every((r,i)=>r.status==='amendment_pdf_and_original_identity_authenticated'
    &&r.amendmentFirstPageIdentityOfficeDatesVerified
    &&r.originalReportId===match.originalReportId
    &&r.originalReportSha256===match.originalReportSha256
    &&r.registrationNumber==='17319'
    &&r.reportYear===2022&&r.period==='YE'
    &&r.amendmentViewerIndex===i+1
    &&r.amendedPdfSha256===match.binarySha256
    &&r.amendedPdfByteLength===match.byteLength
    &&r.amendedBoardReceivedOn===match.boardReceivedOn
    &&r.amendedCoverageStartOn==='2022-01-01'
    &&r.amendedCoverageEndOn==='2022-12-31'
    &&r.amendedPdfPrintedSenateDistrict===34
    &&r.amendedBinaryDistinctFromOriginal
    &&r.sourceErrorKind===null
    &&!!r.amendedPdfSourceUrl)
    &&a.amendedPdfSourceUrl!==b.amendedPdfSourceUrl
    &&a.originalViewerApiSha256===b.originalViewerApiSha256;
}

/** Original, distinct amendment, exact duplicate-reference alias, unverified
 * paper and failed fetch are separate evidentiary states. In particular, the
 * duplicate reference is NOT a distinct amended-PDF binary. */
export function classifySd25to36AmendmentReferences(audits:ReadonlyArray<PdfAudit>){
  const reviewedAlias=reviewedHoffmanAliasReconfirmed(audits);
  return audits.map(r=>{
    const authenticated=r.status==='amendment_pdf_and_original_identity_authenticated';
    const isAlias=reviewedAlias&&r.id===REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS.aliasedReferenceId;
    const referenceClassification=isAlias
      ?'official_amendment_version_reference_alias_of_identical_pdf' as const
      :authenticated?'distinct_authenticated_amended_pdf' as const
      :r.status==='source_http_or_pdf_failure'?'source_fetch_failure' as const
      :'unverified_report_pdf_identity' as const;
    return {...r,referenceClassification,
      aliasOfAmendmentVersionId:isAlias
        ?REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS.canonicalReferenceId:null,
      distinctAmendedPdfBinary:isAlias?false:authenticated};
  });
}
type ClassifiedAudit=ReturnType<typeof classifySd25to36AmendmentReferences>[number];

/** Retain strict shared chain validation, exempting precisely one historically
 * documented binary alias. Also reject cross-parent or out-of-cohort collisions.
 * All 30 viewer indices stay present and all first-page checks still apply. */
export function checkAuthenticatedAmendmentChains(audits:ReadonlyArray<PdfAudit>){
  const strict=checkStrictAuthenticatedAmendmentChains(audits);
  const match=REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS;
  const reconfirmed=reviewedHoffmanAliasReconfirmed(audits);
  const violations=strict.violations.filter(v=>!(reconfirmed
    &&v.id===match.aliasedReferenceId
    &&v.reason==='amendment_binary_duplicate_of_earlier_revision'));
  if(!reconfirmed)violations.push({
    id:match.aliasedReferenceId,
    reason:'reviewed_2022_hoffman_alias_original_source_changed_or_unconfirmed',
  });
  const owners=new Map<string,string>();
  for(const r of audits){
    if(!r.amendedPdfSha256)continue;
    const previous=owners.get(r.amendedPdfSha256);
    if(previous && !(reconfirmed&&previous===match.canonicalReferenceId
      &&r.id===match.aliasedReferenceId))
      violations.push({id:r.id,reason:'unexpected_amendment_pdf_binary_duplicate_across_cohort'});
    else if(!previous)owners.set(r.amendedPdfSha256,r.id);
  }
  const documentedBinaryAliases=reconfirmed?[{
    canonicalReferenceId:match.canonicalReferenceId,
    aliasedReferenceId:match.aliasedReferenceId,
    originalReportId:match.originalReportId,
    pdfSha256:match.binarySha256,bytes:match.byteLength,
    boardReceivedOn:match.boardReceivedOn,
    sourceReasonIndependentlyEstablished:false,
  }]:[];
  return {valid:violations.length===0,violations,documentedBinaryAliases};
}

/** Only 29 *distinct* amended report PDFs are proven when all 30 official
 * viewer references resolve; the documented second Hoffman reference is an
 * alias. A changed source, unexpected duplicate, held identity or fetch fails. */
export function verifyServedSd25to36AmendmentSourceOutcome(
  reports:ReadonlyArray<ClassifiedAudit>,
){
  const identity=reports.filter(r=>r.status==='amendment_pdf_and_original_identity_authenticated');
  const distinct=reports.filter(r=>r.referenceClassification==='distinct_authenticated_amended_pdf');
  const aliases=reports.filter(r=>
    r.referenceClassification==='official_amendment_version_reference_alias_of_identical_pdf');
  const chain=checkAuthenticatedAmendmentChains(reports);
  const sourceIdsUnique=reports.length===30&&new Set(reports.map(r=>r.id)).size===30;
  const distinctHashes=new Set(identity.map(r=>r.amendedPdfSha256!));
  const complete=sourceIdsUnique&&identity.length===30&&distinct.length===29
    &&aliases.length===1&&distinctHashes.size===29&&chain.valid
    &&aliases[0]?.id===REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS.aliasedReferenceId
    &&aliases[0]?.aliasOfAmendmentVersionId===REVIEWED_HOFFMAN_2022_YE_BINARY_ALIAS.canonicalReferenceId;
  return {status:complete
    ?'29_distinct_amended_pdfs_1_documented_official_viewer_alias' as const
    :'source_pdf_or_amendment_identity_unresolved' as const,
    verified:identity.length,holds:reports.length-identity.length,
    complete,sourceVersionReferencesAuthenticated:identity.length,
    distinctAuthenticatedAmendedPdfForms:distinct.length,
    documentedDuplicateReferenceAliases:aliases.length,
    distinctAmendmentPdfBinaries:distinctHashes.size,
    fullOriginalToAmendmentChainsVerified:chain.valid,
    fullDistinctBinaryRevisionChainsVerified:false,
    documentedBinaryAliases:chain.documentedBinaryAliases,
    chainViolations:chain.violations,
  };
}
