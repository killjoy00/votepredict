/**
 * Bounded, fresh-connection verification after individual RAW captures commit.
 *
 * A stale/terminated production connection must not erase a successfully
 * committed batch's operational receipt. Never retry a detected vote-count
 * mismatch: that is a hard safety failure, not a transient SQL problem.
 * Error categories are fixed strings; never emit SQL, source text or secrets.
 */
export type SafeReadbackFailure =
  'vote_count_mismatch'|'statement_timeout'|'connection_failure'|
  'query_timeout'|'readback_error';

export function classifyReadbackFailure(error:unknown):SafeReadbackFailure {
  const message=error instanceof Error?error.message:'';
  if(message==='forbidden_live_vote_counts_changed')return 'vote_count_mismatch';
  const code=typeof error==='object'&&error!==null&&
    typeof (error as {code?:unknown}).code==='string'
    ?(error as {code:string}).code:'';
  if(code==='57014')return 'statement_timeout';
  if(['08000','08003','08006','57P01','57P02','57P03',
      'ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT'].includes(code)
    ||/connection.*(terminated|closed|reset)/i.test(message))
    return 'connection_failure';
  if(/query read timeout|query.*timed out|timeout exceeded/i.test(message))
    return 'query_timeout';
  return 'readback_error';
}

type Releasable={release:(destroy?:boolean)=>void};

/**
 * Reconnect at most twice for a read-only verification failure. The caller
 * must perform both the immutable vote-count invariant and all readbacks
 * inside `verify`. No raw writes are repeated and failures remain fatal.
 */
export async function withFreshPostCommitReadback<C extends Releasable,T>(
  connect:()=>Promise<C>,
  verify:(client:C)=>Promise<T>,
  onFailure:(attempt:number,kind:SafeReadbackFailure)=>void,
  backoff:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,1000)),
):Promise<T>{
  for(let attempt=1;attempt<=3;attempt++){
    let client:C|undefined;
    try{
      client=await connect();
      return await verify(client);
    }catch(error){
      const kind=classifyReadbackFailure(error);
      onFailure(attempt,kind);
      if(kind==='vote_count_mismatch'||attempt===3)throw error;
    }finally{
      // Always dispose the old session (including a failed/aborted transaction).
      if(client)client.release(true);
    }
    await backoff();
  }
  throw Error('unreachable_readback_attempt_limit');
}
