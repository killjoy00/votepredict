/** Outcome-free cohort selection, used identically by preparation and evaluation. */
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const COHORT_TARGETS_V2_SQL=`WITH first_event AS (
 SELECT DISTINCT ON (v.session_id,v.bill_id) v.id,v.session_id,v.chamber_id,v.bill_id,v.occurred_on,v.external_key
 FROM vote_events v JOIN chambers c ON c.id=v.chamber_id
 JOIN legislative_sessions s ON s.id=v.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id
 WHERE c.slug='senate' AND j.slug='us-mn' AND v.is_passage=true AND v.bill_id IS NOT NULL
 AND v.occurred_on BETWEEN DATE '2021-01-01' AND DATE '2025-12-31'
 AND v.metadata->>'committeeVote' IS DISTINCT FROM 'true'
 ORDER BY v.session_id,v.bill_id,v.occurred_on,v.external_key,v.id)
 SELECT v.id::text AS event,v.bill_id::text AS bill,m.id::text AS membership,m.legislator_id::text AS person,
 v.occurred_on::text AS day,m.party,
 (m.starts_on IS NOT NULL AND m.ends_on IS NOT NULL AND m.starts_on<=v.occurred_on AND m.ends_on>=v.occurred_on) AS service,
 ((v.occurred_on::timestamp AT TIME ZONE 'America/Chicago') AT TIME ZONE 'UTC')::text||'Z' AS cutoff,
 ARRAY(SELECT DISTINCT bv.text_hash FROM bill_versions bv WHERE bv.bill_id=v.bill_id AND bv.text_hash ~ '^[a-f0-9]{64}$' ORDER BY bv.text_hash LIMIT 101) AS hashes
 FROM first_event v JOIN member_votes mv ON mv.vote_event_id=v.id
 JOIN memberships m ON m.id=mv.membership_id
 WHERE m.session_id=v.session_id AND m.chamber_id=v.chamber_id AND mv.choice IN ('yea','nay')
 ORDER BY v.occurred_on,v.bill_id,m.id LIMIT 200001`;
export function prepareWebsiteCohort(targets,features){
 if(!Array.isArray(targets)||targets.length>=200001||features.length!==668)throw Error('Bounded v2 cohort required');
 const byPerson=new Map();
 for(const p of features){
  if(!p.legislatorId||!p.literal||!Number.isFinite(Date.parse(p.observedAt)))throw Error('Invalid verified feature');
  const a=byPerson.get(p.legislatorId)||[];a.push(p);byPerson.set(p.legislatorId,a);
 }
 const part=y=>y<=2022?'train':y===2023?'validation':'test';
 const hashSplits=new Map(),billInfo=new Map(),seen=new Set();
 for(const r of targets){
  if(!/^202[1-5]-\d\d-\d\d$/.test(r.day)||!Array.isArray(r.hashes)||r.hashes.length>=101||r.hashes.some(h=>!/^[a-f0-9]{64}$/.test(h))||!Number.isFinite(Date.parse(r.cutoff)))throw Error('Invalid target schema');
  const id=r.membership+'|'+r.bill;if(seen.has(id))throw Error('Repeated member/bill target');seen.add(id);
  const partition=part(Number(r.day.slice(0,4))),prior=billInfo.get(r.bill);
  if(prior&&(prior.partition!==partition||prior.day!==r.day||prior.hashes.join('|')!==r.hashes.join('|')))throw Error('Bill split or version-hash conflict');
  billInfo.set(r.bill,{partition,day:r.day,hashes:r.hashes});
  for(const h of r.hashes){const a=hashSplits.get(h)||new Set();a.add(partition);hashSplits.set(h,a);}
 }
 const crossHashes=new Set([...hashSplits].filter(([,a])=>a.size>1).map(([h])=>h));
 const exclusions={unknownService:0,noPriorText:0,missingBillHashes:0,crossPartitionBillHash:0};
 const rows=[],texts=new Map();
 for(const r of targets){
  if(r.service!==true){exclusions.unknownService++;continue;}
  const dedup=new Map();
  for(const p of byPerson.get(r.person)||[]){
   if(Date.parse(p.observedAt)>=Date.parse(r.cutoff))continue;
   const k=sha(p.literal),old=dedup.get(k);
   if(!old||[p.observedAt,p.sourceSha,p.key].join('|')<[old.observedAt,old.sourceSha,old.key].join('|'))dedup.set(k,p);
  }
  if(!dedup.size){exclusions.noPriorText++;continue;}
  if(!r.hashes.length){exclusions.missingBillHashes++;continue;}
  if(r.hashes.some(h=>crossHashes.has(h))){exclusions.crossPartitionBillHash++;continue;}
  const a=[...dedup.values()].sort((x,y)=>x.observedAt.localeCompare(y.observedAt)||x.sourceSha.localeCompare(y.sourceSha)||x.key.localeCompare(y.key));
  const text=Array.from(a.map(p=>p.literal).join('\n')).slice(0,20000).join('');
  const textKey=sha(text);texts.set(textKey,text);
  rows.push({...r,partition:part(Number(r.day.slice(0,4))),textKey});
 }
 const coverage=[];
 for(const year of [2021,2022,2023,2024,2025]){
  const all=targets.filter(r=>Number(r.day.slice(0,4))===year),selected=rows.filter(r=>Number(r.day.slice(0,4))===year);
  coverage.push({year,targets:all.length,included:selected.length,bills:new Set(selected.map(r=>r.bill)).size,people:new Set(selected.map(r=>r.person)).size,
   parties:[...new Set(selected.map(r=>r.party))].sort().map(party=>({party,targets:selected.filter(r=>r.party===party).length}))});
 }
 const commitment=rows.map(r=>[r.membership,r.person,r.bill,r.event,r.day,r.party,r.cutoff,r.textKey,r.hashes]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {privateRows:rows,privateTexts:texts,summary:{version:'senate864-website-cohort-v2',targets:targets.length,included:rows.length,distinctBills:new Set(rows.map(r=>r.bill)).size,distinctPeople:new Set(rows.map(r=>r.person)).size,distinctTextInputs:texts.size,
  exclusions,crossPartitionHashes:crossHashes.size,coverage,cohortSha256:sha(JSON.stringify(commitment)),noOutcomesRead:true,strictLocalMidnight:true}};
}
