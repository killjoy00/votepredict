import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  sha256,visibleLines,mhpLinks,biofuelsLinks,parseResponses,
  validateCatalog,collectQuestionnaires,type QuestionnaireSource,
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
