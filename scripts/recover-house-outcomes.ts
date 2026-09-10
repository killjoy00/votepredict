import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseHouseJournalOutcomes } from '../src/sources/minnesota/house-outcomes.js';
const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = arg('input'), directory = arg('journal-dir'), output = arg('manifest');
if (!input || !directory || !output) throw new Error('Specify --input, --journal-dir and --manifest');
const events: Array<{id:string;identifier:string;date:string;journal_page:string;yea_count:number;nay_count:number}> = JSON.parse(readFileSync(input,'utf8'));
const urls: Record<string,string> = JSON.parse(readFileSync(join(directory,'urls.json'),'utf8'));
const cache = new Map<string, {outcomes:ReturnType<typeof parseHouseJournalOutcomes>;hash:string}>();
const manifest = [];
for (const event of events) {
  const path=join(directory,event.date+'.html');
  if (!existsSync(path)) continue;
  if (!cache.has(event.date)) {
    const bytes=readFileSync(path);
    let html: string;
    try { html=new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { html=new TextDecoder('windows-1252').decode(bytes); }
    cache.set(event.date,{outcomes:parseHouseJournalOutcomes(html),hash:createHash('sha256').update(bytes).digest('hex')});
  }
  const journal=cache.get(event.date)!;
  let candidates=journal.outcomes.filter(r=>r.identifier===event.identifier&&r.yeaCount===event.yea_count&&r.nayCount===event.nay_count);
  if (candidates.length>1) candidates=candidates.filter(r=>r.journalPage===event.journal_page);
  // Multiple indistinguishable roll calls remain unresolved, even if they agree.
  if (candidates.length!==1) continue;
  manifest.push({...event,...candidates[0],sourceUrl:urls[event.date],contentSha256:journal.hash,extractionVersion:'house-journal-outcome-v1'});
}
writeFileSync(output,JSON.stringify(manifest));
console.log(JSON.stringify({events:events.length,recovered:manifest.length,passed:manifest.filter(r=>r.passed).length,failed:manifest.filter(r=>!r.passed).length,unresolved:events.length-manifest.length},null,2));
