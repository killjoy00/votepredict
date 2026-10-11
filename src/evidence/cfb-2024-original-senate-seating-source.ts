/**
 * #864 finance source-only original 2024 MN Senate seating-chart crosscheck
 * for 22 previously independently sourced 2023 member/CFB identities.
 * This is a 2024 published membership document, NOT evidence that any
 * individual was continuously a senator for all of 2024 or owed filings.
 */
import {createHash} from 'node:crypto';
export const CFB_2024_ORIGINAL_SENATE_CHART_PROOF_VERSION=
 'mn-senate-2024-original-seating-22-verified-cfb-real-senators-source-diagnostic-v1' as const;
export const ORIGINAL_SENATE_2024_SEATING_PDF=
 'https://www.senate.mn/members/2023-2024/info/seating-chart.pdf' as const;
export const ORIGINAL_LRL_93RD_SENATE_SEATING_ARCHIVE=
 'https://www.leg.mn.gov/archive/sessions/seatingcharts/93-s.pdf' as const;
const PINNED_2023_ROSTER_SHA='d50a7049237a009820051cbb9a74ff185cc1115b';
const blob=(s:string)=>createHash('sha1').update('blob '+Buffer.byteLength(s,'utf8')+'\0')
 .update(s,'utf8').digest('hex');
export function selectPrior2023SOSRosterCfbPeople(input:string){
 if(blob(input)!==PINNED_2023_ROSTER_SHA)
   throw Error('Previous original Secretary of State 2023 Senate service crosscheck changed');
 const rows=input.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==22||rows.some(r=>r.length!==13
  ||r[9]!=='official_source_name_district_matched'))
  throw Error('Exact prior independently authenticated real 2023 SOS Senate panel absent');
 return rows.map(r=>({reg:r[0]!,name:r[1]!,district:Number(r[2]),
  prior2023RosterPrintedName:r[3]!})).sort((a,b)=>a.district-b.district);
}
function norm(text:string){return text.replace(/\u0000/g,'')
 .replace(/[‐‑–—]/g,'-').replace(/[ \t]+/g,' ');}
const esc=(s:string)=>s.replace(/[^a-zA-Z0-9]/g,x=>'\\'+x);
type RosterResult={
 reg:string;priorVerified2022And2023Member:string;priorDistrict:number;
 published2024RosterExactNameDistrictMatched:boolean;
 sameDocument2024MapNameDistrictMatched:boolean;
 sourceTableAndMapConflict:boolean;
 roster2024SourceStatus:
   'original_2024_member_list_and_map_both_matched'
  |'HOLD_source_2024_table_and_map_conflict'
  |'HOLD_2024_source_name_or_district_unverified';
};
export function inspect2024OriginalSenateSeatingPdf(input:{
  prior2023RosterPsv:string;original2024PdfExtractedText:string;
}){
 const people=selectPrior2023SOSRosterCfbPeople(input.prior2023RosterPsv);
 const raw=norm(input.original2024PdfExtractedText);
 const title=/Seating Arrangement\s+2024/i.test(raw);
 const ix=raw.indexOf('Senate Members');
 const mapIx=raw.indexOf('2024 Seating Arrangement',Math.max(ix+14,0));
 const table=ix>=0?raw.slice(ix,mapIx>ix?mapIx:Math.min(ix+9000,raw.length)):'';
 const seating=mapIx>=0?raw.slice(mapIx):'';
 // A strict printed list is one source scope; the plotted seat-map captions
 // are a SECOND, independent component inside the exact same original PDF.
 // They can disagree (SD20 in original 2024 chart), which must be a HOLD.
 const entries=people.map(p=>{
   const words=p.name.trim().split(/\s+/);
   const first=words[0]!,surname=words.at(-1)!;
   const roster=new RegExp('(?:^|\\n)\\s*0?'+p.district+'\\s+'+
     esc(surname)+',\\s*'+esc(first)+'\\b[^\\n]{0,60}?\\((?:R|DFL)\\)','i');
   const tableMatched=roster.test(table);
   const mapPattern=new RegExp(esc(first)+'(?:\\s+[A-Z]\\.?)?\\s+'+
     esc(surname)+'(?:\\s+[^\\n]{0,65}?)?\\s+-\\s+0?'+p.district+'\\b','i');
   const mapMatched=mapPattern.test(seating);
   const conflict=!tableMatched&&mapMatched;
   const status:RosterResult['roster2024SourceStatus']=tableMatched&&mapMatched
     ?'original_2024_member_list_and_map_both_matched'
     :conflict?'HOLD_source_2024_table_and_map_conflict'
     :'HOLD_2024_source_name_or_district_unverified';
   return{
     reg:p.reg,priorVerified2022And2023Member:p.name,priorDistrict:p.district,
     published2024RosterExactNameDistrictMatched:tableMatched,
     sameDocument2024MapNameDistrictMatched:mapMatched,
     sourceTableAndMapConflict:conflict,
     roster2024SourceStatus:status,
   } as RosterResult;
 });
 const counts={
  original2024SeatingArrangementTitleVerified:title,
  originalTableSenateMembersSectionLocated:ix>=0,
  originalMapSectionLocated:mapIx>ix,
  numberOfReal2022And2023SenatorsCrossChecked:entries.length,
  exactSourceTableMatches:entries.filter(x=>x.published2024RosterExactNameDistrictMatched).length,
  independentMapCaptionMatches:entries.filter(x=>x['sameDocument2024MapNameDistrictMatched']).length,
  bothSourceSectionsMatched:entries.filter(x=>x.roster2024SourceStatus==='original_2024_member_list_and_map_both_matched').length,
  sourceTableAndMapConflicts:entries.filter(x=>x['sourceTableAndMapConflict']).map(x=>({reg:x.reg,district:x.priorDistrict})),
  unverified:entries.filter(x=>x.roster2024SourceStatus==='HOLD_2024_source_name_or_district_unverified').map(x=>({reg:x.reg,district:x.priorDistrict})),
  complete2024RosterIdentityAuthentication:false,
  historicalVoteDayIn2024ServiceEstablishedCount:0,
  legal2024CommitteeFilingDutyEstablishedCount:0,
  originalCfbActualPublicByEstablishedCount:0,
 };
 return{entries,counts};
}
