/** Same protected main revision for initial repair and bounded continuation. */
export function assertEvidenceRepairRun(env:NodeJS.ProcessEnv,event:{
 ref?:string;after?:string;forced?:boolean;deleted?:boolean;schedule?:string;
 repository?:{full_name?:string;default_branch?:string};head_commit?:{id?:string;message?:string};
}):void{
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||env.GITHUB_REF!=='refs/heads/main'
   ||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/senate-evidence-repair-production.yml@refs/heads/main'
   ||env.GITHUB_RUN_ATTEMPT!=='1'||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
   ||env.VOTEPREDICT_SENATE_EVIDENCE_REPAIR_INDEPENDENT_CI!=='true'
   ||event.repository?.full_name!=='killjoy00/votepredict')throw Error('Unreviewed repair source');
 if(env.GITHUB_EVENT_NAME==='schedule'){
   if(event.schedule!=='23 * * * *'||event.repository.default_branch!=='main')throw Error('Unexpected repair schedule');
 }else if(env.GITHUB_EVENT_NAME==='push'){
   if(event.ref!=='refs/heads/main'||event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA
     ||event.forced===true||event.deleted===true
     ||!event.head_commit?.message?.includes('SENATE_EVIDENCE_REPAIR_PRODUCTION'))throw Error('Unreviewed repair push');
 }else throw Error('Unsupported repair trigger');
}
