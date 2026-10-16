/**
 * RAW official text discovery, deliberately separate from revisor.ts and the
 * bill_versions/forecast selector. Posting dates are displayed metadata only.
 */
import { createHash } from 'node:crypto';
import { parseRevisorBillTextHtml } from '../sources/minnesota/revisor.js';

export type SenateOfficialTextFamily = 'numbered_version' | 'unofficial_engrossment' | 'conference_report' | 'amendment';
export interface OfficialVersionLead {
  family: Exclude<SenateOfficialTextFamily, 'amendment'>;
  printedLabel: string;
  sourceUrl: string;
  locator: string;
  postedOn: string | null;
}
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

function revisorRoot(value: string): URL {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.hostname !== 'www.revisor.mn.gov'
    || !/^\/bills\/(?:92|93|94)\/202[1-6]\/0\/(?:HF|SF)\/[1-9]\d{0,5}\/$/i.test(u.pathname)
    || u.search || u.hash || u.username || u.password)
    throw Error('not_an_exact_official_revisor_bill_url');
  return u;
}
function isoDate(month: string, day: string, year: string): string | null {
  const result = year + '-' + month + '-' + day;
  const date = new Date(result + 'T00:00:00.000Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === result ? result : null;
}
function labelText(html: string): string {
  return html.replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n:string)=>String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
}
export function discoverOfficialVersionLeads(html: string, statusUrl: string): OfficialVersionLead[] {
  const root = revisorRoot(statusUrl);
  // The status-page banner repeats the current version URL before the
  // authoritative "Bill Text Versions" table, but omits its printed date.
  // Limit discovery to the actual published version listing when identifiable.
  // The Revisor heading sometimes wraps words in nested markup, so do
  // not require the heading to consist of a bare H2/H3 text node.
  // The literal published section title is the boundary before the table.
  const heading = /\bBill\s+Text\s+Versions\b/i.exec(html);
  const afterHeading = heading ? html.slice(heading.index + heading[0].length) : html;
  // Status pages repeat the same version as "Intro" in later Actions rows.
  // Only anchors in the actual version-list section are version receipts.
  // Keep subgroup headings (engrossments, unofficial and CCR), but stop at
  // the first Description, Authors or Actions section heading.
  const sectionEnd = heading ? /<h[1-6]\b[^>]*>\s*(?:<[^>]+>\s*){0,3}(?:Description|Authors|Actions)\b/i.exec(afterHeading) : null;
  const listingHtml = sectionEnd ? afterHeading.slice(0,sectionEnd.index) : afterHeading;
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const matches = [...listingHtml.matchAll(anchor)];
  const discovered = new Map<string, OfficialVersionLead>();
  for (let i=0; i<matches.length; i++) {
    const m = matches[i];
    const href = m[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !href.includes('versions/')) continue;
    let u: URL;
    try { u = new URL(href,root); } catch { continue; }
    if (u.origin !== root.origin || u.search || u.hash || !u.pathname.startsWith(root.pathname)) continue;
    const locator = u.pathname.slice(root.pathname.length);
    const parts = locator.match(/^versions\/(?:(\d+)|ue\/(\d+)|ccr\/([a-z0-9]+))\/$/i);
    if (!parts) continue; // Reject PDF/RTF, third-party links and status action links.
    const family: OfficialVersionLead['family'] = parts[2] ? 'unofficial_engrossment'
      : parts[3] ? 'conference_report' : 'numbered_version';
    const printedLabel = labelText(m[2]);
    if (!printedLabel) throw Error('version_label_missing');
    // A PDF link can follow the text anchor before "Posted on".
    // End at the next version anchor, never consume another version's date.
    const nextVersion = matches.slice(i+1).find(next =>
      /href\s*=\s*["'][^"']*\bversions\/(?:\d+|ue\/\d+|ccr\/[a-z0-9]+)\/["']/i.test(next[1]));
    const gapEnd = nextVersion?.index ?? (m.index!+m[0].length+500);
    const gap = listingHtml.slice(m.index!+m[0].length,Math.min(gapEnd,m.index!+m[0].length+500));
    const date = gap.match(/\bPosted on\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const postedOn = date ? isoDate(date[1],date[2],date[3]) : null;
    if (date && !postedOn) throw Error('invalid_printed_posting_date');
    const row: OfficialVersionLead = { family,printedLabel,sourceUrl:u.toString(),locator,postedOn };
    const existing = discovered.get(locator);
    if (existing) {
      // Duplicate links are not separate versions. The dated listing row
      // wins over a date-free banner/action link; two contradictory published
      // dates or two contradictory labels with equal date quality still fail.
      if (existing.family!==row.family || existing.sourceUrl!==row.sourceUrl
        || (existing.postedOn!==null && row.postedOn!==null
          && (existing.postedOn!==row.postedOn || existing.printedLabel!==row.printedLabel))
        || (existing.postedOn===null && row.postedOn===null
          && existing.printedLabel!==row.printedLabel))
        throw Error('conflicting_official_version_listing');
      if (existing.postedOn===null && row.postedOn!==null) discovered.set(locator,row);
      continue;
    }
    discovered.set(locator,row);
    if (discovered.size>100) throw Error('unexpectedly_large_revisor_version_list');
  }
  if (discovered.size===0 && /\bBill Text Versions\b/i.test(labelText(html)))
    throw Error('version_list_present_but_unparsed');
  return [...discovered.values()];
}
export function captureOfficialRevisorHtml(rawBytes: Uint8Array): {
  originalBody: string; originalBodySha256: string; extractedTextSha256: string;
  rawText: string; originalByteLength: number;
} {
  const originalBody = Buffer.from(rawBytes).toString('utf8');
  const parsed = parseRevisorBillTextHtml(originalBody);
  return {
    originalBody, originalBodySha256:digest(rawBytes),
    extractedTextSha256:parsed.sha256, rawText:parsed.text,
    originalByteLength:rawBytes.byteLength,
  };
}
export interface JournalAmendmentSnippet {
  billIdentifier: string;
  printedLabel: string;
  amendmentRef: string | null;
  sourceLocator: string;
  rawText: string;
  extractedTextSha256: string;
}
/** Literal blocks between a printed "moved to amend" and the next question.
 * Never treat an amended-bill state or motion outcome as an adopted amendment.
 * A block that does not include explicit proposed wording is not captured.
 */
export function extractLiteralAmendmentBlocks(text: string): JournalAmendmentSnippet[] {
  const head = /\bSenator\s+([A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'’-]+)?)\s+moved\s+to\s+amend\s+([HS])\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?0*(\d{1,6})\b/gi;
  const matches=[...text.matchAll(head)];
  const blocks: JournalAmendmentSnippet[]=[];
  for(let i=0;i<matches.length && blocks.length<120;i++){
    const m=matches[i],start=m.index!;
    const stop=Math.min(matches[i+1]?.index??text.length,start+35000);
    const span=text.slice(start,stop);
    const result=span.search(/\b(?:The question was taken|The motion prevailed|The motion did not prevail|The amendment was adopted|The amendment was not adopted)\b/i);
    const literal=(result>=0 ? span.slice(0,result) : span).trimEnd();
    // Only published proposed legislative language, not a heading or a summary.
    if(literal.length<95 || !/\b(?:as follows|page\s+\d+,\s*line|delete|insert|strike|amendment reads)\b/i.test(literal))
      continue;
    const ref=literal.match(/\bA-?\d{1,5}(?:-\d{1,5})?\b/i)?.[0]?.toUpperCase()??null;
    const billIdentifier=m[2].toUpperCase()+'F'+Number(m[3]);
    if(!/^(?:HF|SF)[1-9]\d{0,5}$/.test(billIdentifier))continue;
    const sourceLocator='extracted-text:char:'+start+'-'+(start+literal.length)+':proposal:'+String(i+1);
    blocks.push({billIdentifier,printedLabel:ref??'unnumbered proposed amendment',
      amendmentRef:ref,sourceLocator,rawText:literal,extractedTextSha256:digest(literal)});
  }
  return blocks;
}
export function isOfficialRevisorVersionUrl(sourceUrl: string, statusUrl: string): boolean {
  const root=revisorRoot(statusUrl),url=new URL(sourceUrl);
  return url.origin===root.origin && !url.search && !url.hash && url.pathname.startsWith(root.pathname)
    && /^versions\/(?:\d+|ue\/\d+|ccr\/[a-z0-9]+)\/$/i.test(url.pathname.slice(root.pathname.length));
}