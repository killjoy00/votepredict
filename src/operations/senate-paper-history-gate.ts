export const PAPER_HISTORY_MARKER='SENATE_PAPER_HISTORY_PRODUCTION';
export function assertPaperHistoryRun(env:NodeJS.ProcessEnv,event:{repository?:{full_name?:string;default_branch?:string};ref?:string;after?:string;forced?:boolean;deleted?:boolean;schedule?:string;head_commit?:{id?:string;message?:string}}){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||event.repository?.full_name!=='killjoy00/votepredict'
  ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
  ||env.GITHUB_WORKFLOW_REF!==`killjoy00/votepredict/.github/workflows/senate-paper-history-production.yml@refs/heads/main`
  ||env.VOTEPREDICT_SENATE_PAPER_HISTORY_INDEPENDENT_CI!=='true')throw Error('Independent protected main check required');
 if(env.GITHUB_EVENT_NAME==='schedule'){
  if(event.schedule!=='11 * * * *'||event.repository.default_branch!=='main')throw Error('Unexpected history schedule');
  return;
 }
 if(env.GITHUB_EVENT_NAME!=='push'||event.ref!=='refs/heads/main'||event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA
  ||event.forced||event.deleted||!event.head_commit?.message?.includes(PAPER_HISTORY_MARKER))throw Error('Reviewed history marker merge required');
}
