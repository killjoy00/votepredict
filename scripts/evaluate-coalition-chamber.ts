import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { evaluateChronologicalMemberModel, type MemberModelObservation } from '../src/evaluation/member-model.js';
import { simulateChamber, simulateCoalitionChamber, type CoalitionSimulationOptions } from '../src/forecasting/chamber.js';
import { brierScore, logLoss, expectedCalibrationError } from '../src/evaluation/metrics.js';
import type { GamblingBillFeatures } from '../src/gambling/policy.js';
import { coalitionPromotionBlockers } from '../src/evaluation/promotion-gate.js';

type Event = { id: string; date: string; session: string; chamber: string; yes: number; no: number; passed: boolean | null; members: Array<[number, string, string | null]>; gambling: GamblingBillFeatures | null };
const args = process.argv.slice(2);
const arg = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const train = arg('train'); const validation = arg('validation'); const test = arg('test');
if (!train || !validation || !test || new Set([train, validation, test]).size !== 3) throw new Error('Specify distinct --train=SESSION --validation=SESSION --test=SESSION');
const simulations = Number(arg('simulations') ?? 1000);
if (!Number.isInteger(simulations) || simulations < 1000) throw new Error('simulations must be >=1000');
const input = arg('input');
const db = input ? undefined : new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });

async function main() {
  const events: Event[] = input ? JSON.parse(readFileSync(input, 'utf8')) : (await db!.query(readFileSync(new URL('./chamber-evaluation.sql', import.meta.url), 'utf8'))).rows;
  events.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const windows = [train, validation, test].map(s => events.filter(e => e.session === s));
  if (windows.some(w => !w.length) || windows[0].at(-1)!.date >= windows[1][0].date || windows[1].at(-1)!.date >= windows[2][0].date) throw new Error('Session windows must exist, be chronological, and not overlap');
  const included = events.filter(e => [train, validation, test].includes(e.session));
  const observations: MemberModelObservation[] = included.flatMap(e => e.members.map(([id,party,choice]) => ({
    observationId: `${e.id}:${id}`, voteEventId:e.id, memberId:String(id), party, occurredAt:e.date,
    outcome: choice === 'yea' ? 1 : 0, historyOutcome: choice === 'yea' ? 1 : choice === 'nay' ? 0 : null,
    memberScorable:choice === 'yea' || choice === 'nay', chamber:e.chamber,session:e.session,
  })));
  const predictions = evaluateChronologicalMemberModel(observations, {modelOptions:{minimumGlobalSupport:0}});
  const byEvent = new Map<string, Array<{probability:number;coalition:string}>>();
  for (const row of predictions) { const group = byEvent.get(row.voteEventId) ?? []; group.push({probability:row.probability!,coalition:row.party}); byEvent.set(row.voteEventId,group); }
  // Exclude inconsistent rosters/tallies; never replace official Yes counts with sums of predictions.
  const rejected = included.filter(e => new Set(e.members.map(m=>m[0])).size !== e.members.length || e.members.filter(m=>m[2]==='yea').length !== e.yes || e.members.filter(m=>m[2]==='nay').length !== e.no || (e.chamber !== 'house' && e.chamber !== 'senate'));
  const rejectedIds = new Set(rejected.map(e=>e.id));
  const usable = included.filter(e=>!rejectedIds.has(e.id));
  function evaluate(population:Event[], model:'independent'|'residual'|'coalition', options:CoalitionSimulationOptions={}) {
    return population.map(e=>{
      const members=byEvent.get(e.id)!;
      // Provisional floor threshold; promotion remains blocked until dated rules are verified.
      const rule={kind:'absolute-majority' as const,seats:members.length};
      const sim = model==='coalition' ? simulateCoalitionChamber(members,rule,{...options,simulations,seed:parseInt(createHash('sha256').update(e.id).digest('hex').slice(0,8),16)}) : simulateChamber(members.map(m=>m.probability),rule,{systematicSigmaVotes:model==='independent'?0:undefined});
      const intervals = [0.5,0.8,0.95].map(level=> {
        if(model!=='coalition') { const s=simulateChamber(members.map(m=>m.probability),rule,{interval:level,systematicSigmaVotes:model==='independent'?0:undefined}); return [s.yesLow,s.yesHigh]; }
        const quantile=(q:number)=>{let sum=0;for(let i=0;i<sim.distribution.length;i++){sum+=sim.distribution[i];if(sum>=q)return i;}return sim.distribution.length-1;};
        return [quantile((1-level)/2),quantile((1+level)/2)];
      });
      return {event:e,probability:sim.passageProbability,expectedYes:sim.expectedYes,intervals,close:Math.abs(e.yes-sim.requiredYes)<=5};
    });
  }
  type Row=ReturnType<typeof evaluate>[number];
  function score(rows:Row[]) {
    const known=rows.filter(r=>r.event.passed!==null);
    const forecasts=known.map(r=>({probability:r.probability,outcome:r.event.passed?1 as const:0 as const}));
    const alwaysPass=known.map(r=>({probability:1,outcome:r.event.passed?1 as const:0 as const}));
    return {events:rows.length,knownOutcomes:known.length,failed:known.filter(r=>!r.event.passed).length,
      brier:known.length?brierScore(forecasts):null,logLoss:known.length?logLoss(forecasts):null,calibrationError:known.length?expectedCalibrationError(forecasts):null,
      alwaysPassBrier:known.length?brierScore(alwaysPass):null,alwaysPassLogLoss:known.length?logLoss(alwaysPass):null,
      yesMae:rows.length?rows.reduce((s,r)=>s+Math.abs(r.expectedYes-r.event.yes),0)/rows.length:null,
      coverage:Object.fromEntries([50,80,95].map((level,i)=>[level,rows.length?rows.filter(r=>r.event.yes>=r.intervals[i][0]&&r.event.yes<=r.intervals[i][1]).length/rows.length:null]))};
  }
  const validationEvents=usable.filter(e=>e.session===validation);
  // Chamber and bill shocks have identical loadings: only their combined variance is identifiable.
  // Fix billShockSigma=0 and fit the equivalent common shock, rather than report two spurious estimates.
  const grid=[0,0.5,1,2].flatMap(chamberShockSigma=>[0,0.5,1,2].map(coalitionShockSigma=>({chamberShockSigma,coalitionShockSigma,billShockSigma:0})));
  const fits=grid.map(config=>({config,score:score(evaluate(validationEvents,'coalition',config))}));
  fits.sort((a,b)=>(a.score.brier??Infinity)-(b.score.brier??Infinity)||(a.score.yesMae??Infinity)-(b.score.yesMae??Infinity));
  const selected=fits[0];
  const splitScores=Object.fromEntries([train,validation,test].map(session=>[session,Object.fromEntries((['independent','residual','coalition'] as const).map(model=>{
    const rows=evaluate(usable.filter(e=>e.session===session),model,selected.config);
    return [model,{overall:score(rows),byChamber:Object.fromEntries(['house','senate'].map(c=>[c,score(rows.filter(r=>r.event.chamber===c))])),gambling:score(rows.filter(r=>r.event.gambling)),close:score(rows.filter(r=>r.close))}];
  }))]));
  const testScores=splitScores[test!];
  const blockers=coalitionPromotionBlockers({knownOutcomes:testScores.coalition.overall.knownOutcomes,failed:testScores.coalition.overall.failed,
    candidateBrier:testScores.coalition.overall.brier,baselineBriers:[testScores.independent.overall.brier,testScores.residual.overall.brier,testScores.coalition.overall.alwaysPassBrier],
    coverage80:testScores.coalition.overall.coverage[80],freshTest:false,verifiedRules:false,slicesReviewed:false});
  console.log(JSON.stringify({metadata:{version:'coalition-evaluation-v1',codeSha:process.env.GITHUB_SHA??null,datasetSha256:createHash('sha256').update(JSON.stringify(events)).digest('hex'),train,validation,test,simulations,
    leakageGuard:'Whole-date member updates; bill versions strictly before vote date; validation-only shock selection. Test is scored only after selection.',
    limitations:['Existing sessions were exposed to prior model evaluations; no claim of a fresh untouched final test.','House unknown outcomes excluded from passage metrics; no inferred outcome substituted.','Floor thresholds provisional until dated official vote rules are persisted.','Legacy residual sigma was fitted previously; its historical training provenance is not established.','Missing member choices are excluded from member training, not treated as observed Nay.'],
    parameterIdentifiability:'chamberShockSigma² + billShockSigma² is identifiable, not its two components; billShockSigma fixed to zero'},
    audit:{events:events.length,excludedEvents:rejected.length,excludedIds:rejected.map(e=>e.id),unknownPassageOutcomes:included.filter(e=>e.passed===null).length},
    selectedCandidate:{version:'coalition-fit-v1-candidate',...selected.config},validationGrid:fits,scores:splitScores,promotion:{eligible:blockers.length===0,blockers,productionChanged:false}},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Evaluation failed');process.exitCode=1;}).finally(()=>db?.end());
