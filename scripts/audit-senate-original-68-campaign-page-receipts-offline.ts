/**
 * #864: independently re-open 68 original 2019/20 and 2022 first-party
 * campaign pages, their original acquisition manifests and the REAL official
 * LRL Senate directory bytes. Refuse manifest/date/hash/person substitution.
 *
 * A matched Wayback CDX SHA-1 and SHA-256 attests archived source page bytes,
 * NEVER first author publication time, 2022 newly authored campaign content,
 * senator legislative vote or forecast/persisted evidence admissibility.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {mkdirSync} from 'node:fs';
import fixed from '../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

export const SENATE_68_ORIGINAL_CAMPAIGN_RECEIPT_AUDIT_VERSION=
 'mn-senate-68-reopened-2020-22-original-campaign-page-digests-v1' as const;
const district2020:Readonly<Record<string,string>>={
 'Mark Johnson':'1','Jen McEwen':'7','Aric Putnam':'14',
 'Gary Dahms':'16','Mary Kunesh':'41','Steve Cwodzinski':'48',
};
const district2022:Readonly<Record<string,string>>={
 'Mark Johnson':'1','Grant Hauschild':'3','Robert Farnsworth':'7',
 'Jen McEwen':'8','Nathan Wesenberg':'10','Aric Putnam':'14',
 'Gary Dahms':'15','Liz Boldon':'25','Mary Kunesh':'39',
 'Erin Maye Quade':'56','Zaynab Mohamed':'63','Clare Oumou Verbeten':'66',
};
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
type Source2022={
 actualOfficialLRLSenateServiceSource?:{originalHtmlSha256?:string};
 totals?:{verifiedActuallyServedSenatorPeople?:number;
  originalHTMLBodiesVerifiedAgainstIndependentCDXSha1?:number;};
 candidates?:Array<{
  candidate?:string;originalGovernmentServiceHtmlSha256?:string;
  archivedOriginalPageChecks?:Array<{
   originalPageFile?:string;originalUrl?:string;
   historicalArchiveCaptureUtc?:string;originalBodySha256?:string;
   independentlyObtainedOriginalCDXSha1Base32?:string;
   originalHtmlExactlyMatchesHistoricalCDXDigest?:boolean;
  }>;
 }>;
};
type Source2020={
 originalIndependentlyVerifiedOfficialLRLSenateDirectory?:{sourceSha256?:string};
 totals?:{actuallyServedSenatorPeople?:number;
  authenticOriginalHtmlAndIndependentCdxMatches?:number;};
 actualSenateCandidateDomains?:Array<{
  candidateIdentity2020Lead?:string;
  originalOfficialSenateDirectoryHtmlSha256?:string;
  authenticOriginalPageReceipts?:Array<{
   originalFullHtmlSourceFile?:string;originalWebsiteUrl?:string;
   firstAttestedArchiveCaptureAtUtc?:string;originalFullHtmlSha256?:string;
   independentlyIndexedHistoricalOriginalSha1Base32?:string;
   actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest?:boolean;
  }>;
 }>;
};
function original(path:string,min:number,max:number):Buffer{
 const st=statSync(path);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Original official or campaign source missing/unbounded: '+path);
 return readFileSync(path);
}
const exactIso=(iso:string)=>{
 const value=Date.parse(iso);
 return Number.isFinite(value)&&new Date(value).toISOString()===iso;
};
export function auditPinned68SenateOriginalCampaignPageReceipts(args:{
 lrlHtml:Uint8Array;
 lrlReceipt:{source?:{url?:string;observedAt?:string;sourceBytesSha256?:string}};
 original2022:Source2022;original2020:Source2020;
 html2022:Readonly<Record<string,Uint8Array>>;
 html2020:Readonly<Record<string,Uint8Array>>;
}){
 const a=fixed.archiveArtifacts;
 if(fixed.schema!=='mn-senate-2020-and-2022-authenticated-original-campaign-page-provenance-v1'
   ||fixed.issue!==864
   ||fixed.scope.onlyIndependentlyConfirmedActualSenateServingPeople!==true
   ||fixed.scope.original2020CaptureCount!==24
   ||fixed.scope.original2022CaptureCount!==44
   ||fixed.scope.allTrueOriginalArchivedPageCopies!==68
   ||fixed.scope.distinctPeopleEverServedSenateIn2022ArchivedCohort!==12
   ||fixed.scope.originalSitesEnumeratedStatewide!==false
   ||fixed.scope.campaignPositionQuotesFromThisPageSetIndividuallyReviewed!==false
   ||fixed.scope.originalAuthorPublicationTimesCertified!==false
   ||fixed.scope.originalHistoricSOSFiledWebsiteFieldsCertified!==false
   ||fixed.scope.productionForecastEvidenceRowsAdmitted!==0
   ||a.source2022.runId!==38107693123||a.source2022.artifactId!==11689989592
   ||a.source2022.archiveZipSha256!=='610ba6c678fd93ce38a5c120e7c29fb57d99f3d998276b26cae8e5c276e7dc47'
   ||a.source2020.runId!==38107731662||a.source2020.artifactId!==11689839922
   ||a.source2020.archiveZipSha256!=='eea4562fe218b9e49c3d764aabb675ac25d8c20dabcb56554aa102e939c446ef'
   ||fixed.pages.length!==68)
  throw Error('Source-only persistent 68-copy original campaign inventory count/provenance changed');
 const gov=fixed.officialSenateService;
 if(gov.originalLRLRunId!==38094976711||gov.originalLRLArtifactId!==11685387674
   ||gov.originalLRLDirectorySha256!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
   ||digest(args.lrlHtml)!==gov.originalLRLDirectorySha256
   ||args.lrlReceipt.source?.sourceBytesSha256!==gov.originalLRLDirectorySha256
   ||args.lrlReceipt.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!args.lrlReceipt.source.observedAt||!exactIso(args.lrlReceipt.source.observedAt))
  throw Error('Real original LRL Senate-service directory HTML and UTC receipt required');
 const official=parseOfficialMnSenateServiceDirectory(
  args.lrlHtml,args.lrlReceipt.source.observedAt);
 if(args.original2022.actualOfficialLRLSenateServiceSource?.originalHtmlSha256
     !==gov.originalLRLDirectorySha256
   ||args.original2022.totals?.verifiedActuallyServedSenatorPeople!==12
   ||args.original2022.totals?.originalHTMLBodiesVerifiedAgainstIndependentCDXSha1!==44
   ||args.original2022.candidates?.length!==12
   ||args.original2020.originalIndependentlyVerifiedOfficialLRLSenateDirectory?.sourceSha256
     !==gov.originalLRLDirectorySha256
   ||args.original2020.totals?.actuallyServedSenatorPeople!==6
   ||args.original2020.totals?.authenticOriginalHtmlAndIndependentCdxMatches!==24
   ||args.original2020.actualSenateCandidateDomains?.length!==6)
  throw Error('Wrong independently verified original campaign source acquisition receipts');
 const identities=new Set<string>(),paths=new Set<string>(),checks=[];
 for(const p of fixed.pages){
  if(![2020,2022].includes(p.electionYear)
    ||!/^[0-9a-f]{64}$/.test(p.originalHtmlSha256)
    ||!/^[A-Z2-7]{32}$/.test(p.independentHistoricalCdxPayloadSha1Base32)
    ||p.originalPostedByAuthorAtUtc!==null||p.campaignCycleForQuoteReviewed!==false
    ||p.sourceEvidenceInProduction!==false||p.publicByCutoffIsOriginalCaptureOnly!==true
    ||!exactIso(p.historicalCaptureAtUtc)
    ||p.historicalCaptureAtUtc>=(p.electionYear===2022?
      '2022-11-08T00:00:00.000Z':'2020-11-03T00:00:00.000Z')
    ||p.historicalCaptureAtUtc.slice(0,4)<(p.electionYear===2022?'2022':'2019')
    ||!/^senate(20|22)-\d{2}-(?:original|archive)-\d{14}-\d+\.html$/.test(p.sourceFile)
    ||paths.has(p.sourceFile)
    ||!['http:','https:'].includes(new URL(p.originalUrl).protocol))
   throw Error('Undated, misleading, reused or unbounded original campaign page receipt');
  paths.add(p.sourceFile);
  const id=p.electionYear+'|'+p.senator;
  identities.add(id);
  const district=(p.electionYear===2022?district2022:district2020)[p.senator];
  if(!district)throw Error('Never-served/unsourced candidate in permanent original-page receipt');
  const senator=validateActualSenateServiceForElection(
   official,p.senator,district,p.electionYear);
  if(senator.status!=='verified_senate_service'
    ||senator.serviceForThisElectionFollowingYearVerified!==true)
   throw Error('Original archived page person lacks independent actual Minnesota Senate service proof');
  // Keep 2020 and 2022 source schema branches explicit: 2020 and 2022
  // original acquisition manifests have different field names by design.
  // A loose structural union must never bypass person/page association.
  let sourceUrl:string|undefined,captured:string|undefined;
  let sourceSha:string|undefined,cdx:string|undefined,matched:boolean|undefined;
  if(p.electionYear===2022){
   const candidate=args.original2022.candidates?.find(x=>x.candidate===p.senator);
   if(!candidate||candidate.originalGovernmentServiceHtmlSha256!==gov.originalLRLDirectorySha256)
    throw Error('Original 2022 campaign source assigned to wrong independently served senator');
   const page=candidate.archivedOriginalPageChecks?.find(x=>x.originalPageFile===p.sourceFile);
   if(!page)throw Error('Original 2022 campaign page missing from original acquisition manifest');
   sourceUrl=page.originalUrl;
   captured=page.historicalArchiveCaptureUtc;
   sourceSha=page.originalBodySha256;
   cdx=page.independentlyObtainedOriginalCDXSha1Base32;
   matched=page.originalHtmlExactlyMatchesHistoricalCDXDigest;
  }else{
   const candidate=args.original2020.actualSenateCandidateDomains?.find(x=>
     x.candidateIdentity2020Lead===p.senator);
   if(!candidate||candidate.originalOfficialSenateDirectoryHtmlSha256!==gov.originalLRLDirectorySha256)
    throw Error('Original 2020 campaign source assigned to wrong independently served senator');
   const page=candidate.authenticOriginalPageReceipts?.find(x=>
     x.originalFullHtmlSourceFile===p.sourceFile);
   if(!page)throw Error('Original 2020 campaign page missing from original acquisition manifest');
   sourceUrl=page.originalWebsiteUrl;
   captured=page.firstAttestedArchiveCaptureAtUtc;
   sourceSha=page.originalFullHtmlSha256;
   cdx=page.independentlyIndexedHistoricalOriginalSha1Base32;
   matched=page.actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest;
  }
  if(sourceUrl!==p.originalUrl||captured!==p.historicalCaptureAtUtc
    ||sourceSha!==p.originalHtmlSha256
    ||cdx!==p.independentHistoricalCdxPayloadSha1Base32
    ||matched!==true)
   throw Error('Pinned and acquired original campaign date/URL/SHA-256/CDX SHA-1 do not agree');
  const page=(p.electionYear===2022?args.html2022:args.html2020)[p.sourceFile];
  if(!page||page.byteLength<32||page.byteLength>2_500_000
    ||digest(page)!==p.originalHtmlSha256
    ||historicalArchiveSha1Base32(page)!==p.independentHistoricalCdxPayloadSha1Base32)
   throw Error('Actual archived first-party original HTML disagrees with pinned SHA-256 or independent historical CDX SHA-1');
  checks.push({
   senator:p.senator,electionYear:p.electionYear,
   originalUrl:p.originalUrl,sourceFile:p.sourceFile,
   originalCaptureAtUtc:p.historicalCaptureAtUtc,
   originalHtmlSha256:p.originalHtmlSha256,
   historicalCdxSha1Base32:p.independentHistoricalCdxPayloadSha1Base32,
   exactOriginalBodyHashAndHistoricalIndexDigestRechecked:true as const,
   campaignPlatformFirstAuthorPublishedAtUtc:null,
   senatorServiceVerifiedByOfficialOriginal:true as const,
   candidateIssueStanceConcluded:false as const,
   forecastAdmissionPermitted:false as const,
  });
 }
 if(checks.length!==68||checks.filter(x=>x.electionYear===2022).length!==44
   ||checks.filter(x=>x.electionYear===2020).length!==24
   ||new Set(checks.filter(x=>x.electionYear===2022).map(x=>x.senator)).size!==12
   ||new Set(checks.filter(x=>x.electionYear===2020).map(x=>x.senator)).size!==6
   ||Object.keys(args.html2022).some(f=>!paths.has(f))
   ||Object.keys(args.html2020).some(f=>!paths.has(f)))
  throw Error('Unexpected saved campaign page or person/capture/historical-source reconciliation counts');
 return{
  schema:SENATE_68_ORIGINAL_CAMPAIGN_RECEIPT_AUDIT_VERSION,
  actualIndependentOfficialSenatorServiceSourceSha256:gov.originalLRLDirectorySha256,
  year2020OriginalPageCopies:24,
  year2022OriginalPageCopies:44,
  independentlyHashAndCdxVerifiedSourceCopies:checks.length,
  distinct2022ActuallyServedSenatorPeople:12,
  additional2020HistoricalPersonSourcesSamePeople:true,
  originalSosFiledWebsiteFieldCertified:false,
  originalAuthorPublicationTimeCertified:false,
  candidateStanceQuotesActuallyReviewed:0,
  originalSourceOnlyNoProductionEvidenceOrForecastActions:true,
  originalSources:checks,
 };
}
function main(){
 const options=[
  '--official-lrl-original','--official-lrl-receipt',
  '--2022-artifact-extract-dir','--2020-artifact-extract-dir','--output',
 ];
 const argv=process.argv.slice(2);
 if(argv.length!==options.length*2||options.some(k=>argv.filter(x=>x===k).length!==1))
  throw Error('Five distinct original government/archive source inputs/output options required');
 const vals=options.map(k=>{
  const i=argv.indexOf(k),x=i<0?undefined:argv[i+1];
  if(!x||x.startsWith('--'))throw Error('Original source acquisition evidence required');
  return resolve(x);
 });
 if(new Set(vals).size!==vals.length)
  throw Error('Original source files and output must never overwrite/conflate');
 const [lrl,receipt,source22,source20,out]=vals;
 const realManifest22=JSON.parse(original(join(source22,'source-acquisition-manifest.json'),
  100,4_000_000).toString('utf8')) as Source2022;
 const realManifest20=JSON.parse(original(join(source20,'acquisition-manifest.json'),
  100,4_000_000).toString('utf8')) as Source2020;
 const html2022:Record<string,Uint8Array>={},html2020:Record<string,Uint8Array>={};
 for(const p of fixed.pages){
  const dir=p.electionYear===2022?source22:source20;
  const key=p.electionYear===2022?html2022:html2020;
  key[p.sourceFile]=original(join(dir,p.sourceFile),32,2_500_000);
 }
 const report=auditPinned68SenateOriginalCampaignPageReceipts({
  lrlHtml:original(lrl,9000,5*1024*1024),
  lrlReceipt:JSON.parse(original(receipt,100,3*1024*1024).toString('utf8')),
  original2022:realManifest22,original2020:realManifest20,
  html2022,html2020,
 });
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('PINNED-CAMPAIGN-ORIGINAL-68-RECHECK '+JSON.stringify({
  historicalPageCopiesReopened:report.independentlyHashAndCdxVerifiedSourceCopies,
  historical2022PageCopies:report.year2022OriginalPageCopies,
  historical2020PageCopies:report.year2020OriginalPageCopies,
  unique2022SenatePeople:report.distinct2022ActuallyServedSenatorPeople,
  productionWrites:0,forecastIngestion:0,originalAuthorPostedDateProved:0,
  reportOutput:out,
 }));
}
if(process.argv[1]?.endsWith('audit-senate-original-68-campaign-page-receipts-offline.ts'))
 main();
