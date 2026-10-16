import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import excerpts from '../../data/evaluation/senate-authenticated-campaign-issue-excerpt-leads-2024-25-v1.json' with {type:'json'};
import {
  originalCampaignVisibleText,historicalArchiveSha1Base32,
  recheckOriginalHistoricalExcerpt,auditHistoricalCampaignExcerptLeadManifest,
  type ExcerptLedger,
} from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const ledger=excerpts as unknown as ExcerptLedger;
test('real acquisition provenance corpus has exactly four candidate issue page versions and thirteen concise attributed excerpts',()=>{
  const report=auditHistoricalCampaignExcerptLeadManifest(ledger);
  assert.equal(report.totals.campaignCandidates,4);
  assert.equal(report.totals.expectedShortExcerptLeads,13);
  assert.equal(report.totals.originalHtmlFilesProvidedAndCrossChecked,0);
  assert.equal(report.totals.shortExcerptsReverifiedAgainstOriginalBytes,0);
  assert.equal(report.totals.recordsEligibleForForecastInThisAudit,0);
  assert.deepEqual(report.candidates.map(c=>c.candidateName),[
    'Ann Johnson Stewart','Keri Heintzeman','Louis McNutt','Michael Holmstrom Jr',
  ]);
  assert.equal(report.scope.noProductionDatabase,true);
  assert.equal(report.scope.noNetwork,true);
  assert.equal(report.scope.originalHistoricalSosWebsiteFieldVerified,false);
  assert.ok(report.candidates.every(c=>c.recoveredShortPositions.every(p=>
    p.sourceIsPreGeneralNotPrePrimary&&!p.forecastEligible
    &&p.originallyPublishedBeforeCapture===null
    &&!p.candidateMembershipJoinCompleted)));
});
test('the manifest never silently attributes opposing candidates or campaign years to historical senator',()=>{
  const wrong=structuredClone(ledger);
  wrong.candidates[3].candidateName='Louis McNutt';
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(wrong),/Missing or misattributed|Archived quote assigned to wrong candidate/);
  const district=structuredClone(ledger);
  district.candidates[1].district='67';
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(district),/Archived quote assigned to wrong candidate/);
  const run=structuredClone(ledger);
  run.provenance.originalArchiveArtifactZipSha256='0'.repeat(64);
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(run),/Unexpected source excerpt/);
  const vote=structuredClone(ledger);
  vote.candidates[0].officialSenatorMembershipOrVictoryVerifiedForEachExcerpt=true as false;
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(vote),/Missing or misattributed/);
});
test('source proof requires real exact capture time, no election-day backdating or statement first-post proof',()=>{
  const date=structuredClone(ledger);
  date.candidates[0].originalHtmlSource.sourceArchiveCaptureAt='2024-11-05T00:00:00.000Z';
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(date),/Unpinned/);
  const publicBy=structuredClone(ledger);
  publicBy.candidates[0].excerpts[0].attestedSnippetPublicByNoLaterThan='2024-01-01T00:00:00.000Z';
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(publicBy),/Ambiguous/);
  const planted=structuredClone(ledger);
  planted.candidates[1].excerpts[0].earlierOriginalPublicationTimeIndependentlyKnown=true as false;
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(planted),/Ambiguous/);
  const promoted=structuredClone(ledger);
  promoted.candidates[1].excerpts[0].immediatelyEligibleForForecast=true as false;
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(promoted),/Ambiguous/);
});
test('short quotes can be matched in visible archived HTML with numeric HTML entities while ignoring scripts',()=>{
  const html=Buffer.from('<!DOCTYPE html><html><head><script>window.x="invisible bad quote"</script></head>'
    +'<body><p>Defend workers&#8217; rights to organize unions.</p>'
    +'<p>Vigorously defend abortion care</p></body></html>');
  const text=originalCampaignVisibleText(html);
  assert.ok(text.includes('Defend workers’ rights'));
  assert.ok(text.includes('Vigorously defend abortion care'));
  assert.ok(!text.includes('invisible bad quote'));
  const valid=recheckOriginalHistoricalExcerpt({
    originalHtml:html,
    expectedOriginalHtmlSha256:createHash('sha256').update(html).digest('hex'),
    expectedHistoricalCdxPayloadDigestSha1Base32:historicalArchiveSha1Base32(html),
    shortExcerpt:'Defend workers’ rights',
  });
  assert.equal(valid.exactVisibleExcerptCrossChecked,true);
  assert.equal(valid.sourceHtmlBytesCrossChecked,true);
  assert.equal(valid.eligibleForImmediateProductionIngestion,false);
  assert.equal(valid.sourceHtmlBodyFirstPostedDateIndependentlyEstablished,false);
});
test('tampered archived page bytes or changed historical CDX digest are fatal, not a soft false positive',()=>{
  const html=Buffer.from('<html><main>Most importantly, I will champion school choice legislation.</main></html>');
  const input={
    originalHtml:html,
    expectedOriginalHtmlSha256:createHash('sha256').update(html).digest('hex'),
    expectedHistoricalCdxPayloadDigestSha1Base32:historicalArchiveSha1Base32(html),
    shortExcerpt:'champion school choice legislation',
  };
  assert.equal(recheckOriginalHistoricalExcerpt(input).exactVisibleExcerptCrossChecked,true);
  assert.throws(()=>recheckOriginalHistoricalExcerpt({...input,
    originalHtml:Buffer.from('<html><main>tampered content safely longer than 32 bytes</main></html>')}),/SHA-256 mismatch/);
  assert.throws(()=>recheckOriginalHistoricalExcerpt({...input,
    expectedHistoricalCdxPayloadDigestSha1Base32:'A'.repeat(32)}),/disagree/);
  assert.throws(()=>recheckOriginalHistoricalExcerpt({...input,
    shortExcerpt:'not actually on this archived page'}),/missing from visible page/);
  assert.throws(()=>recheckOriginalHistoricalExcerpt({...input,
    shortExcerpt:'invisible bad quote'}),/missing from visible page/);
});
test('source quote must not match only hidden JavaScript or fall outside the short excerpt policy',()=>{
  const html=Buffer.from('<html><script>unsupported policy from hidden javascript</script>'
    +'<p>Vigorously defend abortion care</p></html>');
  const input={originalHtml:html,
    expectedOriginalHtmlSha256:createHash('sha256').update(html).digest('hex'),
    expectedHistoricalCdxPayloadDigestSha1Base32:historicalArchiveSha1Base32(html),
    shortExcerpt:'unsupported policy from hidden javascript'};
  assert.throws(()=>recheckOriginalHistoricalExcerpt(input),/missing from visible page/);
  assert.throws(()=>recheckOriginalHistoricalExcerpt({...input,shortExcerpt:'a'}),/Missing\/oversized/);
});
test('candidate short quote family comes only from the known 15-family issue taxonomy',()=>{
  const bad=structuredClone(ledger);
  bad.candidates[0].excerpts[0].issueFamily='not_a_real_issue_family';
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(bad),/Ambiguous/);
  const repeated=structuredClone(ledger);
  repeated.candidates[1].excerpts[0].id=repeated.candidates[0].excerpts[0].id;
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(repeated),/Ambiguous/);
});
test('caller cannot supply fake 2026 HTML and claim it was archived under real 2024 CDX manifest',()=>{
  const fake=Buffer.from('<html><body>Vigorously defend abortion care</body></html>');
  const key=ledger.candidates[0].originalHtmlSource.sourceArchiveOriginalHtmlFileName;
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(ledger,{[key]:fake}),
    /Original historical campaign HTML SHA-256 mismatch/);
  assert.throws(()=>auditHistoricalCampaignExcerptLeadManifest(ledger,{'unapproved.html':fake}),
    /Unrecognized or unused original archive/);
});
test('CLI prints planned evidence sources without database access and refuses overwrites',()=>{
  const temp=mkdtempSync(join(tmpdir(),'campaign-excerpt-local-'));
  try{
    const out=join(temp,'plan.json');
    const args=['--import','tsx','scripts/audit-authenticated-senate-campaign-excerpts-offline.ts',
      '--output',out];
    execFileSync('node',args,{timeout:18000,stdio:'pipe'});
    const result=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(result.totals.expectedShortExcerptLeads,13);
    assert.equal(result.totals.shortExcerptsReverifiedAgainstOriginalBytes,0);
    assert.equal(result.scope.noProductionDatabase,true);
    assert.equal(result.scope.noNetwork,true);
    assert.equal(statSync(out).mode&0o777,0o600);
    assert.throws(()=>execFileSync('node',args,{timeout:18000,stdio:'pipe'}));
    const missing=join(temp,'missing'),output=join(temp,'missing-out.json');
    mkdirSync(missing);
    assert.throws(()=>execFileSync('node',[
      '--import','tsx','scripts/audit-authenticated-senate-campaign-excerpts-offline.ts',
      '--archive-dir',missing,'--output',output],{timeout:18000,stdio:'pipe'}));
  }finally{rmSync(temp,{recursive:true,force:true});}
});
