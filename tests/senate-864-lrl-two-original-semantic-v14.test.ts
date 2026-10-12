import test from 'node:test';
import assert from 'node:assert/strict';
import type {AuditedOfficialSenateDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {canonicalLrl2024SenateServiceProjection} from
 '../src/evidence/senate-864-lrl-2024-service-semantic-v14.js';
import {acquireOriginalLrl2024SenateYearServiceSemanticV14} from
 '../src/evidence/senate-864-2024-lrl-year-service-directory-semantic-v14.js';

function synthetic():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:'2026-10-12T20:00:00.000Z',
   sourceBytesSha256:'0'.repeat(64),
   sourceBytesLength:1601232,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:Array.from({length:68},(_,index)=>({
   officialName:'Synthetic Member '+String(index+1).padStart(3,'0'),
   officialNameRaw:'Synthetic Member '+String(index+1).padStart(3,'0'),
   officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir' as const,
   senateServiceTerms:[{
    startsYear:2023,endsYear:null,
    district:String(index%67+1),
   }],
  })),
 };
}
test('V14 canonical 2024 name/term/district digest is row-order-independent',()=>{
 const before=synthetic();
 const a=canonicalLrl2024SenateServiceProjection(before);
 const reversed=synthetic();reversed.senators.reverse();
 const b=canonicalLrl2024SenateServiceProjection(reversed);
 assert.equal(a.named2024YearSenatePersons,68);
 assert.match(a.immutableServiceProjectionSha256,/^[0-9a-f]{64}$/);
 assert.equal(a.immutableServiceProjectionSha256,b.immutableServiceProjectionSha256);
 assert.equal(a.contemporary2024DirectoryPublicationProven,false);
 assert.equal(a.exactHearingDayServiceProven,false);
});
test('V14 same original service semantics withstand unrelated HTML original SHA drift',()=>{
 const a=synthetic();
 const b=synthetic();b.source.sourceBytesSha256='f'.repeat(64);
 b.source.sourceBytesLength+=42;
 assert.notEqual(a.source.sourceBytesSha256,b.source.sourceBytesSha256);
 assert.equal(canonicalLrl2024SenateServiceProjection(a).immutableServiceProjectionSha256,
  canonicalLrl2024SenateServiceProjection(b).immutableServiceProjectionSha256);
});
test('V14 changed actual 2024 serving name or term changes the canonical digest',()=>{
 const original=synthetic();
 const changedTerm=synthetic();changedTerm.senators[0]!.senateServiceTerms[0]!.district='33';
 const changedName=synthetic();changedName.senators[0]!.officialName='Different Public Senate Member';
 const digest=canonicalLrl2024SenateServiceProjection(original).immutableServiceProjectionSha256;
 assert.notEqual(canonicalLrl2024SenateServiceProjection(changedTerm).immutableServiceProjectionSha256,digest);
 assert.notEqual(canonicalLrl2024SenateServiceProjection(changedName).immutableServiceProjectionSha256,digest);
});
test('V14 duplicates, missing original source provenance, malformed service term fail closed',()=>{
 const dup=synthetic();dup.senators[1]!.officialName=dup.senators[0]!.officialName;
 assert.throws(()=>canonicalLrl2024SenateServiceProjection(dup));
 const falseYear=synthetic();falseYear.source.originalHistoricDateForDisplayedDirectoryEstablished=true;
 assert.throws(()=>canonicalLrl2024SenateServiceProjection(falseYear));
 const badTerm=synthetic();badTerm.senators[1]!.senateServiceTerms[0]!.district='700';
 assert.throws(()=>canonicalLrl2024SenateServiceProjection(badTerm));
});
test('V14 original live fetch boundary refuses arbitrary hash, unavailable source, redirect or incomplete body',async()=>{
 await assert.rejects(acquireOriginalLrl2024SenateYearServiceSemanticV14('bad digest'));
 const unavailable=(async()=>new Response('',{status:404,headers:{'content-type':'text/html'}})) as typeof fetch;
 await assert.rejects(acquireOriginalLrl2024SenateYearServiceSemanticV14(undefined,unavailable));
 const absent=(async()=>new Response('',{status:200,headers:{'content-type':'text/html'}})) as typeof fetch;
 await assert.rejects(acquireOriginalLrl2024SenateYearServiceSemanticV14(undefined,absent));
});
