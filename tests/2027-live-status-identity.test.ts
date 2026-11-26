import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLiveRevisorStatusIdentity } from '../src/operations/live-revisor-status.js';

test('2027 live status accepts matching complete bill XML and rejects wrong identity or scope', () => {
  const url = 'https://api.revisor.mn.gov/bills/v1/95/2027/0/HF/1/';
  const valid = '<?xml version="1.0"?><BILL><FILE_TYPE>HF</FILE_TYPE><FILE_NUMBER>1</FILE_NUMBER></BILL>';
  assert.doesNotThrow(() => validateLiveRevisorStatusIdentity('HF1',url,valid));
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url,valid.replace('>1<','>2<')), /does not identify/);
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url,valid.replace('>HF<','>SF<')), /does not identify/);
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url,valid.replace('</BILL>','')), /does not identify/);
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url.replace('/95/2027/','/94/2025/'),valid), /outside requested/);
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url.replace('/0/HF/','/1/HF/'),valid), /outside requested/);
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url.replace('api.revisor.mn.gov','example.org'),valid), /outside requested/);
  const priorVersion = valid.replace('</BILL>','<TEXT_VERSION_LIST><DOCUMENT><DOCUMENT_TYPE>official</DOCUMENT_TYPE><DOCUMENT_ENGROSSMENT>0</DOCUMENT_ENGROSSMENT><DOCUMENT_NAME>2025.0-HF0001-0</DOCUMENT_NAME></DOCUMENT></TEXT_VERSION_LIST></BILL>');
  assert.throws(() => validateLiveRevisorStatusIdentity('HF1',url,priorVersion), /official text version outside/);
});
