/**
 * Collect literal published Minnesota STATE Senate candidate questionnaire answers.
 * Not a vote/stance classifier. Neither fetchedAt nor displayed dates confer
 * historical feature eligibility. Publisher-only, bounded, fail-closed parsing.
 */
import { createHash } from 'node:crypto';
import { eligibleSenateQuestionnaireCandidate,HISTORICAL_QUESTIONNAIRE_WINNERS } from './senate-questionnaire-eligibility.js';
import {parseEducationMinnesotaPdfPages} from './senate-questionnaire-edmn-pdf.js';

export type Adapter='mhp_index'|'mhp'|'snap'|'kaxe'|'biofuels'|'biofuels_index'|'ballotpedia'|'wsp_reader'|'roseville_reader'|'mnrtl'|'startribune_2022'|'mpr_special_2024'|'sd60_pdf'|'edmn_pdf';
export interface QuestionnaireSource {
  id:string; publisher:string; cycle:number; adapter:Adapter; url:string; title:string;
  sourceKind:'publisher_response'|'candidate_copy'|'archived_response';
  candidate?:string; district?:string; party?:string; candidates?:string[];
  articleNames?:string[]; archiveCapturedAt?:string;
}
export interface QuestionAnswer { ordinal:number; question:string; answer:string }
export interface CandidateResponse {
  sourceId:string; publisher:string; sourceKind:QuestionnaireSource['sourceKind'];
  sourceUrl:string; electionCycle:number; title:string; candidateName:string;
  office:string; district:string|null; party:string|null;
  displayedPublicationOn:string|null; displayedSubmittedOn:string|null;
  archiveCapturedAt:string|null; fetchedAt:string; contentType:string;
  contentSha256:string; rawContent:string; qa:QuestionAnswer[];
}
export interface Failure { source:string;url:string;reason:string }
export interface CollectionSummary {
  attempted:number; fetched:number; responses:number; pairs:number;
  byCyclePublisher:Record<string,{responses:number;pairs:number}>;
  failed:Failure[]; explicitlyUnanswered:number; skippedHistoricalNonWinners:number;
}
export interface CollectionOptions {
  sources:QuestionnaireSource[]; maxSources?:number; maxBytes?:number;
  delayMs?:number; fetcher?:typeof fetch;
  onResponse:(item:CandidateResponse)=>Promise<void>;
}

export function sha256(raw:string):string {
  return createHash('sha256').update(raw).digest('hex');
}
function decode(value:string):string {
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',hellip:'…',bull:'•',rsquo2019:'’'};
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+);/gi,(orig,key:string)=>{
    if(key[0]==='#') {
      const v=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
      return v>0&&v<=0x10ffff&&!(v>=0xd800&&v<=0xdfff)?String.fromCodePoint(v):orig;
    }
    return named[key.toLowerCase()]??orig;
  });
}
function flatten(html:string):string {
  const clean=html.replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<(nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<br\b[^>]*\/?>/gi,'\n')
    .replace(/<\/(?:p|div|li|ul|ol|section|article|main|h[1-6]|tr|td|th|blockquote|figure|figcaption|time|strong|em|i)>/gi,'\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|tr|td|th|blockquote|figure|figcaption|time|strong|em|i)\b[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ');
  return decode(clean).replace(/\r/g,'').replace(/[ \t\f\v]+/g,' ')
    .replace(/[ \t]*\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n');
}
export function visibleLines(html:string):string[] {
  return flatten(html).split(/\n+/).map(s=>s.trim()).filter(Boolean);
}
const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
function dateFrom(text:string):string|null {
  const m=/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(text);
  const rev=/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i.exec(text);
  if(!m&&!rev)return null;
  const day=Number(m?m[2]:rev![1]),month=monthNames.findIndex(x=>x.startsWith((m?m[1]:rev![2]).slice(0,3).toLowerCase()))+1,year=Number(m?m[3]:rev![3]);
  const dt=new Date(Date.UTC(year,month-1,day));
  return dt.getUTCDate()===day&&dt.getUTCMonth()===month-1
    ?year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'):null;
}
function candidateValue(lines:string[],key:string):string|null {
  const index=lines.findIndex(v=>new RegExp('^'+key+'\\s*:', 'i').test(v));
  if(index<0)return null;
  const inline=lines[index].replace(new RegExp('^'+key+'\\s*:\\s*','i'),'').trim();
  return inline||lines[index+1]||null;
}
function districtNumber(input:string|null|undefined):string|null {
  if(!input)return null;
  const match=/(?:district\s*)?([1-9]|[1-5]\d|6[0-7])\b/i.exec(input);
  return match?String(Number(match[1])):null;
}
function qaFromParts(parts:Array<{q:string;a:string}>):QuestionAnswer[] {
  return parts.filter(p=>p.q.trim()&&p.a.trim()).map((p,i)=>({
    ordinal:i+1, question:p.q.trim(), answer:p.a.trim(),
  }));
}
function parseMhp(html:string,seed:QuestionnaireSource):Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  const lines=visibleLines(html);
  const title=/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i.exec(html);
  const name=seed.candidate|| (title?visibleLines(title[1]).join(' '):null);
  // WordPress renders the metadata label and its value in separate nodes.
  // Inspect adjacent visible lines rather than requiring one combined line.
  const marker=lines.findIndex(x=>/^Legislative District\s*:/i.test(x));
  const statedDistrict=marker>=0?lines.slice(marker,marker+4).join(' '):'';
  const senator=/\bSenate\s+District\s+([1-9]|[1-5]\d|6[0-7])\b/i.exec(statedDistrict);
  // The publisher's public Senate-index row can provide district metadata
  // when its individual answer page omits/reflows the repeated district label.
  // Require the exact linked candidate name and actual Q1 answer page before
  // using that publisher-index metadata; never infer a House response is Senate.
  const candidateShown=!!name&&lines.some(line=>line===name||line.startsWith(name+' '));
  const questionsShown=lines.some(line=>/^Q1\s*:/i.test(line));
  const district=senator?String(Number(senator[1])):
    (seed.candidate&&candidateShown&&questionsShown?districtNumber(seed.district):null);
  if(!name||!district||/\bHouse\s+District\s+\d+/i.test(statedDistrict)
    ||(seed.district&&districtNumber(seed.district)!==district))
    throw Error(questionsShown
      ?'Candidate/district Senate label mismatch on published response'
      :'No actual candidate questionnaire text in fetched publisher page');
  const party=candidateValue(lines,'Party')||seed.party||null;
  const start=lines.findIndex(x=>/^Q1\s*:/i.test(x));
  if(start<0)throw Error('No numbered candidate questions');
  const segment:string[][]=[];
  for(const line of lines.slice(start)) {
    if(/^Contact Us$/i.test(line)||/^©\s*20\d{2}/.test(line))break;
    if(/^Q\d{1,2}\s*:/i.test(line))segment.push([line.replace(/^Q\d{1,2}\s*:\s*/i,'')]);
    else if(segment.length && !/^\*\s+\*\s+\*$/.test(line))segment[segment.length-1].push(line);
  }
  const qa=qaFromParts(segment.map(parts=>{
    // Some publisher questions omit their terminal question mark. Never
    // search the candidate's answers for '?' to determine question bounds.
    const first=parts[0],mark=first.indexOf('?');
    if(mark>=0)return {q:first.slice(0,mark+1),a:[first.slice(mark+1),...parts.slice(1)].filter(Boolean).join('\n')};
    const continued=parts[1]&&/^(?:What|How|Which|Why|When|Will|Would|Could|Should|Do|Does|Are|If)\b/i.test(parts[1])
      &&parts[1].includes('?');
    if(continued)return {q:first+'\n'+parts[1],a:parts.slice(2).join('\n')};
    return {q:first,a:parts.slice(1).join('\n')};
  }));
  if(qa.length<2)throw Error('MHP questionnaire missing multiple complete Q&A pairs');
  return [{candidateName:name,party,district,qa}];
}
function parseSnap(html:string):Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  const lines=visibleLines(html);
  // On real SNAP WordPress pages "Minnesota" is a link displayed on its
  // own line, before "State Senate District 65".
  const header=lines.findIndex(s=>/^(?:Minnesota\s+)?State Senate District\s+\d+/i.test(s));
  if(header<2||header>50)throw Error('Not a Minnesota State Senate respondent page');
  const district=districtNumber(lines[header]);
  const separateState=lines[header-1]==='Minnesota';
  const party=lines[header-(separateState?2:1)];
  const candidateName=lines[header-(separateState?3:2)];
  if(!candidateName||!district)throw Error('SNAP candidate metadata missing');
  if(lines.some(s=>/^This candidate did not respond to Stance on Science/i.test(s)))
    return [];
  const submitted=lines.slice(header+1,header+5).find(s=>/^Submitted\s+/i.test(s));
  const pieces:string[][]=[];
  for(const line of lines.slice(header+1)) {
    if(/^To find your districts|^About$|^Contact$|^Early-career researchers/i.test(line))break;
    if(/^Q\d{1,2}\s/i.test(line))pieces.push([line.replace(/^Q\d{1,2}\s+/i,'')]);
    else if(pieces.length)pieces[pieces.length-1].push(line);
  }
  const topics=new Set(['Trust in Science','Environment','Artificial Intelligence','Science Funding','Public Health']);
  const qa=qaFromParts(pieces.map(part=>{
    const q=part[0],tail=part.slice(1);
    while(tail.length && topics.has(tail[0]))tail.shift();
    const answer:string[]=[];
    for(const line of tail) {
      if(/^KEYWORDS\s*:/i.test(line))break;
      if(topics.has(line)&&!answer.length)continue;
      answer.push(line);
    }
    return {q,a:answer.join('\n')};
  }));
  if(qa.length<2)throw Error('SNAP page had no sufficiently complete answers');
  return [{candidateName,district,party,displayedSubmittedOn:submitted?dateFrom(submitted):null,qa}];
}
const kaxeQuestions=[
  /^Please share any prior experience and education/i,
  /^Why are you running\?/i,
  /^Why should voters elect you\?/i,
  /^What are your top three priorities/i,
  /^Name a public leader you admire/i,
  /^What natural resources policies/i,
  /^What policies do you support to address concerns/i,
  /^What policies would you champion to help alleviate/i,
  /^What does representative democracy mean to you/i,
];
function parseKaxe(html:string,seed:QuestionnaireSource):Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(!seed.candidates?.length||!seed.district)throw Error('KAXE Senate district/candidate source not configured');
  const lines=visibleLines(html);
  if(!lines.some(line=>/(?:state\s+)?Senate District\s+\d+\b/i.test(line)))throw Error('KAXE page not about State Senate');
  const start=lines.findIndex(x=>/Click the tabs below to learn more about the candidates/i.test(x));
  if(start<0)throw Error('KAXE candidate tab section not found');
  const remaining=lines.slice(start+1);
  const positions=seed.candidates.map(name=>{
    const indices=remaining.flatMap((line,i)=>line===name?[i]:[]);
    const matches=indices.filter(i=>remaining.slice(i+1,i+14).some(x=>/^Party:\s+\S/i.test(x)));
    return {name,index:matches.at(-1)??-1};
  }).filter(p=>p.index>=0).sort((a,b)=>a.index-b.index);
  const found:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  for(const [i,p] of positions.entries()) {
    const end=positions[i+1]?.index??remaining.findIndex((x,j)=>j>p.index&&/^Return to Election Guide$/i.test(x));
    const section=remaining.slice(p.index+1,end>p.index?end:undefined);
    if(section.some(x=>/KAXE did not receive a response from this candidate/i.test(x)))continue;
    const party=candidateValue(section,'Party');
    const pairs:Array<{q:string;a:string}>=[];
    let current:{q:string;a:string[]}|undefined;
    for(const line of section) {
      if(kaxeQuestions.some(re=>re.test(line))) {
        if(current)pairs.push({q:current.q,a:current.a.join('\n')});
        current={q:line,a:[]};
      } else if(current && !/^(?:Website|Party|Age on Election Day|Community|Employment)\s*:/i.test(line))
        current.a.push(line);
    }
    if(current)pairs.push({q:current.q,a:current.a.join('\n')});
    const qa=qaFromParts(pairs);
    if(qa.length<2)continue;
    found.push({candidateName:p.name,district:districtNumber(seed.district),party,qa,
      displayedPublicationOn:dateFrom(lines.find(x=>/^Published\s+/i.test(x))??'')});
  }
  if(!found.length)throw Error('KAXE State Senate article yielded no respondent Q&A');
  return found;
}
function parseBiofuels(html:string,seed:QuestionnaireSource):Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  const lines=visibleLines(html);
  const candidates:Array<{index:number;name:string;district:string;party:string}>=[];
  for(const [index,line] of lines.entries()) {
    const match=/([A-Z][A-Za-z.’'\s-]{3,75}?)\s*\(([DRI])\)\s*District\s+(\d{1,2}[AB]?)\s*$/i.exec(line);
    if(!match||/[AB]$/i.test(match[3]))continue; // State House answers never belong here.
    let name=match[1].replace(/^.*?(?:image:\s*|cropped\s*)/i,'').replace(/^(?:Image|Photo)\s*/i,'').trim();
    // Captions sometimes fuse thumbnail names into the candidate heading.
    if(seed.candidates?.length) {
      const expected=seed.candidates.find(n=>name.toLowerCase().includes(n.split(/\s+/).at(-1)!.toLowerCase()));
      if(!expected)continue;
      const surname=expected.split(/\s+/).at(-1)!.toLowerCase();
      const m=new RegExp('([A-Za-z.’\\x27-]+(?:\\s+[A-Za-z.’\\x27-]+){0,4}\\s+'+surname+')$','i').exec(name);
      if(m)name=m[1];
    }
    if(name.length>80||name.length<4)continue;
    if(candidates.some(x=>x.index===index))continue;
    candidates.push({index,name,district:districtNumber(match[3])!,party:match[2]});
  }
  const result:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  for(const [idx,c] of candidates.entries()) {
    const section=lines.slice(c.index+1,candidates[idx+1]?.index??undefined);
    const qaPieces:Array<{q:string[];a:string[]}>=[];let phase:'none'|'q'|'a'='none';
    for(const line of section) {
      if(/^Q\.\s*/i.test(line)) {
        qaPieces.push({q:[line.replace(/^Q\.\s*/i,'')],a:[]});phase='q';
      } else if(/^A\.\s*/i.test(line)&&qaPieces.length) {
        qaPieces[qaPieces.length-1].a.push(line.replace(/^A\.\s*/i,''));phase='a';
      } else if(qaPieces.length && phase==='q')qaPieces[qaPieces.length-1].q.push(line);
      else if(qaPieces.length && phase==='a') {
        if(/^Read more|^Published in|^Tagged under|^Share this|^Related stories|^©/i.test(line))break;
        qaPieces[qaPieces.length-1].a.push(line);
      }
    }
    const qa=qaFromParts(qaPieces.map(p=>({q:p.q.join('\n'),a:p.a.join('\n')})));
    if(qa.length>=2)result.push({candidateName:c.name,district:c.district,party:c.party,qa});
  }
  if(!result.length)throw Error('No individual Minnesota State Senate Q&A sections found');
  const published=lines.find(x=>/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\s+\w+\s+20\d{2}/i.test(x));
  for(const c of result) {
    c.displayedPublicationOn=dateFrom(published??'');
  }
  return result;
}

/** Published local-news candidate questionnaires with multiple respondents per question. */
function parseWestSaintPaulReader(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>{
  if(!seed.candidates?.length||!seed.district)throw Error('Local Senate candidates/district not catalogued');
  const lines=visibleLines(html);
  const title='2026 Election: Minnesota Senate District '+Number(seed.district);
  if(!lines.some(l=>l===title))throw Error('Not the original State Senate questionnaire article');
  const start=lines.findIndex(x=>/^Candidate Questions$/i.test(x));
  const end=lines.findIndex((x,i)=>i>start&&/^More Information$/i.test(x));
  if(start<0||end<start+5)throw Error('No complete Senate candidate questionnaire section');
  const candidates=seed.candidates;
  const answers=new Map<string,Array<{question:string;answer:string[]}>>();
  const parties=new Map<string,string>();
  const candidateItems=[...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m=>visibleLines(m[1]).join(' '));
  for(const name of candidates){
    const item=candidateItems.find(x=>x.startsWith(name+' ')&&/\s[–—-]\s/.test(x));
    const match=item?.match(/(?:–|—|-)\s*(DFL|GOP|Republican|Democratic|Independent)\b/i);
    if(match)parties.set(name,match[1]);
  }
  let question:string|null=null;
  let active:{question:string;answer:string[]}|null=null;
  for(const line of lines.slice(start+1,end)){
    if(/^(?:Help Inform Voters|Lightning Round|Support Local News|Join Now)$/i.test(line)){
      question=null;active=null;continue;
    }
    if(/^(?:Priorities|Local funding|Fraud|Housing|Immigration|Transparency):\s*.+\?/i.test(line)
      ||/^(?:[1-9]|10)\.\s+.+\?/i.test(line)){
      question=line;active=null;continue;
    }
    if(!question)continue;
    const named=candidates.find(name=>line.startsWith(name+':'));
    if(named){
      const answer=line.slice(named.length+1).trim();
      const row={question,answer:answer?[answer]:[]};
      const rows=answers.get(named)??[];rows.push(row);answers.set(named,rows);
      active=row;
    }else if(active && !/^Support:|^Local election coverage|^See our full voter|^Join now/i.test(line)){
      active.answer.push(line);
    }
  }
  const published=dateFrom(lines.find(x=>/^((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*20\d{2})$/i.test(x))??'');
  const records:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  for(const candidateName of candidates) {
    const qa=qaFromParts((answers.get(candidateName)??[]).map(x=>({q:x.question,a:x.answer.join('\n')})));
    if(qa.length<2)continue;
    records.push({candidateName,qa,district:districtNumber(seed.district),party:parties.get(candidateName)??null,
      displayedPublicationOn:published});
  }
  if(!records.length)throw Error('No complete local Senate candidate questionnaires parsed');
  return records;
}

const rosevillePrompts=[
  /^Why are you running for elected office\?/i,
  /^What are some of your legislative priorities for the next legislative session\?/i,
  /^How would you work to make life better for ordinary people living in the Roseville area\?/i,
  /^What are your priorities when it comes to public education\?/i,
  /^How do you plan to connect with residents in the Roseville area and their local city leaders/i,
  /^What else do you want voters in the Roseville area to know about you\?/i,
];
/** Extract only answers under question headings, not editorial candidate summaries. */
function parseRosevilleReader(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(!seed.candidates?.length||!seed.district)throw Error('Unconfigured local Senate candidate listing');
  const lines=visibleLines(html);
  const heading='Minnesota Senate District '+seed.district+' candidate guide';
  if(!lines.some(x=>x.toLowerCase()===heading.toLowerCase())
    && !new RegExp('Minnesota Senate District\\s+'+seed.district+'\\b','i').test(html))
    throw Error('Not the named 2026 original publisher State Senate guide');
  const headers=seed.candidates.map(name=>{
    const index=lines.findIndex(s=>s.toLowerCase()===name.toLowerCase() ||
      s.toLowerCase()===(name+' (incumbent)').toLowerCase());
    return {candidateName:name,index};
  }).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index);
  const result:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  for(const [i,c] of headers.entries()) {
    const stop=headers[i+1]?.index??lines.length;
    const section=lines.slice(c.index+1,stop);
    const firstQ=section.findIndex(x=>rosevillePrompts.some(re=>re.test(x)));
    if(firstQ<0)continue; // Explicit nonresponse or no published answers.
    const party=section.slice(0,firstQ).find(s=>
      /^(?:Republican|Democratic(?:[- ]Farmer[- ]Labor)?|DFL|Independent)$/i.test(s))??null;
    const parts:Array<{q:string;a:string[]}>=[];let current:{q:string;a:string[]}|undefined;
    for(const line of section.slice(firstQ)) {
      if(/^(?:Candidate Forum(?: & Speakouts)?|Prepare to Vote|Additional Roseville-specific election coverage|Sign up for The Roseville Reader|Read more)$/i.test(line))break;
      if(rosevillePrompts.some(re=>re.test(line))) {
        if(current)parts.push(current);
        current={q:line,a:[]};
      } else if(current && !/^(?:Questionnaire Responses:?|Campaign website)$/i.test(line)) {
        current.a.push(line);
      }
    }
    if(current)parts.push(current);
    const qa=qaFromParts(parts.map(p=>({q:p.q,a:p.a.join('\n')})));
    if(qa.length<4)continue;
    const shownDate=lines.find(x=>/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\b/i.test(x));
    result.push({candidateName:c.candidateName,party,district:districtNumber(seed.district),
      displayedPublicationOn:dateFrom(shownDate??''),qa});
  }
  if(!result.length)throw Error('No original Roseville State Senate Q&A returned');
  return result;
}

/** Publisher prints full six multi-paragraph survey questions and individual
 * State Senate response rows. Do not include its House/Congress respondents,
 * scorecards, commentary, or a seventh answer without a displayed Q7 prompt.
 */
function parseMnRightToLife(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(seed.cycle!==2026)throw Error('Unsupported election year for published MNRTL table');
  const lines=visibleLines(html);
  if(!lines.some(s=>/^2026 Primary Survey Results$/i.test(s)))
    throw Error('Not the published 2026 legislative primary survey results');
  const questionStarts=Array.from({length:6},(_,i)=>lines.findIndex(s=>
    new RegExp('^Question\\s+'+(i+1)+'$','i').test(s)));
  if(questionStarts.some(i=>i<0)||questionStarts.some((i,n)=>n>0&&i<=questionStarts[n-1]))
    throw Error('Publisher six original survey questions unavailable in order');
  const end=lines.findIndex((x,i)=>i>questionStarts[5]&&/^Scroll to the right to see all the results/i.test(x));
  const originalQuestions=questionStarts.map((from,i)=>{
    const to=i<5?questionStarts[i+1]:(end>from?end:lines.length);
    return lines.slice(from+1,to).join('\n').trim();
  });
  if(originalQuestions.some(q=>q.length<25))throw Error('Full original publisher question content missing');
  const result:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  const unique=new Set<string>();
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(x=>visibleLines(x[1]).join('\n').trim());
    if(cells.length<17)continue;
    if(!/^Minnesota Senate$/i.test(cells[9]))continue;
    if(cells[1].replace(/,/g,'')!=='2026')continue;
    const name=[cells[5],cells[6]].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
    const district=districtNumber(cells[8]);
    if(!name||!district||name.length>130)continue;
    const seenKey=seed.cycle+'|'+district+'|'+name.toLowerCase();
    if(unique.has(seenKey))continue;
    unique.add(seenKey);
    const answers=cells.slice(10,16);
    if(answers.length!==6||answers.some(a=>!a))continue;
    const qa=originalQuestions.map((question,ordinal)=>({
      ordinal:ordinal+1,question,answer:answers[ordinal],
    }));
    const date=dateFrom(cells[4]);
    result.push({candidateName:name,district,party:cells[7]||null,
      displayedSubmittedOn:date,qa});
  }
  if(!result.length)throw Error('Publisher survey table contained no readable State Senate respondent rows');
  return result;
}


/**
 * Publisher-edited answers exactly as printed in the original 2022 newspaper
 * candidate guide. These are NOT represented as unedited survey submissions.
 * Only Senate districts 3 and 8, never the House/County sections.
 */
function parseStarTribune2022(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(seed.cycle!==2022||seed.id!=='startribune-2022-duluth-senate')
    throw Error('Not the identified original 2022 Duluth Senate guide');
  const lines=visibleLines(html);
  if(!lines.some(s=>/Questions on candidates\? Here.s a guide to Duluth area elections/i.test(s))
    ||!lines.some(s=>/Answers were edited for length/i.test(s)))
    throw Error('Publisher 2022 original article and edited-response disclosure unavailable');
  const named=new Map<string,{district:string;party:string}>([
    ['Grant Hauschild',{district:'3',party:'DFL'}],
    ['Andrea Zupancich',{district:'3',party:'R'}],
    ['Jen McEwen',{district:'8',party:'DFL'}],
    ['Alex Moe',{district:'8',party:'R'}],
  ]);
  const answerStarts=[
    'Why are you running?',
    'Top three issues facing your district and plans to address them:',
    'Top three issues facing your district?',
    'Plans to address those issues?',
  ];
  const sourceDate=dateFrom(lines.find(s=>/\bOctober 27,\s*2022\b/i.test(s))??'');
  const out:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>= [];
  let district:string|null=null,activeName:string|null=null;
  let answer:{q:string;a:string[]}|null=null,parts:Array<{q:string;a:string[]}>=[],skipSidebar=false;
  function flush():void {
    if(answer)parts.push(answer);
    if(activeName) {
      const meta=named.get(activeName)!;
      const qa=qaFromParts(parts.map(p=>({q:p.q,a:p.a.join('\n')})));
      if(qa.length>=2 && eligibleSenateQuestionnaireCandidate(seed.cycle,activeName,meta.district,seed.url))
        out.push({candidateName:activeName,district:meta.district,
          party:meta.party,displayedPublicationOn:sourceDate,qa});
    }
    activeName=null;parts=[];answer=null;
  }
  for(const line of lines){
    const section=/^(?:State\s+)?Senate District\s+(\d+)$/i.exec(line);
    if(section){flush();district=section[1];continue;}
    if(/^State House District\b|^House District\b|^County Board\b|^St\. Louis County\b/i.test(line)){
      flush();district=null;continue;
    }
    if(!district||!['3','8'].includes(district))continue;
    const namedEntry=[...named].find(([n,meta])=>meta.district===district &&
      line.toLowerCase().startsWith(n.toLowerCase()+' ('));
    if(namedEntry){flush();activeName=namedEntry[0];continue;}
    if(!activeName)continue;
    if(/^Did not respond to questionnaire\.?$/i.test(line)){flush();continue;}
    if(/^Website\s*:/i.test(line)){flush();continue;}
    if(/^Most Read$/i.test(line)){skipSidebar=true;continue;}
    if(skipSidebar) {
      if(/^Getting our Fair Share for the Northland:/i.test(line)){skipSidebar=false;}
      else continue;
    }
    if(/^(?:Advertisement|Comment Gift Share|Listen Print|More Headlines|##)$/i.test(line))continue;
    const prompt=answerStarts.find(s=>line.toLowerCase().startsWith(s.toLowerCase()));
    if(prompt){
      if(answer)parts.push(answer);
      answer={q:prompt,a:[line.slice(prompt.length).trim()].filter(Boolean)};
    } else if(answer && !/^(?:Age|Occupation|Education(?:al background)?|City of residence|Family|Experience)\s*:/i.test(line)){
      answer.a.push(line);
    }
  }
  flush();
  if(!out.length)throw Error('No original edited 2022 Senate candidate answers readable from publisher');
  return out;
}

/** MPR's 2024 special election page is often an unhydrated index. Never
 * treat its candidate introduction as survey answers or infer missing text. */
function parseMprSpecial2024(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(seed.cycle!==2024||seed.district!=='45')throw Error('Not SD45 special election');
  const lines=visibleLines(html);
  if(!lines.some(s=>/^State Senate:\s*District 45$/i.test(s)) ||
    !lines.some(s=>/three-question survey/i.test(s)))
    throw Error('Not the original SD45 MPR survey');
  const questionHeads=lines.filter(s=>/^(?:Question\s*[1-3]\s*[:.]|Why\s|What\s|How\s).+\?$/.test(s));
  if(questionHeads.length!==3)
    throw Error('2024 MPR special-election Q&A only appears in unavailable interactive content');
  const candidates=['Ann Johnson Stewart']; // The 2024 SD45 special-election winner only.
  const answers=new Map(candidates.map(n=>[n,[] as QuestionAnswer[]]));
  let question:string|null=null;
  for(const line of lines){
    if(questionHeads.includes(line)){question=line;continue;}
    if(!question)continue;
    for(const name of candidates)if(line.startsWith(name+':')){
      const answer=line.slice(name.length+1).trim();
      if(answer)answers.get(name)!.push({ordinal:answers.get(name)!.length+1,question,answer});
    }
  }
  const records=candidates.map(candidateName=>({
    candidateName,district:'45',party:candidateName==='Kathleen Fowke'?'R':'DFL',
    displayedPublicationOn:null,qa:answers.get(candidateName)!,
  })).filter(row=>row.qa.length>=2);
  if(!records.length)throw Error('MPR source published no machine-readable complete special-election responses');
  return records;
}

/** Strictly parse numbered, text-selectable, candidate-named original SD60
 * endorsement forms. The actual PDF bytes remain stored losslessly in base64. */
export function parseSd60PdfText(text:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(seed.cycle!==2025||seed.adapter!=='sd60_pdf'||seed.district!=='60'||!seed.candidate
    ||!eligibleSenateQuestionnaireCandidate(seed.cycle,seed.candidate,seed.district,seed.url))
    throw Error('Unconfigured or nonwinning special-election candidate PDF');
  const lines=text.replace(/\r/g,'\n').split(/\n/).map(s=>s.trim())
    .filter(s=>!!s&&!/^--\s*\d+\s+of\s+\d+\s*--$/i.test(s));
  const name=seed.candidate;
  const normalized=(x:string)=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z]+/g,' ').trim();
  // A link alone is not an identity proof; the published PDF must print its name.
  if(!normalized(lines.slice(0,120).join(' ')).includes(normalized(name)))
    throw Error('Public SD60 document does not name the configured candidate');
  if(!/(?:endorsement|questionnaire|senate district\s*60|sd\s*60)/i.test(lines.join(' ').slice(0,2000)))
    throw Error('Not a named SD60 candidate questionnaire');
  const parts:Array<{q:string;a:string[]}>=[];
  let current:{q:string;a:string[]}|null=null;
  let waiting:{num:number;lines:string[]}|null=null;
  function push():void{if(current){parts.push(current);current=null;}}
  for(const line of lines){
    const first=/^(?:Question\s*)?(\d{1,2})[.):]\s+(.+)$/i.exec(line);
    if(first&&Number(first[1])>=1&&Number(first[1])<=30){
      if(waiting){
        // Another numbered prompt appeared before an unambiguous question mark.
        waiting=null;
      }
      const body=first[2].trim();
      if(body.includes('?')){push();current={q:body,a:[]};}
      else {push();waiting={num:Number(first[1]),lines:[body]};}
      continue;
    }
    if(waiting){
      if(waiting.lines.length>=8){waiting=null;continue;}
      waiting.lines.push(line);
      if(line.includes('?')){current={q:waiting.lines.join('\n'),a:[]};waiting=null;}
      continue;
    }
    if(current)current.a.push(line);
  }
  push();
  const qa=qaFromParts(parts.map(p=>({q:p.q,a:p.a.join('\n')})));
  if(qa.length<2)throw Error('PDF did not contain two or more legible numbered original question-and-answer pairs');
  return [{candidateName:name,district:'60',party:seed.party??'DFL',qa}];
}

export function parseResponses(html:string,seed:QuestionnaireSource):
Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}> {
  if(seed.adapter==='mhp')return parseMhp(html,seed);
  if(seed.adapter==='snap')return parseSnap(html);
  if(seed.adapter==='kaxe')return parseKaxe(html,seed);
  if(seed.adapter==='wsp_reader')return parseWestSaintPaulReader(html,seed);
  if(seed.adapter==='roseville_reader')return parseRosevilleReader(html,seed);
  if(seed.adapter==='mnrtl')return parseMnRightToLife(html,seed);
  if(seed.adapter==='startribune_2022')return parseStarTribune2022(html,seed);
  if(seed.adapter==='mpr_special_2024')return parseMprSpecial2024(html,seed);
  if(seed.adapter==='sd60_pdf'||seed.adapter==='edmn_pdf')throw Error('PDF documents must be parsed from original source bytes');
  if(seed.adapter==='biofuels')return parseBiofuels(html,seed);
  // Historical Ballotpedia pages are fetched, but do not silently convert
  // article quote excerpts or survey indexes into full question/answer records.
  if(seed.adapter==='ballotpedia')throw Error('Full Ballotpedia candidate survey unavailable or unparseable; leave uncollected');
  throw Error('Index is not a candidate response');
}
export function mhpLinks(html:string,seed:QuestionnaireSource):QuestionnaireSource[] {
  const sources:QuestionnaireSource[]=[];
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>x[1]);
    if(cells.length<4||visibleLines(cells[1]).join(' ').trim()!=='Senate')continue;
    const href=/\bhref\s*=\s*["']([^"']+)["']/i.exec(cells[0]);
    if(!href)continue;
    const url=new URL(decode(href[1]),seed.url);
    if(url.protocol!=='https:'||url.hostname!=='mhponline.org'
      ||!url.pathname.startsWith('/2026_questionnaire/')||url.search)continue;
    const candidate=visibleLines(cells[0]).join(' ').trim();
    if(!candidate||candidate.length>120)continue;
    const district=districtNumber(visibleLines(cells[3]).join(' '));
    if(!district)continue;
    sources.push({...seed,id:seed.id+'-'+sources.length,adapter:'mhp',url:url.href,
      candidate,district,party:visibleLines(cells[2]).join(' ')});
  }
  if(!sources.length)throw Error('No actual linked MHP Senate candidate responses found (never use submission form)');
  return sources;
}
export function biofuelsLinks(html:string,seed:QuestionnaireSource):QuestionnaireSource[] {
  const sources:QuestionnaireSource[]=[];const seen=new Set<string>();
  for(const a of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label=visibleLines(a[2]).join(' ').replace(/\s+/g,' ');
    if(!/Candidates\s*&\s*Biofuels\s*:/i.test(label))continue;
    if(!seed.articleNames?.some(name=>label.toLowerCase().includes(name.toLowerCase())))continue;
    const url=new URL(decode(a[1]),seed.url);
    if(url.protocol!=='https:'||!['www.mnbiofuels.org','mnbiofuels.org'].includes(url.hostname)
      ||seen.has(url.href))continue;
    seen.add(url.href);
    sources.push({...seed,id:seed.id+'-'+sources.length,adapter:'biofuels',url:url.href});
  }
  if(!sources.length)throw Error('2020 original Senate questionnaire archive links not accessible');
  return sources.slice(0,12);
}
export function validateCatalog(value:unknown):QuestionnaireSource[] {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected source catalog object');
  const doc=value as {schemaVersion?:unknown;sources?:unknown};
  if(doc.schemaVersion!==1||!Array.isArray(doc.sources)||!doc.sources.length||doc.sources.length>120)
    throw Error('Invalid version or source list');
  const ids=new Set<string>(),urls=new Set<string>();
  const allow:Record<Adapter,string[]>={
    mhp_index:['mhponline.org'],mhp:['mhponline.org'],
    snap:['snapcoalition.org'],kaxe:['www.kaxe.org'],
    wsp_reader:['weststpaulreader.com'],
    roseville_reader:['www.rosevillereader.com'],
    mnrtl:['www.mnrtl.org'],
    biofuels:['mnbiofuels.org','www.mnbiofuels.org'],
    biofuels_index:['mnbiofuels.org','www.mnbiofuels.org'],
    ballotpedia:['ballotpedia.org'],
    startribune_2022:['www.startribune.com'],
    mpr_special_2024:['www.mprnews.org'],
    sd60_pdf:['drive.google.com'],
    edmn_pdf:['www.edmnvotes.org'],
  };
  return doc.sources.map((input:unknown)=>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Malformed catalog item');
    const s=input as QuestionnaireSource;
    if(!s.id||!s.publisher||!s.title||!s.url||!allow[s.adapter]
      ||!Number.isInteger(s.cycle)||s.cycle<2020||s.cycle>2026
      ||!['publisher_response','candidate_copy','archived_response'].includes(s.sourceKind))
      throw Error('Invalid questionnaire source fields');
    const u=new URL(s.url);
    if(u.protocol!=='https:'||!allow[s.adapter].includes(u.hostname)||u.username||u.password||u.hash)
      throw Error('Out-of-scope candidate questionnaire URL');
    if(s.adapter==='edmn_pdf' && (s.cycle!==2026||!s.candidate||!s.district
      ||!/^\/wp-content\/uploads\/2026\/(?:0[1-9]|1[0-2])\/[0-9]{2}-[a-zA-Z0-9-]+\.pdf$/.test(u.pathname)
      ||u.search||!districtNumber(s.district)))
      throw Error('2026 Education Minnesota source must be a direct original Senate screening PDF');
    if(ids.has(s.id)||urls.has(s.cycle+'|'+u.href))throw Error('Duplicate catalog source');
    ids.add(s.id);urls.add(s.cycle+'|'+u.href);
    if(s.archiveCapturedAt&&!/^\d{4}-\d\d-\d\dT/i.test(s.archiveCapturedAt))
      throw Error('Archive timestamp must be explicit original observation');
    // Fail closed during source discovery too: a historical catalog cannot
    // silently reintroduce losing candidates or rely on primary-only winners.
    if([2022,2024,2025].includes(s.cycle)) {
      const candidates=s.candidate?[s.candidate]:(s.candidates??[]);
      if(!candidates.length||candidates.some(candidate=>
        !HISTORICAL_QUESTIONNAIRE_WINNERS.some(w=>w.cycle===s.cycle
          && eligibleSenateQuestionnaireCandidate(s.cycle,candidate,w.district)
          && (!s.district||districtNumber(s.district)===w.district))))
        throw Error('Historical questionnaire catalog includes an unconfirmed election loser');
    }
    return s;
  }).sort((a,b)=>b.cycle-a.cycle);
}
const agent='VotePredict research collector/1.0 (public Minnesota Senate questionnaire citations)';
type SourceDownload={html:string;contentType:string;pdfBytes?:Uint8Array};
async function fetchBounded(
  seed:QuestionnaireSource,limit:number,runFetch:typeof fetch,
):Promise<SourceDownload> {
  const source=new URL(seed.url);
  const pdf=seed.adapter==='sd60_pdf'||seed.adapter==='edmn_pdf';
  // The publicly linked SD60 questionnaires are original Google Drive files.
  // Anonymous /uc download is the documented standard public-file delivery
  // endpoint; it is NOT a workaround for login or download restrictions.
  const drivePdf=seed.adapter==='sd60_pdf';
  const pdfId=drivePdf ? /^\/file\/d\/([a-zA-Z0-9_-]+)\/view\/?$/.exec(source.pathname)?.[1] : null;
  if(drivePdf&&!pdfId)throw Error('Unexpected Drive original PDF link format');
  const url=drivePdf?'https://drive.google.com/uc?export=download&id='+pdfId:seed.url;
  const response=await runFetch(url,{
    redirect:'follow',signal:AbortSignal.timeout(25000),
    headers:{'User-Agent':agent,Accept:pdf?'application/pdf':'text/html,application/xhtml+xml;q=0.9'},
  });
  if(!response.ok)throw Error('HTTP '+response.status);
  const effective=new URL(response.url||url);
  const samePublisher=effective.protocol==='https:' &&
    effective.hostname.replace(/^www\./,'')===source.hostname.replace(/^www\./,'');
  const googleDelivery=drivePdf && effective.protocol==='https:' &&
    effective.hostname==='drive.usercontent.google.com';
  if(!samePublisher&&!googleDelivery)throw Error('Cross-host redirect is not a trusted publisher response');
  if(Number(response.headers.get('content-length')||0)>limit)throw Error('Exceeded content byte cap');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>limit)throw Error('Exceeded content byte cap');
  const type=response.headers.get('content-type')||'';
  if(pdf){
    if(bytes.length<200||new TextDecoder('ascii').decode(bytes.subarray(0,5))!=='%PDF-')
      throw Error('Original publisher did not deliver a directly downloadable PDF (no access bypass)');
    return {html:'',contentType:'application/pdf;base64',pdfBytes:bytes};
  }
  if(!/html|text\/plain/i.test(type))throw Error('Not a readable HTML response ('+type.slice(0,60)+')');
  return {html:new TextDecoder().decode(bytes),contentType:type};
}
export async function collectQuestionnaires(options:CollectionOptions):Promise<CollectionSummary> {
  const runFetch=options.fetcher??fetch;
  const max=options.maxSources??180,limit=options.maxBytes??2_000_000;
  if(!Number.isInteger(max)||max<1||max>500||limit<1024||limit>5_000_000)
    throw Error('Bounded source and size limits required');
  const queue=[...options.sources],visited=new Set<string>();
  const downloads=new Map<string,Promise<SourceDownload>>();
  const summary:CollectionSummary={attempted:0,fetched:0,responses:0,pairs:0,byCyclePublisher:{},failed:[],explicitlyUnanswered:0,skippedHistoricalNonWinners:0};
  while(queue.length && summary.attempted<max) {
    const seed=queue.shift()!;
    const visitKey=seed.cycle+'|'+seed.adapter+'|'+seed.url;
    if(visited.has(visitKey))continue;
    visited.add(visitKey);summary.attempted++;
    try{
      let download=downloads.get(seed.url);
      if(!download){
        download=fetchBounded(seed,limit,runFetch);
        downloads.set(seed.url,download);
      }
      const {html,contentType,pdfBytes}=await download;
      summary.fetched++;
      if(seed.adapter==='mhp_index'||seed.adapter==='biofuels_index'){
        const children=seed.adapter==='mhp_index'?mhpLinks(html,seed):biofuelsLinks(html,seed);
        queue.unshift(...children);
        continue;
      }
      if(/JavaScript is disabled[\s\S]{0,500}verify that you.re not a robot/i.test(html))
        throw Error('Publisher anti-bot interstitial; no bypass attempted');
      let records:Array<Partial<CandidateResponse>&{candidateName:string;qa:QuestionAnswer[]}>;
      let rawContent=html,contentSha256=sha256(html);
      if(seed.adapter==='sd60_pdf'||seed.adapter==='edmn_pdf'){
        if(!pdfBytes)throw Error('No original publicly delivered PDF bytes');
        // Preserve the EXACT original binary in a reversible base64 column,
        // because the existing append-only raw_content field is PostgreSQL text.
        // Hash before pdf-parse can transfer/detach its input ArrayBuffer.
        rawContent=Buffer.from(pdfBytes).toString('base64');
        contentSha256=createHash('sha256').update(pdfBytes).digest('hex');
        const {PDFParse}=await import('pdf-parse');
        const {CanvasFactory}=await import('pdf-parse/worker');
        const parser=new PDFParse({data:pdfBytes.slice(),CanvasFactory});
        try{
          const pageText=await parser.getText();
          records=seed.adapter==='edmn_pdf'
            ? parseEducationMinnesotaPdfPages(pageText.pages.map(p=>p.text),seed)
            : parseSd60PdfText(pageText.text,seed);
        }
        finally{await parser.destroy();}
      }else records=parseResponses(html,seed);
      if(!records.length && /did not respond|no response from this candidate/i.test(html))
        summary.explicitlyUnanswered++;
      for(const parsed of records) {
        const candidateDistrict=parsed.district??districtNumber(seed.district);
        // Current 2026 election: retain everyone. Completed earlier elections:
        // no historical losing candidate can reach onResponse or storage.
        if(!eligibleSenateQuestionnaireCandidate(seed.cycle,parsed.candidateName,candidateDistrict,seed.url)){
          summary.skippedHistoricalNonWinners++;
          continue;
        }
        const item:CandidateResponse={
          sourceId:seed.id,publisher:seed.publisher,sourceKind:seed.sourceKind,
          sourceUrl:seed.url,electionCycle:seed.cycle,title:seed.title,
          candidateName:parsed.candidateName,office:'Minnesota State Senate',
          district:candidateDistrict,
          party:parsed.party??seed.party??null,
          displayedPublicationOn:parsed.displayedPublicationOn??null,
          displayedSubmittedOn:parsed.displayedSubmittedOn??null,
          archiveCapturedAt:seed.archiveCapturedAt??null,
          fetchedAt:new Date().toISOString(),contentType,
          contentSha256,rawContent,qa:parsed.qa,
        };
        await options.onResponse(item);
        summary.responses++;
        summary.pairs+=item.qa.length;
        const k=item.electionCycle+'|'+item.publisher;
        const rec=summary.byCyclePublisher[k]??{responses:0,pairs:0};
        rec.responses++;rec.pairs+=item.qa.length;summary.byCyclePublisher[k]=rec;
      }
    }catch(error) {
      summary.failed.push({source:seed.id,url:seed.url,
        reason:error instanceof Error?error.message.slice(0,200):'Unknown fetch or parse failure'});
    }
    if((options.delayMs??350)>0 && queue.length)
      await new Promise(r=>setTimeout(r,Math.max(0,Math.min(5000,options.delayMs??350))));
  }
  if(queue.length)summary.failed.push({source:'catalog',url:'',reason:'Bounded maxSources reached with '+queue.length+' remaining'});
  return summary;
}
