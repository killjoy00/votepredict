/**
 * #864 — source-only roster fingerprint check for the ten recovered
 * 2023 Elections committee explicit named roll-call candidate blocks.
 * No private DB; 2023 official Senate committee roster surnames are public.
 *
 * Contemporaneous official Senate public hearing minutes:
 * Feb 7:  https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17523&ls=93
 * Feb 14: https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=17600&ls=93
 * Neither public roster proves attendance for every other 2023 meeting.
 */
import {createHash} from 'node:crypto';
import {normalizeMemberName} from '@/sources/minnesota/house-votes';

export const MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES=[
  'Anderson','Bahr','Boldon','Carlson','Cwodzinski','Dornink','Koran','Limmer',
  'Marty','Mathews','Mitchell','Port','Rest','Westlin',
] as const;
export const MN_2023_ELECTIONS_HASHED_SOURCE_ARTIFACT={
  sourceRunId:38084229868,
  artifactId:11681598339,
  artifactJsonSha256:'9f58c518ef440b7d7322aab1125cd97c1b91d5aa05566bb62f94df7b5eff04f7',
  sourcePdfs:7,provisionalNamedBlocks:10,namedYeaNayTokens:133,
  nonvotingAbsentOrPassTokens:7,
} as const;
type Choice='yea'|'nay'|'absent'|'pass';
const sha=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const names=MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES;
const choices=['yea','nay','absent','pass'] as const;
const officialMap=new Map<string,{name:string;choice:Choice}>();
for(const surname of names){
  for(const choice of choices){
    const originalName=normalizeMemberName(surname);
    const digest=sha(choice+':'+originalName);
    if(officialMap.has(digest))throw Error('Duplicate public Senator roster fingerprint');
    officialMap.set(digest,{name:originalName,choice});
  }
}
if(names.length!==14||new Set(names.map(normalizeMemberName)).size!==14)
  throw Error('Not an exactly fourteen-surname public Elections committee roster');
export function inspect2023ElectionsCandidateAgainstOfficialRoster(input:{
  choiceIdentitySha256:string[];
  sourceYeaCount:number;sourceNayCount:number;
  explicitlyNamedYeas:number;explicitlyNamedNays:number;
  explicitlyListedAbsent:number;explicitlyListedPass:number;
  namedYeaNayTallyMatchesSource:boolean;
  explicitNamesAreUniqueWithinRoll:boolean;
}):{
  official2023CommitteeRosterCoversAllFourteenNamedSourceRows:true;
  explicitNamedYeaNayCount:number;explicitNonvotingStatusCount:number;
  absenteeFingerprintContainsAnderson:boolean;
  sourceChoiceIdentityStillNotVerifiedByDailyAttendance:true;
  independentActualMotionAndHistoricDatabaseEqualityUnverified:true;
}{
  if(input.choiceIdentitySha256.length!==14||
     input.namedYeaNayTallyMatchesSource!==true||
     input.explicitNamesAreUniqueWithinRoll!==true||
     input.sourceYeaCount!==input.explicitlyNamedYeas||
     input.sourceNayCount!==input.explicitlyNamedNays||
     input.explicitlyNamedYeas+input.explicitlyNamedNays+
        input.explicitlyListedAbsent+input.explicitlyListedPass!==14)
    throw Error('Provisional original-roll choice count or named tally inconsistent with 14 members');
  const seen=new Set<string>();
  let yea=0,nay=0,absent=0,pass=0;
  for(const digest of input.choiceIdentitySha256){
    if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid original named source fingerprint');
    const expected=officialMap.get(digest);
    if(!expected)throw Error('Original Senate source name outside 2023 public Elections roster');
    if(seen.has(expected.name))throw Error('Senator appears multiple times or on both vote sides');
    seen.add(expected.name);
    if(expected.choice==='yea')yea++;
    else if(expected.choice==='nay')nay++;
    else if(expected.choice==='absent')absent++;
    else pass++;
  }
  if(seen.size!==14||
    yea!==input.explicitlyNamedYeas||nay!==input.explicitlyNamedNays||
    absent!==input.explicitlyListedAbsent||pass!==input.explicitlyListedPass)
    throw Error('Senate source member fingerprint/side does not reproduce roster and numeric tally');
  return {
    official2023CommitteeRosterCoversAllFourteenNamedSourceRows:true,
    explicitNamedYeaNayCount:yea+nay,
    explicitNonvotingStatusCount:absent+pass,
    absenteeFingerprintContainsAnderson:input.choiceIdentitySha256.includes(
      sha('absent:'+normalizeMemberName('Anderson'))),
    sourceChoiceIdentityStillNotVerifiedByDailyAttendance:true,
    independentActualMotionAndHistoricDatabaseEqualityUnverified:true,
  };
}

export function audit2023ElectionsOriginalNamedRollArtifact(raw:string){
  const conf=MN_2023_ELECTIONS_HASHED_SOURCE_ARTIFACT;
  if(sha(raw)!==conf.artifactJsonSha256)
    throw Error('Prior official Senate original named-roll artifact SHA has drifted');
  const source=JSON.parse(raw) as {
    year:number;stats:{originalPdfsReverified:number;sourceFailures:number;
      newExplicitNamedDirectionBlocks:number;blocksWithExactOriginalNumericSourceTally:number;
      sourceNamedYeaNayTokensMatched:number;separatelyExcludedAbsentAndPassTokens:number};
    originalProofs:Array<{
      year:number;hearingDate:string;committeeName:string;originalOfficialPdfUrl:string;
      candidateBlocks:Array<Parameters<typeof inspect2023ElectionsCandidateAgainstOfficialRoster>[0]
        &{sourceOffset:number}>;
    }>;
  };
  if(source.year!==2023||source.originalProofs.length!==7||
    source.stats.originalPdfsReverified!==conf.sourcePdfs||
    source.stats.sourceFailures!==0||
    source.stats.newExplicitNamedDirectionBlocks!==conf.provisionalNamedBlocks||
    source.stats.blocksWithExactOriginalNumericSourceTally!==conf.provisionalNamedBlocks||
    source.stats.sourceNamedYeaNayTokensMatched!==conf.namedYeaNayTokens||
    source.stats.separatelyExcludedAbsentAndPassTokens!==conf.nonvotingAbsentOrPassTokens)
    throw Error('Source-only 2023 original Senate roll counts no longer match actual verified run');
  const result:Array<{hearingDate:string;officialSourceUrl:string;sourceOffset:number;
    explicitNamedYeaNayCount:number;explicitNonvotingStatusCount:number;
    allRosterSurnamesMatched:boolean;publishedFeb14AbsentMemberCorroborated:boolean}>=[];
  const seenDocs=new Set<string>();
  for(const doc of source.originalProofs){
    const url=new URL(doc.originalOfficialPdfUrl);
    if(doc.year!==2023||doc.committeeName!=='Elections'||
      !doc.hearingDate.startsWith('2023-')||
      url.protocol!=='https:'||url.hostname!=='www.lrl.mn.gov'||
      !url.pathname.startsWith('/archive/minutes/senate/2023/elections/')||
      url.search||url.hash||seenDocs.has(doc.originalOfficialPdfUrl))
      throw Error('Untrusted or duplicate official 2023 Elections original meeting URL');
    seenDocs.add(doc.originalOfficialPdfUrl);
    for(const block of doc.candidateBlocks){
      const verified=inspect2023ElectionsCandidateAgainstOfficialRoster(block);
      if(doc.hearingDate==='2023-02-07'&&verified.explicitNonvotingStatusCount!==0)
        throw Error('Feb 7 published official Senate minutes say no absentee');
      if(doc.hearingDate==='2023-02-14' &&
        (verified.explicitNonvotingStatusCount!==1||
         !verified.absenteeFingerprintContainsAnderson))
        throw Error('Feb 14 original roll does not reproduce published Anderson absence');
      result.push({
        hearingDate:doc.hearingDate,officialSourceUrl:doc.originalOfficialPdfUrl,
        sourceOffset:block.sourceOffset,
        explicitNamedYeaNayCount:verified.explicitNamedYeaNayCount,
        explicitNonvotingStatusCount:verified.explicitNonvotingStatusCount,
        allRosterSurnamesMatched:true,
        publishedFeb14AbsentMemberCorroborated:
          doc.hearingDate==='2023-02-14'&&verified.absenteeFingerprintContainsAnderson,
      });
    }
  }
  if(result.length!==10||result.reduce((n,x)=>n+x.explicitNamedYeaNayCount,0)!==133||
    result.reduce((n,x)=>n+x.explicitNonvotingStatusCount,0)!==7)
    throw Error('Source reviewed Senate Elections 2023 roll denominator changed');
  return {
    schemaVersion:'senate-2023-elections-ten-named-roll-roster-hash-audit-v1',issue:864,
    sourceYear:2023,originalSourceRunId:conf.sourceRunId,originalSourceArtifactId:conf.artifactId,
    originalSourceJsonSha256:conf.artifactJsonSha256,
    sevenOfficialPdfOriginalsReconciledToPublishedFourteenSurnameRoster:7,
    provisionalNamedRollBlocksWithExactRosterSurnameCoverage:result.length,
    explicitYeaNayChoiceEntriesChecked:133,explicitNonvotingEntriesChecked:7,
    knownPublicCommitteeSurnames:14,
    exactDayAttendanceIndependentlyCorroboratedOnlyForFeb7AndFeb14:true,
    originalSourceMemberFullIdentityAndMotionDistinctnessNotFullyCertified:true,
    noProductionPrivateDbOrModelChanges:true,
    provisionalRecords:result,
  };
}