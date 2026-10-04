import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeTemporalEvidenceHistory, temporalEvidenceHistoryKey } from '../src/evidence/temporal-statement-history.js';

test('temporal statement history deduplicates identical recaptures within a series', () => {
  const rows = [
    { id:'new', evidence_kind:'direct_statement', stance:'supports', claim:'Strong support', evidence_series_key:'series-a' },
    { id:'old', evidence_kind:'direct_statement', stance:'supports', claim:'  Strong   support ', evidence_series_key:'series-a' },
  ];
  assert.deepEqual(dedupeTemporalEvidenceHistory(rows).map((row)=>row.id),['new']);
});

test('temporal statement history preserves substantive and stance changes', () => {
  const rows = [
    { id:'new', evidence_kind:'direct_statement', stance:'opposes', claim:'I now oppose the bill', evidence_series_key:'series-a' },
    { id:'old', evidence_kind:'direct_statement', stance:'supports', claim:'I strongly support the bill', evidence_series_key:'series-a' },
  ];
  assert.deepEqual(dedupeTemporalEvidenceHistory(rows).map((row)=>row.id),['new','old']);
  assert.notEqual(temporalEvidenceHistoryKey(rows[0]),temporalEvidenceHistoryKey(rows[1]));
});

test('independent statement items without a series key remain independent', () => {
  const rows = [
    { id:'a', evidence_kind:'related_statement', stance:'supports', claim:'Support', evidence_series_key:null },
    { id:'b', evidence_kind:'related_statement', stance:'supports', claim:'Support', evidence_series_key:null },
  ];
  assert.equal(dedupeTemporalEvidenceHistory(rows).length,2);
});
