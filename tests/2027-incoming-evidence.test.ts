import test from 'node:test';
import assert from 'node:assert/strict';
import { selectIncomingMembers,matchingIncomingFilings,matchingIncomingHousing,parse2026HousingIndex,verifyHousingResponse,policyExcerpt,type IncomingMember } from '../src/evidence/2027-incoming-evidence.js';
const roster:IncomingMember[]=Array.from({length:201},(_,i)=>({seat:i<134?'house:'+(Math.floor(i/2)+1)+(i%2?'B':'A'):'senate:'+(i-133),lrlId:String(1000+i),name:i===0?'Alice Example':i===1?'Bob Example':'Member '+i,electionName:i===0?'Alice Example':i===1?'Robert Example':'Member '+i,party:'Fixture',basis:'fixture',sourceUrl:'https://www.lrl.mn.gov/legdb/fulldetail?ID='+(1000+i)}));
const prior94=new Set(roster.slice(2).map(x=>x.lrlId));
const prior93=new Set([...prior94,'1001']),prior92=new Set(prior94);
const targets=selectIncomingMembers(roster,{92:prior92,93:prior93,94:prior94});
test('incoming cohort uses exact stable identities and distinguishes recent returning members',()=>{
  assert.deepEqual(targets.map(t=>[t.name,t.service]),[['Alice Example','no_recent_service'],['Bob Example','returning']]);
  assert.throws(()=>selectIncomingMembers(roster,{92:prior92,93:prior93,94:new Set()}));
  assert.throws(()=>selectIncomingMembers([...roster.slice(1),roster[1]],{92:prior92,93:prior93,94:prior94}));
});
test('campaign filing match needs exact approved name, chamber, district and cycle',()=>{
  const f={candidateName:'Alice Example',chamber:'house' as const,district:'01A',website:'https://example.com/',filingDate:'6/2/2026'};
  assert.equal(matchingIncomingFilings(targets[0],[f,{...f,candidateName:'Alice Different'},{...f,filingDate:'6/2/2024'},{...f,district:'1B'}]).length,1);
  assert.equal(matchingIncomingFilings(targets[1],[{...f,candidateName:'Robert Example',district:'1B'}]).length,1);
});
test('housing index selects only explicitly linked and identity-matched candidates',()=>{
  const html='<table><tr><td><a href="/2026_questionnaire/alice/">Alice Example</a></td><td>House</td><td>Fixture</td><td>01A</td></tr><tr><td><a href="/2026_questionnaire/bob/">Bob Example</a></td><td>House</td><td>Fixture</td><td>2A</td></tr></table>';
  const links=parse2026HousingIndex(html,'https://mhponline.org/2026-candidate-housing-questionnaire/');
  const matched=matchingIncomingHousing(targets[0],links);
  assert.equal(matched.length,1);
  const rawContent='<h1>Alice Example</h1><p>Legislative District: House District 1A</p><p>Q1: What is your housing policy?</p><p>I support more affordable housing options.</p><p>Q2: How will you help renters?</p><p>I will work to increase housing availability.</p>';
  assert.equal(verifyHousingResponse({rawContent,text:'Alice Example housing questionnaire'},targets[0],matched[0]),2);
  assert.throws(()=>verifyHousingResponse({rawContent:rawContent.replace('1A','1B'),text:'Alice Example'},targets[0],matched[0]));
  assert.throws(()=>verifyHousingResponse({rawContent,text:'Different Candidate'},targets[0],matched[0]));
});
test('public report only includes bounded policy excerpts, never contact or donation text',()=>{
  assert.equal(policyExcerpt({text:'Donate $50 to support education. I support more affordable housing and access to public transportation.'}),'I support more affordable housing and access to public transportation.');
  assert.equal(policyExcerpt({text:'Contact us to support schools by email at info@example.com.'}),undefined);
});
