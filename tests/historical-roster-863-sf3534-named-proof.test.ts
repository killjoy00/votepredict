import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
 SF3534_863_SQL,SF3534_863_SOURCE_URL,SF3534_863_SOURCE_PDF_SHA256,
 validateSF3534_863Static,matchSF3534OriginalVoters,
} from '../src/evaluation/historical-roster-863-sf3534-named-proof.js';
import {
 readProtectedSF3534,assertProtectedSF3534,
} from '../scripts/audit-historical-roster-863-sf3534-named-readonly.js';

test('one fixed original source, exact 2024 date and bounded immutable SELECT',()=>{
 assert.equal(validateSF3534_863Static(),true);
 assert.ok(SF3534_863_SQL.startsWith('SELECT '));
 assert.ok(SF3534_863_SQL.endsWith(' LIMIT 101'));
 assert.equal(SF3534_863_SOURCE_PDF_SHA256.length,64);
 assert.ok(SF3534_863_SOURCE_URL.includes('/2024/jud/20240221/'));
});
test('one missing original YEA is established only with nine named-and-side matches',()=>{
 const official=Array.from({length:10},(_,i)=>({
  sourceName:'Senator-'+(i+1),
  choice:(i<6?'yea':'nay') as 'yea'|'nay',
 }));
 const stored=official.filter((_,i)=>i!==0).map(x=>({
  choice:x.choice,source_member_name:x.sourceName,legislator_name:null,
 }));
 const match=matchSF3534OriginalVoters(official,stored);
 assert.equal(match.exactMatches.length,9);
 assert.deepEqual(match.missingPublicSourceNames,['Senator-1']);
 assert.deepEqual(match.unmatchedOfficialVoteSides,['yea']);
 assert.equal(match.allMatching,true);
 // A visually similar but different surname does not silently map.
 const ambiguous=stored.map((x,i)=>i===0?{
  ...x,source_member_name:'Senator-999'}:x);
 const mismatch=matchSF3534OriginalVoters(official,ambiguous);
 assert.equal(mismatch.allMatching,false);
 assert.equal(mismatch.unmatchedStoredCount,1);
 assert.equal(mismatch.missingPublicSourceNames.length,2);
});
test('duplicated original identity is rejected',()=>{
 const official=Array.from({length:10},(_,i)=>({
  sourceName:'Test Person '+(i<2?1:i+1),
  choice:(i<6?'yea':'nay') as 'yea'|'nay',
 }));
 const stored=official.slice(1).map(x=>({
  choice:x.choice,source_member_name:x.sourceName,legislator_name:null,
 }));
 assert.throws(()=>matchSF3534OriginalVoters(official,stored),/nonunique/);
});
test('Neon identity check precedes bounded evidence query and always rolls back',async()=>{
 const calls:string[]=[];
 const fake={query:async(s:string)=>{
  calls.push(s);
  if(s.startsWith('SELECT current_database()'))return{rows:[
    {db:'wrong',role:'reader',ro:'on'},
  ]};
  return{rows:[]};
 }};
 await assert.rejects(()=>readProtectedSF3534(fake as
    Parameters<typeof readProtectedSF3534>[0],
    {database:'valid',role:'reader'},[]),/Unexpected identity/);
 assert.equal(calls.at(0),'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(calls.at(-1),'ROLLBACK');
 assert.ok(!calls.includes(SF3534_863_SQL));
 assert.throws(()=>assertProtectedSF3534({NODE_ENV:'test'}),/permission/);
});
test('no secret or PDF fetch in local preflight',()=>{
 const result=execFileSync(process.execPath,[
  '--import','tsx',
  'scripts/audit-historical-roster-863-sf3534-named-readonly.ts',
  '--preflight',
 ],{encoding:'utf8'});
 assert.match(result,/EXACT_ORIGINAL_PUBLIC_SOURCE_PREFLIGHT_OK/);
});
