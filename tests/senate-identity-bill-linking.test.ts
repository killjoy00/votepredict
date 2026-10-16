import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  normalizePrintedSenatorName,resolveSenator,canonicalBillIdentifier,resolveBill,
  senateSessionForDate,senateServiceSessionForElection,
  extractBillInclusionMentions,parseRevisorCompanionXml,parseRevisorCompanion,
  type SenateMember,type SessionBill,
} from '../src/operations/senate-identity-bill-resolvers.js';

const roster:SenateMember[]=[
  {id:'e',sessionSlug:'2025-2026',name:'Erin Maye Quade',district:'56'},
  {id:'c',sessionSlug:'2025-2026',name:'Clare Oumou Verbeten',district:'66'},
  {id:'j',sessionSlug:'2025-2026',name:'Julia E. Coleman',district:'48'},
  {id:'s1',sessionSlug:'2025-2026',name:'John Smith',district:'1'},
  {id:'s2',sessionSlug:'2025-2026',name:'Jane Smith',district:'2'},
  {id:'b',sessionSlug:'2025-2026',name:'Robert L. Jones',district:'4'},
  {id:'k',sessionSlug:'2025-2026',name:'Janet Kreun',district:'30',
    aliases:['Jan Kreun']},
  {id:'older',sessionSlug:'2023-2024',name:'Jane Smith',district:'12'},
  {id:'historical',sessionSlug:'2021-2022',name:'Michael Jensen',district:'7'},
];

test('Sen., Sen and Senator prefixes normalize with compound surnames and initials',()=>{
  assert.equal(normalizePrintedSenatorName('Sen. Erin Maye-Quade'),'erin maye quade');
  assert.equal(normalizePrintedSenatorName('Senator Clare Oumou Verbeten'),'clare oumou verbeten');
  assert.equal(normalizePrintedSenatorName('Sen. Julia E. Coleman'),'julia e coleman');
  assert.deepEqual(resolveSenator({printedName:'Sen. Erin Maye Quade',sessionSlug:'2025-2026'},roster),
    {membershipId:'e',matchMethod:'exact'});
  assert.deepEqual(resolveSenator({printedName:'Senator Julia Coleman',sessionSlug:'2025-2026'},roster),
    {membershipId:'j',matchMethod:'exact'});
});

test('surname-only and compound surname citations link only when unique in session',()=>{
  assert.deepEqual(resolveSenator({printedName:'Sen. Maye Quade',sessionSlug:'2025-2026'},roster),
    {membershipId:'e',matchMethod:'surname_unique_in_session'});
  assert.deepEqual(resolveSenator({printedName:'Oumou Verbeten',sessionSlug:'2025-2026'},roster),
    {membershipId:'c',matchMethod:'surname_unique_in_session'});
  assert.deepEqual(resolveSenator({printedName:'Sen. Quade',sessionSlug:'2025-2026'},roster),
    {membershipId:'e',matchMethod:'surname_unique_in_session'});
});

test('official aliases, nicknames and bounded near matches preserve method',()=>{
  assert.deepEqual(resolveSenator({printedName:'Sen. Jan Kreun',sessionSlug:'2025-2026'},roster),
    {membershipId:'k',matchMethod:'alias'});
  assert.deepEqual(resolveSenator({printedName:'Sen. Bob Jones',sessionSlug:'2025-2026'},roster),
    {membershipId:'b',matchMethod:'alias'});
  assert.deepEqual(resolveSenator({printedName:'Sen. Erin M. Quade',sessionSlug:'2025-2026'},roster),
    {membershipId:'e',matchMethod:'alias'});
  assert.deepEqual(resolveSenator({printedName:'Erin Maye Quad',sessionSlug:'2025-2026'},roster),
    {membershipId:'e',matchMethod:'alias'});
});

test('same-session ambiguous surnames unresolved until a district disambiguates',()=>{
  assert.deepEqual(resolveSenator({printedName:'Sen. Smith',sessionSlug:'2025-2026'},roster),
    {membershipId:null,matchMethod:'unresolved'});
  assert.deepEqual(resolveSenator({printedName:'Sen. Smith',sessionSlug:'2025-2026',district:'SD 02'},roster),
    {membershipId:'s2',matchMethod:'district'});
  assert.deepEqual(resolveSenator({printedName:'Julia Coleman',sessionSlug:'2025-2026',district:'12'},roster),
    {membershipId:null,matchMethod:'unresolved'});
  assert.deepEqual(resolveSenator({printedName:'Janet Kreun',sessionSlug:'2023-2024'},roster),
    {membershipId:null,matchMethod:'unresolved'});
});

test('ambiguous full name, typo, and date windows never guess',()=>{
  const doubled=[...roster,{id:'duplicate',sessionSlug:'2025-2026',name:'Erin Maye Quade',district:'56'}];
  assert.deepEqual(resolveSenator({printedName:'Erin Maye Quade',sessionSlug:'2025-2026'},doubled),
    {membershipId:null,matchMethod:'unresolved'});
  assert.deepEqual(resolveSenator({printedName:'Sen. Erin Quad',sessionSlug:'2025-2026'},roster),
    {membershipId:null,matchMethod:'unresolved'});
  const temporal=[{id:'x',sessionSlug:'2025-2026',name:'Zoe Harper',district:'8',
    startsOn:'2025-01-01',endsOn:'2025-06-01'}];
  assert.deepEqual(resolveSenator({printedName:'Zoe Harper',sessionSlug:'2025-2026',date:'2025-08-01'},temporal),
    {membershipId:null,matchMethod:'unresolved'});
});

const bills:SessionBill[]=[
  {id:'sf23',sessionSlug:'2023-2024',identifier:'SF1434'},
  {id:'sf25',sessionSlug:'2025-2026',identifier:'SF1434'},
  {id:'sf21',sessionSlug:'2021-2022',identifier:'SF1434'},
  {id:'hf',sessionSlug:'2025-2026',identifier:'HF2563'},
];
test('bill identifiers normalize S.F. No., S.F., SF and HF without crossing sessions',()=>{
  assert.equal(canonicalBillIdentifier('S.F. No. 1434'),'SF1434');
  assert.equal(canonicalBillIdentifier('HF 02563'),'HF2563');
  assert.equal(canonicalBillIdentifier('SF1434'),'SF1434');
  assert.equal(canonicalBillIdentifier('HF 0'),null);
  assert.equal(canonicalBillIdentifier('S.F. HF1234'),null);
  assert.deepEqual(resolveBill({printedIdentifier:'SF1434',sessionSlug:'2025-2026'},bills),
    {billId:'sf25',matchMethod:'exact',canonicalIdentifier:'SF1434'});
  assert.deepEqual(resolveBill({printedIdentifier:'S.F. No. 1434',sessionSlug:'2023-2024'},bills),
    {billId:'sf23',matchMethod:'normalized',canonicalIdentifier:'SF1434'});
  assert.deepEqual(resolveBill({printedIdentifier:'SF 1434',sessionSlug:'2021-2022'},bills),
    {billId:'sf21',matchMethod:'normalized',canonicalIdentifier:'SF1434'});
  assert.deepEqual(resolveBill({printedIdentifier:'HF 2563',sessionSlug:'2025-2026'},bills),
    {billId:'hf',matchMethod:'normalized',canonicalIdentifier:'HF2563'});
  assert.equal(resolveBill({printedIdentifier:'HF2563',sessionSlug:'2023-2024'},bills).billId,null);
});

test('election service session vs publication session is explicit',()=>{
  assert.equal(senateSessionForDate('2023-01-31'),'2023-2024');
  assert.equal(senateSessionForDate('2024-04-01'),'2023-2024');
  assert.equal(senateServiceSessionForElection('2020-11-03','general'),'2021-2022');
  assert.equal(senateServiceSessionForElection('2022-11-08','general'),'2023-2024');
  assert.equal(senateServiceSessionForElection('2024-11-05','special'),'2023-2024');
  assert.equal(senateServiceSessionForElection('2025-11-04','special'),'2025-2026');
});

test('raw inclusion mentions preserve only printed phrases and explicit bill identifiers',()=>{
  const source=[
    'S.F. No. 1434 was laid over for possible inclusion.',
    'S.F. No. 1434 incorporated into H.F. No. 2563.',
    'SF1434: See article 2 of HF2563.',
    'A bill was discussed as a possible omnibus candidate.',
  ].join('\n');
  const items=extractBillInclusionMentions(source);
  assert.equal(items.length,3);
  assert.equal(items[0].mentionType,'laid over for possible inclusion');
  assert.equal(items[0].sourceBillIdentifier,'SF1434');
  assert.equal(items[0].targetBillIdentifier,null);
  assert.equal(items[1].mentionType,'incorporated into');
  assert.equal(items[1].targetBillIdentifier,'HF2563');
  assert.equal(items[2].mentionType,'see article X of');
  assert.equal(items[2].targetBillIdentifier,'HF2563');
});

test('official Revisor status XML companion is explicit and None stays absent',()=>{
  assert.equal(parseRevisorCompanionXml(
    '<BILL><FILE_TYPE>SF</FILE_TYPE><FILE_NUMBER>690</FILE_NUMBER><COMPANION_TYPE>HF</COMPANION_TYPE><COMPANION_NUMBER>10</COMPANION_NUMBER></BILL>'),
    'HF10');
  assert.equal(parseRevisorCompanionXml(
    '<BILL><COMPANION_TYPE></COMPANION_TYPE><COMPANION_NUMBER></COMPANION_NUMBER></BILL>'),null);
  assert.equal(parseRevisorCompanion('<h2>Companion: HF2442</h2>'),'HF2442');
  assert.equal(parseRevisorCompanion('<h2>Companion: None</h2>'),null);
});

test('0022 is additive, preserves preexisting identity/bill IDs, and limits target tables',()=>{
  const sql=readFileSync('migrations/0022_senate_identity_bill_linking.sql','utf8');
  assert.match(sql,/ADD COLUMN IF NOT EXISTS membership_match_method/);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS bill_match_method/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS bill_companions/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS bill_inclusion_mentions/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS senate_statement_member_mentions/);
  assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  assert.doesNotMatch(sql,/\b(?:ALTER|UPDATE|DELETE)\s+(?:TABLE\s+)?(?:forecast|member_votes|vote_events|evidence_items|bill_features)/i);
});

test('production workflow remains protected by main push SHA, marker and independent job',()=>{
  const yaml=readFileSync('.github/workflows/senate-identity-bill-linking-production.yml','utf8');
  assert.match(yaml,/github\.run_attempt == 1/);
  assert.match(yaml,/github\.event\.after == github\.sha/);
  assert.match(yaml,/SENATE_IDENTITY_BILL_LINK_PRODUCTION/);
  assert.match(yaml,/needs: \[independent-main\]/);
  assert.match(yaml,/environment: evidence-readonly-sandbox/);
  assert.doesNotMatch(yaml,/workflow_dispatch:/);
});

test('possessives, doubled surnames, common nicknames and one-typo bare surnames resolve uniquely',()=>{
  const people:SenateMember[]=[
    {id:'m',sessionSlug:'2025-2026',name:'Nicole Mitchell',district:'47'},
    {id:'g',sessionSlug:'2025-2026',name:'Glenn H. Gruenhagen',district:'17'},
    {id:'l',sessionSlug:'2025-2026',name:'Ronald Latz',district:'46'},
    {id:'i',sessionSlug:'2025-2026',name:'Rich Draheim',district:'22'},
    {id:'n',sessionSlug:'2025-2026',name:'Gene Dornink',district:'23'},
    {id:'t',sessionSlug:'2025-2026',name:'Torrey Westrom',district:'12'},
    {id:'v',sessionSlug:'2025-2026',name:'Steve Ingebrigtsen',district:'8'},
  ];
  assert.equal(normalizePrintedSenatorName('Mitchell’s'),'mitchell');
  assert.equal(normalizePrintedSenatorName("Sen. Mitchell's"),'mitchell');
  assert.equal(normalizePrintedSenatorName('Glenn Gruenhagen Gruenhagen'),'glenn gruenhagen');
  assert.deepEqual(resolveSenator({printedName:'Mitchell’s',sessionSlug:'2025-2026'},people),
    {membershipId:'m',matchMethod:'surname_unique_in_session'});
  assert.deepEqual(resolveSenator({printedName:'Glenn Gruenhagen Gruenhagen',sessionSlug:'2025-2026'},people),
    {membershipId:'g',matchMethod:'exact'});
  assert.deepEqual(resolveSenator({printedName:'Ron Latz',sessionSlug:'2025-2026'},people),
    {membershipId:'l',matchMethod:'alias'});
  assert.deepEqual(resolveSenator({printedName:'Ingebrightsen',sessionSlug:'2025-2026'},people),
    {membershipId:'v',matchMethod:'surname_unique_in_session'});
  assert.deepEqual(resolveSenator({printedName:'Westrum',sessionSlug:'2025-2026'},people),
    {membershipId:'t',matchMethod:'surname_unique_in_session'});
  // Short surnames and two-name roll-call fragments stay unresolved.
  assert.deepEqual(resolveSenator({printedName:'Dorink',sessionSlug:'2025-2026'},people),
    {membershipId:null,matchMethod:'unresolved'});
  assert.deepEqual(resolveSenator({printedName:'Draheim Dornink',sessionSlug:'2025-2026'},people),
    {membershipId:null,matchMethod:'unresolved'});
});
