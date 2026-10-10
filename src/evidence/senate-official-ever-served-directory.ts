/**
 * Official Minnesota Legislative Reference Library Senate service directory.
 * This is the public LRL member-service directory, not election candidates.
 * Guardrails: only individuals with independently published Senate service;
 * preserve a verified run/retrieval timestamp; never fabricate original text
 * publication dates from an election year or current source page metadata.
 *
 * Source: https://www.lrl.mn.gov/legdb/senate_dir
 */
import {createHash} from 'node:crypto';
import {strictCandidateKey} from './sos-senate-historical-candidate-inventory.js';

export const OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL=
  'https://www.lrl.mn.gov/legdb/senate_dir' as const;
export const OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL=
  'https://www.lrl.mn.gov/history/caucus?body=s' as const;
export const SENATOR_ONLY_COVERAGE_OBSERVATION_DATE='2026-10-10' as const;
export type SenateServedRecord={
  officialName:string;
  officialNameRaw:string;
  officialSourceUrl:typeof OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL|
    typeof OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL;
  senateServiceTerms:Array<{startsYear:number;endsYear:number|null;district:string}>;
};
export type AuditedOfficialSenateDirectory={
  schema:'mn-lrl-official-senate-ever-served-directory-v1';
  source:{
    url:typeof OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL;
    observedAt:string;
    sourceBytesSha256:string;
    sourceBytesLength:number;
    originalHistoricDateForDisplayedDirectoryEstablished:false;
    directoryIsSenatorServiceNotCandidateFiling:true;
  };
  supplementalSwearingSource?:{
    url:typeof OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL;
    observedAt:string;sourceBytesSha256:string;
    sourceBytesLength:number;
    swearingDateIndependentlyDocumentedForNamedSpecialMembers:true;
    websitePublicationDateBackdated:false;
  };
  senators:SenateServedRecord[];
};
const normalizeSpace=(s:string)=>s.replace(/\s+/g,' ').trim();
function htmlText(raw:string):string{
  return normalizeSpace(raw
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#(?:x([a-f0-9]{1,6})|(\d{1,7}));/gi,(_,h,d)=>{
      const cp=Number.parseInt(h??d,h?16:10);
      return cp>0&&cp<0x110000&&!(cp>=0xd800&&cp<=0xdfff)
        ?String.fromCodePoint(cp):' ';
    }));
}
function firstLastOfOfficialDirectory(inverted:string):string{
  const raw=inverted.split(/\s+-\s+"/)[0].trim();
  const cleaned=raw.replace(/["()]/g,' ').replace(/\s+/g,' ').trim();
  const m=cleaned.match(/^([^,]+),\s*(.+)$/);
  return normalizeSpace(m?m[2]+' '+m[1]:cleaned);
}
export function parseOfficialMnSenateServiceDirectory(
  html:Uint8Array,observedAt:string,
  swornHistoryHtml?:Uint8Array,swornHistoryObservedAt?:string,
):AuditedOfficialSenateDirectory {
  const observed=new Date(observedAt);
  if(!Number.isFinite(observed.getTime())||observed.toISOString()!==observedAt
    ||observed.getTime()<Date.parse('2026-10-10T00:00:00Z')
    ||observed.getTime()>Date.now()+60_000)
    throw Error('Source retrieval timestamp not valid observed UTC time');
  if(html.byteLength<9000||html.byteLength>5*1024*1024)
    throw Error('Incomplete or oversized original official Senate directory HTML');
  const body=Buffer.from(html).toString('utf8');
  if(!body.includes('State Senators')||!body.includes('Service Information'))
    throw Error('Missing Minnesota official Senate service directory heading');
  const rows:SenateServedRecord[]=[];
  for(const match of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>htmlText(x[1]));
    if(cells.length<3)continue;
    const rawName=cells[0];
    const service=cells.slice(1).join('; ');
    if(!rawName||!service.includes('Senate'))continue;
    const terms:SenateServedRecord['senateServiceTerms']=[];
    const pattern=/Senate\s+(\d{4})\s*[-–]\s*(\d{2,4}|Present)\s*\(District\s+0?(\d{1,2})\)/gi;
    for(const t of service.matchAll(pattern)){
      const start=Number(t[1]);
      let end:number|null=null;
      if(t[2].toLowerCase()!=='present'){
        const n=Number(t[2]);end=t[2].length===2?Math.floor(start/100)*100+n:n;
      }
      const dist=String(Number(t[3]));
      // The historical directory includes 19th-century territorial
      // jurisdictions with obsolete/non-modern district numbering. Those
      // terms do not help a 2020-26 membership audit, so skip rather than
      // incorrectly fail the whole original source.
      if(start<2010||start>2026||end!==null&&(end<2020||end<start||end>2026)
        ||Number(dist)<1||Number(dist)>67)continue;
      terms.push({startsYear:start,endsYear:end,district:dist});
    }
    if(!terms.length)continue;
    rows.push({
      officialName:firstLastOfOfficialDirectory(rawName),
      officialNameRaw:rawName,
      officialSourceUrl:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
      senateServiceTerms:terms,
    });
  }
  if(rows.length<65||rows.length>500)
    throw Error('Official historical Senate directory response missing expected historic table rows');
  if(rows.some(row=>!strictCandidateKey(row.officialName)))
    throw Error('Official Senate directory contains unusable person name');
  let supplementalSwearingSource:AuditedOfficialSenateDirectory['supplementalSwearingSource'];
  if(Boolean(swornHistoryHtml)!==Boolean(swornHistoryObservedAt))
    throw Error('Both original official special-election Senate swearing text and observed date required');
  if(swornHistoryHtml&&swornHistoryObservedAt){
    const instant=new Date(swornHistoryObservedAt);
    if(!Number.isFinite(instant.getTime())||instant.toISOString()!==swornHistoryObservedAt
      ||instant.getTime()<Date.parse('2026-10-10T00:00:00Z')
      ||instant.getTime()>Date.now()+60_000)
      throw Error('Swearing source observation timestamp missing/illegitimately backdated');
    if(swornHistoryHtml.byteLength<9000||swornHistoryHtml.byteLength>5*1024*1024)
      throw Error('Official special Senate swearing source incomplete/oversized');
    const swornBody=Buffer.from(swornHistoryHtml).toString('utf8');
    if(!swornBody.includes('Party Control')||!swornBody.includes('Minnesota Senate'))
      throw Error('Wrong original official Senate swearing source');
    const rowsHtml=[...swornBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(x=>htmlText(x[1]));
    if(rowsHtml.length<10)throw Error('Senate party-control swearing table has too few rows');
    const namedSpecials=[
      {name:'Ann Johnson Stewart',district:'45',oathOn:'November 25, 2024',
       check:/Ann Johnson Stewart[\s\S]{0,220}District 45[\s\S]{0,160}sworn in on November 25, 2024/i,
       date:'11/25/2024'},
      {name:'Doron Clark',district:'60',oathOn:'February 3, 2025',
       check:/Doron Clark[\s\S]{0,200}District 60[\s\S]{0,160}sworn in on February 3, 2025/i,
       date:'2/3/2025'},
      {name:'Keri Heintzeman',district:'6',oathOn:'May 6, 2025',
       check:/Keri Heintzeman[\s\S]{0,190}District 6[\s\S]{0,180}sworn in on May 6, 2025/i,
       date:'5/6/2025'},
      {name:'Michael Holmstrom Jr',district:'29',oathOn:'November 18, 2025',
       check:/Amanda Hemmingsen-Jaeger[\s\S]{0,160}District 47[\s\S]{0,160}Michael Holmstrom[\s\S]{0,160}District 29[\s\S]{0,160}sworn in on November 18, 2025/i,
       date:'11/18/2025'},
      {name:'Amanda Hemmingsen-Jaeger',district:'47',oathOn:'November 18, 2025',
       check:/Amanda Hemmingsen-Jaeger[\s\S]{0,160}District 47[\s\S]{0,160}Michael Holmstrom[\s\S]{0,160}District 29[\s\S]{0,160}sworn in on November 18, 2025/i,
       date:'11/18/2025'},
    ];
    for(const entry of namedSpecials){
      const row=rowsHtml.find(x=>x.startsWith(entry.date+' ')
        &&entry.check.test(x));
      if(!row)throw Error('Missing exact officially attested special-election Senate swearing: '+
        entry.date+' SD'+entry.district);
      if(rows.some(r=>officialIdentityMatchesCandidate(r,entry.name)))
        continue;
      rows.push({
        officialName:entry.name,officialNameRaw:entry.name,
        officialSourceUrl:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
        senateServiceTerms:[{startsYear:Number(entry.date.slice(-4)),endsYear:null,
          district:entry.district}],
      });
    }
    supplementalSwearingSource={
      url:OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
      observedAt:swornHistoryObservedAt,
      sourceBytesSha256:createHash('sha256').update(swornHistoryHtml).digest('hex'),
      sourceBytesLength:swornHistoryHtml.byteLength,
      swearingDateIndependentlyDocumentedForNamedSpecialMembers:true,
      websitePublicationDateBackdated:false,
    };
  }
  return{
    schema:'mn-lrl-official-senate-ever-served-directory-v1',
    source:{
      url:OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,observedAt,
      sourceBytesSha256:createHash('sha256').update(html).digest('hex'),
      sourceBytesLength:html.byteLength,
      originalHistoricDateForDisplayedDirectoryEstablished:false,
      directoryIsSenatorServiceNotCandidateFiling:true,
    },
    supplementalSwearingSource,
    senators:rows,
  };
}
function nameParts(name:string){
  const x=strictCandidateKey(name).replace(/\b(jr|sr|ii|iii|iv)\b/g,' ')
    .replace(/\s+/g,' ').trim().split(' ');
  return {first:x[0]??'',last:x.at(-1)??''};
}
/**
 * LRL sometimes documents a common first name explicitly ("Kupec, Robert -
 * 'Rob'"). A nickname only qualifies where the SAME official row explicitly
 * lists that exact alias. Generic fuzzy name matching remains prohibited.
 */
function officialIdentityMatchesCandidate(row:SenateServedRecord,candidateName:string):boolean{
 const person=nameParts(row.officialName),target=nameParts(candidateName);
 if(person.last!==target.last||!target.first||!target.last)return false;
 if(person.first===target.first)return true;
 const nicknameMatch=row.officialNameRaw.match(/\s+-\s*["“]([^"”]+)["”]/);
 if(!nicknameMatch)return false;
 const alternatives=nicknameMatch[1].split(/,\s*/).map(a=>nameParts(a+' '+target.last).first);
 return alternatives.includes(target.first);
}
/**
 * Critical distinction: the user wants anyone who EVER served in the
 * Minnesota Senate, even if they lost a race or did not begin a new term
 * after an election. For example, Jerry Relph served until December 2020;
 * the 2020 winning election did not produce a 2021 service term.
 *
 * "verified_senate_service" proves *person* has served; the separate
 * "serviceForThisElectionFollowingYearVerified" flag governs the cohort.
 */
export function validateActualSenateServiceForElection(
 official:AuditedOfficialSenateDirectory,
 candidateName:string,district:string,electionYear:number,
):{
 status:'verified_senate_service'|'not_yet_verified';
 officialName:string|null;term:string|null;
 serviceForThisElectionFollowingYearVerified:boolean;
 officialServiceSource:string|null;
}{
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
   ||official.source.url!==OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL
   ||official.source.directoryIsSenatorServiceNotCandidateFiling!==true
   ||official.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
   ||!/^[0-9a-f]{64}$/.test(official.source.sourceBytesSha256)
   ||!Number.isFinite(Date.parse(official.source.observedAt)))
   throw Error('Senate service directory not authenticated with an observed date');
 if(!/^\d{1,2}$/.test(district)||!Number.isInteger(electionYear)
   ||!['2020','2022','2024','2025'].includes(String(electionYear)))
   throw Error('Unknown candidate-election senator-service window');
 const termYear=electionYear===2020?2021:electionYear===2022?2023:2025;
 const persons=official.senators.filter(row=>
   officialIdentityMatchesCandidate(row,candidateName));
 if(persons.length!==1)return {
   status:'not_yet_verified',officialName:null,term:null,
   serviceForThisElectionFollowingYearVerified:false,officialServiceSource:null,
 };
 const row=persons[0];
 const thisTerm=row.senateServiceTerms.find(term=>
   term.district===district
   &&term.startsYear<=termYear
   &&(term.endsYear===null||term.endsYear>=termYear));
 const previousOrDifferent=row.senateServiceTerms.find(term=>term.district===district)
   ??row.senateServiceTerms[0];
 return {
   status:'verified_senate_service',officialName:row.officialName,
   term:(thisTerm??previousOrDifferent).startsYear+'-'+
     ((thisTerm??previousOrDifferent).endsYear??'Present')+
     ' SD'+(thisTerm??previousOrDifferent).district,
   serviceForThisElectionFollowingYearVerified:Boolean(thisTerm),
   officialServiceSource:row.officialSourceUrl,
 };
}
/** An earlier losing candidate can enter research if this independent
 * directory proves that exact person later or earlier served in the Senate.
 * Do not accidentally exclude future senators just because they once lost.
 */
export function validateCandidateEverActuallyServed(
 official:AuditedOfficialSenateDirectory,candidateName:string,
):boolean{
 if(official.schema!=='mn-lrl-official-senate-ever-served-directory-v1')
   throw Error('Unverified Minnesota LRL Senate service directory');
 return official.senators.filter(row=>
   officialIdentityMatchesCandidate(row,candidateName)).length===1;
}
