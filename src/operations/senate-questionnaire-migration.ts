/**
 * Scope gate for additive, reviewed raw candidate questionnaire migrations.
 * FOREIGN KEY ON DELETE clauses declare referential behavior: they are not
 * DELETE DML statements and must not trip the destructive-SQL gate.
 */
export function assertAdditiveQuestionnaireMigration(sql:string):void {
  const uncommented=sql.replace(/--[^\n]*/g,'').trim();
  const statements=uncommented.split(';').map(x=>x.trim()).filter(Boolean);
  if(!statements.length
    ||!statements.every(s=>/^CREATE\s+(?:TABLE|INDEX)\s+/i.test(s)))
    throw Error('Migration may only CREATE TABLE or CREATE INDEX');
  const excludingForeignKeyClauses=uncommented.replace(
    /\bON\s+DELETE\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)\b/gi,'',
  );
  if(/\b(?:DROP|TRUNCATE|DELETE|UPDATE|ALTER|REVOKE|GRANT|COPY|EXECUTE)\b/i.test(
    excludingForeignKeyClauses,
  ))throw Error('Nonadditive SQL command forbidden');
}
