/** Raw-only, append-only questionnaire snapshot storage; no forecast/evidence writes. */
import type { PoolClient } from 'pg';
import type { CandidateResponse } from '../sources/minnesota/senate-questionnaire-raw.js';
import { normalizeMemberName } from '../sources/minnesota/house-votes.js';

type Link={legislatorId:string|null;membershipId:string|null};
function normalizedParty(raw:string|null):string|null {
  if(!raw)return null;
  const s=raw.toLowerCase().trim();
  if(['dfl','democratic','democrat','democratic-farmer-labor party','democratic-farmer-labor'].includes(s))return 'dfl';
  if(['republican','r','republican party'].includes(s))return 'r';
  if(['independent','i','independence','independent party'].includes(s))return 'i';
  return s;
}
/** Never associate a challenger with the officeholder solely by election district. */
export async function exactExistingSenateMembership(client:PoolClient,record:CandidateResponse):Promise<Link> {
  const normalized=normalizeMemberName(record.candidateName);
  if(!normalized||!record.district)return {legislatorId:null,membershipId:null};
  const cycle=record.electionCycle;
  const session=(cycle-1)+'-'+cycle;
  const rows=await client.query<{
    id:string;legislator_id:string;party:string;name:string;aliases:string[];
  }>([
    'SELECT m.id,m.legislator_id,m.party,l.name,',
    "COALESCE(array_agg(a.source_name) FILTER (WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases",
    'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
    'JOIN legislative_sessions s ON s.id=m.session_id',
    "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
    "JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'",
    'LEFT JOIN membership_source_aliases a ON a.membership_id=m.id',
    'WHERE s.slug=$1 AND m.district=$2 GROUP BY m.id,m.legislator_id,m.party,l.name',
  ].join(' '),[session,record.district]);
  const matching=rows.rows.filter(m=>{
    if(![m.name,...m.aliases].some(v=>normalizeMemberName(v)===normalized))return false;
    const sourceParty=normalizedParty(record.party),officeParty=normalizedParty(m.party);
    return sourceParty===null||sourceParty===officeParty;
  });
  return matching.length===1
    ?{membershipId:matching[0].id,legislatorId:matching[0].legislator_id}
    :{legislatorId:null,membershipId:null};
}
export async function insertQuestionnaire(client:PoolClient,item:CandidateResponse):
Promise<{inserted:boolean;matched:boolean}> {
  if(!item.qa.length||!item.rawContent.length||!item.candidateName)throw Error('Empty raw candidate answer');
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
