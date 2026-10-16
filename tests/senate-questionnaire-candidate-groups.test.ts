import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {QuestionnaireSource} from '../src/sources/minnesota/senate-questionnaire-raw.js';
import {parseEducationMinnesotaPdfPages,validExtractedUtf8} from '../src/sources/minnesota/senate-questionnaire-edmn-pdf.js';
import {groupQuestionnaireCandidates,senateQuestionnaireCandidateKey,
  type CandidateCaptureIdentity} from '../src/operations/senate-questionnaire-candidate-groups.js';
const source:QuestionnaireSource={
  id:'edmn-2026-sd02',publisher:'Education Minnesota',cycle:2026,
  adapter:'edmn_pdf',url:'https://www.edmnvotes.org/wp-content/uploads/2026/07/02-Dan-Rogers.pdf',
  title:'2026 Minnesota Legislative Screening',sourceKind:'publisher_response',
  candidate:'Dan R. Rogers',district:'02',party:'DFL',
};
const marker='Dan Rogers\nDFL 2026 Minnesota Legislative Screening\n';
const footer='\nDan Rogers 02\nSenate';
const yn=(start:number,count:number)=>
  Array.from({length:count},(_,i)=>((i+start)%3===0?'No':'Yes')+
    '\nQ'+(i+start)+'. Will you support the published policy question '+(i+start)+'?')
    .join('\n');
const first=marker+'Candidate for Minnesota Senate District 20\nJun 24, 2026\nYes/No questions\n'+yn(1,7)+footer;
const second=marker+'Do you support the following education funding priorities?\n'+
  ['a','b','c','d','e','f','h','g'].map(i=>'Yes\nQ8'+i+'. Fully fund this education item '+i+'?').join('\n')+footer;
const third=marker+[9,11,12,13,14,17,18].map(n=>'Yes\nQ'+n+'. Will you support published policy '+n+'?').join('\n')+footer;
const fourth=marker+yn(19,4)+footer;
const story=(answer:string,q:string)=>marker+answer+'\n'+q+footer;
const pages=[first,second,third,fourth,
  story('My experience at the local school is relevant.','Q1a. If yes: Which one? What did you learn?'),
  story('I support raising revenue fairly.','Q10. How would you raise state revenues for schools?'),
  story('Testing should inform decisions rather than determine them.','Q15. How should standardized scores be used?'),
  story('Libraries must be open to diverse books.','Q16. How will you preserve the freedom to read?'),
  marker+'Q27. How should schools recover from recent harms?\nListen to affected teachers and students.'+footer];
test('Education Minnesota original PDF preserves printed mixed answer ordering and date',()=>{
  const rows=parseEducationMinnesotaPdfPages(pages,source);
  assert.equal(rows.length,1);
  assert.equal(rows[0].candidateName,'Dan Rogers');
  assert.equal(rows[0].district,'2');
  assert.equal(rows[0].displayedSubmittedOn,'2026-06-24');
  assert.equal(rows[0].qa[0].question,'Q1. Will you support the published policy question 1?');
  assert.equal(rows[0].qa[0].answer,'Yes');
  assert.equal(rows[0].qa[2].answer,'No');
  assert.deepEqual(rows[0].qa.slice(7,15).map(q=>q.question.slice(0,4)),
    ['Q8a.','Q8b.','Q8c.','Q8d.','Q8e.','Q8f.','Q8h.','Q8g.']);
  assert.ok(rows[0].qa.some(x=>x.question.startsWith('Q10.')&&x.answer==='I support raising revenue fairly.'));
  assert.ok(rows[0].qa.some(x=>x.question.startsWith('Q27.')&&x.answer==='Listen to affected teachers and students.'));
  assert.ok(rows[0].qa.every((q,i)=>q.ordinal===i+1));
});
test('Education PDFs fail closed for mismatched candidates and districts',()=>{
  assert.throws(()=>parseEducationMinnesotaPdfPages(pages,{...source,candidate:'Another Senator'}));
  assert.throws(()=>parseEducationMinnesotaPdfPages(pages,{...source,district:'03'}));
  assert.throws(()=>parseEducationMinnesotaPdfPages(pages,{...source,cycle:2022}));
  assert.throws(()=>parseEducationMinnesotaPdfPages(
    pages.map((p,i)=>i===0?p.replace('Candidate for Minnesota Senate District 20','Candidate for U.S. Senate'):p),source));
  assert.throws(()=>parseEducationMinnesotaPdfPages([first,'',second],source));
  assert.throws(()=>parseEducationMinnesotaPdfPages(pages.map(p=>p.replace(/Yes\nQ/g,'\nQ').replace(/No\nQ/g,'\nQ')),source));
});
function cap(id:string,patch:Partial<CandidateCaptureIdentity>={}):CandidateCaptureIdentity{
  return {id,election_cycle:2026,candidate_name:'Dan Rogers',district:'2',party:'DFL',
    publisher:'KAXE',source_url:'https://www.kaxe.org/example',membership_id:null,
    legislator_id:null,...patch};
}
test('same 2026 candidate groups across published sources without pretending a challenger won',()=>{
  const groups=groupQuestionnaireCandidates([
    cap('kaxe'),cap('snap',{publisher:'SNAP',source_url:'https://snapcoalition.org/example'}),
    cap('edmn',{candidate_name:'Dan R. Rogers',district:'02',publisher:'Education Minnesota',
      source_url:source.url}),
    cap('elsewhere',{district:'3',publisher:'KAXE'}),
    cap('unknown-district',{district:null,publisher:'Other'}),
  ]);
  const shared=groups.find(g=>g.key==='mn-senate:2026:2:dan rogers');
  assert.ok(shared);
  assert.deepEqual(shared.publishers,['Education Minnesota','KAXE','SNAP']);
  assert.equal(shared.captures.length,3);
  assert.equal(shared.state,'candidate_only');
  assert.equal(shared.membershipId,null);
  assert.equal(groups.length,3);
  assert.equal(groups.find(g=>g.state==='missing_district')?.captures[0],'unknown-district');
});
test('conflicting party or member IDs never silently join; historical losers omitted',()=>{
  const parties=groupQuestionnaireCandidates([cap('dfl'),cap('rep',{party:'Republican'})]);
  assert.equal(parties.length,2);
  assert.ok(parties.every(g=>g.state==='conflicting_party'));
  const ids=groupQuestionnaireCandidates([
    cap('a',{membership_id:'member-a',legislator_id:'leg-a'}),
    cap('b',{membership_id:'member-b',legislator_id:'leg-b'}),
  ]);
  assert.equal(ids.length,2);
  assert.ok(ids.every(g=>g.state==='conflicting_membership'));
  const valid=groupQuestionnaireCandidates([
    cap('a',{membership_id:'member-a',legislator_id:'leg-a'}),
    cap('b',{publisher:'SNAP',membership_id:'member-a',legislator_id:'leg-a'}),
    cap('loser',{election_cycle:2022,candidate_name:'Defeated Candidate',district:'21'}),
  ]);
  assert.equal(valid.length,1);
  assert.equal(valid[0].state,'member_linked');
  assert.equal(senateQuestionnaireCandidateKey(cap('a',{district:null})),null);
});

test('original PDF raw Q&A extraction replaces ONLY non-storable Unicode scalars',()=>{
  assert.equal(validExtractedUtf8('alpha\\u0000beta'),'alpha\uFFFDbeta');
  assert.equal(validExtractedUtf8('alpha\\uD800beta'),'alpha\uFFFDbeta');
  assert.equal(validExtractedUtf8('Crème, São Paulo – 2026'),'Crème, São Paulo – 2026');
  const malformed=pages.map(p=>p.replace('I support raising revenue fairly.',
    'I support raising'+String.fromCharCode(0)+' revenue fairly.'));
  const parsed=parseEducationMinnesotaPdfPages(malformed,source);
  const q10=parsed[0].qa.find(x=>x.question.startsWith('Q10.'));
  assert.equal(q10?.answer,'I support raising\uFFFD revenue fairly.');
  assert.ok(!parsed[0].qa.some(q=>(q.question+q.answer).includes(String.fromCharCode(0))));
});
