/**
 * Pure, deterministic archived original SOS State Senate website-table parser.
 * Website value is only read when an ORIGINAL header explicitly identifies
 * and aligns the Website cell; a blank field does NOT mean no real website.
 * No network, persistence, model or database operations.
 */
import assert from 'node:assert/strict';

const decode=s=>String(s).replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(m,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10))).replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const plain=s=>decode(String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const normalized=s=>plain(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function parseRows(raw){
 const rows=[];
 for(const m of raw.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)){
  if(m[0].length>50000)continue;
  const els=[...m[0].matchAll(/<(td|th)\b[^>]*>[\s\S]*?<\/\1>/gi)];
  if(!els.length)continue;
  const cells=els.map(x=>({tag:x[1].toLowerCase(),html:x[0],value:plain(x[0])}));
  rows.push(cells);
 }
 return rows;
}
function campaignUrlFromWebsiteCell(cell){
 if(!cell)return null;
 const direct=[];
 for(const a of cell.html.matchAll(/<a\b([^>]*)>/gi)){
  const h=/\bhref\s*=\s*["']([^"']+)["']/i.exec(a[1])?.[1];
  if(h)direct.push(decode(h));
 }
 if(cell.value&&/^(?:https?:\/\/|www\.)?[a-z\d][a-z\d.-]+\.[a-z]{2,}(?:[\/?#][^\s]*)?$/i.test(cell.value))direct.push(cell.value);
 for(const raw of direct){
  if(raw.length>270||raw.includes('@')||/\s/.test(raw))continue;
  try{const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
   if(!['https:','http:'].includes(u.protocol)||!u.hostname.includes('.')||u.username||u.password)continue;
   if(/\.sos\.(?:mn\.gov|state\.mn\.us)$/.test(u.hostname.toLowerCase()))continue;
   return u.href;
  }catch{}
 }
 return null;
}
export function evaluateArchivedSenateWebsiteCells(buf,snapshot,winners){
 const page=buf.toString('utf8');
 const all=parseRows(page);
 // A true website column is identifiable only if the archived ORIGINAL
 // table itself labels it. Do not infer a website column from shape alone.
 const headers=all.filter(c=>c.some(x=>/^(?:candidate name|name of candidate)$/i.test(x.value))
  &&c.some(x=>/^(?:campaign website|website|web site)$/i.test(x.value)));
 const evidenceHeaders=headers.map(c=>({labels:c.map(x=>{
   if(/candidate name/i.test(x.value))return 'candidate name';
   if(/^(?:campaign website|website|web site)$/i.test(x.value))return 'website';
   if(/^party/i.test(x.value))return 'party';
   if(/(?:file|filing) date/i.test(x.value))return 'file date';
   return '(other column)';
  }),cellCount:c.length,nameColumnIndex:c.findIndex(x=>/^(?:candidate name|name of candidate)$/i.test(x.value)),
  websiteColumnIndex:c.findIndex(x=>/^(?:campaign website|website|web site)$/i.test(x.value))}));
 const watched=[];
 const target=snapshot;
 assert.ok(target&&Array.isArray(target.people));
 for(const person of target.people){
  assert.ok(winners.get(person.officialSosWinnerDistrict)?.toLowerCase().includes(person.surname.toLowerCase()),'Not correct 2020 or 2022 official SOS winner for '+person.surname);
  let rows=all.filter(c=>c.length>=4 && normalized(c[1].value)===normalized(person.originalFiledName));
  assert.equal(rows.length,1,'Exactly one original named candidate row expected for '+person.surname+' got '+rows.length);
  const cells=rows[0];
  const best=evidenceHeaders.find(h=>h.nameColumnIndex===1&&h.cellCount===cells.length);
  const cellIndex=best?.websiteColumnIndex??null;
  const websiteCell=Number.isInteger(cellIndex)&&cellIndex>=0?cells[cellIndex]:null;
  const website=campaignUrlFromWebsiteCell(websiteCell);
  // Additional diagnostic: if table header cannot be aligned, record only
  // source-matched individual *external URL* counts by cell index, not unknown
  // other text which might contain personal fields.
  const externallyLinked= [];
  for(let i=0;i<cells.length;i++){
   const ur=campaignUrlFromWebsiteCell(cells[i]);
   if(ur)externallyLinked.push({columnIndex:i,unclassifiedPublicURL:ur});
  }
  const handler=/<a\b[^>]*href=["']\s*javascript:\s*__doPostBack/i.test(cells[1].html);
  watched.push({
   person:person.officialName,originalFiledCandidateName:person.originalFiledName,
   validatedPostVoteWinner: winners.get(person.officialSosWinnerDistrict),
   validatedGeneralElectionDistrict:person.officialSosWinnerDistrict,
   originalNamedTableRowFound:true,originalRowColumnCount:cells.length,
   originalWebsiteColumnExplicitlyAlignedByArchivedHeader:!!best,
   originalWebsiteColumnIndex:cellIndex,
   originalWebsiteCellVisiblyEmpty:websiteCell?websiteCell.value.length===0:null,
   originalWebsiteCellCharacterCount:websiteCell?.value.length??null,
   originalWebsiteFieldPubliclyDisplayedCandidateURL:website,
   candidateOtherExternalURLRowsNotWebsiteField:externallyLinked.filter(x=>x.columnIndex!==cellIndex),
   originalCandidateDetailTriggerIsASPNetPostback:handler,
   noWebsiteShownInThisArchivedListingDoesNotEstablishNoOwnedWebsite:true,
   filedWebsiteDomainAndCampaignAuthorshipNotProvenByCandidateList:true
  });
 }
 const counts={totalRows:all.length,numberOriginalHeaderRowsWithWebsiteLabel:evidenceHeaders.length,
  headerRows:evidenceHeaders.slice(0,4),
  targetOriginalCandidateRows:watched.length,
  originalNamedTargetRowsWithWebsiteHeaderAligned:watched.filter(x=>x.originalWebsiteColumnExplicitlyAlignedByArchivedHeader).length,
  originalWebsiteFieldShowsURLForTargets:watched.filter(x=>x.originalWebsiteFieldPubliclyDisplayedCandidateURL).length};
 return {page:counts,candidates:watched};
}
