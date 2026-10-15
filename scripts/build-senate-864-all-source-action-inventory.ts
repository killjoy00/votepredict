/**
 * #864 source-only original action inventory across all 2022-25 committee
 * dates. Consumes immutable 1592-event ledger artifact plus original Clerk
 * and unlinked-PDF source receipts already independently authenticated.
 *
 * Usage: node --import tsx scripts/build-senate-864-all-source-action-inventory.ts
 *  --index-ledger artifacts/1592-official-meetings-to-source-action-candidates.json
 *  --output artifacts/all-2022-25-independent-committee-action-inventory.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {buildSenate864AllSourceActionInventory} from
 '../src/evidence/senate-864-all-source-action-inventory.js';
const ROOT='docs/evaluation/source-proof/';
function args(){
 const a=process.argv.slice(2);
 if(a.length!==4||a[0]!=='--index-ledger'||a[2]!=='--output'||!a[1]||!a[3])
  throw Error('Required exact --index-ledger and --output');
 const input=resolve(a[1]),output=resolve(a[3]);
 if(input===output)throw Error('Original indexed action ledger must not be overwritten');
 return {input,output};
}
function load(path:string,max=6_000_000){
 const bytes=readFileSync(path);
 if(bytes.byteLength<40||bytes.byteLength>max)
  throw Error('Original verified source ledger absent or outside bounded size');
 return JSON.parse(bytes.toString('utf8'));
}
function main(){
 const {input,output}=args();
 const audit=buildSenate864AllSourceActionInventory({
  indexed:load(input,11_000_000),
  gaps:load(ROOT+'senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json'),
  first2023:load(ROOT+'senate-864-2023-64-no-lrl-pdf-to-senate-clerk-original-html-crosswalk.json'),
  later2023:load(ROOT+'senate-864-2023-fifty-original-clerk-three-run-union-receipts.json'),
  highGap:load(ROOT+'senate-864-three-high-gap-2024-25-original-source-receipts-v2.json'),
  other:load(ROOT+'senate-864-2022-24-25-other-24-original-clerk-two-run-source-receipts.json')
 });
 const text=JSON.stringify(audit,null,2)+'\n';
 if(text.length>4_000_000||/\b(?:sourceMemberName|normalized_member_name|membership_id|choiceIdentitySha256|postgresql:\/\/)\b/i.test(text))
  throw Error('Public original-source action audit must not contain individual member values or credentials');
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,text);
 const {perIndexedMeeting,...summary}=audit;
 const body=JSON.stringify(summary);
 if(body.length>10_000)throw Error('Unexpected large source-only audit console summary');
 console.log('SENATE864_ALL_2022_25_ORIGINAL_ACTION_SOURCE_SUMMARY='+body);
}
try{main()}catch(error){
 // All permitted error labels are static literals compiled into the reviewed
 // source-only verifier. Never reveal an underlying source row/URL/name or a
 // dynamic system error, path or credential in the public CI job log.
 const source=readFileSync('src/evidence/senate-864-all-source-action-inventory.ts','utf8');
 const labels=new Set([...source.matchAll(/throw Error\\('([^']+)'\\)/g)].map(m=>m[1]));
 const message=error instanceof Error?error.message:'';
 const safe=labels.has(message)?message.replaceAll(' ','_'):'unclassified_source_or_cli_failure';
 console.error('SENATE864_ALL_2022_25_ORIGINAL_ACTION_SOURCE_HOLD='+safe);
 process.exitCode=1;
}
