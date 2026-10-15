/**
 * #864 source-only independent regression against the original January 24,
 * 2023 Minnesota Senate Rules & Administration committee minute PDF.
 * No protected database or personal vote rows are read/written.
 * Original document is retrieved fresh and matched to the 2026-10-15
 * independently verified full government PDF SHA from issue #864.
 * Member names are checked in memory but never printed to CI artifacts/logs.
 */
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.js';

export const SOURCE_URL=
 'https://www.lrl.mn.gov/archive/minutes/senate/2023/rules/20230124/Rules_20230124_Minutes.pdf';
export const ORIGINAL_PDF_SHA=
 'a49a0b9d2abdb716118951de8706faf313463ff43f1ab0f16408326a52fb0379';
export const ORIGINAL_PDF_BYTES=189421;
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
async function originalPdf(){
 const res=await fetch(SOURCE_URL,{redirect:'manual',signal:AbortSignal.timeout(45_000),
  headers:{accept:'application/pdf'}});
 if(res.status!==200||!res.body||
  Number(res.headers.get('content-length')??0)>1_000_000)
  throw Error('Official LRL original PDF transport HOLD');
 const reader=res.body.getReader(),chunks:Uint8Array[]=[];
 let n=0;
 try{
  for(;;){const r=await reader.read();if(r.done)break;
   n+=r.value.byteLength;if(n>1_000_000)throw Error('Official PDF byte cap HOLD');
   chunks.push(r.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(n);let offset=0;
 for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 if(n!==ORIGINAL_PDF_BYTES||sha(bytes)!==ORIGINAL_PDF_SHA||
  new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Official 2023 Rules original PDF raw SHA/byte identity HOLD');
 return fetchSenateCommitteeMinutePdf({url:SOURCE_URL,fetchImpl:(async()=>
  new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}})) as typeof fetch});
}
async function main(){
 const pdf=await originalPdf();
 if(pdf.contentSha256!==ORIGINAL_PDF_SHA||pdf.bytes!==ORIGINAL_PDF_BYTES)
  throw Error('PDF source parser returned changed official bytes');
 const rolls=parseSenateCommitteeMinuteVotes(pdf.text);
 const expected=[{yea:4,nay:6,passed:false,kind:'amendment'},
  {yea:6,nay:4,passed:true,kind:'motion'}];
 const safeRows=rolls.map(row=>({
  bill:row.billIdentifier??'unresolved',
  kind:row.voteKind,yea:row.yeaCount,nay:row.nayCount,
  passed:row.passed,explicitNames:row.memberVotes.length,
  allNamedMembersUnique:new Set(row.memberVotes.map(v=>v.normalizedName)).size===row.memberVotes.length,
  allNamedVotesOnPrintedSides:row.memberVotes.every(v=>v.choice==='yea'||v.choice==='nay'),
  motionAnchorSha256:sha(row.motionText),
 }));
 const passed=rolls.length===2&&rolls.every((r,i)=>{
  const expectedMotion=expected[i]!;
  return r.individualVotesAvailable===true&&r.billIdentifier==='SF1'&&
   r.voteKind===expectedMotion.kind&&r.passed===expectedMotion.passed&&
   r.yeaCount===expectedMotion.yea&&r.nayCount===expectedMotion.nay&&
   r.memberVotes.length===10&&
   r.memberVotes.filter(v=>v.choice==='yea').length===r.yeaCount&&
   r.memberVotes.filter(v=>v.choice==='nay').length===r.nayCount&&
   new Set(r.memberVotes.map(v=>v.normalizedName)).size===10;
 });
 // Print ONLY aggregate tallies/provenance, never extracted legislator names.
 console.log('SENATE864_RULES_20230124_SOURCE_PROOF='+JSON.stringify({
  originalPdfSha256:ORIGINAL_PDF_SHA,originalPdfBytes:pdf.bytes,
  hearingDate:'2023-01-24',committee:'Rules and Administration',
  originalTextSha256:sha(pdf.text),extractionMethod:pdf.extractionMethod,
  twoDistinctOriginalNamedRollObservations:passed,reported: safeRows,
  namedMembersComparedOnlyInMemory:true,historicalMemberIdResolution:false,
  storedMotionAndMemberVoteParityPerformed:false,noDatabaseOrModelWrites:true,
 }));
 if(!passed)throw Error('Original Rules SF1 named-side/tally/motion source parser HOLD');
}
void main().catch(error=>{
 console.error('SENATE864_RULES_SF1_ORIGINAL_HOLD='+(
  error instanceof Error&&error.message.includes('source parser HOLD')?
   'named_motion_or_outcome_mismatch':'source_transport_or_parser_hold'));
 process.exitCode=1;
});
