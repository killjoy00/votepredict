import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  AUTHOR_HTML_RECOVERY_CASES,parseOfficialBillAuthorHtml,fetchOfficialHtmlForCase,
} from '../src/operations/senate-bill-authors-html-recovery.js';
import {RevisorPacer} from '../src/operations/senate-revisor-pacer.js';

const fixture=(input:{
  session?:string;legislature?:number;chamber?:'HF'|'SF';number?:number;
  authors?:string[];actionRows?:string[];
}={})=>{
  const session=input.session??'2025-2026',legislature=input.legislature??94;
  const chamber=input.chamber??'HF',number=input.number??1269;
  const ordinal=legislature===92?'nd':legislature===93?'rd':'th';
  const names=input.authors??['Reyer','Smith','Hansen, R.'];
  const row=input.actionRows??[
    '<tr><td>02/24/2025</td><td>Author added Smith pg. 414</td></tr>',
    '<tr><td>03/06/2025</td><td>Author added Hansen, R. pg. 592</td></tr>',
  ];
  return '<!DOCTYPE html><html><title>Official Minnesota Revisor Status</title>'+
    '<body>'+(' '.repeat(3200))+
    '<h1>'+chamber+' '+number+'</h1>'+
    '<h2>Status in the House - '+legislature+ordinal+' Legislature ('+
      session.replace('-', ' - ')+')</h2>'+
    '<h2>Description</h2><p>Only public source text is parsed</p>'+
    '<h2>Authors <span class="author_count">('+names.length+')</span></h2><div class="author"><ul>'+
    names.map(name=>'<li><a href="https://www.house.mn.gov/Members/Profile">'+name+'</a>;</li>').join('')+
    '</ul></div><h2>Actions</h2><h3>House</h3><table class="actions table">'+
    row.join('')+'</table></body></html>';
};
const hf=AUTHOR_HTML_RECOVERY_CASES.find(x=>x.identifier==='HF1269')!;
const sf=AUTHOR_HTML_RECOVERY_CASES.find(x=>x.identifier==='SF2042')!;

test('recovery list is exactly the frozen public 41, not a production collector',()=>{
  assert.equal(AUTHOR_HTML_RECOVERY_CASES.length,41);
  assert.equal(AUTHOR_HTML_RECOVERY_CASES.filter(x=>x.identifier.startsWith('HF')).length,31);
  assert.equal(AUTHOR_HTML_RECOVERY_CASES.filter(x=>x.lastHttp===500).length,25);
  assert.equal(AUTHOR_HTML_RECOVERY_CASES.filter(x=>x.lastHttp===200).length,16);
});
test('raw HTML preserves literal order, chief/coauthors and printed dates only',()=>{
  const parsed=parseOfficialBillAuthorHtml(fixture(),hf);
  assert.equal(parsed.declaredCount,3);
  assert.deepEqual(parsed.authors,[
    {nameRaw:'Reyer',role:'chief',authorOrder:1,addedOn:null,removedOn:null},
    {nameRaw:'Smith',role:'coauthor',authorOrder:2,addedOn:'2025-02-24',removedOn:null},
    {nameRaw:'Hansen, R.',role:'coauthor',authorOrder:3,addedOn:'2025-03-06',removedOn:null},
  ]);
  assert.equal(parsed.datedCurrentAuthors,2);
});
test('author names with punctuation and accents are not split or falsely dated',()=>{
  const html=fixture({authors:['Pérez-Vega','Johnson, P.','Anderson, P. E.'],
    actionRows:['<tr><td>03/12/2026</td><td>Authors added Johnson, P.; Anderson, P. E. pg. 4875</td></tr>',
      '<tr><td>03/18/2026</td><td>Author added Pérez-Vega pg. 5016</td></tr>']});
  const parsed=parseOfficialBillAuthorHtml(html,hf);
  assert.deepEqual(parsed.authors.map(x=>x.addedOn),
    ['2026-03-18','2026-03-12','2026-03-12']);
});
test('strictly rejects wrong bill, session and author count before any DB writes',()=>{
  assert.throws(()=>parseOfficialBillAuthorHtml(fixture({number:1268}),hf),
    /bill heading/);
  assert.throws(()=>parseOfficialBillAuthorHtml(fixture({session:'2023-2024'}),hf),
    /legislature/i);
  assert.throws(()=>parseOfficialBillAuthorHtml(
    fixture().replace('(3)</span>','(4)</span>'),hf),
    /do not match/);
  assert.throws(()=>parseOfficialBillAuthorHtml(
    fixture({authors:['Reyer','Reyer']}),hf),
    /repeated/);
  assert.throws(()=>parseOfficialBillAuthorHtml('<h1>HF 1269</h1>',hf),
    /Incomplete/);
});
test('current re-added author retains printed latest add date but not a stale removed state',()=>{
  const item=AUTHOR_HTML_RECOVERY_CASES.find(x=>x.identifier==='HF3605')!;
  const page=fixture({session:'2021-2022',legislature:92,chamber:'HF',number:3605,
    authors:['Rasmusson','Ecklund'],
    actionRows:[
      '<tr><td>04/24/2022</td><td>Author stricken Ecklund pg. 10987</td></tr>',
      '<tr><td>05/05/2022</td><td>Author added Ecklund pg. 13028</td></tr>',
    ]});
  const authors=parseOfficialBillAuthorHtml(page,item).authors;
  assert.equal(authors[1].addedOn,'2022-05-05');
  assert.equal(authors[1].removedOn,null);
});
test('two-year Senate 2025 bill correctly accepts only exactly matching official document',()=>{
  const page=fixture({chamber:'SF',number:2042,authors:['Hoffman','Abeler'],
    actionRows:['<tr><td>03/06/2025</td><td>Author added Abeler pg. 125</td></tr>']})
    .replace('Status in the House','Status in the Senate');
  const parsed=parseOfficialBillAuthorHtml(page,sf);
  assert.equal(parsed.authors[0].role,'chief');
  assert.equal(parsed.authors[1].addedOn,'2025-03-06');
});
test('public source fetch never accepts a redirect to a different bill',async()=>{
  const pacer=new RevisorPacer({intervalMs:1300,now:()=>0,sleep:async()=>{}});
  const page=fixture();
  const validUrl='https://www.revisor.mn.gov/bills/94/2025/0/HF/1269/';
  const response=(url:string):typeof fetch=>async()=>{
    const r=new Response(page,{status:200,headers:{'content-type':'text/html'}});
    Object.defineProperty(r,'url',{value:url});
    return r;
  };
  const received=await fetchOfficialHtmlForCase(hf,pacer,response(validUrl));
  assert.equal(received.sourceUrl,validUrl);
  assert.equal(received.parsed.authors.length,3);
  await assert.rejects(fetchOfficialHtmlForCase(hf,pacer,
    response('https://www.revisor.mn.gov/bills/94/2025/0/HF/1268/')),/different bill/);
  await assert.rejects(fetchOfficialHtmlForCase(hf,pacer,
    response('https://example.org/bills/94/2025/0/HF/1269/')),/untrusted host/);
});
test('one-shot recovery is bounded, independently protected and never schedules bulk collection',()=>{
  const w=readFileSync('.github/workflows/senate-bill-authors-41-recovery.yml','utf8');
  const s=readFileSync('scripts/recover-senate-bill-authors-41-neon.ts','utf8');
  assert.match(w,/needs\.independent-main\.result == 'success'/);
  assert.match(w,/environment: evidence-readonly-sandbox/);
  assert.match(w,/group: senate-bill-authors-production/);
  assert.doesNotMatch(w,/cron:|workflow_dispatch:/);
  assert.match(w,/contents: read/);
  assert.match(s,/SENATE_BILL_AUTHORS_41_HTML_RECOVERY/);
  assert.match(s,/REPEATABLE READ READ ONLY/);
  assert.match(s,/SERIALIZABLE READ WRITE/);
  assert.match(s,/expectedMigrations/);
  assert.match(s,/single_atomic_exact_41_transaction/);
  assert.match(s,/remaining_unscanned/);
  assert.doesNotMatch(w,/SENATE_BILL_AUTHORS_PRODUCTION/);
});
