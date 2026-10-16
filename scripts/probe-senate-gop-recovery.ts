/** Validate two concrete first-party GOP inputs before protected Neon write. */
import { readFileSync } from 'node:fs';
import {
  collectDirectArticle, discoverRepublicanMemberPages,
  type SenatePressSource,
} from '../src/sources/minnesota/senate-press-raw.js';

const MISSING='https://www.mnsenaterepublicans.com/kreun-responds-to-attorney-generals-second-opinion-addressing-sro-issues/';
async function main():Promise<void>{
  const data:unknown=JSON.parse(readFileSync('data/senate-press-sources.json','utf8'));
  if(!Array.isArray(data)||data.length!==2)throw Error('Unexpected source inventory');
  const gop=data.find((s:SenatePressSource)=>s.id==='senate_republicans') as SenatePressSource;
  if(gop?.archive_url!=='https://www.mnsenaterepublicans.com/news/')
    throw Error('Unexpected reviewed GOP source');
  const profiles=await discoverRepublicanMemberPages(gop);
  if(profiles.length<20||profiles.length>90)throw Error('Official GOP senator roster inaccessible or incomplete');
  const direct=await collectDirectArticle(gop,MISSING,
    {from:'2023-01-01',to:new Date().toISOString().slice(0,10),dryRun:true,delayMs:1500},
    {existing:async()=>new Set<string>(),insert:async()=>true});
  console.log('SENATE_GOP_PUBLIC_PREFLIGHT='+JSON.stringify({
    linkedSenatorProfiles:profiles.length,
    recoverableMissingArticle:direct.inserted===1,
    failureCount:direct.failures.length,
  }));
  if(direct.inserted!==1||direct.failures.length)throw Error('GOP missed 2023 article not safely recoverable');
}
void main().catch((error:unknown)=>{
  console.error('SENATE_GOP_PUBLIC_PREFLIGHT_FAILED='+
    (error instanceof Error?error.message:'unknown source failure'));
  process.exitCode=1;
});
