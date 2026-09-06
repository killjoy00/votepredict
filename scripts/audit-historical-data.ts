import { Pool } from 'pg';

interface AuditRow {
  session_slug: string;
  chamber_slug: string;
  vote_events: string;
  passage_events: string;
  declared_yeas: string;
  parsed_yeas: string;
  declared_nays: string;
  parsed_nays: string;
  unresolved_members: string;
  out_of_term_members: string;
}

async function main(): Promise<void> {
  const strict=process.argv.slice(2).includes('--strict');
  const connectionString=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
  if(!connectionString) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');
  const pool=new Pool({connectionString,max:1});
  try{
    const result=await pool.query<AuditRow>(`
      WITH vote_member_counts AS (
        SELECT ve.id,
               count(*) FILTER (WHERE mv.choice='yea') AS parsed_yeas,
               count(*) FILTER (WHERE mv.choice='nay') AS parsed_nays,
               count(*) FILTER (WHERE mv.membership_id IS NULL) AS unresolved_members,
               count(*) FILTER (
                 WHERE mv.membership_id IS NOT NULL AND NOT (
                   ve.occurred_on >= COALESCE(m.starts_on,'0001-01-01'::date)
                   AND ve.occurred_on <= COALESCE(m.ends_on,'9999-12-31'::date)
                 )
               ) AS out_of_term_members
          FROM vote_events ve
          LEFT JOIN member_votes mv ON mv.vote_event_id=ve.id
          LEFT JOIN memberships m ON m.id=mv.membership_id
         GROUP BY ve.id
      )
      SELECT s.slug session_slug,c.slug chamber_slug,
             count(*)::text vote_events,
             count(*) FILTER (WHERE ve.is_passage)::text passage_events,
             sum(ve.yea_count)::text declared_yeas,
             sum(vmc.parsed_yeas)::text parsed_yeas,
             sum(ve.nay_count)::text declared_nays,
             sum(vmc.parsed_nays)::text parsed_nays,
             sum(vmc.unresolved_members)::text unresolved_members,
             sum(vmc.out_of_term_members)::text out_of_term_members
        FROM vote_events ve
        JOIN legislative_sessions s ON s.id=ve.session_id
        JOIN chambers c ON c.id=ve.chamber_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
        JOIN vote_member_counts vmc ON vmc.id=ve.id
       GROUP BY s.slug,c.slug
       ORDER BY s.slug,c.slug`);

    let failures=0;
    for(const row of result.rows){
      const yeaMismatch=Number(row.declared_yeas)!==Number(row.parsed_yeas);
      const nayMismatch=Number(row.declared_nays)!==Number(row.parsed_nays);
      const unresolved=Number(row.unresolved_members);
      const outOfTerm=Number(row.out_of_term_members);
      if(yeaMismatch||nayMismatch||unresolved>0||outOfTerm>0) failures+=1;
      console.log(JSON.stringify({
        session:row.session_slug,chamber:row.chamber_slug,voteEvents:Number(row.vote_events),passageEvents:Number(row.passage_events),
        declared:{yeas:Number(row.declared_yeas),nays:Number(row.declared_nays)},parsed:{yeas:Number(row.parsed_yeas),nays:Number(row.parsed_nays)},
        unresolvedMembers:unresolved,outOfTermMembers:outOfTerm,ok:!yeaMismatch&&!nayMismatch&&unresolved===0&&outOfTerm===0
      }));
    }

    const duplicate=await pool.query<{duplicates:string}>(`
      SELECT count(*)::text duplicates FROM (
        SELECT session_id,chamber_id,external_key,count(*) FROM vote_events GROUP BY 1,2,3 HAVING count(*)>1
      ) d`);
    const duplicateCount=Number(duplicate.rows[0]?.duplicates??0);
    if(duplicateCount>0) failures+=1;
    console.log(JSON.stringify({duplicateVoteEvents:duplicateCount}));
    if(strict&&failures>0) process.exitCode=1;
  }finally{await pool.end();}
}

main().catch((error)=>{console.error(error instanceof Error?error.stack??error.message:error);process.exitCode=1;});
