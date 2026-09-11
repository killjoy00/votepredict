ALTER TABLE forecasts
  DROP CONSTRAINT IF EXISTS forecasts_target_kind_check;

ALTER TABLE forecasts
  ADD CONSTRAINT forecasts_target_kind_check CHECK (target_kind IN (
    'committee_hearing', 'committee_passage', 'calendar_placement',
    'source_chamber_passage',
    'house_floor_passage', 'senate_floor_passage', 'identical_text_adoption',
    'conference_report_adoption', 'governor_signature', 'enactment'
  ));
