import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

test('historical Senate DFL archive migration is accepted by exact protected additive-only guard',()=>{
  const sql=readFileSync('migrations/0020_senate_raw_statement_archive_captures.sql','utf8');
  const executable=sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(executable,
    /\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i);
  assert.match(executable,/CREATE TABLE senate_raw_statement_archive_captures/);
  assert.match(executable,/REFERENCES senate_raw_statements\(source_url\)/);
  assert.match(executable,/CREATE INDEX senate_raw_statement_archive_captured_idx/);
  assert.doesNotMatch(executable,/\bON CONFLICT\b/i);
});
