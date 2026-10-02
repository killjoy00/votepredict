import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES=['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
let secrets:string[]=[];

function mask(value:string){if(value.length>3)console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));}
function safe(error:unknown){
  let message=error instanceof Error?(error.stack??error.message):String(error);
  for(const value of secrets.filter(x=>x.length>3).sort((a,b)=>b.length-a.length))message=message.split(value).join('[redacted]');
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').slice(0,1800);
}
async function chooseDb(env:Record<string,string|undefined>){
  const {Pool}=await import('pg');
  async function works(value:string){
    const p=new Pool({connectionString:value,max:1,connectionTimeoutMillis:8000});
    try{await p.query('select 1');return true;}catch{return false;}finally{await p.end().catch(()=>undefined);}
  }
  for(const key of DATABASE_CANDIDATES){
    const value=env[key]?.trim();
    if(value&&await works(value))return value;
  }
  const secret=env.CRON_SECRET?.trim();
  if(!secret)throw new Error('CRON_SECRET unavailable');
  const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});
  if(!response.ok)throw new Error('Database bridge HTTP '+response.status);
  const value=(await response.text()).trim();
  secrets.push(value);mask(value);
  if(!await works(value))throw new Error('Database bridge returned non-portable URL');
  return value;
}

async function main(){
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if(!envFile)throw new Error('Production env file required');
  const env=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  secrets=Object.entries(env)
    .filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([,value])=>value)
    .filter((value):value is string=>typeof value==='string');
  secrets.forEach(mask);
  process.env.DATABASE_URL=await chooseDb(env);
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const {pool}=await import('../src/lib/db/index.js');
  try{
    const sessionSummary=await pool.query(`
      WITH senate_memberships AS (
        SELECT m.id membership_id,s.slug session_slug
          FROM memberships m
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026')
      ),
      floor AS (
        SELECT ve.session_id,
               count(DISTINCT ve.id)::int events,
               count(DISTINCT ve.id) FILTER (WHERE ve.is_passage)::int passage_events,
               count(DISTINCT ve.id) FILTER (WHERE NOT ve.is_passage)::int nonpassage_events,
               count(DISTINCT ve.id) FILTER (WHERE ve.bill_id IS NULL)::int nonbill_events,
               count(mv.id)::int member_votes,
               count(mv.id) FILTER (WHERE mv.membership_id IS NULL)::int unresolved_member_votes
          FROM vote_events ve
          JOIN source_documents sd ON sd.id=ve.source_document_id
          LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id
         WHERE sd.source_kind='senate_journal_pdf'
         GROUP BY ve.session_id
      ),
      committee AS (
        SELECT ve.session_id,
               count(DISTINCT ve.id)::int events,
               count(DISTINCT ve.id) FILTER (WHERE ve.metadata->>'individualVotesAvailable'='true')::int named_events,
               count(DISTINCT ve.id) FILTER (WHERE ve.metadata->>'individualVotesAvailable'='false')::int count_only_events,
               count(mv.id)::int member_votes,
               count(mv.id) FILTER (WHERE mv.membership_id IS NULL)::int unresolved_member_votes
          FROM vote_events ve
          JOIN source_documents sd ON sd.id=ve.source_document_id
          LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id
         WHERE sd.source_kind='senate_committee_minutes'
         GROUP BY ve.session_id
      ),
      committee_actions AS (
        SELECT sd.session_id,
               count(*)::int items,
               count(*) FILTER (WHERE ei.metadata->>'subtype'='voice_vote')::int voice_vote_actions,
               count(*) FILTER (WHERE ei.metadata->>'subtype'='unanimous_action')::int unanimous_actions,
               count(*) FILTER (WHERE ei.metadata->>'subtype'='motion_result_only')::int result_only_actions
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE sd.source_kind='senate_committee_minutes'
           AND ei.metadata->>'contextType'='senate_committee_action'
         GROUP BY sd.session_id
      ),
      issue_positions AS (
        SELECT m.session_id,
               count(*)::int items,
               count(DISTINCT ei.membership_id)::int memberships,
               count(*) FILTER (WHERE ei.stance='supports')::int supports,
               count(*) FILTER (WHERE ei.stance='opposes')::int opposes,
               count(*) FILTER (WHERE ei.stance='unclear')::int unclear
          FROM evidence_items ei
          JOIN memberships m ON m.id=ei.membership_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate'
           AND ei.metadata->>'contextType'='issue_position'
         GROUP BY m.session_id
      ),
      finance AS (
        SELECT m.session_id,
               count(DISTINCT ei.metadata->>'rowKey')::int itemized_contribution_rows,
               count(DISTINCT ei.membership_id)::int memberships,
               count(DISTINCT CASE
                 WHEN ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL
                 THEN ei.metadata->>'rowKey' END)::int historically_eligible_rows
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN memberships m ON m.id=ei.membership_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate'
           AND ei.metadata->>'subtype'='candidate_contribution_record'
           AND ei.metadata->>'rowKey' IS NOT NULL
           AND sd.source_kind IN ('campaign_finance_candidate_contribution_bulk','campaign_finance_bulk')
         GROUP BY m.session_id
      ),
      remarks AS (
        SELECT m.session_id,
               count(*)::int items,
               count(DISTINCT ei.membership_id)::int memberships
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
          JOIN memberships m ON m.id=ei.membership_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate'
           AND (
             sd.source_kind ILIKE '%caption%'
            OR ei.metadata->>'contextType' IN ('senate_floor_remark','senate_committee_remark')
            OR ei.metadata->>'subtype' ILIKE '%caption%'
           )
         GROUP BY m.session_id
      )
      SELECT s.slug AS "session",
             count(sm.membership_id)::int AS "senateMemberships",
             coalesce(f.events,0)::int AS "floorEvents",
             coalesce(f.passage_events,0)::int AS "floorPassageEvents",
             coalesce(f.nonpassage_events,0)::int AS "floorNonPassageEvents",
             coalesce(f.nonbill_events,0)::int AS "floorNonBillEvents",
             coalesce(f.member_votes,0)::int AS "floorMemberVotes",
             coalesce(f.unresolved_member_votes,0)::int AS "floorUnresolvedMemberVotes",
             coalesce(c.events,0)::int AS "committeeEvents",
             coalesce(c.named_events,0)::int AS "committeeNamedEvents",
             coalesce(c.count_only_events,0)::int AS "committeeCountOnlyEvents",
             coalesce(c.member_votes,0)::int AS "committeeMemberVotes",
             coalesce(c.unresolved_member_votes,0)::int AS "committeeUnresolvedMemberVotes",
             coalesce(ca.items,0)::int AS "committeeActionContextItems",
             coalesce(ca.voice_vote_actions,0)::int AS "committeeVoiceVoteActions",
             coalesce(ca.unanimous_actions,0)::int AS "committeeUnanimousActions",
             coalesce(ca.result_only_actions,0)::int AS "committeeResultOnlyActions",
             coalesce(ip.items,0)::int AS "issuePositionItems",
             coalesce(ip.memberships,0)::int AS "membershipsWithIssuePositions",
             coalesce(ip.supports,0)::int AS "issuePositionSupports",
             coalesce(ip.opposes,0)::int AS "issuePositionOpposes",
             coalesce(ip.unclear,0)::int AS "issuePositionUnclear",
             coalesce(fi.itemized_contribution_rows,0)::int AS "itemizedContributionRows",
             coalesce(fi.memberships,0)::int AS "membershipsWithItemizedContributions",
             coalesce(fi.historically_eligible_rows,0)::int AS "historicallyEligibleContributionRows",
             coalesce(r.items,0)::int AS "captionRemarkItems",
             coalesce(r.memberships,0)::int AS "membershipsWithCaptionRemarks"
        FROM legislative_sessions s
        JOIN senate_memberships sm ON sm.session_slug=s.slug
        LEFT JOIN floor f ON f.session_id=s.id
        LEFT JOIN committee c ON c.session_id=s.id
        LEFT JOIN committee_actions ca ON ca.session_id=s.id
        LEFT JOIN issue_positions ip ON ip.session_id=s.id
        LEFT JOIN finance fi ON fi.session_id=s.id
        LEFT JOIN remarks r ON r.session_id=s.id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
       GROUP BY s.id,s.slug,f.events,f.passage_events,f.nonpassage_events,f.nonbill_events,
                f.member_votes,f.unresolved_member_votes,c.events,c.named_events,c.count_only_events,
                c.member_votes,c.unresolved_member_votes,ca.items,ca.voice_vote_actions,ca.unanimous_actions,
                ca.result_only_actions,ip.items,ip.memberships,ip.supports,ip.opposes,
                ip.unclear,fi.itemized_contribution_rows,fi.memberships,fi.historically_eligible_rows,
                r.items,r.memberships
       ORDER BY s.slug
    `);

    const membershipCoverage=await pool.query(`
      WITH senate_memberships AS (
        SELECT m.id,l.name,s.slug session_slug
          FROM memberships m
          JOIN legislators l ON l.id=m.legislator_id
          JOIN legislative_sessions s ON s.id=m.session_id
          JOIN chambers c ON c.id=m.chamber_id
         WHERE c.slug='senate' AND s.slug IN ('2021-2022','2023-2024','2025-2026')
      ),
      floor AS (
        SELECT mv.membership_id,count(*)::int n
          FROM member_votes mv
          JOIN vote_events ve ON ve.id=mv.vote_event_id
          JOIN source_documents sd ON sd.id=ve.source_document_id
         WHERE sd.source_kind='senate_journal_pdf' AND mv.membership_id IS NOT NULL
         GROUP BY mv.membership_id
      ),
      committee AS (
        SELECT mv.membership_id,count(*)::int n
          FROM member_votes mv
          JOIN vote_events ve ON ve.id=mv.vote_event_id
          JOIN source_documents sd ON sd.id=ve.source_document_id
         WHERE sd.source_kind='senate_committee_minutes' AND mv.membership_id IS NOT NULL
         GROUP BY mv.membership_id
      ),
      issue AS (
        SELECT membership_id,count(*)::int n
          FROM evidence_items
         WHERE metadata->>'contextType'='issue_position' AND membership_id IS NOT NULL
         GROUP BY membership_id
      ),
      finance AS (
        SELECT membership_id,count(DISTINCT metadata->>'rowKey')::int n
          FROM evidence_items
         WHERE metadata->>'subtype'='candidate_contribution_record'
           AND metadata->>'rowKey' IS NOT NULL AND membership_id IS NOT NULL
         GROUP BY membership_id
      ),
      remarks AS (
        SELECT ei.membership_id,count(*)::int n
          FROM evidence_items ei
          JOIN source_documents sd ON sd.id=ei.source_document_id
         WHERE ei.membership_id IS NOT NULL
           AND (
             sd.source_kind ILIKE '%caption%'
             OR ei.metadata->>'contextType' IN ('senate_floor_remark','senate_committee_remark')
             OR ei.metadata->>'subtype' ILIKE '%caption%'
           )
         GROUP BY ei.membership_id
      )
      SELECT sm.session_slug AS "session",
             count(*)::int AS "memberships",
             count(*) FILTER (WHERE coalesce(f.n,0)=0)::int AS "withoutFloorVotes",
             count(*) FILTER (WHERE coalesce(c.n,0)=0)::int AS "withoutCommitteeVotes",
             count(*) FILTER (WHERE coalesce(i.n,0)=0)::int AS "withoutIssuePositions",
             count(*) FILTER (WHERE coalesce(fi.n,0)=0)::int AS "withoutItemizedContributions",
             count(*) FILTER (WHERE coalesce(r.n,0)=0)::int AS "withoutCaptionRemarks"
        FROM senate_memberships sm
        LEFT JOIN floor f ON f.membership_id=sm.id
        LEFT JOIN committee c ON c.membership_id=sm.id
        LEFT JOIN issue i ON i.membership_id=sm.id
        LEFT JOIN finance fi ON fi.membership_id=sm.id
        LEFT JOIN remarks r ON r.membership_id=sm.id
       GROUP BY sm.session_slug
       ORDER BY sm.session_slug
    `);

    const sourceRuns=await pool.query(`
      SELECT source_system AS "sourceSystem",status,scope,started_at AS "startedAt",finished_at AS "finishedAt",
             source_documents AS "sourceDocuments",vote_events AS "voteEvents",member_votes AS "memberVotes",
             unresolved_members AS "unresolvedMembers",metadata
        FROM ingestion_runs
       WHERE source_system IN ('mn_senate_journals','mn_senate_committee_minutes','wayback-public-evidence')
         AND (
           source_system<>'wayback-public-evidence'
           OR metadata->>'selectionPass' IN ('issue-positions-v1','senate-issue-positions-v2','senate-issue-positions-v3')
         )
       ORDER BY started_at DESC
       LIMIT 20
    `);

    console.log(JSON.stringify({
      senatorEvidenceCorpusAudit:{
        sessionSummary:sessionSummary.rows,
        membershipCoverage:membershipCoverage.rows,
        recentSourceRuns:sourceRuns.rows,
        interpretation:{
          readOnly:true,
          sessions:['2021-2022','2023-2024','2025-2026'],
          financeScope:'publicly itemized Senate candidate contribution rows only',
          missingMeans:'unobserved_or_unavailable_not_no_position',
          committeeCountOnlyPolicy:'never fabricate individual senator votes',
          committeeActionPolicy:'voice/unanimous/result-only actions are context only and never member-resolved votes',
          remarksScope:'caption-derived remarks only; current count may be zero until Track D lands',
          productionAction:'none',
        },
      },
    },null,2));
  }finally{
    await pool.end();
  }
}

main().catch(error=>{console.error(safe(error));process.exitCode=1;});
