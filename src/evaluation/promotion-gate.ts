export function coalitionPromotionBlockers(input:{knownOutcomes:number;failed:number;candidateBrier:number|null;baselineBriers:Array<number|null>;coverage80:number|null;freshTest:boolean;verifiedRules:boolean;slicesReviewed:boolean}):string[] {
  const blockers:string[]=[];
  if(!input.freshTest)blockers.push('A fresh, untouched final test window is required.');
  if(!input.verifiedRules)blockers.push('Dated official passage rules are not verified.');
  if(!input.slicesReviewed)blockers.push('House/Senate, session, gambling and close-vote slice review is required.');
  if(input.knownOutcomes<30 || input.failed<5 || input.knownOutcomes-input.failed<5)blockers.push('Insufficient verified positive and negative test outcomes (minimum 30 total, 5 per class).');
  if(input.baselineBriers.length<3 || input.candidateBrier===null || !Number.isFinite(input.candidateBrier) || input.baselineBriers.some(b=>b===null || !Number.isFinite(b) || input.candidateBrier!>=b))blockers.push('Candidate must beat every required baseline on held-out passage Brier.');
  if(input.coverage80===null || !Number.isFinite(input.coverage80) || Math.abs(input.coverage80-0.8)>0.05)blockers.push('Nominal 80% interval coverage must fall within 75–85% on held-out data.');
  return blockers;
}
