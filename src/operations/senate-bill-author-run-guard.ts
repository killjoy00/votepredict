/**
 * Narrow production launch gate for a protected, main-only raw author collector.
 * A reviewed merge may trigger one immediate run; trusted GitHub schedule
 * events run the same independently verified, protected workflow thereafter.
 */
const REPO='killjoy00/votepredict';
const MARKER='SENATE_BILL_AUTHORS_PRODUCTION';
const JOURNAL_ONLY_MARKER='SENATE_BILL_AUTHORS_JOURNALS_ONLY';
export const SENATE_BILL_AUTHORS_SCHEDULE='37 */2 * * *';
const WORKFLOW_REF=REPO+'/.github/workflows/senate-bill-authors-production.yml@refs/heads/main';

export interface SenateBillAuthorsGitHubEvent {
  ref?:string;
  after?:string;
  deleted?:boolean;
  forced?:boolean;
  schedule?:string;
  repository?:{full_name?:string;default_branch?:string};
  head_commit?:{id?:string;message?:string};
}

/**
 * Returns journal-only mode (true) only for reviewed first-attempt main pushes
 * with the separate journal marker. Scheduled runs are bills-only.
 * Every accepted launch must have passed this run's independent-main job.
 */
export function authorizeSenateBillAuthorsRun(
  env:NodeJS.ProcessEnv,event:SenateBillAuthorsGitHubEvent,
):boolean {
  if(env.GITHUB_REPOSITORY!==REPO ||
    env.GITHUB_REF!=='refs/heads/main' ||
    env.GITHUB_RUN_ATTEMPT!=='1' ||
    env.VOTEPREDICT_SENATE_BILL_AUTHORS_INDEPENDENT_CI!=='true' ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'') ||
    event.repository?.full_name!==REPO)
    throw Error('Exact first-attempt reviewed main and independent CI required');

  if(env.GITHUB_EVENT_NAME==='schedule'){
    if(event.schedule!==SENATE_BILL_AUTHORS_SCHEDULE ||
      event.repository?.default_branch!=='main' ||
      env.GITHUB_WORKFLOW_REF!==WORKFLOW_REF ||
      event.deleted===true || event.forced===true)
      throw Error('Unrecognized schedule, workflow origin or default branch');
    return false;
  }

  if(env.GITHUB_EVENT_NAME!=='push' ||
    event.ref!=='refs/heads/main' ||
    event.after!==env.GITHUB_SHA ||
    event.head_commit?.id!==env.GITHUB_SHA ||
    event.deleted===true || event.forced===true ||
    !event.head_commit.message?.includes(MARKER))
    throw Error('Commit is not exact reviewed first main push with required marker');
  return event.head_commit.message.includes(JOURNAL_ONLY_MARKER);
}
