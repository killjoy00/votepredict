import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {sha1Base32} from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';
import {
 CFB_864_PINNED_V4_MARKER,PINNED_CFB_ORIGINALS,PINNED_V4_SCHEMA,
 PINNED_V4_CDX_BYTES,PINNED_V4_RAW_BYTES,
 validReplayRedirect,authenticatePinnedCfbOriginal,
 collectPinnedCfbOriginals,validatePinnedV4Receipt,
} from '../scripts/prove-cfb-864-pinned-public-originals-v4.js';

function fixture(stream:string):Uint8Array{
 const ie=stream==='independent_expenditures';
 const contributions=stream==='candidate_contributions';
 const heading=ie
  ?'Year,Spender,Affected Comte Name,For /Against,Amount,Unpaid amount,Date'
  :contributions
  ?'Year,Recipient,Recipient reg num,Receipt date,Contributor,Amount'
  :'Year,Committee name,Committee reg num,Date,Amount,Unpaid amount,Vendor name';
 const rows=Array.from({length:35},(_,i)=>{
  const year=i<17?2021:2022,date=year+'-03-'+String(i%28+1).padStart(2,'0');
  return ie?[year,'Synthetic PAC','Example Candidate Senate Committee','for',100+i,0,date]
   .join(',')
   :contributions?[year,'Example Committee','12345',date,'Synthetic '+i,100+i]
   .join(',')
   :[year,'Example Committee','12345',date,100+i,0,'Synthetic '+i].join(',');
 });
 return Buffer.from([heading,...rows].join('\n')+'\n','utf8');
}
function served(content:Uint8Array|string,url:string,status=200,headers?:Record<string,string>){
 const res=new Response(content as string,{status,headers});
 Object.defineProperty(res,'url',{value:url});
 return res;
}
const headers=['timestamp','original','statuscode','digest','mimetype','length'];
const cdxResponse=(source:(typeof PINNED_CFB_ORIGINALS)[number],
 bytes:Uint8Array)=>JSON.stringify([headers,[
 source.timestamp,source.original,'200',sha1Base32(bytes),'text/plain',
 String(bytes.length),
]]);
const isCdx=(url:string)=>url.startsWith('https://web.archive.org/cdx/search/cdx?');
const isReplay=(url:string)=>url.startsWith('https://web.archive.org/web/');

test('pinned public source identity includes all three required tracks, exact historical captures',()=>{
 assert.equal(PINNED_CFB_ORIGINALS.length,10);
 assert.deepEqual(PINNED_CFB_ORIGINALS.slice(0,3).map(x=>x.stream),[
  'candidate_contributions','candidate_contributions','candidate_expenditures',
 ]);
 assert.equal(PINNED_CFB_ORIGINALS.filter(x=>x.stream==='independent_expenditures').length,7);
 assert.deepEqual(PINNED_CFB_ORIGINALS.slice(0,3).map(x=>x.timestamp),[
  '20220606102411','20230612002907','20220606103037',
 ]);
 assert.equal(PINNED_V4_CDX_BYTES,160000);
 assert.equal(PINNED_V4_RAW_BYTES,120000000);
 assert.equal(CFB_864_PINNED_V4_MARKER,'SENATE_864_CFB_PINNED_ORIGINALS_V4_20261012');
 assert.equal(PINNED_V4_SCHEMA,'cfb-864-original-csv-pinned-v4');
});
test('only exact same-capture Wayback redirect and CFB official selector allowed',()=>{
 const s=PINNED_CFB_ORIGINALS[0];
 const start='https://web.archive.org/web/'+s.timestamp+'id_/'+s.original;
 assert.equal(validReplayRedirect(start,start,s),start);
 const alternative=start.replace('/https://cfb.mn.gov/','/http://cfb.mn.gov/');
 assert.equal(validReplayRedirect(start,alternative,s),alternative);
 for(const target of [
  'https://evil.invalid/web/'+s.timestamp+'id_/'+s.original,
  start.replace(s.timestamp,'20220607102411'),
  start.replace('id_/','_/'),
  start.replace('-2113865252','-1890073264'),
  start.replace('web.archive.org','www.cfb.mn.gov'),
  start.replace('https://','http://'),
 ])assert.throws(()=>validReplayRedirect(start,target,s));
});
test('fixed CDX match plus same-capture replay allows full raw original SHA1 and parser',async()=>{
 const source=PINNED_CFB_ORIGINALS[0],bytes=fixture(source.stream);
 let replayCalls=0;
 const fake=async(url:RequestInfo|URL,init?:RequestInit)=>{
  const v=String(url);
  assert.equal(init?.redirect,'manual');
  if(isCdx(v)){
   const p=new URL(v).searchParams;
   assert.equal(p.get('from'),source.timestamp.slice(0,8));
   assert.equal(p.get('to'),source.timestamp.slice(0,8));
   assert.equal(p.get('url'),source.original);
   return served(cdxResponse(source,bytes),v);
  }
  assert.ok(isReplay(v));replayCalls++;
  if(replayCalls===1){
   return served('',v,302,{
    location:v.replace('/https://cfb.mn.gov/','/http://cfb.mn.gov/'),
   });
  }
  return served(bytes,v);
 };
 const {result,authenticated}=await authenticatePinnedCfbOriginal(source,fake as typeof fetch);
 assert.equal(result.status,'verified');
 assert.equal(result.replayRequests,2);
 assert.equal(authenticated?.proof.safeRedirectHops,1);
 assert.equal(authenticated?.proof.cdxSha1Base32,sha1Base32(bytes));
 assert.equal(authenticated?.proof.distinctRowKeys,35);
 assert.equal(authenticated?.proof.rows2021,17);
 assert.equal(authenticated?.proof.rows2022,18);
 assert.equal(authenticated?.rowKeys.size,35);
 assert.equal(Object.keys(result.verified!).includes('rowKeys'),false);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic [0-9]+|Example Committee|rowKey:|cfb\.mn\.gov/);
});
test('independent expenditure original parser is independently rehashed, not candidate logic',async()=>{
 const source=PINNED_CFB_ORIGINALS.find(x=>x.stream==='independent_expenditures')!;
 const bytes=fixture(source.stream);
 const fake=async(url:RequestInfo|URL)=>{
  const v=String(url);
  return served(isCdx(v)?cdxResponse(source,bytes):bytes,v);
 };
 const x=await authenticatePinnedCfbOriginal(source,fake as typeof fetch);
 assert.equal(x.result.status,'verified');
 assert.equal(x.authenticated?.rowKeys.size,35);
 assert.equal(x.authenticated?.proof.rows2021,17);
 assert.equal(x.authenticated?.proof.rows2022,18);
});
test('public-only bounded ten-source receipt holds distinct untrusted source states without leaking keys',async()=>{
 const src=PINNED_CFB_ORIGINALS;
 const fake=async(url:RequestInfo|URL)=>{
  const v=String(url);
  const index=isCdx(v);
  const source=index?src.find(s=>new URL(v).searchParams.get('url')===s.original
   &&new URL(v).searchParams.get('from')===s.timestamp.slice(0,8))
   :src.find(s=>v.includes(s.timestamp+'id_/')&&v.includes(s.original));
  if(!source)throw Error('Unapproved source network request');
  const bytes=fixture(source.stream);
  return served(index?cdxResponse(source,bytes):bytes,v);
 };
 // Two contributions on distinct days; all 10 captures have an exact pin.
 const valid=await collectPinnedCfbOriginals(fake as typeof fetch);
 assert.equal(valid.results.length,10);
 assert.ok(valid.results.every(s=>s.status==='verified'));
 assert.ok(valid.results.every(s=>s.verified?.distinctRowKeys===35));
 assert.equal(valid.privateStoredParityEstablished,false);
 assert.equal(valid.firstPublicDateEstablished,false);
 assert.equal(valid.noOriginalBodiesUploadedOrLogged,true);
 assert.doesNotMatch(JSON.stringify(valid),/Synthetic [0-9]+|Synthetic PAC|Affected Comte Name|Example Committee|\\\"rowKeys\\\"|fullBody/i);
});
test('bad digest, a changed original, or changed timestamp causes HOLD, never positive',async()=>{
 const source=PINNED_CFB_ORIGINALS[2],bytes=fixture(source.stream);
 const wrong=async(url:RequestInfo|URL)=>{
  const v=String(url);
  if(isCdx(v))return served(cdxResponse(source,bytes),v);
  return served(Buffer.from('X'+Buffer.from(bytes).toString('utf8').slice(1)),v);
 };
 const changed=await authenticatePinnedCfbOriginal(source,wrong as typeof fetch);
 assert.equal(changed.result.status,'replay_digest_mismatch');
 assert.equal(changed.authenticated,null);
 const cdxBad=async(url:RequestInfo|URL)=>{
  const v=String(url);
  const wrongDate=JSON.parse(cdxResponse(source,bytes));
  wrongDate[1][0]='20220607103037';
  return served(JSON.stringify(wrongDate),v);
 };
 const noPin=await authenticatePinnedCfbOriginal(source,cdxBad as typeof fetch);
 assert.equal(noPin.result.status,'cdx_pin_not_indexed');
 const evil=async(url:RequestInfo|URL)=>{
  const v=String(url);
  if(isCdx(v))return served(cdxResponse(source,bytes),v);
  return served('',v,302,{location:v.replace('web.archive.org','evil.invalid')});
 };
 const blocked=await authenticatePinnedCfbOriginal(source,evil as typeof fetch);
 assert.equal(blocked.result.status,'replay_redirect_hold');
 assert.equal(blocked.authenticated,null);
});
test('fail closed if CDX has unexpected extra fields, malformed origin, or private receipt attributes',async()=>{
 const source=PINNED_CFB_ORIGINALS[1],bytes=fixture(source.stream);
 const badIndex=async(url:RequestInfo|URL)=>{
  const v=String(url),bad=JSON.parse(cdxResponse(source,bytes));
  bad[0].push('rawDonor');bad[1].push('TEST_PERSON');
  return served(JSON.stringify(bad),v);
 };
 const outcome=await authenticatePinnedCfbOriginal(source,badIndex as typeof fetch);
 assert.ok(['cdx_invalid_hold','cdx_identity_hold'].includes(outcome.result.status));
 assert.equal(outcome.authenticated,null);
 const valid=await collectPinnedCfbOriginals((async()=>{throw Error('HOLD network details secret')}) as typeof fetch);
 assert.equal(valid.results.length,10);
 assert.ok(valid.results.every(x=>x.status==='cdx_network_hold'));
 assert.doesNotMatch(JSON.stringify(valid),/network details secret/);
 const bad=[{...valid,rawSourceUrl:'https://www.someone.invalid/'},
  {...valid,firstPublicDateEstablished:true},
  {...valid,results:[{...valid.results[0],donor:'private'},...valid.results.slice(1)]},
  {...valid,results:[{...valid.results[0],cdxRowsChecked:61},...valid.results.slice(1)]},
  {...valid,results:[{...valid.results[0],verified:{extra:'fake'}},...valid.results.slice(1)]},
 ];
 for(const x of bad)assert.throws(()=>validatePinnedV4Receipt(x));
});
test('public one-shot workflow needs full merged SHA checks, no protected credentials',()=>{
 const file='.github/workflows/senate-864-cfb-pinned-originals-v4.yml';
 const s=readFileSync(file,'utf8');
 assert.match(s,/issue_comment:\n    types: \[created\]/);
 assert.match(s,/SENATE_864_CFB_PINNED_ORIGINALS_V4_20261012/);
 assert.match(s,/github\.event\.issue\.number == 864/);
 assert.match(s,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(s,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(s,/npm run check/);
 assert.match(s,/npm audit --omit=dev --audit-level=high/);
 assert.match(s,/git log -1 --format=%B \| grep -Fq/);
 assert.doesNotMatch(s,/NEON_API_KEY|secrets\.|VERCEL_TOKEN|upload-artifact|^\s*schedule:/m);
 assert.match(s,/DATABASE_URL_UNPOOLED: postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
});
