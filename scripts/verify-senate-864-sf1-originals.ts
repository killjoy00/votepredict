/** Three exact official original PDFs; safe source metadata only, no member-side output. */
import {createHash} from 'node:crypto';
import {fetchSenateCommitteeMinutePdf} from '../src/evidence/minnesota-senate-committee-source.js';
import {parseSenateCommitteeMinuteVotes} from '../src/evidence/minnesota-senate-committee-minutes.js';
import {SF1_URL,SF1_SHA} from '../src/evidence/senate-864-sf1-repair.js';
import {validateOriginalRulesSF1} from '../src/evidence/senate-864-rules-sf1-source-to-db-parity.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function verifySf1Originals(){
 const minute=await fetchSenateCommitteeMinutePdf({url:SF1_URL});
 if(minute.contentSha256!==SF1_SHA||minute.bytes!==189421||
  sha(minute.text)!=='2a6eb9aced550ed193b4329fd33cc0fa8c59fd447c9be170ccc34ac36ead3544')throw Error('SF1 original changed');
 const source={verifiedRawPdfSha:true,verifiedSourceTextSha:true,rolls:parseSenateCommitteeMinuteVotes(minute.text)};
 if(!validateOriginalRulesSF1(source))throw Error('SF1 distinct original motions changed');
 const sr=await fetchSenateCommitteeMinutePdf({url:'https://www.senate.mn/resolutions/pdf/ls93/2023_2024/SR0007_O0.pdf'});
 if(sr.bytes!==278411||sr.contentSha256!=='a05b14d1c27a0b30d82e7ae845d9db3105136877a1929d1b43a75e3040b1ef97')throw Error('SR7 original changed');
 const flat=sr.text.replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ');
 const rules=flat.match(/COMMITTEE ON RULES AND ADMINISTRATION \(10\)([\s\S]+?)COMMITTEE ON STATE/);
 if(!rules||!['Dziedzic, Chair','Rest, Vice Chair','Johnson, Lead'].every(x=>rules[1].includes(x)))throw Error('SR7 role identities unproved');
 const journal=await fetchSenateCommitteeMinutePdf({url:'https://www.senate.mn/journals/2023-2024/2023010402.pdf'});
 if(journal.bytes!==1114582||journal.contentSha256!=='25deddcfec84597df9e3e4382cca907f7e19d78f7a6db9a93d27ab60dbfd096e')throw Error('Adoption Journal changed');
 const j=journal.text.replace(/[\u200b\u200c\u200d\ufeff]/g,'').replace(/\s+/g,' ');
 const section=j.split('Senate Resolution No. 7:')[1]?.split('Senate Resolution No. 8:')[0];
 if(!section||!section.includes('COMMITTEE ON RULES AND ADMINISTRATION (10)')||
  !section.includes('The motion prevailed. So the resolution was adopted.'))throw Error('SR7 adoption not independently authenticated');
 return source;
}
if(process.argv[1]?.endsWith('/verify-senate-864-sf1-originals.ts'))verifySf1Originals().then(()=>console.log('SENATE864_SF1_EXACT_MINUTES_AND_SR7_VERIFIED')).catch(()=>{console.error('SENATE864_SF1_SOURCE_HOLD');process.exitCode=1});
