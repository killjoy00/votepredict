/** Raw-only, append-only questionnaire snapshot storage; no forecast/evidence writes. */
import type { PoolClient } from 'pg';
import type { CandidateResponse } from '../sources/minnesota/senate-questionnaire-raw.js';
import {resolveSenator,type SenateMember} from './senate-identity-bill-resolvers.js';
import {eligibleSenateQuestionnaireCandidate} from '../sources/minnesota/senate-questionnaire-eligibility.js';

type Link={legislatorId:string|null;membershipId:string|null};
type CandidateIdentity=Pick<CandidateResponse,'candidateName'|'district'|'party'|'electionCycle'>;
function normalizedParty(raw:string|null):string|null {
  if(!raw)return null;
  const s=raw.toLowerCase().trim();
  if(['dfl','d','dem','democratic','democrat','democratic-farmer-labor party','democratic-farmer-labor'].includes(s))return 'dfl';
  if(['republican','r','gop','republican party'].includes(s))return 'r';
  if(['independent','i','independence','independent party'].includes(s))return 'i';
  return s;
}
/** November 2022 general Senate races elect the 2023–2024 roster.
 * Special 2024, 2025 and regular 2026 questionnaires are aligned with their
 * relevant sitting-roster session, never with a candidate-only registry.
 */
export function questionnaireServiceSession(cycle:number):string|null {
  if(cycle===2022||cycle===2024)return '2023-2024';
  if(cycle===2025||cycle===2026)return '2025-2026';
  return null; // Out of owner-requested historical scope.
}
/** Candidate linking is NOT Senate seat attribution: only a uniquely
 * identified existing member can be linked, never a different challenger
 * based on district alone. An unresolved candidate is valid raw evidence.
 */
export async function exactExistingSenateMembership(
  client:PoolClient,record:CandidateIdentity,
):Promise<Link>{
  const session=questionnaireServiceSession(record.electionCycle);
  if(!session||!record.candidateName.trim()||!record.district)
    return {legislatorId:null,membershipId:null};
  const rows=await client.query<{
    id:string;legislator_id:string;party:string|null;name:string;district:string;
    starts_on:string|null;ends_on:string|null;aliases:string[];
  }>([
    'SELECT m.id,m.legislator_id,m.party,l.name,m.district,',
    'm.starts_on::text,m.ends_on::text,',
    "COALESCE(array_agg(DISTINCT a.source_name) FILTER (WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases",
    'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
    'JOIN legislative_sessions s ON s.id=m.session_id',
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'",
    'LEFT JOIN membership_source_aliases a ON a.membership_id=m.id',
    'WHERE s.slug=$1 GROUP BY m.id,m.legislator_id,m.party,l.name,m.district,m.starts_on,m.ends_on',
  ].join(' '),[session]);
  const publisherParty=normalizedParty(record.party);
  const matchingMembers=rows.rows.filter(r=>
    publisherParty===null||normalizedParty(r.party)===publisherParty);
  const roster:SenateMember[]=matchingMembers.map(row=>({
    id:row.id,sessionSlug:session,name:row.name,district:row.district,
    startsOn:row.starts_on,endsOn:row.ends_on,aliases:row.aliases,
  }));
  const resolved=resolveSenator({
    printedName:record.candidateName,sessionSlug:session,district:record.district,
  },roster);
  const exact=matchingMembers.find(m=>m.id===resolved.membershipId);
  return exact?{legislatorId:exact.legislator_id,membershipId:exact.id}:
    {legislatorId:null,membershipId:null};
}
/** Backfill ONLY null questionnaire identity links, with independent
 * existing-membership uniqueness checks. Never mutate source Q&A or 2020.
 * This is a bounded replay, safe if 0022 has already linked some captures.
 */
export async function reconcileUnmatchedQuestionnaireMemberships(
  client:PoolClient,max=15000,
):Promise<{scanned:number;linked:number;remaining:number;skippedHistoricalNonWinners:number}>{
  if(!Number.isInteger(max)||max<1||max>15000)throw Error('Invalid bounded candidate link limit');
  const rows=await client.query<{
    id:string;candidate_name:string;district:string|null;party:string|null;election_cycle:number;
  }>(
    'SELECT id,candidate_name,district,party,election_cycle '+
    'FROM mn_senate_questionnaire_captures '+
    'WHERE membership_id IS NULL AND legislator_id IS NULL '+
    'AND election_cycle=ANY($1::int[]) ORDER BY id LIMIT $2',
    [[2022,2024,2025,2026],max],
  );
  let linked=0,skippedHistoricalNonWinners=0;
  for(const row of rows.rows){
    if(!eligibleSenateQuestionnaireCandidate(row.election_cycle,row.candidate_name,row.district)){
      skippedHistoricalNonWinners++;
      continue;
    }
    const resolved=await exactExistingSenateMembership(client,{
      candidateName:row.candidate_name,district:row.district,
      party:row.party,electionCycle:row.election_cycle,
    });
    if(!resolved.membershipId||!resolved.legislatorId)continue;
    const result=await client.query(
      'UPDATE mn_senate_questionnaire_captures '+
      'SET membership_id=$1,legislator_id=$2 '+
      'WHERE id=$3 AND membership_id IS NULL AND legislator_id IS NULL',
      [resolved.membershipId,resolved.legislatorId,row.id],
    );
    linked+=result.rowCount??0;
  }
  const rem=await client.query<{count:string}>(
    'SELECT COUNT(*)::text AS count FROM mn_senate_questionnaire_captures '+
    'WHERE membership_id IS NULL AND election_cycle=ANY($1::int[])',
    [[2022,2024,2025,2026]],
  );
  return {scanned:rows.rows.length,linked,remaining:Number(rem.rows[0]?.count??0),
    skippedHistoricalNonWinners};
}

export async function insertQuestionnaire(client:PoolClient,item:CandidateResponse):
Promise<{inserted:boolean;matched:boolean}> {
  if(!item.qa.length||!item.rawContent.length||!item.candidateName)throw Error('Empty raw candidate answer');
  // Guard direct API callers as well as the publisher collector. Prior-cycle
  // losing or unconfirmed candidates must not generate new raw captures.
  if(!eligibleSenateQuestionnaireCandidate(item.electionCycle,item.candidateName,item.district))
    throw Error('Questionnaire candidate is outside historical election-winner scope');
  if(item.qa.some((x,i)=>x.ordinal!==i+1||!x.question.trim()||!x.answer.trim()))
    throw Error('Q&A order/content invalid');
  await client.query('BEGIN');
  try{
    // Serialize this candidate/source across concurrent guarded jobs. A full
    // publisher HTML hash may change with page chrome, counters or embeds even
    // when the published Q&A is byte-for-byte identical. Idempotency should
    // distinguish *changed answers*, not unrelated publisher boilerplate.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',
      [item.sourceUrl,item.electionCycle+'|'+item.candidateName],
    );
    const orderedQa=JSON.stringify(item.qa.map(q=>[q.ordinal,q.question,q.answer]));
    const existing=await client.query<{id:string}>([
      'SELECT c.id FROM mn_senate_questionnaire_captures c',
      'WHERE c.source_url=$1 AND c.election_cycle=$2 AND c.candidate_name=$3',
      'AND c.questionnaire_title=$4 AND c.source_kind=$5 AND c.office=$6',
      'AND c.district IS NOT DISTINCT FROM $7::text',
      'AND c.party IS NOT DISTINCT FROM $8::text',
      'AND c.displayed_publication_on IS NOT DISTINCT FROM $9::date',
      'AND c.displayed_submitted_on IS NOT DISTINCT FROM $10::date',
      'AND c.archive_captured_at IS NOT DISTINCT FROM $11::timestamptz',
      'AND (SELECT jsonb_agg(jsonb_build_array(q.question_ordinal,q.question_text,q.answer_text)',
      ' ORDER BY q.question_ordinal) FROM mn_senate_questionnaire_qa q WHERE q.capture_id=c.id)',
      ' = $12::jsonb LIMIT 1',
    ].join(' '),[
      item.sourceUrl,item.electionCycle,item.candidateName,item.title,item.sourceKind,item.office,
      item.district,item.party,item.displayedPublicationOn,item.displayedSubmittedOn,
      item.archiveCapturedAt,orderedQa,
    ]);
    if(existing.rows.length){
      await client.query('COMMIT');
      return {inserted:false,matched:false};
    }
    const match=await exactExistingSenateMembership(client,item);
    const saved=await client.query<{id:string}>([
      'INSERT INTO mn_senate_questionnaire_captures',
      '(source_id,publisher,source_kind,source_url,questionnaire_title,election_cycle,',
      'candidate_name,office,district,party,displayed_publication_on,displayed_submitted_on,',
      'archive_captured_at,fetched_at,content_type,content_sha256,raw_content,legislator_id,membership_id)',
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',
      'ON CONFLICT (source_url,election_cycle,candidate_name,content_sha256) DO NOTHING',
      'RETURNING id',
    ].join(' '),[
      item.sourceId,item.publisher,item.sourceKind,item.sourceUrl,item.title,item.electionCycle,
      item.candidateName,item.office,item.district,item.party,item.displayedPublicationOn,
      item.displayedSubmittedOn,item.archiveCapturedAt,item.fetchedAt,item.contentType,
      item.contentSha256,item.rawContent,match.legislatorId,match.membershipId,
    ]);
    const capture=saved.rows[0]?.id;
    if(capture){
      for(const qa of item.qa){
        await client.query(
          'INSERT INTO mn_senate_questionnaire_qa (capture_id,question_ordinal,question_text,answer_text) VALUES($1,$2,$3,$4)',
          [capture,qa.ordinal,qa.question,qa.answer],
        );
      }
    }
    await client.query('COMMIT');
    return {inserted:!!capture,matched:!!match.membershipId};
  } catch(error){
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * User-relevant readback without deleting the older, immutable raw captures
 * of pre-scope historical nonwinners. Counts are physical versions, not
 * distinct answer-content versions; the original readback remains intact.
 */
export async function questionnaireEligibleScopeReadback(client:PoolClient):Promise<{
  includedCaptures:number;includedQas:number;included2026Captures:number;
  includedHistoricalWinnerCaptures:number;legacyHistoricalExcludedCaptures:number;
  legacyHistoricalExcludedQas:number;
}> {
  const result=await client.query<{
    cycle:number;candidate_name:string;district:string|null;captures:string;pairs:string;
  }>([
    'SELECT c.election_cycle AS cycle,c.candidate_name,c.district,',
    'COUNT(DISTINCT c.id)::text AS captures,COUNT(q.id)::text AS pairs',
    'FROM mn_senate_questionnaire_captures c',
    'LEFT JOIN mn_senate_questionnaire_qa q ON q.capture_id=c.id',
    'GROUP BY c.election_cycle,c.candidate_name,c.district',
  ].join(' '));
  let includedCaptures=0,includedQas=0,included2026Captures=0;
  let includedHistoricalWinnerCaptures=0,legacyHistoricalExcludedCaptures=0,legacyHistoricalExcludedQas=0;
  for(const row of result.rows){
    const captures=Number(row.captures),pairs=Number(row.pairs);
    if(eligibleSenateQuestionnaireCandidate(Number(row.cycle),row.candidate_name,row.district)){
      includedCaptures+=captures;includedQas+=pairs;
      if(Number(row.cycle)===2026)included2026Captures+=captures;
      else includedHistoricalWinnerCaptures+=captures;
    }else{
      legacyHistoricalExcludedCaptures+=captures;
      legacyHistoricalExcludedQas+=pairs;
    }
  }
  return {includedCaptures,includedQas,included2026Captures,
    includedHistoricalWinnerCaptures,legacyHistoricalExcludedCaptures,
    legacyHistoricalExcludedQas};
}

export async function questionnaireReadback(client:PoolClient):Promise<{
  groups:Array<{
    cycle:number;publisher:string;responses:number;qaPairs:number;
    distinctCandidates:number;unmatched:number;missingDates:number;
    uniqueQaVersions:number;uniqueQaPairs:number;repeatQaSnapshots:number;
  }>;
  totals:{
    captures:number;distinctCandidates:number;qaPairs:number;unmatched:number;missingDates:number;
    uniqueQaVersions:number;uniqueQaPairs:number;repeatQaSnapshots:number;
  };
}>{
  const g=await client.query<{
    cycle:number;publisher:string;responses:string;pairs:string;candidates:string;unmatched:string;missing:string;
  }>([
    'SELECT c.election_cycle AS cycle,c.publisher,',
    'COUNT(DISTINCT c.id)::text AS responses,COUNT(q.id)::text AS pairs,',
    'COUNT(DISTINCT c.candidate_name)::text AS candidates,',
    'COUNT(DISTINCT c.id) FILTER (WHERE c.membership_id IS NULL)::text AS unmatched,',
    'COUNT(DISTINCT c.id) FILTER (WHERE c.displayed_publication_on IS NULL)::text AS missing',
    'FROM mn_senate_questionnaire_captures c LEFT JOIN mn_senate_questionnaire_qa q ON q.capture_id=c.id',
    'GROUP BY c.election_cycle,c.publisher ORDER BY c.election_cycle DESC,c.publisher',
  ].join(' '));
  const groups=g.rows.map(r=>({
    cycle:Number(r.cycle),publisher:r.publisher,responses:Number(r.responses),qaPairs:Number(r.pairs),
    distinctCandidates:Number(r.candidates),unmatched:Number(r.unmatched),missingDates:Number(r.missing),
  }));
  const t=await client.query<{captures:string;candidates:string;pairs:string;unmatched:string;missing:string}>([
    'SELECT COUNT(DISTINCT c.id)::text AS captures,',
    "COUNT(DISTINCT (c.election_cycle,c.candidate_name))::text AS candidates,",
    'COUNT(q.id)::text AS pairs,',
    'COUNT(DISTINCT c.id) FILTER(WHERE c.membership_id IS NULL)::text AS unmatched,',
    'COUNT(DISTINCT c.id) FILTER(WHERE c.displayed_publication_on IS NULL)::text AS missing',
    'FROM mn_senate_questionnaire_captures c LEFT JOIN mn_senate_questionnaire_qa q ON q.capture_id=c.id',
  ].join(' '));
  // Legacy snapshots remain intact. Report publisher-page recaptures that
  // reproduce the same ordered Q&A separately from distinct published
  // candidate-answer versions; do not delete historical captures.
  const v=await client.query<{
    cycle:number;publisher:string;versions:string;pairs:string;repeat_snapshots:string;
  }>([
    'WITH snapshots AS (',
    'SELECT c.id,c.election_cycle,c.publisher,c.source_url,c.candidate_name,',
    "COALESCE(jsonb_agg(jsonb_build_array(q.question_ordinal,q.question_text,q.answer_text)",
    "ORDER BY q.question_ordinal) FILTER (WHERE q.id IS NOT NULL),'[]'::jsonb) AS qa,",
    'COUNT(q.id) AS pair_count',
    'FROM mn_senate_questionnaire_captures c',
    'LEFT JOIN mn_senate_questionnaire_qa q ON q.capture_id=c.id GROUP BY c.id',
    '), versions AS (',
    'SELECT election_cycle,publisher,source_url,candidate_name,qa,',
    'MAX(pair_count) AS pair_count,COUNT(*) AS snapshots',
    'FROM snapshots GROUP BY election_cycle,publisher,source_url,candidate_name,qa',
    ') SELECT election_cycle AS cycle,publisher,COUNT(*)::text AS versions,',
    'COALESCE(SUM(pair_count),0)::text AS pairs,',
    'COALESCE(SUM(snapshots-1),0)::text AS repeat_snapshots',
    'FROM versions GROUP BY election_cycle,publisher ORDER BY election_cycle DESC,publisher',
  ].join(' '));
  const logical=new Map(v.rows.map(r=>[
    String(r.cycle)+'|'+r.publisher,
    {uniqueQaVersions:Number(r.versions),uniqueQaPairs:Number(r.pairs),
      repeatQaSnapshots:Number(r.repeat_snapshots)},
  ]));
  const enriched=groups.map(g=>({...g,
    ...(logical.get(g.cycle+'|'+g.publisher)
      ??{uniqueQaVersions:0,uniqueQaPairs:0,repeatQaSnapshots:0}),
  }));
  return {groups:enriched,totals:{
    captures:Number(t.rows[0].captures),distinctCandidates:Number(t.rows[0].candidates),
    qaPairs:Number(t.rows[0].pairs),unmatched:Number(t.rows[0].unmatched),
    missingDates:Number(t.rows[0].missing),
    uniqueQaVersions:enriched.reduce((n,g)=>n+g.uniqueQaVersions,0),
    uniqueQaPairs:enriched.reduce((n,g)=>n+g.uniqueQaPairs,0),
    repeatQaSnapshots:enriched.reduce((n,g)=>n+g.repeatQaSnapshots,0),
  }};
}
