/** Keyless primary-source canary. Prints counts/hashes, never raw source bodies. */
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseJournalPaperActions} from '../src/operations/senate-vote-paper-parser.js';
import {parseNestedSenateSourcePapers} from '../src/operations/senate-vote-paper-nested.js';
import {parseDatedRoleActs} from '../src/operations/senate-vote-paper-backfill.js';
import {fetchCanonicalGovernmentSource,boundedBody,statedAssignmentDate} from '../src/operations/senate-history-archive.js';
import {parseSenateAssignmentPdfText} from '../src/sources/minnesota/senate-assignment-pdf.js';
import {getMinnesotaHouseSession} from '../src/sources/minnesota/sessions.js';
import {hash,compact} from '../src/operations/senate-vote-paper-parser.js';
const sources=[
 ['2023-2024/20230428059.pdf','9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3'],
 ['2021-2022/2021010501.pdf','78f953dbef770ccc1227769d56f927f9162bb8cb27e2e1d959d408055b557da0'],
 ['2023-2024/2023010301.pdf','acd85130c83ed912a47556f30d71c4b486dea05f3dd981194fb71b6062a10331'],
 ['2025-2026/2025011401.pdf','222a49149029fc6e0b689828b553cce96cd3c78cde2a31e5e8bed6332f159d74'],
] as const;
async function verifyCanonicalSources(){
 for(const slug of ['2021-2022','2023-2024','2025-2026']){
  const {response,resolvedUrl}=await fetchCanonicalGovernmentSource('https://www.senate.mn/committees/'+slug+'/info/comlegal.pdf','role_pdf');
  assert.equal(response.ok,true);
  const bytes=await boundedBody(response,30_000_000),sha256=hash(bytes);
  const {PDFParse}=await import('pdf-parse'),{CanvasFactory}=await import('pdf-parse/worker');
  const parser=new PDFParse({data:Uint8Array.from(bytes),CanvasFactory});
  let text:string;try{text=(await parser.getText()).text}finally{await parser.destroy()}
  const statedDate=statedAssignmentDate(text,slug),roles=parseSenateAssignmentPdfText(text,getMinnesotaHouseSession(slug)).roles;
  assert.ok(statedDate);assert.ok(roles.length>200);
  console.log('SENATE_ASSIGNMENT_ALIAS_PROOF='+JSON.stringify({session:slug,resolvedUrl,sha256,bytes:bytes.length,statedDate,roles:roles.length}));
 }
 const {response,resolvedUrl}=await fetchCanonicalGovernmentSource('https://www.revisor.mn.gov/bills/93/2024/0/HF/100/versions/ue/1/','bill_text');
 assert.equal(response.ok,true);assert.equal(resolvedUrl,'https://www.revisor.mn.gov/bills/93/2023/0/HF/100/versions/ue/1/');
 const bytes=await boundedBody(response),body=Buffer.from(bytes).toString('utf8');
 assert.match(body,/<title[^>]*>[^<]*HF\s*100/i);assert.match(body,/A bill for an act/i);
 console.log('SENATE_BILL_ALIAS_PROOF='+JSON.stringify({resolvedUrl,sha256:hash(bytes),bytes:bytes.length}));
}
let verificationPhase='aliases';
async function main(){
 await verifyCanonicalSources();
 verificationPhase='hf1_original_download';
 // Pin from the independently downloaded official 92-page HF1 journal in
 // keyless PR CI; any source byte change requires a fresh original review.
 const hf1=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230127014.pdf');
 verificationPhase='hf1_original_parse';
 const sourceNested=parseNestedSenateSourcePapers(hf1.text);
 const inBill=sourceNested.filter(p=>p.billIdentifier==='HF1');
 console.log('SENATE_HF1_NESTED_ORIGINAL_PROOF='+JSON.stringify({
  source:'2023-2024/20230127014.pdf',pdfSha256:hf1.pdfSha256,
  pdfBytes:hf1.byteLength,sourceOnlyNestedProposals:inBill.length,
  nestedRejected:inBill.filter(x=>x.disposition==='rejected').length,
  nestedParentAdoptions:inBill.filter(x=>x.disposition==='adopted_to_parent').length,
  nestedOutcomeUnknown:inBill.filter(x=>x.disposition==='unknown').length,
  exactNumberedParentLinks:0,acceptedVotesChanged:0,fullBillAssemblies:0}));
 verificationPhase='hf1_nested_proposal_assertions';
 assert.ok(hf1.byteLength>1000&&inBill.length>=3
  &&inBill.some(x=>x.parentMover==='Lucero'&&x.parentOrdinal==='first')
  &&inBill.some(x=>x.mover==='Maye Quade'&&x.parentMover==='Lucero'&&x.disposition==='adopted_to_parent'));
 verificationPhase='hf1_original_integrity_assertions';
 assert.equal(hf1.byteLength,1_806_101,'Original HF1 journal byte length unexpectedly changed');
 assert.ok(inBill.every(x=>!x.appliesDirectlyToBill&&!x.acceptedVoteEventLinked));
 assert.equal(hf1.pdfSha256,'0604a308854471523dcd282769cfadb45ed403d1ad39383a3d20438393e3fd52',
  'Original HF1 journal PDF SHA differs from independently authenticated source');
 verificationPhase='hf1_v2_nested_source_count';
 assert.equal(inBill.length,18,'HF1 source-only nested v2 original count drift');
 assert.equal(inBill.filter(x=>x.disposition==='rejected').length,16);
 assert.equal(inBill.filter(x=>x.disposition==='adopted_to_parent').length,2);
 verificationPhase='hf7_original_download';
 const hf7=await fetchSenateJournal('https://www.senate.mn/journals/2023-2024/20230202017.pdf');
 verificationPhase='hf7_original_parse';
 const hf7Names=hf7.text.slice(0,hf7.text.indexOf('The President declared')).split('\n')
  .map(x=>x.trim()).filter(x=>/^[A-Z][A-Za-z ]+$/.test(x));
 const hf7Papers=parseNestedSenateSourcePapers(hf7.text,hf7Names).filter(p=>p.billIdentifier==='HF7');
 console.log('SENATE_HF7_NESTED_ORIGINAL_PROOF='+JSON.stringify({
  source:'2023-2024/20230202017.pdf',pdfSha256:hf7.pdfSha256,pdfBytes:hf7.byteLength,
  sourceOnlyProposals:hf7Papers.length,namedBallots:hf7Papers.filter(p=>p.ballotSha256!==null).length,
  distinctPrintedQuestions:new Set(hf7Papers.map(p=>p.questionText)).size,
  parentOrdinalUnknown:hf7Papers.filter(p=>p.parentOrdinal===null).length,
  parentOrdinalKnown:hf7Papers.filter(p=>p.parentOrdinal!==null).length,
  rejected:hf7Papers.filter(p=>p.disposition==='rejected').length,
  acceptedEventLinks:0,fullBillAssemblies:0
 }));
 verificationPhase='hf7_original_integrity_assertions';
 assert.equal(hf7.pdfSha256,'e60b103c2a0ad32dc13b6bb1480fa5197810ce7ecdc2b9480edf97d63ee7060c');
 assert.equal(hf7.byteLength,1_152_045);
 assert.ok(hf7Papers.every(p=>p.sourceStart>=0&&p.sourceEnd<=p.questionStart
  &&p.questionStart<p.questionEnd&&p.questionEnd<=hf7.text.length));
 assert.ok(hf7Papers.every(p=>hf7.text.slice(p.sourceStart,p.sourceEnd)===p.literalText
  &&compact(hf7.text.slice(p.questionStart,p.questionEnd))===p.questionText),
  'HF7 original source spans and question text must round-trip without inference');
 assert.equal(hf7Papers.length,17);
 assert.equal(hf7Papers.filter(p=>p.ballotSha256!==null).length,17);
 assert.equal(new Set(hf7Papers.map(p=>p.questionText)).size,15);
 assert.equal(hf7Papers.filter(p=>p.parentOrdinal===null).length,8);
 assert.equal(hf7Papers.filter(p=>p.parentOrdinal!==null).length,9);
 assert.ok(hf7Papers.every(p=>p.disposition==='rejected'&&!p.appliesDirectlyToBill
  &&!p.acceptedVoteEventLinked&&!p.fullBillTextAssembled&&!p.exactNumberedParentProven));
 assert.ok(hf7Papers.some(p=>p.parentMover==='Rarick'&&p.parentOrdinal===null));
 assert.ok(hf7Papers.some(p=>p.parentMover==='Lucero'&&p.parentOrdinal==='third'));
 for(const [path,expected] of sources){
 verificationPhase=path.includes('20230428')?'hf100_original':path.includes('20210105')?'role_2021_original':path.includes('20230103')?'role_2023_original':'role_2025_original';
 const got=await fetchSenateJournal('https://www.senate.mn/journals/'+path);
 assert.equal(got.pdfSha256,expected,'Original government PDF changed; review before accepting a new source receipt');
 if(path.includes('20230428')){
  const names=got.text.slice(0,got.text.indexOf('The President declared')).split('\n').map(x=>x.trim()).filter(x=>/^[A-Z][A-Za-z ]+$/.test(x));
  const actions=parseJournalPaperActions(got.text,names).filter(a=>a.billIdentifier==='HF100');
  assert.equal(actions.length,8);assert.equal(actions.filter(a=>a.proposedText).length,5);
  assert.equal(actions.filter(a=>a.kind==='amendment'&&a.outcome==='adopted').length,4);
  assert.equal(actions.filter(a=>a.kind==='amendment'&&a.outcome==='rejected').length,1);
  assert.equal(actions.at(-1)!.kind,'passage');assert.equal(actions.at(-1)!.priorAdoptedKeys.length,4);
  const rejected=actions.find(a=>a.kind==='amendment'&&a.outcome==='rejected')!;
  assert.equal(actions.at(-1)!.priorAdoptedKeys.includes(rejected.key),false);
  assert.equal(actions.filter(a=>a.kind==='amendment'&&a.baseLocator==='versions/ue/1/').length,5);
  assert.equal(actions.filter(a=>a.ballotSignature!==null).length,7,
   'Source-authenticated HF100 has seven named Senate divisions, including Pratt 33-34');
  const procedural=actions.filter(a=>a.kind==='procedural'&&a.yeas===33&&a.nays===34);
  assert.equal(procedural.length,2);
  assert.ok(procedural.every(a=>a.ballotSignature!==null),
   'Both distinct 33-34 procedural questions require full source-derived named ballots');
  console.log('SENATE_PAPER_ORIGINAL_PROOF='+JSON.stringify({source:path,sha256:got.pdfSha256,bytes:got.byteLength,actions:8,proposedPapers:5,adopted:4,rejected:1}));
 }else{
  const roles=parseDatedRoleActs(got.text,null,true);
  if(path.includes('20210105'))assert.deepEqual(roles.filter(r=>r.role.includes('Leader')).map(r=>r.senatorName).sort(),['Paul E. Gazelka','Susan Kent']);
  if(path.includes('20230103'))assert.ok(roles.some(r=>r.senatorName==='Bobby Joe Champion'&&r.role==='President'));
  if(path.includes('20250114'))assert.equal(roles.filter(r=>r.role==='Co-Presiding Officer').length,2);
  console.log('SENATE_ROLE_ORIGINAL_PROOF='+JSON.stringify({source:path,sha256:got.pdfSha256,bytes:got.byteLength,datedRoleFacts:roles.length}));
 }
}}
void main().catch(error=>{console.error('SENATE_PAPER_ORIGINAL_PROOF_HELD='+JSON.stringify({phase:verificationPhase,kind:error instanceof Error?error.name:'unknown'}));process.exitCode=1});
