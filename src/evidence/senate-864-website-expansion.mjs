/** Fixed v2 addition; frozen v1 identities and evidence flags remain unchanged. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {websiteExcerptPlan,websiteExcerptPlanV1} from './senate-864-historical-site-excerpt-asof.mjs';
import {SOURCE_LEDGER_FILES} from './senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from '../../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const EXPANSION_MARKER='SENATE864_WEBSITE_52_SOURCE_VERIFIED_IMPORT_V2';
export const PROTOCOL_V2='docs/evaluation/senate-864-website-experiment-protocol-v2.json';
export function expansionInputs(){
 const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json'));
 const docs=new Map(SOURCE_LEDGER_FILES.map(p=>[p,JSON.parse(readFileSync(p))]));
 const originals=buildRecoveryPlan().witnesses;
 const old=websiteExcerptPlanV1(manifest,docs,originals),current=websiteExcerptPlan(manifest,docs,originals);
 const oldKeys=new Set(old.ready.map(r=>r.ingestionIdentityKey)),lookup=new Map(current.ready.map(r=>[r.ingestionIdentityKey,r]));
 if(old.ready.length!==616||current.ready.length!==668||current.holds.length!==529||old.ready.some(r=>JSON.stringify(lookup.get(r.ingestionIdentityKey))!==JSON.stringify(r)))throw Error('Frozen source plan drift');
 const added=current.ready.filter(r=>!oldKeys.has(r.ingestionIdentityKey));
 if(added.length!==52||new Set(added.map(r=>r.sourceSha)).size!==4||new Set(added.map(r=>r.ordinal)).size!==3)throw Error('Unreviewed website expansion');
 const v1=sha(readFileSync('docs/evaluation/senate-864-website-experiment-protocol-v1.json'));
 if(v1!=='ba6b6bddc901fb26f2ea19897bf855a25d9f6b3ca81d9de5b3fedfb78eeff43b')throw Error('Frozen protocol v1 changed');
 return {manifest,old,current,added,oldKeys,sourcePlanSha256:sha(JSON.stringify(current.ready))};
}
// Selected original files are explicit page receipts, never filename-inferred dates.
export const ADDITIONAL_ORIGINALS=[
 {artifact:11710856244,file:'eichornissue-original-20160806111245-0.html',ordinalName:'Justin D. Eichorn'},
 {artifact:11709436801,file:'two20b-01-archive-20200814193005-3.html',ordinalName:'Kent Eken'},
 {artifact:11710110948,file:'billissue-original-20100724205547-0.html',ordinalName:'Bill G. Ingebrigtsen'},
 {artifact:11710110948,file:'billissue-original-20121106235157-1.html',ordinalName:'Bill G. Ingebrigtsen'},
];
export function visibleLiteralText(html){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…',bull:'•',copy:'©'};
 return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')
 .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,k)=>{
  if(k[0]==='#'){const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):all;}
  return entities[k]??all;
 }).normalize('NFC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
}
export function verifyAddedLiterals(bytes,rows){
 const text=visibleLiteralText(bytes.toString('utf8'));
 return rows.every(r=>text.includes(visibleLiteralText(r.literal)));
}
