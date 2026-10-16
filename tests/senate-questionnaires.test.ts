import {readFileSync} from 'node:fs';
import {assertAdditiveQuestionnaireMigration} from '../src/operations/senate-questionnaire-migration.js';
import {insertQuestionnaire,exactExistingSenateMembership,questionnaireServiceSession,reconcileUnmatchedQuestionnaireMemberships,questionnaireEligibleScopeReadback} from '../src/operations/senate-questionnaire-ingest.js';
import {eligibleSenateQuestionnaireCandidate,HISTORICAL_QUESTIONNAIRE_WINNERS} from '../src/sources/minnesota/senate-questionnaire-eligibility.js';
import type {PoolClient} from 'pg';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  sha256,visibleLines,mhpLinks,biofuelsLinks,parseResponses,parseSd60PdfText,
  validateCatalog,collectQuestionnaires,type QuestionnaireSource,type CandidateResponse,
} from '../src/sources/minnesota/senate-questionnaire-raw.js';
const base:QuestionnaireSource={
  id:'mhp',publisher:'MHP',cycle:2026,adapter:'mhp_index',
  url:'https://mhponline.org/2026-candidate-housing-questionnaire/',
  title:'Housing 2026',sourceKind:'publisher_response',
};
const candidate={...base,adapter:'mhp' as const,candidate:'Dan Rogers',district:'02'};
test('MHP lists only actual published Senate links; ignores blank form and House',()=>{
  const html='<table><tr><th>Name</th><th>Legislative Body</th><th>Party</th><th>District</th></tr>'+
    '<tr><td><a href="/2026_questionnaire/dan-rogers/">Dan Rogers</a></td><td>Senate</td><td>DFL</td><td>02</td></tr>'+
    '<tr><td><a href="/2026_questionnaire/house/">House Candidate</a></td><td>House</td><td>DFL</td><td>02A</td></tr>'+
    '<tr><td><a href="/2026questionnaire/">Submission portal</a></td><td>Senate</td><td>R</td><td>07</td></tr></table>';
  const links=mhpLinks(html,base);
  assert.equal(links.length,1);
  assert.equal(links[0].candidate,'Dan Rogers');
  assert.equal(links[0].district,'2');
  assert.equal(links[0].url,'https://mhponline.org/2026_questionnaire/dan-rogers/');
});
test('MHP retains complete multiline Q&A and missing publication date',()=>{
  const html='<main><h2>Dan Rogers</h2><h4>Legislative District: Senate District 2</h4><h4>Party: DFL</h4>'+
  '<p>Q1: Who will you help?</p><em>Residents, and their families.</em><p>Another paragraph from this answer.</p>'+
  '<p>Q2: What will you do with housing funding?</p><em>Build affordable homes.</em>'+
  '<p>Q3: State budget funding is small.</p><p>What revenue will you champion?</p>'+
  '<em>Raise public investment in a transparent way.</em><h3>Contact Us</h3></main>';
  const p=parseResponses(html,candidate);
  assert.equal(p.length,1);assert.equal(p[0].qa.length,3);
  assert.equal(p[0].qa[0].answer,'Residents, and their families.\nAnother paragraph from this answer.');
  assert.equal(p[0].qa[2].question,'State budget funding is small.\nWhat revenue will you champion?');
  assert.equal(p[0].displayedPublicationOn,undefined);
});
test('SNAP captures only State Senate respondent, not topic/keywords or US senate',()=>{
  const seed={...base,adapter:'snap' as const,url:'https://snapcoalition.org/initiatives/stance-on-science/candidates/mn/robyn-gulley'};
  const html='<h1>Robyn Gulley</h1><p>Democratic</p><p>Minnesota State Senate District 65</p>'+
    '<p>Submitted July 6, 2026</p><p>Q1 What evidence would you use?</p><div>Trust in Science</div>'+
    '<p>“Scientists and researchers.”</p><p>KEYWORDS: Science, trust</p>'+
    '<p>Q2 How should rivers be protected?</p><div>Environment</div><p>“Protect drinking water.”</p>'+
    '<p>KEYWORDS: Water</p><h5>About</h5><p>Boilerplate</p>';
  const items=parseResponses(html,seed);
  assert.equal(items[0].qa.length,2);
  assert.equal(items[0].qa[0].answer,'“Scientists and researchers.”');
  assert.equal(items[0].displayedSubmittedOn,'2026-07-06');
  assert.equal(items[0].district,'65');
  assert.throws(()=>parseResponses(html.replace('State Senate District','US Senate District'),seed));
});
test('KAXE multi-candidate questionnaire skips explicitly unlabeled/nonresponse',()=>{
  const seed={...base,adapter:'kaxe' as const,
    url:'https://www.kaxe.org/a',district:'2',candidates:['Steve Green','Dan Rogers','Calvin Larson Jr.']};
  const html='<h1>Senate District 2 2026 Election Guide</h1><p>Published September 28, 2026 at 12:35 PM CDT</p>'+
    '<h3>Click the tabs below to learn more about the candidates</h3>'+
    '<div><h2>Steve Green</h2><p>Party: Republican</p><p>KAXE did not receive a response from this candidate.</p></div>'+
    '<div><h2>Dan Rogers</h2><p>Party: DFL</p><p>Why are you running?</p><p>For education.</p>'+
    '<p>What natural resources policies do you support?</p><p>Clean water.</p></div>';
  const parsed=parseResponses(html,seed);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].candidateName,'Dan Rogers');
  assert.equal(parsed[0].qa.length,2);
  assert.equal(parsed[0].displayedPublicationOn,'2026-09-28');
});
test('2022 Biofuels keeps printed candidate heading and Q A exactly, House excluded',()=>{
  const seed={...base,adapter:'biofuels' as const,cycle:2022,
    url:'https://www.mnbiofuels.org/candidates-biofuels-weber-dornink',
    candidates:['Bill Weber','Gene Dornink']};
  const html='<p>Tuesday, 18 October 2022 09:16</p><h3>Billl Weber (R) District 21</h3>'+
    '<p>Q. Do you support the existing statute?</p><p>A. Yes.</p>'+
    '<p>Q. What can be improved?</p><p>A. The process.</p>'+
    '<h3>Anna Representative (R) District 11B</h3><p>Q. A?</p><p>A. No.</p>'+
    '<h3>Gene Dornink (R) District 23</h3><p>Q. Will you accelerate permits?</p><p>A. Yes.</p>'+
    '<p>Q. Will you support biofuel standards?</p><p>A. I will consider them.</p>';
  const records=parseResponses(html,seed);
  assert.equal(records.length,2);
  assert.equal(records[0].qa[0].answer,'Yes.');
  assert.equal(records[1].district,'23');
  assert.equal(records[0].displayedPublicationOn,'2022-10-18');
});
test('2020 original archive links are bounded to named Senate candidate articles',()=>{
  const source={...base,cycle:2020,adapter:'biofuels_index' as const,
    articleNames:['Jim Carlson'],url:'https://www.mnbiofuels.org/the-epa-wrecking-ball/itemlist/category/11-media?start=912'};
  const html='<h3><a href="/media-mba/blog/item/1122-candidates-biofuels-jim-carlson">Candidates &amp; Biofuels: Jim Carlson</a></h3>'+
    '<h3><a href="/media-mba/blog/item/4567-candidates-biofuels-tina-smith">Candidates &amp; Biofuels: Tina Smith</a></h3>';
  const links=biofuelsLinks(html,source);
  assert.equal(links.length,1);
  assert.ok(links[0].url.includes('jim-carlson'));
});
test('source catalog rejects offsite, duplicate and non-HTTPS URLs',()=>{
  assert.equal(validateCatalog({schemaVersion:1,sources:[base]}).length,1);
  assert.throws(()=>validateCatalog({schemaVersion:1,sources:[base,base]}));
  assert.throws(()=>validateCatalog({schemaVersion:1,sources:[{...base,url:'https://example.com/portal'}]}));
});
test('collection hashes original page, fetches each URL once and records failures',async()=>{
  const source={...candidate};
  const content='<h2>Dan Rogers</h2><p>Legislative District: Senate District 2</p>'+
    '<p>Q1: Why?</p><p>Because.</p><p>Q2: How?</p><p>With care.</p>';
  let calls=0;const saved:string[]=[];
  const fetcher=(async(url:string)=>{
    calls++;return {ok:true,url,headers:new Headers({'content-type':'text/html'}),
      arrayBuffer:async()=>new TextEncoder().encode(content).buffer,
    } as Response;
  }) as typeof fetch;
  const report=await collectQuestionnaires({sources:[source],delayMs:0,fetcher,
    onResponse:async x=>{saved.push(x.contentSha256);assert.ok(x.rawContent.includes('Legislative District'));}});
  assert.equal(report.responses,1);assert.equal(report.pairs,2);assert.equal(calls,1);
  assert.equal(saved[0],sha256(content));
  assert.ok(visibleLines('<script>secret</script><p>text</p>').includes('text'));
});

test('SNAP real linked WordPress metadata splits Minnesota from State Senate heading',()=>{
  const seed={...base,adapter:'snap' as const,
    url:'https://snapcoalition.org/initiatives/stance-on-science/candidates/mn/robyn-gulley'};
  const html='<main><p>Back to all Minnesota responses</p><h1>Robyn Gulley</h1><p>Democratic</p>'+
    '<a href="/state/mn">Minnesota</a><p>State Senate District 65</p>'+
    '<p>Submitted July 6, 2026</p>'+
    '<h4>Q1 Why support science?</h4><p>Trust in Science</p><p>Listen to experts.</p><p>KEYWORDS: A</p>'+
    '<h4>Q2 How protect water?</h4><p>Environment</p><p>Conserve clean water.</p><p>KEYWORDS: B</p></main>';
  const rows=parseResponses(html,seed);
  assert.equal(rows[0].candidateName,'Robyn Gulley');
  assert.equal(rows[0].district,'65');
  assert.equal(rows[0].party,'Democratic');
  assert.deepEqual(rows[0].qa.map(x=>x.answer),['Listen to experts.','Conserve clean water.']);
});
test('local 2026 original-publisher multi-candidate responses keep 6 long plus 10 short questions in order',()=>{
  const seed={...base,adapter:'wsp_reader' as const,district:'53',candidates:['Paul Cumings','Todd Podgorski'],
    url:'https://weststpaulreader.com/2026/09/18/2026-election-minnesota-senate-district-53/'};
  const html='<main><h1>2026 Election: Minnesota Senate District 53</h1><p>September 18, 2026</p>'+
    '<li>Paul Cumings – DFL – Candidate</li><li>Todd Podgorski – GOP – Candidate</li>'+
    '<h2>Candidate Questions</h2><h3>Priorities: What are your top priorities?</h3>'+
    '<p>Paul Cumings: People and schools.</p><p>Continuing this answer.</p>'+
    '<p>Todd Podgorski: Safer streets.</p>'+
    '<h3>Fraud: What should be done to stop fraud?</h3>'+
    '<p>Todd Podgorski: More audits.</p><p>Paul Cumings: Better oversight.</p>'+
    '<h2>Lightning Round</h2><h3>1. Do you have a library card?</h3>'+
    '<li>Paul Cumings: Yes.</li><li>Todd Podgorski: Not currently.</li>'+
    '<h2>More Information</h2></main>';
  const rows=parseResponses(html,seed);
  assert.equal(rows.length,2);
  assert.equal(rows[0].qa.length,3);
  assert.equal(rows[0].qa[0].answer,'People and schools.\nContinuing this answer.');
  assert.equal(rows[0].qa[2].question,'1. Do you have a library card?');
  assert.equal(rows[0].party,'DFL');
  assert.equal(rows[1].party,'GOP');
  assert.equal(rows[0].displayedPublicationOn,'2026-09-18');
});

test('MHP original response can print Senate District and Party below bold labels',()=>{
  const seed={...base,adapter:'mhp' as const,candidate:'Dan Rogers',district:'02',
    url:'https://mhponline.org/2026_questionnaire/dan-rogers/'};
  const html='<main><h2>Dan Rogers</h2><h4>Legislative District:</h4><p>Senate District 2</p>'+
    '<h4>Party:</h4><p>Democratic-Farmer-Labor Party</p>'+
    '<p>Q1: What would you fund?</p><i>Home construction.</i>'+
    '<p>Q2: How should the law change?</p><i>Improve permitting.</i></main>';
  const rows=parseResponses(html,seed);
  assert.equal(rows.length,1);
  assert.equal(rows[0].district,'2');
  assert.equal(rows[0].party,'Democratic-Farmer-Labor Party');
  assert.equal(rows[0].qa.length,2);
  assert.throws(()=>parseResponses(html.replace('Senate District 2','House District 2B'),seed));
});

test('MHP index metadata fallback requires named real question page, not form/House',()=>{
  const candidate={...base,adapter:'mhp' as const,candidate:'Dan Rogers',district:'02',
    url:'https://mhponline.org/2026_questionnaire/dan-rogers/'};
  const original='<h2>Dan Rogers</h2><p>Q1: Your first policy question?</p>'+
    '<i>Actual response.</i><p>Q2: Your second policy question?</p><i>Second response.</i>';
  const parsed=parseResponses(original,candidate);
  assert.equal(parsed[0].district,'2');
  assert.equal(parsed[0].qa.length,2);
  assert.throws(()=>parseResponses(original.replace('Dan Rogers','House Candidate'),candidate));
  assert.throws(()=>parseResponses(original.replace('Q1:','Form:'),candidate));
});

test('production guard accepts real 0021 additive DDL with FK ON DELETE but rejects DML',()=>{
  const sql=readFileSync('migrations/0021_mn_senate_questionnaire_raw.sql','utf8');
  assert.match(sql,/ON DELETE SET NULL/);
  assert.match(sql,/ON DELETE CASCADE/);
  assert.doesNotThrow(()=>assertAdditiveQuestionnaireMigration(sql));
  assert.throws(()=>assertAdditiveQuestionnaireMigration('DELETE FROM memberships;'));
  assert.throws(()=>assertAdditiveQuestionnaireMigration('CREATE TABLE kept(x integer); UPDATE forecasts SET status = null;'));
  assert.throws(()=>assertAdditiveQuestionnaireMigration('CREATE TABLE test(x integer); DROP TABLE memberships;'));
  assert.throws(()=>assertAdditiveQuestionnaireMigration('ALTER TABLE memberships DROP COLUMN party;'));
});

test('Roseville Reader Senate D40 stores exactly six full published answers per named candidate',()=>{
  const source={...base,adapter:'roseville_reader' as const,district:'40',cycle:2026,
    url:'https://www.rosevillereader.com/minnesota-senate-district-40-candidate-guide-2026/',
    candidates:['Rachel Japuntich','John Marty']};
  const questions=[
    'Why are you running for elected office?',
    'What are some of your legislative priorities for the next legislative session?',
    'How would you work to make life better for ordinary people living in the Roseville area?',
    'What are your priorities when it comes to public education?',
    'How do you plan to connect with residents in the Roseville area and their local city leaders to represent their unique interests at the state level?',
    'What else do you want voters in the Roseville area to know about you?',
  ];
  const blocks=(name:string)=>questions.map((q,i)=>'<h3>'+q+'</h3><blockquote><p>'+
    name+' published answer '+(i+1)+'</p><p>Second paragraph kept.</p></blockquote>').join('');
  const html='<article><h1>Minnesota Senate District 40 candidate guide</h1>'+
    '<time>01 Oct 2026 — 8 min read</time>'+
    '<h2>Rachel Japuntich</h2><p>Republican</p><p>Editorial campaign platform summary ignored.</p>'+
    blocks('Rachel')+
    '<h2>John Marty (incumbent)</h2><p>Democratic Farmer-Labor</p>'+
    blocks('Marty')+'<h2>Candidate Forum & Speakouts</h2><p>Not questionnaire text.</p></article>';
  const rows=parseResponses(html,source);
  assert.equal(rows.length,2);assert.equal(rows[0].qa.length,6);
  assert.equal(rows[0].qa[0].question,questions[0]);
  assert.equal(rows[0].qa[0].answer,'Rachel published answer 1\nSecond paragraph kept.');
  assert.equal(rows[0].displayedPublicationOn,'2026-10-01');
  assert.equal(rows[1].party,'Democratic Farmer-Labor');
  assert.equal(rows[1].qa[5].answer,'Marty published answer 6\nSecond paragraph kept.');
  assert.equal(rows[1].qa[5].answer.includes('Candidate Forum'),false);
});
test('Roseville Reader excludes explicitly named Senate candidate without respondent answers',()=>{
  const source={...base,adapter:'roseville_reader' as const,district:'66',
    url:'https://www.rosevillereader.com/minnesota-senate-district-66-candidate-guide/',
    candidates:['Kathleen Bart','Clare Oumou Verbeten']};
  const questions=[
    'Why are you running for elected office?',
    'What are some of your legislative priorities for the next legislative session?',
    'How would you work to make life better for ordinary people living in the Roseville area?',
    'What are your priorities when it comes to public education?',
    'How do you plan to connect with residents in the Roseville area and their local city leaders to represent their unique interests at the state level?',
    'What else do you want voters in the Roseville area to know about you?',
  ];
  const html='<h1>Minnesota Senate District 66 candidate guide</h1><h2>Kathleen Bart</h2>'+
    '<p>Republican</p><p>Bart did not respond to our invitation to participate in a candidate questionnaire.</p>'+
    '<h2>Clare Oumou Verbeten</h2><p>Democratic-Farmer-Labor</p>'+
    questions.map((q,i)=>'<h3>'+q+'</h3><blockquote>Original answer '+i+'.</blockquote>').join('')+
    '<h2>Candidate Forum</h2>';
  const got=parseResponses(html,source);
  assert.equal(got.length,1);assert.equal(got[0].candidateName,'Clare Oumou Verbeten');
  assert.equal(got[0].qa.length,6);
});
test('MN Right to Life 2026 original six question texts and raw candidate responses exclude House',()=>{
  const source={...base,adapter:'mnrtl' as const,
    url:'https://www.mnrtl.org/elections/',title:'2026 Primary Survey Results'};
  const questions=Array.from({length:6},(_,i)=>'<h3>Question '+(i+1)+'</h3>'+
    '<p>Publisher question number '+(i+1)+' described in full and asks about the relevant legislation.</p>');
  const row=(cells:string[])=>'<tr>'+cells.map(t=>'<td>'+t+'</td>').join('')+'</tr>';
  const candidate=(office:string)=>[
    '75430','2,026','Legislative','35','20 Jun 2026 04:02 AM',
    'Bill','Lieske','Republican','58',office,
    'Co-Sponsor,Sponsor','Yes','No','Co-Sponsor','Yes','No',
    'Free text supplied in separate Q7 column','View survey',
  ];
  const html='<h1>2026 Primary Survey Results</h1>'+
    questions.join('')+'<p>Scroll to the right to see all the results.</p>'+
    '<table><tbody>'+row(candidate('Minnesota House'))+
    row(candidate('Minnesota Senate'))+'</tbody></table>';
  const got=parseResponses(html,source);
  assert.equal(got.length,1);
  assert.equal(got[0].candidateName,'Bill Lieske');
  assert.equal(got[0].district,'58');
  assert.equal(got[0].displayedSubmittedOn,'2026-06-20');
  assert.equal(got[0].qa.length,6);
  assert.equal(got[0].qa[0].answer,'Co-Sponsor,Sponsor');
  assert.ok(got[0].qa[0].question.includes('Publisher question number 1'));
  assert.equal(got[0].qa.some(x=>x.answer.includes('Free text supplied')),false);
});

test('raw storage is idempotent for identical published Q&A despite volatile page HTML',async()=>{
  const candidate:CandidateResponse={
    sourceId:'test',publisher:'Test Publisher',sourceKind:'publisher_response',
    sourceUrl:'https://example.invalid/actual-candidate-answers',electionCycle:2026,
    title:'2026 Senate questionnaire',candidateName:'Actual Candidate',
    office:'Minnesota State Senate',district:'3',party:'DFL',
    displayedPublicationOn:'2026-08-01',displayedSubmittedOn:null,
    archiveCapturedAt:null,fetchedAt:'2026-10-16T00:00:00.000Z',
    contentType:'text/html',contentSha256:'a'.repeat(64),rawContent:'<h1>original page</h1>',
    qa:[{ordinal:1,question:'Question one?',answer:'Answer one'},
      {ordinal:2,question:'Question two?',answer:'Answer two'}],
  };
  const knownQa=JSON.stringify(candidate.qa.map(q=>[q.ordinal,q.question,q.answer]));
  const statements:string[]=[];
  let inserts=0,answerRows=0,resolverCalls=0;
  const client={query:async(sql:string,params?:unknown[])=>{
    statements.push(sql);
    if(sql.includes('SELECT c.id FROM mn_senate_questionnaire_captures c')){
      assert.equal(params?.[11]===knownQa,true);
      assert.equal(params?.[8],candidate.displayedPublicationOn);
      assert.equal(params?.[10],null);
      return {rows:[{id:'old-capture'}]};
    }
    if(sql.includes('FROM memberships m'))resolverCalls++;
    if(sql.startsWith('INSERT INTO mn_senate_questionnaire_captures'))inserts++;
    if(sql.startsWith('INSERT INTO mn_senate_questionnaire_qa'))answerRows++;
    return {rows:[]};
  }} as unknown as PoolClient;
  const secondPage={...candidate,rawContent:'<h1>same answers, different banner</h1>',contentSha256:'b'.repeat(64)};
  const result=await insertQuestionnaire(client,secondPage);
  assert.equal(result.inserted,false);
  assert.equal(inserts,0);assert.equal(answerRows,0);assert.equal(resolverCalls,0);
  assert.equal(statements[0],'BEGIN');
  assert.ok(statements.some(s=>s.includes('pg_advisory_xact_lock')));
  assert.equal(statements.at(-1),'COMMIT');
});

test('actual changed published answer appends raw capture and all Q&A in order',async()=>{
  const item:CandidateResponse={
    sourceId:'test',publisher:'Test',sourceKind:'publisher_response',
    sourceUrl:'https://example.invalid/real-questionnaire',electionCycle:2026,
    title:'Questionnaire',candidateName:'Unmatched Senate Challenger',
    office:'Minnesota State Senate',district:'9',party:null,
    displayedPublicationOn:null,displayedSubmittedOn:null,archiveCapturedAt:null,
    fetchedAt:'2026-10-16T00:00:00Z',contentType:'text/html',
    contentSha256:'c'.repeat(64),rawContent:'<h1>Published revised questionnaire</h1>',
    qa:[{ordinal:1,question:'Do you agree?',answer:'Revised answer'},
      {ordinal:2,question:'Why?',answer:'Fully quoted explanation'}],
  };
  const seen:string[]=[];const qaParams:unknown[][]=[];
  const client={query:async(sql:string,params?:unknown[])=>{
    seen.push(sql);
    if(sql.includes('FROM memberships m'))return {rows:[]};
    if(sql.startsWith('SELECT c.id FROM mn_senate_questionnaire_captures'))return {rows:[]};
    if(sql.startsWith('INSERT INTO mn_senate_questionnaire_captures'))return {rows:[{id:'new-capture'}]};
    if(sql.startsWith('INSERT INTO mn_senate_questionnaire_qa'))qaParams.push(params??[]);
    return {rows:[]};
  }} as unknown as PoolClient;
  const result=await insertQuestionnaire(client,item);
  assert.equal(result.inserted,true);assert.equal(result.matched,false);
  assert.deepEqual(qaParams,[
    ['new-capture',1,'Do you agree?','Revised answer'],
    ['new-capture',2,'Why?','Fully quoted explanation'],
  ]);
  assert.equal(seen.at(-1),'COMMIT');
});


test('2022 Star Tribune keeps only printed Senate candidate Q&A; article edits are not original submissions',()=>{
  const seed:QuestionnaireSource={id:'startribune-2022-duluth-senate',
    publisher:'Star Tribune',cycle:2022,adapter:'startribune_2022',
    url:'https://www.startribune.com/questions-on-candidates-heres-a-guide-to-duluth-area-elections/600219506',
    title:'2022 Duluth Senate',sourceKind:'publisher_response'};
  const html='<article><h1>Questions on candidates? Here’s a guide to Duluth area elections</h1>'+
    '<p>October 27, 2022 at 9:29AM</p><p>Answers were edited for length.</p>'+
    '<h2>Senate District 3</h2><h3>Grant Hauschild (DFL)</h3>'+
    '<p>Age: 33</p><p>Why are you running? To help our region.</p>'+
    '<p>Top three issues facing your district and plans to address them: Housing matters.</p>'+
    '<h2>Most Read</h2><p>Celebrity news</p><p>Getting our Fair Share for the Northland: More money for roads.</p>'+
    '<p>Website: https://example.org</p>'+
    '<h3>Andrea Zupancich (R)</h3><p>Why are you running? Employment.</p>'+
    '<p>Top three issues facing your district? Jobs and schools.</p>'+
    '<p>Plans to address those issues? Invest locally.</p>'+
    '<h2>State Senate District 8</h2><h3>Jen McEwen (incumbent, DFL)</h3>'+
    '<p>Why are you running? Continue representing Duluth.</p>'+
    '<p>Top three issues facing your district? Health care.</p>'+
    '<p>Plans to address those issues? Support reform.</p>'+
    '<h3>Alex Moe (R)</h3><p>Did not respond to questionnaire.</p>'+
    '<h2>State House District 3B</h2><h3>Mary Murphy (DFL)</h3>'+
    '<p>Why are you running? House response should be excluded.</p>';
  const rows=parseResponses(html,seed);
  assert.deepEqual(rows.map(r=>r.candidateName),['Grant Hauschild','Jen McEwen']);
  assert.equal(rows[0].qa.length,2);
  assert.equal(rows[0].qa[1].answer,'Housing matters.\nGetting our Fair Share for the Northland: More money for roads.');
  assert.equal(rows[1].district,'8');
  assert.equal(rows[0].displayedPublicationOn,'2022-10-27');
  assert.ok(rows.every(r=>r.qa.every(x=>!x.answer.includes('House response'))));
  assert.throws(()=>parseResponses(html.replace('Answers were edited for length.','No publisher edits disclosed.'),seed));
});

test('2024 MPR SD45 page is not mistaken for two complete published responses',()=>{
  const seed:QuestionnaireSource={...base,adapter:'mpr_special_2024',cycle:2024,district:'45',
    url:'https://www.mprnews.org/state-senate-district-45-general-election',
    candidates:['Ann Johnson Stewart','Kathleen Fowke']};
  assert.throws(()=>parseResponses('<h1>State Senate: District 45</h1>'+
    '<p>We asked candidates to respond to a three-question survey.</p>'+
    '<p>Ann Johnson Stewart</p><p>Kathleen Fowke</p>',seed));
});

test('2025 SD60 DFL original PDF extractor fails closed without named candidate and real numbered answers',()=>{
  const seed:QuestionnaireSource={...base,adapter:'sd60_pdf',cycle:2025,
    candidate:'Doron Clark',party:'DFL',district:'60',
    url:'https://drive.google.com/file/d/1pbX-cHOKJFfMT4roJDXx-cNUdPs_-G46/view'};
  const printed='Senate District 60 DFL Endorsement Questionnaire\nDoron Clark\n'+
    '1. Why are you seeking this office?\nBecause I care about my community.\n'+
    '2. What are your priorities?\nSchools and transit.\n';
  const parsed=parseSd60PdfText(printed,seed);
  assert.equal(parsed.length,1);
  assert.deepEqual(parsed[0].qa.map(q=>q.answer),[
    'Because I care about my community.','Schools and transit.',
  ]);
  assert.equal(parsed[0].qa[0].question,'Why are you seeking this office?');
  assert.throws(()=>parseSd60PdfText(printed.replace('Doron Clark','Other Person'),seed));
  assert.throws(()=>parseSd60PdfText(printed.replace('2. What are your priorities?', 'Unnumbered introduction'),seed));
  assert.throws(()=>parseResponses(printed,seed));
});

test('2022 Senate questionnaires use 2023-2024 service roster, never 2021-2022 incumbents',async()=>{
  assert.equal(questionnaireServiceSession(2022),'2023-2024');
  assert.equal(questionnaireServiceSession(2024),'2023-2024');
  assert.equal(questionnaireServiceSession(2025),'2025-2026');
  assert.equal(questionnaireServiceSession(2026),'2025-2026');
  assert.equal(questionnaireServiceSession(2020),null);
  let serviceSession='';
  const pg={query:async(_sql:string,args:unknown[])=>{
    serviceSession=String(args[0]);
    return {rows:[
      {id:'member-a',legislator_id:'legislator-a',party:'DFL',
       name:'Grant Hauschild',district:'3',starts_on:null,ends_on:null,aliases:[]},
      {id:'member-b',legislator_id:'legislator-b',party:'R',
       name:'Andrea Zupancich',district:'3',starts_on:null,ends_on:null,aliases:[]},
    ]};
  }} as unknown as PoolClient;
  const found=await exactExistingSenateMembership(pg,{
    electionCycle:2022,candidateName:'Grant Hauschild',district:'03',party:'D',
  });
  assert.equal(serviceSession,'2023-2024');
  assert.deepEqual(found,{membershipId:'member-a',legislatorId:'legislator-a'});
  const outsider=await exactExistingSenateMembership(pg,{
    electionCycle:2022,candidateName:'Someone Else',district:'3',party:'DFL',
  });
  assert.deepEqual(outsider,{membershipId:null,legislatorId:null});
  assert.deepEqual(await exactExistingSenateMembership(pg,{
    electionCycle:2020,candidateName:'Grant Hauschild',district:'3',party:'DFL',
  }),{membershipId:null,legislatorId:null});
});

test('null-only candidate reconciliation updates uniquely matched incumbents, not challengers',async()=>{
  const calls:string[]=[];
  const pg={query:async(sql:string,args:unknown[]=[])=>{
    calls.push(sql);
    if(sql.startsWith('SELECT id,candidate_name,district,party,election_cycle'))
      return {rows:[
        {id:'snapshot-1',election_cycle:2022,candidate_name:'Grant Hauschild',district:'3',party:'DFL'},
        {id:'snapshot-2',election_cycle:2022,candidate_name:'Challenger Person',district:'3',party:'DFL'},
      ]};
    if(sql.startsWith('SELECT m.id,m.legislator_id,m.party'))
      return {rows:[{id:'member-a',legislator_id:'legislator-a',party:'DFL',
        name:'Grant Hauschild',district:'3',starts_on:null,ends_on:null,aliases:[]}]};
    if(sql.startsWith('UPDATE mn_senate_questionnaire_captures')){
      assert.deepEqual(args.slice(0,2),['member-a','legislator-a']);
      assert.match(sql,/membership_id IS NULL AND legislator_id IS NULL/);
      return {rowCount:1};
    }
    if(sql.startsWith('SELECT COUNT(*)::text'))
      return {rows:[{count:'1'}]};
    throw Error('Unexpected database query');
  }} as unknown as PoolClient;
  const report=await reconcileUnmatchedQuestionnaireMemberships(pg);
  assert.deepEqual(report,{scanned:2,linked:1,remaining:1,skippedHistoricalNonWinners:1});
  assert.equal(calls.filter(s=>s.startsWith('UPDATE mn_senate_questionnaire_captures')).length,1);
});


test('2026 Senate questionnaires accept every candidate without guessing November results',()=>{
  for(const candidate of ['Rachel Japuntich','Dan Rogers','Doron Clark','Candidate Not Yet Elected'])
    assert.equal(eligibleSenateQuestionnaireCandidate(2026,candidate,'40'),true);
  assert.equal(eligibleSenateQuestionnaireCandidate(2026,'Another Candidate',null),true);
});

test('2022, 2024 special and 2025 special questionnaires retain ONLY documented election winners',()=>{
  assert.equal(HISTORICAL_QUESTIONNAIRE_WINNERS.length,7);
  for(const winner of HISTORICAL_QUESTIONNAIRE_WINNERS){
    assert.equal(eligibleSenateQuestionnaireCandidate(winner.cycle,winner.candidate,winner.district),true);
    assert.match(winner.resultUrl,/^https:\/\/electionresults\.sos\.mn\.gov\//);
    assert.match(winner.electionDate,/^20\d{2}-\d{2}-\d{2}$/);
  }
  for(const [cycle,name,district] of [
    [2022,'Andrea Zupancich','3'],[2022,'Alex Moe','8'],
    [2022,'Kate Falvey','19'],[2022,'Bradley Drenckhahn','20'],
    [2022,'Ken Navitsky','25'],[2022,'Chris Brazelton','29'],
    [2024,'Kathleen Fowke','45'],
    [2025,'Monica Meyer','60'],[2025,'Peter Wagenius','60'],
    [2025,'Amal Karim','60'],[2025,'Emilio Cesar Rodriguez','60'],
  ] as const)
    assert.equal(eligibleSenateQuestionnaireCandidate(cycle,name,district),false);
  // Neither a prior primary vote total nor a same-name different-district race counts.
  assert.equal(eligibleSenateQuestionnaireCandidate(2022,'Grant Hauschild','8'),false);
  assert.equal(eligibleSenateQuestionnaireCandidate(2025,'Doron Clark','61'),false);
  assert.equal(eligibleSenateQuestionnaireCandidate(2024,'Ann Johnson Stewart',null),false);
  assert.equal(eligibleSenateQuestionnaireCandidate(2020,'Bill Weber','22'),false);
  assert.equal(eligibleSenateQuestionnaireCandidate(2027,'Candidate','40'),false);
});

test('publisher collection skips completed-election nonwinners before persistence or Q&A counts',async()=>{
  const seed:QuestionnaireSource={id:'local2022',publisher:'Original 2022 News',
    cycle:2022,adapter:'biofuels',url:'https://mnbiofuels.org/example-2022-respondents',
    title:'Questionnaire',sourceKind:'publisher_response',
    candidates:['Ken Navitsky','Bill Weber']};
  const html='<h1>Original publisher</h1>'+
    '<h3>Ken Navitsky (R) District 25</h3>'+
    '<p>Q. What is one proposal?</p><p>A. A proposal.</p>'+
    '<p>Q. Why propose it?</p><p>A. My reasons.</p>'+
    '<h3>Bill Weber (R) District 21</h3>'+
    '<p>Q. What is one proposal?</p><p>A. A different proposal.</p>'+
    '<p>Q. Why propose it?</p><p>A. My own reasons.</p>';
  const seen:string[]=[];
  const fetcher=(async(url:string)=>({ok:true,url,headers:new Headers({'content-type':'text/html'}),
    arrayBuffer:async()=>new TextEncoder().encode(html).buffer})) as typeof fetch;
  const report=await collectQuestionnaires({sources:[seed],delayMs:0,fetcher,
    onResponse:async x=>{seen.push(x.candidateName);}});
  assert.deepEqual(seen,['Bill Weber']);
  assert.equal(report.skippedHistoricalNonWinners,1);
  assert.equal(report.responses,1);
  assert.equal(report.pairs,2);
});

test('DB-level historical loser insertion rejects before opening any transaction',async()=>{
  const item:CandidateResponse={
    sourceId:'loser-2024',publisher:'MPR',sourceKind:'publisher_response',
    sourceUrl:'https://www.mprnews.org/state-senate-district-45-general-election',
    electionCycle:2024,title:'Senate District 45',candidateName:'Kathleen Fowke',
    office:'Minnesota State Senate',district:'45',party:'R',
    displayedPublicationOn:null,displayedSubmittedOn:null,archiveCapturedAt:null,
    fetchedAt:'2026-10-16T12:00:00Z',contentType:'text/html',
    contentSha256:'a'.repeat(64),rawContent:'<p>Raw original answer.</p>',
    qa:[{ordinal:1,question:'What?',answer:'My answer.'}],
  };
  let queries=0;
  const mock={query:async()=>{queries++;throw Error('No database writes allowed');}} as unknown as PoolClient;
  await assert.rejects(()=>insertQuestionnaire(mock,item),/historical election-winner scope/);
  assert.equal(queries,0);
});

test('legacy historical loser snapshots remain immutable but excluded from useful scope readback',async()=>{
  const mock={query:async()=>({rows:[
    {cycle:2026,candidate_name:'New 2026 Candidate',district:'1',captures:'3',pairs:'12'},
    {cycle:2022,candidate_name:'Grant Hauschild',district:'3',captures:'2',pairs:'10'},
    {cycle:2022,candidate_name:'Ken Navitsky',district:'25',captures:'2',pairs:'10'},
    {cycle:2024,candidate_name:'Ann Johnson Stewart',district:'45',captures:'1',pairs:'5'},
    {cycle:2025,candidate_name:'Monica Meyer',district:'60',captures:'1',pairs:'5'},
  ]})} as unknown as PoolClient;
  assert.deepEqual(await questionnaireEligibleScopeReadback(mock),{
    includedCaptures:6,includedQas:27,included2026Captures:3,
    includedHistoricalWinnerCaptures:3,
    legacyHistoricalExcludedCaptures:3,legacyHistoricalExcludedQas:15,
  });
});


test('historical source catalog rejects defeated candidates before HTTP fetch',()=>{
  const winner:QuestionnaireSource={...base,id:'sd60-winning-pdf',
    cycle:2025,adapter:'sd60_pdf',
    url:'https://drive.google.com/file/d/1pbX-cHOKJFfMT4roJDXx-cNUdPs_-G46/view',
    candidate:'Doron Clark',district:'60',party:'DFL'};
  const loser={...winner,id:'sd60-nonwinning-pdf',candidate:'Monica Meyer',
    url:'https://drive.google.com/file/d/1YgHwGlXg4coatqA211Nhhbl-q_gzO3Mu/view'};
  assert.equal(validateCatalog({schemaVersion:1,sources:[winner]}).length,1);
  assert.throws(()=>validateCatalog({schemaVersion:1,sources:[loser]}),/unconfirmed election loser/);
  const two:QuestionnaireSource={...base,id:'st-2022',cycle:2022,
    adapter:'startribune_2022',
    url:'https://www.startribune.com/questions-on-candidates-heres-a-guide-to-duluth-area-elections/600219506',
    candidates:['Grant Hauschild','Jen McEwen']};
  assert.equal(validateCatalog({schemaVersion:1,sources:[two]}).length,1);
  assert.throws(()=>validateCatalog({schemaVersion:1,
    sources:[{...two,candidates:['Grant Hauschild','Andrea Zupancich']}]}),/unconfirmed election loser/);
});
