/**
 * #864 Workstream C. Local deterministic 2025 special Senate candidate audit.
 * node --import tsx scripts/audit-senate-2025-special-primary-offline.ts
 *     --output /tmp/senate-2025-primary-gap.json
 *     [--memberships /path/to/explicitly-authorized-SELECT-only.jsonl]
 *     [--candidate-file /path/to/20250826-cand.txt]
 * No production database, network, model or scheduler interactions.
 */
import { mkdirSync,readFileSync,statSync,writeFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { audit2025SenateSpecialPrimary,
  type SpecialPrimaryManifest } from '../src/evidence/senate-2025-special-primary-audit.js';
import type { SenateMembershipExport,SenateSosSeedManifest } from '../src/evidence/sos-senate-historical-candidate-inventory.js';
function flag(name:string):string|undefined{
  const args=process.argv.slice(2),i=args.indexOf(name);
  const value=i>=0?args[i+1]:args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
  return value&&!value.startsWith('--')?value:undefined;
}
function textFile(path:string,maximum:number):string{
  const absolute=resolve(path);
  if(statSync(absolute).size>maximum)throw new Error('Input file too large');
  return readFileSync(absolute,'utf8');
}
function parseJsonl(file:string):SenateMembershipExport[]{
  const rows:SenateMembershipExport[]=[];
  const txt=textFile(file,16*1024*1024);
  for(const [i,line] of txt.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    if(rows.length>=1000)throw new Error('Membership export exceeds 1000 rows');
    let obj:unknown;
    try{obj=JSON.parse(line);}catch{throw new Error('Invalid membership JSONL row '+(i+1));}
    if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('Bad membership row');
    const m=obj as Record<string,unknown>;
    if(typeof m.membershipId!=='string'||typeof m.senatorName!=='string'
      ||typeof m.sessionSlug!=='string'||typeof m.district!=='string'
      ||typeof m.recordedIssuePositionItems!=='number')throw new Error('Incomplete membership export');
    rows.push({membershipId:m.membershipId,senatorName:m.senatorName,
      sessionSlug:m.sessionSlug as SenateMembershipExport['sessionSlug'],
      district:m.district,recordedIssuePositionItems:m.recordedIssuePositionItems});
  }
  return rows;
}
function run(){
  const outfile=flag('--output');
  if(!outfile)throw new Error('--output required');
  const manifestPath=flag('--source-manifest')??'data/evaluation/senate-2025-special-primary-candidate-observations-v1.json';
  const winnerPath=flag('--winner-manifest')??'data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json';
  const membershipPath=flag('--memberships');
  const candidatePath=flag('--candidate-file');
  const output=resolve(outfile);
  if([manifestPath,winnerPath,membershipPath,candidatePath].filter((x):x is string=>!!x)
    .some(x=>resolve(x)===output))throw new Error('Refusing to overwrite input file');
  const manifest=JSON.parse(textFile(manifestPath,3*1024*1024)) as SpecialPrimaryManifest;
  const winner=JSON.parse(textFile(winnerPath,4*1024*1024)) as SenateSosSeedManifest;
  const memberships=membershipPath?parseJsonl(membershipPath):undefined;
  const candidateRaw=candidatePath?textFile(candidatePath,1_000_000):undefined;
  const result=audit2025SenateSpecialPrimary(manifest,winner,memberships,candidateRaw);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(JSON.stringify({output,counts:result.counts,
    memberLevelGapPopulation:membershipPath?'from_supplied_authorized_export':'unknown_not_zero',
    historicalIssueStatementsVerified:0},null,2));
}
run();
