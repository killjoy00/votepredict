/**
 * #864: website ORIGINAL source acquisition for the last three actual-serving
 * Minnesota Senate candidates without candidate-owned first-party originals.
 * Historic CDC/Wayback source first; separately verified exact whole original
 * CDX SHA1; no archivable HTML body is accepted as a Senate site automatically.
 * The source date means "observed by" not first posting. Governor-site,
 * parking, 2012 publisher and official legislator sites are DISQUALIFIED.
 * ZERO database access, forecast features, model writes or app deployments.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {auditSos2020to2022OriginalGeneralCensus} from '../src/evidence/senate-2020-22-official-general-census.js';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const args=process.argv.slice(2);
const val=k=>{const at=args.indexOf(k);assert.ok(at>=0&&args[at+1]&&!args[at+1].startsWith('--'),'Missing '+k);return resolve(args[at+1]);};
const trackId=args[args.indexOf('--track')+1];
assert.ok(['wiger','tomassoni','bakk'].includes(trackId),'Invalid original senator track');
const out=val('--out-dir');mkdirSync(out,{recursive:true});
function read(p,min=30,max=9_000_000){const f=statSync(p);assert.ok(f.isFile()&&f.size>=min&&f.size<=max,'Missing original fixture '+p);return readFileSync(p);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read(resolve('data/evaluation/senate-864-last-three-campaign-website-original-archive-2020-and-older-leads-v1.json'),1500).toString());
assert.equal(manifest.schema,'senate-864-three-original-campaign-owned-site-gaps-historical-domain-probe-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.productionDatabaseReadsWrites,0);
assert.equal(manifest.baseline.actuallyServed2021to2025,95);
assert.equal(manifest.baseline.candidateOwnedOriginalSitePeople,92);
assert.equal(manifest.baseline.authenticatedSelectedOwnedSiteFragments,1285);
const t=manifest.tracks[trackId];assert.ok(t);
const original=read(val('--official-html'),9000),meta=JSON.parse(read(val('--official-receipt'),300).toString()),swear=read(val('--official-special-swearing-html'),9000);
assert.equal(sha(original),manifest.baseline.officialLRLSenateHtmlSha256);
assert.equal(meta.source.sourceBytesSha256,sha(original));
assert.equal(meta.supplementalSwearingSource.sourceBytesSha256,sha(swear));
const lrl=parseOfficialMnSenateServiceDirectory(original,meta.source.observedAt,swear,meta.supplementalSwearingSource.observedAt);
assert.equal(lrl.senators.length,105);
const person=validateActualSenateServiceForElection(lrl,t.name,t.district,2020);
assert.equal(person.status,'verified_senate_service');assert.equal(person.officialName,t.officialName);
assert.equal(person.serviceForThisElectionFollowingYearVerified,true);
const sosDir=val('--sos-original-dir');
const census=auditSos2020to2022OriginalGeneralCensus(2020,
 read(join(sosDir,'2020-sos-general-stsenate.response'),1000),read(join(sosDir,'2020-sos-general-cand.response'),1000));
assert.equal(census.totals.senateDistricts,67);
assert.equal(census.totals.nonWriteinElectionWinnerCandidates,67);
assert.equal(census.source.originalResultSha256,manifest.baseline.official2020SosSenateSha256);
assert.equal(census.source.originalCandidateLookupSha256,manifest.baseline.official2020SosCandidateLookupSha256);
const result=census.candidates.filter(c=>c.district===t.district&&c.generalOutcome==='winner');
assert.equal(result.length,1);
assert.ok(result[0].candidateName.toLowerCase().includes(t.name.split(' ').at(-1).toLowerCase()),'Not actual official 2020 Senate winner');
const baseline=JSON.parse(read(val('--prior-1285-matrix'),10000).toString());
assert.equal(baseline.summary.actualServingSenators,95);
assert.equal(baseline.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
assert.equal(baseline.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
const prior=baseline.byActuallyServedSenator.find(x=>x.officialName===t.officialName);
assert.ok(prior&&prior.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound===0);
const validSHA1=s=>/^[A-Z2-7]{32}$/.test(s);
let httpQueries=0;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(u,ms=13000,max=6_000_000){
 httpQueries++;
 let last={status:null,body:null,error:'not tried',finalUrl:u};
 try{
  const r=await fetch(u,{headers:{accept:'application/json,text/html;q=0.8,*/*;q=0.2','user-agent':'VotePredict Historical Senate Candidate Original Archive #864 research/1.0'},signal:AbortSignal.timeout(ms)});
  const length=Number(r.headers.get('content-length')||0);
  if(length>max)return {status:r.status,body:null,error:'Provider source above 6MB evidence limit',finalUrl:r.url};
  const b=Buffer.from(await r.arrayBuffer());
  if(b.length>max)return {status:r.status,body:null,error:'Provider whole body above 6MB limit',finalUrl:r.url};
  last={status:r.status,body:b,error:null,finalUrl:r.url,contentType:r.headers.get('content-type')};
 }catch(e){last.error=String(e).slice(0,200);}
 return last;
}
function signals(b){
 const text=originalCampaignVisibleText(b);
 const low=text.toLowerCase();
 const containsFullName=low.includes(t.name.toLowerCase());
 const nickName=(trackId==='wiger'?'chuck wiger':trackId==='bakk'?'tom bakk':'dave tomassoni');
 const containsVariant=low.includes(nickName);
 const senateSpecific=/(state senate|senate district|for (the )?senate|senator)/i.test(text);
 const campaignCommittee=/(prepared (and|&)\s*paid for by|paid for by|campaign committee|friends of|re-elect|re elect)/i.test(text);
 const governorPage=/governor|gubernatorial/i.test(text.slice(0,6500));
 const commercialRepurposed=/(casino|online slot|slot machine|sportsbook|crypto gaming|betting online|jackpot|free spins|betting site)/i.test(text.slice(0,6500));
 const parked=/(domain for sale|buy this domain|namebright|sedoparking|godaddy parking|domain is parked)/i.test(text.slice(0,6500));
 const unrelatedReceiptSpam=/(receipt template|free online printable receipts|author archives: aisya faiha|another wordpress site)/i.test(text.slice(0,6500));
 return {candidateFullNameOrNicknameMentioned:containsFullName||containsVariant,senateOfficeMentioned:senateSpecific,
  campaignPaidForOrCommitteeCue:campaignCommittee,possibleGovernorCampaignNotSenate:governorPage,
  commerciallyRepurposedOrGamblingSite:commercialRepurposed,domainParkingSignals:parked,unrelatedPrintableReceiptOrSeoSpam:unrelatedReceiptSpam,
  originalVisibleLength:text.length,originalVisiblePreview:text.slice(0,1450),
  actualCandidateOwnedWebsiteCertifiedAutomatically:false,
  candidatePolicyQuoteAutocounted:0};
}
const iso=s=>s.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z');
async function runLead(lead){
 assert.match(lead.id,/^[a-z0-9-]{5,70}$/);
 assert.ok(['exact','prefix','domain'].includes(lead.matchType));
 const u=new URL(lead.url);
 assert.ok(['http:','https:'].includes(u.protocol));
 const params=new URLSearchParams({url:lead.url,matchType:lead.matchType,from:manifest.archiveStart,to:manifest.archiveEnd,
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'90'});
 params.append('filter','statuscode:200');
 params.append('filter','mimetype:text/html');
 const idxUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const idx=await get(idxUrl,14000,1_500_000);
 const o={id:lead.id,sourceUrl:lead.url,sourceCategoryHypothesis:lead.sourceClass,sourceReason:lead.reason,
  originalIndexUrl:idxUrl,originalIndexStatus:idx.status,originalIndexSHA256:idx.body?sha(idx.body):null,
  originalIndexFile:null,indexIsTrueOriginalCdx:false,availableOriginalIndexRows:0,
  completeIndependentIndexedOriginalHtmlSources:[],indexOrReplayIssue:idx.error,sourceOwnershipAndOfficeRequiresManualAudit:true,
  noAbsenceClaim:true,acceptedNewOriginalOwnedSiteIssueExcerpts:0};
 if(idx.status!==200||!idx.body)return o;
 let rows=[];
 try{
  const d=JSON.parse(idx.body.toString('utf8'));
  assert.ok(Array.isArray(d)&&d.length&&d.length<=91);
  assert.deepEqual(d[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=d.slice(1);
  o.indexIsTrueOriginalCdx=true;
  o.availableOriginalIndexRows=rows.length;
  o.originalIndexFile=lead.id+'-original-whole-CDX-index.json';
  writeFileSync(join(out,o.originalIndexFile),idx.body,{flag:'wx'});
 }catch(e){o.indexOrReplayIssue='HTTP200 provider returned NON-CDX body '+String(e).slice(0,150);return o;}
 const eligible=rows.filter(r=>/^\d{14}$/.test(r?.[0]||'')&&r[0]<'20201103000000'
  &&r[2]==='text/html'&&r[3]==='200'&&validSHA1(r[4]));
 eligible.sort((a,b)=>b[0].localeCompare(a[0]));
 const seen=new Set();
 for(const r of eligible){
  if(seen.has(r[4])||seen.size>=5||o.completeIndependentIndexedOriginalHtmlSources.length>=2)break;
  seen.add(r[4]);
  for(const mode of ['id_','if_','mp_','']){
   const ur='https://web.archive.org/web/'+r[0]+mode+'/'+r[1];
   await pause(150);
   const f=await get(ur,14000,5_000_000);
   if(f.status!==200||!f.body||f.body.length<=160||historicalArchiveSha1Base32(f.body)!==r[4])continue;
   const bodyname=lead.id+'-'+r[0]+'-'+(mode||'plain')+'-whole-original.html';
   writeFileSync(join(out,bodyname),f.body,{flag:'wx'});
   o.completeIndependentIndexedOriginalHtmlSources.push({originalUrl:r[1],originalCaptureObservedByUtc:iso(r[0]),
     originalWholeHtmlSHA256:sha(f.body),indexedOriginalSHA1Base32:r[4],
     completeOriginalHtmlArtifactName:bodyname,originalIndependentWholeIndexSHA256:sha(idx.body),
     siteOwnershipSignals:signals(f.body),historicalSos2020WinnerAndActualSenateServiceMatched:true,
     originalSourceIsClaimedSiteOnlyUntilExplicitCandidateOwnershipManualAudit:true});
   break;
  }
 }
 if(!o.completeIndependentIndexedOriginalHtmlSources.length)
  o.indexOrReplayIssue=o.indexOrReplayIssue||'No qualifying whole ORIGINAL body digest replay. Unknown, not no campaign site';
 return o;
}
const rows=[];
for(const lead of t.targets){
 try{rows.push(await runLead(lead));}catch(e){rows.push({id:lead.id,sourceUrl:lead.url,error:String(e).slice(0,210),completeIndependentIndexedOriginalHtmlSources:[],acceptedNewOriginalOwnedSiteIssueExcerpts:0});}
}
const report={schema:'senate-864-last-three-original-Senate-candidate-site-authenticity-source-probes-v1',
 issue:864,track:trackId,person:t.name,governmentOriginalOfficialName:person.officialName,
 governmentOriginalSosWinner:result[0].candidateName,year:2020,district:t.district,
 originalLRLOriginalSha256:sha(original),originalSOSOriginalStsenateSha256:census.source.originalResultSha256,
 trueOriginalSos67WinnersReverified:true,sourceBaselineCandidateSitePeople:92,sourceBaselineOriginalWebsiteShortExcerpts:1285,
 sourceOriginalQueries:rows.length,
 trueCdxIndexResponses:rows.filter(x=>x.indexIsTrueOriginalCdx).length,
 wholeOriginalIndexedHTMLRecovered:rows.reduce((a,r)=>a+(r.completeIndependentIndexedOriginalHtmlSources?.length||0),0),
 newlyVerifiedCandidateOwnedSenateSitePeopleAutoAdded:0,newlyVerifiedSitePolicyExcerptsAutoAdded:0,
 originalSiteMayBeOlderCycleAndMustNotBe2020Platform:true,govWebsiteNotCampaignSite:true,publisherCandidateTextNotCampaignSite:true,
 providerErrorOrUnreplayedArchiveIsUnknownNotNegative:true,
 noOriginalFirstAuthoredDateInferred:true,
 historicalArchiveFullHtmlIsCopyrightedNotCommitted:true,
 productionDbReadsWrites:0,modelForecastOrSchedulerChanges:0,
 networkRequests:httpQueries,sources:rows};
writeFileSync(join(out,'senate-864-'+trackId+'-last-three-original-site-source-discovery.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('ORIGINAL CAMPAIGN ARCHIVE LAST THREE '+JSON.stringify({track:trackId,person:t.name,
 original2020SosWinnerAndServiceVerified:true,
 inspected:rows.length,independentlyTrueCdxIndexes:report.trueCdxIndexResponses,
 exactWholeOriginalIndexedHtmlRecovered:report.wholeOriginalIndexedHTMLRecovered,
 byDomain:rows.map(r=>({id:r.id,indexRows:r.availableOriginalIndexRows||0,originalBodies:r.completeIndependentIndexedOriginalHtmlSources?.length||0,
 identity:(r.completeIndependentIndexedOriginalHtmlSources||[]).map(p=>p.siteOwnershipSignals),
 sourceIssue:r.indexOrReplayIssue||r.error||null})),autoAcceptedSenatorWebsites:0,autoAcceptedWebsiteQuotes:0},null,2));
