/**
 * #864 preliminary 2021-2025 Senate service YEAR-OVERLAP observations.
 * The source is the ORIGINAL independently acquired official Minnesota LRL
 * Senate directory + exact 2024/25 special-member swearing original.
 *
 * This is NOT a day-resolved person-year membership denominator: a published
 * multi-year term does not establish the exact entrance/exit within a year.
 * Do not join winner-election observations, never-served candidates or
 * production evidence to these records.
 */
import type {AuditedOfficialSenateDirectory,SenateServedRecord} from
 './senate-official-ever-served-directory.js';

export const LRL_SENATE_YEAR_OVERLAP_VERSION=
 'mn-2021-25-original-lrl-senate-served-person-year-overlap-v1' as const;
const YEARS=[2021,2022,2023,2024,2025] as const;
const URL='https://www.lrl.mn.gov/legdb/senate_dir';
const SWEAR_URL='https://www.lrl.mn.gov/history/caucus?body=s';
const SPECIAL_OATHS=[
 {names:['Ann Johnson Stewart','Ann M Johnson Stewart'],district:'45',year:2024,date:'2024-11-25'},
 {names:['Doron Clark'],district:'60',year:2025,date:'2025-02-03'},
 {names:['Keri Heintzeman'],district:'6',year:2025,date:'2025-05-06'},
 {names:['Michael Holmstrom Jr'],district:'29',year:2025,date:'2025-11-18'},
 {names:['Amanda Hemmingsen-Jaeger'],district:'47',year:2025,date:'2025-11-18'},
] as const;

type OriginalTerm=SenateServedRecord['senateServiceTerms'][number];
function validatedOriginalTerms(row:SenateServedRecord){
 if(!row.officialName.trim()||!row.officialNameRaw.trim()
   ||!row.officialSourceUrl.startsWith('https://www.lrl.mn.gov/')
   ||row.senateServiceTerms.length<1)throw Error('Unverified actual-Senator identity or official Senate-service source');
 const unique=new Set<string>();
 return row.senateServiceTerms.map(term=>{
  if(!Number.isInteger(term.startsYear)||term.startsYear<2010||term.startsYear>2026
    ||term.endsYear!==null&&(!Number.isInteger(term.endsYear)
      ||term.endsYear<term.startsYear||term.endsYear>2026)
    ||!/^([1-9]|[1-5][0-9]|6[0-7])$/.test(term.district))
   throw Error('Original LRL Senate term has invalid district or bounded year');
  const key=term.startsYear+'|'+term.endsYear+'|'+term.district;
  if(unique.has(key))throw Error('Duplicated original Senate term within a person');
  unique.add(key);
  return term;
 });
}
function belongsInYear(term:OriginalTerm,year:number){
 return term.startsYear<=year&&(term.endsYear===null||term.endsYear>=year);
}
function utc(value:string){
 const n=Date.parse(value);return Number.isFinite(n)&&new Date(n).toISOString()===value;
}
/** Recompute overlap from the already verified ORIGINAL LRL source bytes.
 * Never imply the multi-year service label itself proves Jan 1 occupancy,
 * a precise resignation date, or a year-end snapshot.
 */
export function buildActualSenatorOfficialYearOverlapResearch(
 official:AuditedOfficialSenateDirectory,
){
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||official.source.url!==URL
   ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
   ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
   ||!/^[a-f0-9]{64}$/.test(official.source.sourceBytesSha256)
   ||!utc(official.source.observedAt)
   ||official.senators.length<65||official.senators.length>500)
  throw Error('Original observed official LRL Senate service directory is required');
 const special=official.supplementalSwearingSource;
 if(!special||special.url!==SWEAR_URL
   ||!special.swearingDateIndependentlyDocumentedForNamedSpecialMembers
   ||special.websitePublicationDateBackdated!==false
   ||!/^[a-f0-9]{64}$/.test(special.sourceBytesSha256)
   ||!utc(special.observedAt))
  throw Error('Original independently validated Senate special-oath records are required');
 const seenRaw=new Set<string>();
 const rows=official.senators.map(p=>{
  const identity=p.officialSourceUrl+'|'+p.officialNameRaw;
  if(seenRaw.has(identity))
   throw Error('Two official person rows have ambiguous identical Senate-service identity');
  seenRaw.add(identity);
  return{p,terms:validatedOriginalTerms(p)};
 });
 const byYear=YEARS.map(year=>{
  const people=[];
  for(const {p,terms} of rows){
   const overlapping=terms.filter(t=>belongsInYear(t,year));
   if(overlapping.length===0)continue;
   const districts=[...new Set(overlapping.map(t=>t.district))].sort((a,b)=>Number(a)-Number(b));
   const oathEvents=SPECIAL_OATHS.filter(o=>o.year===year
     &&o.names.some(n=>n===p.officialName)
     &&districts.includes(o.district));
   people.push({
    officialPersonName:p.officialName,
    officialPersonNameRaw:p.officialNameRaw,
    serviceSourceUrl:p.officialSourceUrl,
    annualSourceObservationAtUtc:p.officialSourceUrl===URL?
      official.source.observedAt:special.observedAt,
    annualSourceOriginalSha256:p.officialSourceUrl===URL?
      official.source.sourceBytesSha256:special.sourceBytesSha256,
    year,
    senateDistrictsReportedForAnyPartOfYear:districts,
    originalOfficialServiceYearTerms:overlapping.map(t=>({
     fromYear:t.startsYear,toYear:t.endsYear,
     district:t.district,
     sourcePrecision:'calendar_year_only' as const,
    })),
    distinctDatedSpecialSenateOathEvents:oathEvents.map(o=>({
     senateDistrict:o.district,swornOn:o.date,
     originalSpecialOathSourceUrl:special.url,
     originalSpecialOathObservedAtUtc:special.observedAt,
     originalSpecialOathSourceSha256:special.sourceBytesSha256,
     oathIsOriginalOfficialAttested:true as const,
     exactFirstEverServiceDayEstablishedByThisOathAlone:false as const,
    })),
    fullCalendarYearContinuousOccupancyProven:false as const,
    exactWithinYearActualServiceStartDate:null,
    exactWithinYearActualServiceEndDate:null,
    exactOriginalLegislatorBiographyUrl:null,
    historicalCampaignWebsiteSourceComplete:false as const,
    electionResultUsedToEstablishService:false as const,
    automatedForecastEvidenceAdmission:false as const,
   });
  }
  people.sort((a,b)=>a.officialPersonName.localeCompare(b.officialPersonName)
    ||a.officialPersonNameRaw.localeCompare(b.officialPersonNameRaw));
  const districtLabels=new Map<string,string[]>();
  for(const p of people)for(const district of p.senateDistrictsReportedForAnyPartOfYear)
   districtLabels.set(district,[...(districtLabels.get(district)??[]),p.officialPersonName]);
  const unrepresented=Array.from({length:67},(_,i)=>String(i+1))
   .filter(d=>!districtLabels.has(d));
  const repeated=[...districtLabels.entries()]
   .filter(([,names])=>names.length>1)
   .map(([district,officialNames])=>({district,officialNames}))
   .sort((a,b)=>Number(a.district)-Number(b.district));
  return{
   year,
   officialRecordedPeopleWithSomeSenateServiceYearOverlap:people.length,
   reportedDistrictLabelDiagnostics:{
    distinctDistrictLabels:districtLabels.size,
    noOfficialServiceYearRowForTheseLabels:unrepresented,
    labelsWithMultipleObservedSenateServicePeople:repeated,
    missingLabelIsNotProofOfVacancyOrNeverServing:true,
    overlappingLabelMayBeRealMidyearTransitionOrSourceError:true,
   },
   uniqueOfficialNameRawRows:people.length,
   incompleteDayResolvedMembershipDenominator:true,
   people,
  };
 });
 const all=byYear.flatMap(y=>y.people);
 const exactOaths=all.flatMap(x=>x.distinctDatedSpecialSenateOathEvents);
 const distinct= new Set(all.map(x=>x.serviceSourceUrl+'|'+x.officialPersonNameRaw));
 if(byYear.length!==5||byYear.some(x=>x.people.some(p=>p.year!==x.year))
   ||all.some(p=>p.senateDistrictsReportedForAnyPartOfYear.length===0))
  throw Error('Invalid official Senate calendar-year overlap expansion');
 // Never silently turn every term's start/end year into Jan 1 / Dec 31.
 return{
  schema:LRL_SENATE_YEAR_OVERLAP_VERSION,
  originalOfficialSources:{
   senateDirectoryUrl:official.source.url,
   senateDirectoryObservedAtUtc:official.source.observedAt,
   senateDirectoryOriginalSha256:official.source.sourceBytesSha256,
   specialSenateSwearingUrl:special.url,
   specialSenateSwearingObservedAtUtc:special.observedAt,
   specialSenateSwearingOriginalSha256:special.sourceBytesSha256,
  },
  totals:{
   officialServedSenatorDirectoryRowsRead:rows.length,
   distinctOfficialDirectoryPeopleRepresentedDuring2021to25:distinct.size,
   observedPersonCalendarYearOverlaps:all.length,
   exactOriginalSpecialOathEventsAttached:exactOaths.length,
   unverifiedCandidatesNamed:0,exactStartEndMembershipIntervalsCertified:0,
   productionEvidenceAdmissions:0,
  },
  byYear,
  limitations:[
   'Official LRL Senate-service TERM YEAR RANGES give a dated overlap candidate for 2021-2025 but do NOT provide day-precise within-year start/end service intervals.',
   'Exact special election sworn-on dates are separate event facts and are not silently propagated to all term start/end dates.',
   'A source retrieved in October 2026 attests retrospective official Senate service, not the contemporary availability of any politician campaign statement.',
   'This is an intermediate person-year SOURCE inventory and cannot certify the full statewide membership denominator until original individual biographies, special transitions, vacancies, omitted LRL rows and database membership periods are reconciled.',
   'No absent website or missing campaign source means a politician held no position. No outcomes or postvote winner selections become pre-election model features.',
  ],
 };
}
