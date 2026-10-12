/**
 * #864: research-only, fail-closed first-party named-quote lead audit.
 * Rebuild person/year/issue search-status matrix from a separately SOURCE-
 * AUDITED 95-person coverage artifact, not from candidate campaign names.
 * Sources in this manifest have NOT passed original Wayback/CDX proof.
 * There is no production collector, DB, scoring or label import here.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ISSUES = Object.freeze([
  'education_childcare','healthcare','housing','taxes_budget','reproductive_rights',
  'public_safety_justice','elections_government','climate_environment_energy',
  'agriculture_rural','jobs_labor_economy','transport_infrastructure',
  'judiciary_civil_law','civil_rights_equity','commerce_consumer','state_government'
]);
const STANCES = new Set(['supports','opposes','qualified_support','unknown']);
const isDay = s => typeof s === 'string' && /^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s) &&
  !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
const norm = s => String(s).normalize('NFKC').replace(/\s+/g, ' ').trim();
const bill = s => /^(?:SF|HF)[1-9][0-9]{0,4}$/.test(s);

export function verifyCurrentLeadManifest(manifest) {
  assert.equal(manifest.schema, 'senate-864-current-firstparty-speaker-leads-v1');
  assert.equal(manifest.issue, 864);
  assert.equal(manifest.historicalOriginalBodiesIndependentlyAuthenticatedInThisRound, 0);
  assert.ok(Array.isArray(manifest.leads) && manifest.leads.length > 0);
  const ids = new Set(), repeated = new Map();
  for (const q of manifest.leads) {
    assert.match(q.id, /^lead-202[1-5]-[a-z0-9-]+$/);
    assert.ok(!ids.has(q.id), 'Duplicate research id: ' + q.id); ids.add(q.id);
    assert.ok(typeof q.officialSenatorName === 'string' && q.officialSenatorName.trim().length > 4);
    assert.ok(ISSUES.includes(q.issue), 'Unknown issue: ' + q.id);
    assert.ok(isDay(q.publisherDisplayedDay));
    assert.ok(q.publisherDisplayedDay.startsWith(q.id.slice(5,9)), 'Source/date mismatch: ' + q.id);
    const url = new URL(q.originalPublisherUrl);
    assert.equal(url.protocol, 'https:', 'Publisher must be HTTPS');
    assert.ok(['senatedfl.mn','www.mnsenaterepublicans.com'].includes(url.hostname), 'Expected original caucus publisher');
    assert.equal(url.search, '', 'No tracking/synthetic URL');
    assert.ok(STANCES.has(q.researchPositionClassification));
    assert.ok(['individually_named_written_quote','same_named_quote_another_bill_context'].includes(q.attribution));
    assert.ok(Array.isArray(q.bills) && q.bills.every(bill));
    assert.ok(typeof q.shortPolicyMeaning === 'string' && q.shortPolicyMeaning.length >= 15);
    assert.ok(typeof q.underlyingStatementId === 'string' && q.underlyingStatementId.length > 7);
    assert.equal(q.historicalOriginalAuthentication, 'UNKNOWN_NOT_INDEPENDENTLY_ARCHIVED');
    assert.equal(q.historicalPublicByUtc, null);
    assert.equal(q.historicalOriginalRawSha256, null);
    assert.equal(q.historicalCdxIndexedSha1Base32, null);
    assert.equal(q.automaticallyHistoricallyEligible, false);
    assert.equal(q.productionChangeAuthorized, false);
    assert.equal(q.fullOriginalBodyVerbatimApproved, false);
    if (q.attribution === 'individually_named_written_quote') {
      assert.ok(typeof q.exactCurrentlyVisibleShortQuote === 'string' && norm(q.exactCurrentlyVisibleShortQuote).length >= 20);
      assert.ok(q.exactCurrentlyVisibleShortQuote.length <= 240, 'No complete copyrighted body/full quote');
    } else assert.equal(q.exactCurrentlyVisibleShortQuote, null);
    if (q.legislativeDecisionDay) {
      assert.ok(isDay(q.legislativeDecisionDay));
      assert.equal(q.retrospectiveRelativeToThatDecision, q.legislativeDecisionDay <= q.publisherDisplayedDay,
        'Never promote post-vote statements as earlier predictions');
    } else assert.equal(q.retrospectiveRelativeToThatDecision, null);
    const first = repeated.get(q.underlyingStatementId);
    if (first) {
      assert.equal(q.attribution, 'same_named_quote_another_bill_context');
      assert.equal(q.originalPublisherUrl, first.originalPublisherUrl);
      assert.equal(q.officialSenatorName, first.officialSenatorName);
      assert.equal(q.exactCurrentlyVisibleShortQuote, null);
    } else repeated.set(q.underlyingStatementId, q);
  }
  return { researchLeadRows:manifest.leads.length, distinctUnderlyingStatements:repeated.size,
    historicalOriginalsNewlyAuthenticated:0, predictionUsableRows:0 };
}

export function buildConservativeSenatorYearIssueMatrix(coverage, manifest) {
  const totals = verifyCurrentLeadManifest(manifest);
  assert.equal(coverage.summary.actualServingSenators,95);
  assert.equal(coverage.summary.peopleWithAnyAuthenticatedOriginalSiteExcerpt,92);
  assert.equal(coverage.summary.combinedSelectedOriginalCandidateOwnedSiteResearchExcerpts,1285);
  assert.equal(coverage.byActuallyServedSenator.length,95);
  assert.equal(coverage.summary.governmentDirectorySha256,
    'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
  const names = new Map(coverage.byActuallyServedSenator.map(r => [r.officialName,r]));
  assert.equal(names.size,95,'Duplicate official senator');
  const selected = coverage.byActuallyServedSenator.reduce((t,r) => t + r.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound,0);
  assert.equal(selected,1285,'Original selected-site counts lost/double counted');
  const attached = new Map();
  for (const q of manifest.leads) {
    const r = names.get(q.officialSenatorName);
    assert.ok(r,'Research lead not an actual official serving senator: ' + q.officialSenatorName);
    const y = Number(q.publisherDisplayedDay.slice(0,4));
    assert.ok(r.yearsActuallyServed.includes(y), 'Do not project previous office or post-service remarks: ' + q.id);
    const k = [r.officialName,y,q.issue].join('|');
    attached.set(k,[...(attached.get(k)||[]),q.id]);
  }
  const result = [...names.values()].sort((a,b) => a.officialName.localeCompare(b.officialName)).map(r => ({
    officialName:r.officialName,
    actualSenateServiceYears:r.yearsActuallyServed,
    selectedHistoricCampaignOwnedShortExcerptCount:r.selectedCandidateOwnedOriginalSiteExcerptsThroughCurrentRound,
    campaignIssueTagsPersonLevelOnly:r.broaderIssueAreasThroughCurrentRound,
    missingCampaignExcerptDoesNotMeanNoPolicy:true,
    namedHearingSpeechCorpusNotSystematicallyAudited:true,
    directInterviewCorpusNotSystematicallyAudited:true,
    serviceYears:r.yearsActuallyServed.map(year => ({year,
      issueCells:Object.fromEntries(ISSUES.map(issue => {
        const ids = attached.get([r.officialName,year,issue].join('|'))||[];
        return [issue,{status:ids.length ? 'dated_first_party_named_quote_lead_ARCHIVE_UNKNOWN' : 'not_systematically_searched_in_this_increment',
          leadIds:ids,anyAuthenticHistoricalPublicByProvenInThisIncrement:false,
          noEvidenceFoundNeverInferred:true}];
      }))
    }))
  }));
  return {schema:'senate-864-95-serving-person-year-issue-current-firstparty-lead-matrix-v1',
    sourceOriginal95RosterSha256:coverage.summary.governmentDirectorySha256,
    importantLimitation:'This is only a 2026-discovered FIRST-PARTY PAGE LEAD audit, not full direct-speaker media corpus or historic evidence completeness.',
    totals:{...totals,actualServedSenators:95,siteCoveredSenators:92,siteExcerptsSelected:1285,
      serviceYearIssueCells:result.reduce((t,r)=>t+r.serviceYears.length*ISSUES.length,0)},
    byActuallyServedSenator:result};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);
  const option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
  const manifest=JSON.parse(readFileSync(resolve(option('--leads-json')||'data/evaluation/senate-864-substantive-firstparty-current-original-leads-v1.json'),'utf8'));
  const cov=option('--coverage-json');
  const data=cov?buildConservativeSenatorYearIssueMatrix(JSON.parse(readFileSync(resolve(cov),'utf8')),manifest):verifyCurrentLeadManifest(manifest);
  const out=option('--out');
  if (out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(resolve(out),JSON.stringify(data,null,2)+'\n');}
  process.stdout.write(JSON.stringify(cov?data.totals:data)+'\n');
}
