import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizedBill, parseAgendaAttachments, parseAgendaWitnesses, parseWitnesses, postgresSafeText, statedPosition,
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

test('NUL characters from PDF text are removed before PostgreSQL writes', () => {
  assert.equal(postgresSafeText('Jane\u0000 Doe\u0000'), 'Jane Doe');
  assert.equal(postgresSafeText(null), null);
  assert.equal(postgresSafeText('unchanged'), 'unchanged');
});
