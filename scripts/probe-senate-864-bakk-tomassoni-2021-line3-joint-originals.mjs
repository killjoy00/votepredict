/**
 * #864 read-only 2021 senator-owned joint policy attestation.
 * Attributable signature list ≠ individual spoken quote or voting record.
 * 2021 original indexed archive SHA1 + downloaded complete HTML SHA256.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validCdxEntries,sha1Base32,decodeVisibleOriginal}
 from './probe-senate-864-substantive-new-originals.mjs';
const CAP=2_500_000,sha=b=>createHash('sha256').update(b).digest('hex');
const vis=x=>decodeVisibleOriginal(x).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const CUES=['the permits are issued, the lawsuits are settled',
 'we encourage everyone to allow the project to keep moving forward','line 3'];
export function validate(m){
 if(!m||m.schema!=='senate-864-2021-line3-signed-joint-position-bakk-tomassoni-v1'||
  m.issue!==864||m.sourceHtmlUrls?.length!==2||m.officialServingPersonNames?.length!==2||
  m.officialServingPersonNames[0]!=='Thomas M. Bakk'||
  m.officialServingPersonNames[1]!=='David J. Tomassoni'||
  m.originalStatementEvent!=='2021-09-03-two-senators-signed-multiple-legislator-pro-line3-joint-text'||
  m.archivalHistoricalPublicByAtLeadCreation!==null||
  m.bothSignatoriesNotTwoIndependentStatementEvents!==true||
  m.entirePublishedJointTextNotEachSignedSenatorsSeparateSpokenWords!==true||
  m.productionDbModelsServingUnchanged!==true)
  throw Error('wrong source provenance or copied individual speech status');
 for(let i=0;i<2;i++){
  const p=m.sourceHtmlUrls[i],u=new URL(p.url);
  if(u.protocol!=='https:'||u.hostname!==(i?'www.house.mn.gov':'www.mnsenaterepublicans.com')||
    p.sourceDate!=='2021-09-03'||u.search||u.hash||
    (i===0&&!u.pathname.includes('statement-from-minnesota-legislators-on-dc-squad-visit-to-protest-line-3/'))||
    (i===1&&u.pathname!=='/members/profile/news/15395/46693'))throw Error('untrusted source/host/date');
 }
 return true;
}
export function originalSignedJointEvidence(b){
 if(!Buffer.isBuffer(b)||b.length>CAP)throw Error('not original complete raw HTML bytes');
 const t=vis(b.toString('utf8'));
 const idx=CUES.map(c=>t.indexOf(vis(c)));
 const uniqueFirstTwo=idx.slice(0,2).every((i,j)=>i>=0&&t.indexOf(vis(CUES[j]),i+1)<0);
 const first=idx[0],second=idx[1];
 const actualJoinedText=first>=0&&second>first&&second-first<4500;
 const after=second<0?'':t.slice(second,second+5000);
 const names=['senator tom bakk','senator david tomassoni'];
 const matchingSignedNames=names.map(n=>after.includes(n));
 const listPlacement=matchingSignedNames.every(Boolean);
 const statementStartsNear=first>=0&&
  (t.slice(Math.max(0,first-1300),first).includes('joint statement')||
   t.slice(Math.max(0,first-1300),first).includes('following joint'));
 const qualifies=uniqueFirstTwo&&actualJoinedText&&listPlacement&&statementStartsNear;
 return {authenticatedSignedJointDocumentForTwoNamedSenators:qualifies,
  exactJointSpeechPolicyClausesInOrder:actualJoinedText,
  exactPolicyCuesAppearOnce:uniqueFirstTwo,
  signaturesAfterTheQuotedJointStatement:matchingSignedNames,
  senatorSpeakerMode:'joint_signatory_NOT_solo_personal_quote',
  quotedJointPassageCannotBecomeIndividualAudioTranscript:true,
  singleUnderlyingStatementDespiteTwoPublishers:true,
  originalSignerListBoundedWithinNext5000Chars:true,
  quoteTextSha256Fragments:qualifies?CUES.slice(0,2).map(q=>sha(Buffer.from(vis(q)))):[],
  originalRecordedMemberVotesVerified:0,
  firstPublisherPostingMinuteUnproven:true,
  candidateOwnedCampaignWebsiteCensusIncrement:0};
}
async function body(r,max){
 if(r.status!==200||!r.body)throw Error('http_or_body_unavailable');
 let n=0,p=[];const reader=r.body.getReader();while(true){
  const x=await reader.read();if(x.done)break;n+=x.value.byteLength;
  if(n>max){await reader.cancel().catch(()=>{});throw Error('oversized');}p.push(Buffer.from(x.value));
 }
 return Buffer.concat(p,n);
}
export async function probe(p,f=fetch){
 const r={url:p.url,publisherKind:p.kind,sourceDisplayDate:p.sourceDate,
  status:'ARCHIVE_UNKNOWN',originalRawSha256:null,originalIndexedSha1Base32:null,
  originalPublicByUtc:null,originalTotalHtmlBytes:null,
  verifiedWholeOriginalSha:false,verifiedJointSigners:false,signerProof:null,
  deduplicateIdenticalJointTextRegardlessOfPublisher:true,
  doesNotPromoteToIndividualPolicyQuoteOrVote:true,
  fullCopyrightedSourceNotSaved:true, errors:[]};
 const u=new URL('https://web.archive.org/cdx/search/cdx');
 for(const [k,v] of Object.entries({url:p.url,output:'json',from:'2021',to:'2023',
  filter:'statuscode:200',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'60'}))u.searchParams.set(k,v);
 u.searchParams.append('filter','mimetype:text/html');
 try{
  const query=await f(u,{method:'GET',redirect:'manual',headers:{accept:'application/json'},
   signal:AbortSignal.timeout(22000)});
  if(query.status!==200){r.status='CDX_HTTP_'+query.status+'_UNKNOWN';return r;}
  const cdx=await body(query,150000);
  let list;try{list=validCdxEntries(JSON.parse(cdx.toString('utf8')),p.url,p.sourceDate);}
  catch{r.status='CDX_INDEX_INVALID_UNKNOWN';return r;}
  if(!list.length){r.status='CDX_INDEX_NO_QUALIFIED_CAPTURE_IN_BOUNDED_QUERY_UNKNOWN';return r;}
  for(const e of list){
   try{
    const orig=await f('https://web.archive.org/web/'+e.timestamp+'id_/'+e.archiveOriginalUrl,{
      method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity'},
      signal:AbortSignal.timeout(28000)});
    if(orig.status!==200||(orig.headers.get('content-type')||'').toLowerCase().split(';')[0]!=='text/html'){
     r.errors.push('replay_http_or_mime_invalid');continue;
    }
    const b=await body(orig,CAP);
    if(b.length<1800||sha1Base32(b)!==e.indexedSha1Base32){
     r.errors.push('raw_html_sha1_cdx_index_mismatch');continue;
    }
    const speaker=originalSignedJointEvidence(b);
    r.originalRawSha256=sha(b);r.originalTotalHtmlBytes=b.length;
    r.originalIndexedSha1Base32=e.indexedSha1Base32;
    r.originalPublicByUtc=e.timestamp.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:$6Z');
    r.verifiedWholeOriginalSha=true;
    r.verifiedJointSigners=speaker.authenticatedSignedJointDocumentForTwoNamedSenators;
    r.signerProof=speaker;
    r.status=r.verifiedJointSigners?'SHA1_SHA256_ORIGINAL_AND_BOTH_NAMED_JOINT_SIGNERS_MATCH':
      'SHA1_SHA256_ORIGINAL_BUT_TWO_SIGNERS_NOT_BOUNDED';
    if(r.verifiedJointSigners)break;
   }catch{r.errors.push('raw_original_replay_unavailable_UNKNOWN');}
  }
  if(!r.verifiedWholeOriginalSha)r.status='INDEX_EXISTS_ORIGINAL_BODY_MISMATCH_OR_MISSING_UNKNOWN';
 }catch{r.status='CDX_REQUEST_OR_PROVIDER_ERROR_UNKNOWN';r.errors.push('archive_request_error');}
 return r;
}
export async function run(m,f=fetch){
 validate(m);
 const copies=[];for(const p of m.sourceHtmlUrls)copies.push(await probe(p,f));
 const accepted=copies.filter(x=>x.verifiedJointSigners).sort((a,b)=>a.originalPublicByUtc.localeCompare(b.originalPublicByUtc));
 return {schema:'senate-864-bakk-tomassoni-2021-line3-signed-joint-original-proofs-v1',issue:864,
  distinctOwnedFirstPartyPublisherCopiesAuthenticated:copies.filter(x=>x.verifiedWholeOriginalSha).length,
  copiesWithBothNamesAndJointIssueCuesAuthenticated:accepted.length,
  earliestIndependentlyAuthenticOriginalPublicByUtc:accepted[0]?.originalPublicByUtc||null,
  originalUnderlyingJointPolicyStatementCount:accepted.length?1:0,
  individuallySpokenVerbatimOrVoteLabelsApproved:0,
  candidateOwnedCampaignWebsiteExcerptPersonIncrement:0,
  signedServingSenatorNames:accepted.length?m.officialServingPersonNames:[],
  sourceResults:copies,
  notA2020CandidateSenateCampaignSite:true,noModelServingDatabaseOrOutreachActions:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const m=JSON.parse(readFileSync('data/evaluation/senate-864-bakk-tomassoni-2021-line3-signed-original-joint-leads-v1.json','utf8'));
 const out=resolve(process.argv[2]||'/tmp/senate-864-bakk-tomassoni-original-joint.json');
 const r=await run(m);
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log(JSON.stringify({out,originals:r.distinctOwnedFirstPartyPublisherCopiesAuthenticated,
  jointOriginals:r.copiesWithBothNamesAndJointIssueCuesAuthenticated,
  earliest:r.earliestIndependentlyAuthenticOriginalPublicByUtc,
  sources:r.sourceResults.map(x=>[x.url,x.status])}));
}
