/**
 * #864 source-only cue summaries. Counts are caption phrase/time review locations,
 * NEVER original distinct committee motions, Senate member votes, or bill stances.
 * Named fields are validated so a stale v1 property cannot become NaN -> null.
 */
export function summarizeStrictCaptionCueRows(rows:readonly Record<string,unknown>[]){
 let sourceCueWindowsTotal=0,sourceCueWindowsInReviewPacket=0,
     sourceCueWindowsOmittedByDisplayCap=0;
 for(const row of rows){
  const total=row.categoryThirtySecondWindowsNotDistinctMotions;
  const overflow=row.cueWindowsAboveOutputCap;
  const windows=row.sourceReviewCueTimeWindows;
  if(!Number.isSafeInteger(total)||Number(total)<0
    ||!Number.isSafeInteger(overflow)||Number(overflow)<0
    ||!Array.isArray(windows)
    ||windows.length+Number(overflow)!==Number(total))
   throw Error('Original strict caption cue row missing v2 fields or inconsistent category window totals');
  sourceCueWindowsTotal+=Number(total);
  sourceCueWindowsInReviewPacket+=windows.length;
  sourceCueWindowsOmittedByDisplayCap+=Number(overflow);
 }
 if(![sourceCueWindowsTotal,sourceCueWindowsInReviewPacket,
  sourceCueWindowsOmittedByDisplayCap].every(Number.isSafeInteger))
  throw Error('Strict caption cue total is not a safe integer');
 return {
  sourceCueWindowsTotal,sourceCueWindowsInReviewPacket,
  sourceCueWindowsOmittedByDisplayCap,
  cueWindowTotalNotDistinctMotionsOrMemberVotes:true,
 };
}
