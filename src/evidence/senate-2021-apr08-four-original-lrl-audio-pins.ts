/**
 * Four genuine original 2021-04-08 Minnesota LRL Senate committee MP3 source
 * prefixes verified by independent original-source workflow #38178990727.
 *
 * MP3 source availability is not proof of the exact SF1159 Dibble/McEwen or
 * SF970 Pappas motion being heard, its vote-day or named sides.
 */
import {createHash} from 'node:crypto';
import {APR12_THREE_STRICT_ORIGINAL} from
 './senate-2021-apr12-three-strict-original-committee-amendments.js';

export const APR08_FOUR_ORIGINAL_LRL_AUDIO={
 version:'senate-2021-apr08-four-original-lrl-mp3-strict-prefix-first-source-v1',
 originalFirstRunId:38178990727,
 originalJournalReportDate:'2021-04-12',
 officialLRLMediaPageMeetingDate:'2021-04-08',
 exactFirstPrefixBytes:65536,
 sourceMP3:[
  {bill:'SF1159',part:'transportation',
   url:'https://www.lrl.mn.gov/audio/senate/2021/cmte_fintrans_040821.mp3',
   firstOriginalPrefixSHA256:'8e2f01c874816f79811facc762146232f34d044a5db1cefecda4795dce04103f'},
  {bill:'SF970',part:'judiciary-first',
   url:'https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821.mp3',
   firstOriginalPrefixSHA256:'74b5c8c5580a805dfdebfbef803df02c0715e04075ba490983f38ec55e0b455a'},
  {bill:'SF970',part:'judiciary-second',
   url:'https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821a.mp3',
   firstOriginalPrefixSHA256:'0930c662d0b95ad73b661e6fd37f1549e6d64704d55d3c617ae2c3d14682f4f1'},
  {bill:'SF970',part:'judiciary-third',
   url:'https://www.lrl.mn.gov/audio/senate/2021/cmte_jud_040821b.mp3',
   firstOriginalPrefixSHA256:'b777ba4adde388217111376ecedae4d37f353875ffa52846dbb3e67630e514d7'}
 ] as const
} as const;

export type April08OriginalAudio=(typeof APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3)[number];
export function verifyFirstPinnedApril08AudioPrefix(spec:April08OriginalAudio,firstBytes:Buffer){
 if(firstBytes.length!==APR08_FOUR_ORIGINAL_LRL_AUDIO.exactFirstPrefixBytes)
  throw Error('Original Minnesota Senate 2021 audio prefix exact 64KiB length mismatch');
 const digest=createHash('sha256').update(firstBytes).digest('hex');
 if(digest!==spec.firstOriginalPrefixSHA256)
  throw Error('Original 2021 Senate original MP3 audio prefix SHA-256 mismatch');
 const validID3=firstBytes.subarray(0,3).toString('ascii')==='ID3';
 const validFrame=firstBytes[0]===0xff&&(firstBytes[1]&0xe0)===0xe0;
 if(!validID3&&!validFrame)throw Error('Original Minnesota Senate audio does not have MP3 ID3/frame signature');
 return {sha256:digest,bytes:firstBytes.length,signature:validID3?'id3':'mpeg-frame'};
}
export function verifyJournalMotionPreservationAcrossAudioSources(){
 const m=APR12_THREE_STRICT_ORIGINAL.motions;
 if(m.length!==3||m[0]!.bill!=='SF1159'||m[0]!.mover!=='Dibble'||
   m[1]!.bill!=='SF1159'||m[1]!.mover!=='McEwen'||
   m[2]!.bill!=='SF970'||m[2]!.mover!=='Pappas')
  throw Error('Original Journal three distinct amendment identities changed');
 if(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.length!==4||
  new Set(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.map(x=>x.url)).size!==4)
  throw Error('Exactly four previously original verified historic Senate audio source URLs required');
 return {
  originalJournalDistinctAmendments:3,
  audioSourceLeads:4,
  motionsHeardFromOriginalAudio:0,
  motionOccurredOnFromAudio:null,
  noAudioToMemberVoteInference:true
 };
}
