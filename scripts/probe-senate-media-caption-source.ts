import {
  extractSenateCaptionSourceCandidates,
  MN_SENATE_MEDIA_CAPTION_SOURCE_PROBE_VERSION,
} from '../src/evidence/minnesota-senate-media.js';

const pages=[
  'https://www.lrl.mn.gov/media/file?mtgid=1047792',
  'https://www.lrl.mn.gov/media/file?body=s&cid=1007&date=05%2F04%2F2026',
];

async function main(){
  const results=[];
  for(const url of pages){
    const response=await fetch(url,{
      headers:{accept:'text/html,application/xhtml+xml','user-agent':'VotePredict/2.0 senator-caption-source-probe'},
      signal:AbortSignal.timeout(30_000),
    });
    if(!response.ok)throw new Error('LRL media page returned HTTP '+response.status);
    const html=await response.text();
    const candidates=extractSenateCaptionSourceCandidates(html,url);
    results.push({
      pageUrl:url,
      httpStatus:response.status,
      htmlBytes:Buffer.byteLength(html),
      candidateCount:candidates.length,
      candidates:candidates.slice(0,100),
    });
  }
  console.log(JSON.stringify({
    senateCaptionSourceProbe:{
      version:MN_SENATE_MEDIA_CAPTION_SOURCE_PROBE_VERSION,
      results,
      policy:{
        readOnly:true,
        transcriptIngestion:false,
        speakerAttribution:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
