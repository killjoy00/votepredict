import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CFB_2025_SPECIAL_CALENDAR_RULES,
  CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256,
  auditCfb2025SpecialOriginalTarget,
  parseCfb2025SpecialOriginalPdfHeader,
  parsePinnedCfb2025SpecialOriginalTargets,
  verifyCfb2025SpecialCalendarCapture,
  type Cfb2025SpecialCalendarCapture,
  type Cfb2025SpecialOriginalTarget,
  type Cfb2025SpecialPdfCapture,
} from '../../src/evidence/cfb-2025-senate-special-original-pdf-proof.js';

const LEDGER = 'docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv';
function targets() {
  return parsePinnedCfb2025SpecialOriginalTargets(readFileSync(LEDGER, 'utf8'));
}
function usDate(value: string): string {
  const [year, month, day] = value.split('-');
  return Number(month) + '/' + Number(day) + '/' + year;
}
function englishDate(value: string): string {
  const date = new Date(value + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
}
function header(t: Cfb2025SpecialOriginalTarget): string {
  return 'Report of Receipts and Expenditures for Principal Campaign Committee\n'
    + 'Registration Number: ' + t.registrationNumber + '\n'
    + 'Office: Senate District: ' + t.district + '\n'
    + 'Period Covered: 1/1/2025 through ' + usDate(t.expectedPeriodEndOn) + '\n'
    + 'Received by the Board ' + englishDate(t.dueOn) + '\n'
    + 'Schedule 1 Contribution tables [not used or saved by this audit]';
}
function pdf(t: Cfb2025SpecialOriginalTarget): Cfb2025SpecialPdfCapture {
  return {
    sourceUrl: 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=25',
    pdfSha256: 'a'.repeat(64),
    bytes: 3500,
    fetchedAt: '2026-10-10T21:00:00.000Z',
    text: header(t),
  };
}
function calendar(t: Cfb2025SpecialOriginalTarget): Cfb2025SpecialCalendarCapture {
  const rule = CFB_2025_SPECIAL_CALENDAR_RULES[t.district];
  return {
    district: t.district, sourceUrl: rule.sourceUrl,
    pdfSha256: 'b'.repeat(64), bytes: 5000,
    fetchedAt: '2026-10-10T21:00:00.000Z',
    text: 'Senate District ' + t.district + ' Special Election Public Disclosure Calendar 2025\n'
      + 'Pre-special primary report of receipts and expenditures due (if there is a special primary). '
      + 'Period covered. ' + rule.expectedTextDueDates[0] + ', 2025.\n'
      + 'Pre-special election report of receipts and expenditures due. '
      + rule.expectedTextDueDates[1] + ', 2025.\n'
      + (t.district === 6 ? 'April 1 and April 15' : 'August 12 and October 21'),
  };
}

test('pinned 85-version ledger produces exactly twelve C/E original keys from seven filers and three districts', () => {
  const list = targets();
  assert.equal(list.length, 12);
  assert.equal(new Set(list.map(r=>r.reportId)).size, 12);
  assert.equal(new Set(list.map(r=>r.registrationNumber)).size, 7);
  assert.deepEqual([6,29,47].map(d=>list.filter(r=>r.district===d).length), [5,4,3]);
  assert.deepEqual([list.filter(r=>r.period==='C').length,
    list.filter(r=>r.period==='E').length], [7,5]);
  assert.ok(list.every(r=>r.year==='25'&&r.type==='pcc'&&r.se==='1'&&r.amendment===0));
  assert.deepEqual(list.filter(r=>r.registrationNumber==='19205').map(r=>r.reportId),[
    '19205:25:pcc:C:1:0', '19205:25:pcc:E:1:0',
  ]);
  assert.equal(CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[6],
    '828ba9376709c12bf530ce76eb552804a623772e95160a3ae51ce0648d508f8b');
  assert.equal(CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[29],
    'f1ab8c55e92a7956ee0f852fa6e2c875bce8743128f04693f94e67f83ee78c87');
  assert.equal(CFB_2025_SPECIAL_DISTRICT_ROSTER_SHA256[47],
    'bf0d50755c1fba7e8bc0ba87e8c21e0262c852dda4fe6ada507f47c3d67e2bf0');
});

test('source changes or extensions do not silently change the bounded acquisition', () => {
  const text = readFileSync(LEDGER,'utf8');
  assert.throws(()=>parsePinnedCfb2025SpecialOriginalTargets(text.replace('C1.0','C1.1')),
    /source-pinned 85-version ledger hash changed/);
  assert.throws(()=>parsePinnedCfb2025SpecialOriginalTargets(text.slice(0,-1)),
    /final newline/);
});

test('original PDF header authenticates independent committee, Senate district, coverage and receipt dates', () => {
  for (const t of targets()) {
    const parsed = parseCfb2025SpecialOriginalPdfHeader(t, header(t));
    assert.ok(parsed, t.reportId);
    assert.equal(parsed?.registrationNumber, t.registrationNumber);
    assert.equal(parsed?.district, t.district);
    assert.equal(parsed?.coverageEndOn, t.expectedPeriodEndOn);
    assert.equal(parsed?.receivedOn, t.dueOn);
    assert.equal(parsed?.periodMatchesIndependentCalendar, true);
  }
});

test('rejects plausible mismatched PDF headers rather than inferring identity from viewer parameters', () => {
  const t = targets()[0]!;
  const h = header(t);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    'Registration Number: '+t.registrationNumber,'Registration Number: 99999')),null);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    'Senate District: '+t.district,'Senate District: 29')),null);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    usDate(t.expectedPeriodEndOn),'4/2/2025')),null);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    'Report of Receipts and Expenditures','Generic Statement')),null);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    'Received by the Board','Received from a contributor')),null);
  assert.equal(parseCfb2025SpecialOriginalPdfHeader(t,h.replace(
    '1/1/2025','1/1/2024')),null);
});

test('checks the three independently issued district calendars and due-date markers', () => {
  const list=targets();
  for (const district of [6,29,47] as const) {
    const t=list.find(x=>x.district===district)!;
    assert.equal(verifyCfb2025SpecialCalendarCapture(calendar(t)).verified,true);
    const altered=calendar(t);
    altered.text=altered.text.replace('Senate District '+district,'Senate District 99');
    assert.equal(verifyCfb2025SpecialCalendarCapture(altered).verified,false);
    const wrong=calendar(t);
    wrong.pdfSha256='broken';
    assert.equal(verifyCfb2025SpecialCalendarCapture(wrong).verified,false);
    const noDue=calendar(t);
    noDue.text=noDue.text.replace(CFB_2025_SPECIAL_CALENDAR_RULES[district].expectedTextDueDates[0],'November 1');
    assert.equal(verifyCfb2025SpecialCalendarCapture(noDue).verified,false);
  }
});

test('only header+calendar matched PDF yields legal lower bound, never a historical public-by claim', () => {
  for (const t of targets()) {
    const result = auditCfb2025SpecialOriginalTarget(t,pdf(t),calendar(t));
    assert.equal(result.status,'pdf_header_period_and_calendar_verified');
    assert.equal(result.originalVersionPdfHeaderIdentityVerified,true);
    assert.equal(result.independentCalendarDueOn,t.dueOn);
    assert.ok(result.earliestLegalAndFilingBoundOn! > t.dueOn);
    assert.equal(result.historicalPublicByVerifiedOn,null);
    assert.equal(result.eligibleForHistoricalAsOf,false);
    assert.equal(result.independentAmendmentCheckboxVerified,false);
  }
  const t=targets()[0]!;
  const failed= auditCfb2025SpecialOriginalTarget(t,null,calendar(t),'CFB PDF HTTP 404');
  assert.equal(failed.status,'source_or_pdf_acquisition_failed');
  assert.equal(failed.sourcePdfSha256,null);
  assert.equal(failed.earliestLegalAndFilingBoundOn,null);
  const noCalendar = auditCfb2025SpecialOriginalTarget(t,pdf(t),null);
  assert.equal(noCalendar.status,'independent_calendar_unverified');
  assert.equal(noCalendar.earliestLegalAndFilingBoundOn,null);
  const noHeader=pdf(t);
  noHeader.text=noHeader.text.replace('Registration Number: '+t.registrationNumber,'Registration Number: 10000');
  assert.equal(auditCfb2025SpecialOriginalTarget(t,noHeader,calendar(t)).status,
    'original_pdf_header_or_period_mismatch');
});

test('late received-on report cannot claim the earlier statutory release floor',()=>{
  const t=targets().find(x=>x.district===47&&x.period==='E')!;
  const late=pdf(t);
  late.text=late.text.replace(englishDate(t.dueOn),'November 5, 2025');
  const r=auditCfb2025SpecialOriginalTarget(t,late,calendar(t));
  assert.equal(r.reportReceivedOn,'2025-11-05');
  assert.equal(r.earliestLegalAndFilingBoundOn,'2025-11-06');
  assert.equal(r.historicalPublicByVerifiedOn,null);
});
