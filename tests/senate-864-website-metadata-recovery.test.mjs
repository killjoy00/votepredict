import test from 'node:test';import assert from 'node:assert/strict';
import {recoveredWebsitePlan,normalizeSourceAliases} from '../src/evidence/senate-864-website-metadata-recovery.mjs';
test('explicit aliases and separately declared receipts recover 271 joins; preserve all existing 668',()=>{
 const p=recoveredWebsitePlan();assert.equal(p.added.length,271);assert.equal(p.current.ready.length,939);
 assert.equal(p.current.holdCounts.outside_served_senate_cohort,3);assert.equal(p.current.holdCounts.unresolved_official_person,undefined);
 assert.equal(p.current.holdCounts.missing_original_page_url,147);assert.equal(p.current.holdCounts.missing_original_page_sha,108);
});
test('conflicting explicit digests fail closed; filenames never become observation timestamps',()=>{
 assert.throws(()=>normalizeSourceAliases({cdxSha1Base32:'A',originalArchiveCdxSha1Base32:'B'}));
 const x=normalizeSourceAliases({file:'original-20220101010101.html'});assert.equal(x.originalArchiveCaptureAtUtc,undefined);
});
