/**
 * Track D #987. Official 2024 Minnesota Senate Journal primary Hawj HF5247
 * individual roll-call metadata. Public exact official Senate PDFs downloaded
 * transiently; hashed, parsed and immediately removed, never stored in repo.
 * A multi-subject omnibus vote does NOT certify support for each named SF bill.
 */
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import prior from '../docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.json' with {type:'json'};
export const VERSION='track-d-hawj-hf5247-2024-primary-senate-journal-individual-rollcall-v1';
export const JOURNALS=Object.freeze([
 Object.freeze({id:'2024-senate-day113-may07',day:113,date:'2024-05-07',firstPrinted:16432,
  url:'https://www.senate.mn/journals/2023-2024/20240507113.pdf',
  expected:Object.freeze([Object.freeze({yeas:55,nays:10,event:'third_reading_passage'})])}),
 Object.freeze({id:'2024-senate-day119-may19',day:119,date:'2024-05-19',firstPrinted:17999,
  url:'https://www.senate.mn/journals/2023-2024/20240519119.pdf',
  expected:Object.freeze([Object.freeze({yeas:34,nays:12,event:'conference_report'}),
                          Object.freeze({yeas:34,nays:14,event:'third_reading_amended'})])})
]);
const CAP=45_000_000;
export function originalHawjSource(record=prior){
 const x=record?.historicSenatorStatement;
 if(record?.version!=='track-d-hawj-hf5247-2024-public-bill-action-bridge-receipts-v1'||
  x?.senator!=='Foung Hawj'||x.originalCapturedUtc!=='2024-03-24T19:01:09Z'||
  x.originalRawSha256!=='aa6da6e8722e33f2f692ba31bfd6699cf97768e74c788dbdb0786a75a3ad5743'||
  x.officialServiceRecord!=='https://www.lrl.mn.gov/legdb/fulldetail?ID=15380'||
  record.totals?.senateJournalOriginalHawjIndividualBallotsVerified!==0)
  throw Error('wrong original senator, SHA, cutoff or previous member vote state');
 return {name:'Foung Hawj',originalUtc:x.originalCapturedUtc,
  originalSha256:x.originalRawSha256,url:x.originalUrl,
  officialSenateMember:x.officialServiceRecord};
}
export function officialJournalAllowlist(j=JOURNALS){
 if(j!==JOURNALS||j.length!==2)throw Error('unapproved public journals');
 for(const v of j){
  const u=new URL(v.url);
  const path='/journals/2023-2024/202405'+(v.day===113?'07':'19')+v.day+'.pdf';
  if(u.protocol!=='https:'||u.hostname!=='www.senate.mn'||u.pathname!==path||
   u.port||u.username||u.password||u.search||u.hash||
   ![113,119].includes(v.day))throw Error('wrong session/day/date journal');
 }
 return true;
}
export function pageRange(pdfPages,src){
 if(!JOURNALS.includes(src)||!Number.isSafeInteger(pdfPages)||pdfPages<60||pdfPages>2300)
  throw Error('implausible public journal pdf page count');
 const keep=src.day===113?45:40;
 return {first:Math.max(1,pdfPages-keep+1),last:pdfPages,inspected:Math.min(pdfPages,keep)};
}
export function inspectNamedRolls(text,src){
 if(!JOURNALS.includes(src)||typeof text!=='string'||text.length>2_000_000)
  throw Error('invalid official page text');
 const full=text.replace(/\r/g,''),calls=[];
 const tallyRegex=/The\s+roll\s+was\s+called,\s+and\s+there\s+were\s+yeas\s+(\d+)\s+and\s+nays\s+(\d+),?\s+as\s+follows/gi;
 for(const match of full.matchAll(tallyRegex)){
  const yeas=+match[1],nays=+match[2],expected=src.expected.find(x=>x.yeas===yeas&&x.nays===nays);
  if(!expected)continue;
  const preceding=full.slice(Math.max(0,match.index-15000),match.index);
  const anchor=preceding.lastIndexOf('H.F. No. 5247');
  const context=anchor<0?'':preceding.slice(anchor);
  const closestBill=context.match(/(?:[HS]\.\s*F\.\s*No\.\s*\d+)/g)?.at(-1)||null;
  const hf5247Context=anchor>=0&&context.length<9000&&
   (!closestBill||closestBill==='H.F. No. 5247');
  const following=full.slice(match.index+match[0].length,match.index+match[0].length+7500);
  const yesHeader=/Those\s+who\s+voted\s+in\s+the\s+affirmative\s+were:/i.exec(following);
  const noHeader=/Those\s+who\s+voted\s+in\s+the\s+negative\s+were:/i.exec(following);
  let yesSection='',noSection='';
  if(yesHeader&&noHeader&&yesHeader.index<noHeader.index&&noHeader.index<6500){
   yesSection=following.slice(yesHeader.index+yesHeader[0].length,noHeader.index);
   const after=following.slice(noHeader.index+noHeader[0].length);
   const e=after.search(/\b(?:Pursuant\s+to\s+Rule\s+40|So\s+the\s+bill|So\s+the\s+motion|The\s+question\s+recurred|The\s+roll\s+was\s+called|The\s+motion\s+(?:did\s+not\s+)?prevail|SPECIAL\s+ORDER)\b/i);
   noSection=after.slice(0,e<0?Math.min(after.length,4500):e);
  }
  const namedYes=/\bHawj\b/i.test(yesSection),namedNo=/\bHawj\b/i.test(noSection);
  const namesReadable=!!yesHeader&&!!noHeader&&namedYes!==namedNo;
  const pdfPageInExtractedWindow=full.slice(0,match.index).split('\f').length;
  calls.push({event:expected.event,aggregateYeas:yeas,aggregateNays:nays,
   namedMember:'Foung Hawj',
   personallyListedInAffirmativeRoll:namedYes,
   personallyListedInNegativeRoll:namedNo,
   rollHasBothSeparateVoterListHeadings:!!yesHeader&&!!noHeader,
   hf5247IsNearestExactBillContext:hf5247Context,
   lastContextHf5247DistanceChars:anchor<0?null:context.length,
   pdfPageWithinTailWindowOneBased:pdfPageInExtractedWindow,
   primaryIndividualMemberVote:!hf5247Context||!namesReadable?'UNKNOWN':(namedYes?'yea':'nay'),
   noRule40ProxyInferred:true,
   noSectionSpecificSFProposalVoteInferred:true
  });
 }
 return {rollCallsMatchingExpectedAggregateTally:calls,
  expectedSeparatelyIdentifiedMemberRolls:src.expected.every(x=>
   calls.some(c=>c.aggregateYeas===x.yeas&&c.aggregateNays===x.nays&&c.primaryIndividualMemberVote!=='UNKNOWN')),
  pageExtractionContainsExpectedTallyCount:calls.length};
}
async function getJournal(url,f){
 const resp=await f(url,{method:'GET',redirect:'manual',
  headers:{accept:'application/pdf','accept-encoding':'identity',
    'user-agent':'VotePredict/2.0 track-d-readonly-primary-journal'},
  signal:AbortSignal.timeout(90000)});
 if(resp.status!==200)throw Error(resp.status>=300&&resp.status<400?'journal_redirect_unknown':'journal_http_unavailable_unknown');
 const mime=(resp.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['application/pdf','application/octet-stream'].includes(mime))throw Error('journal_pdf_mime_unknown');
 const length=resp.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>CAP))throw Error('journal_too_large');
 if(!resp.body)throw Error('journal_no_body');
 const parts=[],reader=resp.body.getReader();let total=0;
 for(;;){const chunk=await reader.read();if(chunk.done)break;
  total+=chunk.value.byteLength;if(total>CAP){await reader.cancel().catch(()=>{});throw Error('journal_pdf_over_cap');}
  parts.push(Buffer.from(chunk.value));
 }
 const pdf=Buffer.concat(parts);
 if(total<15000||!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||
  !pdf.subarray(-2048).toString('latin1').includes('%%EOF'))throw Error('invalid_original_pdf_signature');
 return pdf;
}
export async function extractTransient(pdf,source){
 const dir=await mkdtemp(join(tmpdir(),'track-d-senate-journal-'));
 try{
  const path=join(dir,source.id+'.pdf');await writeFile(path,pdf,{flag:'wx'});
  const info=execFileSync('pdfinfo',[path],{encoding:'utf8',maxBuffer:1_000_000,timeout:40000});
  const m=/^Pages:\s*(\d+)/m.exec(info);if(!m)throw Error('journal_pdfinfo_no_page_count');
  const pdfPages=+m[1],range=pageRange(pdfPages,source);
  const text=execFileSync('pdftotext',['-f',String(range.first),'-l',String(range.last),'-layout','-enc','UTF-8',path,'-'],{
   encoding:'utf8',maxBuffer:2_000_000,timeout:120000
  });
  if(text.length<3000)throw Error('no_searchable_official_journal_tail_text');
  return {pdfPages,range,text};
 }finally{await rm(dir,{recursive:true,force:true});}
}
export async function probeJournal(src,f=fetch,extract=extractTransient){
 officialJournalAllowlist();
 const item={id:src.id,officialUrl:src.url,legislativeDay:src.day,date:src.date,
  status:'official_journal_unknown',sha256:null,pdfBytes:null,pdfPages:null,
  extractedTailPageRange:null,results:null,pdfTextPersisted:false};
 try{
  const pdf=await getJournal(src.url,f);item.pdfBytes=pdf.length;
  item.sha256=createHash('sha256').update(pdf).digest('hex');
  const x=await extract(pdf,src);item.pdfPages=x.pdfPages;item.extractedTailPageRange=x.range;
  item.results=inspectNamedRolls(x.text,src);
  item.status='official_journal_pdf_sha256_authenticated_and_tail_text_inspected';
 }catch(e){
  item.status='official_original_pdf_unavailable_or_unparsed_unknown';
  item.errorCategory=String(e?.message||'error').slice(0,90);
 }
 return item;
}
export async function run(f=fetch,extract=extractTransient){
 officialJournalAllowlist();const journals=[];
 for(const src of JOURNALS)journals.push(await probeJournal(src,f,extract));
 const resolved=journals.flatMap(s=>s.results?.rollCallsMatchingExpectedAggregateTally.map(x=>({
  date:s.date,day:s.legislativeDay,...x,
  pdfPageOneBased:s.extractedTailPageRange.first+x.pdfPageWithinTailWindowOneBased-1,
  journalPrintedPageCandidate:JOURNALS.find(j=>j.id===s.id).firstPrinted+
    s.extractedTailPageRange.first+x.pdfPageWithinTailWindowOneBased-2
 }))||[]);
 const by=(date,y,n)=>resolved.find(x=>x.date===date&&x.aggregateYeas===y&&x.aggregateNays===n)?.primaryIndividualMemberVote||'UNKNOWN';
 return {version:VERSION,publicResearchDateLocal:'2026-10-12',
  priorHistoricHawjWrittenSource:originalHawjSource(),
  expectedOfficialJournalPdfSourceUrls:2,
  successfullyInspectedOriginalOfficialSenateJournalPdfs:journals.filter(x=>x.status==='official_journal_pdf_sha256_authenticated_and_tail_text_inspected').length,
  individuallyClassifiedHF5247JournalRolls:resolved,
  hawjMay7ThirdReadingIndividualVote:by('2024-05-07',55,10),
  hawjMay19ConferenceIndividualVote:by('2024-05-19',34,12),
  hawjMay19ThirdReadingIndividualVote:by('2024-05-19',34,14),
  noStandaloneSFPolicyVoteAssumed:true,
  noOmnibusYESAsIssueSpecificPosition:true,
  noContemporaneousByVoteTextVersionOrExactSectionCrosswalk:true,
  noProductionForecastOrTrainingLabelApproved:true,
  noPrivateVotePredictSourceRecordsAccessed:true,
  noJournalPdfOrExtractedFullTextPersisted:true,journals};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const pos=process.argv.indexOf('--output'),filename=process.argv[pos+1];
 if(pos<0||!/^artifacts\/[A-Za-z0-9._-]+\.json$/.test(filename||''))throw Error('safe metadata output required');
 const result=await run();mkdirSync('artifacts',{recursive:true});writeFileSync(filename,JSON.stringify(result,null,2)+'\n');
 console.log('TRACK_D_OFFICIAL_HAWJ_HF5247_JOURNALS='+JSON.stringify({
  originals:result.successfullyInspectedOriginalOfficialSenateJournalPdfs,
  may7:result.hawjMay7ThirdReadingIndividualVote,
  may19Conf:result.hawjMay19ConferenceIndividualVote,
  may19Third:result.hawjMay19ThirdReadingIndividualVote,
  perPdf:result.journals.map(j=>({id:j.id,status:j.status,rawPdfSha256:j.sha256,
   bytes:j.pdfBytes,pages:j.pdfPages,window:j.extractedTailPageRange,
   extractedVotes:j.results?.rollCallsMatchingExpectedAggregateTally,error:j.errorCategory||null}))
 }));
}
