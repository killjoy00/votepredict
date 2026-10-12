/**
 * Issue #864: pilot original Wayback archive 2020-2022 source IDs for three
 * actually-serving Minnesota state senators not yet represented among 79
 * source-backed firstparty site excerpt people. NO ordinary present-day HTML
 * promoted as historic, no private database or model, no raw archive page saved.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {UNOBSERVED_SENATE_SITE_2022_LEADS,PROBE_ISSUES,
 parseOriginalThreeSenatorCdxResponse} from
 '../src/evidence/senate-three-unobserved-2022-campaign-original-archive.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const params=process.argv.slice(2);
const flag=(key)=>{const i=params.indexOf(key);assert.ok(i>=0&&params[i+1]&&!params[i+1].startsWith('--'));return resolve(params[i+1]);};
const prior=flag('--coverage-json'),out=flag('--out');
assert.ok(out.startsWith(resolve('artifacts')+sep)&&out.endsWith('.json'),'Output must be a JSON artifacts file');
const priorOriginal=readFileSync(prior);
assert.equal(sha(priorOriginal),'a9b6e0345a1b030bde162d83d6b3ab20167ad395ed66aceac8957f6ab11c117a');
const verified=JSON.parse(priorOriginal.toString());
assert.equal(verified.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,79);
assert.equal(verified.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,16);
assert.equal(verified.summary.totalExactResearchExcerptRowsForVerifiedSenators,1006);
const originals=new Map(verified.byActuallyServedSenator.map(p=>[p.officialName,p]));
for(const lead of UNOBSERVED_SENATE_SITE_2022_LEADS){
 const proof=originals.get(lead.officialName);
 assert.ok(proof&&proof.originalSiteQuoteLeadCount===0&&proof.sourceCoverageState==='unobserved_from_selected_research_ledger_not_no_policy',
 'Wrong or already covered original Minnesota LRL senator '+lead.officialName);
 assert.ok(proof.yearsActuallyServed.includes(2023)&&proof.yearsActuallyServed.includes(2024),
 'Actual Senate service 2023-24 must be in pinned official 95 cohort');
}
const agent='VotePredictOriginalMinnesotaHistoricalSenateCampaignArchiveResearch/1.0';
const snooze=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchBounded(url,max=3000000){
 let last={ok:false,status:null,bytes:Buffer.alloc(0),reason:'no_response',finalUrl:null};
 for(let i=0;i<2;i++){
  try{
   const resp=await fetch(url,{headers:{'user-agent':agent},
    redirect:'follow',signal:AbortSignal.timeout(36000)});
   const bytes=Buffer.from(await resp.arrayBuffer());
   if(bytes.length>max)throw Error('unbounded');
   last={ok:resp.ok,status:resp.status,bytes,
    reason:resp.ok?null:'source_http_failure',finalUrl:resp.url};
   if(i===0&&[429,500,502,503,504].includes(resp.status)){await snooze(850);continue;}
   return last;
  }catch(e){
   last={ok:false,status:null,bytes:Buffer.alloc(0),
    reason:'source_transport_or_byte_bound_failure',finalUrl:null};
   if(i===0){await snooze(700);continue;}
  }
 }
 return last;
}
async function run(lead){
 const u=new URL('https://web.archive.org/cdx/search/cdx');
 for(const [key,value] of Object.entries({url:lead.host,matchType:'domain',
  from:'20200101',to:'20221107',output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',collapse:'urlkey',limit:'200'}))u.searchParams.set(key,value);
 const fetched=await fetchBounded(u.toString(),2000000);
 const entry={senator:lead.officialName,sourceIdentity:'true_serving_senator_from_original_95_person_LRL_SHA_receipt',
  campaignSiteDomainLead:lead.host,discoveryBasis:lead.basis,
  boundedCDXQuery:u.toString(),retrievedAtUTC:new Date().toISOString(),
  originalCDXBodySHA256:fetched.bytes.length?sha(fetched.bytes):null,
  sourceCDXHTTPStatus:fetched.status,sourceCDXBodyBytes:fetched.bytes.length,
  cdxIntegrity:'HOLD_unavailable_or_unverified',
  originalCDXTotalQualifiedRows:null,sourceCDXIndexCapped:null,
  originalArchivePages:[],verifiedOriginalHistoricalFirstPartyPageCount:0,
  genuinePreElectionAuthorshipProven:false,actualOriginalPageHadIssueCueProven:false,
  noSiteOrPolicyFromIndexFailureNeverAsserted:true,
  historicArchiveCaptureNotFirstWrittenDate:true,
  historicalSenateSpecificPlatformNotInferredFromOldHouseOrPost2022Site:true,
  noStatementsOrDatabaseEvidenceAutomaticallyPromoted:true};
 if(!fetched.ok){entry.cdxIntegrity='HOLD_no_usable_original_archive_index';return entry;}
 let parsed;
 try{
  parsed=parseOriginalThreeSenatorCdxResponse(JSON.parse(fetched.bytes.toString('utf8')),
   lead.host,lead.cycleLimitExclusive);
 }catch(e){entry.cdxIntegrity='HOLD_invalid_original_archive_index_schema';return entry;}
 entry.cdxIntegrity='original_full_CDX_schema_and_source_SHA_authentic';
 entry.originalCDXTotalQualifiedRows=parsed.allQualifyingOriginalCDXRows;
 entry.sourceCDXIndexCapped=parsed.sourceCDXCapReached;
 for(const p of parsed.selectedRows){
  const replay='https://web.archive.org/web/'+p.timestamp+'id_/'+p.original;
  const x=await fetchBounded(replay,3000000);
  let exactSHA1=false,named=false,issueWords=[];
  if(x.ok&&x.bytes.length>=64&&x.bytes.subarray(0,100).toString('utf8').toLowerCase().includes('<!doctype')||
     x.ok&&x.bytes.length>=64&&x.bytes.subarray(0,500).toString('utf8').toLowerCase().includes('<html')){
    exactSHA1=historicalArchiveSha1Base32(x.bytes)===p.digest;
    if(exactSHA1){
     const txt=originalCampaignVisibleText(x.bytes);
     const surname=lead.officialName.split(/\s+/).at(-1).toLowerCase();
     named=txt.toLowerCase().includes(surname);
     issueWords=[...PROBE_ISSUES].filter(term=>txt.toLowerCase().includes(term));
    }
  }
  if(exactSHA1&&named)entry.verifiedOriginalHistoricalFirstPartyPageCount++;
  entry.originalArchivePages.push({
   sourceOriginalURL:p.original,archiveCapturedUTC:
    p.timestamp.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z'),
   archivedOriginalReplayURL:replay,originalIndexedCDXSHA1Base32:p.digest,
   sourceOriginalReplayedAtUTC:new Date().toISOString(),
   originalFullHtmlSHA256:x.bytes.length?sha(x.bytes):null,originalHtmlByteLength:x.bytes.length,
   originalHTTPStatus:x.status,originalCdxBase32MatchesWholeOriginal:x.ok&&exactSHA1,
   actualServingPersonSurnameInOriginalHTML:exactSHA1&&named,
   originalVisibleIssueTopicCueWords:exactSHA1&&named?issueWords:[],
   actualPreElectionSelfPublishedDateProven:false,
   candidatePaidForAttributionFromThisProbeProven:false,
   humanCheckedExactOriginalExcerpt:false,
   reportSourceResult:exactSHA1&&named?'original_html_identity_proven_separate_policy_excerpt_review_required'
    :'HOLD_no_exact_original_full_HTML_and_candidate_identity',
  });
 }
 entry.actualOriginalPageHadIssueCueProven=entry.originalArchivePages.some(p=>
  p.originalCdxBase32MatchesWholeOriginal&&p.actualServingPersonSurnameInOriginalHTML&&p.originalVisibleIssueTopicCueWords.length>0);
 return entry;
}
const all=[];
for(const lead of UNOBSERVED_SENATE_SITE_2022_LEADS)all.push(await run(lead));
const manifest={schema:'mn-Senate-three-unobserved-2022-historic-firstparty-archive-source-pilot-v1',
 issue:864,sourceObservedUTC:new Date().toISOString(),
 originalIndependentlyVerifiedSenate95Cohort:{originalFullCoverageArtifactURL:'https://github.com/killjoy00/votepredict/actions/runs/38178392306/artifacts/11716621910',
  raw95PersonJsonSHA256:'a9b6e0345a1b030bde162d83d6b3ab20167ad395ed66aceac8957f6ab11c117a',
  governmentSenateDirectorySHA256:'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51',
  actualPeople:95,priorShortExcerptCoveredPeople:79,sourceUnobservedPeople:16},
 selectedOriginalSourceProbes:all,
 summary:{targets:3,originalArchiveIndexesAuthenticated:all.filter(x=>x.cdxIntegrity.startsWith('original_')).length,
  originalHistoricallyCapturedExactCDXSHA1MatchedSenatorNamedPages:all.reduce((n,x)=>n+x.verifiedOriginalHistoricalFirstPartyPageCount,0),
  originalHistoricPolicyExcerptsNewlyHumanVerified:0,sourceSiteAbsenceAsserted:0,
  newlyAdmissible2021To2025ModelSources:0},
 safeguards:{noRawHTMLOrDonorContactsSaved:true,noPublicOfficeContact:true,
  noProductionDatabaseOrForecastModelChanges:true,issue864MustStayOpen:true}
};
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('ORIGINAL_THREE_UNOBSERVED_SITE_CDX_RESEARCH='+JSON.stringify({
 sourceIndexes:manifest.summary.originalArchiveIndexesAuthenticated,
 verifiedOriginalRawHTMLPages:manifest.summary.originalHistoricallyCapturedExactCDXSHA1MatchedSenatorNamedPages,
 counts:all.map(q=>({name:q.senator,originalIndex:q.cdxIntegrity,qualified:q.originalCDXTotalQualifiedRows,
  preElectionNamedExactCDXPages:q.verifiedOriginalHistoricalFirstPartyPageCount,reason:q.cdxIntegrity})),
 noHistoricalPolicyFromHold:true,archiveHistFirstPartyHumanReviewedQuotes:0,
}));
