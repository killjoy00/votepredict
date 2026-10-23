/**
 * #1498: original-government Journal source-only audit of (1) known-bill
 * accepted votes with NO parsed bill paper and (2) accepted votes without a
 * resolved bill. Exact question+full named ballot and original PDF provenance
 * are mandatory. The latter requires a UNIQUE bill printed INSIDE the same
 * source question; neighboring bill context NEVER assigns a bill.
 *
 * Protected REPEATABLE READ READ ONLY. Reports contain counts and public
 * bill/date only, not vote IDs, original questions, names, source URLs or text.
 */
import type {PoolClient} from 'pg';
import {ballotSignature,billIdentifier,hash} from './senate-vote-paper-parser.js';
import {parseOriginal,fullQuestion,type ParsedOriginal} from './senate-repeated-paper-original-roll-audit.js';
import type {OriginalJournal,DayAccepted} from './senate-no-tally-original-census.js';
import type {VoteTextGapAudit} from './senate-vote-text-gap-audit.js';

export const ORPHAN_JOURNAL_AUDIT='senate-1498-orphan-journal-source-v1' as const;
export type Cohort='missing_paper'|'unresolved_bill';
export type Stage='original_unverified_or_duplicated'|'original_roll_unreadable'|
 'accepted_ballot_incomplete'|'no_original_exact_question_ballot'|
 'original_question_different_ballot'|'original_ballot_different_question'|
 'original_question_ballot_repeated'|'original_unreadable_duplicate'|
 'original_question_span_unproven'|'printed_bill_disagrees'|
 'bill_not_printed_in_question'|'multiple_bills_in_question'|
 'question_bill_differs_from_source'|'unique_catalog_bill_missing'|
 'accepted_source_day_question_collision'|'question_claimed_by_other_vote'|
 'existing_unverified_link'|'unique_missing_paper_question'|'unique_printed_bill';
const STAGES:readonly Stage[]=[
 'original_unverified_or_duplicated','original_roll_unreadable',
 'accepted_ballot_incomplete','no_original_exact_question_ballot',
 'original_question_different_ballot','original_ballot_different_question',
 'original_question_ballot_repeated','original_unreadable_duplicate',
 'original_question_span_unproven','printed_bill_disagrees',
 'bill_not_printed_in_question','multiple_bills_in_question',
 'question_bill_differs_from_source','unique_catalog_bill_missing',
 'accepted_source_day_question_collision','question_claimed_by_other_vote',
 'existing_unverified_link','unique_missing_paper_question','unique_printed_bill'];
const VALID_JOURNAL=/^https:\/\/www\.senate\.mn\/journals\/20\d\d-20\d\d\/20\d{8,9}\.pdf$/;
const VALID_BILL=/^(HF|SF)[1-9]\d{0,5}$/;
export interface OrphanVote {
 id:string;source_id:string;source_url:string;session:string;day:string;
 vote_kind:string;bill_id:string|null;bill:string|null;motion_text:string;
 yea_count:number;nay_count:number;votes:Array<{name:string;choice:string}>;
 exact_linked:boolean;stored_link:boolean;
}
export interface BillRow {id:string;session:string;identifier:string}
export interface ClaimedQuestion{
 source_url:string;day:string;question_text:string;
 yea_count:number|null;nay_count:number|null;
 ballot_sha256:string|null;vote_event_id:string;
}
/** Restricted in-transaction access to source evidence for a separate
 * read-only structural amendment ownership audit. NEVER JSON-serialize this.
 * Source, ballots, accepted IDs, and original question text remain private.
 */
export interface UnresolvedOriginalReview{
 vote:OrphanVote;original:OriginalJournal|null;parsed:ParsedOriginal|null;
 acceptedPeers:readonly DayAccepted[];claimedQuestions:readonly ClaimedQuestion[];
 stage:Stage;
}
export interface OrphanProof{
 vote:OrphanVote;source:OriginalJournal;resolvedBillId:string;printedBill:string;
 printedQuestion:string;questionStart:number;rollStart:number;
 rollOrdinal:number;ballot:string;originalTextSha:string;
 resolution:'existing_bill'|'printed_bill';
}
export interface OrphanReport{
 schemaVersion:typeof ORPHAN_JOURNAL_AUDIT;
 targeted:number;missingPaper:number;unresolvedBill:number;
 retrievedOriginalDocuments:number;authenticatedOriginalDocuments:number;
 acceptedSourceDayPeers:number;
 eligibleKnownBillQuestions:number;eligiblePrintedBillAssociations:number;
 stages:Record<Cohort,Record<Stage,number>>;
 groups:Array<{session:string;vote_kind:string;cohort:Cohort;stage:Stage;count:number}>;
 examples:Array<{session:string;bill:string;day:string;cohort:Cohort;stage:Stage;count:number}>;
 officialVotesChanged:false;originalDocumentsChanged:false;
 oldPaperActionsChanged:false;exactLinksCreated:0;
 servingModelsChanged:false;completeAmendedStatesCertified:0;
}
const scope=(source_url:string,day:string)=>JSON.stringify([source_url,day]);
const named=(v:DayAccepted)=>ballotSignature(v.votes,v.yeas,v.nays);
const getCohort=(v:OrphanVote):Cohort=>v.bill_id===null?'unresolved_bill':'missing_paper';
function billsInQuestion(q:string):string[]{
 return [...new Set([...q.matchAll(/\b[HS]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d{1,6}\b/gi)]
  .map(x=>billIdentifier(x[0])).filter((x):x is string=>!!x))];
}
export function summarizeOrphanJournalOriginals(
 votes:readonly OrphanVote[],docs:readonly OriginalJournal[],
 dayVotes:readonly DayAccepted[],catalog:readonly BillRow[],
 claims:readonly ClaimedQuestion[],gap:VoteTextGapAudit,
 onUnique?:(proof:OrphanProof)=>void,
 onUnresolved?:(item:UnresolvedOriginalReview)=>void
):OrphanReport{
 if(votes.length>1100||docs.length>650||dayVotes.length>8000||
  catalog.length>8000||claims.length>8000||
  new Set(votes.map(v=>v.id)).size!==votes.length||
  new Set(docs.map(d=>d.id)).size!==docs.length||
  new Set(dayVotes.map(v=>v.eventId)).size!==dayVotes.length)
  throw Error('Orphan original census source/identity limit exceeded');
 const expected=(stage:string)=>gap.groups.filter(g=>g.source_family==='senate_journal'
  &&g.evidence_stage===stage).reduce((n,g)=>n+g.event_count,0);
 const missing=votes.filter(v=>v.bill_id!==null).length,unresolved=votes.length-missing;
 if(missing!==expected('no_parsed_paper_for_bill')||
  unresolved!==expected('no_resolved_bill'))
  throw Error('Orphan original census disagrees with official full-population gaps');
 const byUrl=new Map<string,OriginalJournal[]>(),byDay=new Map<string,DayAccepted[]>();
 const catalogByKey=new Map<string,string[]>();
 for(const d of docs){
  const x=byUrl.get(d.source_url)??[];x.push(d);byUrl.set(d.source_url,x);
 }
 for(const v of dayVotes){
  const k=scope(v.sourceUrl,v.day),x=byDay.get(k)??[];x.push(v);byDay.set(k,x);
 }
 for(const b of catalog){
  const k=b.session+'|'+b.identifier,x=catalogByKey.get(k)??[];
  x.push(b.id);catalogByKey.set(k,x);
 }
 const original=new Map(docs.map(d=>[d.id,parseOriginal(d)]));
 const stages={
  missing_paper:Object.fromEntries(STAGES.map(s=>[s,0])) as Record<Stage,number>,
  unresolved_bill:Object.fromEntries(STAGES.map(s=>[s,0])) as Record<Stage,number>
 };
 const groups=new Map<string,OrphanReport['groups'][number]>();
 const examples=new Map<string,OrphanReport['examples'][number]>();
 for(const v of votes){
  const cohort=getCohort(v);
  if(!['2021-2022','2023-2024','2025-2026'].includes(v.session)||
   !/^202[1-6]-\d\d-\d\d$/.test(v.day)||!VALID_JOURNAL.test(v.source_url)
   ||v.exact_linked||(v.bill_id!==null&&!VALID_BILL.test(v.bill??'')))
   throw Error('Non-Minnesota original Senate accepted event in orphan audit');
  const authentic=(byUrl.get(v.source_url)??[]).filter(d=>d.original_verified
   &&d.source_type==='mn_senate_journal');
  const d=authentic.length===1?authentic[0]!:undefined;
  const physical=d?original.get(d.id):undefined;
  let stage:Stage|null=null;
  if(!d||!(v.source_url.split('/').at(-1)??'').startsWith(v.day.replace(/-/g,'')))
   stage='original_unverified_or_duplicated';
  else if(!physical?.aligned)stage='original_roll_unreadable';
  else {
   const sig=ballotSignature(v.votes,v.yea_count,v.nay_count),q=fullQuestion(v.motion_text);
   if(!sig)stage='accepted_ballot_incomplete';
   else{
    const sameQuestion=physical.rolls.filter(r=>r.question===q
     &&r.yeas===v.yea_count&&r.nays===v.nay_count);
    const sameBallot=physical.rolls.filter(r=>r.ballot===sig
     &&r.yeas===v.yea_count&&r.nays===v.nay_count);
    const exact=sameQuestion.filter(r=>r.ballot===sig);
    if(!exact.length)stage=sameQuestion.length?'original_question_different_ballot'
     :sameBallot.length?'original_ballot_different_question'
     :'no_original_exact_question_ballot';
    else if(exact.length!==1)stage='original_question_ballot_repeated';
    else if(sameQuestion.some(r=>r!==exact[0]&&r.ballot===null))
     stage='original_unreadable_duplicate';
    else{
     const r=exact[0]!;
     if(r.questionStart===null||r.questionStart<0||r.questionStart>=r.start
      ||r.start-r.questionStart>2600||q.length<40||q.length>2600
      ||!/^The question (?:was taken|recurred)\b/i.test(q)
      ||q.includes('The roll was called,')
      ||/JOURNAL OF THE SENATE|\d{1,3}(?:ST|ND|RD|TH) DAY\]/i.test(q))
      stage='original_question_span_unproven';
     else if(cohort==='missing_paper'&&r.bill!==v.bill)
      stage='printed_bill_disagrees';
     else{
      let billId=v.bill_id,printedBill=v.bill;
      if(cohort==='unresolved_bill'){
       const namedBills=billsInQuestion(q);
       if(!namedBills.length)stage='bill_not_printed_in_question';
       else if(namedBills.length!==1)stage='multiple_bills_in_question';
       else if(namedBills[0]!==r.bill)stage='question_bill_differs_from_source';
       else {
        const bs=catalogByKey.get(v.session+'|'+namedBills[0])??[];
        if(bs.length!==1)stage='unique_catalog_bill_missing';
        else{billId=bs[0]!;printedBill=namedBills[0]!}
       }
      }
      if(stage===null){
       const peers=(byDay.get(scope(v.source_url,v.day))??[]).filter(a=>
        a.yeas===v.yea_count&&a.nays===v.nay_count&&named(a)===sig
        &&fullQuestion(a.motionText)===q);
       if(peers.length!==1||peers[0]!.eventId!==v.id)
        stage='accepted_source_day_question_collision';
       else if(claims.some(c=>c.source_url===v.source_url&&c.day===v.day
        &&c.yea_count===v.yea_count&&c.nay_count===v.nay_count
        &&c.question_text===q&&c.ballot_sha256===sig&&c.vote_event_id!==v.id))
        stage='question_claimed_by_other_vote';
       else if(v.stored_link)stage='existing_unverified_link';
       else {
        if(!billId||!printedBill||!VALID_BILL.test(printedBill))
         throw Error('Source-original orphan proof lacks independently printed bill');
        stage=cohort==='missing_paper'?'unique_missing_paper_question':'unique_printed_bill';
        onUnique?.({vote:v,source:d,resolvedBillId:billId,printedBill,
         printedQuestion:q,questionStart:r.questionStart,rollStart:r.start,
         rollOrdinal:r.ordinal,ballot:sig,originalTextSha:hash(d.body!),
         resolution:cohort==='missing_paper'?'existing_bill':'printed_bill'});
       }
      }
     }
    }
   }
  }
  if(stage===null)throw Error('Original orphan Journal vote was not classified');
  if(cohort==='unresolved_bill')onUnresolved?.({
   vote:v,original:d??null,parsed:physical??null,
   acceptedPeers:byDay.get(scope(v.source_url,v.day))??[],
   claimedQuestions:claims.filter(c=>c.source_url===v.source_url&&c.day===v.day),
   stage
  });
  stages[cohort][stage]++;
  const k=JSON.stringify([v.session,v.vote_kind,cohort,stage]);
  const g=groups.get(k)??{session:v.session,vote_kind:v.vote_kind,cohort,stage,count:0};
  g.count++;groups.set(k,g);
  if(v.bill&&VALID_BILL.test(v.bill)){
   const ek=JSON.stringify([v.session,v.bill,v.day,cohort,stage]);
   const e=examples.get(ek)??{session:v.session,bill:v.bill,day:v.day,cohort,stage,count:0};
   e.count++;examples.set(ek,e);
  }
 }
 if(Object.values(stages.missing_paper).reduce((a,b)=>a+b,0)!==missing
  ||Object.values(stages.unresolved_bill).reduce((a,b)=>a+b,0)!==unresolved)
  throw Error('Original question/bill cohort partition does not conserve votes');
 return{
  schemaVersion:ORPHAN_JOURNAL_AUDIT,targeted:votes.length,
  missingPaper:missing,unresolvedBill:unresolved,
  retrievedOriginalDocuments:docs.length,
  authenticatedOriginalDocuments:[...original.values()].filter(x=>x.verified&&x.aligned).length,
  acceptedSourceDayPeers:dayVotes.length,
  eligibleKnownBillQuestions:stages.missing_paper.unique_missing_paper_question,
  eligiblePrintedBillAssociations:stages.unresolved_bill.unique_printed_bill,
  stages,groups:[...groups.values()].sort((a,b)=>b.count-a.count),
  examples:[...examples.values()].sort((a,b)=>b.count-a.count).slice(0,20),
  officialVotesChanged:false,originalDocumentsChanged:false,
  oldPaperActionsChanged:false,exactLinksCreated:0,
  servingModelsChanged:false,completeAmendedStatesCertified:0
 };
}

const targetSQL=[
 'SELECT v.id::text AS id,v.source_document_id::text AS source_id,',
 'd.source_url,s.slug AS session,v.occurred_on::text AS day,',
 'v.vote_kind,v.bill_id::text AS bill_id,b.identifier AS bill,',
 'v.motion_text,v.yea_count,v.nay_count,',
 "coalesce((SELECT jsonb_agg(jsonb_build_object('name',m.source_member_name,",
 "'choice',m.choice)) FROM member_votes m WHERE m.vote_event_id=v.id),'[]'::jsonb) AS votes,",
 'EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v x',
 'WHERE x.vote_event_id=v.id) AS exact_linked,',
 'EXISTS(SELECT 1 FROM senate_vote_paper_event_links e',
 'WHERE e.vote_event_id=v.id) AS stored_link',
 'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
 "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
 'JOIN legislative_sessions s ON s.id=v.session_id',
 "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
 'LEFT JOIN bills b ON b.id=v.bill_id',
 "WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')",
 "AND (d.metadata#>>'{rawPrepassageVotes,sourceType}'='mn_senate_journal'",
 "OR d.source_url LIKE 'https://www.senate.mn/journals/%')",
 'AND NOT EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v x',
 'WHERE x.vote_event_id=v.id)',
 'AND (v.bill_id IS NULL OR NOT EXISTS(',
 'SELECT 1 FROM senate_vote_paper_current_v a WHERE a.bill_id=v.bill_id))',
 'ORDER BY s.slug,v.id LIMIT 1101'
].join(' ');

/** Caller has pinned independently verified VotePredict primary and opened a
 * REPEATABLE READ READ ONLY transaction. This function never logs source rows.
 */
export async function readOrphanJournalOriginalAudit(
 db:PoolClient,gap:VoteTextGapAudit,
 onUnique?:(proof:OrphanProof)=>void,
 onUnresolved?:(item:UnresolvedOriginalReview)=>void
):Promise<OrphanReport>{
 const votes=(await db.query<OrphanVote>(targetSQL)).rows;
 if(votes.length>=1101)throw Error('Original orphan accepted votes truncated');
 const urls=[...new Set(votes.map(x=>x.source_url))];
 if(urls.length>650)throw Error('Original orphan distinct URLs exceeded bound');
 const docs:OriginalJournal[]=urls.length?(await db.query<OriginalJournal>([
  'SELECT d.id::text,d.source_url,',
  "d.metadata#>>'{rawPrepassageVotes,sourceType}' AS source_type,",
  "d.metadata#>>'{rawPrepassageVotes,text}' AS body,",
  'EXISTS(SELECT 1 FROM senate_paper_source_verifications p',
  'WHERE p.source_document_id=d.id AND p.source_url=d.source_url',
  "AND p.extracted_text_sha256=encode(sha256(convert_to(d.metadata#>>'{rawPrepassageVotes,text}','UTF8')),'hex'))",
  'AS original_verified',
  'FROM source_documents d WHERE d.source_url=ANY($1::text[])',
  'ORDER BY d.id LIMIT 651'
 ].join(' '),[urls])).rows:[];
 if(docs.length>=651)throw Error('Original orphan full source corpus truncated');
 const dayVotes:DayAccepted[]=urls.length?(await db.query<DayAccepted>([
  'SELECT v.id::text AS "eventId",d.source_url AS "sourceUrl",',
  'v.occurred_on::text AS day,b.identifier AS "billIdentifier",',
  'v.vote_kind AS "voteKind",v.motion_text AS "motionText",',
  'v.yea_count AS yeas,v.nay_count AS nays,',
  "coalesce((SELECT jsonb_agg(jsonb_build_object('name',mv.source_member_name,",
  "'choice',mv.choice)) FROM member_votes mv WHERE mv.vote_event_id=v.id),'[]'::jsonb) AS votes,",
  'EXISTS(SELECT 1 FROM senate_vote_paper_exact_event_v e WHERE e.vote_event_id=v.id)',
  'AS "existingExact"',
  'FROM vote_events v JOIN source_documents d ON d.id=v.source_document_id',
  "JOIN chambers c ON c.id=v.chamber_id AND c.slug='senate'",
  'JOIN legislative_sessions s ON s.id=v.session_id',
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  'LEFT JOIN bills b ON b.id=v.bill_id',
  'WHERE d.source_url=ANY($1::text[])',
  "AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
  'ORDER BY d.source_url,v.occurred_on,v.id LIMIT 8001'
 ].join(' '),[urls])).rows:[];
 if(dayVotes.length>=8001)throw Error('Original orphan accepted source-day corpus truncated');
 const claims:ClaimedQuestion[]=urls.length?(await db.query<ClaimedQuestion>([
  'SELECT p.source_url,p.occurred_on::text AS day,p.question_text,',
  'p.yea_count,p.nay_count,p.ballot_sha256,l.vote_event_id::text',
  'FROM senate_vote_paper_current_v p',
  'JOIN senate_vote_paper_event_links l ON l.action_id=p.id',
  'WHERE p.source_url=ANY($1::text[])',
  'ORDER BY p.source_url,p.occurred_on,p.id LIMIT 8001'
 ].join(' '),[urls])).rows:[];
 if(claims.length>=8001)throw Error('Original orphan existing linked questions truncated');
 const identifiers=[...new Set(docs.flatMap(d=>{
  const view=parseOriginal(d);
  return view.aligned?view.rolls.map(r=>r.bill).filter((x):x is string=>!!x):[];
 }))];
 if(identifiers.length>8000)throw Error('Original orphan printed bill catalog exceeded bound');
 const catalog:BillRow[]=identifiers.length?(await db.query<BillRow>([
  'SELECT b.id::text,s.slug AS session,b.identifier',
  'FROM bills b JOIN legislative_sessions s ON s.id=b.session_id',
  "JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'",
  'WHERE b.identifier=ANY($1::text[])',
  "AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
  'ORDER BY s.slug,b.identifier,b.id LIMIT 8001'
 ].join(' '),[identifiers])).rows:[];
 if(catalog.length>=8001)throw Error('Original orphan session bill catalog truncated');
 return summarizeOrphanJournalOriginals(votes,docs,dayVotes,catalog,claims,gap,onUnique,onUnresolved);
}
