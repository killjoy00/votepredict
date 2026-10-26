export function assertForecastEvidenceRemediationRun(env:NodeJS.ProcessEnv,event:Record<string,unknown>):void {
  const head=event.head_commit as {id?:string;message?:string}|undefined;
  const repository=event.repository as {full_name?:string;default_branch?:string}|undefined;
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||repository?.full_name!==env.GITHUB_REPOSITORY||repository.default_branch!=='main'
    ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_RUN_ATTEMPT!=='1'
    ||env.GITHUB_WORKFLOW_REF!=='killjoy00/votepredict/.github/workflows/forecast-evidence-remediation.yml@refs/heads/main'
    ||env.VOTEPREDICT_REMEDIATION_CI!=='true'||event.after!==env.GITHUB_SHA||head?.id!==env.GITHUB_SHA
    ||event.forced===true||event.deleted===true||!head?.message?.includes('FORECAST_EVIDENCE_REMEDIATION'))
    throw Error('Reviewed-main remediation gate failed');
}
