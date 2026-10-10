/**
 * #864 official 2022-25 electronic LRL Senate indexed meetings that do NOT
 * have original Minutes links. Source-only alternate-document triage.
 * A missing minutes link is NEVER equivalent to no meeting or no vote.
 */
import { createHash } from 'node:crypto';

export type MissingSenateMinutesYear = 2022 | 2023 | 2024 | 2025;
export interface IndexedMissingMinutes {
  year: MissingSenateMinutesYear;
  committeeName: string;
  committeeUrl: string;
  meetingDate: string;
  indexHeadingVerified: true;
  minutesPdfUrls: [];
  electronicMinutesStatus: 'meeting_without_linked_minutes';
}

export const SENATE_MISSING_MINUTES_SOURCE = {
  originalRunId:38065594898,
  originalArtifactId:11674762938,
  originalJsonSha256:'ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0',
  missingOrderedRowsSha256:'b7702da8e81ae960fc20ae950e957c5172b4d7053a6c1c1424af0e4403cf2558',
  expectedTotalMeetingEntries:1592,
  expectedMissing:141,
  perYear:{2022:12,2023:64,2024:42,2025:23},
  expectedCommitteePages:99,
} as const;

const sha = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * LRL canonicalizes legacy /minutes/comm.aspx to /minutes/comm (HTTP 301).
 * Follow a redirect ONLY if its official HTTPS destination has exactly the
 * same committee ID, year and date as our already source-hashed meeting.
 * The optional body=senate query may be dropped by canonicalization.
 */
export function isSafeSameMeetingLrlRedirect(originalUrl:string,targetUrl:string):boolean {
  let original:URL,target:URL;
  try {original=new URL(originalUrl);target=new URL(targetUrl,original)}catch{return false}
  if(original.protocol!=='https:'||original.hostname!=='www.lrl.mn.gov'
    ||original.pathname!=='/minutes/comm.aspx'
    ||target.protocol!=='https:'
    ||!['www.lrl.mn.gov','lrl.mn.gov'].includes(target.hostname)
    ||!['/minutes/comm.aspx','/minutes/comm'].includes(target.pathname)
    ||target.hash||target.username||target.password
    ||target.searchParams.size<3||target.searchParams.size>4)
    return false;
  for(const key of ['commid','year','date'])
    if(!original.searchParams.get(key)
      ||target.searchParams.get(key)!==original.searchParams.get(key))
      return false;
  if(original.searchParams.get('body')!=='senate') return false;
  const redirectedBody=target.searchParams.get('body');
  if(redirectedBody!==null && redirectedBody!=='senate')return false;
  return [...target.searchParams.keys()].every(key=>
    ['commid','year','date','body'].includes(key));
}


export function officialMissingMinutesMeetingPage(row: IndexedMissingMinutes): string {
  const u = new URL(row.committeeUrl);
  if (u.hostname!=='www.lrl.mn.gov' || u.protocol!=='https:'
      || u.pathname!=='/minutes/comm.aspx'
      || u.searchParams.get('year')!==String(row.year)
      || u.searchParams.get('body')!=='senate'
      || !/^\d+-\d+$/.test(u.searchParams.get('commid')??'')
      || u.searchParams.size!==3
      || !/^202[2-5]-\d\d-\d\d$/.test(row.meetingDate)
      || row.meetingDate.slice(0,4)!==String(row.year)
      || !row.committeeName.trim())
    throw Error('Invalid original Senate indexed committee meeting identity');
  const [y,m,d]=row.meetingDate.split('-');
  if (Number(m)<1 || Number(m)>12 || Number(d)<1 || Number(d)>31)
    throw Error('Invalid source-meeting date components');
  u.searchParams.set('date', Number(m)+'/'+Number(d)+'/'+y);
  return u.toString();
}

export function selectMissingMinutesFromExactIndex(sourceJson:string):IndexedMissingMinutes[] {
  if (sha(sourceJson)!==SENATE_MISSING_MINUTES_SOURCE.originalJsonSha256)
    throw Error('Original official index artifact SHA256 did not match');
  const j=JSON.parse(sourceJson) as {
    indexedMeetings: IndexedMissingMinutes[];
    totalIndexedMeetings2022To2025: number;
    officialIndexProofs: unknown[];
  };
  if (!Array.isArray(j.indexedMeetings)
    || j.indexedMeetings.length!==SENATE_MISSING_MINUTES_SOURCE.expectedTotalMeetingEntries
    || j.totalIndexedMeetings2022To2025!==SENATE_MISSING_MINUTES_SOURCE.expectedTotalMeetingEntries
    || !Array.isArray(j.officialIndexProofs)) throw Error('Original official index meeting universe drifted');
  const chosen=j.indexedMeetings.filter(row=>
    row.electronicMinutesStatus==='meeting_without_linked_minutes');
  if (chosen.length!==SENATE_MISSING_MINUTES_SOURCE.expectedMissing)
    throw Error('Official missing-minutes denominator unexpectedly changed');
  const keys=new Set<string>();
  for(const row of chosen) {
    if (!Array.isArray(row.minutesPdfUrls) || row.minutesPdfUrls.length!==0
        || row.indexHeadingVerified!==true)
      throw Error('Meeting marked absent has an actual Minutes PDF');
    officialMissingMinutesMeetingPage(row);
    const key=row.year+'|'+row.committeeName+'|'+row.meetingDate+'|'+row.committeeUrl;
    if(keys.has(key)) throw Error('Duplicate source meeting identity in original index');
    keys.add(key);
  }
  if(sha([...keys].join('\n'))!==SENATE_MISSING_MINUTES_SOURCE.missingOrderedRowsSha256)
    throw Error('Exact official missing-minutes meeting roster drifted');
  for(const year of [2022,2023,2024,2025] as const)
    if (chosen.filter(row=>row.year===year).length!==SENATE_MISSING_MINUTES_SOURCE.perYear[year])
      throw Error('Official year missing-minutes count changed');
  return chosen;
}
