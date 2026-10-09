import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SENATE_COMMITTEE_MEETING_TIMING_VERSION,
  senateCommitteeHearingTiming,
  senateCommitteeHearingEligibleBefore,
} from '../src/evidence/senate-committee-meeting-timing.js';

test('named Senate committee roll call is dated to the open hearing, without a separate minutes-release gate', () => {
  const result = senateCommitteeHearingTiming('2022-02-23');
  assert.equal(result.publishedAt.slice(0, 10), '2022-02-23');
  assert.deepEqual(result.metadata, {
    timingPolicyVersion: SENATE_COMMITTEE_MEETING_TIMING_VERSION,
    meetingDateIsAvailability: true,
    eventOccurredOn: '2022-02-23',
    availableOn: '2022-02-23',
    availabilityProof: 'public_senate_committee_meeting',
    availabilityStatus: 'committee_event_at_open_hearing',
    dateGranularity: 'day',
    intradayOrderingProven: false,
    sameDayEligible: false,
    asOfEligible: true,
  });
});

test('date-exclusive pre-vote use excludes hearing day, but allows subsequent days', () => {
  assert.equal(senateCommitteeHearingEligibleBefore('2025-03-17', '2025-03-17'), false);
  assert.equal(senateCommitteeHearingEligibleBefore('2025-03-17', '2025-03-18'), true);
  assert.equal(senateCommitteeHearingEligibleBefore('2025-03-18', '2025-03-17'), false);
  assert.equal(senateCommitteeHearingEligibleBefore('2024-02-29', '2024-03-01'), true);
  assert.equal(senateCommitteeHearingTiming('2024-02-29').metadata.availableOn, '2024-02-29');
});

test('hearing-day policy rejects invalid and ambiguous dates', () => {
  for (const value of [
    '2025-02-29',
    '2024-02-30',
    '2025-2-09',
    '2025-01-01T12:00:00Z',
    '2025-13-01',
    'June 6, 2025',
    '',
  ]) {
    assert.throws(() => senateCommitteeHearingTiming(value), /meeting date|hearing date/i);
  }
});

test('hearing event dating does not assert an observed clock time', () => {
  const result = senateCommitteeHearingTiming('2023-05-01');
  assert.equal(result.publishedAt, '2023-05-01T23:59:59.999Z');
  assert.equal(result.metadata.dateGranularity, 'day');
  assert.equal(result.metadata.intradayOrderingProven, false);
  assert.equal(result.metadata.sameDayEligible, false);
});
