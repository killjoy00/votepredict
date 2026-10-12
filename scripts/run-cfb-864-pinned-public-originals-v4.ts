/**
 * Reviewed merged-main, public-only one-shot runner. Prints ONLY strict
 * allowlisted counts/statuses/fingerprints; never finance CSV or row keys.
 */
import {collectPinnedCfbOriginals,validatePinnedV4Receipt}
 from './prove-cfb-864-pinned-public-originals-v4.js';

export function assertPinnedCfbV4MainOnly(env:Record<string,string|undefined>):void{
 const ownerComment=env.GITHUB_EVENT_NAME==='issue_comment'
  &&env.CFB_864_PINNED_V4_OWNER_COMMENT_VERIFIED==='true';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||env.GITHUB_REF!=='refs/heads/main'
   ||env.GITHUB_RUN_ATTEMPT!=='1'
   ||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
   ||env.CFB_864_PINNED_V4_MARKER_VERIFIED!=='true'
   ||!(env.GITHUB_EVENT_NAME==='push'||ownerComment))
  throw Error('Only reviewed merged main first-attempt public source jobs permitted');
}
async function main(){
 if(process.argv.length!==2)throw Error('No public source runner arguments allowed');
 assertPinnedCfbV4MainOnly(process.env);
 try{
  const value=validatePinnedV4Receipt(await collectPinnedCfbOriginals());
  const safe=JSON.stringify(value);
  if(safe.length>18000)throw Error('Oversized proof receipt');
  console.log('CFB_864_PINNED_V4_PUBLIC_PROOF '+safe);
 }catch{
  // May be interrupted by network or parser error; never print raw details.
  console.error('CFB_864_PINNED_V4_PUBLIC_PROOF_HELD');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
  .endsWith('/run-cfb-864-pinned-public-originals-v4.ts'))
 void main();
