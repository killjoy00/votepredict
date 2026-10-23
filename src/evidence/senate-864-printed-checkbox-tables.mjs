/** Preserve original HTML cell boundaries; no vote inferred from row order, attendance or totals. */
import {createHash} from 'node:crypto';
import {extractSenateMinutesText} from '../sources/minnesota/senate-schedule.ts';
const sha=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const plain=s=>extractSenateMinutesText(s).replace(/\s+/g,' ').trim();
export function extractPrintedCheckboxTables(html,doc){
 if(typeof html!=='string')return [];
 const out=[];
 // Only innermost, explicitly closed tables; merged cells and incomplete rows hold.
 for(const t of html.matchAll(/<table\b[^>]*>(?:(?!<table\b)[\s\S])*?<\/table>/gi)){
  const rows=[...t[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map(c=>({attributes:c[1],text:plain(c[2])})));
  if(!rows[0]||rows[0].map(c=>c.text.toUpperCase()).join('|')!=='SENATOR|YES|NO')continue;
  const q={format:'original_html_checkbox_cells',choices:[],blankRows:[],excludedOtherLabels:0,holds:[],confidence:'held_question',voteKind:'motion',amendmentRef:null,sourceOffset:t.index};
  const before=plain(html.slice(0,t.index)),at=before.lastIndexOf('SENATOR '),intro=before.slice(at);
  const request=intro.match(/^SENATOR ([\p{L}.' -]+?) requested a Roll Call Vote on:\s*_+ adoption of _+ amendment\s*_+X_+ Passage of S\.\s*F\.\s*No\.\s*(\d+)\s*_+ adoption of _+ motion\s*_+$/iu);
  if(!request)q.holds.push('no_unique_selected_complete_bill_question');
  const tail=plain(html.slice(t.index+t[0].length));
  const result=tail.match(/^There being (\d{1,2}) Yes votes and (\d{1,2}) No votes Prevailed (_+(?:yes)?_+) Did Not Prevail (_+(?:yes)?_+) (Senator ([\p{L}.' -]+?) moved that S\.\s*F\.\s*(\d+), be recommended to pass\.)/iu);
  if(!result)q.holds.push('missing_direct_bound_recommendation_tally_or_outcome');
  if(rows.length<4||rows.length>24||rows.some(r=>r.length!==3||r.some(c=>/\b(?:rowspan|colspan)\s*=/i.test(c.attributes))))q.holds.push('incomplete_or_merged_checkbox_grid');
  const last=rows.at(-1);
  if(last?.[0]?.text.toUpperCase()!=='TOTALS'||last?.slice(1).some(c=>c.text))q.holds.push('missing_or_nonblank_totals_boundary');
  const seen=new Set();
  for(const row of rows.slice(1,-1)){
   if(row.length!==3)continue;
   const printedCellName=row[0].text.replace(/,\s*.*$/,'').trim(),key=norm(printedCellName);
   if(!/^[\p{L}.' -]+$/u.test(printedCellName)||key.split(' ').length<2||seen.has(key))q.holds.push('duplicate_or_invalid_cell_name');
   seen.add(key);
   const yes=row[1].text,no=row[2].text;
   if(!['','X'].includes(yes)||!['','X'].includes(no)||yes&&no){q.holds.push('unknown_or_contradictory_cell_mark');continue;}
   if(!yes&&!no){q.blankRows.push({printedCellName,choice:null});continue;}
   // Printed surname binds uniquely to the same original's full-name header,
   // then the existing historical service resolver. Keep the literal cell name.
   q.choices.push({name:printedCellName.split(/\s+/).at(-1),printedCellName,choice:yes?'yea':'nay'});
  }
  q.yea=q.choices.filter(v=>v.choice==='yea').length;q.nay=q.choices.filter(v=>v.choice==='nay').length;
  if(result){
   if(Number(result[1])!==q.yea||Number(result[2])!==q.nay)q.holds.push('disagreeing_printed_checkbox_tally');
   const prevailed=/yes/i.test(result[3]),failed=/yes/i.test(result[4]);
   if(prevailed===failed)q.holds.push('ambiguous_printed_checkbox_outcome');else q.passed=prevailed;
  }
  if(request&&result){
   q.billIdentifier='SF'+Number(request[2]);q.mover=request[1];
   if(request[1].toLowerCase()!==result[6].toLowerCase()||request[2]!==result[7])q.holds.push('contradictory_request_and_recommendation');
   q.motionText='Senator '+request[1]+' requested a Roll Call Vote on: Passage of S. F. No. '+request[2]+'. '+result[5];
   q.questionCanonical=norm(q.motionText.replace(/\bS\.\s*F\.\s*(\d+)/gi,'SF$1'));
   q.questionKey=sha(JSON.stringify([doc.session_slug,doc.committee,doc.date,q.billIdentifier,q.voteKind,q.amendmentRef,q.questionCanonical]));
   q.sourceTableHtml=t[0];q.sourceTableHtmlSha256=sha(t[0]);
   q.fullQuestionPassage=JSON.stringify({literalRequest:intro,tableHtml:t[0],literalPrintedResultAndRecommendation:result[0]});
   q.fullQuestionPassageSha256=sha(q.fullQuestionPassage);
  }
  q.confidence=q.holds.length?'held_question':'source_proven_question';out.push(q);
 }
 for(const q of out)if(q.questionKey&&out.filter(x=>x.questionKey===q.questionKey).length>1){q.holds.push('duplicate_question_wording');q.confidence='held_question';}
 return out;
}
