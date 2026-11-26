import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fetchPublicPage,publicPageMentionsPerson,type PublicPage } from '../src/evidence/public-http.js';
import { MN_SOS_CANDIDATE_RESULTS_URL,parseCampaignSiteFilings,selectCampaignContentLinks } from '../src/evidence/campaign-site-discovery.js';
import { buildLrlSessionSearchUrl,discoverLrlLegislators } from '../src/sources/minnesota/lrl-members.js';
import { getMinnesotaHouseSession } from '../src/sources/minnesota/sessions.js';
import { INCOMING_EVIDENCE_LIMITS as limits,selectIncomingMembers,matchingIncomingFilings,matchingIncomingHousing,parse2026HousingIndex,verifyHousingResponse,policyExcerpt,type IncomingMember } from '../src/evidence/2027-incoming-evidence.js';

const rosterPath='docs/evaluation/source-proof/2027-preseason-roster-20261126.json';
const housingIndex='https://mhponline.org/2026-candidate-housing-questionnaire/';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const receipt=(page:PublicPage)=>({url:page.finalUrl,requestedUrl:page.requestedUrl,observedAt:page.fetchedAt,
  claimedPublicationAt:page.publishedAt??null,bodySha256:page.contentSha256,bytes:page.bytes,title:page.title??null,
  rawBodyRetained:false,availableBeforeObservationProved:false,servingEligible:false});
type Receipt=ReturnType<typeof receipt>;
type Evidence=Receipt&{kind:'campaign_home'|'campaign_policy'|'housing_questionnaire';excerpt?:string;completeAnswers?:number};
const start=Date.now();
let requests=0,bytes=0;
const cache=new Map<string,PublicPage>();
async function get(url:string,registry=false){
  const prior=cache.get(url);if(prior)return prior;
  if(requests>=limits.maxFetches||bytes>=limits.maxRunBytes||Date.now()-start>=limits.maxRunMs)throw Error('PILOT_BUDGET_EXHAUSTED');
  requests++;
  const page=await fetchPublicPage(url,{maxBytes:Math.min(registry?limits.maxRegistryBytes:limits.maxBytesPerPage,limits.maxRunBytes-bytes),
    timeoutMs:limits.requestTimeoutMs,userAgent:'VotePredict/2.0 bounded 2027 public candidate evidence'});
  bytes+=page.bytes;cache.set(url,page);return page;
}
function sameHost(a:string,b:string){return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');}
const errorCode=(error:unknown)=>{
  const msg=error instanceof Error?error.message:'';
  return msg.includes('PILOT_BUDGET')?'PILOT_BUDGET_EXHAUSTED':/HTTP (\d{3})/.test(msg)?'HTTP_'+msg.match(/HTTP (\d{3})/)![1]:
    /private|non-public/i.test(msg)?'NON_PUBLIC_ADDRESS':/timeout|aborted/i.test(msg)?'TIMEOUT':'UNVERIFIED_OR_UNAVAILABLE';
};
async function main(){
  if(process.argv.length!==2||process.env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||process.env.GITHUB_EVENT_NAME!=='pull_request'||
    process.env.GITHUB_HEAD_REF!=='research/2027-incoming-legislator-evidence')throw Error('Run only in dedicated keyless pilot PR');
  const rosterRaw=readFileSync(rosterPath,'utf8');
  const approved=JSON.parse(rosterRaw) as {session:string;complete:boolean;members:IncomingMember[]};
  if(!approved.complete||approved.session!=='2027-2028')throw Error('Approved roster unavailable');
  const registries:Receipt[]=[];
  const failures:Array<{stage:string;seat?:string;url:string;reason:string}>=[];
  const prior:Record<number,Set<string>>={};
  for(const [ordinal,slug] of [[92,'2021-2022'],[93,'2023-2024'],[94,'2025-2026']] as const){
    const url=buildLrlSessionSearchUrl(getMinnesotaHouseSession(slug));
    const page=await get(url,true);
    if(!sameHost(page.finalUrl,url))throw Error('LRL directory redirected outside official host');
    prior[ordinal]=new Set(discoverLrlLegislators(page.rawContent).map(x=>x.lrlId));
    registries.push(receipt(page));
  }
  const targets=selectIncomingMembers(approved.members,prior);
  let filings:ReturnType<typeof parseCampaignSiteFilings>=[];
  let housing:ReturnType<typeof parse2026HousingIndex>=[];
  for(const [kind,url] of [['campaign_registry',MN_SOS_CANDIDATE_RESULTS_URL],['housing_index',housingIndex]] as const){
    try{
      const page=await get(url,true);
      if(!sameHost(page.finalUrl,url))throw Error('Unexpected registry host');
      registries.push(receipt(page));
      if(kind==='campaign_registry'){
        filings=parseCampaignSiteFilings(page.rawContent);
        if(!filings.length)throw Error('No campaign websites parsed');
      }else housing=parse2026HousingIndex(page.rawContent,page.finalUrl);
    }catch(error){failures.push({stage:kind,url,reason:errorCode(error)});}
  }
  const results=[];
  for(const member of targets.slice(0,limits.maxTargets)){
    const evidence:Evidence[]=[];
    const matching=matchingIncomingFilings(member,filings);
    const questionnaires=matchingIncomingHousing(member,housing);
    const result={seat:member.seat,lrlId:member.lrlId,name:member.name,service:member.service,
      campaignRegistryMatches:matching.length,questionnaireIndexMatches:questionnaires.length,evidence};
    if(matching.length===1){
      const url=matching[0].website;
      try{
        const home=await get(url);
        if(!sameHost(home.finalUrl,url)||![member.name,member.electionName].some(name=>publicPageMentionsPerson(home.text,name)))
          throw Error('Campaign home identity unverified');
        evidence.push({...receipt(home),kind:'campaign_home',excerpt:policyExcerpt(home)});
        const policy=selectCampaignContentLinks(home,6).find(link=>/issues?|priorities|platform|policy|positions?/i.test(new URL(link).pathname));
        if(policy&&policy!==home.canonicalUrl){
          try{
            const page=await get(policy);
            if(!sameHost(page.finalUrl,home.finalUrl))throw Error('Policy page redirected away from campaign');
            evidence.push({...receipt(page),kind:'campaign_policy',excerpt:policyExcerpt(page)});
          }catch(error){failures.push({stage:'campaign_policy',seat:member.seat,url:policy,reason:errorCode(error)});}
        }
      }catch(error){failures.push({stage:'campaign_home',seat:member.seat,url,reason:errorCode(error)});}
    }
    if(questionnaires.length===1){
      const link=questionnaires[0];
      try{
        const page=await get(link.url);
        if(page.finalUrl!==link.url&&page.finalUrl.replace(/\/$/,'')!==link.url.replace(/\/$/,''))throw Error('Publisher response URL mismatch');
        evidence.push({...receipt(page),kind:'housing_questionnaire',completeAnswers:verifyHousingResponse(page,member,link)});
      }catch(error){failures.push({stage:'housing_questionnaire',seat:member.seat,url:link.url,reason:errorCode(error)});}
    }
    results.push(result);
  }
  const summary={schemaVersion:'2027-incoming-evidence-pilot-v1',observedAt:new Date().toISOString(),
    rosterPath,rosterSha256:sha(rosterRaw),projectedMembers:201,priorDirectoryCounts:Object.fromEntries(Object.entries(prior).map(([k,v])=>[k,v.size])),
    absentFrom2025_26:targets.length,returningRecent:targets.filter(x=>x.service==='returning').length,
    noRecentService:targets.filter(x=>x.service==='no_recent_service').length,
    targetCounts:{house:targets.filter(x=>x.chamber==='house').length,senate:targets.filter(x=>x.chamber==='senate').length},
    attemptedMembers:results.length,unattemptedMembers:targets.length-results.length,requests,bytes,
    campaignFilingsObserved:filings.length,housingLinksObserved:housing.length,
    membersWithVerifiedSource:results.filter(x=>x.evidence.length>0).length,
    membersWithCampaignSource:results.filter(x=>x.evidence.some(e=>e.kind.startsWith('campaign'))).length,
    membersWithHousingResponses:results.filter(x=>x.evidence.some(e=>e.kind==='housing_questionnaire')).length,
    membersWithPolicyExcerpt:results.filter(x=>x.evidence.some(e=>e.excerpt)).length,
    verifiedSourceCount:results.reduce((n,x)=>n+x.evidence.length,0),failures:failures.length,servingEvidenceCreated:0,productionWrites:0};
  const report={summary,registries,targets,results,failures,limitations:[
    'No recent service means absent from 92nd, 93rd and 94th LRL directories, not proof of never having held office.',
    'All source bodies were observed during this run; publication claims are not independently verified historical availability.',
    'Public-repository report retains URLs, hashes, small policy excerpts and answer counts only, not complete original bodies or private contact fields.',
    'No direction or issue stance is inferred; canonical evidence ingestion requires private raw-body retention and validation.',
    'Unmatched or unavailable source is unknown evidence, not a negative position.',
  ]};
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/2027-incoming-evidence-pilot.json',JSON.stringify(report,null,2)+'\n');
  console.log('INCOMING_EVIDENCE_SUMMARY '+JSON.stringify(summary));
  // Public, bounded metadata only. Transfer exact report to durable repository
  // after reviewing successful output, not private raw source bodies.
  const encoded=Buffer.from(JSON.stringify(report)).toString('base64');
  for(let i=0;i<encoded.length;i+=3000)console.log('INCOMING_EVIDENCE_CHUNK '+i/3000+' '+encoded.slice(i,i+3000));
}
main().catch(error=>{console.error('Incoming evidence pilot failed: '+errorCode(error));process.exitCode=1;});
