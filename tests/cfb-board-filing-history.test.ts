import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cfbBoardFilingHistoryDateInScope,
  discoverCfbBoardMaterialsLinks,
  parseCfbBoardMaterialsFilingProofs,
} from '../src/evidence/cfb-board-filing-history.js';

test('uses the complete 2021-2026 CFB Board filing-proof window', () => {
  assert.equal(cfbBoardFilingHistoryDateInScope('2020-12-31'), false);
  assert.equal(cfbBoardFilingHistoryDateInScope('2021-01-01'), true);
  assert.equal(cfbBoardFilingHistoryDateInScope('2022-04-06'), true);
  assert.equal(cfbBoardFilingHistoryDateInScope('2026-12-31'), true);
  assert.equal(cfbBoardFilingHistoryDateInScope('2027-01-01'), false);
});

test('discovers dated CFB Board meeting-material PDFs', () => {
  const html = [
    '<a href="/pdf/bdinfo/agendas/2021_01_08_materials.pdf">1/8/2021 materials</a>',
    '<a href="/pdf/bdinfo/agendas/2025_01_13_materials.pdf?t=1749772800">1/13/2025 materials</a>',
    '<a href="https://register.cfb.mn.gov/pdf/bdinfo/agendas/2024_06_05_materials.pdf">6/5/2024 materials</a>',
    '<a href="/pdf/bdinfo/minutes/2024_06_05_regular_session.pdf">minutes</a>',
  ].join('\n');

  assert.deepEqual(discoverCfbBoardMaterialsLinks(html), [
    {
      sourceUrl: 'https://register.cfb.mn.gov/pdf/bdinfo/agendas/2021_01_08_materials.pdf',
      meetingDate: '2021-01-08',
    },
    {
      sourceUrl: 'https://register.cfb.mn.gov/pdf/bdinfo/agendas/2024_06_05_materials.pdf',
      meetingDate: '2024-06-05',
    },
    {
      sourceUrl: 'https://register.cfb.mn.gov/pdf/bdinfo/agendas/2025_01_13_materials.pdf?t=1749772800',
      meetingDate: '2025-01-13',
    },
  ]);
});

test('extracts only explicit filed dates from CFB Board late-filing tables', () => {
  const text = [
    '9. Local 68 Political Action Fund (30652)',
    'Report(s) Due Filed Amount Prior Waivers Recommended Action Board Action',
    '2024 Pre-General 10/28/24 11/1/24 $200 LFF',
    '10. MAIDA (Minnesota Asian-Indian Democratic Association) (40713)',
    'Report(s) Due Filed Amount Prior Waivers Recommended Action Board Action',
    '2023 Year-End 1/31/24 2/9/24 $175 LFF',
    '2024 June 6/14/24 6/17/24 $50 LFF',
    '2024 Pre-Primary 7/29/24 7/30/24 $50 LFF',
  ].join('\n');

  const proofs = parseCfbBoardMaterialsFilingProofs(
    text,
    'https://register.cfb.mn.gov/pdf/bdinfo/agendas/2025_01_13_materials.pdf',
  );

  assert.equal(proofs.length, 4);
  assert.deepEqual(
    proofs.map((proof) => ({
      registrationNumber: proof.registrationNumber,
      reportName: proof.reportName,
      dueOn: proof.dueOn,
      filedOn: proof.filedOn,
      availableOn: proof.availableOn,
    })),
    [
      {
        registrationNumber: '40713',
        reportName: '2023 Year-End',
        dueOn: '2024-01-31',
        filedOn: '2024-02-09',
        availableOn: '2024-02-10',
      },
      {
        registrationNumber: '40713',
        reportName: '2024 June',
        dueOn: '2024-06-14',
        filedOn: '2024-06-17',
        availableOn: '2024-06-18',
      },
      {
        registrationNumber: '40713',
        reportName: '2024 Pre-Primary',
        dueOn: '2024-07-29',
        filedOn: '2024-07-30',
        availableOn: '2024-07-31',
      },
      {
        registrationNumber: '30652',
        reportName: '2024 Pre-General',
        dueOn: '2024-10-28',
        filedOn: '2024-11-01',
        availableOn: '2024-11-02',
      },
    ],
  );
});

test('does not convert due dates alone into availability proofs', () => {
  const text = [
    'Example Committee (30001)',
    'Report(s) Due Filed',
    '2024 Pre-General 10/28/24',
  ].join('\n');

  assert.deepEqual(
    parseCfbBoardMaterialsFilingProofs(
      text,
      'https://register.cfb.mn.gov/pdf/bdinfo/agendas/example_materials.pdf',
    ),
    [],
  );
});
