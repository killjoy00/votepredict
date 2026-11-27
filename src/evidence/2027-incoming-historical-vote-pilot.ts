import {normalizeMemberName,buildHouseVoteDetailUrl,discoverHouseRegularSessionKey,parseHouseVoteDetailHtml} from '@/sources/minnesota/house-votes';
import {buildLrlSessionSearchUrl,discoverLrlLegislators,parseLrlMembershipDetails} from '@/sources/minnesota/lrl-members';
import type {MinnesotaHouseSession} from '@/sources/minnesota/sessions';
import type {NormalizedVoteEvent} from '@/sources/minnesota/types';

export const OLD_SESSIONS: readonly MinnesotaHouseSession[]=[
  {sessionKey:'239',slug:'2013-2014',name:'88th Legislature (2013-2014)',legislature:88,startsOn:'2013-01-08',endsOn:'2014-12-31',isCurrent:false},
  {sessionKey:'246',slug:'2017-2018',name:'90th Legislature (2017-2018)',legislature:90,startsOn:'2017-01-03',endsOn:'2018-12-31',isCurrent:false},
  {sessionKey:'249',slug:'2019-2020',name:'91st Legislature (2019-2020)',legislature:91,startsOn:'2019-01-08',endsOn:'2020-12-31',isCurrent:false},
];
export const OLD_TARGETS=[
  {lrlId:'15393',surname:'Dorholt',district:'14B',slug:'2013-2014',from:'2013-01-08',through:'2014-12-31'},
  {lrlId:'15496',surname:'Munson',district:'23B',slug:'2017-2018',from:'2018-02-20',through:'2018-12-31'},
  {lrlId:'15496',surname:'Munson',district:'23B',slug:'2019-2020',from:'2019-01-08',through:'2020-12-31'},
  {lrlId:'15524',surname:'Cantrell',district:'56A',slug:'2019-2020',from:'2019-01-08',through:'2020-12-31'},
] as const;
export type HistoricalTarget=(typeof OLD_TARGETS)[number];
export const OLD_VOTE_LIMITS=Object.freeze({billsPerSession:32,requests:72,maxPageBytes:2*1024*1024,maxBytes:32*1024*1024,runMs:5*60*1000});
export function selectHistoricalBills(raw:unknown,limit:number){
  if(!Number.isInteger(limit)||limit<1||limit>OLD_VOTE_LIMITS.billsPerSession||!Array.isArray(raw)||!raw.length||raw.length>10000)throw Error('Invalid historical summary/limit');
  // A regular-session roll-call inventory can also contain resolutions.
  // Count those separately instead of rejecting every bill or silently
  // accepting unknown values. No vote/outcome information drives selection.
  const eligible=new Set<string>();
  const excludedResolutionCounts:Record<string,number>={};
  for(const x of raw){
    if(!x||typeof x.Number!=='string')throw Error('Unexpected historical summary row shape');
    const value=x.Number.replace(/\s+/g,'').toUpperCase();
    const m=/^(HF|SF|HR|SR|HC|SC)(\d{1,5})$/.exec(value);
    if(!m||Number(m[2])<1)throw Error('Unexpected historical summary identifier');
    if(m[1]==='HF'||m[1]==='SF')eligible.add(m[1]+Number(m[2]));
    else excludedResolutionCounts[m[1]]=(excludedResolutionCounts[m[1]]??0)+1;
  }
  const bills=[...eligible].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if(!bills.length)throw Error('Empty historical bill universe');
  const n=Math.min(limit,bills.length);
  const selected=n===1?[bills[0]]:Array.from({length:n},(_,i)=>bills[Math.floor(i*(bills.length-1)/(n-1))]);
  return {universe:bills.length,selected,summaryRows:raw.length,excludedResolutionCounts};
}
export function verifyHistoricalTarget(session:MinnesotaHouseSession,target:HistoricalTarget,registryHtml:string,profileHtml:string){
  if(target.slug!==session.slug)throw Error('Historical target/session mismatch');
  const refs=discoverLrlLegislators(registryHtml);
  if(refs.length<190||refs.length>300)throw Error('Historical LRL roster size unverified');
  const matching=refs.filter(r=>normalizeMemberName(r.displayName).split(' ').includes(normalizeMemberName(target.surname)));
  if(matching.length!==1||matching[0].lrlId!==target.lrlId)throw Error('Historical surname identity is ambiguous');
  const records=parseLrlMembershipDetails({html:profileHtml,session,lrlId:target.lrlId,fallbackName:matching[0].displayName,sourceUrl:matching[0].sourceUrl});
  const term=records.filter(r=>r.chamber==='house'&&r.district===target.district&&r.startsOn&&r.endsOn&&r.startsOn<=target.from&&r.endsOn>=target.through&&(!r.oathOn||r.oathOn<=target.from));
  if(term.length!==1||!normalizeMemberName(term[0].name).split(' ').includes(normalizeMemberName(target.surname)))throw Error('Historical membership term unverified');
  return {target,membershipSourceUrl:matching[0].sourceUrl,registryUrl:buildLrlSessionSearchUrl(session),registryCount:refs.length};
}
export function confirmHistoricalIndex(html:string,session:MinnesotaHouseSession){
  if(discoverHouseRegularSessionKey(html,session.slug)!==session.sessionKey)throw Error('Historical native session key mismatch');
}
export function pickHistoricalNamedVotes(events:readonly NormalizedVoteEvent[],session:MinnesotaHouseSession,bill:string,targets:readonly HistoricalTarget[]){
  const result:{lrlId:string;priorDistrict:string;billIdentifier:string;externalKey:string;occurredOn:string;journalPage:string;voteKind:string;motionText:string;choice:'yea'|'nay';sourceName:string;yeaCount:number;nayCount:number;sourceUrl:string}[]=[];
  const keys=new Set<string>();
  for(const e of events){
    if(e.billIdentifier!==bill||e.sourceUrl!==buildHouseVoteDetailUrl(session.sessionKey,bill)||!e.externalKey.startsWith(session.sessionKey+':'+bill+':')||
      e.occurredOn<session.startsOn||e.occurredOn>session.endsOn||!e.journalPage||keys.has(e.externalKey)||
      e.memberVotes.length!==e.yeaCount+e.nayCount||e.memberVotes.filter(v=>v.choice==='yea').length!==e.yeaCount||
      e.memberVotes.filter(v=>v.choice==='nay').length!==e.nayCount||new Set(e.memberVotes.map(v=>v.normalizedName)).size!==e.memberVotes.length)throw Error('Historical roll scope or tally mismatch');
    keys.add(e.externalKey);
    for(const t of targets){
      if(t.slug!==session.slug||e.occurredOn<t.from||e.occurredOn>t.through)continue;
      const votes=e.memberVotes.filter(v=>v.normalizedName===normalizeMemberName(t.surname));
      if(votes.length>1)throw Error('Duplicate historical named vote');
      if(votes.length!==1||!['yea','nay'].includes(votes[0].choice))continue; // no absence inference
      const v=votes[0];
      result.push({lrlId:t.lrlId,priorDistrict:t.district,billIdentifier:bill,externalKey:e.externalKey,occurredOn:e.occurredOn,journalPage:e.journalPage,
        voteKind:e.voteKind,motionText:e.motionText,choice:v.choice as 'yea'|'nay',sourceName:v.sourceName,yeaCount:e.yeaCount,nayCount:e.nayCount,sourceUrl:e.sourceUrl});
    }
  }
  return result;
}
