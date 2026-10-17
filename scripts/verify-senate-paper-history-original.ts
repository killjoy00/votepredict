/** Keyless primary-source canary. Prints counts/hashes, never raw source bodies. */
import assert from 'node:assert/strict';
import {fetchSenateJournal} from '../src/sources/minnesota/senate-journals.js';
import {parseJournalPaperActions} from '../src/operations/senate-vote-paper-parser.js';
import {parseDatedRoleActs} from '../src/operations/senate-vote-paper-backfill.js';
const sources=[
 ['2023-2024/20230428059.pdf','9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3'],
 ['2021-2022/2021010501.pdf','78f953dbef770ccc1227769d56f927f9162bb8cb27e2e1d959d408055b557da0'],
 ['2023-2024/2023010301.pdf','acd85130c83ed912a47556f30d71c4b486dea05f3dd981194fb71b6062a10331'],
 ['2025-2026/2025011401.pdf','222a49149029fc6e0b689828b553cce96cd3c78cde2a31e5e8bed6332f159d74'],
] as const;
async function main(){for(const [path,expected] of sources){
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
