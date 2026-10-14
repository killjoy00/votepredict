/**
 * Track D #987, read-only exact-original cross-party HF100 2023 evidence.
 * Replays ONLY four pinned, independently SHA-1 indexed pre-vote HTML originals,
 * proves narrowly speaker-owned passages, and rechecks the complete official
 * April 28 journal. Never saves raw publisher/PDF/audio or calls the DB.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {simplify} from './probe-senate-media-mpr-five-year-commoncrawl-originals.mjs';
import {ephemeralPDFText} from './probe-senate-media-2022-standalone-parents-bills-primary.mjs';
import {LEADS as SOURCE_LEADS,allowed} from './probe-senate-media-2023-hf100-crossparty-candidates.mjs';

export const VERSION='track-d-hf100-2023-two-democratic-yes-two-republican-no-original-primary-v1';
export const JOURNAL=Object.freeze({url:'https://www.senate.mn/journals/2023-2024/20230428059.pdf',
  sha256:'9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3',bytes:4472460,pages:292,page:290,printedPage:6890,yeas:34,nays:33});
export const ORIGINALS=Object.freeze([
 Object.freeze({id:'port-jan05-kstp-introduction',stamp:'20230105211717',captureUtc:'2023-01-05T21:17:17Z',
  sha1:'WARMR4RJ6NELAZRBXLEVM7DBTEOZBVK7',sha256:'8c6df4ad994dabebb6c6dfa2ac610202b943e9155af2d30bd9b7504dd91ef579',bytes:172075}),
 Object.freeze({id:'port-jan06-redlake-reported-release',stamp:'20230109103314',captureUtc:'2023-01-09T10:33:14Z',
  sha1:'WNWHO7FO56MCHTBQTQW5Z66CGHJNZHQZ',sha256:'ce685841c34e542c813ab6e6eafdff47b17bfef46eba3e5b7b28c797d7244022',bytes:30662}),
 Object.freeze({id:'oumou-jan05-mpr-cannabis',stamp:'20230105175614',captureUtc:'2023-01-05T17:56:14Z',
  sha1:'AEWKILDAH5QTVDBB2NRVGH22IM7IL2KO',sha256:'3cb55b27ef4706448b89fbdc2114dbda8c34ed657d33b269e65d137112cd2404',bytes:57846}),
 Object.freeze({id:'port-jan30-marijuana-herald-committee',stamp:'20230131185253',captureUtc:'2023-01-31T18:52:53Z',
  sha1:'DEFGFAP3WTPSI4GCEEUAPCNCA56EM6ZU',sha256:'dfecffa31933b6dd8c4f5794453c2dd1c6e30f7e1e3a7e30ed4853faa5fe2794',bytes:56747})
]);
const sha256=body=>createHash('sha256').update(body).digest('hex');
export function sha1Base32(body){
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',sha=createHash('sha1').update(body).digest();
 let out='',acc=0,bits=0;
 for(const b of sha){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;out+=chars[(acc>>>bits)&31];}acc&=(1<<bits)-1;}
 if(bits)out+=chars[(acc<<(5-bits))&31];return out;
}
export function validateOriginals(){
 allowed();if(ORIGINALS.length!==SOURCE_LEADS.length||new Set(ORIGINALS.map(x=>x.id)).size!==4)throw Error('source approval population drift');
 for(let i=0;i<ORIGINALS.length;i++){
  const p=ORIGINALS[i],l=SOURCE_LEADS[i];
  if(p.id!==l.id||p.captureUtc!==p.stamp.slice(0,4)+'-'+p.stamp.slice(4,6)+'-'+p.stamp.slice(6,8)+'T'+p.stamp.slice(8,10)+':'+p.stamp.slice(10,12)+':'+p.stamp.slice(12,14)+'Z'||
    p.captureUtc>='2023-04-28T00:00:00Z'||!/^[A-Z2-7]{32}$/.test(p.sha1)||!/^[a-f0-9]{64}$/.test(p.sha256)||p.bytes<10000||p.bytes>2000000)throw Error('invalid approved historic original receipt');
 }
 return true;
}
/** The unique directly quoted senator turn, not a nearby named speaker. */
export function boundNamedOriginalTurn(html,lead){
 if(!SOURCE_LEADS.includes(lead)||typeof html!=='string'||html.length>2500000)throw Error('unapproved speaker original');
 const text=simplify(html);let regex,method,required;
 switch(lead.id){
  case 'port-jan05-kstp-introduction':
   regex=/"([^"\n]{90,260})"\s*(?:sen\.|senator)\s+lindsey\s+port\b(?:(?!").){0,180}?\b(?:said|added)\b/g;
   method='closed_quote_immediately_named_sen_lindsey_port_reported_attribution';required='legalization of adult-use cannabis in our state';break;
  case 'port-jan06-redlake-reported-release':
   regex=/"([^"\n]{90,260})"\s*said\s+senator\s+lindsey\s+port\b/g;
   method='closed_quote_immediately_named_senator_lindsey_port_attribution';required='legalization of adult-use cannabis in our state';break;
  case 'oumou-jan05-mpr-cannabis':
   regex=/first-term\s+sen\.\s+clare\s+oumou\s+verbeten\b[^"\n]{0,260}"([^"\n]{30,120})"\s*she\s+said\b/g;
   method='full_senator_named_preceding_sentence_then_direct_she_said_quote';required='we are going to get this done in 2023';break;
  case 'port-jan30-marijuana-herald-committee':
   regex=/"([^"\n]{90,260})"\s*said\s+senator\s+lindsey\s+port\b/g;
   method='closed_quote_immediately_named_senator_lindsey_port_at_hearing';required='prohibition of cannabis is a failed system';break;
  default:throw Error('not one of four pinned original leads');
 }
 const matches=[...text.matchAll(regex)].map(x=>x[1].trim().replace(/[,;]\s*$/,'')).filter(x=>x.includes(required));
 const verified=matches.length===1;
 return {senator:lead.senator,sourceId:lead.id,method,verified,
  normalizedBoundedSegmentSha256:verified?sha256(Buffer.from(matches[0],'utf8')):null,
  normalizedBoundedSegmentCharacters:verified?matches[0].length:null,
  ownsCompleteSpeechAudioOrWholeArticle:false};
}
export function rollFromOriginalJournal(text){
 if(typeof text!=='string'||text.length>5000000)throw Error('invalid official journal text');
 const p=/The question was taken on the final passage of H\.?\s*F\.?\s*No\.?\s*100,\s*as amended\.\s*The roll was called,?\s*and there were yeas 34 and nays 33,?\s*as follows:/gi;
 const matches=[...text.matchAll(p)];
 if(matches.length!==1)return {status:'final_passage_identity_tally_or_ambiguity_unknown',qualified:false,individualVotes:[]};
 const a=text.slice(matches[0].index+matches[0][0].length,matches[0].index+matches[0][0].length+11000);
 const y=/Those who voted in the affirmative were:/i.exec(a),n=/Those who voted in the negative were:/i.exec(a);
 const end=/So the bill,\s*as amended,\s*was passed and its title was agreed to\./i.exec(a);
 if(!y||!n||!end||!(y.index<n.index&&n.index<end.index))return {status:'roster_boundaries_unknown',qualified:false,individualVotes:[]};
 const affirmative=a.slice(y.index+y[0].length,n.index).split(/Pursuant to Rule 40\b/i)[0];
 const negative=a.slice(n.index+n[0].length,end.index).split(/Pursuant to Rule 40\b/i)[0];
 const expected=[['Lindsey Port','Port','yea'],['Clare Oumou Verbeten','Oumou Verbeten','yea'],
   ['Gary Dahms','Dahms','nay'],['Glenn Gruenhagen','Gruenhagen','nay']];
 const votes=expected.map(([senator,name,vote])=>{
  const rx=new RegExp('\\b'+name.replace(/\s+/g,'\\s+')+'\\b','i');
  const inA=rx.test(affirmative),inN=rx.test(negative);
  return {senator,vote:inA&&!inN&&vote==='yea'?'yea':inN&&!inA&&vote==='nay'?'nay':'UNKNOWN',
   printedAffirmative:inA,printedNegative:inN,notRule40Only:true};
 });
 const qualified=votes.every((x,i)=>x.vote===expected[i][2]);
 return {status:qualified?'official_final_passage_four_named_opposed_votes':'final_passage_named_vote_unknown',
  qualified,bill:'HF100',companionNotDirectBallot:'SF73',yeas:34,nays:33,
  originalPdfPageOneBased:text.slice(0,matches[0].index).split('\f').length,individualVotes:votes};
}
async function readBoundedResponse(r,max,min){
 const n=r.headers.get('content-length');if(n&&(!/^\d+$/.test(n)||+n>max))throw Error('overlarge content-length');
 if(!r.body)throw Error('no response body');const rd=r.body.getReader(),chunks=[];let total=0;
 for(;;){const x=await rd.read();if(x.done)break;total+=x.value.byteLength;if(total>max)throw Error('overlarge response body');chunks.push(Buffer.from(x.value));}
 if(total<min)throw Error('undersized response body');return Buffer.concat(chunks);
}
export async function replayPinnedSource(lead,pin,f=fetch){
 validateOriginals();if(!SOURCE_LEADS.includes(lead)||ORIGINALS[SOURCE_LEADS.indexOf(lead)]!==pin)throw Error('unapproved pinned archive replay');
 const fallback={id:pin.id,senator:lead.senator,originalCaptureUtc:pin.captureUtc,status:'archive_transport_unknown',
  archivedSha1:pin.sha1,verifiedRawSha256:null,verifiedBytes:null,speaker:null,authenticatedOriginal:false};
 try {
  const url='https://web.archive.org/web/'+pin.stamp+'id_/'+lead.url;
  const r=await f(url,{method:'GET',redirect:'manual',headers:{accept:'text/html','accept-encoding':'identity',
   'user-agent':'VotePredict/2.0 public-track-d-hf100-crossparty-exact-original'},signal:AbortSignal.timeout(45000)});
  if(r.status!==200||(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='text/html')return {...fallback,status:'archive_http_or_mime_unknown'};
  const b=await readBoundedResponse(r,2500000,1000);
  const sha=sha256(b),sha1=sha1Base32(b);
  if(b.length!==pin.bytes||sha!==pin.sha256||sha1!==pin.sha1){return {...fallback,status:'PINNED_ORIGINAL_DIGEST_MISMATCH_FAIL_CLOSED',
    observedByteCount:b.length,observedSha256:sha,observedSha1Base32:sha1};}
  const bounded=boundNamedOriginalTurn(b.toString('utf8'),lead);
  return {...fallback,status:bounded.verified?'individually_bounded_original_quote_authenticated':'original_speaker_attribution_boundary_failure',
   verifiedRawSha256:sha,verifiedBytes:b.length,speaker:bounded,authenticatedOriginal:bounded.verified};
 }catch(e){return {...fallback,status:'archive_replay_network_unknown',errorClass:String(e?.message||e).slice(0,120)};}
}
export async function inspectCrossPartyJournal(f=fetch,extract=ephemeralPDFText){
 const fail={status:'official_full_journal_network_unknown',originalSha256:null,originalBytes:null,pages:null,roll:null};
 try{
  const r=await f(JOURNAL.url,{method:'GET',redirect:'manual',headers:{accept:'application/pdf',
    'accept-encoding':'identity','user-agent':'VotePredict/2.0 public-track-d-hf100-crossparty-original-journal'},signal:AbortSignal.timeout(85000)});
  if(r.status!==200||!['application/pdf','application/octet-stream'].includes((r.headers.get('content-type')||'').split(';')[0].toLowerCase()))return {...fail,status:'official_original_http_mime_unknown'};
  const b=await readBoundedResponse(r,32000000,50000);
  if(!b.subarray(0,5).equals(Buffer.from('%PDF-'))||!b.subarray(-2048).toString('latin1').includes('%%EOF'))return {...fail,status:'official_original_pdf_incomplete_fail_closed'};
  const hash=sha256(b);if(hash!==JOURNAL.sha256||b.length!==JOURNAL.bytes)return {...fail,status:'official_original_pdf_digest_changed_fail_closed',originalSha256:hash,originalBytes:b.length};
  const parsed=await extract(b),roll=rollFromOriginalJournal(parsed.text);
  return {status:parsed.pages===JOURNAL.pages&&roll.qualified&&roll.originalPdfPageOneBased===JOURNAL.page?
    'official_original_292page_four_named_votes_verified':'official_original_wrong_page_or_names_fail_closed',
   originalSha256:hash,originalBytes:b.length,pages:parsed.pages,roll};
 }catch(e){return {...fail,errorClass:String(e?.message||e).slice(0,120)};}
}
export function deduplicateByMemberQuote(replays){
 const approved=replays.filter(x=>x.authenticatedOriginal&&x.speaker?.verified);
 const statementKeys=new Set(approved.map(x=>x.senator+'|'+x.speaker.normalizedBoundedSegmentSha256));
 return {originalVersions:approved.length,uniqueSenatorSpeakerPassages:statementKeys.size,
   uniqueSenators:new Set(approved.map(x=>x.senator)).size,
   redlakeAndKstpAreSamePortQuotedStatement:approved.some(x=>x.id==='port-jan05-kstp-introduction')&&
      approved.some(x=>x.id==='port-jan06-redlake-reported-release')&&
      approved.find(x=>x.id==='port-jan05-kstp-introduction').speaker.normalizedBoundedSegmentSha256===
       approved.find(x=>x.id==='port-jan06-redlake-reported-release').speaker.normalizedBoundedSegmentSha256};
}
export async function run(f=fetch,extract=ephemeralPDFText){
 validateOriginals();
 const journal=await inspectCrossPartyJournal(f,extract),sources=[];
 for(let i=0;i<SOURCE_LEADS.length;i++)sources.push(await replayPinnedSource(SOURCE_LEADS[i],ORIGINALS[i],f));
 const dedup=deduplicateByMemberQuote(sources);
 return {version:VERSION,readOnlyPublicSources:true,
  journal,sources,dedup,
  authenticatedDemocraticYesPersonToRepublicanNoMemberPairs:journal.roll?.qualified&&dedup.uniqueSenators===2?
    4:0,
  crossPartyHistoricalStatementPairApprovedForProduction:false,
  retrospectivePredictionBacktestPerformed:false,
  noOriginalRawBytesPersisted:true,noProductionDBIngestionFeatureModelOrDeploymentChanges:true};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const i=process.argv.indexOf('--output'),out=process.argv[i+1];
 if(i<0||!/^artifacts\/track-d-hf100-crossparty-originals\.json$/.test(out||''))throw Error('metadata only output required');
 const r=await run();mkdirSync('artifacts',{recursive:true});writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log('TRACK_D_HF100_CROSSPARTY_PINNED_ORIGINALS='+JSON.stringify(r));
}
