import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRoster863StaticQueries, ROSTER_863_TARGETS, ROSTER_863_QUERIES,
  reconcileRoster863,
  type Roster863Event, type Roster863Choice, type Roster863Membership,
} from '../src/evaluation/historical-roster-863-audit.js';

function fixture() {
  const memberships: Roster863Membership[]=[
    {membership_id:'h',chamber:'house',legislator_name:'David Gottfried',
      starts_on:'2025-03-17',ends_on:null},
    {membership_id:'s',chamber:'senate',legislator_name:'Keri Heintzeman',
      starts_on:'2025-05-06',ends_on:null},
    {membership_id:'old-h',chamber:'house',legislator_name:'Other House Member',
      starts_on:'2025-01-01',ends_on:null},
    {membership_id:'old-s',chamber:'senate',legislator_name:'Other Senate Member',
      starts_on:'2025-01-01',ends_on:null},
  ];
  const events: Roster863Event[]=ROSTER_863_TARGETS.map((t,i)=>({
    id:'event-'+i,chamber:t.chamber,occurred_on:t.day,bill_identifier:t.bill,
    vote_kind:'passage',is_passage:true,yea_count:t.choice==='yea'?1:0,
    nay_count:t.choice==='nay'?1:0,other_count:0,source_sha256:'a'.repeat(64),
  }));
  const choices: Roster863Choice[]=ROSTER_863_TARGETS.map((t,i)=>({
    vote_event_id:'event-'+i,membership_id:t.chamber==='house'?'h':'s',
    choice:t.choice,source_member_name:t.chamber==='house'?'Gottfried':'Heintzeman',
    legislator_name:t.chamber==='house'?'David Gottfried':'Keri Heintzeman',
    starts_on:t.day,ends_on:null,
  }));
  return {memberships,events,choices,universe:[
    {session:'2025-2026',chamber:'house' as const,event_count:9,
      stored_tally_mismatch_events:0,events_with_unresolved_choices:0,
      events_with_out_of_term_choices:0},
  ]};
}
test('exact 11 named official witnesses and safe SELECT-only bounded SQL',()=>{
  assert.equal(assertRoster863StaticQueries(),true);
  assert.equal(ROSTER_863_TARGETS.length,11);
  assert.equal(ROSTER_863_QUERIES.length,4);
  assert.ok(ROSTER_863_QUERIES.every(sql => sql.startsWith('SELECT ') &&
    /\bLIMIT \d+$/.test(sql)));
});
test('T-1 forecast membership stays separate from actual T-day oath and vote',()=>{
  const report=reconcileRoster863(fixture());
  assert.equal(report.status,'stored_source_and_vote_day_roster_reconciled');
  assert.equal(report.reconciledCount,11);
  assert.equal(report.targets.filter(t=>t.issueOfficialWitnessChoice==='yea').length,9);
  assert.equal(report.targets.filter(t=>t.issueOfficialWitnessChoice==='nay').length,2);
  assert.ok(report.targets.every(t=>t.tMinusOneEligibleRoster===1 &&
    t.voteDayEligibleRoster===2 && t.recordedIssueWitnessVote &&
    t.membershipShowsSameDayOath));
  assert.equal(report.originalOfficialJournalBytesReauthenticated,false);
  assert.equal(report.forecastOrStoredVotesModified,false);
  const out=JSON.stringify(report);
  for(const secret of ['David Gottfried','Keri Heintzeman','membership_id',
      'source_member_name','source_url','https://','postgres://'])
    assert.equal(out.includes(secret),false);
});
test('missing/duplicated passage events or wrong yea/nay are held',()=>{
  const a=fixture();a.events=a.events.slice(1);
  assert.equal(reconcileRoster863(a).reconciledCount,10);
  a.events.push({...a.events[0]});
  assert.notEqual(reconcileRoster863(a).status,'stored_source_and_vote_day_roster_reconciled');
  const b=fixture();b.choices[0]={...b.choices[0],choice:'nay'};
  assert.equal(reconcileRoster863(b).reconciledCount,10);
});
test('unresolved vote, next-day membership and invented historical member are held',()=>{
  const a=fixture();a.choices[1]={...a.choices[1],membership_id:null};
  assert.equal(reconcileRoster863(a).reconciledCount,10);
  const b=fixture();b.memberships[0]={...b.memberships[0],starts_on:'2025-03-18'};
  assert.equal(reconcileRoster863(b).reconciledCount,2);
  const c=fixture();c.memberships[1]={...c.memberships[1],
    legislator_name:'Someone Else'};
  assert.equal(reconcileRoster863(c).reconciledCount,9);
});
test('never silently truncate protected read-only results',()=>{
  const a=fixture();a.choices=Array.from({length:2001},()=>a.choices[0]);
  assert.throws(()=>reconcileRoster863(a),/hard cap/);
});
