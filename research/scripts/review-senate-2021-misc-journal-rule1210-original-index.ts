/** #864 original official 2021 Senate Journal MISCELLANEOUS INDEX Rule12.10. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf}
 from '../../src/evidence/minnesota-senate-committee-source.js';
import {
 SENATE_2021_MISC_JOURNAL_PDF,SENATE_2021_RULE1210_INDEX_VERSION,
 find2021SenateJournalRule1210IndexReferences
} from '../../src/evidence/senate-2021-original-journal-misc-rule1210-index-source.js';

const cap=18_000_000;
const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
const safe=(e:unknown)=>String(e instanceof Error?e.message:e)
 .replace(/https?:\/\/\S+/gi,'[official Senate Journal index PDF]').slice(0,180);
async function boundedOriginal(input:string|URL|Request,init?:RequestInit):Promise<Response>{
 const url=input instanceof Request?input.url:String(input);
 if(url!==SENATE_2021_MISC_JOURNAL_PDF)
  throw Error('Not the sole original official Senate 2021 Miscellaneous Journal PDF');
 const r=await fetch(url,{...init,redirect:'manual'});
 if(r.status!==200||r.url!==url||!/^application\/pdf\b/i.test(r.headers.get('content-type')??''))
  throw Error('Original Senate Journal index HTTP/MIME/redirect invalid');
 const declared=r.headers.get('content-length');
 if(declared!==null&&(!Number.isSafeInteger(Number(declared))||
  Number(declared)<500||Number(declared)>cap))
  throw Error('Original Senate Journal index byte length declaration invalid');
 const reader=r.body?.getReader();if(!reader)throw Error('Original source has no stream');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const p=await reader.read();if(p.done)break;
   size+=p.value.byteLength;
   if(size>cap){await reader.cancel();throw Error('Original Journal index PDF stream cap exceeded')}
   chunks.push(p.value);
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let off=0;
 for(const p of chunks){bytes.set(p,off);off+=p.byteLength}
 if(size<500||new TextDecoder('latin1').decode(bytes.slice(0,5))!=='%PDF-')
  throw Error('Original source is not a valid PDF');
 return new Response(bytes,{status:200,headers:{'content-type':'application/pdf'}});
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
  throw Error('Expected --output PATH');
 const out=resolve(args[1]);
 let pdf:Awaited<ReturnType<typeof fetchSenateCommitteeMinutePdf>>|null=null;
 let parsed:ReturnType<typeof find2021SenateJournalRule1210IndexReferences>|null=null;
 let boundedIndexDiagnostic:string|null=null;
 const errors:string[]=[];
 try{
  pdf=await fetchSenateCommitteeMinutePdf({
   url:SENATE_2021_MISC_JOURNAL_PDF,fetchImpl:boundedOriginal as typeof fetch
  });
  if(pdf.extractionMethod!=='embedded_text')
   throw Error('The official journal index embedded text was not retrievable');
  try{
   parsed=find2021SenateJournalRule1210IndexReferences(pdf.text);
  }catch(e){
   // Diagnostic window (limited to non-name-side PUBLIC INDEX source only):
   // if extraction layout varies, preserve actual failure and inspect before fix.
   const flat=pdf.text.replace(/\s+/g,' ').trim();
   const at=flat.search(/Rule\s*#?\s*12\.10|REPORT\S*\s+OF\s+VOTE\s+IN\s+COMMITTEE/i);
   boundedIndexDiagnostic=at>=0?
    flat.slice(Math.max(0,at-200),Math.min(flat.length,at+4900)):flat.slice(0,2000);
   throw e;
  }
 }catch(e){errors.push(safe(e))}
 const result={
  schemaVersion:SENATE_2021_RULE1210_INDEX_VERSION,issue:864,
  sourceScope:'OFFICIAL_2021_SENATE_JOURNAL_MISCELLANEOUS_INDEX_RULE12_10_PUBLICATION_REFERENCES_ONLY',
  officialOriginalIndexUrl:SENATE_2021_MISC_JOURNAL_PDF,
  sourceOriginalPdfRetrieved:pdf!==null,
  sourceOriginalPdfBytes:pdf?.bytes??null,
  sourceOriginalPdfSHA256:pdf?.contentSha256??null,
  sourceOriginalExtractedTextSHA256:pdf?sha(pdf.text):null,
  originalTextExtractionMethod:pdf?.extractionMethod??null,
  originalRule12_10IndexSectionIsolated:parsed!==null,
  sourceIndexedSection:parsed,
  failedIndexSourceOrParserChecks:errors.length,
  errors,boundedIndexDiagnostic,
  originalFullPdfAndFullTextNotCommitted:true,
  rule1210IndexReferencesNotHistoricalCommitteeVoteDenominator:true,
  originalRule1210IndexCountNotCertifiedUntilFullSectionParsedAndAudited:true,
  official2021LRLPrintCommitteeMinutesNotSubstitutedByJournalIndex:true,
  noNamedIndividualCommitteeSidesInIndexReport:true,
  noPrivateProductionDBOrMemberVoteReadWrite:true,
  noForecastModelTrainingServingSchedulerFloorOr2027:true,
  noGovernmentOfficeContact:true,
  issue864MustRemainOpen:true
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({originalPdfAcquired:pdf!==null,
  parsedSection:parsed!==null,
  candidateEntries:parsed?.candidateReferencePairsFound??null,
  sourceFailures:errors.length
 }));
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(safe(e));process.exitCode=1});
