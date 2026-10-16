/** Additive, idempotent raw scorecard and election receipts; no model feature writes. */
import type {PoolClient} from 'pg';
import {
  resolveSenator,resolveBill,type SenateMember,type SessionBill,
} from './senate-identity-bill-resolvers.js';
import type {ScorecardCapture} from '../sources/minnesota/senate-scorecard-raw.js';
import type {DistrictResult} from '../sources/minnesota/senate-district-partisanship-raw.js';

export interface ScorecardCatalog {roster:SenateMember[];bills:SessionBill[]}
const SESSION_SLUGS=['2021-2022','2023-2024','2025-2026'];
export async function loadScorecardCatalog(client:PoolClient):Promise<ScorecardCatalog> {
  const people=await client.query<{
    id:string;session_slug:string;name:string;district:string;
    starts_on:string|null;ends_on:string|null;aliases:string[];
  }>(
    "SELECT m.id,s.slug AS session_slug,l.name,m.district,m.starts_on::text,m.ends_on::text,"+
    "coalesce(array_agg(DISTINCT a.source_name) FILTER (WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases "+
    "FROM memberships m JOIN legislative_sessions s ON s.id=m.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate' "+
    "JOIN legislators l ON l.id=m.legislator_id "+
    "LEFT JOIN membership_source_aliases a ON a.membership_id=m.id "+
    "WHERE s.slug=ANY($1::text[]) GROUP BY m.id,s.slug,l.name,m.district,m.starts_on,m.ends_on",
    [SESSION_SLUGS],
  );
  const roster=people.rows.map(p=>({
    id:p.id,sessionSlug:p.session_slug,name:p.name,district:p.district,
    startsOn:p.starts_on,endsOn:p.ends_on,aliases:p.aliases,
  }));
  for(const slug of SESSION_SLUGS)
    if(roster.filter(x=>x.sessionSlug===slug).length<40)throw Error('Missing historical Minnesota Senate roster');
  const bills=await client.query<{id:string;session_slug:string;identifier:string}>(
    "SELECT b.id,s.slug AS session_slug,b.identifier FROM bills b "+
    "JOIN legislative_sessions s ON s.id=b.session_id "+
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' "+
    "WHERE s.slug=ANY($1::text[])",[SESSION_SLUGS]);
  return {roster,bills:bills.rows.map(b=>({
    id:b.id,sessionSlug:b.session_slug,identifier:b.identifier,
  }))};
}
function scorecardSession(year:number,electionCandidate:boolean):string {
  if(electionCandidate&&year===2022)return '2023-2024';
  if(year<=2022)return '2021-2022';
  if(year<=2024)return '2023-2024';
  return '2025-2026';
}
export async function storeRawScorecardCapture(
  client:PoolClient,capture:ScorecardCapture,catalog:ScorecardCatalog,existingOnly=false,
):Promise<{newSnapshot:boolean;entries:number;matchedMembers:number;billPositions:number;
  matchedBills:number;memberVotes:number;linkedMemberVotes:number;linkedVoteBills:number}> {
  await client.query('BEGIN');
  try{
    const before=await client.query<{id:string}>(
      'SELECT id FROM senate_scorecard_snapshots WHERE url=$1 AND group_name=$2 AND year=$3 AND sha256=$4',
      [capture.sourceUrl,capture.source.groupName,capture.source.year,capture.sha256]);
    if(existingOnly&&!before.rows.length)
      throw Error('Saved-only replay cannot create a new publisher snapshot');
    const snap=await client.query<{id:string}>(
      'INSERT INTO senate_scorecard_snapshots '+
      '(url,group_name,year,fetched_at,sha256,content_type,raw_text,published_on) '+
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) '+
      'ON CONFLICT (url,group_name,year,sha256) DO UPDATE SET '+
      'fetched_at=senate_scorecard_snapshots.fetched_at RETURNING id',
      [capture.sourceUrl,capture.source.groupName,capture.source.year,capture.fetchedAt,
        capture.sha256,capture.contentType,capture.rawText,capture.publishedOn]);
    const id=snap.rows[0].id;
    const slug=scorecardSession(capture.source.year,!!capture.source.electionCandidate);
    let linked=0,linkedBills=0,linkedMemberVotes=0,linkedVoteBills=0;
    for(const entry of capture.entries){
      const member=resolveSenator({
        printedName:entry.nameRaw,sessionSlug:slug,district:entry.districtRaw,
        // A candidate's 2022 publication predates their 2023 service term.
        date:undefined,
      },catalog.roster);
      if(member.membershipId)linked++;
      await client.query(
        'INSERT INTO senate_scorecard_entries '+
        '(group_name,year,kind,value_raw,value_numeric,name_raw,district_raw,party_raw,'+
        'membership_id,match_method,snapshot_id,source_url,source_ordinal) '+
        'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) '+
        'ON CONFLICT(snapshot_id,source_ordinal,kind) DO UPDATE SET '+
        'membership_id=COALESCE(senate_scorecard_entries.membership_id,EXCLUDED.membership_id),'+
        'match_method=CASE WHEN senate_scorecard_entries.membership_id IS NULL '+
        'AND EXCLUDED.membership_id IS NOT NULL THEN EXCLUDED.match_method '+
        'ELSE senate_scorecard_entries.match_method END',
        [capture.source.groupName,capture.source.year,entry.kind,entry.valueRaw,
          entry.valueNumeric,entry.nameRaw,entry.districtRaw,entry.partyRaw,
          member.membershipId,member.matchMethod,id,capture.sourceUrl,entry.sourceOrdinal]);
    }
    const billSession=scorecardSession(capture.source.year,false);
    for(const position of capture.positions){
      const bill=resolveBill({printedIdentifier:position.billIdentifierRaw,
        sessionSlug:billSession},catalog.bills);
      if(bill.billId)linkedBills++;
      await client.query(
        'INSERT INTO senate_scorecard_vote_positions '+
        '(group_name,year,bill_identifier_raw,bill_id,group_position_raw,snapshot_id,source_ordinal) '+
        'VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(snapshot_id,source_ordinal) '+
        'DO UPDATE SET bill_id=COALESCE(senate_scorecard_vote_positions.bill_id,EXCLUDED.bill_id)',
        [capture.source.groupName,capture.source.year,position.billIdentifierRaw,
          bill.billId,position.groupPositionRaw,id,position.sourceOrdinal]);
    }
    // Publisher-labeled legislator votes have their own raw table. They are not
    // scores, endorsements, certified rolls, or the group's policy positions.
    for(const vote of capture.memberVotes??[]){
      const year=Number(vote.votedOn.slice(0,4));
      const slug=scorecardSession(year,false);
      const member=resolveSenator({printedName:vote.nameRaw,sessionSlug:slug,
        district:vote.districtRaw,date:vote.votedOn},catalog.roster);
      const bill=resolveBill({printedIdentifier:vote.billIdentifierRaw,
        sessionSlug:slug},catalog.bills);
      if(member.membershipId)linkedMemberVotes++;
      if(bill.billId)linkedVoteBills++;
      await client.query(
        'INSERT INTO senate_scorecard_member_votes_raw '+
        '(snapshot_id,source_url,group_name,vote_year,voted_on,name_raw,district_raw,'+
        'party_raw,bill_identifier_raw,vote_raw,membership_id,match_method,bill_id,source_ordinal) '+
        'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) '+
        'ON CONFLICT(snapshot_id,source_ordinal) DO UPDATE SET '+
        'membership_id=COALESCE(senate_scorecard_member_votes_raw.membership_id,EXCLUDED.membership_id),'+
        'bill_id=COALESCE(senate_scorecard_member_votes_raw.bill_id,EXCLUDED.bill_id),'+
        'match_method=CASE WHEN senate_scorecard_member_votes_raw.membership_id IS NULL '+
        'AND EXCLUDED.membership_id IS NOT NULL THEN EXCLUDED.match_method '+
        'ELSE senate_scorecard_member_votes_raw.match_method END',
        [id,capture.sourceUrl,capture.source.groupName,year,vote.votedOn,
          vote.nameRaw,vote.districtRaw,vote.partyRaw,vote.billIdentifierRaw,
          vote.voteRaw,member.membershipId,member.matchMethod,bill.billId,vote.sourceOrdinal]);
    }
    await client.query('COMMIT');
    return {newSnapshot:!before.rows.length,entries:capture.entries.length,
      matchedMembers:linked,billPositions:capture.positions.length,matchedBills:linkedBills,
      memberVotes:capture.memberVotes?.length??0,linkedMemberVotes,linkedVoteBills};
  }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function storeRawDistrictPartisanship(
  client:PoolClient,result:DistrictResult,
):Promise<number> {
  if(!result.totalsMatch||result.districts!==67||result.rows.length!==67)
    throw Error('Official statewide check required before persisting district votes');
  await client.query('BEGIN');
  try{
    let inserted=0;
    for(const item of result.rows){
      const row=await client.query(
        'INSERT INTO mn_senate_district_partisanship_raw '+
        '(district,district_plan,election_year,office,dem_votes,rep_votes,other_votes,total_votes,'+
        'source,source_url,fetched_at,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) '+
        'ON CONFLICT (district,district_plan,election_year,office,source_url,sha256) DO NOTHING',
        [item.district,item.districtPlan,item.electionYear,item.office,item.demVotes,
          item.repVotes,item.otherVotes,item.totalVotes,item.source,item.sourceUrl,
          item.fetchedAt,item.sha256]);
      inserted+=row.rowCount??0;
    }
    await client.query('COMMIT');
    return inserted;
  }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function scorecardPartisanshipReadback(client:PoolClient):Promise<{
  snapshots:number;entries:number;linkedMembers:number;billPositions:number;linkedBills:number;
  districtRows:number;memberVotes:number;linkedMemberVotes:number;linkedVoteBills:number;
  scoresByGroup:Array<{group_name:string;year:number;snapshots:number;entries:number}>;
  elections:Array<{election_year:number;office:string;district_plan:string;districts:number;rows:number}>;
}> {
  const counts=(await client.query<{
    snapshots:number;entries:number;linked_members:number;
    positions:number;linked_bills:number;districts:number;
    member_votes:number;linked_member_votes:number;linked_vote_bills:number
  }>(
    "SELECT (SELECT count(*)::int FROM senate_scorecard_snapshots) AS snapshots,"+
    "(SELECT count(*)::int FROM senate_scorecard_entries) AS entries,"+
    "(SELECT count(*)::int FROM senate_scorecard_entries WHERE membership_id IS NOT NULL) AS linked_members,"+
    "(SELECT count(*)::int FROM senate_scorecard_vote_positions) AS positions,"+
    "(SELECT count(*)::int FROM senate_scorecard_vote_positions WHERE bill_id IS NOT NULL) AS linked_bills,"+
    "(SELECT count(*)::int FROM mn_senate_district_partisanship_raw) AS districts,"+
    "(SELECT count(*)::int FROM senate_scorecard_member_votes_raw) AS member_votes,"+
    "(SELECT count(*)::int FROM senate_scorecard_member_votes_raw WHERE membership_id IS NOT NULL) AS linked_member_votes,"+
    "(SELECT count(*)::int FROM senate_scorecard_member_votes_raw WHERE bill_id IS NOT NULL) AS linked_vote_bills",
  )).rows[0];
  const groups=await client.query<{group_name:string;year:number;snapshots:number;entries:number}>(
    "SELECT s.group_name,s.year,count(DISTINCT s.id)::int AS snapshots,count(e.id)::int AS entries "+
    "FROM senate_scorecard_snapshots s LEFT JOIN senate_scorecard_entries e ON e.snapshot_id=s.id "+
    "GROUP BY s.group_name,s.year ORDER BY s.group_name,s.year");
  const election=await client.query<{
    election_year:number;office:string;district_plan:string;districts:number;rows:number
  }>(
    "SELECT election_year,office,district_plan,count(DISTINCT district)::int AS districts,"+
    "count(*)::int AS rows FROM mn_senate_district_partisanship_raw "+
    "GROUP BY election_year,office,district_plan ORDER BY election_year,office");
  return {snapshots:counts.snapshots,entries:counts.entries,
    linkedMembers:counts.linked_members,billPositions:counts.positions,linkedBills:counts.linked_bills,
    districtRows:counts.districts,memberVotes:counts.member_votes,
    linkedMemberVotes:counts.linked_member_votes,linkedVoteBills:counts.linked_vote_bills,
    scoresByGroup:groups.rows,elections:election.rows};
}
