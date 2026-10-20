import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {parseJournalPaperActions,rollMatches,hash,explicitVersionLocator,stripInterposedSenateJournalRollHeader} from '../src/operations/senate-vote-paper-parser.js';
import {readVoteTextGapAudit,verifyVoteTextGapAudit,VOTE_TEXT_GAP_AUDIT_VERSION,type VoteTextGapAudit} from '../src/operations/senate-vote-text-gap-audit.js';
import {backfillVotePapers,historyRoster,parseDatedRoleActs,verifyPaperSources,connectExplicitBaseCaptures,storeHistoricalRoles} from '../src/operations/senate-vote-paper-backfill.js';
import {archiveCaptures,archiveTimestamp,validHistorySource,captureArchivedHistory,recoverHistoricalArchives,statedAssignmentDate,stageHistoryJobs,historyPaperIdentity,legacyHistoryAliases,fetchCanonicalGovernmentSource} from '../src/operations/senate-history-archive.js';
import {assertPaperHistoryRun,PAPER_HISTORY_MARKER} from '../src/operations/senate-paper-history-gate.js';
import {parseSenateJournalText} from '../src/sources/minnesota/senate-journals.js';
import {senateJournalEventsToRaw} from '../src/sources/minnesota/senate-raw-votes.js';

const roll=(a:string,b:string,all=false)=>`The roll was called, and there were yeas ${all?2:1} and nays ${all?0:1}, as follows:
Those who voted in the affirmative were:
${a}
${all?b:'Those who voted in the negative were:\n'+b}
`;
function sequence(bill:string,a:string,b:string){return [
 `Senator ${a} moved to amend S.F. No. ${bill}, the first unofficial engrossment, as follows:\nPage 1, line 1, delete "one" and insert "two".\nThe motion prevailed. So the amendment was adopted.`,
 ...['three','four','five'].map((word,i)=>`Senator ${a} moved to amend S.F. No. ${bill}, the first unofficial engrossment, as follows:\nPage 1, line ${i+2}, delete "old" and insert "${word}".\nThe question was taken on the adoption of the amendment.\n${roll(a,b,i===2)}\n${i===1?'The motion did not prevail. So the amendment was not adopted.':'The motion prevailed. So the amendment was adopted.'}`),
 `S.F. No. ${bill} was read the third time.\nThe question was taken on the final passage of S.F. No. ${bill}, as amended.\n${roll(a,b,true)}\nSo the bill passed and its title was agreed to.`,
].join('\n');}
function legislativePdf(number:number):Buffer{
 const stream=`BT /F1 12 Tf 40 740 Td (S.F. No. ${number} First Unofficial Engrossment) Tj 0 -20 Td (A bill for an act relating to official legislative records.) Tj 0 -20 Td (Section 1. Public records shall be preserved with their original source identity and actual dates.) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let body='%PDF-1.4\n';const offsets=[0];for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(body);body+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
 return Buffer.from(body+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}


test('vote-to-paper gap buckets reconcile all official events without promoting bill-only text',()=>{
 const baseline=[{session:'2023-2024',vote_kind:'amendment',official_events:'3',exact_question_links:'1'}];
 const row=(evidence_stage:string,event_count:number)=>({
  session:'2023-2024',vote_kind:'amendment',source_family:'senate_journal',evidence_stage,event_count,
  exact_proposed_text:evidence_stage==='exact_question'?1:0,
  exact_explicit_base:0,exact_captured_base:0,exact_in_journal_prior_adoptions:0,
  exact_verified_original:evidence_stage==='exact_question'?1:0,
 });
 const audit:VoteTextGapAudit={schemaVersion:VOTE_TEXT_GAP_AUDIT_VERSION,auditedEvents:3,
  groups:[row('exact_question',1),row('same_source_day_bill_unlinked',2)],
  examples:[{session:'2023-2024',vote_kind:'amendment',source_family:'senate_journal',
   evidence_stage:'same_source_day_bill_unlinked',bill:'HF100',vote_day:'2023-04-28',event_count:2}],
  hf100Pilot:[]};
 assert.doesNotThrow(()=>verifyVoteTextGapAudit(audit,baseline));
 assert.throws(()=>verifyVoteTextGapAudit({...audit,auditedEvents:4},baseline),
  /total does not balance/);
 assert.throws(()=>verifyVoteTextGapAudit(audit,[{...baseline[0],exact_question_links:'2'}]),
  /exact official-event reconciliation/);
 assert.throws(()=>verifyVoteTextGapAudit({...audit,groups:[row('exact_question',1),
  {...row('same_source_day_bill_unlinked',2),exact_captured_base:1}]},baseline),
  /incorrectly promoted/);
 assert.throws(()=>verifyVoteTextGapAudit({...audit,examples:[
  {...audit.examples[0],bill:'DROP TABLE'}]},baseline),/unsafe case example/);
});

test('authenticated page heading between a roll and affirmative list preserves the full named division',()=>{
 const journal=[
  'Senator Pratt moved that H.F. No. 100 be re-referred to the Committee on Finance.',
  'The question was taken on the adoption of the Pratt motion.',
  'The roll was called, and there were yeas 1 and nays 1, as follows:',
  '59TH DAY]FRIDAY, APRIL 28, 20236889Those who voted in the affirmative were:',
  'Abeler',
  'Those who voted in the negative were:',
  'Boldon',
  'The motion did not prevail.'
 ].join('\n');
 const stripped=stripInterposedSenateJournalRollHeader(journal);
 assert.ok(stripped.includes('as follows:\nThose who voted in the affirmative were:'));
 assert.ok(journal.includes('59TH DAY]FRIDAY, APRIL 28, 20236889'),'retained original is never rewritten');
 const actions=parseJournalPaperActions(journal,['Abeler','Boldon']);
 assert.equal(actions.length,1);
 assert.equal(actions[0].kind,'procedural');
 assert.equal(actions[0].billIdentifier,'HF100');
 assert.equal(actions[0].yeas,1);
 assert.equal(actions[0].nays,1);
 assert.match(actions[0].ballotSignature??'',/^[0-9a-f]{64}$/);

 for(const variant of ['2023 6889','2023\n6889']){
  const relayout=journal.replace('20236889',variant);
  assert.notEqual(stripInterposedSenateJournalRollHeader(relayout),relayout,
   'Only the independently recognizable Senate page heading is stripped');
  const [restored]=parseJournalPaperActions(relayout,['Abeler','Boldon']);
  assert.equal(restored?.ballotSignature,actions[0].ballotSignature,
   'Whitespace introduced by PDF extraction cannot change any named voter identity');
 }


 const reverse=journal.replace('59TH DAY]FRIDAY, APRIL 28, 20236889',
  '6890 JOURNAL OF THE SENATE [59TH DAY');
 assert.notEqual(stripInterposedSenateJournalRollHeader(reverse),reverse);
 const reversedActions=parseJournalPaperActions(reverse,['Abeler','Boldon']);
 assert.equal(reversedActions.length,1);
 assert.equal(reversedActions[0].ballotSignature,actions[0].ballotSignature,
  'The printed reversed running head is not a senator and does not change the ballot');
 const hostile=reverse.replace('JOURNAL OF THE SENATE','UNKNOWN PUBLICATION');
 assert.equal(stripInterposedSenateJournalRollHeader(hostile),hostile);
 assert.equal(parseJournalPaperActions(hostile,['Abeler','Boldon'])[0].ballotSignature,null);


 const extracted=journal.replace('59TH DAY]FRIDAY, APRIL 28, 20236889',
  '6889 FRIDAY, APRIL 28, 2023 59TH DAY] -- 289 of 292 -- ');
 assert.notEqual(stripInterposedSenateJournalRollHeader(extracted),extracted,
  'Only the exact official reordered date heading plus PDF page counter is stripped');
 const [recovered]=parseJournalPaperActions(extracted,['Abeler','Boldon']);
 assert.equal(recovered?.ballotSignature,actions[0].ballotSignature,
  'Source PDF header reordering leaves the complete named ballot unchanged');
 const changedFooter=extracted.replace('289 of 292','289 from 292');
 assert.equal(stripInterposedSenateJournalRollHeader(changedFooter),changedFooter);
 assert.equal(parseJournalPaperActions(changedFooter,['Abeler','Boldon'])[0]?.ballotSignature,null,
  'An unrecognized PDF footer cannot silently become an official voter list');

 const unsafe=journal.replace('59TH DAY]FRIDAY, APRIL 28, 20236889','Unverified page header:');
 assert.equal(stripInterposedSenateJournalRollHeader(unsafe),unsafe);
 assert.equal(parseJournalPaperActions(unsafe,['Abeler','Boldon'])[0].ballotSignature,null,
  'unrecognized header cannot silently become a named ballot');
});

test('unnumbered proposals preserve voice action, rejected text, order and explicit base without claiming an assembled bill',()=>{
 const actions=parseJournalPaperActions(sequence('123','Alpha','Beta'),['Alpha','Beta']);
 assert.equal(actions.length,5);assert.equal(actions.filter(x=>x.proposedText).length,4);
 assert.equal(actions.filter(x=>x.kind==='amendment'&&x.baseLocator==='versions/ue/1/').length,4);
 assert.equal(actions[0].ballotSignature,null);
 assert.equal(actions[2].outcome,'rejected');
 assert.deepEqual(actions.at(-1)!.priorAdoptedKeys,[actions[0].key,actions[1].key,actions[3].key]);
 assert.equal(actions.at(-1)!.priorAdoptedKeys.includes(actions[2].key),false);
 const comparable={billIdentifier:'SF123',motionText:actions[1].questionText,yeas:1,nays:1,ballotSignature:actions[1].ballotSignature};
 assert.equal(actions.filter(x=>rollMatches(x,comparable)).length,2,'identical question and ballots remain ambiguous');
 assert.equal(rollMatches(actions[1],{...comparable,ballotSignature:hash('different named roster')}),false);
 assert.equal(rollMatches(actions[1],{...comparable,motionText:'An older parser retained this source context. '+comparable.motionText}),true);
 assert.equal(explicitVersionLocator('the second unofficial engrossment'),'versions/ue/2/');
 assert.equal(explicitVersionLocator('latest version'),null);
 const huge='Senator Alpha moved to amend S.F. No. 123, as follows:\nPage 1, line 1, insert '+('x'.repeat(1_500_100));
 assert.deepEqual(parseJournalPaperActions(huge,['Alpha']),[],'truncated proposal never becomes a complete paper');
 const nested='Senator Alpha moved to amend S.F. No. 123, as follows:\nPage 1, line 1, insert "proposal words".\nSenator Beta moved to amend the Alpha amendment, as follows:\nPage 1, line 1, delete "words".\nThe question was taken on adoption of the amendment to the amendment.\n'+roll('Alpha','Beta')+'The motion prevailed.';
 assert.equal(parseJournalPaperActions(nested,['Alpha','Beta']).some(a=>a.proposedText),false,'nested papers are held rather than merged');
 const withdrawn='Senator Alpha moved to amend S.F. No. 123, as follows:\nPage 1, line 1, insert "proposal words".\nSenator Alpha moved to withdraw the amendment.\nThe motion prevailed.';
 assert.equal(parseJournalPaperActions(withdrawn,['Alpha','Beta']).some(a=>a.outcome==='adopted'),false);
});

test('dated roles require an enacted leadership declaration or explicit minutes role, not a nomination or biennium',()=>{
 const text='Senator Alpha received 36 votes of the members of the Senate and was duly elected President of the Senate. '+
  'The Senate Majority Leader is Beta. Senator Beta moved adoption. The resolution was adopted.';
 assert.deepEqual(parseDatedRoleActs(text,null,true).map(x=>[x.senatorName,x.role,x.startsOn]),[['Alpha','President',null],['Beta','Majority Leader',null]]);
 assert.deepEqual(parseDatedRoleActs('Senator Alpha moved that Senator Beta be elected President of the Senate.',null,true),[]);
 assert.deepEqual(parseDatedRoleActs('The Senate Majority Leader is Beta. The motion did not prevail.',null,true),[]);
 assert.equal(parseDatedRoleActs('Chair Senator Alpha called the meeting to order.\nSenator Beta, Vice Chair.','Finance',false).length,2);
 assert.deepEqual(parseDatedRoleActs('Senator Alpha testified as chair of a nonprofit.','Finance',false),[]);
 assert.equal(parseDatedRoleActs('Senator Alpha and Senator Beta were duly elected Co-Presiding Officers of the Senate.',null,true).length,2);
 assert.equal(statedAssignmentDate('Minnesota Senate\n2022 Committee Assignments\n02/02/2022\nMembers','2021-2022'),'2022-02-02');
 assert.equal(statedAssignmentDate('2023 Committee Assignments\nAs of: 02/30/2023','2023-2024'),null);
 assert.equal(statedAssignmentDate('2023-2024 Committee Assignments','2023-2024'),null);
});

test('archives require exact original URLs, valid capture clocks, historical windows, and non-latest official paper URLs',()=>{
 const url='https://www.revisor.mn.gov/bills/93/2023/0/SF/123/versions/ue/1/';
 assert.equal(validHistorySource('bill_text',url),true);assert.equal(validHistorySource('bill_text',url.replace('ue/1','latest')),false);
 assert.equal(validHistorySource('bill_text',url+'pdf/'),true);
 const legacy=legacyHistoryAliases(url)[0];assert.equal(historyPaperIdentity(legacy)?.locator,'versions/ue/1/');
 assert.equal(historyPaperIdentity(legacy)?.slug,'2023-2024');
 assert.equal(validHistorySource('bill_text',legacy),true);
 assert.equal(validHistorySource('bill_text',legacy.replace('version=1','version=latest')),false);
 assert.equal(validHistorySource('bill_text',legacy.replace('session_number=0','session_number=1')),false);
 assert.equal(validHistorySource('bill_text',legacy+'&version=2'),false);
 assert.equal(validHistorySource('bill_text',legacy.replace('type=ue','type=ccr').replace('version=1','version=latest')),false);
 assert.equal(validHistorySource('bill_text',url.replace('/93/2023/','/93/2025/')),false);
 assert.equal(validHistorySource('bill_text',url.replace('www.revisor.mn.gov','example.test')),false);
 const selected=archiveCaptures([['timestamp','original','statuscode'],['20230301000000',url,'200'],['20230401000000',url.replace('https:','http:'),'200'],
  ['20230501000000',url.replace('SF/123','SF/124'),'200'],['20260101000000',url,'200']],url,'2023-2024');
 assert.deepEqual(selected.map(x=>x.stamp),['20230301000000','20230401000000']);
 assert.equal(archiveTimestamp('20230230000000'),null);assert.equal(archiveTimestamp('99990101000000'),null);
 assert.equal(archiveTimestamp('20230301000000'),'2023-03-01T00:00:00Z');
});

test('database failures during archived-body persistence propagate rather than turning into source unavailability',async()=>{
 const url='https://www.revisor.mn.gov/bills/93/2023/0/SF/123/versions/ue/1/';
 const job={job_key:'a'.repeat(64),kind:'bill_text',session_id:randomUUID(),bill_id:randomUUID(),source_url:url,slug:'2023-2024',identifier:'SF123'};
 const db={query:async(sql:string)=>{
  if(sql.includes('WITH ranked'))return {rows:[job]};
  if(sql.startsWith('INSERT'))throw Error('deliberate-storage-failure');
  return {rows:[]};
 }} as unknown as Pool;
 const body='<title>SF 123 First Unofficial Engrossment</title><div id="document">A bill for an act '+('valid legislative words '.repeat(20))+'</div></main>';
 await assert.rejects(recoverHistoricalArchives(db,{maxJobs:1,sleep:async()=>{},fetchImpl:async url=>String(url).includes('/cdx/')?
  Response.json([['timestamp','original','statuscode'],['20230301000000',job.source_url,'200']]):new Response(body)}),/deliberate-storage-failure/);
});

test('paper-history production requires exact reviewed main, independent CI, first attempt and approved trigger',()=>{
 const sha='a'.repeat(40),env:NodeJS.ProcessEnv={NODE_ENV:'test',GITHUB_REPOSITORY:'killjoy00/votepredict',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,
  GITHUB_WORKFLOW_REF:'killjoy00/votepredict/.github/workflows/senate-paper-history-production.yml@refs/heads/main',GITHUB_EVENT_NAME:'push',VOTEPREDICT_SENATE_PAPER_HISTORY_INDEPENDENT_CI:'true'};
 const event={repository:{full_name:'killjoy00/votepredict',default_branch:'main'},ref:'refs/heads/main',after:sha,head_commit:{id:sha,message:PAPER_HISTORY_MARKER}};
 assert.doesNotThrow(()=>assertPaperHistoryRun(env,event));
 for(const change of [{GITHUB_REF:'refs/pull/1/merge'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{VOTEPREDICT_SENATE_PAPER_HISTORY_INDEPENDENT_CI:'false'}])
  assert.throws(()=>assertPaperHistoryRun({...env,...change},event));
 assert.throws(()=>assertPaperHistoryRun(env,{...event,forced:true}));
 assert.throws(()=>assertPaperHistoryRun(env,{...event,head_commit:{id:sha,message:'unmarked merge'}}));
 assert.doesNotThrow(()=>assertPaperHistoryRun({...env,GITHUB_EVENT_NAME:'schedule'},{repository:event.repository,schedule:'11 * * * *'}));
});

export async function exercisePaperHistory(pool:Pool){
 const tag='Paper'+randomUUID().replace(/[^a-f]/g,'').slice(0,10),a=tag+' Alpha',b=tag+' Beta';
 const q=async(sql:string,args:unknown[]=[])=> (await pool.query(sql,args)).rows[0];
 const j=(await q("INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).id;
 const ch=(await q("INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Senate','upper') ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",[j])).id;
 const session=(await q("INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) VALUES($1,'2023-2024','fixture','2023-01-01','2024-12-31') ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",[j])).id;
 const members:string[]=[];
 for(const name of [a,b]){
  const person=(await q('INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) VALUES($1,$2,$3,lower($3)) RETURNING id',[j,name,name])).id;
  members.push((await q("INSERT INTO memberships(legislator_id,session_id,chamber_id,district,party,title,starts_on,ends_on) VALUES($1,$2,$3,$4,'fixture','Senator','2023-01-01','2024-12-31') RETURNING id",[person,session,ch,String(members.length+1)])).id);
 }
 const number=100000+Number.parseInt(randomUUID().slice(0,5),16)%800000,identifier='SF'+number;
 const bill=(await q("INSERT INTO bills(session_id,originating_chamber_id,identifier,title,introduced_at) VALUES($1,$2,$3,'paper fixture','2023-01-01') RETURNING id",[session,ch,identifier])).id;
 const text=sequence(String(number),a,b),url='https://www.senate.mn/journals/2023-2024/'+tag+'.pdf';
 const parsed=parseSenateJournalText({text,sessionKey:'fixture',sourceUrl:url,occurredOn:'2023-04-01',knownMemberNames:[a,b]});
 const raw={sourceType:'mn_senate_journal',sessionSlug:'2023-2024',sourceDate:'2023-04-01',text,records:senateJournalEventsToRaw(parsed)};
 const source=(await q(`INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,metadata)
  VALUES($1,$2,$3,'paper_fixture',$4,$5,$6::jsonb) RETURNING id`,[j,session,ch,url,'c'.repeat(64),JSON.stringify({rawPrepassageVotes:raw})])).id;
 for(const [index,event] of parsed.entries()){
  const id=(await q(`INSERT INTO vote_events(session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,occurred_on,yea_count,nay_count,is_passage)
   VALUES($1,$2,$3,$4,$5,$6,$7,'2023-04-01',$8,$9,$10) RETURNING id`,[session,ch,bill,source,tag+index,event.voteKind,event.motionText,event.yeaCount,event.nayCount,event.isPassage])).id;
  for(const v of event.memberVotes)await pool.query(`INSERT INTO member_votes(vote_event_id,membership_id,source_member_name,normalized_member_name,choice)
   VALUES($1,$2,$3,lower($3),$4)`,[id,members[v.sourceName===a?0:1],v.sourceName,v.choice]);
 }
 const roleSource=(await q(`INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,metadata)
  VALUES($1,$2,$3,'paper_fixture',$4,$5,$6::jsonb) RETURNING id`,[j,session,ch,'https://example.test/'+tag,'d'.repeat(64),JSON.stringify({rawPrepassageVotes:{sourceType:'mn_senate_committee_minutes_html',sessionSlug:'2023-2024',sourceDate:'2023-02-01',committeeName:'Finance',text:`Chair Senator ${a} called the meeting to order.\nSenator ${b}, Vice Chair.`,records:[]}})])).id;
 await backfillVotePapers(pool,1000);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_current_v WHERE bill_id=$1',[bill])).n,5);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_exact_raw_v WHERE bill_id=$1',[bill])).n,2,'ambiguous duplicate ballots do not link');
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v WHERE bill_id=$1',[bill])).n,2);
 await backfillVotePapers(pool,1000);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_actions WHERE bill_id=$1',[bill])).n,5,'idempotent');
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_evidence_asof('2023-02-02',$1) WHERE evidence_type='committee_role' AND source_url=$2",[members[0],'https://example.test/'+tag])).n,1);
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_evidence_asof('2023-02-01',$1) WHERE evidence_type='committee_role' AND source_url=$2",[members[0],'https://example.test/'+tag])).n,0);
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_role_history_v WHERE membership_id=$1 AND observed_on<'2023-02-02'",[members[0]])).n,1);
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_role_history_v WHERE membership_id=$1 AND observed_on<'2023-02-01'",[members[0]])).n,0);
 const roleHtml=`<h1>2023 - 2024 Biennium</h1><h2>Finance Committee</h2><h3>Committee Leadership</h3><p>Chair</p><p>${a}, 1, DFL</p><h3>Committee Members</h3><p>${b}, 2, R</p>`;
 const roster=await historyRoster(pool),job={job_key:'e'.repeat(64),kind:'role_html' as const,session_id:session,bill_id:null,slug:'2023-2024',identifier:null,source_url:'https://www.senate.mn/committees/committee_bio.html?cmte_id=3120&ls=93'};
 const statedUrl='https://example.test/'+tag+'/dated-roster';
 await storeHistoricalRoles(pool,roster,{sessionId:session,slug:'2023-2024',sourceUrl:statedUrl,body:'Official dated source retained today',originalSha:'e'.repeat(64),
  occurredOn:'2023-01-01',kind:'official_dated_roster',roles:[{senatorName:a,role:'Chair',committee:'Finance',startsOn:null,endsOn:null,rawContent:'Historical role fact'}]});
 const stated=await q("SELECT role_observed_on::text AS fact_date,observed_on=fetched_at::date AS actual_clock FROM senate_role_history_v WHERE source_url=$1",[statedUrl]);
 assert.equal(stated.fact_date,'2023-01-01');assert.equal(stated.actual_clock,true);
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_evidence_asof('2023-04-01',$1) WHERE source_url=$2",[members[0],statedUrl])).n,0,'a printed roster date does not backdate current words');
 assert.ok(await captureArchivedHistory(pool,job,'20230301000000',Buffer.from(roleHtml),roster)>0);
 assert.equal((await q("SELECT count(*)::int AS n FROM senate_role_history_v WHERE membership_id=$1 AND observed_basis='role.authenticated_archive_observation' AND observed_on='2023-03-01'",[members[0]])).n,2);
 const versionUrl=`https://www.revisor.mn.gov/bills/93/2023/0/SF/${number}/versions/ue/1/`;
 const billJob={...job,kind:'bill_text' as const,bill_id:bill,source_url:versionUrl,identifier};
 const billHtml=`<title>SF ${number} First Unofficial Engrossment</title><div id="document">A bill for an act ${'official legislative language '.repeat(20)}</div></main>`;
 assert.equal(await captureArchivedHistory(pool,billJob,'20230301000000',Buffer.from(billHtml),roster),1);
 assert.equal(await captureArchivedHistory(pool,billJob,'20230301000000',Buffer.from(billHtml.replace('SF '+number,'SF 999999')),roster),0);
 await connectExplicitBaseCaptures(pool);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_components_current_v c JOIN senate_vote_paper_current_v a ON a.id=c.action_id WHERE a.bill_id=$1',[bill])).n,4);
 assert.equal(await captureArchivedHistory(pool,{...billJob,source_url:versionUrl+'pdf/'},'20230301000000',legislativePdf(number),roster),1);
 await connectExplicitBaseCaptures(pool);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_components_current_v c JOIN senate_vote_paper_current_v a ON a.id=c.action_id WHERE a.bill_id=$1',[bill])).n,8,'HTML and PDF are separately sourced representations');
 await captureArchivedHistory(pool,billJob,'20230302000000',Buffer.from(billHtml.replace('official legislative','changed legislative')),roster);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_components_current_v c JOIN senate_vote_paper_current_v a ON a.id=c.action_id WHERE a.bill_id=$1',[bill])).n,4,'conflicting bodies at one URL hold only that representation');
 assert.equal(await captureArchivedHistory(pool,{...billJob,source_url:legacyHistoryAliases(versionUrl)[0]},'20230303000000',Buffer.from(billHtml),roster),1);
 await connectExplicitBaseCaptures(pool);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_components_current_v c JOIN senate_vote_paper_current_v a ON a.id=c.action_id WHERE a.bill_id=$1',[bill])).n,8,'verified legacy endpoint retains the same explicit edition identity');
 await verifyPaperSources(pool,30,async sourceUrl=>{if(sourceUrl!==url)throw Error('fixture-only');return {text,pdfSha256:'f'.repeat(64),byteLength:2000}});
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_current_v WHERE bill_id=$1 AND original_source_verified',[bill])).n,5);
 const coverage=(await pool.query("SELECT * FROM senate_vote_paper_coverage_v WHERE session='2023-2024'")).rows;
 const allCoverage=(await pool.query('SELECT * FROM senate_vote_paper_coverage_v')).rows;
 const populationAudit=await readVoteTextGapAudit(pool);
 verifyVoteTextGapAudit(populationAudit,allCoverage);
 assert.ok(populationAudit.groups.some(x=>x.session==='2023-2024'
  && x.evidence_stage==='exact_question'&&x.event_count>0));
 assert.equal(populationAudit.groups.reduce((sum,g)=>sum+g.event_count,0),
  populationAudit.auditedEvents,'all accepted Senate events must be represented once');

 assert.ok(coverage.some(r=>r.vote_kind==='passage'&&Number(r.exact_question_links)>=1));
 assert.ok(coverage.some(r=>r.vote_kind==='amendment'&&Number(r.exact_base_observed_before_day)>=1));
 assert.ok(await stageHistoryJobs(pool)>0);
 await recoverHistoricalArchives(pool,{maxJobs:3,sleep:async()=>{},fetchImpl:async()=>Response.json([])});
 const link=await q('SELECT vote_event_id FROM senate_vote_paper_exact_event_v WHERE bill_id=$1 LIMIT 1',[bill]);
 await pool.query("UPDATE vote_events SET motion_text='changed question' WHERE id=$1",[link.vote_event_id]);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_exact_event_v WHERE bill_id=$1',[bill])).n,1);
 await pool.query(`UPDATE source_documents SET metadata=jsonb_set(metadata,'{rawPrepassageVotes,records,0,motionText}','"changed raw question"'::jsonb) WHERE id=$1`,[source]);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_vote_paper_current_v WHERE bill_id=$1',[bill])).n,0);
 await pool.query('DELETE FROM source_documents WHERE id=$1',[roleSource]);
 assert.equal((await q('SELECT count(*)::int AS n FROM senate_role_history_sources WHERE source_document_id=$1',[roleSource])).n,0);
}
const connection=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
test('Postgres: exact motion matching, archives, dated role exposure, idempotency and stale-link invalidation',
 {skip:!connection,timeout:120000},async()=>{const pool=new Pool({connectionString:connection,max:3});try{await exercisePaperHistory(pool)}finally{await pool.end()}});

test('canonical publisher aliases preserve exact paper and assignment identity',async()=>{
 const role='https://www.senate.mn/committees/2023-2024/info/comlegal.pdf';
 const bill='https://www.revisor.mn.gov/bills/93/2024/0/HF/100/versions/ue/1/';
 const canonical=bill.replace('/2024/','/2023/');
 for(const [source,kind,target] of [[role,'role_pdf',role.replace('www.senate.mn','assets.senate.mn')],[bill,'bill_text',canonical]] as const){
  const calls:string[]=[];
  const r=await fetchCanonicalGovernmentSource(source,kind,(async(url)=>{
   calls.push(String(url));return calls.length===1?new Response(null,{status:302,headers:{location:target}}):new Response('body');
  }) as typeof fetch);
  assert.equal(r.resolvedUrl,target);assert.deepEqual(calls,[source,target]);
 }
 for(const target of ['https://example.test/comlegal.pdf',role.replace('2023-2024','2025-2026')]){
  let calls=0;await assert.rejects(()=>fetchCanonicalGovernmentSource(role,'role_pdf',(async()=>{
   calls++;return new Response(null,{status:302,headers:{location:target}});
  }) as typeof fetch));assert.equal(calls,1);
 }
 for(const target of [bill.replace('/100/','/101/'),bill.replace('/ue/1/','/ue/2/'),bill+'pdf/',bill.replace('/2024/','/2021/'),'https://example.test/']){
  let calls=0;await assert.rejects(()=>fetchCanonicalGovernmentSource(bill,'bill_text',(async()=>{
   calls++;return new Response(null,{status:301,headers:{location:target}});
  }) as typeof fetch));assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(()=>fetchCanonicalGovernmentSource(role,'role_pdf',(async()=>{
  calls++;return new Response(null,{status:302,headers:{location:role}});
 }) as typeof fetch));assert.equal(calls,1);
});
