/**
 * #863: bounded read-only reconciliation of eleven 2025 same-day oath votes.
 * This is a diagnostic, not an alteration of the immutable T-1 forecast roster.
 * Identity and source rows remain inside the protected runner; the output has
 * public bill IDs and aggregate booleans/counts only.
 */
export const ROSTER_863_MARKER = 'ROSTER_863_READONLY_V1_20261018' as const;
export const ROSTER_863_TARGETS = [
  { chamber: 'house', day: '2025-03-17', bill: 'HF1034', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF1058', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF1346', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF1401', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF1443', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF438', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF747', choice: 'yea' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF4', choice: 'nay' },
  { chamber: 'house', day: '2025-03-17', bill: 'HF1410', choice: 'nay' },
  { chamber: 'senate', day: '2025-05-06', bill: 'SF1750', choice: 'yea' },
  { chamber: 'senate', day: '2025-05-06', bill: 'SF2300', choice: 'yea' },
] as const;
type Chamber = 'house' | 'senate';
type Choice = 'yea' | 'nay' | 'other';
type Target = typeof ROSTER_863_TARGETS[number];

export const ROSTER_863_EVENT_SQL = [
  'SELECT ve.id::text AS id,c.slug AS chamber,ve.occurred_on::text AS occurred_on,',
  'b.identifier AS bill_identifier,ve.vote_kind,ve.is_passage,',
  've.yea_count,ve.nay_count,ve.other_count,sd.content_sha256 AS source_sha256',
  'FROM vote_events ve JOIN legislative_sessions s ON s.id=ve.session_id',
  'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
  'JOIN chambers c ON c.id=ve.chamber_id JOIN bills b ON b.id=ve.bill_id',
  'JOIN source_documents sd ON sd.id=ve.source_document_id',
  'WHERE s.slug=\'2025-2026\' AND ve.is_passage=true AND',
  '((c.slug=\'house\' AND ve.occurred_on=\'2025-03-17\'::date',
  'AND b.identifier IN (\'HF1034\',\'HF1058\',\'HF1346\',\'HF1401\',\'HF1443\',\'HF438\',\'HF747\',\'HF4\',\'HF1410\'))',
  'OR (c.slug=\'senate\' AND ve.occurred_on=\'2025-05-06\'::date',
  'AND b.identifier IN (\'SF1750\',\'SF2300\')))',
  'ORDER BY c.slug,ve.occurred_on,b.identifier,ve.id LIMIT 34',
].join(' ');

export const ROSTER_863_CHOICE_SQL = [
  'SELECT mv.vote_event_id::text AS vote_event_id,mv.membership_id::text AS membership_id,',
  'mv.choice,mv.source_member_name,l.name AS legislator_name,',
  'm.starts_on::text AS starts_on,m.ends_on::text AS ends_on',
  'FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id',
  'JOIN legislative_sessions s ON s.id=ve.session_id',
  'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
  'JOIN chambers c ON c.id=ve.chamber_id JOIN bills b ON b.id=ve.bill_id',
  'LEFT JOIN memberships m ON m.id=mv.membership_id',
  'LEFT JOIN legislators l ON l.id=m.legislator_id',
  'WHERE s.slug=\'2025-2026\' AND ve.is_passage=true AND',
  '((c.slug=\'house\' AND ve.occurred_on=\'2025-03-17\'::date',
  'AND b.identifier IN (\'HF1034\',\'HF1058\',\'HF1346\',\'HF1401\',\'HF1443\',\'HF438\',\'HF747\',\'HF4\',\'HF1410\'))',
  'OR (c.slug=\'senate\' AND ve.occurred_on=\'2025-05-06\'::date',
  'AND b.identifier IN (\'SF1750\',\'SF2300\')))',
  'ORDER BY mv.vote_event_id,mv.source_ordinal,mv.id LIMIT 2001',
].join(' ');

export const ROSTER_863_MEMBERSHIP_SQL = [
  'SELECT m.id::text AS membership_id,c.slug AS chamber,l.name AS legislator_name,',
  'm.starts_on::text AS starts_on,m.ends_on::text AS ends_on',
  'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
  'JOIN legislative_sessions s ON s.id=m.session_id',
  'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
  'JOIN chambers c ON c.id=m.chamber_id',
  'WHERE s.slug=\'2025-2026\' AND c.slug IN (\'house\',\'senate\')',
  'ORDER BY c.slug,m.id LIMIT 401',
].join(' ');

export const ROSTER_863_UNIVERSE_SQL = [
  'SELECT s.slug AS session,c.slug AS chamber,',
  'count(*)::int AS event_count,',
  'count(*) FILTER (WHERE ve.yea_count <> tally.yeas OR ve.nay_count <> tally.nays)::int AS stored_tally_mismatch_events,',
  'count(*) FILTER (WHERE tally.unresolved > 0)::int AS events_with_unresolved_choices,',
  'count(*) FILTER (WHERE tally.outside_term > 0)::int AS events_with_out_of_term_choices',
  'FROM vote_events ve JOIN legislative_sessions s ON s.id=ve.session_id',
  'JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug=\'us-mn\'',
  'JOIN chambers c ON c.id=ve.chamber_id',
  'LEFT JOIN LATERAL (SELECT',
  'count(*) FILTER (WHERE mv.choice=\'yea\')::int AS yeas,',
  'count(*) FILTER (WHERE mv.choice=\'nay\')::int AS nays,',
  'count(*) FILTER (WHERE mv.membership_id IS NULL)::int AS unresolved,',
  'count(*) FILTER (WHERE mv.membership_id IS NOT NULL AND',
  '(m.id IS NULL OR ve.occurred_on < coalesce(m.starts_on,\'0001-01-01\'::date)',
  'OR ve.occurred_on > coalesce(m.ends_on,\'9999-12-31\'::date)))::int AS outside_term',
  'FROM member_votes mv LEFT JOIN memberships m ON m.id=mv.membership_id',
  'WHERE mv.vote_event_id=ve.id) tally ON true',
  'WHERE s.slug IN (\'2021-2022\',\'2023-2024\',\'2025-2026\')',
  'GROUP BY s.slug,c.slug ORDER BY s.slug,c.slug LIMIT 9',
].join(' ');
export const ROSTER_863_QUERIES = [
  ROSTER_863_EVENT_SQL, ROSTER_863_CHOICE_SQL,
  ROSTER_863_MEMBERSHIP_SQL, ROSTER_863_UNIVERSE_SQL,
] as const;

export function assertRoster863StaticQueries(): true {
  if (ROSTER_863_TARGETS.length !== 11 ||
    ROSTER_863_TARGETS.filter(x => x.choice === 'yea').length !== 9 ||
    ROSTER_863_TARGETS.filter(x => x.choice === 'nay').length !== 2 ||
    new Set(ROSTER_863_TARGETS.map(x => x.chamber + x.day + x.bill)).size !== 11 ||
    ROSTER_863_QUERIES.some(q =>
      !q.startsWith('SELECT ') || !/\bLIMIT [0-9]+$/.test(q) ||
      /;|--|\/\*|\*\/|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|MERGE|TRUNCATE|GRANT|COPY|EXECUTE|CALL|pg_sleep|dblink)\b/i.test(q))) {
    throw new Error('Unsafe or drifted #863 read-only scope');
  }
  return true;
}

export interface Roster863Event {
  id: string; chamber: Chamber; occurred_on: string; bill_identifier: string;
  vote_kind: string; is_passage: boolean;
  yea_count: number; nay_count: number; other_count: number; source_sha256: string;
}
export interface Roster863Choice {
  vote_event_id: string; membership_id: string | null;
  choice: Choice; source_member_name: string; legislator_name: string | null;
  starts_on: string | null; ends_on: string | null;
}
export interface Roster863Membership {
  membership_id: string; chamber: Chamber; legislator_name: string;
  starts_on: string | null; ends_on: string | null;
}
export interface Roster863Universe {
  session: string; chamber: Chamber; event_count: number;
  stored_tally_mismatch_events: number;
  events_with_unresolved_choices: number; events_with_out_of_term_choices: number;
}
const witness = (chamber: Chamber, name: string | null): boolean =>
  typeof name === 'string' && name.toLowerCase().includes(
    chamber === 'house' ? 'gottfried' : 'heintzeman');
const isActive = (m: {starts_on:string|null; ends_on:string|null}, day:string) =>
  (m.starts_on === null || m.starts_on <= day) &&
  (m.ends_on === null || m.ends_on >= day);
const before = (day:string) => new Date(Date.parse(day+'T00:00:00Z')-86400000)
  .toISOString().slice(0,10);

/** Existing DB coherence + issue-cited official witness, NOT original-public-byte proof. */
export function reconcileRoster863(input: {
  events: Roster863Event[]; choices: Roster863Choice[];
  memberships: Roster863Membership[]; universe: Roster863Universe[];
}) {
  assertRoster863StaticQueries();
  if (input.events.length >= 34 || input.choices.length >= 2001 ||
      input.memberships.length >= 401 || input.universe.length >= 9) {
    throw new Error('Read-only #863 rows hit hard cap');
  }
  const targets = ROSTER_863_TARGETS.map((target: Target) => {
    const hits=input.events.filter(e=>e.chamber===target.chamber &&
      e.occurred_on===target.day && e.bill_identifier===target.bill &&
      e.is_passage === true);
    const event=hits.length===1?hits[0]:null;
    const stored=event?input.choices.filter(v=>v.vote_event_id===event.id):[];
    const yeas=stored.filter(v=>v.choice==='yea').length;
    const nays=stored.filter(v=>v.choice==='nay').length;
    const newlySworn=input.memberships.filter(m=>m.chamber===target.chamber &&
      witness(target.chamber,m.legislator_name));
    const member=newlySworn.length===1?newlySworn[0]:null;
    const sameDayMember=!!member && member.starts_on===target.day &&
      !isActive(member,before(target.day)) && isActive(member,target.day);
    const knownVote=!!member && stored.some(v=>v.membership_id===member.membership_id &&
      v.choice===target.choice && witness(target.chamber,v.legislator_name));
    const roster=input.memberships.filter(m=>m.chamber===target.chamber);
    const tMinusOneRoster=roster.filter(m=>isActive(m,before(target.day))).length;
    const voteDayEligibleRoster=roster.filter(m=>isActive(m,target.day)).length;
    const storedTallyMatches=!!event && yeas===event.yea_count &&
      nays===event.nay_count && stored.filter(v=>v.choice==='other').length===event.other_count;
    const termHolds=stored.filter(v=>!v.membership_id ||
      !input.memberships.some(m=>m.membership_id===v.membership_id &&
        m.chamber===target.chamber && isActive(m,target.day))).length;
    const sourceDigestPresent=!!event && /^[a-f0-9]{64}$/.test(event.source_sha256);
    const reconciled=!!event && knownVote && sameDayMember && storedTallyMatches &&
      termHolds===0 && sourceDigestPresent;
    return {
      chamber:target.chamber,day:target.day,bill:target.bill,
      issueOfficialWitnessChoice:target.choice,
      exactPassageEvents:hits.length,
      tMinusOneEligibleRoster:tMinusOneRoster,
      voteDayEligibleRoster,
      storedRollCallChoices:stored.length,
      storedYeas:yeas,storedNays:nays,
      storedTallyMatches,sourceDigestPresent,
      recordedIssueWitnessVote:knownVote,
      membershipShowsSameDayOath:sameDayMember,
      unresolvedOrOutOfTermChoiceCount:termHolds,
      reconciled,
    };
  });
  const complete=targets.every(x=>x.reconciled) &&
    targets.filter(x=>x.chamber==='house').every(x=>
      x.voteDayEligibleRoster-x.tMinusOneEligibleRoster===1) &&
    targets.filter(x=>x.chamber==='senate').every(x=>
      x.voteDayEligibleRoster-x.tMinusOneEligibleRoster===1);
  return {
    status: complete?'stored_source_and_vote_day_roster_reconciled':'held_for_source_or_identity_review',
    scope:'eleven_2025_oath_day_passage_targets',
    targetCount:targets.length,
    reconciledCount:targets.filter(x=>x.reconciled).length,
    expectedIssueWitnessChoices:{yea:9,nay:2},
    sameDayExcludedFromPriorForecast:true,
    forecastOrStoredVotesModified:false,
    originalOfficialJournalBytesReauthenticated:false,
    allEventAuditLabel:'stored_tally_and_membership_coherence_not_original_official_denominator',
    targets,universe:input.universe,
  };
}
