import type {Pool,PoolClient} from 'pg';
import {ballotSignature,compact,hash,PAPER_PARSER,parseJournalPaperActions,rollMatches,type PaperAction} from './senate-vote-paper-parser.js';
import {resolveSenator,type SenateMember} from './senate-identity-bill-resolvers.js';
import {fetchSenateJournal} from '../sources/minnesota/senate-journals.js';
export const HISTORY_SESSIONS=['2021-2022','2023-2024','2025-2026'];
export async function historyRoster(pool:Pool):Promise<SenateMember[]>{
 const r=await pool.query(`SELECT m.id,l.name,s.slug AS "sessionSlug",m.district,m.starts_on::text AS "startsOn",m.ends_on::text AS "endsOn",
  coalesce(array_agg(a.source_name) FILTER(WHERE a.source_name IS NOT NULL),ARRAY[]::text[]) AS aliases
  FROM memberships m JOIN legislators l ON l.id=m.legislator_id JOIN legislative_sessions s ON s.id=m.session_id
  JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' JOIN chambers c ON c.id=m.chamber_id AND c.slug='senate'
  LEFT JOIN membership_source_aliases a ON a.membership_id=m.id WHERE s.slug=ANY($1::text[]) GROUP BY m.id,l.name,s.slug`,[HISTORY_SESSIONS]);
 return r.rows;
}
export interface HistoricalRole {senatorName:string;role:string;committee:string|null;startsOn:string|null;endsOn:string|null;rawContent:string}
/** Dated acts/headers, not tenure inferred from a biennium or a person's testimony. */
export function parseDatedRoleActs(text:string,committee:string|null,journal:boolean):HistoricalRole[]{
 const found:HistoricalRole[]=[];
 const name="([A-ZÀ-ž][A-Za-zÀ-ž'’.-]*(?:\\s+[A-ZÀ-ž][A-Za-zÀ-ž'’.-]*){0,3}?)";
 const add=(n:string,role:string,raw:string)=>found.push({senatorName:compact(n),role,committee:journal?null:committee,startsOn:null,endsOn:null,rawContent:compact(raw)});
 if(journal){
  const head=compact(text);
  for(const m of head.matchAll(new RegExp('(?:Senator\\s+'+name+'\\s+(?:received \\d+ votes of the members of the Senate and )?was (?:duly )?(?:declared )?elected (?:as )?(?:the )?(President(?: Pro Tempore| Pro Tem)?|Co-Presiding Officer)(?: of the Senate)?|declared Senator\\s+'+name+'\\s+(?:duly )?elected (?:as )?(President(?: Pro Tempore| Pro Tem)?)(?: of the Senate)?)','g')))
   add(m[1]??m[3],m[2]??m[4],m[0]);
  for(const m of head.matchAll(new RegExp('Senator '+name+' and Senator '+name+' were duly elected Co-Presiding Officers of the Senate','g'))){
   add(m[1],'Co-Presiding Officer',m[0]);add(m[2],'Co-Presiding Officer',m[0]);
  }
  for(const m of head.matchAll(new RegExp('The Senate (Majority|Minority|DFL|GOP|Republican) Leader is '+name+'(?=\\. |\\.)','g'))){
   const tail=head.slice(m.index!,m.index!+1500),adopted=tail.search(/resolution was adopted/i),failed=tail.search(/motion did not prevail|resolution was not adopted/i);
   if(adopted>=0&&(failed<0||adopted<failed))add(m[2],m[1]+' Leader',m[0]);
  }
 }else if(committee){
  const head=text.slice(0,6000);
  for(const re of [new RegExp('(?:Vice Chair|Chair)\\s*:?\\s+(?:Senator\\s+)?'+name+'(?=\\s*(?:,|\\n|called|convened))','g'),
   new RegExp('Senator\\s+'+name+'\\s*,\\s*(Vice Chair|Chair)\\b','g')])
   for(const m of head.matchAll(re))add(m[1],/Vice Chair/.test(m[0])?'Vice Chair':'Chair',m[0]);
 }
 return [...new Map(found.map(x=>[[x.senatorName,x.role,x.committee].join('|'),x])).values()];
}
export async function storeHistoricalRoles(db:PoolClient|Pool,roster:SenateMember[],input:{sessionId:string;slug:string;sourceUrl:string;body:string;
 originalSha:string;archiveUrl?:string;observedAt?:string;occurredOn?:string;sourceId?:string;payloadSha?:string;kind:'archived_html'|'archived_pdf'|'official_action'|'official_dated_roster';roles:HistoricalRole[]}){
 if(!input.roles.length)return 0;
 const contentSha=hash(input.body),key=hash(JSON.stringify([input.sessionId,input.sourceUrl,input.archiveUrl??null,input.occurredOn??null,contentSha]));
 await db.query(`INSERT INTO senate_role_history_sources(capture_key,session_id,source_document_id,source_payload_sha256,source_url,archive_url,
  original_body_sha256,content_sha256,raw_content,observed_at,occurred_on,source_kind)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(capture_key) DO NOTHING`,
  [key,input.sessionId,input.sourceId??null,input.payloadSha??null,input.sourceUrl,input.archiveUrl??null,input.originalSha,contentSha,input.body,input.observedAt??null,input.occurredOn??null,input.kind]);
 const id=(await db.query('SELECT id FROM senate_role_history_sources WHERE capture_key=$1',[key])).rows[0].id;
 const rows=input.roles.map((r,i)=>({...r,ordinal:i,member:resolveSenator({printedName:r.senatorName,sessionSlug:input.slug,
  date:input.occurredOn??input.observedAt?.slice(0,10)??null},roster).membershipId}));
 await db.query(`INSERT INTO senate_role_history_items(source_id,source_ordinal,membership_id,senator_name,role,committee,starts_on,ends_on,raw_content)
  SELECT $1,v.ordinal,v.member,v."senatorName",v.role,v.committee,v."startsOn",v."endsOn",v."rawContent"
  FROM jsonb_to_recordset($2::jsonb) v(ordinal integer,member uuid,"senatorName" text,role text,committee text,"startsOn" date,"endsOn" date,"rawContent" text)
  ON CONFLICT(source_id,source_ordinal) DO NOTHING`,[id,JSON.stringify(rows)]);
 return rows.length;
}

export async function backfillVotePapers(pool:Pool,max=500){
 if(!Number.isInteger(max)||max<1||max>1000)throw Error('Invalid paper source batch');
 const roster=await historyRoster(pool);
 const bills=(await pool.query(`SELECT b.id,b.identifier,s.slug FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
  JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn' WHERE s.slug=ANY($1::text[])`,[HISTORY_SESSIONS])).rows;
 const byBill=new Map(bills.map(b=>[b.slug+':'+b.identifier,b.id]));
 const docs=(await pool.query(`SELECT d.id,d.session_id,d.source_url,d.content_sha256,d.fetched_at,s.slug,d.metadata->'rawPrepassageVotes' AS raw,
  encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex') AS payload_sha
  FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
  LEFT JOIN senate_vote_paper_scans scan ON scan.source_document_id=d.id
  WHERE s.slug=ANY($1::text[]) AND d.metadata#>>'{rawPrepassageVotes,sourceType}' IN
  ('mn_senate_journal','mn_senate_committee_minutes_html','mn_senate_committee_minutes_pdf')
  AND (scan.parser_version IS DISTINCT FROM $2 OR scan.source_payload_sha256 IS DISTINCT FROM
  encode(sha256(convert_to((d.metadata->'rawPrepassageVotes')::text,'UTF8')),'hex'))
  ORDER BY CASE WHEN d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal' THEN 0 ELSE 1 END,s.slug,d.id LIMIT $3`,[HISTORY_SESSIONS,PAPER_PARSER,max])).rows;
 const summary={documents:0,actions:0,proposalTexts:0,rawLinks:0,officialLinks:0,roleFacts:0,ambiguousActions:0,heldSources:0};
 for(const d of docs){
  const text=typeof d.raw?.text==='string'?d.raw.text:'';
  const date=d.raw?.sourceDate,parsedDate=new Date((date??'')+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||!Number.isFinite(parsedDate.valueOf())||parsedDate.toISOString().slice(0,10)!==date||!text){
   await pool.query(`INSERT INTO senate_vote_paper_scans(source_document_id,source_payload_sha256,parser_version,actions,failure_kind)
    VALUES($1,$2,$3,0,'missing_or_invalid_source_date_or_text') ON CONFLICT(source_document_id) DO UPDATE SET
    source_payload_sha256=EXCLUDED.source_payload_sha256,parser_version=EXCLUDED.parser_version,actions=0,failure_kind=EXCLUDED.failure_kind,scanned_at=now()`,[d.id,d.payload_sha,PAPER_PARSER]);
   summary.documents++;summary.heldSources++;continue;
  }
  const journal=d.raw.sourceType==='mn_senate_journal';
  const names=roster.filter(m=>m.sessionSlug===d.slug).flatMap(m=>[m.name,...(m.aliases??[]),m.name.split(' ').at(-1)!]);
  const actions=journal?parseJournalPaperActions(text,[...new Set(names)]).filter(a=>byBill.has(d.slug+':'+a.billIdentifier)):[];
  const records=(Array.isArray(d.raw.records)?d.raw.records:[]).filter((r:unknown)=>!!r&&typeof r==='object'&&!Array.isArray(r));
  const committee=d.raw.hearing?.committeeName??d.raw.committeeName??records.find((r:{committee?:string})=>r.committee)?.committee??null;
  const roles=parseDatedRoleActs(text,committee,journal);
  const db=await pool.connect();
  try{
   await db.query('BEGIN');
   const proposalRows=actions.filter(a=>a.proposedText).map(a=>({bill:byBill.get(d.slug+':'+a.billIdentifier),locator:`paper-v1:char:${a.start}-${a.end}`,
    text:a.proposedText,sha:hash(a.proposedText!),label:a.motionText.slice(0,200)}));
   if(proposalRows.length)await db.query(`INSERT INTO senate_official_bill_text_captures(session_id,bill_id,source_document_id,family,source_url,source_locator,
    printed_label,raw_text,original_body_sha256,body_hash_provenance,extracted_text_sha256,fetched_at,proceeding_on)
    SELECT $1,v.bill,$2,'amendment',$3,v.locator,v.label,v.text,$4,'existing_source_document_fingerprint',v.sha,$5,$6
    FROM jsonb_to_recordset($7::jsonb) v(bill uuid,locator text,label text,text text,sha text)
    ON CONFLICT(source_url,source_locator,original_body_sha256,extracted_text_sha256) DO NOTHING`,
    [d.session_id,d.id,d.source_url,d.content_sha256,d.fetched_at,date,JSON.stringify(proposalRows)]);
   const captures=(await db.query('SELECT id,source_locator FROM senate_official_bill_text_captures WHERE source_document_id=$1 AND original_body_sha256=$2',[d.id,d.content_sha256])).rows;
   const captureByLocator=new Map(captures.map(c=>[c.source_locator,c.id]));
   if(actions.length)await db.query(`INSERT INTO senate_vote_paper_actions(source_document_id,source_payload_sha256,parser_version,action_key,sequence,
    source_start,source_end,bill_id,occurred_on,kind,motion_text,question_text,proposed_text,proposal_capture_id,explicit_base_locator,outcome,prior_adopted_action_keys,yea_count,nay_count,ballot_sha256)
    SELECT $1,$2,$3,v.key,v.sequence,v.start,v."end",v.bill,$5::date,v.kind,v.motion,v.question,v.proposal,v.capture,v.base,v.outcome,v.prior,v.yeas,v.nays,v.ballot
    FROM jsonb_to_recordset($4::jsonb) v(key text,sequence integer,start integer,"end" integer,bill uuid,kind text,motion text,question text,proposal text,capture uuid,base text,outcome text,prior jsonb,yeas integer,nays integer,ballot text)
    ON CONFLICT(source_document_id,source_payload_sha256,parser_version,action_key) DO NOTHING`,[d.id,d.payload_sha,PAPER_PARSER,JSON.stringify(actions.map(a=>({
     key:a.key,sequence:a.sequence,start:a.start,end:a.end,bill:byBill.get(d.slug+':'+a.billIdentifier),kind:a.kind,motion:a.motionText,question:a.questionText,
     proposal:a.proposedText,capture:captureByLocator.get(`paper-v1:char:${a.start}-${a.end}`)??null,base:a.baseLocator,outcome:a.outcome,prior:a.priorAdoptedKeys,yeas:a.yeas,nays:a.nays,ballot:a.ballotSignature}))),date ]);
   const stored=(await db.query('SELECT id,action_key FROM senate_vote_paper_actions WHERE source_document_id=$1 AND source_payload_sha256=$2 AND parser_version=$3',[d.id,d.payload_sha,PAPER_PARSER])).rows;
   const ids=new Map(stored.map(a=>[a.action_key,a.id]));
   const raw=records.filter((r:{ordinal?:number})=>Number.isInteger(r.ordinal)&&r.ordinal!>0).map((r:Record<string,unknown>)=>({...r,
    yeas:r.yeaCount,nays:r.nayCount,ballotSignature:ballotSignature((r.memberVotes??[]) as {name:string;choice:string}[],Number(r.yeaCount),Number(r.nayCount))}));
   const official=(await db.query(`SELECT v.id,b.identifier AS "billIdentifier",v.motion_text AS "motionText",v.yea_count AS yeas,v.nay_count AS nays,
    senate_vote_paper_event_fingerprint(v.id) AS fingerprint,
    coalesce((SELECT jsonb_agg(jsonb_build_object('name',m.source_member_name,'choice',m.choice)) FROM member_votes m WHERE m.vote_event_id=v.id),'[]'::jsonb) AS votes
    FROM vote_events v JOIN bills b ON b.id=v.bill_id JOIN source_documents original ON original.id=v.source_document_id
    WHERE original.source_url=$1 AND v.occurred_on=$2 AND v.session_id=$3`,[d.source_url,date,d.session_id])).rows
    .map(r=>({...r,ballotSignature:ballotSignature(r.votes,r.yeas,r.nays)}));
   const rawEdges:unknown[]=[],officialEdges:unknown[]=[];
   for(const a of actions){
    const rawMatches=raw.filter((r:Parameters<typeof rollMatches>[1])=>rollMatches(a,r));
    if(rawMatches.length===1&&actions.filter(x=>rollMatches(x,rawMatches[0])).length===1)rawEdges.push({action:ids.get(a.key),ordinal:rawMatches[0].ordinal});
    else if(rawMatches.length>1)summary.ambiguousActions++;
    const officialMatches=official.filter(r=>rollMatches(a,r));
    if(officialMatches.length===1&&actions.filter(x=>rollMatches(x,officialMatches[0])).length===1)officialEdges.push({action:ids.get(a.key),event:officialMatches[0].id,fingerprint:officialMatches[0].fingerprint});
   }
   if(rawEdges.length)await db.query(`INSERT INTO senate_vote_paper_raw_links(action_id,record_ordinal,method)
    SELECT v.action,v.ordinal,'unique_question_full_ballot' FROM jsonb_to_recordset($1::jsonb) v(action uuid,ordinal integer) ON CONFLICT DO NOTHING`,[JSON.stringify(rawEdges)]);
   if(officialEdges.length)await db.query(`INSERT INTO senate_vote_paper_event_links(action_id,vote_event_id,vote_identity_sha256,method)
    SELECT v.action,v.event,v.fingerprint,'unique_question_full_ballot' FROM jsonb_to_recordset($1::jsonb) v(action uuid,event uuid,fingerprint text) ON CONFLICT DO NOTHING`,[JSON.stringify(officialEdges)]);
   summary.roleFacts+=await storeHistoricalRoles(db,roster,{sessionId:d.session_id,slug:d.slug,sourceUrl:d.source_url,body:text,originalSha:d.content_sha256,
    occurredOn:date,sourceId:d.id,payloadSha:d.payload_sha,kind:'official_action',roles});
   await db.query(`INSERT INTO senate_vote_paper_scans(source_document_id,source_payload_sha256,parser_version,actions)
    SELECT id,$2::text,$3,$4 FROM source_documents WHERE id=$1 AND encode(sha256(convert_to((metadata->'rawPrepassageVotes')::text,'UTF8')),'hex')=$2::text
    ON CONFLICT(source_document_id) DO UPDATE SET source_payload_sha256=EXCLUDED.source_payload_sha256,parser_version=EXCLUDED.parser_version,actions=EXCLUDED.actions,failure_kind=NULL,scanned_at=now()`,[d.id,d.payload_sha,PAPER_PARSER,actions.length]);
   await db.query('COMMIT');summary.documents++;summary.actions+=actions.length;summary.proposalTexts+=proposalRows.length;summary.rawLinks+=rawEdges.length;summary.officialLinks+=officialEdges.length;
  }catch(error){await db.query('ROLLBACK');throw error}finally{db.release();}
 }
 return summary;
}

export async function verifyPaperSources(pool:Pool,max=9,fetcher=fetchSenateJournal,options:{budgetMs?:number}={}){
 const budgetMs=options.budgetMs??600000;
 if(!Number.isInteger(max)||max<1||max>500||!Number.isInteger(budgetMs)||budgetMs<1||budgetMs>900000)throw Error('Invalid source verification budget');
 const started=Date.now();
 const docs=(await pool.query(`WITH ranked AS(SELECT d.id,d.source_url,d.metadata#>>'{rawPrepassageVotes,text}' AS text,
  row_number() OVER(PARTITION BY s.slug ORDER BY count(a.id) DESC,d.id) AS rank
  FROM source_documents d JOIN legislative_sessions s ON s.id=d.session_id JOIN senate_vote_paper_current_v a ON a.source_document_id=d.id
  LEFT JOIN senate_paper_source_attempts attempt ON attempt.source_document_id=d.id
  WHERE NOT a.original_source_verified AND(attempt.source_document_id IS NULL OR
   attempt.extracted_text_sha256<>encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex') OR
   (attempt.result='unavailable' AND attempt.attempts<3 AND attempt.checked_at<now()-interval '6 hours')) GROUP BY d.id,s.slug)
  SELECT * FROM ranked ORDER BY rank,source_url LIMIT $1`,[max])).rows;
 const summary={checked:0,matched:0,mismatch:0,unavailable:0,selected:docs.length,budgetExhausted:false};
 for(const d of docs){
  if(Date.now()-started>=budgetMs){summary.budgetExhausted=true;break;}
  if(fetcher===fetchSenateJournal)await new Promise(r=>setTimeout(r,500));
  summary.checked++;let original;
  try{original=await fetcher(d.source_url);}catch{summary.unavailable++;}
  const result=!original?'unavailable':hash(original.text)!==hash(d.text)?'mismatch':'matched';
  if(result==='matched'){
   await pool.query(`INSERT INTO senate_paper_source_verifications(source_document_id,source_url,extracted_text_sha256,original_body_sha256,original_byte_length)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[d.id,d.source_url,hash(original!.text),original!.pdfSha256,original!.byteLength]);summary.matched++;
  }else if(result==='mismatch')summary.mismatch++;
  await pool.query(`INSERT INTO senate_paper_source_attempts(source_document_id,extracted_text_sha256,result,attempts)
   VALUES($1,$2,$3,1) ON CONFLICT(source_document_id) DO UPDATE SET extracted_text_sha256=EXCLUDED.extracted_text_sha256,result=EXCLUDED.result,
   attempts=CASE WHEN senate_paper_source_attempts.extracted_text_sha256=EXCLUDED.extracted_text_sha256 THEN senate_paper_source_attempts.attempts+1 ELSE 1 END,checked_at=now()`,[d.id,hash(d.text),result]);
 }
 return summary;
}

export async function connectExplicitBaseCaptures(pool:Pool){
 const r=await pool.query(`INSERT INTO senate_vote_paper_components(action_id,capture_id,relation)
  SELECT a.id,c.id,'explicit_base_locator' FROM senate_vote_paper_current_v a
  JOIN senate_official_bill_text_captures c ON c.bill_id=a.bill_id AND c.source_locator=a.explicit_base_locator
  WHERE c.family<>'amendment' AND NOT EXISTS(SELECT 1 FROM senate_official_bill_text_captures other
   WHERE other.bill_id=c.bill_id AND other.source_url=c.source_url AND other.source_locator=c.source_locator AND other.extracted_text_sha256<>c.extracted_text_sha256)
  ON CONFLICT DO NOTHING`);
 return r.rowCount??0;
}
