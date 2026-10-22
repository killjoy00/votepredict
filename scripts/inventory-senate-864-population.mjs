/** #864 protected READ ONLY population inventory. Public workers receive no credentials. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Pool} from 'pg';
import {sha,norm,VERSION,inspectOriginal,extractRowRollQuestions,reconcileRowQuestion} from '../src/evidence/senate-864-population-named-rolls.mjs';
import {parseSenateCommitteeMinutesRaw} from '../src/sources/minnesota/senate-raw-votes.ts';
import {extractSupplementalNamedSenateRollCandidates} from '../src/evidence/senate-committee-supplemental-named-roll-review.ts';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.ts';
import {fetchSenateMinutesHtml,extractSenateMinutesText} from '../src/sources/minnesota/senate-schedule.ts';
import {inspectOfficialSenatePdfHeader,sourceAbsenteeChoiceConflicts} from '../research/evidence/senate-committee-19-original-date-attendance-review.ts';
import {priorOriginalQueue,authenticatePriorQuestionOriginals,verifiedPriorQuestionEvents} from '../src/evidence/senate-864-prior-question-bridge.mjs';
import {SNAPSHOT_SQL} from './deploy-senate-864-population-row-rolls.mjs';
import {assertHistoricalMainPush} from '../src/evidence/senate-864-72-protected-event.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.ts';
const ROOT='docs/evaluation/source-proof/',OUT='artifacts/senate864-population',MARKER='SENATE864_POPULATION_INVENTORY_V1';
const load=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const session=date=>date<'2023'?'2021-2022':date<'2025'?'2023-2024':'2025-2026',key=d=>d.source_url+'|'+d.content_sha256;
const safeError=e=>String(e?.message||e).replace(/https?:\/\/\S+/g,'[official URL]').slice(0,220);
async function worker(input,output){
 const out=[];
 for(const d of load(input)){
  let got,error;for(let attempt=0;attempt<2&&!got;attempt++)try{got=await fetchSenateCommitteeMinutePdf({url:d.source_url});}catch(e){error=e;}
  if(got){out.push(got.contentSha256===d.content_sha256?{...d,authenticated:true,text:got.text,extractionMethod:got.extractionMethod,textSha256:sha(got.text)}:{...d,authenticated:false,acquisitionHold:'original_byte_sha_drift'});}
  else{let acquired=false;try{const r=await fetch(d.source_url,{signal:AbortSignal.timeout(45000)});acquired=r.ok&&sha(new Uint8Array(await r.arrayBuffer()))===d.content_sha256;}catch{}
   out.push({...d,authenticated:acquired,text:'',extractionMethod:'unparseable',acquisitionHold:acquired?'original_acquired_extraction_failed':'original_acquisition_failed',error:safeError(error)});}
 }save(output,out);
}
export function supplemental(){
 const out=[],add=(url,digest,date,committee,textSha256)=>out.push({source_url:url,content_sha256:digest,date,committee,session_slug:session(date),format:'pdf',previousTextSha256:textSha256||null});
 for(const d of load(ROOT+'senate-864-2022-25-eight-alternate-lrl-original-pdf-sha-receipts.json').originalFourMeetingDates)for(const p of d.officialOriginalPdfBodies)add(p.originalSourceUrl,p.originalRawPdfSha256,d.hearingDate,d.committeeName);
 for(const d of load(ROOT+'senate-864-eleven-original-same-day-LRL-minutes-recovery.json').originalSources)add(d.originalSourceUrl,d.originalRawPdfSha256,d.firstPrintedDateFromOriginalHeader,d.committeeName,d.originalExtractedTextSha256);
 for(const d of load('data/collections/senate-minute-gap-recovery-20261016.json').documents)add(d.sourceUrl,d.contentSha256,d.hearingDate,d.committeeName,d.textSha256);
 const d=load(ROOT+'senate-864-2022-housing-unlinked-official-original-minutes-pdf-receipt.json').source;add(d.officialGovernmentUrl,d.originalPdfRawSha256,d.hearingDate,d.lrlIndexCommittee,d.originalPdfTextSha256);
 if(out.length!==28)throw Error('Supplementary registry bounds changed');return out;
}
export const DOC_SQL="SELECT sd.id::text,sd.source_url,sd.content_sha256,sd.session_id::text,sd.chamber_id::text,sd.source_kind,s.slug AS session_slug,coalesce(sd.metadata->>'meetingDate',sd.metadata->'rawPrepassageVotes'->>'sourceDate') AS date,coalesce(sd.metadata->>'committeeName',sd.metadata->'rawPrepassageVotes'->'hearing'->>'committeeName') AS committee,CASE WHEN sd.source_kind='senate_committee_minutes_html' THEN sd.metadata->'rawPrepassageVotes'->>'text' ELSE NULL END AS text FROM source_documents sd JOIN legislative_sessions s ON s.id=sd.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id JOIN chambers c ON c.id=sd.chamber_id WHERE j.slug='us-mn' AND c.slug='senate' AND sd.source_kind IN ('senate_committee_minutes','senate_committee_minutes_html') AND coalesce(sd.metadata->>'meetingDate',sd.metadata->'rawPrepassageVotes'->>'sourceDate')>='2022-01-01' AND coalesce(sd.metadata->>'meetingDate',sd.metadata->'rawPrepassageVotes'->>'sourceDate')<'2026-01-01' ORDER BY sd.id LIMIT 3001";
async function readOnly(pool,target,fn){
 const db=await pool.connect();try{await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
 const who=(await db.query("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,clock_timestamp() AS read_at")).rows[0];
 if(who.db!==target.database||who.role!==target.role||who.ro!=='on'||who.isolation!=='repeatable read')throw Error('Read-only identity changed');
 return {result:await fn(db),readAt:who.read_at};
 }finally{await db.query('ROLLBACK');}}finally{db.release(true);}
}
async function acquirePdfs(docs){
 const batches=[];for(let i=0;i<docs.length;i+=80)batches.push(docs.slice(i,i+80));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','TMPDIR','LANG','NODE_OPTIONS'].includes(k)));env.VOTEPREDICT_SENATE_COMMITTEE_OCR='1';env.OMP_THREAD_LIMIT='1';
 let next=0;const all=[];
 await Promise.all(Array.from({length:3},async()=>{while(next<batches.length){
  const n=next++,input=OUT+'/batch-'+n+'.json',output=OUT+'/result-'+n+'.json';save(input,batches[n]);
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',import.meta.filename,'--worker',input,output],{env,stdio:['ignore','ignore','pipe']});
   let err='';child.stderr.on('data',b=>{err+=b;});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Public PDF worker failed '+n+': '+safeError(err))));
  });all.push(...load(output));console.log('INVENTORY_PUBLIC_PDF_PROGRESS='+all.length+'/'+docs.length);
 }}));return all;
}
function candidateContext(text,offset){
 const before=text.slice(0,offset),motions=[...before.matchAll(/\b(?:Senator|Chair|Vice\s+Chair)\s+[\p{L}.' -]{2,90}?\s+(?:moved|moves|offered|offers)\b/giu)],last=motions.at(-1);
 const start=Math.max(0,offset-4000,last?.index??offset-1800);
 const after=text.slice(offset),next=after.search(/\b(?:Senator|Chair|Vice\s+Chair)\s+[\p{L}.' -]{2,90}?\s+(?:moved|moves|offered|offers)\b/iu);
 const end=Math.min(text.length,offset+(next>=0?Math.min(next,4000):4000)),context=text.slice(start,end);
 return {sourceContextStart:start,sourceContextEnd:end,sourceContextText:context,sourceContextSha256:sha(context),sourceContextIsUncertified:true};
}
export function authenticateUnstoredClerkExtraction(raw,text,spec,acquired){
 if(sha(raw)!==spec.originalClerkSha256)throw Error('Unstored Clerk raw SHA changed');
 if(acquired&&(acquired.originalSha256!==spec.originalClerkSha256||acquired.format!=='html_raw'||acquired.authenticated!==true||acquired.readable!==true))throw Error('Unstored Clerk acquired original identity changed');
 const expected=acquired?.extractedTextSha256||spec.originalClerkTextSha256;
 if(!/^[a-f0-9]{64}$/.test(expected||'')||sha(text)!==expected)throw Error('Unstored Clerk text SHA changed');
 return {historicalCrosswalkTextSha256:spec.originalClerkTextSha256,extractionShaReference:acquired?'immutable_acquired_cache_same_extractor':'historical_crosswalk'};
}
export function compareAcquiredPdfExtraction(previous,d){
 if(d.authenticated!==true)throw Error('Named-candidate original reauthentication failed');
 if(d.textSha256!==previous){
  if(d.extractionMethod!=='ocr_tesseract')throw Error('Embedded original text extraction SHA drift');
  d.extractionTextChangedFromAcquiredCache=true;d.previousExtractedTextSha256=previous;
 }
}
export function coalesceQuestionSources(occurrences,snapshot){
 const evidence=new Set(occurrences.map(({q})=>JSON.stringify([q.questionKey,q.passed,q.choices.map(v=>v.choice+':'+norm(v.name)).sort()])));
 if(evidence.size!==1)return {status:'source_question_hold',reason:'conflicting_original_question_outcome_or_named_sides',classification:false,missingChoices:0,alternateSourceParityVerified:false,sourceWitnessClasses:[]};
 const results=occurrences.map(({q,d})=>d.id?reconcileRowQuestion(q,d,snapshot):{status:'stored_source_identity_hold',reason:'original_not_uniquely_stored'});
 const ids=new Set(results.map(r=>r.eventId).filter(Boolean));
 if(ids.size>1)return {status:'ambiguous_production_match',reason:'different_originals_anchor_different_events',classification:false,missingChoices:0,alternateSourceParityVerified:false};
 let r=results.find(r=>r.status==='exact')||results.find(r=>r.alternateSourceParityVerified===true)||
  results.find(r=>r.status==='classification_defect')||results.find(r=>r.status==='missing_choices')||
  results.find(r=>r.status==='different_source_identity');
 if(!r)r=results.every(r=>r.status==='missing_event')?results[0]:results.find(r=>r.status!=='missing_event');
 return {status:r.status,reason:r.reason||null,classification:!!r.classification,missingChoices:Array.isArray(r.missingChoices)?r.missingChoices.length:r.missingChoices||0,alternateSourceParityVerified:r.alternateSourceParityVerified===true,sourceWitnessClasses:results.map(r=>r.status)};
}

export function summarize(rows,questions,snapshot){
 const categories={},groups=new Map();
 for(const d of rows){
  const k=d.date.slice(0,4)+'|'+d.committee,m=groups.get(k)||{year:Number(d.date.slice(0,4)),committee:d.committee,originals:0,pdf:0,clerk:0,authenticatedReadable:0,namedCandidateOriginals:0,examinedTextNoNamedDetected:0,unparseableOrUnavailable:0,ocrQualityUncertifiedOriginals:0,changedOcrExtractionOriginals:0,rawCandidateOccurrences:0,supplementalCandidateOccurrences:0,heldRowOccurrences:0,originalsRequiringQuestionOrExtractionReview:0,sourceHeaderOrWeekdayReviewOriginals:0,repeatedBodyDifferentDateOriginals:0,absenteeConflictCandidateOccurrences:0,detectorCandidateOccurrences:0,detectorChoiceOccurrences:0,strictDistinctQuestions:0,strictExplicitChoices:0,correctlyRepresentedQuestions:0,correctlyRepresentedChoices:0,missingEvents:0,missingIndividualChoices:0,classificationDefects:0,questionOrIdentityHolds:0,alternateSourceVerified:0};
  m.originals++;m[d.format==='pdf'?'pdf':'clerk']++;m.authenticatedReadable+=Number(d.readable);m.namedCandidateOriginals+=Number(d.status==='named_candidate_original');m.examinedTextNoNamedDetected+=Number(d.status==='examined_no_named_roll');m.unparseableOrUnavailable+=Number(!d.readable);m.ocrQualityUncertifiedOriginals+=Number(d.extractionMethod==='ocr_tesseract');m.changedOcrExtractionOriginals+=Number(d.extractionTextChangedFromAcquiredCache===true);m.rawCandidateOccurrences+=(d.rawNamedCandidates||[]).length;m.supplementalCandidateOccurrences+=(d.supplementalNamedCandidates||[]).length;m.heldRowOccurrences+=(d.rowQuestions||[]).filter(q=>q.confidence!=='source_proven_question').length;m.originalsRequiringQuestionOrExtractionReview+=Number((d.rowQuestions||[]).some(q=>q.holds.length)||d.unresolvedExtractionSignals>0||d.header?.sourceDateHeaderNeedsReview===true||d.repeatedIdenticalBodyDifferentDate===true);m.sourceHeaderOrWeekdayReviewOriginals+=Number(d.header?.sourceDateHeaderNeedsReview===true);m.repeatedBodyDifferentDateOriginals+=Number(d.repeatedIdenticalBodyDifferentDate===true);m.absenteeConflictCandidateOccurrences+=(d.supplementalNamedCandidates||[]).filter(q=>q.attendance?.explicitChoiceFingerprintMatchesAbsentee>0).length;m.detectorCandidateOccurrences+=d.detectorCandidates;m.detectorChoiceOccurrences+=d.detectorChoiceOccurrences;groups.set(k,m);
 }
 for(const x of questions){
  categories[x.production.status]=(categories[x.production.status]||0)+1;const m=groups.get(x.date.slice(0,4)+'|'+x.committee),good=x.production.status==='exact'||x.production.alternateSourceParityVerified===true;
  m.strictDistinctQuestions++;m.strictExplicitChoices+=x.choices;m.correctlyRepresentedQuestions+=Number(good);m.correctlyRepresentedChoices+=good?x.choices:0;m.missingEvents+=Number(x.production.status==='missing_event');m.missingIndividualChoices+=x.production.missingChoices||0;m.classificationDefects+=Number(x.production.status==='classification_defect');m.questionOrIdentityHolds+=Number(!['exact','missing_event','missing_choices','classification_defect'].includes(x.production.status)&&!good);m.alternateSourceVerified+=Number(x.production.alternateSourceParityVerified===true);
 }
 const committee=[...groups.values()].sort((a,b)=>a.year-b.year||a.committee.localeCompare(b.committee)),numeric=Object.keys(committee[0]).filter(k=>!['year','committee'].includes(k));
 const year=[2022,2023,2024,2025].map(year=>Object.fromEntries([['year',year],...numeric.map(k=>[k,committee.filter(m=>m.year===year).reduce((n,m)=>n+m[k],0)])]));
 const stored=year.map(({year})=>{const e=snapshot.events.filter(e=>e.occurred_on.startsWith(String(year))),ids=new Set(e.map(e=>e.id));return {year,storedEvents:e.length,storedExplicitChoices:snapshot.choices.filter(v=>ids.has(v.vote_event_id)).length};});
 const productionGroups=new Map();
 for(const e of snapshot.events){
  const year=Number(e.occurred_on.slice(0,4)),committee=e.metadata?.committeeName||'(unclassified committee label)',k=year+'|'+committee;
  const m=productionGroups.get(k)||{year,committee,storedEvents:0,storedExplicitChoices:0};
  m.storedEvents++;m.storedExplicitChoices+=snapshot.choices.filter(v=>v.vote_event_id===e.id).length;productionGroups.set(k,m);
 }
 const storedByCommittee=[...productionGroups.values()].sort((a,b)=>a.year-b.year||a.committee.localeCompare(b.committee));
 return {byYear:year,byCommittee:committee,productionCategories:categories,storedByYear:stored,storedByCommittee};
}
function committeeMatrix(summary){
 const fields=Object.keys(summary.byCommittee[0]),groups=new Map(summary.byCommittee.map(m=>[m.year+'|'+m.committee,{...m,storedEventsForExactCommitteeLabel:0,storedExplicitChoicesForExactCommitteeLabel:0}]));
 for(const p of summary.storedByCommittee){
  const k=p.year+'|'+p.committee,m=groups.get(k)||Object.fromEntries(fields.map(f=>[f,f==='year'?p.year:f==='committee'?p.committee:null]));
  m.storedEventsForExactCommitteeLabel=p.storedEvents;m.storedExplicitChoicesForExactCommitteeLabel=p.storedExplicitChoices;groups.set(k,m);
 }
 return [...groups.values()].sort((a,b)=>a.year-b.year||a.committee.localeCompare(b.committee));
}
const csv=rows=>{const keys=Object.keys(rows[0]),cell=x=>'"'+String(x??'').replaceAll('"','""')+'"';return keys.map(cell).join(',')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\n')+'\n';};

async function main(){
 const env=process.env,event=load(env.GITHUB_EVENT_PATH||'');
 assertHistoricalMainPush({...env,VOTEPREDICT_864_72_INDEPENDENT_CI:env.SENATE864_INDEPENDENT_MAIN},event);
 if(!event.head_commit.message.includes(MARKER))throw Error('Reviewed inventory marker absent');
 mkdirSync(OUT,{recursive:true});
 const target=await discoverExistingVotePredictNeonConnection({apiKey:env.NEON_API_KEY||'',projectId:env.VOTEPREDICT_NEON_PROJECT_ID||'',preferredDatabase:env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
 const pool=new Pool({host:target.host,port:target.port,user:target.role,password:target.password,database:target.database,ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:10000,query_timeout:60000,statement_timeout:55000,application_name:'senate864-population-readonly-inventory'});
 try{
 const initial=await readOnly(pool,target,async db=>(await db.query(DOC_SQL)).rows),stored=initial.result;
 const pdfs=stored.filter(d=>d.source_kind==='senate_committee_minutes').map(d=>({...d,format:'pdf'}));
 const html=stored.filter(d=>d.source_kind==='senate_committee_minutes_html').map(d=>({...d,format:'html',authenticated:!!d.text&&sha(d.text)===d.content_sha256,extractionMethod:'stored_official_clerk_text',textSha256:sha(d.text||'')}));
 if(pdfs.length!==1452||html.length!==1379||html.some(d=>!d.authenticated))throw Error('Stored population or Clerk text SHA changed');
 const registry=new Map([...pdfs,...supplemental()].map(d=>[key(d),d]));if(registry.size!==1480)throw Error('PDF registry duplicate or missing');
 let priorReport=null,priorPlan=null;
 if(env.SENATE864_INVENTORY_REUSE_PUBLIC==='true'){
  priorPlan=load(ROOT+'senate-864-population-prior-inventory.json');
  const bytes=readFileSync(ROOT+'senate-864-population-acquired-cache-20261022.json.gz');
  const gitSha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(gitSha!==priorPlan.reportGitBlobSha)throw Error('Prior acquired public report blob identity changed');
  const decoded=gunzipSync(bytes,{maxOutputLength:15000000});
  if(sha(decoded)!==priorPlan.reportContentSha256)throw Error('Acquired source cache content SHA drift');
  priorReport=JSON.parse(decoded);
  if(priorReport.issue!==864||priorReport.schemaVersion!=='senate864-population-original-inventory-v1'||priorReport.reviewedCommit!==priorPlan.reviewedCommit||priorReport.runId!==priorPlan.runId||priorReport.originals.length!==2860||priorReport.productionWrites!==0||priorReport.readOnlyRepeatableReadAndExplicitRollback!==true)throw Error('Prior acquired population proof changed');
 }
 const priorRows=new Map((priorReport?.originals||[]).map(d=>[d.sourceUrl+'|'+d.originalSha256,d]));
 const priorOriginalUrls=new Set(priorOriginalQueue().map(p=>p.officialSourcePdfUrl));
 const wanted=[...registry.values()].filter(d=>!priorReport||priorOriginalUrls.has(d.source_url)||priorRows.get(key(d))?.status==='named_candidate_original');
 if(priorReport)for(const d of registry.values()){const r=priorRows.get(key(d));if(!r||r.date!==d.date||r.committee!==d.committee||r.session!==d.session_slug)throw Error('Prior population source registry drift');}
 const freshPdfs=await acquirePdfs(wanted),freshKeys=new Set(freshPdfs.map(key));
 const fetched=[...freshPdfs,...[...registry.values()].filter(d=>!freshKeys.has(key(d))).map(d=>({...d,reusePublicRow:priorRows.get(key(d)),authenticated:priorRows.get(key(d)).authenticated,text:''}))];
 if(priorReport)for(const d of freshPdfs)compareAcquiredPdfExtraction(priorRows.get(key(d)).extractedTextSha256,d);
 const rawSpec=load(ROOT+'senate-864-2022-25-141-official-no-pdf-meeting-to-Clerk-crosswalk.json').perOriginallyIndexedNoPdfMeeting.find(d=>d.originalSenateHearingId===17034);
 if(!rawSpec)throw Error('Unstored Clerk original missing');
 const url='https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=17034&ls=92&type=minutes',raw=await fetchSenateMinutesHtml(url);
 if(sha(raw)!==rawSpec.originalClerkSha256)throw Error('Unstored Clerk raw SHA changed');
 const text=extractSenateMinutesText(raw),clerkExtraction=authenticateUnstoredClerkExtraction(raw,text,rawSpec,priorRows.get(url+'|'+sha(raw)));
 const all=[...fetched,...html,{source_url:url,content_sha256:sha(raw),date:rawSpec.hearingDate,committee:rawSpec.committeeName,session_slug:session(rawSpec.hearingDate),format:'html_raw',text,authenticated:true,extractionMethod:'fresh_official_clerk_html',textSha256:sha(text),...clerkExtraction}].sort((a,b)=>a.date.localeCompare(b.date)||a.committee.localeCompare(b.committee)||a.source_url.localeCompare(b.source_url));
 if(all.length!==2860)throw Error('Population bound changed');
 const repeatedHearingBodies=new Set(all.filter(d=>all.some(other=>other.content_sha256===d.content_sha256&&other.date!==d.date)).map(key));
 const sourceIdentityHeld=d=>d.extractionTextChangedFromAcquiredCache===true||repeatedHearingBodies.has(key(d))||d.format==='pdf'&&d.text&&inspectOfficialSenatePdfHeader(d.text,d.date).sourceDateHeaderNeedsReview===true;
 const candidates=all.flatMap(d=>d.authenticated&&d.text&&!sourceIdentityHeld(d)?extractRowRollQuestions(d.text,d).filter(q=>q.confidence==='source_proven_question').map(q=>({q,d})):[]),identifiers=[...new Set(candidates.map(x=>x.q.billIdentifier))];
 const latest=await readOnly(pool,target,async db=>{
  const events=(await db.query(SNAPSHOT_SQL.events)).rows,choices=(await db.query(SNAPSHOT_SQL.choices)).rows,roster=(await db.query(SNAPSHOT_SQL.roster)).rows;
  const bills=(await db.query("SELECT b.id::text,b.identifier,b.session_id::text,b.originating_chamber_id::text AS chamber_id,s.slug AS session_slug FROM bills b JOIN legislative_sessions s ON s.id=b.session_id JOIN jurisdictions j ON j.id=s.jurisdiction_id WHERE j.slug='us-mn' AND s.slug IN ('2021-2022','2023-2024','2025-2026') AND (b.identifier=ANY($1::text[]) OR b.id=ANY($2::uuid[])) ORDER BY b.id LIMIT 301",[identifiers,events.map(e=>e.metadata?.issue864OriginalClassification?.billId).filter(Boolean)])).rows;
  if(events.length>=601||choices.length>=4001||roster.length>=401||bills.length>=301)throw Error('Bounded read truncated');
  const docs=(await db.query(DOC_SQL)).rows;if(JSON.stringify(docs)!==JSON.stringify(stored))throw Error('Source registry changed during acquisition');
  return {docs,events,choices,roster,bills};
 });
 const state=latest.result,priorDocs=priorOriginalQueue().map(p=>{
  const d=all.find(d=>d.source_url===p.officialSourcePdfUrl&&d.content_sha256===p.originalSourcePdfSha256);if(!d?.authenticated||!d.text)throw Error('Prior original unavailable');
  return {url:d.source_url,date:d.date,rawSha:d.content_sha256,text:d.text};
 });
 state.verifiedPriorQuestions=verifiedPriorQuestionEvents(authenticatePriorQuestionOriginals(priorDocs),state);
 const baseline=structuredClone(state),newIds=new Set(baseline.events.filter(e=>e.metadata?.issue864SourceRepair===VERSION&&!e.metadata?.issue864OriginalClassification).map(e=>e.id));
 baseline.events=baseline.events.filter(e=>!newIds.has(e.id));baseline.choices=baseline.choices.filter(v=>v.metadata?.issue864SourceRepair!==VERSION);
 for(const e of baseline.events){const old=e.metadata?.issue864OriginalClassification;if(e.metadata?.issue864SourceRepair===VERSION&&old){e.bill_id=old.billId;e.bill_identifier=baseline.bills.find(b=>b.id===old.billId)?.identifier||null;e.vote_kind=old.kind;e.amendment_ref=old.amendment;e.passed=old.passed;e.is_passage=old.isPassage;}}
 if(baseline.events.length!==183||baseline.choices.length!==1326)throw Error('Pre-engagement baseline not independently reconstructable');
 const rows=[],byBody=new Map();
 for(const d of all){const a=byBody.get(d.content_sha256)||[];a.push(d);byBody.set(d.content_sha256,a);}
 for(const d of all){
  if(d.reusePublicRow){rows.push(d.reusePublicRow);continue;}
  const inspected=inspectOriginal(d),raw=d.authenticated&&d.text?parseSenateCommitteeMinutesRaw(d.text).filter(q=>q.memberVotes.some(v=>['yea','nay'].includes(v.choice))):[],supp=d.authenticated&&d.text?extractSupplementalNamedSenateRollCandidates(d.text):[];
  if(sourceIdentityHeld(d))for(const q of inspected.questions){q.holds.push(d.extractionTextChangedFromAcquiredCache?'ocr_extraction_changed_requires_independent_review':'source_to_hearing_date_identity_requires_review');q.confidence='held_question';}
  rows.push({sourceId:sha(key(d)),sourceUrl:d.source_url,originalSha256:d.content_sha256,extractedTextSha256:d.textSha256||null,date:d.date,committee:d.committee,session:d.session_slug,format:d.format,authenticated:d.authenticated,readable:!!d.text,extractionMethod:d.extractionMethod,extractionTextChangedFromAcquiredCache:d.extractionTextChangedFromAcquiredCache===true,previousExtractedTextSha256:d.previousExtractedTextSha256||null,historicalCrosswalkTextSha256:d.historicalCrosswalkTextSha256||null,extractionShaReference:d.extractionShaReference||null,status:inspected.status,candidateOriginalExtractedText:inspected.status==='named_candidate_original'?d.text:null,candidateTextIsUncertifiedQuestion:true,acquisitionHold:d.acquisitionHold||null,extractionError:d.error||null,ocrVisualQualityCertified:false,header:d.format==='pdf'&&d.text?inspectOfficialSenatePdfHeader(d.text,d.date):null,repeatedIdenticalBodyDifferentDate:(byBody.get(d.content_sha256)||[]).some(x=>x.date!==d.date),detectorCandidates:inspected.candidates,detectorChoiceOccurrences:inspected.choiceOccurrences,parserCounts:inspected.parserCounts||null,unresolvedExtractionSignals:inspected.unresolvedExtractionSignals,
  rawNamedCandidates:raw.map(q=>({billIdentifier:q.billIdentifier||null,motionText:q.motionText||null,voteKind:q.voteKind||null,amendmentRef:q.amendmentRef||null,printedOutcome:q.outcome||null,namesMatchTally:q.namesMatchTally??null,yea:q.memberVotes.filter(v=>v.choice==='yea').length,nay:q.memberVotes.filter(v=>v.choice==='nay').length,choiceFingerprintSha256:q.memberVotes.filter(v=>['yea','nay'].includes(v.choice)).map(v=>sha(v.choice+':'+norm(v.name))).sort(),certifiedDistinctQuestion:false})),
  supplementalNamedCandidates:supp.map(q=>({sourceOffset:q.sourceOffset,...candidateContext(d.text,q.sourceOffset),namedYeaCount:q.namedYeaCount,namedNayCount:q.namedNayCount,choiceFingerprintSha256:q.choiceIdentitySha256,numericTallyMatches:q.numericTallyMatchesExplicitNamedList,namesUniqueAndExclusive:q.namesUniqueAndExclusive,attendance:sourceAbsenteeChoiceConflicts(d.text,q),certifiedDistinctQuestion:false})),
  rowQuestions:inspected.questions.map(q=>({questionKey:q.questionKey||null,billIdentifier:q.billIdentifier||null,voteKind:q.voteKind||null,amendmentRef:q.amendmentRef||null,motionText:q.motionText||null,choices:q.choices.length,confidence:q.confidence,holds:q.holds,sourcePassageSha256:q.fullQuestionPassageSha256||null}))});
 }
 const unique=new Map(),aliasGroups=new Map();
 for(const x of candidates){
  const fp=sha(JSON.stringify(x.q.choices.map(v=>v.choice+':'+norm(v.name)).sort())),old=unique.get(x.q.questionKey);
  if(old&&old.fp!==fp)throw Error('Same question key has contradictory source choices');
  if(!old)unique.set(x.q.questionKey,{...x,fp,sources:[x.d.source_url],occurrences:[x]});else{old.sources.push(x.d.source_url);old.occurrences.push(x);}
 }
 for(const x of unique.values()){const k=[x.d.date,norm(x.d.committee),x.q.billIdentifier,x.q.voteKind,x.q.amendmentRef].join('|'),g=aliasGroups.get(k)||[];g.push(x);aliasGroups.set(k,g);}
 const aliases=[...aliasGroups.values()].filter(g=>g.length>1&&new Set(g.flatMap(x=>x.sources)).size>1).map(g=>({reason:'cross_original_wording_or_committee_alias_not_independently_equivalent',keys:g.map(x=>x.q.questionKey),sourceUrls:[...new Set(g.flatMap(x=>x.sources))]})),excluded=new Set(aliases.flatMap(g=>g.keys));
 const questions=[...unique.values()].filter(x=>!excluded.has(x.q.questionKey)).map(x=>({questionKey:x.q.questionKey,date:x.d.date,committee:x.d.committee,billIdentifier:x.q.billIdentifier,voteKind:x.q.voteKind,amendmentRef:x.q.amendmentRef,motionText:x.q.motionText,choices:x.q.choices.length,choiceFingerprintSha256:x.fp,sourceUrls:x.sources,production:coalesceQuestionSources(x.occurrences,state),baseline:coalesceQuestionSources(x.occurrences,baseline)}));
 const after=summarize(rows,questions,state),before=summarize(rows,questions.map(x=>({...x,production:x.baseline})),baseline);
 const limits=['This acquired-original inventory is not a certified all-format named-question denominator.','Parser streams overlap; maxima and choice occurrences are not additive distinct votes.','No detected roll in extracted text is not a visually certified negative; OCR quality remains uncertified.','Cross-original aliases, header/weekday and absentee conflicts, and repeated bodies across dates remain holds.','Six indexed dates still lack authenticated Minutes; 1586/1592 meeting coverage is not a vote denominator.','2021 print research and 2022 print/electronic equivalence remain unresolved; neither is certified zero.'];
 const summary={schemaVersion:'senate864-population-original-inventory-v1',issue:864,reviewedCommit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,readAt:latest.readAt,reusedPopulationAcquisition:priorPlan?{runId:priorPlan.runId,reviewedCommit:priorPlan.reviewedCommit,reportGitBlobSha:priorPlan.reportGitBlobSha,reportContentSha256:priorPlan.reportContentSha256,origin:priorPlan.origin,cacheCommit:priorPlan.commit}:null,freshPdfBodies:freshPdfs.length,storedClerkTextOriginalsRevalidated:html.length,productionWrites:0,readOnlyRepeatableReadAndExplicitRollback:true,originals:all.length,readableOriginals:rows.filter(r=>r.readable).length,unavailableOrUnparseable:rows.filter(r=>!r.readable).length,namedCandidateOriginals:rows.filter(r=>r.status==='named_candidate_original').length,extractedTextNoNamedDetected:rows.filter(r=>r.status==='examined_no_named_roll').length,uniqueStrictQuestionKeys:unique.size,crossOriginalAliasGroups:aliases,certifiedDistinctRowQuestions:questions.length,certifiedDistinctRowChoices:questions.reduce((n,q)=>n+q.choices,0),before,after,limitations:limits};
 save(OUT+'/senate-864-population-original-registry-20261022.json',rows.map(({sourceId,sourceUrl,originalSha256,extractedTextSha256,date,committee,session,format,authenticated,readable,extractionMethod})=>({sourceId,sourceUrl,originalSha256,extractedTextSha256,date,committee,session,format,authenticated,readable,extractionMethod})));
 save(OUT+'/senate-864-population-original-inventory-20261022.json',{...summary,originals:rows,distinctRowQuestions:questions});
 save(OUT+'/senate-864-population-summary-20261022.json',summary);
 writeFileSync(OUT+'/senate-864-population-committee-before-20261022.csv',csv(committeeMatrix(before)));writeFileSync(OUT+'/senate-864-population-committee-after-20261022.csv',csv(committeeMatrix(after)));
 console.log('SENATE864_POPULATION_INVENTORY='+JSON.stringify({...summary,before:{...before,byCommittee:undefined,storedByCommittee:undefined},after:{...after,byCommittee:undefined,storedByCommittee:undefined}}));
 }finally{await pool.end();}
}
if(process.argv[1]===import.meta.filename){
if(process.argv[2]==='--worker'&&process.argv.length===5)await worker(process.argv[3],process.argv[4]);
else if(process.argv.length===2)await main().catch(e=>{console.error('SENATE864_INVENTORY_HOLD='+safeError(e));process.exitCode=1;});
else throw Error('Fixed inventory modes only');

}
