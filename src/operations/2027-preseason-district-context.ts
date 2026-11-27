import type { SosLegislativeResultRow } from '../evidence/minnesota-election-context.js';
import { normalizeMemberName } from '../sources/minnesota/house-votes.js';

export type ProjectedDistrictMember = { seat:string; lrlId:string; electionName:string; party:string; basis:string };
const recountSeats = new Set(['house:32A','senate:4','senate:33']);
const writeIn = (r:SosLegislativeResultRow) => r.party==='WI' || r.candidateOrder===9901 || /^WRITE[- ]?IN$/i.test(r.candidateName);
const safeCount = (n:number) => Number.isSafeInteger(n) && n>=0;

export function reviewPreseasonDistrict(member:ProjectedDistrictMember,rows:readonly SosLegislativeResultRow[]){
  const hold=(reason:string)=>({seat:member.seat,lrlId:member.lrlId,status:'held' as const,reason,servingEligible:false as const,modelWeight:0 as const});
  const [chamber,district]=member.seat.split(':');
  if(!['house','senate'].includes(chamber)||!district||!rows.length) return hold('missing_tally');
  const office=chamber==='house'?'State Representative':'State Senator';
  const total=rows[0].totalVotesForOffice;
  const precincts=rows[0].totalPrecincts;
  if(!safeCount(total)||!total||!safeCount(precincts)||!precincts||
    new Set(rows.map(r=>r.officeId)).size!==1||new Set(rows.map(r=>r.candidateOrder)).size!==rows.length||
    rows.some(r=>r.district!==district||!r.officeName.startsWith(office+' District ')||!safeCount(r.votes)||
      r.totalVotesForOffice!==total||r.precinctsReporting!==precincts||r.totalPrecincts!==precincts)||
    rows.reduce((sum,r)=>sum+r.votes,0)!==total) return hold('invalid_or_incomplete_tally');
  const sorted=[...rows].sort((a,b)=>b.votes-a.votes);
  const leader=sorted[0];
  if(!leader.votes||writeIn(leader)||sorted[1]?.votes===leader.votes) return hold('no_unique_named_leader');
  const leaderName=[leader.candidateName,leader.suffix].filter(Boolean).join(' ');
  if(normalizeMemberName(leaderName)!==normalizeMemberName(member.electionName)||leader.party!==member.party)
    return hold('projected_identity_mismatch');
  // Even previously accepted recount identities need exact final tally evidence.
  if(recountSeats.has(member.seat)||member.basis==='accepted_recount_leader') return hold('separate_recount_tally_required');
  const named=sorted.filter(r=>!writeIn(r));
  const opponent=named[1];
  return {seat:member.seat,lrlId:member.lrlId,status:'reported_tally' as const,reason:null,
    totalVotes:total,leaderVotes:leader.votes,leaderShare:leader.votes/total,
    namedCandidateCount:named.length,uncontested:named.length===1,
    strongestNamedOpponentVotes:opponent?.votes??null,
    namedOpponentMarginVotes:opponent?leader.votes-opponent.votes:null,
    namedOpponentMarginPercentagePoints:opponent?100*(leader.votes-opponent.votes)/total:null,
    writeInVotes:rows.filter(writeIn).reduce((sum,r)=>sum+r.votes,0),
    precinctsReporting:precincts,totalPrecincts:precincts,
    certifiedTallyProved:false as const,servingEligible:false as const,modelWeight:0 as const};
}

export function buildPreseasonDistrictReview(members:readonly ProjectedDistrictMember[],house:readonly SosLegislativeResultRow[],senate:readonly SosLegislativeResultRow[]){
  const expected=Array.from({length:67},(_,i)=>i+1).flatMap(n=>['house:'+n+'A','house:'+n+'B','senate:'+n]);
  const ids=new Set(members.map(m=>m.lrlId));
  const lookup=new Map(members.map(m=>[m.seat,m]));
  if(members.length!==201||ids.size!==201||lookup.size!==201||expected.some(s=>!lookup.has(s)))throw Error('Projected roster coverage mismatch');
  const groups=new Map<string,SosLegislativeResultRow[]>();
  for(const [chamber,rows] of [['house',house],['senate',senate]] as const){
    for(const r of rows){
      const seat=chamber+':'+r.district;
      if(!lookup.has(seat))throw Error('Unexpected legislative district');
      groups.set(seat,[...(groups.get(seat)??[]),r]);
    }
  }
  return expected.map(seat=>reviewPreseasonDistrict(lookup.get(seat)!,groups.get(seat)??[]));
}
