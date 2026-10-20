/** Fixed #864 production plan. Private rows never leave runner memory. */
import {sha,compact,fixture,validateOriginalQuestions,financeMatches,compareFinance,MEDIA_FRAGMENTS} from './senate-864-three-bounded-evidence.mjs';
import {senateCommitteeHearingTiming} from './senate-committee-meeting-timing.ts';
export const VERSION='senate864-three-bounded-production-v1';
export const MARKER='SENATE864_THREE_BOUNDED_PRODUCTION_V1';
export const METHOD='miller16891-2024-printed-layout-full-comparators-v1';
export const REPORT='16891:24:pcc:YE:0:0';
const legacy=[
 ['5772f2b7bb52972da1bfabf723214d6af06466188317819cc894f3c90d14287b',null,'9197afcd18cc0a1956b242c4ab481a796ee3079a30eed098bfcdaf8bf66c912d'],
 ['94c1010b2b7c951950db60448eba224ccb43f77142b1a95868c340e40654ed04',null],
 ['2041f807c0325174bcb6c4d0b408fdb8c4189f06531a076b6c71666d8bd102e5',...Array(9).fill(null)],
 ['8db0812c8452a169e2e888d42285fa168fb0bc6399e550bf360fd0cbf4435b0c','46269b51679a836d8aea0917af5b57a9ca67a362b988f63d0bf22f81e2478980','d9d8af66fcb02e8316e0959f3ec4c6d9d8c9cb9a9a602601ecb7836a14ccb9b7',null]
];
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const full=s=>norm(s).split(' ').filter(x=>x.length>1).join(' ');
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function one(rows,label){if(rows.length!==1)throw Error(label);return rows[0];}
export const state=s=>sha(JSON.stringify(s));
export function committeeMeta(d,m){return {committeeVote:true,committeeName:d.committeeName,individualVotesAvailable:true,finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,...senateCommitteeHearingTiming(d.meetingDate).metadata,issue864ProductionRepair:VERSION,originalPdfSha256:d.originalRawPdfSha256,sourceQuestion:m.question,originalPage:String(m.page)};}
export function committeePlan(proof,s){
 if(!exact(proof.documents.map(({sourceText,...d})=>d),fixture().documents))throw Error('Reviewed fixture changed');
 const add=[],update=[],verified=[],matched=new Set();
 for(const [di,d] of proof.documents.entries()){
  validateOriginalQuestions(d,d.sourceText);
  const doc=one(s.docs.filter(x=>x.source_url===d.sourceUrl||x.content_sha256===d.originalRawPdfSha256),'Source document identity');
  if(doc.source_url!==d.sourceUrl||doc.content_sha256!==d.originalRawPdfSha256||doc.meeting_date!==d.meetingDate||doc.committee_name!==d.committeeName)throw Error('Original document source/day mismatch');
  const session=d.year===2024?'2023-2024':'2025-2026';
  const events=s.events.filter(e=>e.source_document_id===doc.id);
  for(const [mi,m] of d.motions.entries()){
   const bill=m.question.match(/^SF\d+/)?.[0],kind=m.question.includes('recommendation')?'motion':'amendment';
   const ref=kind==='motion'?null:m.question.slice(bill.length+1);
   const context=one(s.bills.filter(b=>b.identifier===bill&&b.session_slug===session),'Exact historical bill');
   if(context.session_id!==doc.session_id||context.chamber_id!==doc.chamber_id)throw Error('Bill/source session mismatch');
   const votes=m.choices.map(v=>{
    const header=one(d.people.filter(p=>norm(p).endsWith(norm(v.token))),'Full printed header');
    const names=[full(header),...(header==='Ron Latz'?[full('Ronald Steven Latz')]:[])];
    const person=one(s.roster.filter(p=>p.session_slug===session&&p.starts_on&&p.ends_on&&p.starts_on<=d.meetingDate&&p.ends_on>=d.meetingDate&&[p.name,p.normalized_name,...p.aliases].some(n=>names.includes(full(n)))),'Historical full name/session');
    return {membershipId:person.membership_id,sourceName:v.token,normalizedName:norm(v.token),choice:v.choice};
   });
   if(new Set(votes.map(v=>v.membershipId)).size!==votes.length)throw Error('Nonunique printed people');
   const key='senate-committee-source-v1:'+sha(JSON.stringify([d.originalRawPdfSha256,d.meetingDate,bill,m.question]));
   const candidate=events.filter(e=>legacy[di][mi]?sha(e.motion_text)===legacy[di][mi]||e.metadata?.issue864ProductionRepair===VERSION&&e.metadata?.sourceQuestion===m.question:e.external_key===key);
   const p={d,m,key,kind,ref,votes,context,sourceId:doc.id,meta:committeeMeta(d,m)};
   if(!candidate.length){if(legacy[di][mi])throw Error('Previously verified event absent');add.push(p);continue;}
   const e=one(candidate,'Parliamentary identity conflict');
   if(matched.has(e.id))throw Error('One stored event cannot be two questions');matched.add(e.id);
   const tally=m.literal.match(/\d+\/\d+ \(Ayes[\s\S]*$/)[0],anchor=compact(m.literal.slice(0,m.literal.indexOf(tally))).trim();
   if(e.occurred_on!==d.meetingDate||e.session_id!==context.session_id||e.chamber_id!==context.chamber_id||e.bill_identifier&&e.bill_identifier!==bill||e.yea_count!==m.yea||e.nay_count!==m.nay||e.is_passage!==false||e.metadata.committeeVote!==true||!compact(e.motion_text).includes(anchor))throw Error('Existing question/source/tally changed');
   const actual=s.choices.filter(v=>v.vote_event_id===e.id);
   if(actual.length!==votes.length||votes.some(v=>actual.filter(a=>a.membership_id===v.membershipId&&a.choice===v.choice).length!==1))throw Error('Existing explicit choices changed');
   const corrected=e.metadata?.issue864ProductionRepair===VERSION;
   if(corrected){
    if(e.bill_id!==context.id||e.vote_kind!==kind||e.amendment_ref!==ref||e.motion_text!==m.literal||e.passed!==m.passed||Object.entries(p.meta).some(([k,v])=>!exact(e.metadata[k],v)))throw Error('Corrected event fields/flags mismatch');
    if(!legacy[di][mi]&&votes.some((v,i)=>actual.filter(a=>a.membership_id===v.membershipId&&a.source_member_name===v.sourceName&&a.normalized_member_name===v.normalizedName&&a.source_ordinal===i&&Object.entries(p.meta).every(([k,x])=>exact(a.metadata[k],x))).length!==1))throw Error('New choice literal/flags mismatch');
    verified.push(p);
   }else{if(!legacy[di][mi])throw Error('Unreviewed anchored key collision');update.push({...p,existing:e});}
  }
  if(events.some(e=>!matched.has(e.id)))throw Error('Unexpected original event');
 }
 if(![0,12].includes(add.length)||![0,7].includes(update.length))throw Error('Partial original state');
 return {add,update,verified};
}
export function mediaPlan(proof,s){
 const pin=proof.media.pins[0];
 if(proof.media.verifiedVersions!==2||pin.utc!=='2022-10-05T01:59:37Z'||pin.sha256!=='28dada90321263cbf20a75cc9949c176527a97c2d89d33c0831ed63469167f36')throw Error('Media proof clock/body');
 const people=s.roster.filter(p=>full(p.name)===full('Jeremy R. Miller'));
 if(new Set(people.map(p=>p.legislator_id)).size!==1)throw Error('Stable Miller person');
 const person=one(people.filter(p=>p.session_slug==='2021-2022'&&p.starts_on&&p.ends_on&&p.starts_on<=pin.utc.slice(0,10)&&p.ends_on>=pin.utc.slice(0,10)),'Miller observation membership');
 const sourceUrl='https://web.archive.org/web/'+pin.utc.replace(/[-:TZ]/g,'')+'id_/'+pin.sourceUrl;
 const meta={issue864ProductionRepair:VERSION,seedId:'2021-miller-enterprise-manufacturing-qa',originalUrl:pin.sourceUrl,archiveUrl:sourceUrl,archiveCapturedAt:pin.utc,originalCdxSha1Base32:pin.sha1,originalBodySha256:pin.sha256,publisherDisplayedDay:'2021-11-08',publisherDisplayedDayAuthenticated:false,modelWeight:0,mechanicallyActionable:false,sameDayEligible:false,asOfEligible:false,researchOnly:true,attribution:'explicit_printed_Miller_paragraph',historicalFirstPublicationProven:false};
 const rows=MEDIA_FRAGMENTS.map(literal=>({literal,key:sha(JSON.stringify([VERSION,person.legislator_id,pin.sourceUrl,pin.utc,literal])),person,pin,sourceUrl,meta}));
 for(const p of rows){
  const found=s.media.filter(r=>r.excerpt?.includes(p.literal));
  if(found.length>1)throw Error('Media duplicate literal');
  if(found.length){const r=found[0];if(r.excerpt!==p.literal||r.person_id!==person.legislator_id||r.membership_id!==person.membership_id||r.source_url!==sourceUrl||r.source_sha!==pin.sha256||r.kind!=='direct_statement'||r.bill_id!==null||r.stance!=='neutral'||r.source_quality!=='reputable_secondary'||r.relevance!=='low'||r.freshness!=='stale'||r.extraction_method!==VERSION||r.extraction_version!==VERSION||r.claim!=='Attributable printed interview fragment; no vote stance inferred.'||new Date(r.published_at).toISOString()!==new Date(pin.utc).toISOString()||r.metadata.ingestionIdentityKey!==p.key||Object.entries(meta).some(([k,v])=>!exact(r.metadata[k],v))||Object.entries(meta).some(([k,v])=>!exact(r.source_metadata[k],v)))throw Error('Media stored literal/person/provenance/flags conflict');p.stored=true;}
 }
 const duplicates=s.media.filter(r=>r.kind&&!rows.some(p=>r.excerpt===p.literal));
 if(duplicates.length)throw Error('Unexpected existing selected media evidence');
 return rows;
}
export function financePlan(proof,s){
 const v=one(s.versions,'Exact recipient/year version'),b=one(s.capture,'Original body capture');
 if(v.report_version_id!==REPORT||v.full_original_pdf_sha256!==proof.finance.report.sha||v.full_original_pdf_bytes!==proof.finance.report.bytes||b.actual_sha!==proof.finance.report.sha||b.byte_length!==proof.finance.report.bytes||b.page_count!==6||b.stored_pages!==6)throw Error('Report/capture identity');
 const counts=compareFinance(proof.finance.rows,s.finance,s.links);
 if(!exact(counts.map(c=>[c.storedEvidenceCopies,c.canonicalTransactions,c.conflictingCopyMetadata,c.exactPrintedRowMatches,c.ambiguousPrintedRowMatches,c.notMatchedToThisExactVersion]),[[18,18,0,18,0,0],[10,10,0,7,0,3]]))throw Error('Finance comparator scope drift');
 const plans=[];
 for(const r of s.finance){
  const matches=financeMatches(proof.finance.rows,r.metadata);if(!matches.length)continue;
  const row=one(matches,'Finance row ambiguous');
  if(!Number.isInteger(row.line)||row.line<1||!row.rawBlock||!row.rawBlock.includes(row.party)||!row.rawBlock.includes(row.date.slice(5).replace('-','/')+'/2024'))throw Error('Exact printed block provenance');
  const family=r.metadata.subtype==='candidate_contribution_record'?'candidate_contribution':'candidate_expenditure';
  const entry=s.entries.filter(e=>e.page_number===row.page&&e.line_number===row.line);
  if(entry.length){const e=one(entry,'Printed entry collision');if(e.entry_extractor_version!==METHOD||e.raw_schedule_line!==row.rawBlock||e.printed_transaction_date!==row.date||Number(e.printed_amount_cents)!==row.cents||e.printed_counterparty!==row.party||e.schedule_family!==family)throw Error('Existing entry incompatible with fixed layout coordinates');}
  const existing=s.links.filter(l=>l.canonical_row_key===r.metadata.rowKey);
  if(existing.length){const l=one(existing,'Finance link duplication');if(l.family!==family||l.match_status!=='exact'||l.possible_entry_count!==1||l.matching_method!==METHOD||!entry.length||l.entry_id!==entry[0].id)throw Error('Finance link source conflict');}
  plans.push({key:r.metadata.rowKey,row,family,entry:entry[0],stored:existing.length===1});
 }
 if(plans.length!==25||s.links.length!==plans.filter(p=>p.stored).length||new Set(plans.map(p=>p.row)).size!==25||s.entries.some(e=>e.entry_extractor_version===METHOD&&!plans.some(p=>p.entry?.id===e.id)))throw Error('Finance one-to-one/hold boundary');
 return plans;
}
export function productionPlan(proof,s){return {committee:committeePlan(proof,s),media:mediaPlan(proof,s),finance:financePlan(proof,s)};}
