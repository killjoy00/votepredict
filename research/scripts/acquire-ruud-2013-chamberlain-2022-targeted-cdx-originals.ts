/**
 * #864 TARGETED primary-source replays from the already independently
 * obtained SIX complete historical CDX index source files in merged #1100.
 * Carrie's 2012 site self-identifies as a STATE PARTY CHAIR site, NOT Senate
 * campaign. Chamberlain's genuine 2020 site is a personal senator/podcast
 * site, NOT automatically the 2022 campaign platform. This phase looks at
 * genuine exactly indexed SEP 2013 Ruud and JAN/NOV 2022 Chamberlain HTML.
 *
 * All original public government Minnesota Senate service, original full
 * historical index JSON bytes/SHA and all 10 fixed CDX row digests
 * authenticated BEFORE any web archive replay. ZERO production changes.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import led from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-targeted-first-party-original-replays-v1.json' with {type:'json'};
import {parseWaybackCdxJson,waybackSnapshotUrl} from '../../src/evidence/wayback.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection,
 type AuditedOfficialSenateDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {fetchDatedBoundedPublic,type PublicReply}
 from '../../scripts/acquire-senate-2022-ever-served-campaign-originals.js';
export const RUUD_2013_CHAMBERLAIN_2022_PINNED_HISTORIC_SOURCES_VERSION=
 'mn-ruud-2013-chamberlain-2022-ten-exact-indexed-source-replay-receipts-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const SITE_MANIFEST_SHA='1df07f5392238ad5954983ab6263f57f27dbf9653e27cb459143fc6b8c2cd1df';
const INDEX_SHAS={
 'ruudchamberlain-02-original-cdx-index.json':'30a84763c9955f24db70d46656c9b71329805f2139a246024f25115e6b0ce473',
 'ruudchamberlain-05-original-cdx-index.json':'61dcb8b75fcb80294e31345dc6da42c95fddfbc251b54d348514e52913e784a3',
} as const;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const exactUtc=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
type Capture=typeof led.targets[number];
type ProofOriginal={
 originalUrl:string;timestamp:string;archiveCapturedUTC:string;cdxSha1:string;
 person:string;originalIndexFile:string;sourceCharacterizationPendingHumanReview:string;
};
function sourceBytes(file:string,min:number,max:number){
 const st=statSync(file);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Original indexed public government/Wayback file missing, incomplete or oversized');
 return readFileSync(file);
}
export function authenticateFixed2013And2022OriginalRowsBeforeNetwork(
 government:AuditedOfficialSenateDirectory,
 originalSourceManifest:Uint8Array,
 originalFullCDXJson:Readonly<Record<string,Uint8Array>>,
):ProofOriginal[]{
 const s=led.scope,g=led.originalGovernment,p=led.priorSource;
 if(led.schema!=='mn-ruud-2013-chamberlain-2022-ten-targeted-index-attested-original-html-replays-v1'
  ||s.issue!==864||s.peopleIndependentlyProvenActual2021MNStateSenators!==2
  ||s.preciselyOriginalCDXIndexedTargets!==10||s.ruudOriginal2013Pages!==5
  ||s.chamberlainOriginal2022Pages!==5
  ||s.realCandidateIssuePolicyQuotesAutomaticallyAdmitted!==0
  ||s.original2012RuudStatePartyChairNotSenatePlatform!==true
  ||s.original2020ChamberlainPersonalPodcastNotCampaign!==true
  ||s.thirdParty2022IndependentExpenditureNotCandidateStatement!==true
  ||s.indexRowCappingPreviouslyObserved!==true
  ||s.wholeOriginalOfficialLRLSenateServiceRequiredBeforeNetwork!==true
  ||s.originalArchiveCaptureUTCOnlyPublicByNotAuthoredDate!==true
  ||s.productionDatabaseEvidenceModelForecastSchedulerChanges!==0
  ||g.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||g.run!==38094976711||g.artifact!==11685387674
  ||g.fullHTMLSha256!==GOV_SHA
  ||p.acquisitionPR!==1100||p.fullOriginalWaybackIndexRun!==38162916977
  ||p.originalWaybackIndexArtifact!==11711190862
  ||p.originalArchiveArtifactName!=='ruud-chamberlain-2012-2022-original-historical-first-party-campaign-html-v1'
  ||p.sourceManifestFile!=='source-acquisition-manifest.json'
  ||p.sourceManifestSha256!==SITE_MANIFEST_SHA
  ||p.indexFiles.length!==2
  ||led.targets.length!==10)
  throw Error('2013/2022 exact original source-index research scope changed');
 if(government.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||government.source.url!==g.url
  ||government.source.sourceBytesSha256!==GOV_SHA
  ||!exactUtc(government.source.observedAt)
  ||government.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||government.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Complete independent official original actually-serving Senate directory source absent');
 for(const [person,district] of [['Carrie Ruud','10'],['Roger Chamberlain','38']]){
  const membership=validateActualSenateServiceForElection(
   government,person,district,2020);
  if(membership.status!=='verified_senate_service'
   ||membership.serviceForThisElectionFollowingYearVerified!==true
   ||!membership.officialName)
   throw Error('State Senate ACTUAL 2021 serving member not independently authenticated: '+person);
 }
 if(originalSourceManifest.length<100||originalSourceManifest.length>3*1024*1024
  ||sha(originalSourceManifest)!==SITE_MANIFEST_SHA)
  throw Error('Full prior original archive acquisition manifest bytes differ from pinned public receipt');
 const earlier=JSON.parse(Buffer.from(originalSourceManifest).toString('utf8')) as{
  schema?:string;counts?:{
   actualVerifiedStateSenators?:number;totalIndexQueries?:number;
   validOriginalCDXIndexes?:number;indexQueriesAtCap?:number;
   totalOriginalHTMLReplayAttempts?:number;fullyAuthenticatedOriginalPageHTMLBodies?:number;
   distinctActuallyServingSenatorsWithOriginalHTML?:number;
   independentlyHumanVerifiedDirectPolicyStatements?:number;
   productionDatabaseEvidenceModelForecastSchedulerChanges?:number;
  };
 };
 if(earlier.schema!=='mn-two-serving-2021-senators-historical-2012-2022-original-website-probe-v1'
  ||earlier.counts?.actualVerifiedStateSenators!==2
  ||earlier.counts.totalIndexQueries!==6
  ||earlier.counts.validOriginalCDXIndexes!==6
  ||earlier.counts.indexQueriesAtCap!==2
  ||earlier.counts.totalOriginalHTMLReplayAttempts!==10
  ||earlier.counts.fullyAuthenticatedOriginalPageHTMLBodies!==9
  ||earlier.counts.distinctActuallyServingSenatorsWithOriginalHTML!==2
  ||earlier.counts.independentlyHumanVerifiedDirectPolicyStatements!==0
  ||earlier.counts.productionDatabaseEvidenceModelForecastSchedulerChanges!==0)
  throw Error('Original prior research source artifact contents/denominators changed');
 const indexed=new Map<string,ReturnType<typeof parseWaybackCdxJson>>();
 for(const [f,expected] of Object.entries(INDEX_SHAS)){
  const original=originalFullCDXJson[f];
  if(!original||original.length<100||original.length>1_500_000
   ||sha(original)!==expected)
   throw Error('Original independently fetched FULL historical CDX index SHA256 mismatch: '+f);
  indexed.set(f,parseWaybackCdxJson(JSON.parse(Buffer.from(original).toString('utf8')) as unknown));
 }
 if(Object.keys(originalFullCDXJson).length!==2
  ||p.indexFiles.some(x=>INDEX_SHAS[x.file as keyof typeof INDEX_SHAS]!==x.sha256))
  throw Error('Exact two whole prior original source-index files required');
 const unique=new Set<string>();
 let ruud=0,roger=0;
 const attested:ProofOriginal[]=[];
 for(const row of led.targets){
  const known= row.person==='Carrie Ruud'
   ?{host:'carrieruud.com',start:'2013-01-01T00:00:00.000Z',end:'2014-01-01T00:00:00.000Z',file:'ruudchamberlain-02-original-cdx-index.json'}
   :row.person==='Roger Chamberlain'
   ?{host:'rogerchamberlainmn.com',start:'2022-01-01T00:00:00.000Z',end:'2022-11-08T00:00:00.000Z',file:'ruudchamberlain-05-original-cdx-index.json'}
   :null;
  if(!known||row.originalIndexFile!==known.file
   ||row.prejudgedCampaignPolicyCopy!==false
   ||!row.sourceCharacterizationPendingHumanReview
   ||!/^\d{14}$/.test(row.timestamp)
   ||!exactUtc(row.archiveCapturedUTC)
   ||row.archiveCapturedUTC<known.start||row.archiveCapturedUTC>=known.end
   ||!/^[A-Z2-7]{32}$/.test(row.cdxSha1)
   ||row.archiveCapturedUTC!==row.timestamp.slice(0,4)+'-'+row.timestamp.slice(4,6)+'-'+row.timestamp.slice(6,8)
    +'T'+row.timestamp.slice(8,10)+':'+row.timestamp.slice(10,12)+':'+row.timestamp.slice(12,14)+'.000Z')
   throw Error('Untrusted dated actual historical candidate original source target');
  const url=new URL(row.originalUrl);
  if(url.hostname.replace(/^www\./,'')!==known.host
   ||!['http:','https:'].includes(url.protocol)
   ||url.username||url.password||url.search||url.hash
   ||url.pathname.length>160
   ||(row.person==='Carrie Ruud'&&!url.pathname.startsWith('/index.cfm/'))
   ||(row.person==='Roger Chamberlain'
     &&!['/','/legislative-priorities/','/about/'].includes(url.pathname)))
   throw Error('Original candidate historic first-party URL identity/path mismatch');
  const captures=indexed.get(known.file);
  if(!captures?.some(c=>c.timestamp===row.timestamp
   &&c.original===row.originalUrl&&c.digest===row.cdxSha1
   &&c.capturedAt===row.archiveCapturedUTC))
   throw Error('Candidate URL/UTC/SHA is not independently contained in original full indexed CDX response');
  const id=row.person+'|'+row.originalUrl+'|'+row.timestamp;
  if(unique.has(id))throw Error('Duplicate original historical candidate issue source replay');
  unique.add(id);
  if(row.person==='Carrie Ruud')ruud++;else roger++;
  attested.push(row);
 }
 if(attested.length!==10||unique.size!==10||ruud!==5||roger!==5)
  throw Error('Ten source-index-authenticated candidate original page replay targets required');
 return attested;
}
function writeOriginal(dir:string,file:string,body:Buffer|null){
 if(!body||body.length<1)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(file)||file.includes('..'))
  throw Error('Unsafe immutable original archived source filename');
 writeFileSync(join(dir,file),body,{flag:'wx',mode:0o600});
 return file;
}
const metadata=(r:PublicReply)=>{const{body,...rest}=r;return rest;};
function conservativePageCharacterization(person:string,visible:string,originalPath:string){
 const txt=visible.toLowerCase();
 if(person==='Carrie Ruud'&&txt.includes('for state party chair'))
  return'authentic_person_owned_party_chair_not_mn_senate_campaign_platform';
 if(person==='Roger Chamberlain'&&txt.includes('roger, roger! podcast')
  &&originalPath!=='/legislative-priorities/')
  return'authentic_senator_owned_personal_podcast_not_certified_2022_campaign';
 if(person==='Roger Chamberlain'&&originalPath==='/legislative-priorities/'
  &&/legislative priorities/i.test(visible))
  return'authentic_senator_owned_original_legislative_priorities_not_yet_proven_election_campaign';
 return'authentic_individual_site_historical_source_campaign_character_pending';
}
export async function replayPinned2013And2022OriginalCandidateSources(
 out:string,government:AuditedOfficialSenateDirectory,
 originalManifest:Uint8Array,wholeCDX:Readonly<Record<string,Uint8Array>>,
 network:typeof fetch=fetch,
){
 const targets=authenticateFixed2013And2022OriginalRowsBeforeNetwork(
  government,originalManifest,wholeCDX);
 const dir=resolve(out);
 if(existsSync(dir))throw Error('Immutable original dated candidate archive output already exists');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const results:Array<{
   sourceTargetIndex:number;person:string;
   actuallyServedMNStateSenateIn2021:boolean;
   originalFirstPartyHistoricalURL:string;
   actualArchivedCaptureUTC:string;
   originalIndexedCDXSHA1Base32:string;
   archivedReplayUrl:string;
   originalCandidateFullHtmlFile:string|null;
   originalCandidateFullHtmlSHA256:string|null;
   originalWholeHtmlMatchesOriginalIndexedSHA1:boolean;
   personSurnameVerifiedInVisiblePage:boolean;
   sourceIsFullAuthenticatedOriginalHistoricalIndividualSite:boolean;
   conservativeSourceCharacter:string;
   originalFirstAuthorPublicationDateIndependentlyProven:boolean;
   automaticallyProvenElectionCampaignPolicyQuote:boolean;
   exactCandidatePolicyExcerptsYetAdded:number;
   visibleBodyCharacterCount:number;
   originalResponse:ReturnType<typeof metadata>;
 }>=[];
 for(const [i,item] of targets.entries()){
  const original=waybackSnapshotUrl(item.timestamp,item.originalUrl);
  const response=await fetchDatedBoundedPublic(original,2_500_000,network);
  const authentic=Boolean(response.status===200&&response.body
   &&historicalArchiveSha1Base32(response.body)===item.cdxSha1
   &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.contentType??''));
  const visible=authentic&&response.body?originalCampaignVisibleText(response.body):'';
  const surname=item.person.split(' ').at(-1)!.toLowerCase();
  const correctPerson=visible.toLowerCase().includes(surname);
  const complete=authentic&&correctPerson;
  const filename='targeted-'+String(i+1).padStart(2,'0')+
   '-original-'+item.timestamp+'.html';
  const stored=writeOriginal(dir,filename,complete?response.body:null);
  results.push({
   sourceTargetIndex:i,person:item.person,
   actuallyServedMNStateSenateIn2021:true,
   originalFirstPartyHistoricalURL:item.originalUrl,
   actualArchivedCaptureUTC:item.archiveCapturedUTC,
   originalIndexedCDXSHA1Base32:item.cdxSha1,
   archivedReplayUrl:original,
   originalCandidateFullHtmlFile:stored,
   originalCandidateFullHtmlSHA256:complete&&response.body?sha(response.body):null,
   originalWholeHtmlMatchesOriginalIndexedSHA1:authentic,
   personSurnameVerifiedInVisiblePage:correctPerson,
   sourceIsFullAuthenticatedOriginalHistoricalIndividualSite:complete,
   conservativeSourceCharacter:complete?conservativePageCharacterization(
    item.person,visible,new URL(item.originalUrl).pathname):'original_not_verified',
   originalFirstAuthorPublicationDateIndependentlyProven:false,
   automaticallyProvenElectionCampaignPolicyQuote:false,
   exactCandidatePolicyExcerptsYetAdded:0,
   visibleBodyCharacterCount:visible.length,
   originalResponse:metadata(response),
  });
 }
 const report={
  schema:RUUD_2013_CHAMBERLAIN_2022_PINNED_HISTORIC_SOURCES_VERSION,
  sourceOriginalGovernmentLRLSenateServiceSHA256:government.source.sourceBytesSha256,
  govSourceActuallyObservedUTC:government.source.observedAt,
  originalIndependentFullWaybackIndexArtifact:11711190862,
  sourceAcquiredUTC:new Date().toISOString(),
  actual2021ServingSenatorsProvenBeforeNetwork:2,
  wholePreviouslyAcquiredIndependentCDXIndexesRehashed:2,
  entirePreviousOriginalAcquisitionManifestSha256:SITE_MANIFEST_SHA,
  requestedExactlyIndexedHistoricOriginalPages:targets.length,
  authenticOriginalHistoricalPageBodies:results.filter(x=>x.sourceIsFullAuthenticatedOriginalHistoricalIndividualSite).length,
  byPerson:Object.fromEntries(['Carrie Ruud','Roger Chamberlain'].map(name=>[
   name,results.filter(x=>x.person===name
    &&x.sourceIsFullAuthenticatedOriginalHistoricalIndividualSite).length])),
  results,productionEvidenceDBForecastModelSchedulerChanges:0,
  researchExcerptsAutoAdmitted:0,
  missingSourcesCannotProveNoPositions:true,
  originalArchivedDateIsOnlyPublicByNotAuthoredAt:true,
  current2026OwnershipOfDomainsNeverUsedToAttributeHistoricalPolicy:true,
 };
 writeOriginal(dir,'source-acquisition-manifest.json',
  Buffer.from(JSON.stringify(report,null,2)+'\n'));
 console.log('RUUD-2013-CHAMBERLAIN-2022-EXACT-SOURCE-REPLAY-RESULT '+JSON.stringify({
  genuine2021Senators:report.actual2021ServingSenatorsProvenBeforeNetwork,
  previousCDXFiles:report.wholePreviouslyAcquiredIndependentCDXIndexesRehashed,
  attempted:report.requestedExactlyIndexedHistoricOriginalPages,
  authenticatedCompleteOriginalHTML:report.authenticOriginalHistoricalPageBodies,
  byPerson:report.byPerson,
  policyQuotesAutomaticallyAdmitted:report.researchExcerptsAutoAdmitted,
  productionChanges:report.productionEvidenceDBForecastModelSchedulerChanges,
 }));
 return report;
}
async function main(){
 const args=process.argv.slice(2);
 const keys=['--complete-original-mn-actual-senator-lrl-html',
  '--original-government-utc-sha-receipt',
  '--prior-original-wayback-index-artifact-dir',
  '--output-dir'];
 if(args.length!==keys.length*2||keys.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Whole original official government and whole previous original index artifact are required');
 const [gov,receipt,source,out]=keys.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Original public data path is absent');
  return resolve(v);
 });
 if(new Set([gov,receipt,source,out]).size!==4)
  throw Error('Cannot overwrite whole original government or Wayback source bytes');
 const g=sourceBytes(gov,9000,5*1024*1024);
 const r=JSON.parse(sourceBytes(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(sha(g)!==GOV_SHA
  ||r.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||r.source.sourceBytesSha256!==GOV_SHA||!r.source.observedAt)
  throw Error('Full original official actually-serving State Senate government directory SHA/date unavailable');
 const official=parseOfficialMnSenateServiceDirectory(g,r.source.observedAt);
 const manifest=sourceBytes(join(source,'source-acquisition-manifest.json'),100,3*1024*1024);
 const cdxs:Record<string,Uint8Array>={};
 for(const key of Object.keys(INDEX_SHAS))
  cdxs[key]=sourceBytes(join(source,key),100,1_500_000);
 await replayPinned2013And2022OriginalCandidateSources(out,official,manifest,cdxs);
}
if(process.argv[1]?.endsWith('acquire-ruud-2013-chamberlain-2022-targeted-cdx-originals.ts')){
 main().catch(e=>{
  console.error('Independent original candidate 2013/2022 site provenance rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,500));
  process.exitCode=1;
 });
}
