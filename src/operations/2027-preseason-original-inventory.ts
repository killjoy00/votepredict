import {createHash} from 'node:crypto';
import {canonicalPublicUrl} from '@/evidence/public-http';
import {PRESEASON_LIMITS,type PreseasonTarget} from './2027-preseason-evidence-archive';
import {ARCHIVE_MARKER} from './2027-preseason-existing-neon-archive';
export const BASE_ARCHIVE_BATCHES=['initial','pilot-1','pilot-2','pilot-3'] as const;
export const ARCHIVE_BATCHES=[...BASE_ARCHIVE_BATCHES,'education-1','education-2'] as const;
export type ArchiveBatch=(typeof ARCHIVE_BATCHES)[number];
type Person={lrlId:string;seat:string;name:string;electionName:string};
type Receipt={url:string;kind:string;observedAt:string;bodySha256:string;bytes:number;rawBodyRetained:boolean;servingEligible:boolean;completeAnswers?:number};
type Pilot={summary:{rosterSha256:string;attemptedMembers:number;verifiedSourceCount:number};targets:Person[];results:Array<{lrlId:string;seat:string;name:string;evidence:Receipt[]}>};
export function buildFullPreseasonInventory(rosterRaw:string,initial:readonly PreseasonTarget[],first:Pilot,second:Pilot){
  const roster=JSON.parse(rosterRaw) as {session:string;members:Person[]};
  const sha=createHash('sha256').update(rosterRaw).digest('hex');
  if(roster.session!=='2027-2028'||roster.members.length!==201||initial.length!==29||
    new Set(initial.map(t=>t.url)).size!==29||first.summary.rosterSha256!==sha||second.summary.rosterSha256!==sha||
    first.targets.length!==51||new Set(first.targets.map(t=>t.lrlId)).size!==51||second.targets.length!==11||
    first.results.length!==40||second.results.length!==11||first.summary.attemptedMembers!==40||second.summary.attemptedMembers!==11||
    first.summary.verifiedSourceCount!==73||second.summary.verifiedSourceCount!==22)
    throw Error('Frozen preseason inventory manifest mismatch');
  const member=(p:Pick<Person,'lrlId'|'seat'|'name'>)=>{
    const a=roster.members.filter(t=>t.lrlId===p.lrlId&&t.seat===p.seat&&t.name===p.name);
    if(a.length!==1||!first.targets.some(t=>t.lrlId===p.lrlId&&t.seat===p.seat&&t.name===p.name))throw Error('Pilot identity mismatch');
    return a[0];
  };
  for(const p of [...first.targets,...second.targets,...initial])member(p);
  if(initial.some(t=>t.rosterSha256!==sha))throw Error('Initial roster binding mismatch');
  const all=[...first.results,...second.results];
  if(new Set(all.map(m=>m.lrlId)).size!==51||second.results.some(r=>!second.targets.some(t=>t.lrlId===r.lrlId&&t.seat===r.seat)))throw Error('Pilot partition mismatch');
  const prior=new Map(initial.map(t=>[t.url,t.lrlId]));
  const seen=new Set<string>(),extra:Array<PreseasonTarget&{priority:number}>=[];
  for(const result of all){
    const p=member(result);
    for(const e of result.evidence){
      const u=new URL(e.url);
      if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||canonicalPublicUrl(e.url)!==e.url||
        seen.has(e.url)||!/^[a-f0-9]{64}$/.test(e.bodySha256)||!Number.isFinite(Date.parse(e.observedAt))||
        !Number.isInteger(e.bytes)||e.bytes<1||e.bytes>PRESEASON_LIMITS.maxPageBytes||e.rawBodyRetained!==false||e.servingEligible!==false||
        !['housing_questionnaire','campaign_policy','campaign_home'].includes(e.kind)||
        (e.kind==='housing_questionnaire'&&(!/^https:\/\/mhponline\.org\/2026_questionnaire\/[a-z-]+\/$/.test(e.url)||e.completeAnswers!==6)))
        throw Error('Invalid pilot source receipt');
      seen.add(e.url);
      if(prior.has(e.url)){if(prior.get(e.url)!==p.lrlId)throw Error('Conflicting source identity');continue;}
      const housing=e.kind==='housing_questionnaire';
      extra.push({...p,url:e.url,kind:housing?'published_candidate_questionnaire':'candidate_campaign_page',publisher:housing?'Minnesota Housing Partnership':'Candidate campaign',rosterSha256:sha,
        priority:housing?0:e.kind==='campaign_policy'?1:2});
    }
  }
  if(seen.size!==95||extra.length!==87||extra.filter(x=>x.priority===0).length!==18||extra.filter(x=>x.priority===1).length!==26||extra.filter(x=>x.priority===2).length!==43)
    throw Error('Unexpected frozen source counts');
  extra.sort((a,b)=>a.priority-b.priority||Number(a.lrlId)-Number(b.lrlId)||a.url.localeCompare(b.url));
  const clean=extra.map(({priority:_,...target})=>target);
  return {initial:[...initial],'pilot-1':clean.slice(0,29),'pilot-2':clean.slice(29,58),'pilot-3':clean.slice(58)} satisfies Record<(typeof BASE_ARCHIVE_BATCHES)[number],PreseasonTarget[]>;
}
export function selectApprovedArchiveBatch(eventName:string|undefined,event:Record<string,unknown>):ArchiveBatch{
  let value:unknown;
  if(eventName==='workflow_dispatch')value=(event.inputs as {archive_batch?:unknown}|undefined)?.archive_batch??'initial';
  else if(eventName==='push'){
    const message=(event.head_commit as {message?:unknown}|undefined)?.message;
    if(typeof message!=='string'||!message.includes(ARCHIVE_MARKER))throw Error('Archive batch marker absent');
    const markers=message.split(/\r?\n/).filter(line=>line.startsWith('VOTEPREDICT_PRESEASON_BATCH='));
    if(markers.length>1)throw Error('Ambiguous archive batch selection');
    value=markers[0]?.slice('VOTEPREDICT_PRESEASON_BATCH='.length)??'initial';
  }else throw Error('Invalid archive batch event');
  if(!ARCHIVE_BATCHES.includes(value as ArchiveBatch))throw Error('Unknown approved archive batch');
  return value as ArchiveBatch;
}
