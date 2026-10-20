/** Fixed originals only. No generic Minutes replay, database writes or eligibility inference. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const fixture=()=>JSON.parse(readFileSync('tests/fixtures/senate-864-four-original-questions.json'));
export const MEDIA_FRAGMENTS=[
 'My view is that the free market is working.',
 'technical colleges could adapt a bit quicker',
 'Cybersecurity is very important, and very serious.'
];
export function compact(s){return String(s||'').replace(/\d+\/\d+\/\d+, \d+:\d+ [AP]M\s+Minnesota Senate/g,' ')
 .replace(/https:\/\/(?:goldpages\.|www\.)?senate.mn\/schedule\/hearing_minutes\.(?:php|html)\?hearing_id=\d+&ls=\d+\s+\d+\/\d+/g,' ')
 .replace(/-- \d+ of \d+ --/g,' ').replace(/\s+/g,' ').trim();}
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const full=s=>norm(s).split(' ').filter(t=>t.length>1).join(' ');
export function validateOriginalQuestions(document,text){
 if(sha(text)!==document.extractedTextSha256)throw Error('Exact original text changed');
 const t=compact(text);
 for(const m of document.motions){
  if(t.split(m.literal).length!==2||m.choices.length!==m.yea+m.nay||new Set(m.choices.map(v=>v.token)).size!==m.choices.length)throw Error('Question literal or printed-choice boundary changed');
  const x=m.literal.match(/(\d+)\/(\d+) \(Ayes\s*[:–]\s*(.*?); Nays\s*[:–]?\s*(.*?)\)\s*(MOTION PREVAILED|MOTION FAILED|The motion prevailed|The motion did not prevail)$/);
  const votes=x?[...x[3].split(',').filter(v=>v.trim()).map(token=>({token:token.trim(),choice:'yea'})),...x[4].split(',').filter(v=>v.trim()).map(token=>({token:token.trim(),choice:'nay'}))]:[];
  if(!x||+x[1]!==m.yea||+x[2]!==m.nay||JSON.stringify(votes)!==JSON.stringify(m.choices)||m.passed!==(!/not|FAILED/.test(x[5])))throw Error('Literal choices/outcome differ from attestation');
 }
 return true;
}
export function compareCommittee(document,docs,events,choices,roster){
 const originals=docs.filter(d=>d.source_url===document.sourceUrl&&d.content_sha256===document.originalRawPdfSha256);
 const selected=events.filter(e=>originals.some(d=>d.id===e.source_document_id));
 const sourceQuestions=document.motions.map(m=>{
  const tally=m.literal.match(/\d+\/\d+ \(Ayes[\s\S]*$/)[0];
  // A whole printed question, not a same-slate/ordinal association. Windows
  // containing multiple named rolls are deliberately classified ambiguous.
  const anchor=compact(m.literal.slice(0,m.literal.indexOf(tally))).trim();
  const anchored=selected.filter(e=>compact(e.motion_text).includes(anchor));
  const compatible=(e,q)=>{
   const qTally=q.literal.match(/\d+\/\d+ \(Ayes[\s\S]*$/)[0];
   return compact(e.motion_text).includes(compact(q.literal.slice(0,q.literal.indexOf(qTally))).trim())&&
    e.yea_count===q.yea&&e.nay_count===q.nay&&(!e.bill_identifier||e.bill_identifier===q.question.match(/^SF\d+/)?.[0]);
  };
  // More exact comparators, never a proximity or ordinal fallback. A complete
  // printed question anchor is mandatory. Repeated same-bill/same-tally
  // questions remain ambiguous; a contradictory stored bill is not reassigned.
  const unique=anchored.filter(e=>compatible(e,m)&&document.motions.filter(q=>compatible(e,q)).length===1);
  let storedChoiceMatches=0,storedChoiceConflicts=0,unresolvedFullIdentities=0;
  const expected=m.choices.map(v=>{
   const headers=document.people.filter(p=>norm(p).endsWith(norm(v.token)));
   const allowed=headers.length===1?[full(headers[0])]:[];
   // Independently accepted LRL full alias, not a surname rule.
   if(headers[0]==='Ron Latz')allowed.push(full('Ronald Steven Latz'));
   const session=document.year===2024?'2023-2024':'2025-2026';
   const people=roster.filter(p=>p.session_slug===session&&[p.name,p.normalized_name,...(p.aliases||[])].some(n=>allowed.includes(full(n)))&&p.starts_on&&p.ends_on&&p.starts_on<=document.meetingDate&&p.ends_on>=document.meetingDate);
   if(people.length!==1)unresolvedFullIdentities++;
   return {...v,membershipId:people.length===1?people[0].membership_id:null};
  });
  const match=unique.length===1?unique[0]:null;
  if(match){
   const actual=choices.filter(v=>v.vote_event_id===match.id);
   for(const v of expected){
    if(v.membershipId&&actual.filter(a=>a.membership_id===v.membershipId&&a.choice===v.choice).length===1)storedChoiceMatches++;
    else if(v.membershipId&&actual.some(a=>a.membership_id===v.membershipId))storedChoiceConflicts++;
   }
  }
  const expectedKind=m.question.includes('recommendation')?'motion':'amendment';
  return {question:m.question,page:m.page,sourceYea:m.yea,sourceNay:m.nay,sourcePassed:m.passed,
   anchoredStoredCandidates:anchored.length,uniquelyAnchoredStoredCandidates:unique.length,
   unambiguousStoredQuestion:!!match,storedChoiceMatches,storedChoiceConflicts,unresolvedFullIdentities,
   storedQuestionFieldsAgree:!!match&&match.yea_count===m.yea&&match.nay_count===m.nay&&match.passed===m.passed&&match.vote_kind===expectedKind&&match.is_passage===false,
   disposition:match?'source_question_anchored_compare_fields_and_choices':anchored.length?'stored_context_ambiguous_no_ordinal_assignment':'printed_question_not_anchored_in_selected_stored_text'};
 });
 return {day:document.meetingDate,committee:document.committeeName,sourceDocuments:originals.length,sourceNamedRolls:document.motions.length,sourceExplicitChoices:document.motions.reduce((n,m)=>n+m.choices.length,0),
  storedEvents:selected.length,storedChoices:choices.filter(v=>selected.some(e=>e.id===v.vote_event_id)).length,
  sourceQuestions,
  storedContextDiagnostics:selected.map(e=>({motionTextSha256:sha(e.motion_text||''),billIdentifier:e.bill_identifier??null,voteKind:e.vote_kind,amendmentRef:e.amendment_ref,yea:e.yea_count,nay:e.nay_count,passed:e.passed,
   literalContainedInOriginal:compact(document.sourceText).includes(compact(e.motion_text)),
   printedQuestionAnchorCount:sourceQuestions.filter(m=>m.anchoredStoredCandidates>0&&document.motions.some(q=>q.question===m.question&&compact(e.motion_text).includes(compact(q.literal.split(/\d+\/\d+ \(Ayes/)[0]).trim()))).length,
   namedChoices:choices.filter(v=>v.vote_event_id===e.id).length}))};
}
const money=s=>Math.round(Number(String(s).replaceAll(',',''))*100);
/** One SHA-pinned six-page report, one visually verified header/block layout.
 * Each Date header takes its own preceding printed counterparty block. No
 * moving proximity window and no cross-page or cross-counterparty matching.
 */
export function parseMillerPrintedRows(layout){
 const pages=String(layout).split('\f').filter(p=>p.trim());
 if(pages.length!==6||!pages[2].includes('Schedule A1 - IND')||!pages[3].includes('Schedule A1 - PCF')||!pages[4].includes('Schedule B1 - CE')||!pages[5].includes('Schedule B1 - NCD'))throw Error('Different six-page report/schedule identity');
 const rows=[];
 for(const [page,index,expected] of [[pages[2],3,9],[pages[3],4,9],[pages[4],5,10]]){
  const lines=page.split(/\r?\n/);let party=null,registration=null,found=0;
  for(let i=0;i<lines.length;i++){
   if(/^Date\s+/.test(lines[i].trim())){
    let start=i-1;while(start>=0&&lines[start].trim())start--;
    const block=lines.slice(start+1,i).filter(x=>x.trim());
    // Header immediately follows a printed name/address block. Some first
    // blocks follow the report committee title without a blank separator.
    while(block.length&&/Schedule|Miller, Jeremy Senator District 26 Committee/.test(block[0]))block.shift();
    if(block.length<2||block.length>4)throw Error('Printed name/address block not bounded');
    const heading=block[0].trim(),reg=heading.match(/ \(Registered Id: (\d+)\)$/);
    party=heading.replace(/ \(Registered Id: \d+\)$/,'');registration=reg?.[1]||null;
   }
   const d=lines[i].match(/^\s*(\d\d)\/(\d\d)\/(2024)\s+(.*?)\s*$/);
   if(!d)continue;
   if(!party)throw Error('Dated line lacks its own printed counterparty header');
   const printedAmounts=[...d[4].matchAll(/(?<!\S)([\d,]+\.\d\d)(?!\S)/g)];
   const fields=printedAmounts.map(x=>money(x[1]));
   const continuation=[];if(index===5)for(let j=i+1;j<lines.length&&lines[j].trim()&&!/^\s*(?:\d\d\/|Total|Date)/.test(lines[j]);j++)continuation.push(lines[j].trim());
   const purpose=index===5?compact(d[4].slice(0,printedAmounts[0]?.index)+' '+continuation.join(' ')):null;
   if(fields.length!==(index===5?4:3)||fields.at(-1)!==fields.slice(0,-1).reduce((a,b)=>a+b,0))throw Error('Printed amount columns do not reconcile');
   rows.push({page:index,schedule:index===3?'IND':index===4?'PCF':'CE',date:`2024-${d[1]}-${d[2]}`,party,registration,purpose,cents:fields[0],unpaid:index===5?fields[1]:0,inKind:fields.at(-2),total:fields.at(-1)});found++;
  }
  if(found!==expected)throw Error('Printed itemized transaction denominator changed');
 }
 if(rows.length!==28||rows.filter(r=>r.page===3).reduce((n,r)=>n+r.total,0)!==410000||rows.filter(r=>r.page===4).reduce((n,r)=>n+r.total,0)!==405000||rows.filter(r=>r.page===5).reduce((n,r)=>n+r.total,0)!==272872)throw Error('Printed itemized subtotals differ');
 return rows;
}
function nameVariants(s){const values=[norm(s)];const x=String(s).split(',');if(x.length===2&&x.every(x=>x.trim()))values.push(norm(x[1]+' '+x[0]));return values;}
const purposeKey=s=>norm(String(s||'').replace(/\\r\\n/g,' '));
function amountColumnsAgree(source,row){
 const present=k=>row[k]!==undefined&&row[k]!==null&&row[k]!==''&&Number.isFinite(Number(row[k]));
 if(!present('amount')||!present('unpaidAmount')&&!present('totalAmount'))return false;
 const paid=money(row.amount),unpaid=present('unpaidAmount')?money(row.unpaidAmount):money(row.totalAmount)-paid;
 const total=present('totalAmount')?money(row.totalAmount):paid+unpaid;
 return unpaid>=0&&total===paid+unpaid&&source.unpaid===unpaid&&source.total===total;
}

export function financeMatches(source,row){
 const contrib=row.subtype==='candidate_contribution_record';
 if(!contrib&&row.subtype!=='candidate_expenditure_record')return [];
 if(contrib&&norm(row.receiptType)!=='contribution'||!contrib&&norm(row.expenditureType)!=='campaign expenditure')return [];
 const candidates=source.filter(s=>(contrib?s.schedule!=='CE':s.schedule==='CE')&&s.date===row.transactionDate&&s.cents===money(row.amount)&&
  nameVariants(s.party).some(n=>nameVariants(contrib?row.contributor:row.vendorName).includes(n))&&
  (s.registration?String(row.contributorRegistrationNumber||'')===s.registration:!contrib||row.contributorType==='Individual')&&
  s.inKind===0&&(contrib||amountColumnsAgree(s,row)&&purposeKey(s.purpose)===purposeKey(row.purpose)));
 return candidates;
}
/** Fixed aggregate diagnostics: no names, amounts, row keys or raw type strings. */
export function financeFieldAccounting(source,rows){
 const out={dateAndPaidAmount:0,fullCounterparty:0,unpaidAndTotal:0,fullPurpose:0,recognizedType:0,caseOrSpacingOnlyTypeDifference:0,
  missingCounterparty:0,missingPurpose:0,missingType:0,missingUnpaid:0,missingTotal:0,knownTypeVocabulary:{generalExpenditure:0,campaignExpenditure:0,nonCampaignDisbursement:0,otherOrUnrecognized:0}};
 for(const r of rows){
  const contrib=r.subtype==='candidate_contribution_record',name=contrib?r.contributor:r.vendorName;
  const base=source.filter(s=>(contrib?s.schedule!=='CE':s.schedule==='CE')&&s.date===r.transactionDate&&s.cents===money(r.amount));
  if(base.length)out.dateAndPaidAmount++;
  const named=base.filter(s=>nameVariants(s.party).some(n=>nameVariants(name).includes(n)));if(named.length)out.fullCounterparty++;
  if(!name)out.missingCounterparty++;
  const type=norm(contrib?r.receiptType:r.expenditureType),recognized=contrib?type==='contribution':type==='campaign expenditure';
  if(recognized)out.recognizedType++;
  if(recognized&&(contrib?r.receiptType!=='Contribution':r.expenditureType!=='Campaign expenditure'))out.caseOrSpacingOnlyTypeDifference++;
  if(!type)out.missingType++;
  if(contrib)continue;
  const vocabulary=type==='general expenditure'?'generalExpenditure':type==='campaign expenditure'?'campaignExpenditure':/^(?:noncampaign|non campaign) disbursements?$/.test(type)?'nonCampaignDisbursement':'otherOrUnrecognized';out.knownTypeVocabulary[vocabulary]++;
  if(r.unpaidAmount===undefined||r.unpaidAmount===null)out.missingUnpaid++;
  if(r.totalAmount===undefined||r.totalAmount===null)out.missingTotal++;
  if(!r.purpose)out.missingPurpose++;
  if(named.some(s=>amountColumnsAgree(s,r)))out.unpaidAndTotal++;
  if(named.some(s=>purposeKey(s.purpose)===purposeKey(r.purpose)))out.fullPurpose++;
 }
 return out;
}
export function compareFinance(source,copies,links){
 const unique=new Map(),conflicts=new Set();
 const fields=['subtype','transactionDate','amount','filerRegistrationNumber','year','contributor','contributorRegistrationNumber','contributorType','receiptType','employer','vendorName','purpose','expenditureType','unpaidAmount','totalAmount','affectedCommitteeName','affectedCommitteeRegistrationNumber'];
 const canonical=m=>JSON.stringify(fields.map(k=>m[k]??null));
 for(const r of copies){const k=r.metadata.rowKey;if(!/^[a-f0-9]{64}$/.test(k||''))throw Error('Canonical finance identity missing');
  const old=unique.get(k);if(old&&canonical(old)!==canonical(r.metadata))conflicts.add(k);else unique.set(k,r.metadata);}
 return ['candidate_contribution_record','candidate_expenditure_record'].map(subtype=>{
  const group=[...unique].filter(([,m])=>m.subtype===subtype),seen=new Set(),matchesByKey=new Map(group.map(([k,m])=>[k,financeMatches(source,m)])),reverse=new Map();
  for(const matches of matchesByKey.values())for(const m of matches)reverse.set(m,(reverse.get(m)||0)+1);
  let exact=0,ambiguous=0,unmatched=0,legacyExactLinks=0,legacyExactLinksNotRecertified=0,matchedIndividualCanonical=0,matchedCommitteeFundCanonical=0;
  for(const [key] of group){const matches=matchesByKey.get(key),certified=matches.length===1&&reverse.get(matches[0])===1&&!conflicts.has(key);if(certified){exact++;seen.add(source.indexOf(matches[0]));if(matches[0].schedule==='IND')matchedIndividualCanonical++;if(matches[0].schedule==='PCF')matchedCommitteeFundCanonical++;}else if(matches.length)ambiguous++;else unmatched++;
   const old=links.filter(l=>l.canonical_row_key===key&&l.match_status==='exact');legacyExactLinks+=old.length;if(old.length&&!certified)legacyExactLinksNotRecertified+=old.length;
  }
  return {family:subtype,fieldAccounting:financeFieldAccounting(source,group.map(([,m])=>m)),storedEvidenceCopies:copies.filter(r=>r.metadata.subtype===subtype).length,canonicalTransactions:group.length,conflictingCopyMetadata:group.filter(([k])=>conflicts.has(k)).length,
   exactPrintedRowMatches:exact,ambiguousPrintedRowMatches:ambiguous,notMatchedToThisExactVersion:unmatched,uniquePrintedRowsMatched:seen.size,
   printedItemizedRows:source.filter(s=>subtype==='candidate_contribution_record'?s.schedule!=='CE':s.schedule==='CE').length,
   storedExactLinkRecords:legacyExactLinks,storedExactLinksNotRecertified:legacyExactLinksNotRecertified,
   legacyEligibleCopies:copies.filter(r=>r.metadata.subtype===subtype&&r.metadata.asOfEligible===true).length,
   matchedIndividualCanonical,matchedCommitteeFundCanonical};
 });
}
export function compareMedia(source,rows,roster=[]){
 const identities=new Set(roster.filter(p=>full(p.name)===full('Jeremy R. Miller')).map(p=>p.legislator_id));
 const person=identities.size===1?[...identities][0]:null;
 return MEDIA_FRAGMENTS.map((literal,index)=>{
  const candidates=rows.filter(r=>r.excerpt&&r.excerpt.includes(literal));
  const sourceMatched=candidates.filter(r=>source.pins.some(p=>p.sha256===r.source_sha));
  const exact=sourceMatched.filter(r=>{
   const pin=source.pins.find(p=>p.sha256===r.source_sha),m=r.metadata||{},sm=r.source_metadata||{};
   const clock=m.archiveCapturedAt||sm.archiveCapturedAt;
   const url=sm.originalUrl||m.originalUrl||r.source_url;
   return person&&r.person_id===person&&r.kind==='direct_statement'&&clock&&Date.parse(clock)===Date.parse(pin.utc)&&
    (url===pin.sourceUrl||r.source_url?.endsWith('id_/'+pin.sourceUrl))&&
    r.starts_on&&r.ends_on&&r.starts_on<=pin.utc.slice(0,10)&&r.ends_on>=pin.utc.slice(0,10)&&
    m.modelWeight===0&&m.mechanicallyActionable===false&&m.sameDayEligible===false;
  });
  return {fragment:index+1,literalSha256:sha(literal),sourceVersionsWithExplicitPrintedAttribution:source.verifiedVersions,
   earliestAuthenticatedObservation:source.pins[0].utc,stableHistoricalPersonUniquelyResolved:!!person,
   storedLiteralContainingCopies:candidates.length,storedExactSourceLiteralCopies:sourceMatched.length,
   verifiedStoredDirectStatementCopies:exact.length,contextCopiesContainingLiteral:candidates.filter(r=>r.kind==='context').length,
   sameLiteralDuplicateCopies:Math.max(0,exact.length-1),disposition:exact.length?'stored_literal_person_source_clock_and_nonserving_flags_verified':'literal_available_not_verified_as_stored_attributable_statement'};
 });
}
export function assertSafeThreeReceipt(receipt){
 const s=JSON.stringify(receipt);
 if(s.length>45000||/postgres(?:ql)?:\/\/|"(?:password|normalized_member_name|membership_id|rowKey|canonical_row_key|contributor|vendorName|excerpt|source_member_name|person_name|person_id|legislator_id)"\s*:/i.test(s))throw Error('Private row/credential output rejected');
 return receipt;
}
