/** Public originals only; historical observations remain distinct from retrieval. */
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.js';
import {parseOfficialMnSenateServiceDirectory,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL} from '../src/evidence/senate-official-ever-served-directory.js';
import {YEA_URL,YEA_SHA,YEA_MOTION_SHA,textSha,type JudiciaryYeaSource} from '../src/evidence/senate-864-judiciary-yea-repair.js';
export async function verifyJudiciaryYeaOriginals(sourceFetch:typeof fetch=fetch):Promise<JudiciaryYeaSource>{
 const minute=await fetchSenateCommitteeMinutePdf({url:YEA_URL,fetchImpl:sourceFetch});
 if(minute.contentSha256!==YEA_SHA||minute.bytes!==210882||textSha(minute.text)!=='cff102d126583e7b04d2e69d4e97fd8fc72621841934bc1a5e3667359ba50af9')throw Error('Original Minutes changed');
 const rolls=parseSenateCommitteeMinuteVotes(minute.text);
 if(rolls.length!==1||textSha(rolls[0].motionText)!==YEA_MOTION_SHA||
  !minute.text.includes('Senator Ron Latz - Chair')||!minute.text.includes('Senator Ron Latz, Chair'))throw Error('Original question or full chair identity changed');
 const attendance=await fetchSenateCommitteeMinutePdf({url:'https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/Jud_2024_attendance.pdf',fetchImpl:sourceFetch});
 if(attendance.bytes!==248084||attendance.contentSha256!=='d10d4eeb55c6a80244fac9a084b3ba648ed28f85ce18a3a4eea30532fc24c5d3'||
  !/Committee on Judiciary and Public Safety/.test(attendance.text)||!attendance.text.includes('Attendance Record 2024')||
  !/Latz,\s*Ron\b/.test(attendance.text))throw Error('Independent 2024 full-name register changed');
 const journal=await fetchSenateCommitteeMinutePdf({url:'https://www.senate.mn/journals/2023-2024/2023010402.pdf',fetchImpl:sourceFetch});
 if(journal.contentSha256!=='25deddcfec84597df9e3e4382cca907f7e19d78f7a6db9a93d27ab60dbfd096e'||journal.bytes!==1114582)throw Error('Adopted Journal changed');
 const j=journal.text.replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ');
 const sr=j.split('Senate Resolution No. 7:')[1]?.split('Senate Resolution No. 8:')[0];
 if(!sr||!sr.includes('The motion prevailed. So the resolution was adopted.')||
  !sr.match(/COMMITTEE ON JUDICIARY AND PUBLIC SAFETY \(9\)([\s\S]*?)COMMITTEE ON LABOR/)?.[1].includes('Latz, Chair'))throw Error('Independently adopted office unproved');
 const response=await sourceFetch(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(response.status!==200||!response.body)throw Error('Official alias source unavailable');
 const pieces:Uint8Array[]=[];let total=0;const reader=response.body.getReader();
 try{for(;;){const x=await reader.read();if(x.done)break;total+=x.value.length;if(total>5_000_000)throw Error('Directory byte bound');pieces.push(x.value)}}finally{reader.releaseLock()}
 const directory=parseOfficialMnSenateServiceDirectory(Buffer.concat(pieces,total),new Date().toISOString());
 const person=directory.senators.filter(p=>p.officialName==='Ronald Steven Latz');
 if(person.length!==1||!/Latz, Ronald Steven\s*-\s*"Ron"/.test(person[0].officialNameRaw)||
  !person[0].senateServiceTerms.some(t=>t.startsYear===2023&&t.district==='46'&&(t.endsYear===null||t.endsYear>=2024)))throw Error('Independent full alias/service unproved');
 return {roll:rolls[0],independentOfficeAndFullAliasVerified:true};
}
if(process.argv[1]?.endsWith('/verify-senate-864-judiciary-yea-originals.ts'))verifyJudiciaryYeaOriginals().then(()=>console.log('SENATE864_JUDICIARY_FOUR_ORIGINALS_VERIFIED')).catch(()=>{console.error('SENATE864_JUDICIARY_ORIGINAL_HOLD');process.exitCode=1});
