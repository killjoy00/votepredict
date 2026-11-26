import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { collectionSourceFetch,getArchivedCollectionResponse,require2027CollectionScope,classify2027CollectionUrl,COLLECTION_LIMITS,type CollectionSourceReceipt } from '@/sources/minnesota/2027-collection-source';
import { fetchPublicPage,publicPageMentionsPerson,type PublicPage } from '@/evidence/public-http';
import { houseMemberNewsUrl,parseHouseMemberNewsArchiveEntries,findSenateMemberProfileUrl,memberPrimaryProfileMatches,selectMemberPrimaryArticleCandidates,memberPrimaryArticleMatches,memberPrimaryPublishedAt,
  MN_SENATE_DFL_DIRECTORY_URL,MN_SENATE_REPUBLICAN_DIRECTORY_URL,type MemberPrimaryMember,type MemberPrimaryDiscovery } from '@/evidence/member-primary';
import { extractExplicitBillStatements,type BillReference } from '@/evidence/bill-statement-extractor';
import { extractIssuePositions } from '@/evidence/issue-position-extractor';
import { DAILY_COLLECTION_SOURCE_RECEIPT_TYPE,storeBlob } from './2027-daily-collection';

const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export const MEMBER_EVIDENCE_CANDIDATE_TYPE='application/vnd.votepredict.2027-member-evidence-candidate+json';
export const MEMBER_EVIDENCE_ATTEMPT_TYPE='application/vnd.votepredict.2027-member-evidence-attempt+json';
export type EvidenceMember=MemberPrimaryMember&{membership_id:string;legislator_id:string;newSincePrior:boolean};
type Proof={receipt:CollectionSourceReceipt;receiptSha256:string};
type ArchivedPage={page:PublicPage;proof:Proof};

export function chooseMemberEvidenceTargets(members:readonly EvidenceMember[],attempts:ReadonlyMap<string,string>,limit:number){
  if(!Number.isInteger(limit)||limit<1||limit>COLLECTION_LIMITS.memberEvidenceBatch)throw Error('Invalid member evidence batch size');
  return [...members].sort((a,b)=>(attempts.get(a.membership_id)??'').localeCompare(attempts.get(b.membership_id)??'')||
    Number(b.newSincePrior)-Number(a.newSincePrior)||a.membership_id.localeCompare(b.membership_id)).slice(0,limit);
}

async function archivedPage(url:string):Promise<ArchivedPage>{
  require2027CollectionScope();
  if(classify2027CollectionUrl(url)!=='member_evidence')throw Error('Unexpected member primary source');
  let proof:Proof|undefined;
  const page=await fetchPublicPage(url,{timeoutMs:15000,maxBytes:COLLECTION_LIMITS.maxResponseBytes,
    userAgent:'VotePredict/2.0 bounded member-primary evidence collector',
    fetcher:async(input,init)=>{
      const response=await collectionSourceFetch(String(input),init);
      proof=getArchivedCollectionResponse(response);
      return response;
    }});
  if(!proof||proof.receipt.sourceKind!=='member_evidence'||proof.receipt.httpStatus!==200||
    proof.receipt.sourceUrl!==page.finalUrl||proof.receipt.responseBodySha256!==page.contentSha256||
    proof.receipt.responseBodyBytes!==page.bytes)throw Error('Member evidence original-byte receipt mismatch');
  return {page,proof};
}

async function verifyProof(db:Pick<Pool,'query'>,proof:Proof){
  const stored=(await db.query<{body:Buffer;rawVerified:boolean}>(`
    SELECT receipt.body,encode(sha256(raw.body),'hex')=raw.sha256 AS "rawVerified"
    FROM evidence_content_blobs receipt JOIN evidence_content_blobs raw ON raw.sha256=$2
    WHERE receipt.sha256=$1 AND receipt.media_type=$3`,[proof.receiptSha256,proof.receipt.responseBodySha256,DAILY_COLLECTION_SOURCE_RECEIPT_TYPE])).rows[0];
  if(!stored||!stored.rawVerified||sha(stored.body)!==proof.receiptSha256||stored.body.toString()!==JSON.stringify(proof.receipt))
    throw Error('Member evidence archive readback mismatch');
}

/** Preserve the existing deterministic extractor logic, but keep every draft
 * out of serving tables until independently reviewed. A policy statement is
 * context, not evidence of a vote on a specific bill. */
export function stageMemberStatementDrafts(member:EvidenceMember,page:Pick<PublicPage,'text'|'publishedAt'|'fetchedAt'>,
  bills:readonly BillReference[]){
  const observed=Date.parse(page.fetchedAt);
  const claimed=page.publishedAt?Date.parse(page.publishedAt):Number.NaN;
  if(!Number.isFinite(observed)||!Number.isFinite(claimed)||claimed>observed||
    claimed<Date.parse('2027-01-12T06:00:00.000Z'))throw Error('Member article publication date unproved or outside live session');
  const input={membershipId:member.membership_id,memberName:member.name,text:page.text,
    publishedAt:page.publishedAt,fetchedAt:page.fetchedAt,sourceSubtype:'member_primary_article' as const};
  const issue=extractIssuePositions(input);
  const specific=extractExplicitBillStatements({...input,bills});
  const mark=(draft:(typeof issue)[number],kind:'general_issue_context'|'bill_statement_candidate')=>({
    ...draft,metadata:{...draft.metadata,stagedOnly:true,servingEligible:false,mechanicallyActionable:false,modelWeight:0,
      quickEvidenceCandidate:false,originalExtractorQuickCandidate:draft.metadata?.quickEvidenceCandidate===true},
    candidateKind:kind,
  });
  return [...issue.map(x=>mark(x,'general_issue_context')),...specific.map(x=>mark(x,'bill_statement_candidate'))].slice(0,100);
}

async function context(db:Pool){
  const members=(await db.query<EvidenceMember>(`
    SELECT m.id::text AS membership_id,l.id::text AS legislator_id,l.name,l.external_key,c.slug AS chamber_slug,m.party,m.district,
      NOT EXISTS(SELECT 1 FROM memberships prior JOIN legislative_sessions ps ON ps.id=prior.session_id
        WHERE prior.legislator_id=m.legislator_id AND ps.jurisdiction_id=s.jurisdiction_id AND ps.slug='2025-2026') AS "newSincePrior"
    FROM memberships m JOIN legislators l ON l.id=m.legislator_id
    JOIN legislative_sessions s ON s.id=m.session_id AND s.is_current AND s.slug='2027-2028'
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    JOIN chambers c ON c.id=m.chamber_id AND c.slug IN ('house','senate')
    WHERE m.starts_on IS NOT NULL AND m.ends_on IS NOT NULL
      AND (now() AT TIME ZONE 'America/Chicago')::date BETWEEN m.starts_on AND m.ends_on
    ORDER BY m.id LIMIT 501`)).rows;
  if(!members.length||members.length>500||new Set(members.map(x=>x.membership_id)).size!==members.length)
    throw Error('Active evidence membership scope unavailable');
  const bills=(await db.query<BillReference>(`SELECT b.id::text,b.identifier FROM bills b
    JOIN legislative_sessions s ON s.id=b.session_id AND s.is_current AND s.slug='2027-2028'
    JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'
    WHERE b.metadata #>> '{revisorUniverse,liveSync}'='true' LIMIT 16001`)).rows;
  if(bills.length>16000)throw Error('Evidence bill catalog exceeds bound');
  const count=(await db.query<{count:number}>(`SELECT count(*)::int AS count FROM (SELECT sha256 FROM evidence_content_blobs WHERE media_type=$1 LIMIT 20001) x`,[MEMBER_EVIDENCE_ATTEMPT_TYPE])).rows[0].count;
  if(count>20000)throw Error('Evidence attempt inventory requires review');
  const attempts=(await db.query<{id:string;at:string}>(`
    SELECT convert_from(body,'UTF8')::jsonb->>'membershipId' AS id,max(accepted_at)::text AS at
    FROM evidence_content_blobs WHERE media_type=$1 GROUP BY 1 LIMIT 20001`,[MEMBER_EVIDENCE_ATTEMPT_TYPE])).rows;
  return {members,bills,attempts:new Map(attempts.map(a=>[a.id,new Date(a.at).toISOString()]))};
}

export async function retainMemberEvidenceCandidate(db:Pool,member:EvidenceMember,article:ArchivedPage,discovery:readonly ArchivedPage[],
  publicationAt:string,bills:readonly BillReference[]){
  require2027CollectionScope();
  if(!discovery.length||[...discovery,article].some(({page,proof})=>
    proof.receipt.session!=='2027-2028'||proof.receipt.runId!==article.proof.receipt.runId||
    proof.receipt.sourceKind!=='member_evidence'||proof.receipt.sourceUrl!==page.finalUrl||proof.receipt.responseBodySha256!==page.contentSha256||
    proof.receipt.httpStatus!==200||Date.parse(proof.receipt.observedAt)>Date.parse(article.proof.receipt.observedAt)))
    throw Error('Member evidence receipt lineage mismatch');
  for(const {proof} of [...discovery,article])await verifyProof(db,proof);
  const drafts=stageMemberStatementDrafts(member,{text:article.page.text,publishedAt:publicationAt,fetchedAt:article.proof.receipt.observedAt},bills);
  const manifest={schemaVersion:'2027-member-evidence-candidate-v1',session:'2027-2028',membershipId:member.membership_id,
    legislatorId:member.legislator_id,externalKey:member.external_key,memberName:member.name,chamber:member.chamber_slug,district:member.district,
    sourceUrl:article.page.finalUrl,sourceBodySha256:article.proof.receipt.responseBodySha256,sourceReceiptSha256:article.proof.receiptSha256,
    discoveryReceiptSha256s:discovery.map(x=>x.proof.receiptSha256),observedAt:article.proof.receipt.observedAt,
    claimedPublicationAt:publicationAt,title:article.page.title??null,availableBeforeObservationProved:false,
    drafts,servingEligible:false,canonicalWriteAllowed:false};
  const bytes=Buffer.from(JSON.stringify(manifest));
  if(bytes.length>1_000_000)throw Error('Member evidence manifest exceeds bound');
  const digest=await storeBlob(db,bytes,MEMBER_EVIDENCE_CANDIDATE_TYPE,true);
  return {digest,issueCandidates:drafts.filter(d=>d.candidateKind==='general_issue_context').length,
    billCandidates:drafts.filter(d=>d.candidateKind==='bill_statement_candidate').length};
}

export async function collect2027MemberEvidence(db:Pool){
  require2027CollectionScope();
  const {members,bills,attempts}=await context(db);
  const selected=chooseMemberEvidenceTargets(members,attempts,COLLECTION_LIMITS.memberEvidenceBatch);
  const directories=new Map<string,ArchivedPage>();
  let failed=0,documents=0,issueCandidates=0,billCandidates=0,verifiedMembers=0,withoutRecentArticles=0;
  for(const party of ['DFL','R']){
    if(!selected.some(m=>m.chamber_slug==='senate'&&(party==='DFL'?m.party==='DFL':['R','GOP','REPUBLICAN'].includes(m.party))))continue;
    try{directories.set(party,await archivedPage(party==='DFL'?MN_SENATE_DFL_DIRECTORY_URL:MN_SENATE_REPUBLICAN_DIRECTORY_URL));}
    catch{failed++;}
  }
  for(const member of selected){
    const start=new Date().toISOString();
    let memberFailed=0,memberDocs=0,linked=0;
    try{
      let profile:ArchivedPage;
      let discovery:MemberPrimaryDiscovery;
      let receipts:ArchivedPage[];
      let articleLinks:{url:string;date?:string}[];
      if(member.chamber_slug==='house'){
        const url=houseMemberNewsUrl(member.external_key);
        if(!url)throw Error('House member LRL identity unavailable');
        profile=await archivedPage(url);
        if(profile.page.finalUrl!==url)throw Error('House archive identity mismatch');
        discovery={hostKind:'house_official',publisher:'Minnesota House of Representatives',registryPage:profile.page,articleIndexPage:profile.page};
        receipts=[profile];
        articleLinks=parseHouseMemberNewsArchiveEntries(profile.page,member.external_key)
          .filter(x=>x.publishedOn>='2027-01-12')
          .sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn)||a.url.localeCompare(b.url))
          .slice(0,COLLECTION_LIMITS.memberEvidenceArticles).map(x=>({url:x.url,date:x.publishedOn}));
      }else{
        const party=member.party==='DFL'?'DFL':['R','GOP','REPUBLICAN'].includes(member.party)?'R':'';
        const directory=directories.get(party);
        if(!directory)throw Error('Caucus directory unavailable');
        const url=findSenateMemberProfileUrl(directory.page,member);
        if(!url||classify2027CollectionUrl(url)!=='member_evidence')throw Error('Unique caucus profile unavailable');
        profile=await archivedPage(url);
        if(!publicPageMentionsPerson(profile.page.text,member.name)||!memberPrimaryProfileMatches(profile.page,member))
          throw Error('Caucus profile identity and district not verified');
        discovery={hostKind:party==='DFL'?'senate_dfl_caucus':'senate_republican_caucus',
          publisher:party==='DFL'?'Minnesota Senate DFL':'Minnesota Senate Republicans',registryPage:profile.page,articleIndexPage:profile.page};
        receipts=[directory,profile];
        articleLinks=selectMemberPrimaryArticleCandidates(discovery,member,COLLECTION_LIMITS.memberEvidenceArticles).map(url=>({url}));
      }
      verifiedMembers++;
      linked=articleLinks.length;
      if(!linked)withoutRecentArticles++;
      for(const link of articleLinks){
        try{
          const article=await archivedPage(link.url);
          if(!publicPageMentionsPerson(article.page.text,member.name)||!memberPrimaryArticleMatches(article.page,discovery,member))
            throw Error('Article attribution unverified');
          // Prefer a displayed article date; the House's dated official index
          // is a fallback, never the date of acquisition relabeled as publication.
          const publication=memberPrimaryPublishedAt(article.page)??(link.date?link.date+'T12:00:00.000Z':undefined);
          if(!publication||publication.slice(0,10)<'2027-01-12')continue;
          if(link.date&&publication.slice(0,10)!==link.date)throw Error('Article date differs from official index');
          const result=await retainMemberEvidenceCandidate(db,member,article,receipts,publication,bills);
          documents++;memberDocs++;issueCandidates+=result.issueCandidates;billCandidates+=result.billCandidates;
        }catch{memberFailed++;}
      }
    }catch{memberFailed++;}
    failed+=memberFailed;
    const event={schemaVersion:'2027-member-evidence-attempt-v1',session:'2027-2028',membershipId:member.membership_id,startedAt:start,
      linked,documents:memberDocs,failed:memberFailed,state:memberFailed?'partial_failure':'bounded_batch'};
    await storeBlob(db,Buffer.from(JSON.stringify(event)),MEMBER_EVIDENCE_ATTEMPT_TYPE,true);
  }
  return {selected:selected.length,eligibleMembers:members.length,selectedIncoming:selected.filter(m=>m.newSincePrior).length,
    verifiedMembers,withoutRecentArticles,documents,issueCandidates,billCandidates,failed,servingEvidenceWritten:0,
    fullDailyMemberCoverageVerified:false,committeeAndHearingCoverageVerified:false};
}
