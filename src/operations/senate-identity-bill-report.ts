/** Aggregate-only protected production readback; no inferred evidence quality. */
import type { Pool } from 'pg';

interface Breakdown { table:string;session:string;match_method:string;total:number;matched:number }
interface Unresolved { name:string;count:number }
export interface SenateLinkReport {
  byTableAndSession:Breakdown[];
  top50UnresolvedNames:Unresolved[];
  companions:Array<{session:string;result:string;count:number}>;
  inclusions:Array<{session:string;mention_type:string;count:number;with_source_bill:number;with_target_bill:number}>;
  attachmentAssociations:Array<{session:string;captured_files:number;with_bill:number;with_senator:number}>;
}
function toNumber(value:unknown):number {return Number(value??0);}
export async function senateLinkReadback(pool:Pool):Promise<SenateLinkReport>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try{
      const summary=await client.query<{
        table:string;session:string;match_method:string;total:string;matched:string;
      }>(
        "WITH linked AS ("+
        "SELECT 'senate_raw_statements.member' AS tbl,COALESCE(s.slug,'unknown') AS session,"+
        "COALESCE(t.membership_match_method,'unresolved') AS method,t.membership_id AS target "+
        "FROM senate_raw_statements t LEFT JOIN legislative_sessions s ON s.id=t.session_id "+
        "UNION ALL SELECT 'senate_raw_statements.bill',COALESCE(s.slug,'unknown'),"+
        "COALESCE(t.bill_match_method,'unresolved'),t.bill_id "+
        "FROM senate_raw_statements t LEFT JOIN legislative_sessions s ON s.id=t.session_id "+
        "UNION ALL SELECT 'senate_statement_member_mentions',COALESCE(s.slug,'unknown'),"+
        "e.match_method,e.membership_id "+
        "FROM senate_statement_member_mentions e JOIN senate_raw_statements t ON t.id=e.statement_id "+
        "LEFT JOIN legislative_sessions s ON s.id=t.session_id "+
        "UNION ALL SELECT 'senate_statement_bill_mentions',COALESCE(s.slug,'unknown'),"+
        "e.match_method,e.bill_id "+
        "FROM senate_statement_bill_mentions e JOIN senate_raw_statements t ON t.id=e.statement_id "+
        "LEFT JOIN legislative_sessions s ON s.id=t.session_id "+
        "UNION ALL SELECT 'senate_committee_testimony_raw.senator',s.slug,"+
        "COALESCE(t.membership_match_method,'unresolved'),t.membership_id "+
        "FROM senate_committee_testimony_raw t JOIN legislative_sessions s ON s.id=t.session_id "+
        "WHERE t.membership_match_method IS NOT NULL "+
        "UNION ALL SELECT 'senate_committee_testimony_raw.bill',s.slug,"+
        "COALESCE(t.bill_match_method,'unresolved'),t.bill_id "+
        "FROM senate_committee_testimony_raw t JOIN legislative_sessions s ON s.id=t.session_id "+
        "WHERE t.bill_identifier IS NOT NULL "+
        "UNION ALL SELECT 'mn_senate_election_raw_results',"+
        "CASE WHEN election_type='general' AND EXTRACT(YEAR FROM election_date)::int%2=0 "+
        "AND EXTRACT(MONTH FROM election_date)::int>=11 "+
        "THEN (EXTRACT(YEAR FROM election_date)::int+1)::text||'-'||"+
        "(EXTRACT(YEAR FROM election_date)::int+2)::text "+
        "WHEN EXTRACT(YEAR FROM election_date)::int=2020 THEN '2021-2022' "+
        "WHEN EXTRACT(YEAR FROM election_date)::int%2=0 THEN "+
        "(EXTRACT(YEAR FROM election_date)::int-1)::text||'-'||"+
        "EXTRACT(YEAR FROM election_date)::int::text "+
        "ELSE EXTRACT(YEAR FROM election_date)::int::text||'-'||"+
        "(EXTRACT(YEAR FROM election_date)::int+1)::text END,"+
        "COALESCE(membership_match_method,'unresolved'),membership_id "+
        "FROM mn_senate_election_raw_results "+
        "UNION ALL SELECT 'senate_raw_vote_member_mentions',"+
        "COALESCE(d.metadata->'rawPrepassageVotes'->>'sessionSlug','unknown'),"+
        "e.match_method,e.membership_id "+
        "FROM senate_raw_vote_member_mentions e JOIN source_documents d ON d.id=e.source_document_id "+
        "UNION ALL SELECT 'senate_raw_vote_bill_mentions',"+
        "COALESCE(d.metadata->'rawPrepassageVotes'->>'sessionSlug','unknown'),"+
        "e.match_method,e.bill_id "+
        "FROM senate_raw_vote_bill_mentions e JOIN source_documents d ON d.id=e.source_document_id "+
        ") SELECT tbl AS table,session,method AS match_method,count(*)::text AS total,"+
        "count(target)::text AS matched FROM linked "+
        "GROUP BY tbl,session,method ORDER BY tbl,session,method",
      );
      const top=await client.query<{name:string;count:string}>(
        "WITH names AS ("+
        "SELECT printed_name AS name FROM senate_statement_member_mentions "+
        "WHERE match_method='unresolved' "+
        "UNION ALL SELECT witness_name FROM senate_committee_testimony_raw "+
        "WHERE membership_match_method='unresolved' AND witness_name IS NOT NULL "+
        "UNION ALL SELECT candidate_name FROM mn_senate_election_raw_results "+
        "WHERE membership_match_method='unresolved' "+
        "UNION ALL SELECT printed_name FROM senate_raw_vote_member_mentions "+
        "WHERE match_method='unresolved') "+
        "SELECT name,count(*)::text AS count FROM names GROUP BY name "+
        "ORDER BY count(*) DESC,name LIMIT 50",
      );
      const companions=await client.query<{session:string;result:string;count:string}>(
        "SELECT s.slug AS session,scan.result,count(*)::text AS count "+
        "FROM senate_bill_companion_scans scan JOIN legislative_sessions s ON s.id=scan.session_id "+
        "GROUP BY s.slug,scan.result ORDER BY s.slug,scan.result",
      );
      const inclusions=await client.query<{
        session:string;mention_type:string;count:string;with_source_bill:string;with_target_bill:string;
      }>(
        "SELECT s.slug AS session,i.mention_type,count(*)::text AS count,"+
        "count(i.source_bill_id)::text AS with_source_bill,"+
        "count(i.possible_target_bill_id)::text AS with_target_bill "+
        "FROM bill_inclusion_mentions i JOIN legislative_sessions s ON s.id=i.session_id "+
        "GROUP BY s.slug,i.mention_type ORDER BY s.slug,i.mention_type",
      );
      const attachments=await client.query<{
        session:string;captured_files:string;with_bill:string;with_senator:string;
      }>(
        "SELECT s.slug AS session,count(DISTINCT c.id)::text AS captured_files,"+
        "count(DISTINCT c.id) FILTER (WHERE t.bill_id IS NOT NULL)::text AS with_bill,"+
        "count(DISTINCT c.id) FILTER (WHERE t.membership_id IS NOT NULL)::text AS with_senator "+
        "FROM senate_committee_attachment_text_captures c "+
        "JOIN senate_committee_testimony_raw t ON t.source_url=c.source_url "+
        "JOIN legislative_sessions s ON s.id=t.session_id "+
        "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') "+
        "GROUP BY s.slug ORDER BY s.slug",
      );
      return {
        byTableAndSession:summary.rows.map(r=>({
          table:r.table,session:r.session,match_method:r.match_method,
          total:toNumber(r.total),matched:toNumber(r.matched),
        })),
        top50UnresolvedNames:top.rows.map(r=>({name:r.name,count:toNumber(r.count)})),
        companions:companions.rows.map(r=>({session:r.session,result:r.result,count:toNumber(r.count)})),
        inclusions:inclusions.rows.map(r=>({
          session:r.session,mention_type:r.mention_type,count:toNumber(r.count),
          with_source_bill:toNumber(r.with_source_bill),with_target_bill:toNumber(r.with_target_bill),
        })),
        attachmentAssociations:attachments.rows.map(r=>({
          session:r.session,captured_files:toNumber(r.captured_files),
          with_bill:toNumber(r.with_bill),with_senator:toNumber(r.with_senator),
        })),
      };
    }finally{await client.query('ROLLBACK');}
  }finally{client.release(true);}
}
