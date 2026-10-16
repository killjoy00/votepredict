/**
 * Minnesota Secretary of State published raw election-night text, *not* Senate
 * race results. 2020 presidential votes remain on 2012 Senate district lines.
 * 2022 gubernatorial/attorney-general precincts carry post-2022 district codes.
 * No geometry, precinct reallocation, or self-created historical crosswalk.
 */
import {createHash} from 'node:crypto';
import {PolitePublicFetcher} from './senate-scorecard-raw.js';

export type DistrictOffice='president'|'governor'|'attorney_general';
export interface DistrictVoteRow {
  district:string;districtPlan:'2012'|'2022';electionYear:2020|2022|2024;
  office:DistrictOffice;demVotes:number;repVotes:number;otherVotes:number;
  totalVotes:number;source:string;sourceUrl:string;fetchedAt:string;sha256:string;
}
export interface VoteTotals {demVotes:number;repVotes:number;otherVotes:number;totalVotes:number}
export interface DistrictResult {
  year:number;office:DistrictOffice;districtPlan:'2012'|'2022';sourceUrl:string;
  districts:number;districtTotals:VoteTotals;statewideTotals:VoteTotals;totalsMatch:boolean;
  rows:DistrictVoteRow[];
}
const ROOT='https://electionresultsfiles.sos.mn.gov/';
const HOSTS=new Set(['electionresultsfiles.sos.mn.gov']);
const MAX_OFFICIAL_BYTES=95_000_000;
const EMPTY=():VoteTotals=>({demVotes:0,repVotes:0,otherVotes:0,totalVotes:0});
function add(to:VoteTotals,votes:number,party:string):void {
  if(!Number.isSafeInteger(votes)||votes<0)throw Error('Bad official vote count');
  const normalized=party.toUpperCase().trim();
  if(normalized==='DFL')to.demVotes+=votes;
  else if(normalized==='R'||normalized==='REP')to.repVotes+=votes;
  else to.otherVotes+=votes;
  to.totalVotes+=votes;
}
function safeInt(value:string,label:string):number {
  const s=value.replace(/,/g,'').trim();
  if(!/^\d+$/.test(s))throw Error('Invalid '+label+' in published official election file');
  const n=Number(s);
  if(!Number.isSafeInteger(n))throw Error('Oversized '+label);
  return n;
}
function districtFromHouse(value:string):string|null {
  const m=/^0*(\d{1,2})[AB]$/i.exec(value.trim());
  if(!m)return null;
  const n=Number(m[1]);return n>=1&&n<=67?String(n):null;
}
export function parseOfficialPrecinctDistrictCodes(raw:string):Map<string,string> {
  const map=new Map<string,string>();
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim())continue;
    const v=line.split(';');
    if(v.length<6||!/^\d{2}$/.test(v[0])||!/^\d{4}$/.test(v[1]))
      throw Error('Bad published Minnesota precinct code table');
    const district=districtFromHouse(v[4]??'');
    if(!district)throw Error('Precinct lacks unambiguous 2022 House district code');
    const key=v[0]+'|'+v[1];
    if(map.has(key))throw Error('Duplicate official precinct key (no allocation guessed)');
    map.set(key,district);
  }
  if(!map.size)throw Error('No official precinct map records');
  return map;
}
function isOffice(label:string,office:DistrictOffice):boolean {
  if(office==='president')return /^\s*U\.?\s*S\.?\s+President\b/i.test(label);
  if(office==='governor')return /^\s*Governor(?:\s*&\s*Lt\s*Governor)?\s*$/i.test(label);
  return /^\s*Attorney\s+General\s*$/i.test(label);
}
function accumulate(rows:Map<string,VoteTotals>,district:string,party:string,votes:number):void {
  const prev=rows.get(district)??EMPTY();
  add(prev,votes,party);rows.set(district,prev);
}
export function aggregateOfficialPrecinctVotes(raw:string,office:DistrictOffice,
  precinctMap:Map<string,string>):Map<string,VoteTotals> {
  const districts=new Map<string,VoteTotals>();
  let sourceLines=0;
  const precinctsSeen=new Set<string>();
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim())continue;
    const v=line.split(';');
    if(v.length<16||!isOffice(v[4]??'',office))continue;
    const precinctKey=(v[1]??'')+'|'+(v[2]??'');
    const district=precinctMap.get(precinctKey);
    if(!district)throw Error('Missing 2022 Senate district for official precinct '+precinctKey);
    const votes=safeInt(v[13],'precinct candidate votes');
    accumulate(districts,district,v[10]??'',votes);
    precinctsSeen.add(precinctKey);sourceLines++;
  }
  if(!sourceLines||precinctsSeen.size<20)throw Error('Not enough official precinct votes');
  return districts;
}
export function aggregateOfficialHouseDistrictPresidentialVotes(raw:string):
  {votes:Map<string,VoteTotals>;houseDistricts:number} {
  const districts=new Map<string,VoteTotals>();
  const seenHouse=new Set<string>();
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim())continue;
    const v=line.split(';');
    if(v.length<16||!isOffice(v[4]??'','president'))continue;
    const house=(v[5]??'').trim();
    const district=districtFromHouse(house);
    if(!district)throw Error('Official presidential legislative-district row has bad House district');
    const votes=safeInt(v[13],'House-district candidate votes');
    accumulate(districts,district,v[10]??'',votes);
    seenHouse.add(house);
  }
  if(seenHouse.size!==134)throw Error('Expected exactly 134 published House districts');
  return {votes:districts,houseDistricts:seenHouse.size};
}
export function officialStatewideTotals(raw:string,office:DistrictOffice):VoteTotals {
  const out=EMPTY();let lines=0;
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim())continue;
    const v=line.split(';');
    if(v.length<16||!isOffice(v[4]??'',office))continue;
    if((v[5]??'').trim())throw Error('Expected statewide office rows without district');
    add(out,safeInt(v[13],'statewide candidate votes'),v[10]??'');lines++;
  }
  if(lines<2||!out.totalVotes)throw Error('No published statewide total found');
  return out;
}
export function validateDistrictStatewideTotals(
  districts:Map<string,VoteTotals>,statewide:VoteTotals,
):{districts:number;districtTotals:VoteTotals;matches:boolean} {
  if(districts.size!==67||Array.from({length:67},(_,i)=>String(i+1)).some(k=>!districts.has(k)))
    throw Error('Official publication did not yield all 67 Senate districts');
  const totals=EMPTY();
  for(const entry of districts.values()){
    if(entry.totalVotes!==entry.demVotes+entry.repVotes+entry.otherVotes||
      !Object.values(entry).every(n=>Number.isSafeInteger(n)&&n>=0))
      throw Error('Invalid raw district office votes');
    totals.demVotes+=entry.demVotes;totals.repVotes+=entry.repVotes;
    totals.otherVotes+=entry.otherVotes;totals.totalVotes+=entry.totalVotes;
  }
  const matches=(Object.keys(totals) as (keyof VoteTotals)[])
    .every(k=>totals[k]===statewide[k]);
  return {districts:districts.size,districtTotals:totals,matches};
}
interface SourceSpec {
  year:2020|2022|2024;office:DistrictOffice;plan:'2012'|'2022';
  resultUrl:string;statewideUrl:string;precinctMapUrl?:string;
}
export const DISTRICT_OFFICIAL_SOURCES:readonly SourceSpec[]=[
  {year:2022,office:'governor',plan:'2022',
    resultUrl:ROOT+'20221108/allracesbyprecinct.txt',
    statewideUrl:ROOT+'20221108/Governor.txt',precinctMapUrl:ROOT+'20221108/PrctTbl.txt'},
  {year:2022,office:'attorney_general',plan:'2022',
    resultUrl:ROOT+'20221108/allracesbyprecinct.txt',
    statewideUrl:ROOT+'20221108/attorneygen.txt',precinctMapUrl:ROOT+'20221108/PrctTbl.txt'},
  {year:2024,office:'president',plan:'2022',
    resultUrl:ROOT+'20241105/USPresLG.txt',statewideUrl:ROOT+'20241105/USPres.txt'},
  {year:2020,office:'president',plan:'2012',
    resultUrl:ROOT+'20201103/USPresLG.txt',statewideUrl:ROOT+'20201103/USPres.txt'},
];
interface RawOfficial {text:string;sha256:string;fetchedAt:string;url:string}
async function readOfficial(fetcher:PolitePublicFetcher,url:string):Promise<RawOfficial>{
  const r=await fetcher.bytes(url,HOSTS,MAX_OFFICIAL_BYTES);
  return {text:new TextDecoder('windows-1252').decode(r.bytes),
    sha256:createHash('sha256').update(r.bytes).digest('hex'),
    fetchedAt:new Date().toISOString(),url:r.finalUrl};
}
export async function collectRawDistrictPartisanship(fetcher:PolitePublicFetcher,
  onResult:(r:DistrictResult)=>Promise<void>):Promise<{
  collected:Array<Omit<DistrictResult,'rows'>>;failed:Array<{year:number;office:string;reason:string}>;
}> {
  const cached=new Map<string,RawOfficial>();
  const read=async(url:string):Promise<RawOfficial>=>{
    if(!cached.has(url))cached.set(url,await readOfficial(fetcher,url));
    return cached.get(url)!;
  };
  const collected:Array<Omit<DistrictResult,'rows'>>=[];
  const failed:Array<{year:number;office:string;reason:string}>=[];
  for(const spec of DISTRICT_OFFICIAL_SOURCES){
    try{
      // Serial requests share one host-wide one-request-per-second pacer.
      const raw=await read(spec.resultUrl);
      const stateRaw=await read(spec.statewideUrl);
      const mapRaw=spec.precinctMapUrl?await read(spec.precinctMapUrl):null;
      const precinctMap=mapRaw?parseOfficialPrecinctDistrictCodes(mapRaw.text):null;
      const votes=precinctMap
        ?aggregateOfficialPrecinctVotes(raw.text,spec.office,precinctMap)
        :aggregateOfficialHouseDistrictPresidentialVotes(raw.text).votes;
      const expected=officialStatewideTotals(stateRaw.text,spec.office);
      const check=validateDistrictStatewideTotals(votes,expected);
      if(!check.matches)throw Error('District sum differs from official same-release statewide party totals');
      const sha=createHash('sha256').update(raw.sha256).update('|'+(mapRaw?.sha256??''))
        .update('|'+stateRaw.sha256).digest('hex');
      const source='Minnesota Secretary of State published election-night text; '+(
        precinctMap?'precinct results joined to SOS 2022 legislative district codes':
          'published presidential House legislative-district votes summed A+B within Senate district');
      const rows=[...votes.entries()].sort((a,b)=>Number(a[0])-Number(b[0]))
        .map(([district,v]):DistrictVoteRow=>({
          district,districtPlan:spec.plan,electionYear:spec.year,office:spec.office,
          demVotes:v.demVotes,repVotes:v.repVotes,otherVotes:v.otherVotes,totalVotes:v.totalVotes,
          source,sourceUrl:raw.url,fetchedAt:raw.fetchedAt,sha256:sha,
        }));
      const result:DistrictResult={
        year:spec.year,office:spec.office,districtPlan:spec.plan,sourceUrl:raw.url,
        districts:check.districts,districtTotals:check.districtTotals,
        statewideTotals:expected,totalsMatch:true,rows,
      };
      await onResult(result);
      const {rows:_rows,...summary}=result;
      collected.push(summary);
    }catch{
      // Do not write unverifiable or incomplete district aggregates.
      failed.push({year:spec.year,office:spec.office,
        reason:'source unavailable, unparseable or failed statewide-total check'});
    }
  }
  return {collected,failed};
}
