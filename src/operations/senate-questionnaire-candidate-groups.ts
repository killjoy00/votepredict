/**
 * Read-only candidate identity grouping for raw Senate questionnaires.
 * Joining questionnaire captures from separate publishers is NOT evidence
 * that a person served in the Senate, nor an election result or forecast.
 * Persisted raw captures and historical loser snapshots remain immutable.
 */
import type {PoolClient} from 'pg';
import {eligibleSenateQuestionnaireCandidate} from '../sources/minnesota/senate-questionnaire-eligibility.js';
import {normalizePrintedSenatorName} from './senate-identity-bill-resolvers.js';

export interface CandidateCaptureIdentity {
  id:string; election_cycle:number; candidate_name:string; district:string|null;
  party:string|null; publisher:string; source_url:string; membership_id:string|null;
  legislator_id:string|null;
}
export interface CandidateGroup {
  key:string;cycle:number;district:string|null;printedNames:string[];
  captures:string[];publishers:string[];membershipId:string|null;legislatorId:string|null;
  state:'member_linked'|'candidate_only'|'missing_district'|'conflicting_party'|'conflicting_membership';
}
function normDistrict(s:string|null):string|null{
  if(!s)return null;
  const m=/^(?:district\s*)?0*([1-9]|[1-5]\d|6[0-7])$/i.exec(s.trim());
  return m?String(Number(m[1])):null;
}
function normParty(s:string|null):string|null{
  if(!s)return null;
  const p=s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(['dfl','d','dem','democrat','democratic','democratic farmer labor',
    'democratic farmer labor party','mn dfl'].includes(p))return 'dfl';
  if(['r','rep','gop','republican','republican party'].includes(p))return 'r';
  if(['i','ind','independent','independent party'].includes(p))return 'independent';
  return p; // Unknown parties never automatically equated to a major party.
}
/** Explicitly documented printed-name equivalences within ONE 2026 Senate race.
 * Do not apply nicknames, near-typos, surname matches or district-only joins. */
function verifiedAlias(cycle:number,district:string,normalized:string):string{
  if(cycle===2026&&district==='2'&&normalized==='dan r rogers')return 'dan rogers';
  if(cycle===2026&&district==='9'&&normalized==='krystyne m knutson')return 'krystyne knutson';
  return normalized;
}
/** Null when a record cannot be grouped safely without inventing a district. */
export function senateQuestionnaireCandidateKey(record:CandidateCaptureIdentity):string|null{
  const district=normDistrict(record.district);
  const raw=normalizePrintedSenatorName(record.candidate_name);
  // Single word names (e.g. a partial alias) may only group when exactly
  // printed. Never infer a missing last name or shared district identity.
  if(!district||!raw)return null;
  return ['mn-senate',record.election_cycle,district,
    verifiedAlias(record.election_cycle,district,raw)].join(':');
}
function groupFor(items:CandidateCaptureIdentity[],key:string,state:CandidateGroup['state']):CandidateGroup{
  const first=items[0];
  const memberIds=[...new Set(items.map(r=>r.membership_id).filter((s):s is string=>!!s))];
  const legIds=[...new Set(items.map(r=>r.legislator_id).filter((s):s is string=>!!s))];
  return {key,cycle:first.election_cycle,district:normDistrict(first.district),
    printedNames:[...new Set(items.map(r=>r.candidate_name))].sort(),
    captures:items.map(r=>r.id).sort(),publishers:[...new Set(items.map(r=>r.publisher))].sort(),
    membershipId:memberIds.length===1?memberIds[0]:null,
    legislatorId:legIds.length===1?legIds[0]:null,
    state};
}
/** Stable raw capture to candidate grouping. Does not alter identity columns.
 * A party disagreement or two linked membership IDs breaks the grouping.
 */
export function groupQuestionnaireCandidates(
  captures:readonly CandidateCaptureIdentity[],
):CandidateGroup[]{
  const bucket=new Map<string,CandidateCaptureIdentity[]>();
  const isolated:CandidateGroup[]=[];
  for(const row of captures){
    if(!eligibleSenateQuestionnaireCandidate(row.election_cycle,row.candidate_name,row.district,row.source_url))continue;
    const key=senateQuestionnaireCandidateKey(row);
    if(!key){
      isolated.push(groupFor([row],'unresolved:'+row.id,'missing_district'));
      continue;
    }
    const group=bucket.get(key)??[];group.push(row);bucket.set(key,group);
  }
  for(const [key,items] of bucket){
    const parties=[...new Set(items.map(r=>normParty(r.party)).filter((x):x is string=>!!x))];
    if(parties.length>1){
      // Conflicting party metadata is not silently collapsed into a candidate.
      // Preserve ambiguous rows independently rather than making false joins.
      for(const row of items)
        isolated.push(groupFor([row],'party-conflict:'+row.id,'conflicting_party'));
      continue;
    }
    const memberships=[...new Set(items.map(r=>r.membership_id).filter(Boolean))];
    const legislators=[...new Set(items.map(r=>r.legislator_id).filter(Boolean))];
    if(memberships.length>1||legislators.length>1){
      for(const row of items)
        isolated.push(groupFor([row],'membership-conflict:'+row.id,'conflicting_membership'));
      continue;
    }
    const linked=memberships.length===1&&legislators.length===1;
    isolated.push(groupFor(items,key,linked?'member_linked':'candidate_only'));
  }
  return isolated.sort((a,b)=>a.key.localeCompare(b.key));
}
export async function senateQuestionnaireCandidateGroupReadback(client:PoolClient,max=15000):Promise<{
  captures:number;candidateGroups:number;memberLinkedGroups:number;candidateOnlyGroups:number;
  missingDistrictGroups:number;conflictGroups:number;multiPublisherGroups:number;
  multiPublisherCaptureCount:number;crossPublisherExamples:Array<{key:string;publishers:string[];names:string[];linked:boolean}>;
}>{
  if(!Number.isInteger(max)||max<1||max>15000)throw Error('Unbounded questionnaire candidate grouping refused');
  const result=await client.query<CandidateCaptureIdentity>(
    'SELECT id::text,election_cycle,candidate_name,district,party,publisher,source_url,'
      +'membership_id::text,legislator_id::text FROM mn_senate_questionnaire_captures '
      +'ORDER BY id LIMIT $1',[max+1]);
  if(result.rows.length>max)throw Error('Candidate raw readback exceeded bounded limit');
  const groups=groupQuestionnaireCandidates(result.rows);
  const multi=groups.filter(g=>g.publishers.length>1);
  return {captures:result.rows.length,candidateGroups:groups.length,
    memberLinkedGroups:groups.filter(g=>g.state==='member_linked').length,
    candidateOnlyGroups:groups.filter(g=>g.state==='candidate_only').length,
    missingDistrictGroups:groups.filter(g=>g.state==='missing_district').length,
    conflictGroups:groups.filter(g=>g.state==='conflicting_party'||g.state==='conflicting_membership').length,
    multiPublisherGroups:multi.length,
    multiPublisherCaptureCount:multi.reduce((n,g)=>n+g.captures.length,0),
    crossPublisherExamples:multi.slice(0,25).map(g=>({key:g.key,publishers:g.publishers,
      names:g.printedNames,linked:g.state==='member_linked'}))};
}
