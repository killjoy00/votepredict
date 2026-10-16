/**
 * Education Minnesota's 2026 screening PDFs are ORIGINAL responses linked
 * individually from https://www.edmnvotes.org/voter-guide/.
 * Their text-selectable forms print Yes/No values BEFORE the numbered prompt
 * on pages 1-4, and usually print long narrative responses BEFORE the prompt
 * on pages 5-9. Never infer a missing mark or invent missing Q&A.
 *
 * Preserve complete original PDF bytes separately in the raw collector.
 */
import type {QuestionnaireSource,QuestionAnswer} from './senate-questionnaire-raw.js';

type Parsed={candidateName:string;district:string;party:string|null;displayedSubmittedOn:string|null;qa:QuestionAnswer[]};
function normName(input:string):string{
  const words=input.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/);
  // A publisher may print "Dan R. Rogers" on the index and "Dan Rogers" on
  // the original PDF. Remove a SINGLE middle initial, not arbitrary names.
  if(words.length===3&&words[1].length===1)words.splice(1,1);
  return words.join(' ');
}
function dateShown(text:string):string|null{
  const m=/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
  if(!m)return null;
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month=months.indexOf(m[1].slice(0,3).toLowerCase())+1,day=Number(m[2]),year=Number(m[3]);
  const d=new Date(Date.UTC(year,month-1,day));
  if(month<1||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
  return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function preparedLines(page:string,candidate:string,district:string):string[]{
  const target=normName(candidate)+' '+String(Number(district));
  return page.replace(/\r/g,'\n').replace(/\t/g,'\n').split('\n')
    .map(x=>x.trim()).filter(x=>!!x)
    .filter(x=>{
      if(/^--\s*\d+\s+of\s+\d+\s*--$/i.test(x))return false;
      if(/^DFL 2026 Minnesota Legislative Screening$/i.test(x))return false;
      if(/^Candidate for Minnesota Senate District\s+\d+$/i.test(x))return false;
      if(/^Yes\/No questions$/i.test(x))return false;
      if(/^Senate$/i.test(x))return false;
      if(normName(x)===normName(candidate))return false;
      // The footer repeats candidate + district; never treat it as an answer.
      if(normName(x)===target)return false;
      return true;
    });
}
const mark=/^(Yes|No|Not sure|Undecided)\s*\n\s*(Q(?:[1-9]|1\d|2[0-7])[a-z]?\.)\s*/gmi;
function yesNoAnswers(lines:readonly string[]):QuestionAnswer[]{
  const text=lines.join('\n');
  const hits=[...text.matchAll(mark)];
  const qa:QuestionAnswer[]=[];
  for(let i=0;i<hits.length;i++){
    const hit=hits[i];
    const qStart=hit.index!+hit[0].length;
    const qEnd=hits[i+1]?.index??text.length;
    let qBody=text.slice(qStart,qEnd).trim();
    // Some original forms print a neighboring prompt without an extractable
    // Yes/No mark. Omit THAT response rather than assigning the prior mark.
    const nextUnanswered=/\n\s*Q(?:[1-9]|1\d|2[0-7])[a-z]?\.\s*/i.exec(qBody);
    if(nextUnanswered)qBody=qBody.slice(0,nextUnanswered.index).trim();
    if(qBody.length<15||qBody.length>1600)continue;
    qa.push({ordinal:qa.length+1,question:hit[2]+' '+qBody,answer:hit[1]});
  }
  return qa;
}
function narrativeAnswers(lines:readonly string[]):QuestionAnswer[]{
  const m=lines.findIndex(x=>/^Q(?:1a|10|15|16|27)\.\s*/i.test(x));
  if(m<0)return [];
  const qNumber=/^(Q(?:1a|10|15|16|27)\.)\s*/i.exec(lines[m])?.[1];
  if(!qNumber)return [];
  const before=lines.slice(0,m).filter(x=>!/^\b(?:Jun|Jul|Aug|Sep|Oct)\s+\d{1,2},?\s+2026$/i.test(x));
  // When a form prints the question before the answer (Q27), the boundary
  // must be an actual question mark; otherwise we cannot split it safely.
  let question:string,answer:string;
  if(before.length){
    question=[lines[m],...lines.slice(m+1)].join('\n').trim();
    answer=before.join('\n').trim();
  }else{
    const tail=[lines[m],...lines.slice(m+1)].join('\n');
    const split=tail.indexOf('?');
    if(split<0)return [];
    question=tail.slice(0,split+1).trim();
    answer=tail.slice(split+1).trim();
  }
  if(question.length<15||question.length>1800||!answer||answer.length>15000
     ||/^Q\d+[a-z]?\./mi.test(answer))return [];
  return [{ordinal:1,question,answer}];
}
/** Parse only literal question/answer text; do not treat an unmarked cell
 * as opposition, agreement, refusal or a historically admissible position. */
export function parseEducationMinnesotaPdfPages(
  pages:readonly string[],source:Pick<QuestionnaireSource,'cycle'|'adapter'|'candidate'|'district'|'party'>,
):Parsed[]{
  if(source.adapter!=='edmn_pdf'||source.cycle!==2026||!source.candidate||!source.district
     ||pages.length<5||pages.length>20)throw Error('Invalid 2026 education questionnaire PDF configuration');
  const first=pages[0].replace(/\r/g,'\n').split(/\n/).map(s=>s.trim()).filter(Boolean);
  const label=first.findIndex(s=>/DFL 2026 Minnesota Legislative Screening/i.test(s));
  const printed=label>0?first[label-1]:null;
  const district=String(Number(source.district));
  if(!printed||normName(printed)!==normName(source.candidate))
    throw Error('PDF candidate name does not match original publisher link');
  if(!/Candidate for Minnesota Senate District\s+\d+/i.test(first.join(' ')))
    throw Error('PDF is not an original state Senate candidate screening');
  // Independently check the PDF footer's printed district, as layout text in
  // the header sometimes reorders "02" into "20".
  const footer=pages.some(p=>p.split(/\r?\n/).some(s=>
    normName(s.trim())===normName(printed)+' '+district));
  if(!footer)throw Error('PDF district footer conflicts with publisher Senate index');
  const submitted=dateShown(first.slice(label+1,label+8).join(' '));
  const all:QuestionAnswer[]=[];
  for(const [i,page] of pages.entries()){
    const lines=preparedLines(page,printed,district);
    const parsed=i<4?yesNoAnswers(lines):narrativeAnswers(lines);
    for(const row of parsed)all.push({...row,ordinal:all.length+1});
  }
  const distinct=new Set(all.map(x=>/^Q\d+[a-z]?\./i.exec(x.question)?.[0]?.toLowerCase()));
  if(all.length<15||all.length>40||distinct.size!==all.length)
    throw Error('Education PDF missing enough unambiguous ordered responses');
  return [{candidateName:printed,district,party:source.party??'DFL',displayedSubmittedOn:submitted,qa:all}];
}
