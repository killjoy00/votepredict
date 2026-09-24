import { createHash } from 'node:crypto';
import { scoreLifecycleBinary } from './lifecycle-p4-baselines';
import type { LifecycleP3Snapshot } from './lifecycle-p3-snapshot-dataset';
import {
  buildLifecycleP5ProspectiveRow,
  predictLifecycleP5RetainedProspectiveModel,
  type LifecycleP5RetainedProspectiveModel,
} from './lifecycle-p5-evidence-allocation';

export const LIFECYCLE_BILL_LANGUAGE_SCHEMA = 'lifecycle-bill-language-screen-v1' as const;
export const LIFECYCLE_BILL_LANGUAGE_SCALES = [0, 0.1, 0.2, 0.35, 0.5] as const;
export const LIFECYCLE_BILL_LANGUAGE_LAMBDAS = [0.1, 1, 5, 20, 100] as const;

const TOKEN_PRIOR_STRENGTH = 200;
const TOKEN_MIN_SUPPORT = 50;
const TOKEN_MAX_FEATURES = 12;
const MAX_SUBSTANTIVE_CHARS = 60_000;

const STOPWORDS = new Set([
  'about','after','against','also','among','and','are','article','bill','chapter','concerning',
  'each','effective','every','following','for','from','into','law','laws','may','minnesota',
  'must','not','of','on','or','paragraph','relating','section','sections','shall','state',
  'subdivision','subd','that','the','this','to','under','with','provided','providing',
  'requiring','certain','various','modifying','establishing','authorizing',
]);

export interface LifecycleBillLanguageVersion {
  id: string;
  textHash: string | null;
  rawText: string;
}

export interface LifecycleBillLanguageRow {
  snapshotId: string;
  billId: string;
  session: string;
  chamber: 'house' | 'senate';
  cutoffDateExclusive: string;
  lifecycleState: string;
  outcome: 0 | 1;
  p5Probability: number;
  versionId: string | null;
  hasText: boolean;
  tokens: string[];
  structural: number[];
}

type TokenStat = { positives: number; total: number };
type LanguageObservation = LifecycleBillLanguageRow;

function clamp(value:number,lo:number,hi:number){return Math.min(hi,Math.max(lo,value));}
function logit(value:number){const p=clamp(value,1e-9,1-1e-9);return Math.log(p/(1-p));}
function logistic(value:number){return 1/(1+Math.exp(-value));}

export function lifecycleSubstantiveBody(rawText:string):string {
  const enacted=rawText.search(/\bBE IT ENACTED BY THE LEGISLATURE\b/i);
  const whereas=rawText.search(/(?:^|\n)\s*WHEREAS\b/i);
  let start=0;
  if(enacted>=0) start=enacted;
  else if(whereas>=0) start=whereas;
  return rawText.slice(start,start+MAX_SUBSTANTIVE_CHARS);
}

export function lifecycleLanguageTokens(rawText:string):string[] {
  const normalized=lifecycleSubstantiveBody(rawText)
    .toLowerCase()
    .replace(/<[^>]+>/g,' ')
    .replace(/&[a-z0-9#]+;/g,' ')
    .replace(/[^a-z]+/g,' ');
  const seen=new Set<string>();
  for(const token of normalized.split(/\s+/)){
    if(token.length<4||token.length>24||STOPWORDS.has(token)) continue;
    seen.add(token);
    if(seen.size>=600) break;
  }
  return [...seen];
}

function countMatches(text:string,pattern:RegExp):number {
  return [...text.matchAll(pattern)].length;
}

export function lifecycleLanguageStructuralFeatures(rawText:string):number[] {
  const body=lifecycleSubstantiveBody(rawText).toLowerCase();
  return [
    Math.log1p(countMatches(body,/\bsec\.\s*\d+/g)),
    Math.log1p(countMatches(body,/\bsubd\.\s*\d+/g)),
    Math.log1p(countMatches(body,/\bamended\b/g)),
    Math.log1p(countMatches(body,/\badding\s+a\s+section\b/g)),
    Math.log1p(countMatches(body,/\brepeal(?:ed|ing|s)?\b/g)),
    Math.log1p(countMatches(body,/\bappropriat(?:e|ed|es|ing|ion|ions)\b/g)),
    Math.log1p(countMatches(body,/\beffective\s+date\b/g)),
    Math.log1p(countMatches(body,/\bmeans\b/g)),
    Math.log1p(countMatches(body,/\bpenalt(?:y|ies)\b|\bmisdemeanor\b|\bfelony\b/g)),
    Math.log1p(countMatches(body,/\btax(?:es|able|ation)?\b/g)),
    Math.log1p(countMatches(body,/\bgrant(?:s|ed|ing)?\b/g)),
    Math.log1p(countMatches(body,/\bbond(?:s|ing)?\b/g)),
  ];
}

function addStat(map:Map<string,TokenStat>,key:string,outcome:0|1){
  const stat=map.get(key)??{positives:0,total:0};
  stat.total+=1;stat.positives+=outcome;map.set(key,stat);
}
function tokenDelta(stat:TokenStat|undefined,baseRate:number):number{
  if(!stat||stat.total<TOKEN_MIN_SUPPORT)return 0;
  const rate=(stat.positives+TOKEN_PRIOR_STRENGTH*baseRate)/(stat.total+TOKEN_PRIOR_STRENGTH);
  return logit(rate)-logit(baseRate);
}
function strongestMean(values:number[]):number{
  const picked=values.filter(v=>Number.isFinite(v)&&v!==0)
    .sort((a,b)=>Math.abs(b)-Math.abs(a)).slice(0,TOKEN_MAX_FEATURES);
  return picked.length?picked.reduce((a,b)=>a+b,0)/picked.length:0;
}
function score(rows:readonly LanguageObservation[],prob:(row:LanguageObservation)=>number){
  return scoreLifecycleBinary(rows.map(row=>({probability:prob(row),outcome:row.outcome})));
}
function delta(candidate:any,baseline:any){
  return {
    brier:candidate.brier-baseline.brier,
    logLoss:candidate.logLoss-baseline.logLoss,
    expectedCalibrationError:candidate.expectedCalibrationError-baseline.expectedCalibrationError,
    averagePrecision:candidate.averagePrecision===null||baseline.averagePrecision===null?null:candidate.averagePrecision-baseline.averagePrecision,
    rocAuc:candidate.rocAuc===null||baseline.rocAuc===null?null:candidate.rocAuc-baseline.rocAuc,
  };
}
function scorePair(rows:readonly LanguageObservation[],prob:(row:LanguageObservation)=>number){
  if(!rows.length)return null;
  const baseline=score(rows,row=>row.p5Probability);
  const candidate=score(rows,prob);
  return {baseline,candidate,deltaCandidateMinusBaseline:delta(candidate,baseline)};
}

function fitTokenStats(rows:readonly LanguageObservation[]){
  const positives=rows.reduce((s,r)=>s+r.outcome,0);
  const baseRate=positives/rows.length;
  const stats=new Map<string,TokenStat>();
  for(const row of rows)for(const token of row.tokens)addStat(stats,token,row.outcome);
  return {baseRate,stats};
}
function lexicalAdjustment(row:LanguageObservation,model:ReturnType<typeof fitTokenStats>){
  return strongestMean(row.tokens.map(token=>tokenDelta(model.stats.get(token),model.baseRate)));
}
function lexicalProbability(row:LanguageObservation,model:ReturnType<typeof fitTokenStats>,scale:number){
  return clamp(logistic(logit(row.p5Probability)+Math.max(-1,Math.min(1,scale*lexicalAdjustment(row,model)))),0.0025,0.9975);
}

function fitRidge(rows:readonly LanguageObservation[],lambda:number){
  const width=rows[0]?.structural.length??0;
  const beta=Array.from({length:width},()=>0);
  const eta=rows.map(r=>logit(r.p5Probability));
  for(let pass=0;pass<40;pass++){
    let maxStep=0;
    for(let c=0;c<width;c++){
      let gradient=-lambda*beta[c],info=lambda;
      for(let i=0;i<rows.length;i++){
        const x=rows[i].structural[c]; if(Math.abs(x)<1e-15)continue;
        const p=logistic(eta[i]);
        gradient+=x*(rows[i].outcome-p);
        info+=x*x*Math.max(1e-8,p*(1-p));
      }
      const step=gradient/info;
      beta[c]+=step;maxStep=Math.max(maxStep,Math.abs(step));
      for(let i=0;i<rows.length;i++)eta[i]+=rows[i].structural[c]*step;
    }
    if(maxStep<1e-7)break;
  }
  return beta;
}
function structuralProbability(row:LanguageObservation,beta:readonly number[]){
  const raw=row.structural.reduce((s,x,i)=>s+x*beta[i],0);
  return clamp(logistic(logit(row.p5Probability)+Math.max(-1,Math.min(1,raw))),0.0025,0.9975);
}

export function buildLifecycleBillLanguageRows(input:{
  snapshots:readonly LifecycleP3Snapshot[];
  versions:ReadonlyMap<string,LifecycleBillLanguageVersion>;
  p5Model:LifecycleP5RetainedProspectiveModel;
}):LifecycleBillLanguageRow[]{
  const cache=new Map<string,{tokens:string[];structural:number[]}>();
  const rows:LifecycleBillLanguageRow[]=[];
  for(const snapshot of input.snapshots){
    const p5=predictLifecycleP5RetainedProspectiveModel(
      input.p5Model,
      buildLifecycleP5ProspectiveRow(snapshot,'source_chamber_passage'),
    );
    if(!p5)continue;
    const versionRef=snapshot.features.latestEligibleBillVersion;
    let versionId:string|null=null,tokens:string[]=[],structural=Array.from({length:12},()=>0),hasText=false;
    if(versionRef){
      const version=input.versions.get(versionRef.billVersionId);
      if(!version)throw new Error('Missing raw text for frozen lifecycle version '+versionRef.billVersionId);
      if(versionRef.textHash&&version.textHash!==versionRef.textHash){
        throw new Error('Lifecycle bill-language text hash drift for '+versionRef.billVersionId);
      }
      versionId=version.id;hasText=true;
      const cached=cache.get(version.id);
      if(cached){tokens=cached.tokens;structural=cached.structural;}
      else{
        tokens=lifecycleLanguageTokens(version.rawText);
        structural=lifecycleLanguageStructuralFeatures(version.rawText);
        cache.set(version.id,{tokens,structural});
      }
    }
    rows.push({
      snapshotId:snapshot.snapshotId,billId:snapshot.bill.billId,session:snapshot.bill.session,
      chamber:snapshot.bill.chamber,cutoffDateExclusive:snapshot.cutoff.asOfDateExclusive,
      lifecycleState:snapshot.features.lifecycleState,
      outcome:snapshot.targets.eventualSourceChamberPassage?1:0,
      p5Probability:p5.candidateProbability,versionId,hasText,tokens,structural,
    });
  }
  return rows;
}

export function evaluateLifecycleBillLanguageScreen(rows:readonly LifecycleBillLanguageRow[]){
  const training=rows.filter(r=>r.session==='2021-2022');
  const validation=rows.filter(r=>r.session==='2023-2024');
  const descriptive=rows.filter(r=>r.session==='2025-2026');
  if(!training.length||!validation.length||!descriptive.length)throw new Error('Bill-language screen requires all three biennia');

  const tokenModel=fitTokenStats(training);
  const scaleCandidates=LIFECYCLE_BILL_LANGUAGE_SCALES.map(scale=>({
    scale,
    validation:scorePair(validation,row=>lexicalProbability(row,tokenModel,scale))!,
  })).sort((a,b)=>a.validation.candidate.brier-b.validation.candidate.brier||a.validation.candidate.logLoss-b.validation.candidate.logLoss||a.scale-b.scale);
  const selectedScale=scaleCandidates[0].scale;

  const ridgeCandidates=LIFECYCLE_BILL_LANGUAGE_LAMBDAS.map(lambda=>{
    const beta=fitRidge(training,lambda);
    return {lambda,beta,validation:scorePair(validation,row=>structuralProbability(row,beta))!};
  }).sort((a,b)=>a.validation.candidate.brier-b.validation.candidate.brier||a.validation.candidate.logLoss-b.validation.candidate.logLoss||a.lambda-b.lambda);
  const selectedRidge=ridgeCandidates[0];

  const combinedProb=(row:LanguageObservation)=>{
    const lexical=selectedScale*lexicalAdjustment(row,tokenModel);
    const structural=row.structural.reduce((s,x,i)=>s+x*selectedRidge.beta[i],0);
    return clamp(logistic(logit(row.p5Probability)+Math.max(-1,Math.min(1,lexical+structural))),0.0025,0.9975);
  };

  const supported=[...tokenModel.stats.entries()]
    .filter(([,s])=>s.total>=TOKEN_MIN_SUPPORT)
    .map(([token,s])=>({token,positives:s.positives,total:s.total,delta:tokenDelta(s,tokenModel.baseRate)}));
  const topPositive=[...supported].sort((a,b)=>b.delta-a.delta||b.total-a.total).slice(0,40);
  const topNegative=[...supported].sort((a,b)=>a.delta-b.delta||b.total-a.total).slice(0,40);

  const coverage=(subset:readonly LanguageObservation[])=>({
    snapshots:subset.length,
    bills:new Set(subset.map(r=>r.billId)).size,
    snapshotsWithText:subset.filter(r=>r.hasText).length,
    billsWithText:new Set(subset.filter(r=>r.hasText).map(r=>r.billId)).size,
  });
  const digest=createHash('sha256');
  for(const row of rows)digest.update(JSON.stringify({...row,tokens:undefined})+'\n');

  return {
    schemaVersion:LIFECYCLE_BILL_LANGUAGE_SCHEMA,
    chronology:{trainingSession:'2021-2022',validationSession:'2023-2024',descriptiveSession:'2025-2026',sameDayExcluded:true},
    baseline:'p5-retained-process-plus-version-structure-fit-on-2021-2022',
    languageProtocol:{
      version:'latest frozen cutoff-eligible bill version',
      lexical:'unique substantive-body unigrams; numbers/html/boilerplate removed; max 600 unique tokens/version',
      tokenPriorStrength:TOKEN_PRIOR_STRENGTH,tokenMinSupport:TOKEN_MIN_SUPPORT,
      tokenMaxFeatures:TOKEN_MAX_FEATURES,maxSubstantiveChars:MAX_SUBSTANTIVE_CHARS,
      scaleSelection:'2023-2024 validation only',
      structuralFeatures:['sections','subdivisions','amended','adding-section','repeal','appropriation','effective-date','definitions','penalty','tax','grant','bond'],
    },
    coverage:{
      overall:coverage(rows),
      bySession:Object.fromEntries(['2021-2022','2023-2024','2025-2026'].map(s=>[s,coverage(rows.filter(r=>r.session===s))])),
    },
    lexical:{
      selectedScale,
      scaleCandidates:scaleCandidates.map(x=>({scale:x.scale,validation:x.validation})),
      training:scorePair(training,row=>lexicalProbability(row,tokenModel,selectedScale)),
      validation:scorePair(validation,row=>lexicalProbability(row,tokenModel,selectedScale)),
      descriptive2025_2026:scorePair(descriptive,row=>lexicalProbability(row,tokenModel,selectedScale)),
      topPositive,topNegative,
    },
    structural:{
      selectedLambda:selectedRidge.lambda,
      coefficients:selectedRidge.beta,
      lambdaCandidates:ridgeCandidates.map(x=>({lambda:x.lambda,validation:x.validation})),
      training:scorePair(training,row=>structuralProbability(row,selectedRidge.beta)),
      validation:selectedRidge.validation,
      descriptive2025_2026:scorePair(descriptive,row=>structuralProbability(row,selectedRidge.beta)),
    },
    combined:{
      validation:scorePair(validation,combinedProb),
      descriptive2025_2026:scorePair(descriptive,combinedProb),
    },
    featureRowSha256:digest.digest('hex'),
    policy:{retrospectiveDevelopmentOnly:true,causalInterpretationAllowed:false,automaticPromotionAllowed:false,servingChanged:false,p8ModelChanged:false,productionAction:'none'},
  };
}
