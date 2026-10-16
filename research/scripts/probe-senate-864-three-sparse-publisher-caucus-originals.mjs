/**
 * #864 original-archive recovery of separately typed published named senator
 * caucus quotes + an explicitly unverified candidate questionnaire lead.
 * NO quote admitted by this network probe, no candidate-owned site increment.
 * Original full archived HTML must match independent CDX SHA1 Base32 fingerprint.
 * CDX HTTP200 error HTML is a provider failure, not a negative historic assertion.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const av=process.argv.slice(2);
function arg(k){const i=av.indexOf(k);assert.ok(i>=0&&av[i+1]&&!av[i+1].startsWith('--'),'Missing '+k);return resolve(av[i+1]);}
const group=av[av.indexOf('--track')+1];
assert.ok(['kari','weber','newman','ivoter'].includes(group),'Unsupported original source research track');
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function file(p,min=15,max=7500000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Missing required original '+p);return readFileSync(p);}
const manifest=JSON.parse(file(resolve('data/evaluation/senate-864-three-sparse-senator-original-caucus-and-2022-questionnaire-targets-v1.json'),2500).toString());
assert.equal(manifest.schema,'senate-864-three-sparse-served-senators-independent-original-2020-2022-caucus-publisher-research-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.baseline.actualServing2021to2025Senators,95);
assert.equal(manifest.baseline.peopleWithCandidateOwnedHistoricalSiteExcerpts,92);
assert.equal(manifest.baseline.selectedCandidateSiteResearchExcerpts,1285);
assert.equal(manifest.productionReadsWrites,0);
assert.equal(manifest.automaticForecastFeatures,0);
const task=manifest.tracks[group];assert.ok(task);
const gov=file(arg('--official-html'),9000),govProof=JSON.parse(file(arg('--official-receipt'),800).toString()),swear=file(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),manifest.baseline.sourceGovernmentSha256);
assert.equal(govProof.source.sourceBytesSha256,sha(gov));
assert.equal(govProof.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(govProof.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const service=parseOfficialMnSenateServiceDirectory(gov,govProof.source.observedAt,swear,govProof.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const actual=validateActualSenateServiceForElection(service,task.person,task.district,task.electionYear);
assert.equal(actual.status,'verified_senate_service');
assert.equal(actual.officialName,task.officialName);
assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
const baseline=JSON.parse(file(arg('--prior-1285-matrix'),20000).toString());
assert.equal(baseline.issue,864);
assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
assert.equal(baseline.byActuallyServedSenator.length,95);
const row=baseline.byActuallyServedSenator.find(r=>r.officialName===actual.officialName);
assert.ok(row&&row.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound>=2);
async function get(url){
 let last={status:null,body:Buffer.alloc(0),error:'not requested',finalUrl:url};
 for(let tryNo=0;tryNo<2;tryNo++){
  try{
   const resp=await fetch(url,{headers:{accept:'application/json,text/html;q=0.8,*/*;q=0.4','user-agent':'VotePredict-public-historical-source-research/1.0'},signal:AbortSignal.timeout(18000)});
   const body=Buffer.from(await resp.arrayBuffer());
   assert.ok(body.length<7000000,'Archive body over max size');
   last={status:resp.status,body,error:null,finalUrl:resp.url,contentType:resp.headers.get('content-type'),attempt:tryNo+1};
   if(tryNo===0&&[429,500,502,503,504].includes(resp.status))continue;
   return last;
  }catch(e){last={status:null,body:Buffer.alloc(0),error:String(e).slice(0,200),finalUrl:url,attempt:tryNo+1};}
 }
 return last;
}
const digestOK=s=>/^[A-Z2-7]{32}$/.test(s);
const iso=t=>t.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z');
function presence(raw,s){
 const visible=originalCampaignVisibleText(raw);
 const text=visible.toLowerCase();
 return {
  personFullNameMentioned:text.includes(task.person.toLowerCase()),
  candidateSpeakerCueMentioned:text.includes(s.candidateSpeakerCue.toLowerCase()),
  candidateSurnameMentioned:text.includes(task.person.split(' ').at(-1).toLowerCase()),
  originalPageVisibleLength:visible.length,
  originalPageVisibleTextPreview:visible.slice(0,2300),
  quoteOrOriginalDateProvenFromCueAlone:false,
  candidateOwnedSiteStatement:false,
  autoAdmittedSenatorDirectQuoteCount:0
 };
}
async function one(s){
 assert.match(s.id,/^[a-z0-9-]{7,60}$/);
 const u=new URL(s.url);assert.ok(['http:','https:'].includes(u.protocol));
 const dt=task.electionDate.replaceAll('-','');
 const params=new URLSearchParams({url:s.url,matchType:'exact',from:'2018',to:dt,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const idx=await get(indexUrl);
 const o={id:s.id,url:s.url,expectedType:s.expectedType,displayedPublisherDate:s.dateDisplayed,topic:s.topic,
  candidateSpeakerCue:s.candidateSpeakerCue,wholeCdxIndexUrl:indexUrl,wholeCdxHttpStatus:idx.status,
  wholeCdxFile:null,wholeCdxSha256:idx.body.length?sha(idx.body):null,validIndexRowCount:0,
  originalBodyDigestMatchedPages:[],status:'not_authenticated',failureReason:idx.error||null};
 if(idx.status!==200){o.failureReason=o.failureReason||'CDX index HTTP '+idx.status;return o;}
 let rows;
 try{
  const value=JSON.parse(idx.body.toString());
  assert.ok(Array.isArray(value)&&value.length&&value.length<=101);
  assert.deepEqual(value[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=value.slice(1);
  o.wholeCdxFile=s.id+'-original-whole-CDX.json';
  writeFileSync(join(out,o.wholeCdxFile),idx.body,{flag:'wx'});
  o.validIndexRowCount=rows.length;
 }catch(e){o.failureReason='Provider HTTP200 returned invalid/non-CDX body: '+String(e).slice(0,170);return o;}
 const acceptable=rows.filter(r=>Array.isArray(r)&&/^\d{14}$/.test(r[0]||'')&&r[0]<dt+'000000'
  &&r[2]==='text/html'&&r[3]==='200'&&digestOK(r[4]));
 acceptable.sort((a,b)=>b[0].localeCompare(a[0]));
 const seen=new Set();
 for(const r of acceptable){
  if(seen.has(r[4]))continue;
  seen.add(r[4]);
  const [timestamp,original,, ,digest]=r;
  for(const mode of ['id_','if_','mp_','']){
   const arch='https://web.archive.org/web/'+timestamp+mode+'/'+original;
   const raw=await get(arch);
   if(raw.status!==200||raw.body.length<100||historicalArchiveSha1Base32(raw.body)!==digest)continue;
   const name=s.id+'-'+timestamp+'-'+(mode||'plain')+'-original.html';
   writeFileSync(join(out,name),raw.body,{flag:'wx'});
   o.originalBodyDigestMatchedPages.push({originalIndexedAtUtc:iso(timestamp),originalUrl:original,originalIndexedSha1Base32:digest,
    originalFullHtmlSha256:sha(raw.body),fullBodyFile:name,replayMode:mode,
    candidateIdentityAndQuotePresence:presence(raw.body,s),
    indexedOriginalFirstPostAuthoredDateCertified:false,
    anyLegislativeVoteIndependentlyCertified:false,
    acceptedQuotesAutomatically:0});
   break;
  }
  if(o.originalBodyDigestMatchedPages.length>=2||seen.size>=5)break;
 }
 o.status=o.originalBodyDigestMatchedPages.length?'original_indexed_whole_HTML_proven_but_quote_requires_independent_scope_audit':'no_qualifying_complete_original';
 o.failureReason=o.originalBodyDigestMatchedPages.length?null:'No pre-election independent indexed SHA1 matched full 200 HTML original (unknown not negative)';
 return o;
}
const results=[];
for(const s of task.sources){
 try{results.push(await one(s));}catch(e){
  results.push({id:s.id,url:s.url,status:'source_provider_error',error:String(e).slice(0,260),originalBodyDigestMatchedPages:[],autoAdmittedQuotes:0});
 }
}
const report={schema:'senate-864-three-sparse-person-publisher-caucus-original-archive-results-v1',
 issue:864,track:group,person:task.person,officialName:actual.officialName,
 originalTargetElection:task.electionYear,originalElectionDate:task.electionDate,
 officialOriginalGovernmentSha256:sha(gov),
 baselineCandidateOwnedSourcePeople:92,baselineCandidateOwnedOriginalShortExcerpts:1285,
 originalSourceQueries:task.sources.length,
 distinctIndexedWholeOriginalPreElectionHTMLSources:results.filter(r=>r.originalBodyDigestMatchedPages.length>0).length,
 independentCandidateNamedDirectSpeechAlreadyAdmitted:0,independentSpeakerScopeStillRequired:true,
 archiveCaptureOnlyNotAuthored:true,sourceCategoryNoOriginalCampaignOwnedSiteCountIncrease:true,
 mutable2026SourceNotBackdated:true,missingOrArchiveErrorNotStatementAbsence:true,
 allOriginalsPreservedOnlyInTemporary30DayArtifacts:true,productionReadsWrites:0,modelOrForecastChanges:0,
 sources:results};
writeFileSync(join(out,'senate-864-'+group+'-original-caucus-and-publisher-pre-election-probes.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('RESEARCH ORIGINAL AUDIT '+JSON.stringify({track:group,person:task.person,totalSources:results.length,
 matchedOriginals:report.distinctIndexedWholeOriginalPreElectionHTMLSources,rows:results.map(r=>({id:r.id,status:r.status,
 index:r.validIndexRowCount||0,matched:r.originalBodyDigestMatchedPages?.length||0,error:r.failureReason||r.error||null}))},null,2));
