import {
  extractSenateCaptionRequests,
  extractSenateCaptionSourceCandidates,
  MN_SENATE_MEDIA_CAPTION_SOURCE_PROBE_VERSION,
  summarizeSenateCaptionPayload,
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
    const captionRequests=extractSenateCaptionRequests(html,url);
    if(captionRequests.length===0)throw new Error('LRL media page exposed no showcaptions MP4 request contract');

    const captionPayloads=[];
    for(const request of captionRequests.slice(0,3)){
      const captionResponse=await fetch(request.endpointUrl,{
        headers:{
          accept:'text/html,application/xhtml+xml',
          referer:url,
          'user-agent':'VotePredict/2.0 senator-caption-source-probe',
        },
        signal:AbortSignal.timeout(30_000),
      });
      const payload=await captionResponse.text();
      captionPayloads.push({
        mp4:request.mp4,
        videoIndex:request.videoIndex,
        endpointUrl:request.endpointUrl,
        httpStatus:captionResponse.status,
        contentType:captionResponse.headers.get('content-type'),
        payloadBytes:Buffer.byteLength(payload),
        ...summarizeSenateCaptionPayload(payload),
      });
    }
    if(!captionPayloads.some(row=>row.httpStatus>=200&&row.httpStatus<300)){
      throw new Error('LRL caption payload endpoint returned no successful responses');
    }

    results.push({
      pageUrl:url,
      httpStatus:response.status,
      htmlBytes:Buffer.byteLength(html),
      candidateCount:candidates.length,
      candidates:candidates.slice(0,100),
      captionRequestCount:captionRequests.length,
      captionRequests:captionRequests.slice(0,10),
      captionPayloads,
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
        payloadTextLogged:false,
        productionAction:'none',
      },
    },
  },null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
