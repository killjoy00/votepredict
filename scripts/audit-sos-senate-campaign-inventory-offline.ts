/**
 * #864 C: credential-free and fully offline.
 * node --import tsx scripts/audit-sos-senate-campaign-inventory-offline.ts \
 *    --output /path/to/report.json \
 *    [--memberships /path/to/explicitly-authorized-SELECT-only-export.jsonl] \
 *    [--candidate-file /path/to/historical-sos-file.txt \
 *     --file-year 2022 --file-source-url https://...]
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  auditSenateSosWebsiteSeedInventory,
  parseHistoricalSosSenateCandidateFile,
  type SenateMembershipExport,
  type SenateSosSeedManifest,
} from '../src/evidence/sos-senate-historical-candidate-inventory.js';

const DEFAULT_LEDGER = 'data/evaluation/senate-sos-campaign-website-seeds-2021-25-v1.json';
function argument(name:string):string | undefined {
  const args=process.argv.slice(2);
  const index=args.indexOf(name);
  const value=index>=0?args[index+1]:args.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  return value && !value.startsWith('--') ? value : undefined;
}
function boundedText(path:string, maxBytes:number):string {
  const file=resolve(path);
  if(statSync(file).size>maxBytes)throw new Error('Offline input exceeds byte cap');
  return readFileSync(file,'utf8');
}
function parseMembershipExport(file:string):SenateMembershipExport[] {
  const text=boundedText(file,16*1024*1024);
  const rows:SenateMembershipExport[]=[];
  for(const [i,line] of text.split(/\r?\n/).entries()) {
    if(!line.trim())continue;
    if(rows.length>=1000)throw new Error('Membership export exceeds 1,000 record cap');
    let value:unknown;
    try{value=JSON.parse(line);}catch{throw new Error('Invalid JSONL row '+(i+1));}
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid membership export record');
    const record=value as Record<string,unknown>;
    if(typeof record.membershipId!=='string'||typeof record.senatorName!=='string'
      ||typeof record.sessionSlug!=='string'||typeof record.district!=='string'
      ||typeof record.recordedIssuePositionItems!=='number')
      throw new Error('Missing membership export field at row '+(i+1));
    rows.push({
      membershipId:record.membershipId,senatorName:record.senatorName,
      sessionSlug:record.sessionSlug as SenateMembershipExport['sessionSlug'],
      district:record.district,recordedIssuePositionItems:record.recordedIssuePositionItems,
    });
  }
  return rows;
}
function main(){
  const outputFlag=argument('--output');
  if(!outputFlag)throw new Error('--output is required');
  const ledgerFlag=argument('--ledger')??DEFAULT_LEDGER;
  const manifest=JSON.parse(boundedText(ledgerFlag,4*1024*1024)) as SenateSosSeedManifest;
  const membershipsPath=argument('--memberships');
  const memberships=membershipsPath?parseMembershipExport(membershipsPath):undefined;
  const candidateFilePath=argument('--candidate-file');
  const year=argument('--file-year'),url=argument('--file-source-url');
  if(candidateFilePath&&(!year||!url))throw new Error('Historical candidate-file requires --file-year and --file-source-url');
  if(!candidateFilePath&&(year||url))throw new Error('Candidate-file provenance without input file');
  const candidateFile=candidateFilePath
    ? parseHistoricalSosSenateCandidateFile(boundedText(candidateFilePath,32*1024*1024),{
      electionYear:Number(year),officialFileUrl:url!,
      capturedAt:null,externallyVerifiedOfficialCapture:false,
    }):undefined;
  const report=auditSenateSosWebsiteSeedInventory(manifest,memberships,candidateFile?.rows??[]);
  const target=resolve(outputFlag);
  const sourcePaths=[ledgerFlag,membershipsPath,candidateFilePath]
    .filter((x):x is string=>Boolean(x)).map(x=>resolve(x));
  if(sourcePaths.includes(target))throw new Error('Refusing to overwrite an input file');
  mkdirSync(dirname(target),{recursive:true});
  const output={...report,providedCandidateFile: candidateFile?{
    electionYear:Number(year),sourceUrl:url,localFileSha256:candidateFile.sourceSha256,
    senateCandidateRows:candidateFile.rows.length,rejectedMalformedRows:candidateFile.rejectedMalformedRows,
    sourceBytesIndependentlyAuthenticated:false,
    historicalDisclosureProof:false,
  }:null};
  writeFileSync(target,JSON.stringify(output,null,2)+'\n',{encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(JSON.stringify({output:target,counts:report.counts,certifiedHistoricalCampaignWebsites:0,
    membershipPriorityStatus:memberships?'ranked_from_supplied_export':'unranked_no_export'},null,2));
}
main();
