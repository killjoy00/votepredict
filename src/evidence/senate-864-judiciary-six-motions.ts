/** Six fixed printed named rolls. No generic parser, ordinal replay or attendance choices. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {RulesSnapshot,RulesStoredEvent} from './senate-864-rules-sf1-source-to-db-parity.js';
import {YEA_SHA,YEA_URL,YEA_DAY,YEA_MOTION_SHA,textSha,type JudiciaryYeaSource} from './senate-864-judiciary-yea-repair.js';
export type MotionFixture={motions:Array<{anchor:string;page:string;literal:string;yea:number;nay:number;choices:Array<{sourceName:string;choice:'yea'|'nay'}>}>;
 recommendationLiteral:string;people:Array<{token:string;headerFullName:string;independentAttendanceName:string}>};
export type MotionEvent=RulesStoredEvent&{is_passage:boolean;metadata:Record<string,unknown>;session_id:string;chamber_id:string;bill_id:string};
export type MotionSnapshot=Omit<RulesSnapshot,'events'>&{events:MotionEvent[]};
export const FIXTURE='tests/fixtures/senate-864-judiciary-six-amendments.json';
export const fixture=()=>JSON.parse(readFileSync(FIXTURE,'utf8')) as MotionFixture;
export const motionKey=(anchor:string)=>'senate-committee-source-v1:'+createHash('sha256').update(JSON.stringify([YEA_SHA,YEA_DAY,'SF3534',anchor])).digest('hex');
const fullKey=(s:string)=>s.toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).filter(t=>t.length>1).join(' ');
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
export function normalizedJudiciaryOriginal(text:string){return text.replace(/8\/14\/24, 2:38 PM\s*Minnesota Senate/g,' ')
 .replace(/https:\/\/goldpages\.senate\.mn\/schedule\/hearing_minutes\.php\?hearing_id=18345&ls=93\s*[12]\/2/g,' ')
 .replace(/-- [12] of 2 --/g,' ').replace(/\s+/g,' ').trim();}
export function validateSixOriginals(minuteText:string,attendanceText:string,source:JudiciaryYeaSource){
 const f=fixture(),n=normalizedJudiciaryOriginal(minuteText),a=attendanceText.replace(/\b[PA]\b/g,'').replace(/\s+/g,' ');
 if(!source.independentOfficeAndFullAliasVerified||textSha(source.roll.motionText)!==YEA_MOTION_SHA||f.motions.length!==6||new Set(f.motions.map(r=>r.anchor)).size!==6)throw Error('Original source/alias gate');
 for(const p of f.people)if(!n.includes('Senator '+p.headerFullName)||!a.includes(p.independentAttendanceName))throw Error('Independent full-name register/header mismatch');
 for(const r of f.motions){
  const sides=r.literal.match(/roll call (\d+)\/(\d+) \(Ayes – (.*?); Nays – (.*?)\), not adopted$/);
  const printed=sides?[...sides[3].split(',').map(sourceName=>({sourceName:sourceName.trim(),choice:'yea'})),...sides[4].split(',').map(sourceName=>({sourceName:sourceName.trim(),choice:'nay'}))]:[];
  if(!sides||Number(sides[1])!==r.yea||Number(sides[2])!==r.nay||JSON.stringify(printed)!==JSON.stringify(r.choices))throw Error('Printed literal choices differ from attestation');
  if(n.split(r.literal).length!==2||r.choices.length!==10||new Set(r.choices.map(c=>c.sourceName)).size!==10||r.choices.filter(c=>c.choice==='yea').length!==r.yea||r.yea+r.nay!==10||!r.literal.endsWith('not adopted'))throw Error('Exact printed amendment/side boundary changed');
 }
 if(n.split(f.recommendationLiteral).length!==2||!n.includes('The oral amendment was not voted on.'))throw Error('Recommendation or exclusion context changed');
 return {fixture:f,source,independentOriginalsVerified:true as const};
}
export function sixMotionsPlan(proof:ReturnType<typeof validateSixOriginals>,s:MotionSnapshot){
 if(s.documents.length>100||s.events.length>300||s.choices.length>3000||s.historicalRoster.length>150||!proof.independentOriginalsVerified||!s.readOnlyTransactionProven||!s.databaseIdentityVerified||!s.completeBoundedSourceEventsFetched||!s.explicitRollbackCompleted)throw Error('Verified bounded snapshot required');
 const docs=s.documents.filter(d=>d.source_url===YEA_URL&&d.content_sha256===YEA_SHA&&d.meeting_date===YEA_DAY&&d.committee_name==='Judiciary and Public Safety');
 if(docs.length!==1||s.documents.filter(d=>d.source_url===YEA_URL||d.content_sha256===YEA_SHA).length!==1)throw Error('Original document identity conflict');
 const doc=docs[0],events=s.events.filter(e=>e.source_document_id===doc.id),f=proof.fixture;
 const report=events.filter(e=>e.bill_identifier==='SF3534'&&e.occurred_on===YEA_DAY&&e.yea_count===6&&e.nay_count===4&&e.passed===true&&e.is_passage===false&&e.committee_vote===true);
 if(report.length!==1||![1,7].includes(events.length))throw Error('Unanchored or partial source event set');
 const recommendation=report[0],legacy=recommendation.vote_kind==='amendment'&&textSha(recommendation.motion_text||'')===YEA_MOTION_SHA;
 const corrected=recommendation.vote_kind==='motion'&&recommendation.motion_text===f.recommendationLiteral&&recommendation.metadata.issue864MotionRepair==='six-judiciary-anchored-v1';
 if(!legacy&&!corrected)throw Error('Existing recommendation identity changed');
 if(corrected&&(recommendation.metadata.modelWeight!==0||recommendation.metadata.sameDayEligible!==false||recommendation.metadata.mechanicallyActionable!==false||recommendation.metadata.availableOn!==YEA_DAY))throw Error('Recommendation timing/serving flags changed');
 const people=new Map<string,string>();
 for(const p of f.people){
  const names=p.token==='Latz'?['Ron Latz','Ronald Steven Latz']:[p.headerFullName];
  const allowed=new Set(names.map(fullKey));
  const matches=s.historicalRoster.filter(r=>[r.name,r.normalizedName||'',...(r.aliases||[])].some(n=>allowed.has(fullKey(n))));
  if(matches.length!==1||!matches[0].startsOn||!matches[0].endsOn||matches[0].startsOn>YEA_DAY||matches[0].endsOn<YEA_DAY)throw Error('Full-name hearing-day identity unresolved');
  people.set(p.token,matches[0].membershipId);
 }
 if(new Set(people.values()).size!==10)throw Error('Ambiguous person map');
 const reportVotes=s.choices.filter(v=>v.vote_event_id===recommendation.id);
 if(reportVotes.length!==10||proof.source.roll.memberVotes.some(v=>{
  const token=v.sourceName==='Latz - Chair'?'Latz':v.sourceName;
  const actual=reportVotes.filter(c=>c.normalized_member_name===v.normalizedName&&c.choice===v.choice&&c.membership_id===people.get(token));return actual.length!==1;
 }))throw Error('Previously verified recommendation choices changed');
 const planned=f.motions.map(r=>({...r,key:motionKey(r.anchor),votes:r.choices.map(c=>({sourceName:c.sourceName,normalizedName:norm(c.sourceName),choice:c.choice,membershipId:people.get(c.sourceName)!}))}));
 if(events.length===7){
  if(!corrected)throw Error('Partial recommendation classification');
  for(const p of planned){const found=events.filter(e=>e.external_key===p.key);
   if(found.length!==1)throw Error('Missing anchored source motion');const e=found[0];
   if(e.occurred_on!==YEA_DAY||e.bill_identifier!=='SF3534'||e.vote_kind!=='amendment'||e.amendment_ref!==p.anchor||e.motion_text!==p.literal||e.yea_count!==p.yea||e.nay_count!==p.nay||e.passed!==false||e.is_passage!==false||e.committee_vote!==true||e.metadata.issue864MotionRepair!=='six-judiciary-anchored-v1'||e.metadata.modelWeight!==0||e.metadata.sameDayEligible!==false||e.metadata.mechanicallyActionable!==false||e.metadata.availableOn!==YEA_DAY||e.metadata.originalPdfSha256!==YEA_SHA)throw Error('Anchored motion flags/source conflict');
   const votes=s.choices.filter(v=>v.vote_event_id===e.id);
   if(votes.length!==10||p.votes.some(v=>votes.filter(c=>c.normalized_member_name===v.normalizedName&&c.choice===v.choice&&c.membership_id===v.membershipId).length!==1))throw Error('Anchored printed choices mismatch');
  }
  return {events:[],recommendation,updateRecommendation:false,sourceId:doc.id,verifiedMotions:7,verifiedChoices:70};
 }
 if(!legacy)throw Error('Unexpected partial repaired state');
 return {events:planned,recommendation,updateRecommendation:true,sourceId:doc.id,verifiedMotions:1,verifiedChoices:10};
}
