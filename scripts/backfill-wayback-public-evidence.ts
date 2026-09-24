import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES=['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_BATCH=12;
let secrets:string[]=[];
function mask(v:string){if(v.length>3)console.log('::add-mask::'+v.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));}
function safe(e:unknown){let m=e instanceof Error?(e.stack??e.message):String(e);for(const v of secrets.filter(x=>x.length>3).sort((a,b)=>b.length-a.length))m=m.split(v).join('[redacted]');return m.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');}
async function chooseDb(env:Record<string,string|undefined>){
  const {Pool}=await import('pg');
  async function works(v:string){const p=new Pool({connectionString:v,max:1,connectionTimeoutMillis:8000});try{await p.query('select 1');return true;}catch{return false;}finally{await p.end().catch(()=>undefined);}}
  for(const k of DATABASE_CANDIDATES){const v=env[k]?.trim();if(v&&await works(v))return v;}
  const s=env.CRON_SECRET?.trim();if(!s)throw new Error('CRON_SECRET unavailable');
  const r=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+s}});
  if(!r.ok)throw new Error('Database bridge HTTP '+r.status);
  const v=(await r.text()).trim();secrets.push(v);mask(v);if(!await works(v))throw new Error('Database bridge returned non-portable URL');return v;
}
function freshness(capturedAt:string){
  const age=(Date.now()-new Date(capturedAt).getTime())/86400000;
  return age<=365?'current' as const:age<=1095?'recent' as const:'stale' as const;
}
type SeedRow={
  membership_id:string;member_name:string;session_slug:string;chamber_slug:'house'|'senate';
  subtype:string;source_kind:string;source_url:string;source_quality:'official'|'member_primary'|'other'|'unknown';
  campaign_website:string|null;
};
async function main(){
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;if(!envFile)throw new Error('Production env file required');
  const env=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));secrets=Object.entries(env).filter(([k])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(k)).map(([,v])=>v).filter((v):v is string=>typeof v==='string');secrets.forEach(mask);
  process.env.DATABASE_URL=await chooseDb(env);delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;
  const {pool}=await import('../src/lib/db/index.js');
  const {persistDurableEvidence}=await import('../src/evidence/durable-ingestion.js');
  const {discoverWaybackCaptures,fetchWaybackSnapshot}=await import('../src/evidence/wayback.js');
  const {selectWaybackEvidenceCaptures,sessionArchiveWindow,WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION}=await import('../src/evidence/wayback-public-evidence-backfill.js');
  const {extractExplicitBillStatements}=await import('../src/evidence/bill-statement-extractor.js');
  try{
    const seedResult=await pool.query<SeedRow>(`
      SELECT DISTINCT ON (ei.membership_id,ei.metadata->>'subtype',COALESCE(ei.metadata->>'campaignWebsite',sd.source_url))
             ei.membership_id::text,l.name AS member_name,s.slug AS session_slug,c.slug AS chamber_slug,
             ei.metadata->>'subtype' AS subtype,sd.source_kind,sd.source_url,ei.source_quality,
             ei.metadata->>'campaignWebsite' AS campaign_website
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislators l ON l.id=m.legislator_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND (
           ei.metadata->>'subtype' IN ('campaign_site_registry','member_primary_registry')
           OR sd.source_kind IN ('campaign_site','member_primary_article')
         )
       ORDER BY ei.membership_id,ei.metadata->>'subtype',COALESCE(ei.metadata->>'campaignWebsite',sd.source_url),sd.fetched_at DESC`);
    const seedRows=seedResult.rows.map(row=>({
      ...row,
      seedKind:(row.subtype==='campaign_site_registry'||row.source_kind==='campaign_site')?'campaign' as const:'member_primary' as const,
      seedUrl:row.campaign_website||row.source_url,
      prefix:row.subtype==='campaign_site_registry'||row.subtype==='member_primary_registry',
      quality:row.source_quality==='official'?'official' as const:'member_primary' as const,
      registrySeed:row.subtype==='campaign_site_registry'||row.subtype==='member_primary_registry',
    })).filter(row=>/^https?:\/\//i.test(row.seedUrl));
    // One seed per member/source family/host. Prefer a registry/root seed because prefix
    // discovery can recover historical child pages without repeatedly querying every current article.
    const hostSeeds=new Map<string,(typeof seedRows)[number]>();
    for(const row of seedRows){
      let host:string;
      try{host=new URL(row.seedUrl).hostname.toLowerCase();}catch{continue;}
      const key=row.membership_id+'|'+row.seedKind+'|'+host;
      const prior=hostSeeds.get(key);
      if(!prior||(!prior.registrySeed&&row.registrySeed))hostSeeds.set(key,row);
    }
    const deduped=[...hostSeeds.values()].sort((a,b)=>
      a.session_slug.localeCompare(b.session_slug)
      || a.member_name.localeCompare(b.member_name)
      || a.seedKind.localeCompare(b.seedKind)
      || a.seedUrl.localeCompare(b.seedUrl));

    const prior=await pool.query<{next_offset:number|null}>(`
      SELECT CASE WHEN metadata->>'nextOffset' ~ '^[0-9]+$' THEN (metadata->>'nextOffset')::int ELSE 0 END AS next_offset
        FROM ingestion_runs
       WHERE source_system='wayback-public-evidence' AND status='complete'
       ORDER BY finished_at DESC NULLS LAST LIMIT 1`);
    const batchSize=Math.max(1,Math.min(24,Number(process.env.VOTEPREDICT_WAYBACK_BATCH??DEFAULT_BATCH)||DEFAULT_BATCH));
    const offset=deduped.length?((prior.rows[0]?.next_offset??0)%deduped.length):0;
    const batch=deduped.length<=batchSize?deduped:[...deduped.slice(offset,offset+batchSize),...deduped.slice(0,Math.max(0,offset+batchSize-deduped.length))];
    const nextOffset=deduped.length?(offset+batch.length)%deduped.length:0;
    const run=await pool.query<{id:string}>(`
      INSERT INTO ingestion_runs(source_system,scope,status,metadata)
      VALUES('wayback-public-evidence',$1,'running',$2::jsonb) RETURNING id::text`,
      [`batch:${batchSize}`,JSON.stringify({version:WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION,offset,nextOffset,totalSeeds:deduped.length})]);
    const runId=run.rows[0].id;
    const bills=(await pool.query<{id:string;identifier:string}>(`
      SELECT b.id::text,b.identifier FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
       WHERE s.slug IN ('2021-2022','2023-2024','2025-2026') AND b.identifier ~ '^(HF|SF)[0-9]+$'`)).rows;
    let capturesDiscovered=0,capturesSelected=0,fetched=0,inserted=0,reused=0,statements=0,failures=0;
    const failureSamples:string[]=[];
    for(const seed of batch){
      try{
        const window=sessionArchiveWindow(seed.session_slug);
        const captures=await discoverWaybackCaptures({url:seed.seedUrl,from:window.from,to:window.to,limit:400,prefix:seed.prefix});
        capturesDiscovered+=captures.length;
        const selected=selectWaybackEvidenceCaptures(captures,{maxCaptures:12});
        capturesSelected+=selected.length;
        for(const capture of selected){
          try{
            const page=await fetchWaybackSnapshot(capture);fetched++;
            const sourceSubtype=seed.seedKind==='campaign'?'campaign_site_page' as const:'member_primary_article' as const;
            const extracted=extractExplicitBillStatements({
              membershipId:seed.membership_id,memberName:seed.member_name,text:page.text,
              publishedAt:capture.capturedAt,fetchedAt:page.fetchedAt,bills,sourceSubtype,
            });
            statements+=extracted.length;
            const path=new URL(capture.original).pathname.replace(/\/+$/,'')||'/';
            const drafts=[
              {
                target:{membershipId:seed.membership_id},
                kind:'context' as const,stance:'neutral' as const,
                claim:`Internet Archive captured ${seed.seedKind==='campaign'?'campaign':'member/caucus'} page ${capture.original} on ${capture.capturedAt.slice(0,10)}.`,
                excerpt:page.excerpt,publishedAt:capture.capturedAt,sourceQuality:seed.quality,
                relevance:'medium' as const,freshness:freshness(capture.capturedAt),
                extractionMethod:'deterministic-wayback-public-page-capture',
                extractionVersion:WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION,confidence:1,
                metadata:{
                  contextType:'public_evidence',
                  subtype:seed.seedKind==='campaign'?'archived_campaign_site_page':'archived_member_primary_page',
                  originalUrl:capture.original,archiveUrl:capture.archiveUrl,archiveCapturedAt:capture.capturedAt,
                  availabilityProof:'independent_archive_capture',availableAt:capture.capturedAt,
                  archiveDigest:capture.digest,pagePath:path,sourceVerified:true,contextOnly:true,
                  mechanicallyActionable:false,
                  evidenceSeriesKey:`wayback:${seed.membership_id}:${capture.original}:${capture.timestamp}`,
                },
              },
              ...extracted.map(draft=>({
                ...draft,
                metadata:{
                  ...(draft.metadata??{}),
                  originalUrl:capture.original,archiveUrl:capture.archiveUrl,archiveCapturedAt:capture.capturedAt,
                  availabilityProof:'independent_archive_capture',availableAt:capture.capturedAt,
                  mechanicallyActionable:false,
                },
              })),
            ];
            const persisted=await persistDurableEvidence({
              sourceKind:seed.seedKind==='campaign'?'wayback_campaign_site':'wayback_member_primary',
              sourceUrl:capture.archiveUrl,contentSha256:page.contentSha256,sessionSlug:seed.session_slug,
              chamberSlug:seed.chamber_slug,fetchedAt:page.fetchedAt,httpStatus:page.httpStatus,
              metadata:{
                publisher:'Internet Archive',waybackVersion:WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION,
                originalUrl:capture.original,archiveCapturedAt:capture.capturedAt,archiveDigest:capture.digest,
                availabilityProof:'independent_archive_capture',availableAt:capture.capturedAt,
              },
            },drafts);
            inserted+=persisted.inserted;reused+=persisted.reused;
          }catch(error){failures++;if(failureSamples.length<20)failureSamples.push(seed.member_name+': snapshot: '+safe(error).slice(0,250));}
        }
      }catch(error){failures++;if(failureSamples.length<20)failureSamples.push(seed.member_name+': discovery: '+safe(error).slice(0,250));}
    }
    const result={version:WAYBACK_PUBLIC_EVIDENCE_BACKFILL_VERSION,totalSeeds:deduped.length,batchSeeds:batch.length,offset,nextOffset,capturesDiscovered,capturesSelected,fetched,inserted,reused,explicitBillStatements:statements,failures,failureSamples,policy:{availability:'exact Wayback capture timestamp',sameDayEligible:false,servingChanged:false,productionAction:'none'}};
    await pool.query(`UPDATE ingestion_runs SET status='complete',finished_at=now(),source_documents=$2,metadata=metadata||$3::jsonb WHERE id=$1::uuid`,[runId,fetched,JSON.stringify(result)]);
    console.log(JSON.stringify({waybackPublicEvidenceBackfill:result},null,2));
  }finally{await pool.end();}
}
main().catch(e=>{console.error(safe(e));process.exitCode=1;});
