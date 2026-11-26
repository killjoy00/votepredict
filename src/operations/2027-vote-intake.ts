import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { authorizeArchivedHouseVoteIndex,collectionSourceFetch,getArchivedCollectionResponse,require2027CollectionScope,COLLECTION_LIMITS,type CollectionSourceReceipt } from '@/sources/minnesota/2027-collection-source';
import { buildHouseVoteSummaryUrl,buildHouseVoteDetailUrl,discoverHouseVoteBillLinks,validate2027HouseSummary,validate2027HouseVotePage,parseHouseVoteDetailHtml } from '@/sources/minnesota/house-votes';
import { buildSenateJournalIndexUrl,discoverSenateJournalLinks,parseSenateJournalPdfBytes,parseSenateJournalText,SENATE_JOURNAL_VOTE_PARSER_VERSION } from '@/sources/minnesota/senate-journals';
import { activeMembershipCandidates,reconcileHouseMemberName,senateJournalNameForms,type MembershipCandidate } from '@/sources/minnesota/member-reconciliation';
import { getMinnesotaHouseSession,minnesotaLocalDate,MINNESOTA_2027_CONVENES_ON } from '@/sources/minnesota/sessions';
import type { NormalizedVoteEvent } from '@/sources/minnesota/types';
import { DAILY_COLLECTION_SOURCE_RECEIPT_TYPE,storeBlob } from './2027-daily-collection';

const sha=(body:string|Buffer)=>createHash('sha256').update(body).digest('hex');
export const VOTE_CANDIDATE_TYPE='application/vnd.votepredict.2027-vote-candidate-document+json';
export const VOTE_ATTEMPT_TYPE='application/vnd.votepredict.2027-vote-source-attempt+json';
type Chamber='house'|'senate';
type Proof={receipt:CollectionSourceReceipt;receiptSha256:string};
type SourceTarget={sourceUrl:string;billIdentifier?:string;date?:string};
type RosterMember=MembershipCandidate&{chamber:Chamber;startsOn:string|null;endsOn:string|null};

function dateInSession(date:string,observedAt:string):boolean{
  const parsed=new Date(date+'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&
    date>=MINNESOTA_2027_CONVENES_ON&&date<='2028-12-31'&&date<=minnesotaLocalDate(new Date(observedAt));
}

export function reconcile2027VoteCandidate(event:NormalizedVoteEvent,input:{
  chamber:Chamber;roster:readonly MembershipCandidate[];knownBills:ReadonlyMap<string,string>;observedAt:string;
}){
  const reasons:string[]=[];
  const billId=event.billIdentifier?input.knownBills.get(event.billIdentifier)??null:null;
  if(!billId)reasons.push('BILL_UNRESOLVED');
  if(!dateInSession(event.occurredOn,input.observedAt))reasons.push('DATE_OUTSIDE_OBSERVED_SESSION');
  const eligible=activeMembershipCandidates(input.roster.filter(m=>Boolean(m.startsOn&&m.endsOn)),event.occurredOn);
  const seen=new Set<string>();const ordinals=new Set<number>();
  let unresolved=0,duplicates=0,invalidOrdinals=0;
  const members=event.memberVotes.map(vote=>{
    const resolution=reconcileHouseMemberName(vote.sourceName,eligible);
    if(resolution.status!=='matched')unresolved++;
    else if(seen.has(resolution.membershipId))duplicates++;
    else seen.add(resolution.membershipId);
    if(!Number.isInteger(vote.sourceOrdinal)||vote.sourceOrdinal<0||ordinals.has(vote.sourceOrdinal))invalidOrdinals++;
    ordinals.add(vote.sourceOrdinal);
    return {...vote,resolution};
  });
  const counts={yea:members.filter(m=>m.choice==='yea').length,nay:members.filter(m=>m.choice==='nay').length,other:members.filter(m=>m.choice==='other').length};
  const tally=[event.yeaCount,event.nayCount,event.otherCount];
  const tallyMatches=tally.every(v=>Number.isInteger(v)&&v>=0)&&
    counts.yea===tally[0]&&counts.nay===tally[1]&&counts.other===tally[2]&&
    members.length>0&&members.length<=(input.chamber==='house'?134:67);
  if(!tallyMatches)reasons.push('TALLY_MISMATCH');
  if(unresolved)reasons.push('UNRESOLVED_MEMBER');
  if(duplicates||invalidOrdinals)reasons.push('DUPLICATE_OR_INVALID_MEMBER_ROW');
  const rollReconciled=tallyMatches&&!unresolved&&!duplicates&&!invalidOrdinals&&dateInSession(event.occurredOn,input.observedAt);
  if(!event.isPassage||event.voteKind!=='passage')reasons.push('NOT_FINAL_PASSAGE');
  else{
    // House result is deliberately not derived from yeas or threshold. A
    // Senate parser disposition is not yet a separately verified outcome.
    if(typeof event.passed!=='boolean')reasons.push('OFFICIAL_RESULT_UNPROVED');
    if(input.chamber==='senate'){
      const references=[...event.motionText.matchAll(/\b([HS])\.?\s*F\.?\s*(?:No\.?\s*)?0*(\d+)\b/gi)]
        .map(match=>match[1].toUpperCase()+'F'+Number(match[2]));
      if(!event.billIdentifier||new Set(references).size!==1||references[0]!==event.billIdentifier||
        /\b(reconsider|table|re-refer|recall|motion to amend)\b/i.test(event.motionText))reasons.push('EXACT_QUESTION_BILL_UNPROVED');
      reasons.push('JOURNAL_QUESTION_AND_VERSION_REVIEW_REQUIRED');
    }else reasons.push('HOUSE_JOURNAL_RESULT_REVIEW_REQUIRED');
  }
  return {event:{...event,memberVotes:undefined},billId,members,rollReconciled,reasons,
    outcomeDisposition:typeof event.passed==='boolean'?'parser_reported_only':'unknown',
    automaticOutcomeEligible:false as const,canonicalWriteAllowed:false as const};
}

/** Favor unseen documents, then least recently attempted. A failed source
 * cannot monopolize the bounded batch. House pages and Senate journals
 * are revisited: publication URLs may be updated in place. */
export function chooseVoteTargets<T extends SourceTarget>(targets:readonly T[],attempts:ReadonlyMap<string,string>,limit:number):T[]{
  if(!Number.isInteger(limit)||limit<1||limit>COLLECTION_LIMITS.houseVoteBatch)throw Error('Invalid vote intake limit');
  const unique=[...new Map(targets.map(item=>[item.sourceUrl,item])).values()];
  return unique.sort((a,b)=>(attempts.get(a.sourceUrl)??'').localeCompare(attempts.get(b.sourceUrl)??'')||
    (b.date??'').localeCompare(a.date??'')||a.sourceUrl.localeCompare(b.sourceUrl,undefined,{numeric:true})).slice(0,limit);
}

async function archivedGet(url:string,init:RequestInit={}){
  const response=await collectionSourceFetch(url,{headers:{'User-Agent':'VotePredict/2.0 bounded official vote collector',...init.headers},
    signal:AbortSignal.timeout(30000),...init});
  const proof=getArchivedCollectionResponse(response);
  if(!proof||proof.receipt.httpStatus!==200||proof.receipt.sourceUrl!==url)throw Error('Official vote source requires archived successful response');
  return {response,proof};
}

async function verifyProof(db:Pick<Pool,'query'>,proof:Proof){
  const stored=(await db.query<{body:Buffer;rawVerified:boolean}>(`
    SELECT receipt.body,encode(sha256(raw.body),'hex')=raw.sha256 AS "rawVerified"
    FROM evidence_content_blobs receipt JOIN evidence_content_blobs raw ON raw.sha256=$2
    WHERE receipt.sha256=$1 AND receipt.media_type=$3`,[proof.receiptSha256,proof.receipt.responseBodySha256,DAILY_COLLECTION_SOURCE_RECEIPT_TYPE])).rows[0];
  if(!stored||!stored.rawVerified||sha(stored.body)!==proof.receiptSha256||stored.body.toString()!==JSON.stringify(proof.receipt))
    throw Error('Vote source archival proof readback failed');
}

async function readContext(db:Pick<Pool,'query'>){
  const roster=(await db.query<{membership_id:string;legislator_id:string;name:string;normalized_name:string;starts_on:string|null;ends_on:string|null;chamber:Chamber;aliases:string[]}>(`
    SELECT m.id::text AS membership_id,l.id::text AS legislator_id,l.name,l.normalized_name,m.starts_on::text,m.ends_on::text,c.slug AS chamber,
      ARRAY(SELECT DISTINCT a.source_name FROM membership_source_aliases a WHERE a.membership_id=m.id ORDER BY a.source_name) AS aliases
    FROM memberships m JOIN legislators l ON l.id=m.legislator_id
    JOIN legislative_sessions s ON s.id=m.session_id AND s.is_current AND s.slug='2027-2028'
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    JOIN chambers c ON c.id=m.chamber_id AND c.slug IN ('house','senate')
    LIMIT 500`)).rows.map(row=>({membershipId:row.membership_id,legislatorId:row.legislator_id,name:row.name,normalizedName:row.normalized_name,
      startsOn:row.starts_on,endsOn:row.ends_on,chamber:row.chamber,aliases:row.aliases}));
  if(roster.length>=500||!roster.some(m=>m.chamber==='house')||!roster.some(m=>m.chamber==='senate'))throw Error('Vote intake roster unavailable or exceeds limit');
  const bills=(await db.query<{id:string;identifier:string}>(`SELECT b.id::text,b.identifier FROM bills b
    JOIN legislative_sessions s ON s.id=b.session_id AND s.is_current AND s.slug='2027-2028'
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    WHERE b.metadata #>> '{revisorUniverse,liveSync}'='true' LIMIT 16001`)).rows;
  if(bills.length>16000)throw Error('Vote intake bill catalog exceeds bound');
  return {roster,knownBills:new Map(bills.map(b=>[b.identifier,b.id]))};
}

async function readAttempts(db:Pick<Pool,'query'>){
  const result=await db.query<{source_url:string;attempted_at:string}>(`
    WITH attempts AS MATERIALIZED (
      SELECT convert_from(body,'UTF8')::jsonb AS attempt,accepted_at
      FROM evidence_content_blobs WHERE media_type=$1 LIMIT 20001
    )
    SELECT attempt->>'sourceUrl' AS source_url,max(accepted_at)::text AS attempted_at
    FROM attempts GROUP BY attempt->>'sourceUrl' LIMIT 20001`,[VOTE_ATTEMPT_TYPE]);
  // Bound historical cursor reads to this pilot's scope. Retain all immutable
  // attempt records; do not pretend a truncated scan is complete.
  const count=(await db.query<{count:number}>(`SELECT count(*)::int AS count FROM (SELECT sha256 FROM evidence_content_blobs WHERE media_type=$1 LIMIT 20001) x`,[VOTE_ATTEMPT_TYPE])).rows[0].count;
  if(count>20000||result.rows.length>20000)throw Error('Vote attempt inventory requires review');
  return new Map(result.rows.map(x=>[x.source_url,new Date(x.attempted_at).toISOString()]));
}

type IntakeContext=Awaited<ReturnType<typeof readContext>>;
export async function retain2027VoteCandidateDocument(db:Pool,context:IntakeContext,chamber:Chamber,source:Proof,discovery:readonly Proof[],events:NormalizedVoteEvent[],parserVersion:string){
  require2027CollectionScope();
  if(events.length===0||events.length>500||new Set(events.map(e=>e.externalKey)).size!==events.length)throw Error('Vote document event count or keys invalid');
  if(source.receipt.sourceKind!==(chamber==='house'?'house_vote':'senate_vote')||
    source.receipt.httpStatus!==200||!discovery.length||
    [source,...discovery].some(proof=>proof.receipt.session!=='2027-2028'||proof.receipt.runId!==source.receipt.runId||
      proof.receipt.httpStatus!==200||proof.receipt.sourceKind!==source.receipt.sourceKind||
      Date.parse(proof.receipt.observedAt)>Date.parse(source.receipt.observedAt)))
    throw Error('Vote candidate discovery/source lineage mismatch');
  if(chamber==='house'){
    const url=new URL(source.receipt.sourceUrl),key=url.searchParams.get('SessionKey'),bill=url.searchParams.get('BillNumber');
    if(!key||!bill||url.pathname!=='/Votes/Details'||source.receipt.sourceUrl!==buildHouseVoteDetailUrl(key,bill)||
      discovery.length!==3||discovery[0].receipt.sourceUrl!=='https://www.house.mn.gov/Votes'||
      discovery[1].receipt.sourceUrl!==buildHouseVoteSummaryUrl(key)||
      discovery[2].receipt.sourceUrl!=='https://www.house.mn.gov/Votes/GetVoteSummary'||
      discovery[2].receipt.requestMethod!=='POST'||
      discovery[2].receipt.requestBodySha256!==sha(JSON.stringify({SessionKey:Number(key),sortOption:'BillNumber'}))||
      events.some(event=>event.billIdentifier!==bill||!event.externalKey.startsWith(key+':'+bill+':')))
      throw Error('House detail and discovery receipt scope mismatch');
  }else{
    const url=new URL(source.receipt.sourceUrl);
    const date=/^\/journals\/2027-2028\/(\d{4})(\d{2})(\d{2})\d{2,3}\.pdf$/.exec(url.pathname);
    if(!date||discovery.length!==1||discovery[0].receipt.sourceUrl!==buildSenateJournalIndexUrl('2027-2028')||
      events.some(event=>event.occurredOn!==date.slice(1,4).join('-')))
      throw Error('Senate journal and discovery receipt scope mismatch');
  }
  for(const proof of [source,...discovery])await verifyProof(db,proof);
  const candidates=events.map(event=>{
    if(event.sourceUrl!==source.receipt.sourceUrl||!dateInSession(event.occurredOn,source.receipt.observedAt))
      throw Error('Vote event outside archived source/date scope');
    return reconcile2027VoteCandidate(event,{chamber,roster:context.roster.filter(m=>m.chamber===chamber),
      knownBills:context.knownBills,observedAt:source.receipt.observedAt});
  });
  const manifest={schemaVersion:'2027-vote-candidate-document-v1',session:'2027-2028',chamber,sourceUrl:source.receipt.sourceUrl,
    observedAt:source.receipt.observedAt,sourceReceiptSha256:source.receiptSha256,sourceBodySha256:source.receipt.responseBodySha256,
    discoveryReceiptSha256s:discovery.map(p=>p.receiptSha256),parserVersion,candidates,canonicalWriteAllowed:false,automaticOutcomeEligible:false};
  const bytes=Buffer.from(JSON.stringify(manifest));
  if(bytes.length>8*1024*1024)throw Error('Vote candidate document exceeds bound');
  const manifestSha256=await storeBlob(db,bytes,VOTE_CANDIDATE_TYPE,true);
  return {manifestSha256,events:candidates.length,reconciled:candidates.filter(c=>c.rollReconciled).length,
    needsReview:candidates.filter(c=>c.reasons.length>0).length,passageCandidates:candidates.filter(c=>c.event.isPassage).length};
}

type IntakeStats={selected:number;archivedDocuments:number;events:number;reconciled:number;needsReview:number;passageCandidates:number;failed:number;discovered:number|null;sourceState:'unavailable'|'bounded_batch'};
const newStats=():IntakeStats=>({selected:0,archivedDocuments:0,events:0,reconciled:0,needsReview:0,passageCandidates:0,failed:0,discovered:null,sourceState:'unavailable'});

async function processTargets<T extends SourceTarget>(db:Pool,chamber:Chamber,targets:readonly T[],stats:IntakeStats,
  collect:(target:T)=>Promise<Awaited<ReturnType<typeof retain2027VoteCandidateDocument>>>){
  stats.selected=targets.length;
  for(const target of targets){
    const attemptedAt=new Date().toISOString();
    let report:Record<string,unknown>;
    try{
      const saved=await collect(target);
      stats.archivedDocuments++;stats.events+=saved.events;stats.reconciled+=saved.reconciled;stats.needsReview+=saved.needsReview;stats.passageCandidates+=saved.passageCandidates;
      report={state:'retained_candidate_document',...saved};
    }catch{stats.failed++;report={state:'failed',errorCode:'VOTE_SOURCE_OR_PARSE_FAILED'};}
    await storeBlob(db,Buffer.from(JSON.stringify({schemaVersion:'2027-vote-source-attempt-v1',session:'2027-2028',
      chamber,sourceUrl:target.sourceUrl,attemptedAt,...report})),VOTE_ATTEMPT_TYPE,true);
  }
}

export async function collect2027VoteIntake(db:Pool){
  require2027CollectionScope();
  const context=await readContext(db),attempts=await readAttempts(db);
  const house=newStats(),senate=newStats();
  try{
    const index=await archivedGet('https://www.house.mn.gov/Votes');
    const session=await authorizeArchivedHouseVoteIndex(index.response);
    const summary=await archivedGet(buildHouseVoteSummaryUrl(session.sessionKey));
    const summaryHtml=await summary.response.text();
    const json=await archivedGet('https://www.house.mn.gov/Votes/GetVoteSummary',{method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json; charset=utf-8'},
      body:JSON.stringify({SessionKey:Number(session.sessionKey),sortOption:'BillNumber'})});
    const rows:unknown=await json.response.json();
    if(!Array.isArray(rows)||rows.length>16000)throw Error('Unexpected House vote catalog');
    const derived=rows.flatMap(row=>{
      if(!row||typeof row!=='object'||typeof row.Number!=='string')throw Error('Unrecognized House vote catalog row');
      const bill=row.Number.replace(/\s+/g,'').toUpperCase();
      return /^(HF|SF)[1-9]\d*$/.test(bill)?[{billIdentifier:bill,sessionKey:session.sessionKey,sourceUrl:buildHouseVoteDetailUrl(session.sessionKey,bill)}]:[];
    });
    const links=[...new Map([...discoverHouseVoteBillLinks(summaryHtml,session.sessionKey),...derived].map(link=>[link.sourceUrl,link])).values()];
    validate2027HouseSummary(session,summaryHtml,links);
    if(links.length===0)throw Error('No verified House bill vote links; empty coverage unverified');
    house.discovered=links.length;house.sourceState='bounded_batch';
    await processTargets(db,'house',chooseVoteTargets(links,attempts,COLLECTION_LIMITS.houseVoteBatch),house,async link=>{
      const detail=await archivedGet(link.sourceUrl);
      const events=parseHouseVoteDetailHtml({html:await detail.response.text(),sessionKey:session.sessionKey,sourceUrl:link.sourceUrl});
      if(!events.length)throw Error('House roll call document did not parse');
      validate2027HouseVotePage(session,link.billIdentifier,events,new Date(detail.proof.receipt.observedAt));
      return retain2027VoteCandidateDocument(db,context,'house',detail.proof,[index.proof,summary.proof,json.proof],events,'mn-house-vote-detail-existing-parser');
    });
  }catch{house.failed++;}
  try{
    const index=await archivedGet(buildSenateJournalIndexUrl('2027-2028'));
    const links=discoverSenateJournalLinks(await index.response.text(),'2027-2028');
    if(!links.length||links.length>1000||links.some(link=>!link.date||!dateInSession(link.date,index.proof.receipt.observedAt)))throw Error('Senate journal index unavailable or outside scope');
    senate.discovered=links.length;senate.sourceState='bounded_batch';
    await processTargets(db,'senate',chooseVoteTargets(links,attempts,COLLECTION_LIMITS.senateJournalBatch),senate,async link=>{
      const doc=await archivedGet(link.sourceUrl);
      const raw=Buffer.from(await doc.response.arrayBuffer());
      if(sha(raw)!==doc.proof.receipt.responseBodySha256)throw Error('Senate original PDF digest mismatch');
      const parsed=await parseSenateJournalPdfBytes(new Uint8Array(raw),link.sourceUrl);
      if(parsed.pdfSha256!==doc.proof.receipt.responseBodySha256)throw Error('Senate parser source digest mismatch');
      const names=activeMembershipCandidates(context.roster.filter(m=>m.chamber==='senate'&&m.startsOn&&m.endsOn),link.date!).flatMap(senateJournalNameForms);
      const events=parseSenateJournalText({text:parsed.text,sessionKey:getMinnesotaHouseSession('2027-2028').sessionKey,
        sourceUrl:link.sourceUrl,occurredOn:link.date,knownMemberNames:[...new Set(names)],allowRosterMismatch:true});
      // No parsed roll calls does not prove that a journal held none.
      if(events.length===0)throw Error('No recognizable journal roll calls; review original PDF');
      return retain2027VoteCandidateDocument(db,context,'senate',doc.proof,[index.proof],events,SENATE_JOURNAL_VOTE_PARSER_VERSION);
    });
  }catch{senate.failed++;}
  return {house,senate,failedSources:house.failed+senate.failed,canonicalVotesWritten:0,forecastsResolved:0,
    completeVoteCoverageVerified:false,automaticOutcomeResolutionEnabled:false};
}
