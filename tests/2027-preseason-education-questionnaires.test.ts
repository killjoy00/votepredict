import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEducationTargets,validateEducationHeader,EDUCATION_KIND} from '../src/operations/2027-preseason-education-questionnaires.js';
import {selectApprovedArchiveBatch} from '../src/operations/2027-preseason-original-inventory.js';
const read=(s:string)=>readFileSync('docs/evaluation/source-proof/'+s,'utf8');
const roster=read('2027-preseason-roster-20261126.json'),pilot=JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json')),manifest=JSON.parse(read('2027-education-questionnaire-leads-20261127.json'));
test('32 publisher-indexed questionnaire links, two disjoint tranches, strict incoming identity',()=>{
 const p=buildEducationTargets(roster,pilot,manifest);
 assert.equal(p['education-1'].length,16);assert.equal(p['education-2'].length,16);
 const all=Object.values(p).flat();
 assert.equal(new Set(all.map(x=>x.url)).size,32);
 assert.ok(all.every(x=>x.kind===EDUCATION_KIND));
 assert.equal(selectApprovedArchiveBatch('workflow_dispatch',{inputs:{archive_batch:'education-1'}}),'education-1');
 const invalid=structuredClone(manifest);invalid.sources[0].seat='house:4A';assert.throws(()=>buildEducationTargets(roster,pilot,invalid));
 invalid.sources[0]=structuredClone(manifest.sources[0]);invalid.sources[0].url='https://www.edmnvotes.org/other.pdf';assert.throws(()=>buildEducationTargets(roster,pilot,invalid));
});
test('first-page identity, year and chamber/seat must agree; no answer parsing or endorsement inference',()=>{
 const p=Object.values(buildEducationTargets(roster,pilot,manifest)).flat().find(t=>t.lrlId==='15656')!;
 const text='Aaron Schweiger\nDFL 2026 Minnesota Legislative Screening\nCandidate for Minnesota House District 03B\nYes/No questions\nQ1.';
 assert.equal(validateEducationHeader(text,p),true);
 for(const bad of [text.replace('03B','04A'),text.replace('Aaron Schweiger','Other Person'),text.replace('2026','2024'),text.replace('House','Senate')])assert.throws(()=>validateEducationHeader(bad,p));
});
