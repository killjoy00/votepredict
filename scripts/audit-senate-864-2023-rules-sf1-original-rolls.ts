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
 const flat=pdf.text.replace(/\s+/g,' ');
 const markers=[...flat.matchAll(/\b(?:Members\s+voting\s+(?:AYE|NO)|On\s+a\s+vote\s+of)\b/gi)]
  .map(x=>({at:x.index??0,label:x[0].toUpperCase().replace(/\s+/g,'_')}));
 const anonymousSideGrammar=(value:string)=>{
  const clean=value.replace(/--\s*\d+\s+of\s+\d+\s*--/gi,' ').replace(/\s+/g,' ').trim();
  const parts=clean.split(/\bSenator\s+/i).slice(1)
   .map(x=>x.replace(/^[\s,;:]+|[\s,;:.]+$/g,'').trim());
  const valid=/^[\p{L}\p{M}][\p{L}\p{M} .,'-]{0,80}$/u;
  return {
   startsWithSenator:/^Senator\s+/i.test(clean),
   parsedSenatorBlocks:parts.length,
   blocksWithUnexpectedNonNameCharacters:parts.filter(p=>!valid.test(p)).length,
   unexpectedCodePoints:[...new Set(parts.flatMap(p=>[...p].filter(ch=>
    !/[\p{L}\p{M} .'-]/u.test(ch)).map(ch=>ch.codePointAt(0)!.toString(16))))],
  };
 };
 const narrativeCandidates=[...flat.matchAll(
  /\bMembers\s+voting\s+AYE\s*:\s*([\s\S]{1,1000}?)\bMembers\s+voting\s+NO\s*:\s*([\s\S]{1,1000}?)\bOn\s+a\s+vote\s+of\s+(\d{1,2})\s+AYES?\s*,?\s*and\s+(\d{1,2})\s+NO\b([^\n]{0,180})/gi,
 )].map(x=>({ayePrefixes:(x[1].match(/\bSenator\s+/gi)??[]).length,
  noPrefixes:(x[2].match(/\bSenator\s+/gi)??[]).length,
  printedAye:Number(x[3]),printedNo:Number(x[4]),
  ayeChars:x[1].length,noChars:x[2].length,
  ayePunctuation:(x[1].match(/[,:;()\r\n]/g)??[]).length,
  noPunctuation:(x[2].match(/[,:;()\r\n]/g)??[]).length,
  ayeGrammar:anonymousSideGrammar(x[1]),noGrammar:anonymousSideGrammar(x[2]),
 }));
 const sourceShape={
  markerLabels:markers.map(x=>x.label),
  markerGaps:markers.slice(1).map((x,i)=>x.at-markers[i]!.at),
  narrativeRegexMatches:narrativeCandidates.length,
  matchedSideStructuralCounts:narrativeCandidates,
  unredactedSenatorNamesInOutput:false,
 };
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
  originalSourceStructure:sourceShape,
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
