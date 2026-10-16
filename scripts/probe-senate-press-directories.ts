/** Keyless check of actual first-party senator/member listings before Neon writes. */
import { readFileSync } from 'node:fs';
import {
  discoverRepublicanMemberPages, collectSource, type SenatePressSource,
} from '../src/sources/minnesota/senate-press-raw.js';

async function main():Promise<void>{
  const raw:unknown=JSON.parse(readFileSync('data/senate-press-sources.json','utf8'));
  if(!Array.isArray(raw)||raw.length!==2)throw Error('Unexpected source catalog size');
  const dfl=raw.find((x:SenatePressSource)=>x.id==='senate_dfl') as SenatePressSource;
  const gop=raw.find((x:SenatePressSource)=>x.id==='senate_republicans') as SenatePressSource;
  if(dfl.archive_url!=='https://senatedfl.mn/press-releases/'
    || gop.archive_url!=='https://www.mnsenaterepublicans.com/news/')
    throw Error('Unexpected first-party source origins');
  const profilePages=await discoverRepublicanMemberPages(gop);
  if(profilePages.length<20||profilePages.length>90)
    throw Error('Senate GOP profile listing missing or unreasonably sized');
  const dflPreview=await collectSource(dfl,{
    from:'2023-01-01',to:new Date().toISOString().slice(0,10),
    maxPages:1,dryRun:true,delayMs:1500,
  },{existing:async()=>new Set<string>(),insert:async()=>true});
  if(dflPreview.failures.length||!dflPreview.member_archives.length||dflPreview.discovered<1)
    throw Error('DFL first-party release/author listing unavailable');
  console.log('SENATE_MEMBER_LISTING_SMOKE='+JSON.stringify({
    gopMemberPages:profilePages.length,
    dflNamedAuthorArchives:dflPreview.member_archives.length,
    dflRecentArticles:dflPreview.discovered,
  }));
}
void main().catch(()=>{
  console.error('SENATE_MEMBER_LISTING_SMOKE_FAILED');
  process.exitCode=1;
});
