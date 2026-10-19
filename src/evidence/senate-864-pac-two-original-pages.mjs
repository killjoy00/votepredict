/** Exact two-case source inspection. Only physically printed cell borders qualify;
 * no expanded proximity envelopes, inferred columns or comparator relaxation. */
import {OPS,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {validDay,parsePrintedDates,parsePrintedAmounts,normalizePrintedName} from './cfb-report-schedule-raw.mjs';
const key=r=>[r.filerReg,r.year,r.rowKey].join('|');
const reg=s=>/^\d{3,8}$/.test(s||'');
const cents=s=>{const n=String(s??'').replace(/[$, ]/g,'');return /^\d+(?:\.\d{1,2})?$/.test(n)&&Number(n)>0?Math.round(Number(n)*100):null;};
const valid=r=>reg(r.filerReg)&&reg(r.contributorReg)&&validDay(r.transactionDate)&&cents(r.amount)!==null&&typeof r.contributor==='string'&&r.contributor.length>=5&&!r.sourceConflict;
export function selectTwoComparatorCompleteOriginalPages(cohort,allRows,outcomes){
 const hits=new Map();
 for(const o of outcomes)for(const h of o.privateBlockCandidates||[]){
  if(!hits.has(h.key))hits.set(h.key,new Map());
  hits.get(h.key).set([h.reportVersionId,h.pageNumber,h.anchorLine].join('|'),h);
 }
 const selected=[];
 for(const r of cohort){
  const candidate=[...(hits.get(key(r))?.values()||[])];
  if(!candidate.length)continue;
  const comparator=allRows.filter(x=>x.filerReg===r.filerReg&&x.year===r.year);
  if(!valid(r)||!comparator.length||comparator.some(x=>!valid(x)))continue;
  const same=comparator.filter(x=>x.contributorReg===r.contributorReg&&x.transactionDate===r.transactionDate&&cents(x.amount)===cents(r.amount));
  if(same.length!==1)continue;
  if(candidate.length!==1)throw Error('Focused case no longer has one original-version anchor');
  selected.push({row:r,hit:candidate[0]});
 }
 if(selected.length!==2)throw Error('Exact two comparator-complete case scope changed');
 return selected;
}
/** Inspect actual stroked source paths in PDF user coordinates. Curves/fills
 * are not fabricated as table borders; unsupported path syntax holds. */
export function printedCellBorders(operatorList){
 let matrix=[1,0,0,1,0,0];const stack=[],horizontal=[],vertical=[];
 const p=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
 const add=(a,b)=>{if(Math.abs(a[1]-b[1])<0.5&&Math.abs(a[0]-b[0])>1)horizontal.push({x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y:(a[1]+b[1])/2});
  if(Math.abs(a[0]-b[0])<0.5&&Math.abs(a[1]-b[1])>1)vertical.push({y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1]),x:(a[0]+b[0])/2});};
 for(let i=0;i<operatorList.fnArray.length;i++){
  const op=operatorList.fnArray[i],args=operatorList.argsArray[i];
  if(op===OPS.save){stack.push([...matrix]);continue;}
  if(op===OPS.restore){if(!stack.length)throw Error('Unbalanced original drawing state');matrix=stack.pop();continue;}
  if(op===OPS.transform){matrix=Util.transform(matrix,args);continue;}
  if(op!==OPS.constructPath||![OPS.stroke,OPS.closeStroke,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke].includes(args[0]))continue;
  const path=args[1]?.[0];if(!path||typeof path.length!=='number')continue;
  let current=null,start=null;
  for(let j=0;j<path.length;){const token=path[j++];
   if(token===0){current=p(path[j++],path[j++]);start=current;}
   else if(token===1){const next=p(path[j++],path[j++]);if(current)add(current,next);current=next;}
   else if(token===2){j+=4;current=p(path[j++],path[j++]);}
   else if(token===3){if(current&&start)add(current,start);current=start;}
   else throw Error('Unsupported original PDF path encoding');
  }
 }
 return {horizontal,vertical};
}
function item(raw){
 if(!raw||typeof raw.str!=='string'||!Array.isArray(raw.transform)||raw.transform.length!==6)return null;
 const x=raw.transform[4],y=raw.transform[5],w=raw.width,h=Math.hypot(raw.transform[2],raw.transform[3]);
 if(![x,y,w,h].every(Number.isFinite)||w<0||h<=0)return null;
 return {text:raw.str.trim(),left:x,right:x+w,bottom:y,top:y+h};
}
export function inspectPrintedOriginalCells({items,operators,row,registeredName,firstPageText,report}){
 const words=items.map(item).filter(x=>x&&x.text),borders=printedCellBorders(operators);
 const identity=new RegExp('(?<!\\d)'+report.committeeReg+'(?!\\d)').test(firstPageText)&&firstPageText.includes(String(report.reportYear));
 const matches={date:words.filter(x=>parsePrintedDates(x.text).includes(row.transactionDate)),
  reg:words.filter(x=>new RegExp('(?<!\\d)'+row.contributorReg+'(?!\\d)').test(x.text)),
  amount:words.filter(x=>parsePrintedAmounts(x.text).includes(cents(row.amount))),
  name:words.filter(x=>[row.contributor,registeredName].some(n=>normalizePrintedName(n)===normalizePrintedName(x.text)))};
 const cell=x=>{
  const top=borders.horizontal.filter(b=>b.x1<=x.left&&b.x2>=x.right&&b.y>=x.top).sort((a,b)=>a.y-b.y)[0];
  const bottom=borders.horizontal.filter(b=>b.x1<=x.left&&b.x2>=x.right&&b.y<x.bottom).sort((a,b)=>b.y-a.y)[0];
  if(!top||!bottom)return null;
  const sides=borders.vertical.filter(b=>b.y1<=bottom.y+0.5&&b.y2>=top.y-0.5);
  const left=sides.filter(b=>b.x<=x.left).sort((a,b)=>b.x-a.x)[0],right=sides.filter(b=>b.x>=x.right).sort((a,b)=>a.x-b.x)[0];
  return left&&right?{top:top.y,bottom:bottom.y,left:left.x,right:right.x}:null;
 };
 const fieldCells=Object.fromEntries(Object.entries(matches).map(([k,xs])=>[k,xs.map(x=>({word:x,cell:cell(x)})).filter(x=>x.cell)]));
 const qualified=[];
 for(const d of fieldCells.date)for(const r of fieldCells.reg)for(const n of fieldCells.name)for(const a of fieldCells.amount){
  const c=[d,r,n,a];
  if(!c.every(x=>Math.abs(x.cell.top-d.cell.top)<0.5&&Math.abs(x.cell.bottom-d.cell.bottom)<0.5)||
   !(d.cell.right<=r.cell.left+0.5&&r.cell.right<=n.cell.left+0.5&&n.cell.right<=a.cell.left+0.5))continue;
  const label=(entry,re)=>words.some(w=>w.left>=entry.cell.left&&w.right<=entry.cell.right&&w.bottom>=entry.cell.top&&re.test(w.text));
  if(!label(d,/^date$/i)||!label(r,/registration|^reg\.?\s*(?:#|no\.?|number)?$/i)||
   !label(n,/contributor|name/i)||!label(a,/^total\b|\bcol\.?\s*3\b/i))continue;
  qualified.push(c);
 }
 return {printedReportIdentityFieldsVerified:identity,actualSourceHorizontalRules:borders.horizontal.length,
  actualSourceVerticalRules:borders.vertical.length,allFourLiteralFieldsPresent:Object.values(matches).every(x=>x.length>0),
  labelledSinglePrintedRowContained:identity&&qualified.length===1,
  hold:!identity?'printed_report_identity_not_verified':qualified.length===1?null:'labelled_physical_row_boundaries_not_certified'};
}
