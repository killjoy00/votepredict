import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRevisorProcessSourceFailure,
  MIN_REVISOR_PROCESS_RESEARCH_COVERAGE,
} from '../src/operations/revisor-process-source-policy.js';

test('permanent malformed Revisor documents are excludable', () => {
  const html = classifyRevisorProcessSourceFailure(
    new Error('Minnesota Revisor XML endpoint returned HTML (text/xml): https://api.revisor.mn.gov/example'),
  );
  assert.equal(html.permanent, true);
  assert.equal(html.reason, 'html_response');

  const unexpected = classifyRevisorProcessSourceFailure(
    new Error('Minnesota Revisor XML endpoint returned an unexpected document (text/plain): https://api.revisor.mn.gov/example'),
  );
  assert.equal(unexpected.permanent, true);
  assert.equal(unexpected.reason, 'unexpected_document');

  const missing = classifyRevisorProcessSourceFailure(
    new Error('Minnesota Revisor bill status returned 404: https://api.revisor.mn.gov/example'),
  );
  assert.equal(missing.permanent, true);
  assert.equal(missing.reason, 'not_found');
});

test('transient Revisor failures remain retryable rather than permanent exclusions', () => {
  for (const error of [
    new Error('Minnesota Revisor bill status returned 500: https://api.revisor.mn.gov/example'),
    new Error('fetch failed'),
    new Error('The operation was aborted due to timeout'),
  ]) {
    const policy = classifyRevisorProcessSourceFailure(error);
    assert.equal(policy.permanent, false);
    assert.equal(policy.reason, null);
  }
});

test('frozen research requires at least 99 percent usable process coverage', () => {
  assert.equal(MIN_REVISOR_PROCESS_RESEARCH_COVERAGE, 0.99);
});
