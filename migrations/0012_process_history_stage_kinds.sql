ALTER TABLE legislative_stage_events
  DROP CONSTRAINT legislative_stage_events_stage_kind_check;

ALTER TABLE legislative_stage_events
  ADD CONSTRAINT legislative_stage_events_stage_kind_check CHECK (stage_kind IN (
    'introduced',
    'committee_hearing',
    'committee_passage',
    'calendar_placement',
    'house_floor_passage',
    'senate_floor_passage',
    'identical_text_adoption',
    'conference_report_adoption',
    'governor_signature',
    'veto',
    'enactment',
    'session_expiration',
    'committee_referral',
    'committee_report',
    'second_reading',
    'floor_scheduled',
    'amendment_activity',
    'author_added',
    'rules_referral',
    'cross_chamber_received',
    'companion_reference'
  ));
