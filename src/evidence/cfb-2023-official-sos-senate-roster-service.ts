/**
 * Finance issue #864: historical original Secretary of State 2023 Senate
 * membership roster for 22 prior actual 2022-serving Minnesota senators.
 * 2023 Senate membership != legal committee reporting duty/public-by,
 * and 2023 manual does not certify 2024 point-in-time roster.
 */
import {createHash} from 'node:crypto';
export const SOS_2023_SENATE_ROSTER_SOURCE_VERSION=
 'sos-2023-pocket-original-2023-senate-roster-22-CFB-source-only-v1' as const;
export const SOS_2023_SENATE_ROSTER_PDF=
 'https://www.sos.mn.gov/media/ybhkokxo/pocket-edition-2023.pdf' as const;
const CFB71_BLOB='bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388';
const blob=(s:string)=>createHash('sha1')
 .update('blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex');
export function select22Known2022SenatorsForOfficial2023Roster(source71Psv:string){
 if(blob(source71Psv)!==CFB71_BLOB)
  throw Error('Original real-senator CFB year-end source corpus changed');
 const rows=source71Psv.trimEnd().split('\n').filter(Boolean).map(x=>x.split('|'));
 if(rows.length!==71||rows.some(x=>x.length!==21))
  throw Error('All 71 original yearend version IDs must remain independently pinned');
 const byReg=new Map<string,{reg:string;name:string;district:number}>();
 for(const r of rows){
  const [id,name,rawDistrict,reg]=r;
  if(!id?.startsWith(reg+':')||!name||!reg||!/^\d+$/.test(reg)
   ||!/^\d+$/.test(rawDistrict??''))
   throw Error('Real 2022 Senate identity/CFB committee registration invalid');
  const known=byReg.get(reg);
  if(known&&(known.name!==name||known.district!==Number(rawDistrict)))
   throw Error('Source committee identity/district conflicted across CFB versions');
  byReg.set(reg,{reg,name,district:Number(rawDistrict)});
 }
 const out=[...byReg.values()].sort((a,b)=>a.district-b.district);
 if(out.length!==22||new Set(out.map(x=>x.district)).size!==22
   ||out[0]?.district!==14||out.at(-1)?.district!==36)
  throw Error('Original 22-person actual 2022 serving senator panel not proven');
 return out;
}
const esc=(value:string)=>value.replace(/[^A-Za-z0-9]/g,c=>'\\'+c);
export function inspectOriginal2023SosSenateRoster(input:{
 source71Psv:string;originalSosExtractedPdfText:string;
}){
 const panel=select22Known2022SenatorsForOfficial2023Roster(input.source71Psv);
 const full=input.originalSosExtractedPdfText.replace(/\u0000/g,'')
  .replace(/\r/g,'').replace(/[‐‑–—]/g,'-');
 const sections=[...full.matchAll(/MEMBERS OF THE STATE SENATE/gi)]
  .map(m=>{
    const end=full.indexOf('MEMBERS OF THE HOUSE OF REPRESENTATIVES',m.index!+26);
    return end>m.index!?full.slice(m.index!,end):'';
  }).filter(s=>s.includes('Senate Members')&&s.includes('Name (Party)'));
 if(sections.length!==1)
  throw Error('Exactly one original PDF Senate member roster section required');
 const lines=sections[0]!.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const memberLines=lines.filter(x=>/^[A-Za-z][A-Za-z .'-]+,\s+[A-Za-z]/.test(x));
 const matches=panel.map(person=>{
   const words=person.name.trim().split(/\s+/);
   const first=words[0]!,surname=words.at(-1)!;
   const expected=new RegExp('^'+esc(surname)+',\\s+'+esc(first)+
    '\\b[^\\n]{0,75}?\\((?:R|DFL)\\)\\s+'+person.district+'\\s+\\d{3,5}\\b','i');
   const linesMatched=memberLines.filter(x=>expected.test(x));
   return {...person,sourcePrintedRosterName:linesMatched.length===1
      ?linesMatched[0]!.split(/\((?:R|DFL)\)/)[0]!.trim():null,
      sourceRosterDistrict:linesMatched.length===1?person.district:null,
      exactSourceMatches:linesMatched.length,
      independentlyMatchedIn2023SenateRoster:linesMatched.length===1};
 });
 return {
  exactOriginalSenateRosterSectionLocated:true,
  rosterMemberLineCount:memberLines.length,
  previouslyVerified2022ActualServingSenators:panel.length,
  independentlyMatched2023RosterMembers:matches.filter(x=>x.independentlyMatchedIn2023SenateRoster).length,
  matches,unmatched:matches.filter(x=>!x.independentlyMatchedIn2023SenateRoster),
  actual2024ServiceNotProven:true,
  historicExactVoteDayServiceNotProven:true,
  legallyOwedFinanceReportCount:null,
  originalCfbPublicByCountProven:0,
 };
}
