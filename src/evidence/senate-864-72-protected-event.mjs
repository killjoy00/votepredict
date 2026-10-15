/** #864: protected first-attempt push after independent keyless CI only. */
export function assertHistoricalMainPush(env,event){
 const sha=env.GITHUB_SHA||'';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'
  ||env.GITHUB_RUN_ATTEMPT!=='1'
  ||env.VOTEPREDICT_864_72_INDEPENDENT_CI!=='true'
  ||! /^[a-f0-9]{40}$/.test(sha)
  ||event?.ref!=='refs/heads/main'
  ||event?.repository?.full_name!=='killjoy00/votepredict'
  ||event?.after!==sha||event?.head_commit?.id!==sha
  ||event?.deleted===true||event?.forced===true)
  throw Error('Historic 72-page import requires independently reviewed main push');
 return true;
}
