import test from 'node:test';
import assert from 'node:assert/strict';
import { billIdentifiersFromHouseAttachment,classifyHouseAttachment,parseHouseCommitteeArchiveAttachments,parseHouseCommitteeArchiveTotalPages } from '../src/evidence/house-committee-archive.js';

test('extracts bill identifiers from common House attachment names',()=>{
  assert.deepEqual(billIdentifiersFromHouseAttachment('HF0400 Letter of Support - MASBO.pdf'),['HF400']);
  assert.deepEqual(billIdentifiersFromHouseAttachment('H3388A1.pdf'),['HF3388']);
  assert.deepEqual(billIdentifiersFromHouseAttachment('HF 3901 Written Testimony.pdf'),['HF3901']);
});
test('classifies committee materials',()=>{
  assert.equal(classifyHouseAttachment('HF 3901 Written Testimony.pdf'),'testimony_handout');
  assert.equal(classifyHouseAttachment('Signed Minutes 3-5-26.pdf'),'minutes');
  assert.equal(classifyHouseAttachment('H4074A3 Roll Call.pdf'),'committee_rollcall');
  assert.equal(classifyHouseAttachment('HF0400 Summary.pdf'),'bill_summary');
});
test('parses dated archive attachment links',()=>{
  const html='<div>Attachments: <a href="/comm/docs/HF0400_Summary.pdf">HF0400 Summary.pdf</a> (3/4/2026)<br><a href="/comm/docs/H3388A1.pdf">H3388A1.pdf</a> (2/27/2026)</div>';
  const rows=parseHouseCommitteeArchiveAttachments(html,'https://www.house.mn.gov/Committees/archives/Page/1/LSYear/94');
  assert.equal(rows.length,2);
  assert.equal(rows[0].postedOn,'2026-02-27');
  assert.equal(rows[1].billIdentifiers[0],'HF400');
});
test('parses archive page count',()=>{
  assert.equal(parseHouseCommitteeArchiveTotalPages('Page Size: 20 Total Results: 850'),43);
});
