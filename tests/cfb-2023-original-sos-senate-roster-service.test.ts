/** #864 2023 service identity original state Secretary of State only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
  SOS_2023_SENATE_ROSTER_PDF,
  select22Known2022SenatorsForOfficial2023Roster,
  inspectOriginal2023SosSenateRoster,
} from '../src/evidence/cfb-2023-official-sos-senate-roster-service.js';
const p='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const source71=readFileSync(p,'utf8');
const people=select22Known2022SenatorsForOfficial2023Roster(source71);
function mock(){
 return 'Introduction\nMEMBERS OF THE STATE SENATE\nMinnesota Senate Members – Alphabetically\nName (Party) District Office Phone\n'+
 people.map(p=>{
  const words=p.name.split(' ');
  return words.at(-1)+', '+words[0]+' (R) '+p.district+' 2207 651-555-1234';
 }).join('\n')+'\nMEMBERS OF THE HOUSE OF REPRESENTATIVES\n';
}
test('exact 71 authentic CFB source versions entail exactly 22 actual 2022-serving senator/registration identities',()=>{
 assert.equal(people.length,22);
 assert.equal(people[0]!.district,14);
 assert.equal(people.at(-1)!.district,36);
 assert.equal(new Set(people.map(x=>x.reg)).size,22);
 assert.equal(new Set(people.map(x=>x.district)).size,22);
 assert.ok(!people.some(x=>x.district===31));
 assert.equal(SOS_2023_SENATE_ROSTER_PDF,
 'https://www.sos.mn.gov/media/ybhkokxo/pocket-edition-2023.pdf');
 assert.throws(()=>select22Known2022SenatorsForOfficial2023Roster(
  source71.replace('Gary H. Dahms','Unknown Senator')),/changed/);
});
test('synthetic first and surname in Senate-only primary roster confirm independent district-and-name match',()=>{
 const actual=inspectOriginal2023SosSenateRoster({
   source71Psv:source71,originalSosExtractedPdfText:mock()});
 assert.equal(actual.exactOriginalSenateRosterSectionLocated,true);
 assert.equal(actual.rosterMemberLineCount,22);
 assert.equal(actual.independentlyMatched2023RosterMembers,22);
 assert.equal(actual.unmatched.length,0);
 assert.ok(actual.matches.every(x=>x.independentlyMatchedIn2023SenateRoster
  &&x.sourceRosterDistrict===x.district));
 assert.equal(actual.legallyOwedFinanceReportCount,null);
 assert.equal(actual.originalCfbPublicByCountProven,0);
 assert.equal(actual.actual2024ServiceNotProven,true);
});
test('an impostor Senate district or person cannot be counted as in-service just from existing CFB PDF',()=>{
 const wrong=mock().replace('Abeler, Jim (R) 35','Abeler, Jim (R) 45');
 const result=inspectOriginal2023SosSenateRoster({source71Psv:source71,
    originalSosExtractedPdfText:wrong});
 assert.equal(result.independentlyMatched2023RosterMembers,21);
 assert.equal(result.unmatched.length,1);
 assert.equal(result.unmatched[0]!.reg,'17868');
 assert.throws(()=>inspectOriginal2023SosSenateRoster({source71Psv:source71,
  originalSosExtractedPdfText:'Abeler, Jim 35'}),/Exactly one original PDF Senate member roster section required/);
});

test('permanent original SOS 2023 Senate member source ledger and source PDF identities are fingerprint pinned',async()=>{
 const {createHash}=await import('node:crypto');
 const P='docs/evaluation/source-proof/';
 const ck=JSON.parse(readFileSync(P+
   'cfb-2023-original-sos-senate-22-crossyear-service-source-checkpoint.json','utf8'));
 const data=readFileSync(ck.permanent2023RosterSourceProofLedger.path,'utf8');
 const git=createHash('sha1').update('blob '+Buffer.byteLength(data,'utf8')+'\0')
  .update(data).digest('hex');
 assert.equal(git,ck.permanent2023RosterSourceProofLedger.gitBlobSha);
 assert.equal(Buffer.byteLength(data,'utf8'),ck.permanent2023RosterSourceProofLedger.bytes);
 const lines=data.trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(lines.length,22);
 const known=new Map(people.map(x=>[x.reg,x]));
 for(const r of lines){
  assert.equal(r.length,13);
  const m=known.get(r[0]!);
  assert.ok(m);
  assert.equal(r[1],m.name);
  assert.equal(r[2],String(m.district));
  assert.match(r[3]!,/^[A-Z][a-z]+, /);
  assert.equal(r[4],'2023');
  assert.equal(r[6],SOS_2023_SENATE_ROSTER_PDF);
  assert.equal(r[7],ck.originalSourceDocument.originalPDFSHA256);
  assert.equal(Number(r[8]),ck.originalSourceDocument.pdfBytes);
  assert.equal(r[9],'official_source_name_district_matched');
  assert.equal(r[10],'2024_service_interval_unproven');
  assert.equal(r[11],'CFB_committee_duty_unproven');
  assert.equal(r[12],'historic_finance_pdf_public_by_unproven');
 }
 assert.equal(ck.originalSourceDocument.pdfBytes,5803052);
 assert.equal(ck.originalSourceDocument.original2023SenateMemberRows,67);
 assert.equal(ck.originalSourceRuns[0].originalCfb2022SenatorsMatchedInIndependent2023Roster,22);
 assert.equal(ck.scope.independent2023SenateRosterFor22ProofCount,22);
 assert.equal(ck.scope.original2023Or2024LegallyOwedYECommitteeCount,null);
 assert.equal(ck.scope.original2023Or2024HistoricalPublicByIndependentlyEstablishedCount,0);
 assert.equal(ck.safeguards.noProductionDbReadWrite,true);
});
