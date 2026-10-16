import test from 'node:test';
import assert from 'node:assert/strict';
import type {AuditedOfficialSenateDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
import {combineOnlyActualSenatorsDated2022to2025CampaignSources} from
 '../../src/evidence/senate-six-served-person-dated-campaign-coverage.js';
const sourceUrl='https://www.lrl.mn.gov/legdb/senate_dir' as const;
function senators():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:sourceUrl,observedAt:'2026-10-10T23:26:10.121Z',
   sourceBytesSha256:'a'.repeat(64),sourceBytesLength:316000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Carla J. Nelson',officialNameRaw:'Nelson, Carla J.',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'24'}]},
   {officialName:'Ann M Johnson Stewart',officialNameRaw:'Johnson Stewart, Ann M',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2024,endsYear:null,district:'45'}]},
   {officialName:'Keri Heintzeman',officialNameRaw:'Keri Heintzeman',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2025,endsYear:null,district:'6'}]},
   {officialName:'Michael Holmstrom Jr',officialNameRaw:'Michael Holmstrom Jr',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2025,endsYear:null,district:'29'}]},
   {officialName:'Robert Kupec',officialNameRaw:'Kupec, Robert - "Rob"',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'4'}]},
   {officialName:'Michael E. Kreun',officialNameRaw:'Kreun, Michael E.',
    officialSourceUrl:sourceUrl,senateServiceTerms:[{startsYear:2023,endsYear:null,district:'32'}]},
  ],
 };
}
test('combined dated campaign issue report REQUIRES both authentic original Oct 2022 archived pages',()=>{
 assert.throws(()=>combineOnlyActualSenatorsDated2022to2025CampaignSources(senators(),{}),
  /unless both actual originals are byte-rechecked/);
 const x=Buffer.alloc(160204,97),y=Buffer.alloc(148019,98);
 assert.throws(()=>combineOnlyActualSenatorsDated2022to2025CampaignSources(senators(),{
  'carla-2022-page-a':x,'carla-2022-page-b':y,
 }),/Original historical campaign HTML SHA-256 mismatch/);
});
test('only actual Senate service, not a 2022 election win, makes a named source admissible',()=>{
 const x=senators();
 x.senators=x.senators.filter(p=>!p.officialName.includes('Nelson'));
 assert.throws(()=>combineOnlyActualSenatorsDated2022to2025CampaignSources(x,{}),
  /Cannot attach original 2022 campaign policy text/);
});
test('missing 2025 special senator is a failure; date-bound issue leads cannot silently exclude a valid senator',()=>{
 const x=senators();x.senators=x.senators.filter(p=>!p.officialName.includes('Holmstrom'));
 assert.throws(()=>combineOnlyActualSenatorsDated2022to2025CampaignSources(x,{}),
  /Senator-only source lead count changed/);
});
