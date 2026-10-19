/** Exact already acquired original, independently checked names; no broad source recovery. */
import {verifyJudiciaryYeaOriginals} from './verify-senate-864-judiciary-yea-originals.js';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {validateSixOriginals} from '../src/evidence/senate-864-judiciary-six-motions.js';
import {YEA_URL,YEA_SHA,textSha} from '../src/evidence/senate-864-judiciary-yea-repair.js';
export async function verifySixJudiciaryOriginals(){
 const source=await verifyJudiciaryYeaOriginals();
 const minute=await fetchSenateCommitteeMinutePdf({url:YEA_URL});
 const attendance=await fetchSenateCommitteeMinutePdf({url:'https://www.lrl.mn.gov/archive/minutes/senate/2024/jud/Jud_2024_attendance.pdf'});
 if(minute.contentSha256!==YEA_SHA||textSha(minute.text)!=='cff102d126583e7b04d2e69d4e97fd8fc72621841934bc1a5e3667359ba50af9'||attendance.contentSha256!=='d10d4eeb55c6a80244fac9a084b3ba648ed28f85ce18a3a4eea30532fc24c5d3')throw Error('Original body/text changed');
 return validateSixOriginals(minute.text,attendance.text,source);
}
if(process.argv[1]?.endsWith('/verify-senate-864-judiciary-six-motions.ts'))verifySixJudiciaryOriginals().then(()=>console.log('SENATE864_JUDICIARY_SIX_EXACT_ROLLS_60_EXPLICIT_CHOICES_VERIFIED')).catch(()=>{console.error('SENATE864_JUDICIARY_SIX_ORIGINAL_HOLD');process.exitCode=1});
