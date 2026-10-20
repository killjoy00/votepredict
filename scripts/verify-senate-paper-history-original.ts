/** Keyless primary-source canary. Prints counts/hashes, never raw source bodies. */
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseJournalPaperActions} from '../src/operations/senate-vote-paper-parser.js';
import {parseDatedRoleActs} from '../src/operations/senate-vote-paper-backfill.js';
import {fetchCanonicalGovernmentSource,boundedBody,statedAssignmentDate} from '../src/operations/senate-history-archive.js';
import {parseSenateAssignmentPdfText} from '../src/sources/minnesota/senate-assignment-pdf.js';
import {getMinnesotaHouseSession} from '../src/sources/minnesota/sessions.js';
import {hash} from '../src/operations/senate-vote-paper-parser.js';
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
async function main(){await verifyCanonicalSources();for(const [path,expected] of sources){
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
void main().catch(()=>{console.error('SENATE_PAPER_ORIGINAL_PROOF_HELD');process.exitCode=1});
