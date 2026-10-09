/**
 * Minnesota Senate committee historical event-time convention.
 *
 * An official minute entry is dated to the open committee HEARING at which
 * its recorded vote/motion occurred. Under this explicitly selected historical
 * research convention, no independently reconstructed PDF-release date is
 * required before the dated meeting action is usable in LATER-day research.
 *
 * This is a DAY-level convention: the synthetic late-UTC timestamp is only
 * the storage encoding of the hearing date, NOT a claimed hearing clock time.
 * Never include same-day committee evidence in a date-only pre-vote forecast.
 * Individual YEA/NAY still requires an explicitly named roll-call record.
 */
export const SENATE_COMMITTEE_MEETING_TIMING_VERSION =
  'mn-senate-committee-meeting-date-v1' as const;

function exactHearingDate(value: string): string {
  if (typeof value !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(value)) {
    throw new Error('Senate committee meeting date must be YYYY-MM-DD');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid Senate committee hearing date');
  }
  return value;
}

export function senateCommitteeHearingTiming(meetingDate: string) {
  const date = exactHearingDate(meetingDate);
  return {
    // Store the evidence with the meeting's calendar date. The timestamp
    // intentionally carries NO intraday ordering information.
    publishedAt: date + 'T23:59:59.999Z',
    metadata: {
      timingPolicyVersion: SENATE_COMMITTEE_MEETING_TIMING_VERSION,
      meetingDateIsAvailability: true,
      eventOccurredOn: date,
      availableOn: date,
      availabilityProof: 'public_senate_committee_meeting',
      availabilityStatus: 'committee_event_at_open_hearing',
      dateGranularity: 'day',
      intradayOrderingProven: false,
      sameDayEligible: false,
      asOfEligible: true,
    } as const,
  };
}

/** Date-only convention: a meeting on the cutoff day is NEVER pre-cutoff. */
export function senateCommitteeHearingEligibleBefore(
  meetingDate: string,
  cutoffDateExclusive: string,
): boolean {
  return exactHearingDate(meetingDate) < exactHearingDate(cutoffDateExclusive);
}
