import { createHash } from 'node:crypto';

export const CFB_INDEPENDENT_EXPENDITURE_HISTORY_VERSION =
  'mn-cfb-independent-expenditure-history-v1' as const;

export type IndependentExpenditureDirection = 'for' | 'against' | 'other';

export interface CfbIndependentExpenditureRow {
  rowKey: string;
  year: number;
  transactionDate: string | null;
  spender: string;
  spenderRegistrationNumber: string | null;
  affectedCommitteeName: string;
  affectedCommitteeRegistrationNumber: string | null;
  candidateName: string | null;
  chamber: 'house' | 'senate' | null;
  direction: IndependentExpenditureDirection;
  amount: number;
  unpaidAmount: number;
  totalAmount: number;
  raw: Record<string,string>;
}

function parseCsv(text:string,onRow:(row:string[])=>void):void{
  let row:string[]=[],field='',quoted=false,index=0;
  while(index<text.length){
    const char=text[index];
    if(quoted){
      if(char==='"'){
        if(text[index+1]==='"'){field+='"';index+=2;continue;}
        quoted=false;index+=1;continue;
      }
      field+=char;index+=1;continue;
    }
    if(char==='"'&&field.length===0){quoted=true;index+=1;continue;}
    if(char===','){row.push(field);field='';index+=1;continue;}
    if(char==='\n'){row.push(field.replace(/\r$/,''));onRow(row);row=[];field='';index+=1;continue;}
    field+=char;index+=1;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));onRow(row);}
}
function headers(row:string[]):Map<string,number>{
  return new Map(row.map((value,index)=>[value.trim().toLowerCase(),index]));
}
function value(row:string[],index:Map<string,number>,names:readonly string[]):string{
  for(const name of names){
    const position=index.get(name.toLowerCase());
    if(position!==undefined){
      const candidate=(row[position]??'').trim();
      if(candidate)return candidate;
    }
  }
  return '';
}
function money(text:string):number{
  const value=Number.parseFloat(text.replace(/[$,]/g,''));
  return Number.isFinite(value)?value:0;
}
function normalizeDate(text:string):string|null{
  if(!text)return null;
  const direct=text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(direct)return direct[0];
  const us=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(us){
    const year=us[3].length===2?Number(us[3])+2000:Number(us[3]);
    return `${year.toString().padStart(4,'0')}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
  }
  return null;
}
function identityFromCommittee(valueText:string){
  const trimmed=valueText.replace(/\s+/g,' ').trim();
  const suffix=trimmed.match(/^(.+?)\s+(House|Senate)\s+Committee$/i);
  if(!suffix)return {candidateName:null,chamber:null as 'house'|'senate'|null};
  const core=suffix[1].trim();
  const comma=core.match(/^([^,]+),\s*(.+)$/);
  const candidateName=comma?`${comma[2].trim()} ${comma[1].trim()}`:core;
  return {candidateName,chamber:suffix[2].toLowerCase() as 'house'|'senate'};
}
function stableRowKey(fields:Record<string,unknown>):string{
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

export function parseCfbIndependentExpenditureCsv(
  text:string,
  input:{fromYear?:number;toYear?:number}={},
):CfbIndependentExpenditureRow[]{
  let index:Map<string,number>|undefined;
  const rows:CfbIndependentExpenditureRow[]=[];
  parseCsv(text,(rawRow)=>{
    if(!index){index=headers(rawRow);return;}
    const year=Number(value(rawRow,index,['Year']));
    if(!Number.isFinite(year))return;
    if(input.fromYear!==undefined&&year<input.fromYear)return;
    if(input.toYear!==undefined&&year>input.toYear)return;
    const spender=value(rawRow,index,['Spender','Spender Name','Committee name','Filer name']);
    const affectedCommitteeName=value(rawRow,index,['Affected Comte Name','Affected Committee Name','Affected committee']);
    if(!spender||!affectedCommitteeName)return;
    const directionRaw=value(rawRow,index,['For /Against','For/Against','Direction']).toLowerCase();
    const direction:IndependentExpenditureDirection =
      directionRaw==='for'?'for':directionRaw==='against'?'against':'other';
    const transactionDate=normalizeDate(value(rawRow,index,['Date','Expenditure date']));
    const amount=money(value(rawRow,index,['Amount']));
    const unpaidAmount=money(value(rawRow,index,['Unpaid amount','Unpaid Amount']));
    const affectedCommitteeRegistrationNumber=value(rawRow,index,['Affected Cmte Reg Num','Affected Committee Reg Num'])||null;
    const spenderRegistrationNumber=value(rawRow,index,['Spender Reg Num','Spender registration number','Registration number'])||null;
    const identity=identityFromCommittee(affectedCommitteeName);
    const raw=Object.fromEntries([...index.entries()].map(([name,position])=>[name,rawRow[position]??'']));
    const core={
      year,transactionDate,spender,spenderRegistrationNumber,affectedCommitteeName,
      affectedCommitteeRegistrationNumber,candidateName:identity.candidateName,chamber:identity.chamber,
      direction,amount,unpaidAmount,totalAmount:Number((amount+unpaidAmount).toFixed(2)),
    };
    rows.push({...core,rowKey:stableRowKey(core),raw});
  });
  return rows.sort((a,b)=>
    a.year-b.year
    || (a.transactionDate??'').localeCompare(b.transactionDate??'')
    || a.affectedCommitteeName.localeCompare(b.affectedCommitteeName)
    || a.spender.localeCompare(b.spender)
    || a.rowKey.localeCompare(b.rowKey)
  );
}

export function sessionForIndependentExpenditureYear(year:number):string|null{
  if(year===2021||year===2022)return '2021-2022';
  if(year===2023||year===2024)return '2023-2024';
  if(year===2025||year===2026)return '2025-2026';
  return null;
}

export function independentExpenditureContentSha256(rows:readonly CfbIndependentExpenditureRow[]):string{
  const digest=createHash('sha256');
  for(const row of rows)digest.update(JSON.stringify(row)+'\n');
  return digest.digest('hex');
}
