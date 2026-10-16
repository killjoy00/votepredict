/**
 * Literal Revisor/Journals authorship, not forecasting or as-of certification.
 * Current AUTHOS/AUTHOR order is preserved; actions contribute dates only when printed.
 */
import {normalizePrintedSenatorName} from './senate-identity-bill-resolvers.js';
import {parseRevisorAuthorship} from '../sources/minnesota/revisor-authorship.js';

export type AuthorRole='chief'|'coauthor'|'other';
export interface RawAuthor {
  nameRaw:string;role:AuthorRole;authorOrder:number|null;
  addedOn:string|null;removedOn:string|null;
}
export interface JournalAuthorChange {
  billIdentifier:string;nameRaw:string;operation:'add'|'strike';role:AuthorRole;
}
export function authorKey(name:string):string {
  return normalizePrintedSenatorName(name).replace(/\s+/g,' ').trim();
}
function earliest(a:string|null,b:string):string {
  return a && a<b?a:b;
}
function latest(a:string|null,b:string):string {
  return a && a>b?a:b;
}
function namedTag(block:string,name:string):string|null {
  const expr=new RegExp('<(?:[\\w.-]+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+name+'>','i');
  const raw=expr.exec(block)?.[1]?.replace(/<[^>]+>/g,' ').trim();
  return raw||null;
}
function xmlRoles(xml:string,chamber:'senate'|'house'):Map<number,AuthorRole> {
  const authors=/<(?:[\w.-]+:)?AUTHORS\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?AUTHORS>/i.exec(xml)?.[1]??'';
  const section=new RegExp('<(?:[\\w.-]+:)?'+(chamber==='senate'?'SENATE':'HOUSE')+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+(chamber==='senate'?'SENATE':'HOUSE')+'>','i').exec(authors)?.[1]??authors;
  const roles=new Map<number,AuthorRole>();
  const blocks=[...section.matchAll(/<(?:[\w.-]+:)?AUTHOR\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?AUTHOR>/gi)];
  blocks.forEach((block,i)=>{
    const printed=['AUTHOR_ROLE','ROLE','AUTHOR_TYPE','IS_CHIEF_AUTHOR','CHIEF_AUTHOR']
      .map(tag=>namedTag(block[1],tag)).find(Boolean)??'';
    if(/\bchief\b|^true$|^1$/i.test(printed))roles.set(i+1,'chief');
    else if(/\bco[\s-]?author\b/i.test(printed))roles.set(i+1,'coauthor');
  });
  return roles;
}
/**
 * The Revisor status XML provides ordered current AUTHORS and dated ACTIONS.
 * Its live v1 current AUTHOR blocks often have MEMBER_NAME but no role/date.
 * The first current author is the chief-author listing convention; explicit
 * role tags, when present, override that convention. Historical additions and
 * strikes are separately retained by the original raw XML snapshot.
 */
export function parseSenateBillAuthorXml(xml:string,identifier:string):RawAuthor[] {
  const chamber=identifier.toUpperCase().startsWith('SF')?'senate':'house';
  const record=parseRevisorAuthorship({xml,identifier});
  const roles=xmlRoles(xml,chamber);
  const found=new Map<string,RawAuthor>();
  let position=0;
  for(const author of record.currentAuthors.filter(x=>x.chamber===chamber)){
    position++;
    const key=authorKey(author.name);
    if(!key)continue;
    const role=roles.get(position)??(position===1?'chief':'coauthor');
    found.set(key,{nameRaw:author.name,role,authorOrder:position,addedOn:null,removedOn:null});
  }
  for(const action of record.actions.filter(x=>x.chamber===chamber)){
    for(const printed of action.names){
      const key=authorKey(printed);
      if(!key)continue;
      const row=found.get(key)??{
        nameRaw:printed,role:action.chiefAuthor?'chief':'other' as AuthorRole,
        authorOrder:null,addedOn:null,removedOn:null,
      };
      if(action.operation==='add'){
        row.addedOn=earliest(row.addedOn,action.occurredOn);
        if(action.chiefAuthor && row.authorOrder===null)row.role='chief';
      }else row.removedOn=latest(row.removedOn,action.occurredOn);
      found.set(key,row);
    }
  }
  return [...found.values()];
}
function splitSenators(value:string):string[] {
  return value.replace(/\bSenators?\s+/gi,'')
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map(x=>x.trim().replace(/[.;]+$/,'')).filter(Boolean);
}
/** Only a recorded *prevailing* motion is captured: a proposal is not a change. */
export function parseSenateJournalAuthorChanges(text:string):JournalAuthorChange[] {
  const flat=text.replace(/\s+/g,' ');
  const results:JournalAuthorChange[]=[];
  const dedup=new Set<string>();
  const motions=flat.matchAll(/\bSenator\s+([A-Z][A-Za-z\u2019' -]{1,65}?)\s+moved\s+that\s+(.{0,550}?)\bS\s*\.\s*F\s*\.\s*No\s*\.\s*(\d{1,6})\s*\.\s*The motion prevailed\s*\./gi);
  for(const match of motions){
    const mover=match[1].trim(),body=match[2],bill='SF'+String(Number(match[3]));
    const clauses=[...body.matchAll(/\bnames?\s+of\s+Senators?\s+(.{1,160}?)\s+be\s+(added|stricken)\s+as?\s+(?:a\s+)?(chief\s+author|co-authors?|authors?)/gi)];
    for(const clause of clauses){
      const role:AuthorRole=/chief/i.test(clause[3])?'chief':/co-author/i.test(clause[3])?'coauthor':'other';
      for(const name of splitSenators(clause[1])){
        const key=[bill,authorKey(name),clause[2].toLowerCase(),role].join('|');
        if(!dedup.has(key) && authorKey(name)){
          dedup.add(key);results.push({billIdentifier:bill,nameRaw:name,operation:clause[2].toLowerCase()==='added'?'add':'strike',role});
        }
      }
    }
    const pronoun=body.match(/\b(?:his|her|their)\s+name\s+be\s+(added|stricken)\s+as?\s+(?:a\s+)?(chief\s+author|co-author|author)/i);
    if(pronoun){
      const role:AuthorRole=/chief/i.test(pronoun[2])?'chief':/co-author/i.test(pronoun[2])?'coauthor':'other';
      const key=[bill,authorKey(mover),pronoun[1].toLowerCase(),role].join('|');
      if(!dedup.has(key)){
        dedup.add(key);results.push({billIdentifier:bill,nameRaw:mover,operation:pronoun[1].toLowerCase()==='added'?'add':'strike',role});
      }
    }
  }
  return results;
}
