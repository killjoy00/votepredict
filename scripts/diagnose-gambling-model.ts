import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {evaluateChronologicalGamblingModel,scoreGamblingModel,type GamblingModelObservation} from '../src/evaluation/gambling-member-model.js';
import type {GamblingBillFeatures} from '../src/gambling/policy.js';

type Event={id:string;date:string;session:string;chamber:string;yes:number;members:Array<[number,string,string|null]>;gambling:GamblingBillFeatures|null};
async function main(){
 const input=process.argv.find(a=>a.startsWith('--input='))?.slice(8);
 const db=input?undefined:new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1});
 try{
 const events:Event[]=input?JSON.parse(readFileSync(input,'utf8')):(await db!.query(readFileSync(new URL('./chamber-evaluation.sql',import.meta.url),'utf8'))).rows;
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const population=events.filter(e=>e.gambling);
 const context=new Map(population.map(e=>[e.id,e]));
 const observations:GamblingModelObservation[]=population.flatMap(e=>e.members.filter(m=>m[2]==='yea'||m[2]==='nay').map(([id,party,choice])=>({observationId:`${e.id}:${id}`,voteEventId:e.id,memberId:String(id),party,occurredAt:e.date,outcome:choice==='yea'?1:0,topic:e.gambling!.topic,designKey:[e.gambling!.topic,e.gambling!.licenseModel,e.gambling!.racetrackRole,e.gambling!.mobileAllowed??''].join(':')})));
 const predictions=evaluateChronologicalGamblingModel(observations);
 const history=new Map<string,number>();const support=new Map<string,number>();
 for(let start=0;start<predictions.length;){let end=start+1;while(end<predictions.length&&predictions[end].occurredAt===predictions[start].occurredAt)end++;
 for(const p of predictions.slice(start,end))support.set(p.observationId,history.get(p.memberId)??0);
 for(const p of predictions.slice(start,end))history.set(p.memberId,(history.get(p.memberId)??0)+1);start=end;}
 const latest=events.at(-1)!.session;
 const current=new Set(events.filter(e=>e.session===latest).flatMap(e=>e.members.map(m=>String(m[0]))));
 const dimensions:Record<string,(p:typeof predictions[number])=>string>={chamber:p=>context.get(p.voteEventId)!.chamber,session:p=>context.get(p.voteEventId)!.session,topic:p=>p.topic,scope:p=>context.get(p.voteEventId)!.gambling!.scope,
 close:p=>Math.abs(context.get(p.voteEventId)!.yes-(Math.floor(context.get(p.voteEventId)!.members.length/2)+1))<=5?'within_5_of_provisional_threshold':'other',
 experience:p=>(support.get(p.observationId)??0)<10?'fewer_than_10_prior_gambling_votes':'at_least_10',
 latestSessionPresence:p=>current.has(p.memberId)?'appears_in_latest_session':'not_seen_in_latest_session'};
 const slices=Object.fromEntries(Object.entries(dimensions).map(([name,key])=>[name,Object.fromEntries([...new Set(predictions.map(key))].sort().map(value=>{const rows=predictions.filter(p=>key(p)===value);return [value,{events:new Set(rows.map(r=>r.voteEventId)).size,...scoreGamblingModel(rows)}]}))]));
 console.log(JSON.stringify({metadata:{version:'gambling-diagnostics-v1',datasetSha256:createHash('sha256').update(JSON.stringify(events)).digest('hex'),sameDayOutcomesExcluded:true,featureCutoff:'Strictly before vote date, latest version regardless of classification',purpose:'Diagnostic only; all existing sessions were previously exposed. No coefficients fitted.',population:'Gambling-tagged events only, matching the candidate evaluator history restriction; not a full-history production generic-model benchmark.',optionalPoliticalInputs:'Sponsorship, committee, leadership and majority inputs are absent in the evaluator; their default coefficients are zero.',latestSessionPresence:'Descriptive slice only; not an input or an assertion about current officeholders.'},scorecard:scoreGamblingModel(predictions),slices,promotionDecision:'do-not-promote'},null,2));
 }finally{await db?.end();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Evaluation failed');process.exitCode=1;});
