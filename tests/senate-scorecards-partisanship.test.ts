import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {
  parseA4LSenatePdf,parseGunOwnersSenateHtml,parseEducationMinnesotaSenateEndorsements,parseNfibMinnesotaSenateEndorsements,parseNfibScorecardBillPositions,parseScorecardBillPositions,explicitPublishedOn,
  parseChamberScorecardBillPositions,parseConservationSenateProfileLinks,
  parseConservationProfilePagination,parseConservationSenatorVotes,
  parseRobots,validateScorecardManifest,parseScorecardContent,
  type ScorecardCapture,
} from '../src/sources/minnesota/senate-scorecard-raw.js';
import {
  parseOfficialPrecinctDistrictCodes,aggregateOfficialPrecinctVotes,
  aggregateOfficialHouseDistrictPresidentialVotes,officialStatewideTotals,
  validateDistrictStatewideTotals,type DistrictResult,
} from '../src/sources/minnesota/senate-district-partisanship-raw.js';
import {
  storeRawScorecardCapture,storeRawDistrictPartisanship,scorecardPartisanshipReadback,
} from '../src/operations/senate-scorecard-partisanship-ingest.js';

const digest=(x:string)=>createHash('sha256').update(x).digest('hex');
test('2025 Action 4 Liberty PDF extract retains printed district, party and numeric percentage',()=>{
  // Trimmed literal rows from A4L-MN-Scorecard-2025.pdf, p. 14.
  const pdf='2025 MN SENATE SCORECARD\nSENATOR PARTY DISTRICT\n'+
    'Mark Johnson R 1 72.73% 43.39% 0 1 1 1 1\n'+
    'Steve Green R 2 77.27% 79.10% 1 1 1 1\n'+
    'Grant Hauschild D 3 4.55% 5.86% 0 0 0 0\n'+
    '2025 MN HOUSE OF REPRESENTATIVES SCORECARD\n'+
    'Roger Skraba R 3A 20.83% 25.00% 1 1\n';
  const rows=parseA4LSenatePdf(pdf);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(x=>[x.nameRaw,x.districtRaw,x.valueRaw,x.valueNumeric]),
    [['Mark Johnson','1','72.73%',72.73],['Steve Green','2','77.27%',77.27],
      ['Grant Hauschild','3','4.55%',4.55]]);
  assert.equal(rows[0].partyRaw,'R');assert.equal(rows[2].kind,'score');
  assert.deepEqual(rows.map(x=>x.sourceOrdinal),[1,2,3]);
});
test('A4L 2025 and AFL-CIO 2025 print the position they took on named Senate bills',()=>{
  const a4l='2025 VOTE DESCRIPTIONS\nHF1 - Removal of program Senate Vote: 37-30 CORRECT VOTE: YES\n'+
    'SF1 - Higher Edu. Omnibus Senate Vote: 36-31 CORRECT VOTE: NO\n'+
    'HF2 was mentioned here, but no explicit group position was printed.';
  const a4lPos=parseScorecardBillPositions(a4l,'a4l_pdf');
  assert.deepEqual(a4lPos.map(x=>[x.billIdentifierRaw,x.groupPositionRaw]),
    [['HF1','CORRECT VOTE: YES'],['SF1','CORRECT VOTE: NO']]);
  const afl='SENATE VOTE DESCRIPTIONS\n1. Reopening Paid Leave\n'+
    'SF1832 – Rasmusson Appeal – April 29, 2025/Senate Journal Page 4153\n'+
    'Minnesota AFL-CIO Position: Uphold the President’s decision\n'+
    'Correct Vote: Yes\n';
  assert.deepEqual(parseScorecardBillPositions(afl,'aflcio_pdf')
    .map(x=>[x.billIdentifierRaw,x.groupPositionRaw]),
    [['SF1832','Uphold the President’s decision']]);
});
test('2022 MN Gun Owners Caucus HTML Senate table retains grades, endorsements and literal unknowns',()=>{
  // Trimmed 2022 publisher table headers/rows; House rows must NOT enter.
  const html='<h2>State Senate</h2><table><tr><th>Race</th><th>Name</th><th>Party</th>'+
    '<th>Grade</th><th>Endorsement</th><th>Received Survey</th><th>Voting Record</th></tr>'+
    '<tr><td>SD 1</td><td>Mark Johnson</td><td>R</td><td>A+</td><td>ENDORSED</td><td>YES</td><td>100%</td></tr>'+
    '<tr><td>SD 2</td><td>Leonard Alan Roy</td><td>DFL</td><td>?</td><td></td><td>NO</td><td></td></tr>'+
    '<tr><td>HD 1A</td><td>Other Person</td><td>R</td><td>A+</td><td>ENDORSED</td><td>YES</td><td>100%</td></tr>'+
    '</table>';
  const got=parseGunOwnersSenateHtml(html);
  assert.equal(got.length,4);
  assert.deepEqual(got.map(e=>[e.nameRaw,e.districtRaw,e.kind,e.valueRaw,e.valueNumeric]),
    [['Mark Johnson','1','grade','A+',null],
     ['Mark Johnson','1','endorsement','ENDORSED',null],
     ['Mark Johnson','1','score','100%',100],
     ['Leonard Alan Roy','2','grade','?',null]]);
  assert.equal(parseScorecardContent({groupName:'MNGOC',year:2022,
    adapter:'gunowners_html',url:'https://gunowners.mn/abc'},
  'text',html).entries.length,4);
});
test('Education Minnesota official two-column 2022 endorsement table only captures state Senators',()=>{
  // Trimmed 2022 published release: paired Candidate/District cells.
  const html='<table><tr><th>Candidate</th><th>District</th><th>Candidate</th><th>District</th></tr>'+
    '<tr><td>Leonard Alan Roy</td><td>Senate 2</td><td>Kelly Morrison</td><td>Senate 45</td></tr>'+
    '<tr><td>Reed Olson</td><td>House 2A</td><td>Kari Dorry**</td><td>Senate 12</td></tr></table>';
  const rows=parseEducationMinnesotaSenateEndorsements(html);
  assert.deepEqual(rows.map(r=>[r.nameRaw,r.districtRaw,r.kind,r.valueRaw]),
    [['Leonard Alan Roy','2','endorsement','ENDORSED'],
      ['Kelly Morrison','45','endorsement','ENDORSED'],
      ['Kari Dorry','12','endorsement','ENDORSED']]);
});
test('Education Minnesota 2026 Senate-specific release retains endorsement and printed party',()=>{
  // Trimmed July 31, 2026 press-release "House" then "Senate" section.
  const html='<h1>Education Minnesota endorses 54 more candidates</h1>'+
    '<p>House</p><p>24A: Heather Holmes, DFL</p>'+
    '<p>Senate</p><p>24: Simon Glaser, DFL</p>'+
    '<p>25: Liz Boldon, DFL</p><p>63: Zaynab Mohamed, DFL</p>'+
    '<h2>About Education Minnesota</h2><p>noncandidate</p>';
  const rows=parseEducationMinnesotaSenateEndorsements(html);
  assert.equal(rows.length,3);
  assert.equal(rows[0].nameRaw,'Simon Glaser');
  assert.equal(rows[0].partyRaw,'DFL');
  assert.equal(rows[0].valueNumeric,null);
});
test('Keep the first-party 2026 education endorsement dateline separate from fetched_at',()=>{
  assert.equal(explicitPublishedOn('ST. PAUL, Minnesota. July 31, 2026 – Education Minnesota endorsed senators.'),'2026-07-31');
  assert.equal(explicitPublishedOn('Last Updated: August 10, 2022'),'2022-08-10');
  assert.equal(explicitPublishedOn('No displayed publication date'),null);
});


test('Conservation directory excludes House district links and keeps original Senate paths',()=>{
  const url='https://www.conservationminnesota.org/mn-legislator-votes/find-legislators';
  const html='<div><a href="/legislators/jim-abeler">Jim Abeler</a><p>35</p></div>'+
    '<div><a href="/legislators/patty-acomb">Patty Acomb</a><p>45B</p></div>'+
    '<div><a href="/legislators/doron-clark">Doron Clark</a><p>60</p></div>';
  assert.deepEqual(parseConservationSenateProfileLinks(html,url),[
    'https://www.conservationminnesota.org/legislators/jim-abeler',
    'https://www.conservationminnesota.org/legislators/doron-clark']);
});
test('Conservation original Senate profile holds personal votes, not organization grades',()=>{
  const raw='Legislators\nSen. Mark Johnson\nRepublican\n01\n'+
    'Outdoor Heritage Fund, Legacy & Lands Bill | SF2077\nMay 17, 2026\n'+
    'Senator Johnson voted No\nSenate voted Yes\n'+
    'Omnibus Energy Budget Bill | SF2 (Senate)\nJune 9, 2025\n'+
    'Senator Johnson voted No\nSenate voted Yes\n'+
    'Different legislator | SF31\nApril 9, 2026\nSenator Smith voted Yes';
  const votes=parseConservationSenatorVotes(raw);
  assert.deepEqual(votes.map(x=>[x.districtRaw,x.votedOn,x.billIdentifierRaw,x.voteRaw]),[
    ['1','2026-05-17','SF2077','Senator Johnson voted No'],
    ['1','2025-06-09','SF2','Senator Johnson voted No']]);
  const parsed=parseScorecardContent({groupName:'Conservation Minnesota',year:2026,
    adapter:'conservation_html',url:'https://www.conservationminnesota.org/legislators/mark-johnson'},raw);
  assert.equal(parsed.entries.length,0);
  assert.equal(parsed.memberVotes?.length,2);
});
test('Conservation profile pagination uses only discovered same-profile publisher links',()=>{
  const url='https://www.conservationminnesota.org/legislators/doron-clark';
  const html='<a href="?page=1">Page 2</a><a href="?page=2">Page 3</a>'+
    '<a href="https://other.example/legislators/doron-clark?page=3">other</a>'+
    '<a href="/legislators/jim-abeler?page=1">other senator</a>';
  assert.deepEqual(parseConservationProfilePagination(html,url),[url+'?page=1',url+'?page=2']);
});
test('Education Minnesota deep CMS header does not hide 2025 SD60 special endorsement',()=>{
  const body='Navigation links '.repeat(1000)+
    'ST. PAUL, Minnesota. Jan. 27, 2025 – Education Minnesota announced its endorsement of Doron Clark in the special election on Tuesday for the Senate seat in Minneapolis.\n'+
    'Educators support Clark in Senate District 60 because they agree about public education.\n';
  const source={groupName:'Education Minnesota',year:2025,adapter:'edmn_html' as const,
    url:'https://educationminnesota.org/news/press-release/education-minnesota-endorses-clark-in-special-election-for-state-senate/'};
  assert.deepEqual(parseScorecardContent(source,body).entries.map(x=>[x.nameRaw,x.districtRaw]),
    [['Doron Clark','60']]);
  assert.equal(parseScorecardContent(source,body.replace('Senate District 60','House District 60A')).entries.length,0);
});
test('Stored Chamber PDFs yield only printed bill/issue positions, not fabricated grades',()=>{
  const raw='2025 Legislative Session Voting Record\nVote summaries\n'+
    'HHS Omnibus Finance bill, HF 2435 (Wiklund)\nBill passed, Chamber opposed\n'+
    'Earned Sick and Safe Time Modifications bill, SF 2300\n(Seeberger)\nBill passed, Chamber supported\n'+
    'A Chamber-supported bill without an explicit label is not parsed.\n'+
    'Senate votes\nAbeler No No\nAnderson No Yes\n';
  const source={groupName:'Minnesota Chamber of Commerce',year:2025,
    adapter:'generic_pdf' as const,url:'https://www.mnchamber.com/test.pdf'};
  const parsed=parseScorecardContent(source,raw);
  assert.deepEqual(parsed.entries,[]);
  assert.deepEqual(parsed.positions.map(p=>[p.billIdentifierRaw,p.groupPositionRaw]),
    [['HF 2435','Bill passed, Chamber opposed'],['SF 2300','Bill passed, Chamber supported']]);
  assert.deepEqual(parsed.positions.map(p=>p.sourceOrdinal),[1,2]);
  const unrelated=parseScorecardContent({...source,groupName:'Generic publisher'},raw);
  assert.equal(unrelated.positions.length,0);
});
test('Stored Chamber PDF amendment positions preserve literal amendment names and exclude House-only headings',()=>{
  const raw='2023-24 Legislative Voting Record\n'+
    '2021 House Omnibus Tax Bill – HF 991 (Marquart)\nChamber opposed\n'+
    '2021 Senate Omnibus Tax Bill – HF 991 (Nelson)\nChamber supported\n'+
    'Climate and Energy Finance and Policy Omnibus bill; HF 7\n'+
    'Amendment A3\nAmendment failed, Chamber supported\n'+
    'Climate and Energy Finance and Policy Omnibus bill; HF 7\n'+
    'Amendment A6\nAmendment failed, Chamber supported\n'+
    'The Chamber supports SF 4 legislation broadly.\n'+
    'Chamber supported a statewide reform.\n';
  const rows=parseChamberScorecardBillPositions(raw);
  assert.deepEqual(rows.map(p=>[p.billIdentifierRaw,p.groupPositionRaw]),
    [['HF 991','Chamber supported'],
      ['HF 7','Amendment A3; Amendment failed, Chamber supported'],
      ['HF 7','Amendment A6; Amendment failed, Chamber supported']]);
  assert.deepEqual(rows.map(p=>p.sourceOrdinal),[1,2,3]);
});
test('Reparse saved 2025 Education Minnesota plaintext without refetching HTML',()=>{
  const raw='Education Minnesota endorses Clark in special election for state Senate\n'+
    'ST. PAUL, Minnesota. Jan. 27, 2025 – Education Minnesota announced its endorsement of Doron Clark in the special election on Tuesday for the Senate seat in Minneapolis.\n'+
    'Educators support Clark in Senate District 60 because they agree about public education.\n';
  const result=parseScorecardContent({groupName:'Education Minnesota',year:2025,
    adapter:'edmn_html',url:'https://educationminnesota.org/2025',electionCandidate:true},raw);
  assert.deepEqual(result.entries.map(e=>[e.nameRaw,e.districtRaw,e.kind,e.valueRaw]),
    [['Doron Clark','60','endorsement','ENDORSED']]);
  assert.deepEqual(result.positions,[]);
});
test('2021-22 original NFIB Minnesota PDF extracts nine printed State Senate positions and excludes House',()=>{
  // Trimmed page 1 of the first-party 2021-22 NFIB MN Senate voting record.
  const pdf='VOTING RECORD\nSENATE ONLY\n'+
    '1. 1. Unemployment Insurance Experience COVID-19 Exclusion (2021-SF 192):\n'+
    'Freezes taxable wages. A “Yes” vote supports the NFIB position.\n'+
    '2. PPP Loan Forgiveness State Tax Exemption (2021-SF 263):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '3. Individual Health Insurance Market Reinsurance (2021-SF 694):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '4. Governor’s Peacetime Emergency Reform (2021-SF 4):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '5. UI Debt Repayment (2022-SF 2677):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '6. Reinsurance for 2023-27 (2022-SF 3472):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '7. 2022 Senate Tax Bill (2022-SF 3692):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '8. Southwest Light Rail Audit (2022-HF 3035):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    '9. Paid Leave Insurance Policies (2022-SF 3885):\n'+
    'A “Yes” vote supports the NFIB position.\n'+
    'HOUSE ONLY\n'+
    '1. 2021 House Tax Bill (2021-HF 991):\n'+
    'A “No” vote supports the NFIB position.\n';
  const rows=parseNfibScorecardBillPositions(pdf);
  assert.equal(rows.length,9);
  assert.deepEqual(rows.map(x=>x.billIdentifierRaw),
    ['SF 192','SF 263','SF 694','SF 4','SF 2677','SF 3472','SF 3692','HF 3035','SF 3885']);
  assert.ok(rows.every(x=>/Yes/i.test(x.groupPositionRaw)));
});
test('2026 NFIB source PDF numbered Senate-only issues retain literal YES/NO text and bill duplicates',()=>{
  // Trimmed literal original "Minnesota-Voting-Record-3.pdf", page 1:
  const raw='SENATE ONLY\n'+
    '1. Health & Human Services Omnibus Bill (2025 – HF 2435):\n'+
    'Increased taxes on healthcare. A “NO” vote supports the NFIB position.\n'+
    '2. Earned Sick & Safe Time Fixes (2025 – SF 2300):\n'+
    'Various modifications. A “YES” vote supports the NFIB position.\n'+
    '4. Suitable Seating Mandate Scope Modification (2026 – SF 4059):\n'+
    'Narrow scope. A “YES” vote supports the NFIB position.\n'+
    '5. Suitable Seating Mandate (2026 – SF 4059):\n'+
    'Narrow scope. A “NO” vote supports the NFIB positions. Passed Senate.\n'+
    'SENATE VOTING RECORD\n'+
    'Abeler, Jim\n60%\nDistrict\n35\n';
  const parsed=parseNfibScorecardBillPositions(raw);
  assert.deepEqual(parsed.map(v=>[v.billIdentifierRaw,v.groupPositionRaw]),
    [['HF 2435','A “NO” vote supports the NFIB position'],
      ['SF 2300','A “YES” vote supports the NFIB position'],
      ['SF 4059','A “YES” vote supports the NFIB position'],
      ['SF 4059','A “NO” vote supports the NFIB positions']]);
  assert.deepEqual(parseScorecardBillPositions(raw,'nfib_pdf'),parsed);
});
test('2024 NFIB Both Chambers vote descriptions stop before House-only issues',()=>{
  const raw='BOTH CHAMBERS\n'+
    '1. Federal Tax Conformity (2023 - HF 31):\n'+
    'Simplifies small business taxes. A “YES” vote supports the NFIB position.\n'+
    '2. Environment and Energy Omnibus Bill (2023 - HF 2310):\n'+
    'Increases fees. A “NO” vote supports the NFIB position.\n'+
    'HOUSE ONLY\n11. House Tax Omnibus Bill (2023 - HF 1938):\n'+
    'A “NO” vote supports the NFIB position.\n';
  const rows=parseNfibScorecardBillPositions(raw);
  assert.deepEqual(rows.map(v=>v.billIdentifierRaw),['HF 31','HF 2310']);
  assert.equal(rows.length,2);
});
test('NFIB 2022 publisher consolidated table preserves 45 State Senate candidates, never House rows',()=>{
  // Trimmed original Aug. 17, 2022 NFIB index: MN House table then Senate
  // four-column repeated pair table. A lettered House district stays excluded.
  const html='<h3>Minnesota House of Representatives</h3>'+
    '<table><tr><th>District</th><th>Endorsed Candidate</th></tr>'+
    '<tr><td>01A</td><td>Rep. John Burkel</td></tr></table>'+
    '<h3>Minnesota Senate</h3>'+
    '<table><tr><th>District</th><th>Endorsed Candidate</th><th>District</th><th>Endorsed Candidate</th></tr>'+
    '<tr><td>1</td><td>Sen. Mark Johnson*</td><td>27</td><td>Sen. Andrew Mathews</td></tr>'+
    '<tr><td>2</td><td>Steve Green</td><td>28</td><td>Sen. Mark Koran</td></tr>'+
    '<tr><td>3A</td><td>House Person</td><td>67</td><td>Another Senator</td></tr></table>';
  const got=parseNfibMinnesotaSenateEndorsements(html);
  assert.deepEqual(got.map(x=>[x.nameRaw,x.districtRaw,x.kind,x.valueRaw]),
    [['Sen. Mark Johnson','1','endorsement','ENDORSED'],
     ['Sen. Andrew Mathews','27','endorsement','ENDORSED'],
     ['Steve Green','2','endorsement','ENDORSED'],
     ['Sen. Mark Koran','28','endorsement','ENDORSED'],
     ['Another Senator','67','endorsement','ENDORSED']]);
});
test('NFIB 2022 first-round Senate bullet rows never treat House district as Senate',()=>{
  // First-round original release uses "District 01—Sen. Mark Johnson".
  const html='<h2>Minnesota Senate</h2><ul>'+
    '<li>District 01—Sen. Mark Johnson</li>'+
    '<li>District 05—Sen. Paul Utke</li>'+
    '<li>District 54—Sen. Eric Pratt</li></ul>'+
    '<h2>Minnesota House</h2><li>District 06B—Rep. Josh Heintzeman</li>';
  const got=parseNfibMinnesotaSenateEndorsements(html);
  assert.deepEqual(got.map(x=>x.nameRaw),['Sen. Mark Johnson','Sen. Paul Utke','Sen. Eric Pratt']);
  assert.equal(got[0].valueNumeric,null);
});
test('NFIB 2026 four-cell Senate table and exact 2025 special press release',()=>{
  const html='<h3>MN House of Representatives</h3>'+
    '<table><tr><th>House District</th><th>Candidate</th></tr>'+
    '<tr><td>HD 32B</td><td>Leslie Larson</td></tr></table>'+
    '<h3>MN Senate</h3>'+
    '<table><tr><th>Senate District</th><th>Candidate</th>'+
    '<th>Senate District</th><th>Candidate</th></tr>'+
    '<tr><td>SD 13</td><td>Jared Gapinski</td><td>SD 24</td><td>Nels Pierson</td></tr>'+
    '<tr><td>SD 20</td><td>Steve Jacob</td><td>SD 42</td><td>Kevin Peterson</td></tr></table>';
  assert.deepEqual(parseNfibMinnesotaSenateEndorsements(html).map(x=>x.nameRaw),
    ['Jared Gapinski','Nels Pierson','Steve Jacob','Kevin Peterson']);
  const release='<h1>NFIB Minnesota PAC Endorses Keri Heintzeman for SD 6</h1>'+
    '<p>Heintzeman will stand up for small businesses in Minnesota</p>';
  assert.deepEqual(parseNfibMinnesotaSenateEndorsements(release)
    .map(x=>[x.nameRaw,x.districtRaw]),[['Keri Heintzeman','6']]);
});
test('Education Minnesota 2024 State Senate 45 special and 2025 SD60 release',()=>{
  const table='<h1>Education Minnesota announces 23 new legislative endorsements</h1>'+
    '<table><tr><th>District</th><th>Name</th><th>Party</th></tr>'+
    '<tr><td>19B</td><td>Edel Fernandez-Mejia</td><td>DFL</td></tr>'+
    '<tr><td>Senate 45</td><td>Ann M. Johnson Stewart</td><td>Democratic-Farmer-Labor</td></tr></table>';
  assert.deepEqual(parseEducationMinnesotaSenateEndorsements(table)
    .map(x=>[x.nameRaw,x.districtRaw,x.partyRaw]),
    [['Ann M. Johnson Stewart','45','Democratic-Farmer-Labor']]);
  const press='<h1>Education Minnesota endorses Clark in special election for state Senate</h1>'+
    '<p>ST. PAUL, Minnesota. Jan. 27, 2025 – Education Minnesota announced its endorsement of Doron Clark in the special election on Tuesday for the Senate seat in Minneapolis.</p>'+
    '<p>Educators support Clark in Senate District 60 because they agree about public education.</p>';
  assert.deepEqual(parseEducationMinnesotaSenateEndorsements(press)
    .map(x=>[x.nameRaw,x.districtRaw]),[['Doron Clark','60']]);
  assert.equal(parseEducationMinnesotaSenateEndorsements(press.replace('Senate District 60','U.S. Senate')).length,0);
});
test('publisher literal calendar-date extraction accepts NFIB index and MN special datelines',()=>{
  assert.equal(explicitPublishedOn('August 17, 2022'),'2022-08-17');
  assert.equal(explicitPublishedOn('ST. PAUL, Minnesota. Jan. 27, 2025 – endorsements'),'2025-01-27');
  assert.equal(explicitPublishedOn('Published: September 3, 2026'),'2026-09-03');
  assert.equal(explicitPublishedOn('Published: February 30, 2025'),null);
  assert.equal(explicitPublishedOn('Fetched 2026-10-16; no printed publication date'),null);
});
test('Scorecard source catalog pinned 2021-2026 and robots grouping respects publisher restrictions',()=>{
  const cat=validateScorecardManifest(JSON.parse(readFileSync('data/senate-scorecard-sources.json','utf8')));
  assert.ok(cat.requestedGroups.includes('Minnesota AFL-CIO'));
  assert.ok(cat.sources.some(x=>x.adapter==='gunowners_html'));
  assert.throws(()=>validateScorecardManifest({...cat,sources:[...cat.sources,cat.sources[0]]}));
  const policy=parseRobots('User-agent: *\nDisallow: /\n\n'+
    'User-agent: VotePredictSenateEvidenceBot\nAllow: /scorecards/\nDisallow: /private/\n');
  assert.ok(policy.rules.some(x=>x.allow&&x.pattern==='/scorecards/'));
  assert.equal(policy.rules.some(x=>x.pattern==='/'&&!x.allow),false);
});
test('2022 precinct aggregation joins official county+precinct code, not an assumed Senate code',()=>{
  const mapLines:string[]=[];
  const results:string[]=[];
  const statewideLines:string[]=[
    'MN;;;0331;Governor & Lt Governor;;0301;Scott Jensen;;;R;134;134;268;44.61;670',
    'MN;;;0331;Governor & Lt Governor;;0401;Tim Walz;;;DFL;134;134;335;52.27;670',
    'MN;;;0331;Governor & Lt Governor;;9901;WRITE-IN;;;WI;134;134;67;0.04;670',
  ];
  for(let sd=1;sd<=67;sd++){
    for(const half of ['A','B']){
      const county=String(sd).padStart(2,'0'),p=half==='A'?'0010':'0020';
      mapLines.push(county+';'+p+';TEST;8;'+sd+half+';01;09;3001;00001;');
      const prefix='MN;'+county+';'+p+';0331;Governor & Lt Governor;;';
      results.push(prefix+'0301;Jensen;;;R;1;1;2;40;5');
      results.push(prefix+'0401;Walz;;;DFL;1;1;'+(half==='A'?2:3)+';50;5');
      results.push(prefix+'9901;WRITE-IN;;;WI;1;1;'+(half==='A'?1:0)+';10;5');
    }
  }
  // 134 house precincts: R=268, DFL=335, Other=67.
  const precinctMap=parseOfficialPrecinctDistrictCodes(mapLines.join('\n'));
  assert.equal(precinctMap.size,134);
  const tallied=aggregateOfficialPrecinctVotes(results.join('\n'),'governor',precinctMap);
  const expected=officialStatewideTotals(statewideLines.join('\n'),'governor');
  const check=validateDistrictStatewideTotals(tallied,expected);
  assert.equal(check.districts,67);assert.equal(check.matches,true);
  assert.deepEqual(check.districtTotals,expected);
  // No silent dropping precincts if district is missing.
  assert.throws(()=>aggregateOfficialPrecinctVotes(results.join('\n'),'governor',new Map()));
  assert.equal(validateDistrictStatewideTotals(tallied,{...expected,demVotes:334}).matches,false);
});
test('2020 president remains 2012 district plan; House A+B aggregation covers exactly 67 SDs',()=>{
  const lines:string[]=[];
  for(let sd=1;sd<=67;sd++){
    for(const half of ['A','B']){
      for(const [party,votes] of [['R',2],['DFL',3],['WI',1]] as const)
        lines.push('MN;;;0101;U.S. President & Vice President;'+sd+half+
          ';0101;Candidate;;;'+party+';2;2;'+votes+';50;6');
    }
  }
  const {votes,houseDistricts}=aggregateOfficialHouseDistrictPresidentialVotes(lines.join('\n'));
  assert.equal(houseDistricts,134);
  const sum=validateDistrictStatewideTotals(votes,{demVotes:402,repVotes:268,
    otherVotes:134,totalVotes:804});
  assert.equal(sum.matches,true);
});
test('additive only, standalone production marker and model isolation are enforced',()=>{
  const migration=readFileSync('migrations/0026_senate_scorecards_district_partisanship.sql','utf8');
  const runner=readFileSync('scripts/deploy-senate-scorecards-partisanship-neon.ts','utf8');
  const workflow=readFileSync('.github/workflows/senate-scorecards-partisanship-production.yml','utf8');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS senate_scorecard_snapshots/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS mn_senate_district_partisanship_raw/);
  assert.match(readFileSync('migrations/0029_senate_scorecard_member_votes_raw.sql','utf8'),
    /CREATE TABLE IF NOT EXISTS senate_scorecard_member_votes_raw/);
  assert.doesNotMatch(migration,/^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\s/mi);
  assert.match(runner,/SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION/);
  assert.match(runner,/SENATE_SCORECARD_EXPAND_PUBLISHERS/);
  assert.match(runner,/SENATE_SCORECARD_MCCL_RETRY/);
  assert.match(runner,/static\\.wixstatic\\.com/);
  assert.match(runner,/source\\.groupName==='MCCL'/);
  assert.match(runner,/scripts\/check-production-migration-drift\.ts/);
  assert.match(workflow,/independent-main/);
  assert.match(workflow,/evidence-readonly-sandbox/);
  assert.doesNotMatch(workflow,/\bschedule\s*:/);
});
const connection=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
const local=!!connection&&['127.0.0.1','localhost'].includes(new URL(connection).hostname);
test('disposable Postgres: running the entire raw evidence suite twice keeps exactly one version',
  {skip:!local,timeout:90000},async()=>{
  const pool=new Pool({connectionString:connection,max:2});
  const token=randomUUID(),hash=digest(token);
  const group='Scorecard fixture '+token;
  const client=await pool.connect();
  let memberId='',billId='';
  try{
    const jurisdiction=(await client.query<{id:string}>(
      "INSERT INTO jurisdictions(slug,name,country_code) VALUES('us-mn','Minnesota','US') "+
      "ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0].id;
    const senate=(await client.query<{id:string}>(
      "INSERT INTO chambers(jurisdiction_id,slug,name,kind) VALUES($1,'senate','Minnesota Senate','upper') "+
      "ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [jurisdiction])).rows[0].id;
    const session=(await client.query<{id:string}>(
      "INSERT INTO legislative_sessions(jurisdiction_id,slug,name,starts_on,ends_on) "+
      "VALUES($1,'2025-2026','2025-2026','2025-01-01','2026-12-31') "+
      "ON CONFLICT(jurisdiction_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [jurisdiction])).rows[0].id;
    const name='Fixture Legislator '+token.slice(0,8);
    const legislator=(await client.query<{id:string}>(
      'INSERT INTO legislators(jurisdiction_id,external_key,name,normalized_name) '+
      'VALUES($1,$2,$3,$4) RETURNING id',
      [jurisdiction,'scorecard-fixture:'+token,name,name.toLowerCase()])).rows[0].id;
    memberId=(await client.query<{id:string}>(
      'INSERT INTO memberships(session_id,chamber_id,legislator_id,district,party,title) '+
      "VALUES($1,$2,$3,'17','R','Senator') RETURNING id",
      [session,senate,legislator])).rows[0].id;
    billId=(await client.query<{id:string}>(
      "INSERT INTO bills(session_id,originating_chamber_id,identifier,title) VALUES($1,$2,'SF99001','Fixture') "+
      "ON CONFLICT(session_id,identifier) DO UPDATE SET title=EXCLUDED.title RETURNING id",
      [session,senate])).rows[0].id;
    const source={groupName:group,year:2025,adapter:'a4l_pdf' as const,
      url:'https://example.org/fixture/'+token+'.pdf'};
    const capture:ScorecardCapture={
      source,sourceUrl:source.url,sha256:hash,fetchedAt:'2026-10-16T00:00:00Z',
      contentType:'application/pdf',rawText:'Published Senate scorecard fixture '+token,
      publishedOn:null,memberVotes:[{sourceOrdinal:1,nameRaw:name,districtRaw:'17',partyRaw:'R',
        billIdentifierRaw:'SF99001',votedOn:'2025-06-09',voteRaw:'Senator Fixture voted Yes'}],
      entries:[{sourceOrdinal:1,nameRaw:name,districtRaw:'17',partyRaw:'R',
        kind:'score',valueRaw:'72.73%',valueNumeric:72.73}],
      positions:[{sourceOrdinal:1,billIdentifierRaw:'SF99001',groupPositionRaw:'CORRECT VOTE: YES'}],
    };
    const districtRows=Array.from({length:67},(_,i)=>({
      district:String(i+1),districtPlan:'2022' as const,electionYear:2024 as const,
      office:'president' as const,demVotes:3,repVotes:2,otherVotes:1,totalVotes:6,
      source:'fixture',sourceUrl:'https://example.org/fixture/'+token+'.txt',
      fetchedAt:'2026-10-16T00:00:00Z',sha256:hash,
    }));
    const election:DistrictResult={year:2024,office:'president',districtPlan:'2022',
      sourceUrl:districtRows[0].sourceUrl,rows:districtRows,districts:67,
      statewideTotals:{demVotes:201,repVotes:134,otherVotes:67,totalVotes:402},
      districtTotals:{demVotes:201,repVotes:134,otherVotes:67,totalVotes:402},totalsMatch:true};
    const catalog={roster:[{id:memberId,sessionSlug:'2025-2026',name,district:'17'}],
      bills:[{id:billId,sessionSlug:'2025-2026',identifier:'SF99001'}]};
    for(let i=0;i<2;i++){
      const score=await storeRawScorecardCapture(client,capture,catalog);
      const inserted=await storeRawDistrictPartisanship(client,election);
      assert.equal(score.entries,1);assert.equal(score.matchedMembers,1);
      assert.equal(score.matchedBills,1);
      assert.equal(score.memberVotes,1);assert.equal(score.linkedMemberVotes,1);
      assert.equal(score.linkedVoteBills,1);
      assert.equal(inserted,i===0?67:0);
      const checked=await client.query<{snapshots:number;entries:number;positions:number;member_votes:number;districts:number}>(
        'SELECT (SELECT count(*)::int FROM senate_scorecard_snapshots WHERE group_name=$1) AS snapshots,'+
        '(SELECT count(*)::int FROM senate_scorecard_entries WHERE group_name=$1) AS entries,'+
        '(SELECT count(*)::int FROM senate_scorecard_vote_positions WHERE group_name=$1) AS positions,'+
        '(SELECT count(*)::int FROM senate_scorecard_member_votes_raw WHERE group_name=$1) AS member_votes,'+
        '(SELECT count(*)::int FROM mn_senate_district_partisanship_raw WHERE sha256=$2) AS districts',
        [group,hash]);
      assert.deepEqual(checked.rows[0],{snapshots:1,entries:1,positions:1,member_votes:1,districts:67});
      const report=await scorecardPartisanshipReadback(client);
      assert.ok(report.linkedMembers>=1&&report.linkedBills>=1&&
        report.memberVotes>=1&&report.linkedMemberVotes>=1&&report.linkedVoteBills>=1);
    }
    const replay=await storeRawScorecardCapture(client,capture,catalog,true);
    assert.equal(replay.newSnapshot,false);
    await assert.rejects(()=>storeRawScorecardCapture(client,
      {...capture,sha256:digest(token+'different-source-version')},catalog,true),
    /Saved-only replay cannot create a new publisher snapshot/);
  }finally{
    // This fixture runs on disposable CI PostgreSQL. Preserve unrelated fixtures.
    await client.query('DELETE FROM senate_scorecard_member_votes_raw WHERE group_name=$1',[group]);
    await client.query('DELETE FROM senate_scorecard_vote_positions WHERE group_name=$1',[group]);
    await client.query('DELETE FROM senate_scorecard_entries WHERE group_name=$1',[group]);
    await client.query('DELETE FROM senate_scorecard_snapshots WHERE group_name=$1',[group]);
    await client.query('DELETE FROM mn_senate_district_partisanship_raw WHERE sha256=$1',[hash]);
    await client.query('DELETE FROM memberships WHERE id=$1',[memberId]);
    await client.query('DELETE FROM bills WHERE id=$1',[billId]);
    client.release();
    await pool.end();
  }
});
