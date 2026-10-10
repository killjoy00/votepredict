/**
 * #864 C: local, opt-in Senate primary ballot identity comparison only.
 * Example: node --import tsx scripts/audit-senate-primary-ballot-observations-offline.ts --output /tmp/senate-primary.json
 * Optional --memberships <authorized SELECT-only JSONL> and --2022-cand-file/--2024-cand-file.
 * No fetching, database connections, site crawling, writes except the named immutable output.
 */
import { mkdirSync,readFileSync,statSync,writeFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import {
  auditSenatePrimaryBallotObservations,
  parseSosSenateElectionCandidateRoster,
  type PrimaryBallotManifest,
  type PrimaryBallotCandidate,
} from '../src/evidence/senate-primary-ballot-observation-audit.js';
import type { SenateSosSeedManifest,SenateMembershipExport } from '../src/evidence/sos-senate-historical-candidate-inventory.js';

function flag(name:string):string|undefined{
  const args=process.argv.slice(2);
  const at=args.indexOf(name);
  const value=at>=0?args[at+1]:args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
  return value && !value.startsWith('--')?value:undefined;
}
function boundedText(file:string,limit:number):string{
  const resolved=resolve(file);
  if(statSync(resolved).size>limit)throw new Error('Offline input exceeds cap: '+resolved);
  return readFileSync(resolved,'utf8');
}
function membershipsFromJsonl(file:string):SenateMembershipExport[]{
  const text=boundedText(file,16*1024*1024);
  const rows:SenateMembershipExport[]=[];
  for(const [index,line] of text.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    if(rows.length>=1000)throw new Error('Membership export exceeds 1,000 rows');
    let candidate:unknown;
    try{candidate=JSON.parse(line);}catch{throw new Error('Bad JSONL row '+(index+1));}
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
      throw new Error('Unexpected membership row '+(index+1));
    const m=candidate as Record<string,unknown>;
    if(typeof m.membershipId!=='string'||typeof m.senatorName!=='string'
      ||typeof m.sessionSlug!=='string'||typeof m.district!=='string'
      ||typeof m.recordedIssuePositionItems!=='number')throw new Error('Incomplete membership row '+(index+1));
    rows.push({
      membershipId:m.membershipId,senatorName:m.senatorName,
      sessionSlug:m.sessionSlug as SenateMembershipExport['sessionSlug'],
      district:m.district,recordedIssuePositionItems:m.recordedIssuePositionItems,
    });
  }
  return rows;
}
function cleanCandidateSignature(c:PrimaryBallotCandidate):string{
  return [c.sourceId,c.district,c.candidateName,c.partyCode,c.sosCandidateId,c.sosOfficeId].join('\u0000');
}
function main(){
  const output=flag('--output');
  if(!output)throw new Error('--output required');
  const primaryPath=flag('--primary-manifest')??'data/evaluation/senate-primary-ballot-candidate-observations-2022-24-v1.json';
  const winnerPath=flag('--winner-manifest')??'data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json';
  const memberPath=flag('--memberships');
  const file22=flag('--2022-cand-file');
  const file24=flag('--2024-cand-file');
  const target=resolve(output);
  const inputs=[primaryPath,winnerPath,memberPath,file22,file24].filter((x):x is string=>Boolean(x)).map(x=>resolve(x));
  if(inputs.includes(target))throw new Error('Refusing to overwrite input');
  const primary=JSON.parse(boundedText(primaryPath,4*1024*1024)) as PrimaryBallotManifest;
  const winners=JSON.parse(boundedText(winnerPath,4*1024*1024)) as SenateSosSeedManifest;
  const members=memberPath?membershipsFromJsonl(memberPath):undefined;
  const report=auditSenatePrimaryBallotObservations(primary,winners,members);
  const localChecks=[] as Array<{year:number;localSourceSha256:string;senateRowsCompared:number;exactManifestIdentityMatch:boolean;provesGovernmentOriginalBytes:boolean}>;
  for(const [year,file] of [[2022,file22],[2024,file24]] as const){
    if(!file)continue;
    const sourceId=year===2022?'sos-2022-08-09-senate-primary-candidates':'sos-2024-08-13-sd45-primary-candidates';
    const text=boundedText(file,10*1024*1024);
    const parsed=parseSosSenateElectionCandidateRoster(text,{sourceId,year});
    if(parsed.rejectedInvalidSenateLines!==0)throw new Error('Malformed Senate rows in '+year+' input: '+parsed.rejectedInvalidSenateLines);
    const actual=parsed.candidates.map(cleanCandidateSignature).sort();
    const pinned=primary.candidates.filter(c=>c.sourceId===sourceId).map(cleanCandidateSignature).sort();
    if(JSON.stringify(actual)!==JSON.stringify(pinned))throw new Error(year+' local candidate text differs from pinned observed roster');
    localChecks.push({year,localSourceSha256:parsed.originalLocalSha256,
      senateRowsCompared:actual.length,exactManifestIdentityMatch:true,provesGovernmentOriginalBytes:false});
  }
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify({...report,localSnapshotIdentityChecks:localChecks},null,2)+'\n',
    {encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(JSON.stringify({output:target,counts:report.counts,
    zeroCoverageIdentities:memberPath?'scoped_to_supplied_read_only_export':'unknown_not_zero',
    historicalCampaignPlatformStatementsVerified:0},null,2));
}
main();
