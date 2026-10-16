import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizedBill, parseAgendaAttachments, parseAgendaWitnesses, parseWitnesses, statedPosition,
  senateSqlSafeText, senateSqlSafeRecord, decodeSenateRawStorageText,
} from '../src/sources/minnesota/senate-committee-testimony.js';

test('raw Senate agenda collection keeps actual attachment URLs and bill context', () => {
  const agenda = [
    {
      title: 'S.F. 4628',
      item: 'Information technology modernization',
      attachments: [
        { name: '20260423_SF4628_Coalition_Testimony.pdf', url: 'https://assets.senate.mn/committees/2025-2026/3140/20260423_SF4628_Coalition_Testimony.pdf' },
        { name: 'scs4628a-1.pdf', url: 'https://assets.senate.mn/committees/2025-2026/3140/scs4628a-1.pdf' },
      ],
    },
  ];
  const files = parseAgendaAttachments(agenda);
  assert.equal(files.length, 2);
  assert.equal(files[0].billIdentifier, 'SF4628');
  assert.equal(files[0].name, '20260423_SF4628_Coalition_Testimony.pdf');
});

test('PDF agenda testifier headings extract only named witnesses, not committee officers', () => {
  const text = `Chair
Senator Nick Frentz
Minnesota Senate Energy Committee
Monday, January 23rd, 2023
1. Call to Order
2. Testimony on SF 4 (Electric utility standard obligations)
Testifiers:
• Commissioner Grace Arnold, Department of Commerce
• Adam Duininck, Director of Government Affairs, North Central States Regional Council of Carpenters
Remote Testifiers:
• Stacey Dahl, Senior Manager External Affairs, Minnkota Power Cooperative
3. Adjournment`;
  const names = parseWitnesses(text).map((row) => row.name);
  assert.deepEqual(names, ['Grace Arnold', 'Adam Duininck', 'Stacey Dahl']);
  assert.equal(parseWitnesses(text)[0].billIdentifier, 'SF4');
  assert.equal(parseWitnesses(text)[0].organization, 'Department of Commerce');
});

test('agenda notes retain unnamed positions as null and link explicit testifiers', () => {
  const agenda = [{ title: 'S.F. 3854', description: 'Testifier: - Galen Benshoof, Enterprise Director, Employee Insurance' }];
  const rows = parseAgendaWitnesses(agenda);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Galen Benshoof');
  assert.equal(rows[0].position, null);
  assert.equal(rows[0].billIdentifier, 'SF3854');
  assert.equal(normalizedBill('S.F. 03854'), 'SF3854');
  assert.equal(statedPosition('Letter of Opposition to SF1120'), 'against');
  assert.equal(statedPosition('submitted without a stated view'), null);
});

test('Postgres-safe raw storage leaves normal Unicode untouched and encodes only SQL-hostile source text', () => {
  const ordinary = 'Normal Senate testimony 😊 with accent é';
  assert.equal(senateSqlSafeText(ordinary), ordinary);

  // PostgreSQL jsonb rejects escaped U+0000 and lone surrogates emitted by
  // some PDF text decoders; the source bytes must still be recoverable.
  const unusual = 'PDF heading' + String.fromCharCode(0) + 'next ' + String.fromCharCode(0xd800);
  const stored = senateSqlSafeText(unusual);
  assert.ok(stored?.startsWith('raw-utf16le-base64:'));
  assert.equal(decodeSenateRawStorageText(stored!), unusual);
  assert.equal(decodeSenateRawStorageText(ordinary), ordinary);

  const source = {
    recordKey: 'a'.repeat(64), session: '2023-2024', hearingId: 123,
    sourceType: 'document' as const, sourceUrl: 'https://assets.senate.mn/example.pdf',
    fetchedAt: '2026-10-16T00:00:00Z', hearingDate: '2024-03-06',
    sourceContentType: 'application/pdf', rawContent: unusual,
    rawContentUrl: 'https://assets.senate.mn/example.pdf', committee: 'Judiciary',
    billIdentifier: 'SF1', witnessName: null, organization: null,
    statedPosition: null, documentName: 'Agenda.pdf', documentKind: 'agenda' as const,
  };
  const converted = senateSqlSafeRecord(source);
  assert.equal(converted.recordKey, source.recordKey);
  assert.equal(converted.sourceUrl, source.sourceUrl);
  assert.equal(converted.hearingDate, source.hearingDate);
  assert.equal(decodeSenateRawStorageText(converted.rawContent!), unusual);
  assert.equal(source.rawContent, unusual);
});
