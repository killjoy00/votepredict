import { createHash } from 'node:crypto';
import {
  discoverSenateCommitteeMinuteDocuments,
  fetchSenateCommitteeMinutePdf,
  MN_SENATE_COMMITTEE_SOURCE_VERSION,
} from '../src/evidence/minnesota-senate-committee-source.js';
import {
  parseSenateCommitteeMinuteVotes,
  MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
} from '../src/evidence/minnesota-senate-committee-minutes.js';

const SAMPLE_PER_YEAR=Math.max(1,Math.min(12,Number(process.env.VOTEPREDICT_SENATE_COMMITTEE_PROBE_PER_YEAR??8)||8));

function spreadSample<T>(rows:readonly T[],limit:number):T[]{
  if(rows.length<=limit)return [...rows];
  if(limit===1)return [rows[Math.floor(rows.length/2)]];
  const indexes=new Set<number>();
  for(let i=0;i<limit;i++){
    indexes.add(Math.round(i*(rows.length-1)/(limit-1)));
  }
  return [...indexes].sort((a,b)=>a-b).map(index=>rows[index]);
}

function count(text:string,pattern:RegExp):number{
  return (text.match(pattern)??[]).length;
}

function signals(text:string){
  return {
    rollCall:count(text,/\broll\s+call\b/gi),
    ayeLabels:count(text,/\b(?:ayes?|yes)\s*[:\-]/gi),
    nayLabels:count(text,/\b(?:nays?|no)\s*[:\-]/gi),
    voteCountSyntax:count(text,/\b(?:vote\s+was|roll\s+call(?:\s+vote)?(?:\s+was)?)\s*\d+\s*[-–]\s*\d+\b/gi),
    handsShown:count(text,/\b(?:hands\s+shown|called\s+for\s+division)\b/gi),
    voiceVote:count(text,/\bvoice\s+vote\b/gi),
    motionOutcome:count(text,/\b(?:motion|amendment)\s+(?:passed|prevailed|failed|did\s+not\s+prevail|was\s+adopted|was\s+not\s+adopted)\b/gi),
    billMentions:count(text,/\b[SH]\s*\.?\s*F\s*\.?\s*(?:No\.?\s*)?\d+\b/gi),
  };
}

async function main(){
  const rows=[];
  const totals={
    sampledDocuments:0,
    fetchedDocuments:0,
    ocrDocuments:0,
    failures:0,
    parserObservations:0,
    namedObservations:0,
    countOnlyObservations:0,
    signals:{
      rollCall:0,ayeLabels:0,nayLabels:0,voteCountSyntax:0,handsShown:0,voiceVote:0,motionOutcome:0,billMentions:0,
    },
  };

  for(const year of [2022,2023,2024,2025,2026]){
    const discovered=await discoverSenateCommitteeMinuteDocuments({year});
    const sample=spreadSample(discovered.documents,SAMPLE_PER_YEAR);
    for(const doc of sample){
      totals.sampledDocuments+=1;
      try{
        const pdf=await fetchSenateCommitteeMinutePdf({url:doc.url});
        totals.fetchedDocuments+=1;
        if(pdf.extractionMethod==='ocr_tesseract')totals.ocrDocuments+=1;
        const parsed=parseSenateCommitteeMinuteVotes(pdf.text);
        const named=parsed.filter(row=>row.individualVotesAvailable).length;
        const countOnly=parsed.length-named;
        const docSignals=signals(pdf.text);
        totals.parserObservations+=parsed.length;
        totals.namedObservations+=named;
        totals.countOnlyObservations+=countOnly;
        for(const key of Object.keys(docSignals) as Array<keyof typeof docSignals>){
          totals.signals[key]+=docSignals[key];
        }
        rows.push({
          year,
          meetingDate:doc.meetingDate,
          committeeName:doc.committeeName,
          urlHash:createHash('sha256').update(doc.url).digest('hex').slice(0,16),
          extractionMethod:pdf.extractionMethod,
          textChars:pdf.text.length,
          signals:docSignals,
          parserObservations:parsed.length,
          namedObservations:named,
          countOnlyObservations:countOnly,
        });
      }catch(error){
        totals.failures+=1;
        rows.push({
          year,
          meetingDate:doc.meetingDate,
          committeeName:doc.committeeName,
          urlHash:createHash('sha256').update(doc.url).digest('hex').slice(0,16),
          failure:error instanceof Error?error.message:String(error),
        });
      }
    }
  }

  console.log(JSON.stringify({
    senateCommitteeVoteYieldProbe:{
      sourceVersion:MN_SENATE_COMMITTEE_SOURCE_VERSION,
      parserVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
      samplePerYear:SAMPLE_PER_YEAR,
      totals,
      rows,
      policy:{
        readOnly:true,
        evidencePersistence:false,
        transcriptTextLogged:false,
        voteSemanticsChanged:false,
        productionAction:'none',
      },
    },
  },null,2));
}

main().catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
