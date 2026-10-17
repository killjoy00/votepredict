import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {
 CFB_PAC_CONTRIBUTION_PROVENANCE_VERSION,
 independentlyRehashCfbPdf,scoreCfbPacContributionProvenance
} from '../src/evidence/cfb-pac-contribution-provenance-v1.mjs';
import {assertPac116FinanceReadOnlyGuard}
 from '../scripts/audit-cfb-pac-116-contribution-provenance-readonly.mjs';

const raw=Buffer.from('%PDF-'+'A'.repeat(800));
const pdfSha=createHash('sha256').update(raw).digest('hex');
const rowKey='a'.repeat(64);
const pacDecisions=[
 {registration:'70001',status:'current_dual_original_source_attested',
  observedByOn:'2026-10-17',retrospectivelyUsable:false},
 {registration:'30558',status:'current_dual_original_source_attested',
  observedByOn:'2026-10-17',retrospectivelyUsable:false},
 {registration:'30025',status:'held_no_explicit_first_party_pac_proof'}
];
const row=(over={})=>({
 row_key:rowKey,filer_reg:'18888',year:'2024',
 contributor_reg:'70001',transaction_date:'2024-04-10',
 amount:'350.00',contributor:'Leadership Fund PAC',
 member_id:'synthetic-member',source_sha:'b'.repeat(64),
 availability_proof:'filing_plus_one',
 source_fetched_at:new Date('2026-10-17T04:00:00Z'),
 stored_published_on:'2024-07-15',as_of_eligible:'true',
 ...over
});
const report=(over={})=>({
 report_version_id:'18888:24:pcc:PP:0:0',
 committee_registration:'18888',report_year:2024,
 full_original_pdf_sha256:pdfSha,captured_pdf_sha:pdfSha,
 report_due_on:'2024-07-29',
 statutory_release_floor_on:'2024-07-30',
 website_observed_on:'2026-10-17',
 historical_exact_version_public_by_proven:false,...over
});
const link=(over={})=>({
 report_version_id:report().report_version_id,
 family:'candidate_contribution',committee_registration:'18888',
 transaction_year:2024,canonical_row_key:rowKey,
 match_status:'exact',possible_entry_count:1,
 entry_id:'10',matched_entry_id:'10',
 entry_schedule_family:'candidate_contribution',
 entry_date:'2024-04-10',entry_cents:'35000',
 entry_line:'04/10/2024 Leadership Fund PAC 350.00',...over
});
const archive=(over={})=>({
 family:'candidate_contribution',committee_registration:'18888',
 transaction_year:2024,canonical_row_key:rowKey,source_sha256:'b'.repeat(64),
 independently_observed_at:'2026-10-17T04:00:00Z',
 proof_kind:'independent_archive_capture_exact_row',...over
});
const score=(over={})=>scoreCfbPacContributionProvenance({
 canonicalRows:[row()],reportVersions:[report()],reportLinks:[link()],
 archiveRows:[archive()],attestationStatuses:pacDecisions,
 independentlyVerifiedPdfHashes:[pdfSha],...over
});

test('real PDF binary SHA is verified independently, not guessed from metadata',()=>{
 assert.equal(independentlyRehashCfbPdf(raw,pdfSha),true);
 assert.equal(independentlyRehashCfbPdf(raw,'0'.repeat(64)),false);
 assert.equal(independentlyRehashCfbPdf(Buffer.from('not a pdf'),pdfSha),false);
});
test('one exact present-day transaction-to-original PDF match NEVER proves pre-vote public-by',()=>{
 const s=score();
 assert.equal(s.schema,CFB_PAC_CONTRIBUTION_PROVENANCE_VERSION);
 assert.equal(s.canonicalTransactions,1);
 assert.equal(s.evidenceCopies,1);
 assert.equal(s.withCurrentOriginalPdfExactEntry,1);
 assert.equal(s.exactCurrentPdfVersionEntryPairs,1);
 assert.equal(s.withPdfExactAndVerifiedDueReleaseFloor,1);
 assert.equal(s.withIndependentBulkArchiveRowObservation,1);
 assert.equal(s.withArchiveRowObservedBy2025,0);
 assert.equal(s.withLegacyAsOfEligibleClaim,1);
 assert.equal(s.withLegacyClaimEarlierThanMatchedLegalFloor,1);
 assert.equal(s.withPdfExactAndIndependentHistoricalPublicBy,0);
 assert.equal(s.historicalStrictAsOfQualifiedRows,0);
 assert.equal(s.historicalFirstPublicVersionEvidenceConfirmed,false);
 assert.equal(s.sourceEvidenceOrForecastsChanged,false);
 assert.equal(s.servingOrModelWeightsChanged,false);
 assert.ok(!JSON.stringify(s).includes('18888'));
 assert.ok(!JSON.stringify(s).includes('Leadership Fund'));
 assert.ok(!JSON.stringify(s).includes(pdfSha));
 assert.ok(!JSON.stringify(s).includes(rowKey));
 assert.ok(!JSON.stringify(s).includes('350.00'));
});
test('exact requires row-specific date/amount/full printed name, matched PDF hash and entry',()=>{
 for(const changed of [
  {independentlyVerifiedPdfHashes:[]},
  {reportVersions:[report({captured_pdf_sha:'0'.repeat(64)})]},
  {reportLinks:[link({entry_cents:'30000'})]},
  {reportLinks:[link({entry_date:'2024-04-11'})]},
  {reportLinks:[link({entry_line:'04/10/2024 Different Organization 350.00'})]},
  {reportLinks:[link({matched_entry_id:'11'})]},
  {reportLinks:[link({possible_entry_count:2})]},
  {reportLinks:[link({entry_schedule_family:'candidate_expenditure'})]},
  {reportLinks:[link({match_status:'ambiguous',entry_id:null,matched_entry_id:null})]}
 ])assert.equal(score(changed).withCurrentOriginalPdfExactEntry,0);
});
test('due DATE plus next day is required, filing estimate is not independent publication proof',()=>{
 const s=score({reportVersions:[report({statutory_release_floor_on:'2024-07-29'})]});
 assert.equal(s.withCurrentOriginalPdfExactEntry,1);
 assert.equal(s.withPdfExactAndVerifiedDueReleaseFloor,0);
 assert.equal(s.withPdfExactButReleaseFloorUnverified,1);
 const missing=score({reportVersions:[report({report_due_on:null})]});
 assert.equal(missing.withPdfExactAndVerifiedDueReleaseFloor,0);
});
test('duplicate evidence copies counted once; disagreement held rather than transformed',()=>{
 const s=score({canonicalRows:[row(),row()]});
 assert.equal(s.canonicalTransactions,1);
 assert.equal(s.evidenceCopies,2);
 assert.equal(s.withCurrentOriginalPdfExactEntry,1);
 const c=score({canonicalRows:[row(),row({amount:'360.00'})]});
 assert.equal(c.canonicalTransactions,1);
 assert.equal(c.conflictingCopies,1);
 assert.equal(c.withCurrentOriginalPdfExactEntry,0);
});
test('report committee-year is a candidate only, not original transaction containment',()=>{
 const s=score({reportLinks:[]});
 assert.equal(s.withOneCandidateReportVersion,1);
 assert.equal(s.withCurrentOriginalPdfExactEntry,0);
 assert.equal(s.withNoStoredReportLink,1);
 assert.equal(s.historicalStrictAsOfQualifiedRows,0);
 const noPdf=score({reportVersions:[],reportLinks:[]});
 assert.equal(noPdf.withNoIndexedCandidateReport,1);
});
test('reject held PAC contribution and arbitrary unknown original affiliations',()=>{
 assert.throws(()=>score({canonicalRows:[row({contributor_reg:'30025'})]}),
  /Out-of-scope/);
 assert.throws(()=>score({attestationStatuses:[
  {...pacDecisions[0],status:'held_no_explicit_first_party_pac_proof'},
  ...pacDecisions.slice(1)
 ]}),/exactly two/);
 assert.throws(()=>score({attestationStatuses:[
  {...pacDecisions[0],observedByOn:'2021-10-10'},...pacDecisions.slice(1)
 ]}),/exactly two/);
 assert.throws(()=>score({archiveRows:[archive({proof_kind:'disclosure_estimate'})]}),
  /Unsafe independent/);
 assert.throws(()=>score({reportLinks:[link({family:'candidate_expenditure'})]}),
  /Unsafe report link/);
});
test('finance summary counts all 116 synthetic registered contribution rows, no raw details',()=>{
 const all=Array.from({length:116},(_,i)=>row({
  row_key:i.toString(16).padStart(64,'0'),
  year:String(2021+(i%5)),
  contributor_reg:i%2===0?'70001':'30558',
  transaction_date:String(2021+(i%5))+'-04-10'
 }));
 const s=score({canonicalRows:all,reportLinks:[],reportVersions:[],archiveRows:[]});
 assert.equal(s.canonicalTransactions,116);
 assert.equal(s.priorCohortSizeReproduced,true);
 assert.equal(s.withNoIndexedCandidateReport,116);
 assert.equal(Object.values(s.perYear).reduce((sum,y)=>sum+y.canonicalTransactions,0),116);
 assert.equal(s.historicalStrictAsOfQualifiedRows,0);
});
test('non-main, failed keyless preflight or missing marker cannot access Neon',()=>{
 const env={
  GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'c'.repeat(40),
  VOTEPREDICT_PAC_116_KEYLESS_PASSED:'true',
  VOTEPREDICT_PAC_116_COMMIT_MARKER:'true'
 };
 assert.doesNotThrow(()=>assertPac116FinanceReadOnlyGuard(env));
 for(const changes of [
  {GITHUB_REF:'refs/heads/other'},
  {GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_EVENT_NAME:'pull_request'},
  {VOTEPREDICT_PAC_116_KEYLESS_PASSED:'false'},
  {VOTEPREDICT_PAC_116_COMMIT_MARKER:'false'}
 ])assert.throws(()=>assertPac116FinanceReadOnlyGuard({...env,...changes}));
});
