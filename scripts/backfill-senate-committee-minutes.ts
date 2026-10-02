import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES=[
  'DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const SOURCE_SYSTEM='mn_senate_committee_minutes';
const SELECTION_PASS='senator-corpus-v3';
const BATCH_SIZE=Math.max(1,Math.min(60,Number(process.env.VOTEPREDICT_SENATE_COMMITTEE_BATCH??30)||30));
let secretValues:string[]=[];

function mask(value:string):void{
  if(value.length<=3)return;
  console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));
}
function safeMessage(error:unknown):string{
  let message=error instanceof Error?(error.stack??error.message):String(error);
  for(const value of secretValues.filter(v=>v.length>3).sort((a,b)=>b.length-a.length)){
    message=message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');
}
async function canConnect(value:string):Promise<boolean>{
  const probe=new Pool({connectionString:value,max:1,connectionTimeoutMillis:8000});
  try{await probe.query('SELECT 1');return true;}catch{return false;}finally{await probe.end().catch(()=>undefined);}
}
async function chooseDb(runtime:Record<string,string|undefined>):Promise<string>{
  for(const key of DATABASE_CANDIDATES){
    const value=runtime[key]?.trim();
    if(value&&await canConnect(value))return value;
  }
  const secret=runtime.CRON_SECRET?.trim();
  if(!secret)throw new Error('CRON_SECRET unavailable for authenticated database bridge');
  mask(secret);
  const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});
  if(!response.ok)throw new Error('Database bridge HTTP '+response.status);
  const value=(await response.text()).trim();
  if(!/^postgres(?:ql)?:\/\//i.test(value))throw new Error('Database bridge returned invalid URL');
  secretValues.push(value);mask(value);
  if(!await canConnect(value))throw new Error('Database bridge returned non-portable URL');
  return value;
}
function sessionForYear(year:number):string{
  if(year===2022)return '2021-2022';
  if(year===2023||year===2024)return '2023-2024';
  if(year===2025||year===2026)return '2025-2026';
  throw new Error('Unsupported Senate committee year '+year);
}
function freshness(year:number):'current'|'recent'|'stale'{
  const age=new Date().getUTCFullYear()-year;
  return age<=1?'current':age<=3?'recent':'stale';
}

type Candidate={
  membershipId:string;
  legislatorId:string;
  name:string;
  normalizedName?:string;
  aliases?:string[];
  startsOn?:string|null;
  endsOn?:string|null;
};

async function candidatesForSession(pool:Pool,sessionSlug:string):Promise<Candidate[]>{
  const rows=await pool.query<{
    membership_id:string;legislator_id:string;name:string;normalized_name:string;
    starts_on:string|null;ends_on:string|null;
  }>(`
    SELECT m.id::text membership_id,l.id::text legislator_id,l.name,l.normalized_name,
           m.starts_on::text,m.ends_on::text
      FROM memberships m
      JOIN legislators l ON l.id=m.legislator_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
     WHERE s.slug=$1 AND c.slug='senate'`,[sessionSlug]);
  const aliases=await pool.query<{membership_id:string;source_name:string}>(`
    SELECT a.membership_id::text,a.source_name
      FROM membership_source_aliases a
      JOIN memberships m ON m.id=a.membership_id
      JOIN legislative_sessions s ON s.id=m.session_id
      JOIN chambers c ON c.id=m.chamber_id
     WHERE s.slug=$1 AND c.slug='senate'`,[sessionSlug]);
  const aliasMap=new Map<string,string[]>();
  for(const row of aliases.rows)aliasMap.set(row.membership_id,[...(aliasMap.get(row.membership_id)??[]),row.source_name]);
  return rows.rows.map(row=>({
    membershipId:row.membership_id,legislatorId:row.legislator_id,name:row.name,
    normalizedName:row.normalized_name,aliases:aliasMap.get(row.membership_id)??[],
    startsOn:row.starts_on,endsOn:row.ends_on,
  }));
}

async function main():Promise<void>{
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if(!envFile)throw new Error('VOTEPREDICT_PRODUCTION_ENV_FILE is required');
  const runtime=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  secretValues=Object.entries(runtime)
    .filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([,value])=>value)
    .filter((value):value is string=>typeof value==='string');
  secretValues.forEach(mask);
  process.env.DATABASE_URL=await chooseDb(runtime);
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const [
    {pool},
    {persistDurableEvidence},
    {activeMembershipCandidates,reconcileHouseMemberName},
    {parseSenateCommitteeMinuteVotes,parseSenateCommitteeMinuteContextActions,MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,normalizeSenateCommitteeMemberSourceName},
    {discoverSenateCommitteeMinuteDocuments,fetchSenateCommitteeMinutePdf,MN_SENATE_COMMITTEE_SOURCE_VERSION},
  ]=await Promise.all([
    import('../src/lib/db/index.js'),
    import('../src/evidence/durable-ingestion.js'),
    import('../src/sources/minnesota/member-reconciliation.js'),
    import('../src/evidence/minnesota-senate-committee-minutes.js'),
    import('../src/evidence/minnesota-senate-committee-source.js'),
  ]);

  try{
    const discovered:Array<{year:number;committeeName:string;meetingDate:string;url:string}>=[];
    const discoveryByYear:Record<string,{committeePages:number;documents:number}>={};
    for(const year of [2022,2023,2024,2025,2026]){
      const result=await discoverSenateCommitteeMinuteDocuments({year});
      discoveryByYear[String(year)]={committeePages:result.committeePages,documents:result.documents.length};
      discovered.push(...result.documents);
    }
    discovered.sort((a,b)=>a.meetingDate.localeCompare(b.meetingDate)||a.committeeName.localeCompare(b.committeeName)||a.url.localeCompare(b.url));
    if(discovered.length===0){
      throw new Error('Official LRL Senate committee discovery returned zero Minutes PDFs for 2022-2026');
    }

    const prior=await pool.query<{next_offset:number|null}>(`
      SELECT CASE WHEN metadata->>'nextOffset' ~ '^[0-9]+$' THEN (metadata->>'nextOffset')::int ELSE 0 END next_offset
        FROM ingestion_runs
       WHERE source_system=$1 AND status='complete' AND metadata->>'selectionPass'=$2
       ORDER BY finished_at DESC NULLS LAST LIMIT 1`,[SOURCE_SYSTEM,SELECTION_PASS]);
    const offset=discovered.length?((prior.rows[0]?.next_offset??0)%discovered.length):0;
    const batch=discovered.length<=BATCH_SIZE
      ? discovered
      : [...discovered.slice(offset,offset+BATCH_SIZE),...discovered.slice(0,Math.max(0,offset+BATCH_SIZE-discovered.length))];
    const plannedNextOffset=discovered.length?(offset+batch.length)%discovered.length:0;

    const run=await pool.query<{id:string}>(`
      INSERT INTO ingestion_runs(source_system,scope,status,metadata)
      VALUES($1,$2,'running',$3::jsonb) RETURNING id::text`,[
      SOURCE_SYSTEM,`batch:${BATCH_SIZE}`,JSON.stringify({
        selectionPass:SELECTION_PASS,parserVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
        actionsParserVersion:MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
        sourceVersion:MN_SENATE_COMMITTEE_SOURCE_VERSION,totalDocuments:discovered.length,
        batchDocuments:batch.length,offset,nextOffset:offset,plannedNextOffset,discoveryByYear,
        electronicCoverage:{availableYears:[2022,2023,2024,2025,2026],unavailableYears:[2021]},
      }),
    ]);
    const runId=run.rows[0].id;

    const rosterCache=new Map<string,Candidate[]>();
    const billsCache=new Map<string,Map<string,string>>();
    const contextCache=new Map<string,{sessionId:string;chamberId:string}>();
    let documentsFetched=0,ocrDocuments=0,observations=0,namedObservations=0,countOnlyObservations=0;
    let contextActions=0,voiceVoteActions=0,unanimousActions=0,resultOnlyActions=0;
    let memberVotes=0,inserted=0,reused=0,unresolvedMembers=0,unresolvedBills=0,failures=0;
    const failureSamples:string[]=[];
    const unresolvedMemberSamples:string[]=[];

    for(const doc of batch){
      try{
        const sessionSlug=sessionForYear(doc.year);
        let roster=rosterCache.get(sessionSlug);
        if(!roster){
          roster=await candidatesForSession(pool,sessionSlug);
          rosterCache.set(sessionSlug,roster);
        }
        let bills=billsCache.get(sessionSlug);
        if(!bills){
          const result=await pool.query<{id:string;identifier:string}>(`
            SELECT b.id::text,upper(b.identifier) identifier
              FROM bills b JOIN legislative_sessions s ON s.id=b.session_id
             WHERE s.slug=$1`,[sessionSlug]);
          bills=new Map(result.rows.map(row=>[row.identifier,row.id]));
          billsCache.set(sessionSlug,bills);
        }
        let context=contextCache.get(sessionSlug);
        if(!context){
          const result=await pool.query<{session_id:string;chamber_id:string}>(`
            SELECT s.id::text session_id,c.id::text chamber_id
              FROM legislative_sessions s
              JOIN jurisdictions j ON j.id=s.jurisdiction_id
              JOIN chambers c ON c.jurisdiction_id=j.id AND c.slug='senate'
             WHERE j.slug='us-mn' AND s.slug=$1`,[sessionSlug]);
          if(result.rows.length!==1)throw new Error('Senate session context could not be resolved for '+sessionSlug);
          context={sessionId:result.rows[0].session_id,chamberId:result.rows[0].chamber_id};
          contextCache.set(sessionSlug,context);
        }

        const pdf=await fetchSenateCommitteeMinutePdf({url:doc.url});
        documentsFetched+=1;
        if(pdf.extractionMethod==='ocr_tesseract')ocrDocuments+=1;
        const parsed=parseSenateCommitteeMinuteVotes(pdf.text);
        const contextOnlyActions=parseSenateCommitteeMinuteContextActions(pdf.text);
        observations+=parsed.length;
        contextActions+=contextOnlyActions.length;
        voiceVoteActions+=contextOnlyActions.filter(action=>action.actionKind==='voice_vote').length;
        unanimousActions+=contextOnlyActions.filter(action=>action.actionKind==='unanimous_action').length;
        resultOnlyActions+=contextOnlyActions.filter(action=>action.actionKind==='motion_result_only').length;
        const drafts:Array<any>=[];
        const resolvedVotes:Array<Array<{membershipId:string;sourceName:string;normalizedName:string;choice:'yea'|'nay';reason:string}>>=
          parsed.map(()=>[]);

        for(const [observationIndex,observation] of parsed.entries()){
          const knownBill=observation.billIdentifier&&bills.has(observation.billIdentifier.toUpperCase())
            ? observation.billIdentifier.toUpperCase()
            : undefined;
          if(observation.billIdentifier&&!knownBill)unresolvedBills+=1;

          if(observation.individualVotesAvailable){
            namedObservations+=1;
            const active=activeMembershipCandidates(roster,doc.meetingDate);
            for(const vote of observation.memberVotes){
              const reconciliationSourceName=normalizeSenateCommitteeMemberSourceName(vote.sourceName);
              const resolution=reconcileHouseMemberName(reconciliationSourceName,active);
              if(resolution.status!=='matched'){
                unresolvedMembers+=1;
                if(unresolvedMemberSamples.length<30){
                  unresolvedMemberSamples.push(`${doc.meetingDate} ${doc.committeeName}: ${vote.sourceName} -> ${resolution.status}`);
                }
                continue;
              }
              const candidate=active.find(row=>row.membershipId===resolution.membershipId);
              memberVotes+=1;
              resolvedVotes[observationIndex].push({
                membershipId:resolution.membershipId,
                sourceName:vote.sourceName,
                normalizedName:vote.normalizedName,
                choice:vote.choice,
                reason:resolution.reason,
              });
              drafts.push({
                target:{
                  membershipId:resolution.membershipId,
                  ...(knownBill?{billIdentifier:knownBill,sessionSlug}:{}),
                  occurredOn:doc.meetingDate,
                },
                kind:'fact',stance:'neutral',
                claim:`${candidate?.name??vote.sourceName} cast a recorded ${vote.choice.toUpperCase()} vote on a Minnesota Senate ${doc.committeeName} committee ${observation.voteKind} on ${doc.meetingDate}.`,
                excerpt:observation.motionText.slice(0,600),
                sourceQuality:'official',relevance:'high',freshness:freshness(doc.year),
                extractionMethod:'deterministic-senate-committee-roll-call',
                extractionVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
                confidence:pdf.extractionMethod==='ocr_tesseract'?0.9:1,
                metadata:{
                  contextType:'senate_committee_vote',subtype:'named_roll_call',
                  committeeName:doc.committeeName,meetingDate:doc.meetingDate,
                  billIdentifier:observation.billIdentifier??null,amendmentRef:observation.amendmentRef??null,
                  voteKind:observation.voteKind,voteChoice:vote.choice,yeaCount:observation.yeaCount,nayCount:observation.nayCount,
                  motionPassed:observation.passed??null,motionText:observation.motionText,
                  individualVotesAvailable:true,sourceVerified:true,textExtractionMethod:pdf.extractionMethod,
                  meetingDateIsAvailability:false,asOfEligible:false,
                  availabilityStatus:'official_archive_current_bytes_no_publication_timestamp',
                  sameDayEligible:false,finalPassageStanceInferred:false,
                  mechanicallyActionable:false,modelWeight:0,
                  reconciliationReason:resolution.reason,
                  reconciliationSourceName,
                  sourceAliasApplied:reconciliationSourceName!==vote.sourceName,
                  ingestionIdentityKey:`${doc.url}|obs:${observationIndex}|member:${resolution.membershipId}|choice:${vote.choice}`,
                },
              });
            }
          }else{
            countOnlyObservations+=1;
            drafts.push({
              target:knownBill?{billIdentifier:knownBill,sessionSlug,occurredOn:doc.meetingDate}:undefined,
              kind:'context',stance:'neutral',
              claim:`Minnesota Senate ${doc.committeeName} committee minutes record a ${observation.yeaCount}-${observation.nayCount} committee vote on ${doc.meetingDate}, but do not identify individual votes.`,
              excerpt:observation.motionText.slice(0,600),
              sourceQuality:'official',relevance:'medium',freshness:freshness(doc.year),
              extractionMethod:'deterministic-senate-committee-count-only',
              extractionVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
              confidence:pdf.extractionMethod==='ocr_tesseract'?0.9:1,
              metadata:{
                contextType:'senate_committee_vote',subtype:'count_only_roll_call',
                committeeName:doc.committeeName,meetingDate:doc.meetingDate,
                billIdentifier:observation.billIdentifier??null,amendmentRef:observation.amendmentRef??null,
                voteKind:observation.voteKind,yeaCount:observation.yeaCount,nayCount:observation.nayCount,
                motionPassed:observation.passed??null,motionText:observation.motionText,
                individualVotesAvailable:false,sourceVerified:true,textExtractionMethod:pdf.extractionMethod,
                meetingDateIsAvailability:false,asOfEligible:false,
                availabilityStatus:'official_archive_current_bytes_no_publication_timestamp',
                sameDayEligible:false,finalPassageStanceInferred:false,
                mechanicallyActionable:false,modelWeight:0,
                ingestionIdentityKey:`${doc.url}|obs:${observationIndex}|count:${observation.yeaCount}-${observation.nayCount}`,
              },
            });
          }
        }

        for(const action of contextOnlyActions){
          const knownBill=action.billIdentifier&&bills.has(action.billIdentifier.toUpperCase())
            ? action.billIdentifier.toUpperCase()
            : undefined;
          if(action.billIdentifier&&!knownBill)unresolvedBills+=1;
          const sourceBill=knownBill??action.billIdentifier;
          const subject=[
            sourceBill??null,
            action.amendmentRef??null,
          ].filter(Boolean).join(' ');
          const methodLabel=action.actionKind==='voice_vote'
            ? 'voice-vote'
            : action.actionKind==='unanimous_action'
              ? 'unanimous'
              : 'result-only';
          const outcomeLabel=action.passed?'prevailed':'failed';
          const actionHash=createHash('sha256').update(action.motionText).digest('hex').slice(0,20);
          drafts.push({
            target:knownBill?{billIdentifier:knownBill,sessionSlug,occurredOn:doc.meetingDate}:undefined,
            kind:'context',stance:'neutral',
            claim:`Minnesota Senate ${doc.committeeName} committee minutes record a ${methodLabel} ${action.voteKind} action${subject?' on '+subject:''} that ${outcomeLabel} on ${doc.meetingDate}; the minutes do not provide member-resolved YEA/NAY votes for this action.`,
            excerpt:action.motionText.slice(0,600),
            sourceQuality:'official',relevance:'medium',freshness:freshness(doc.year),
            extractionMethod:'deterministic-senate-committee-action-context',
            extractionVersion:MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
            confidence:pdf.extractionMethod==='ocr_tesseract'?0.9:1,
            metadata:{
              contextType:'senate_committee_action',subtype:action.actionKind,
              committeeName:doc.committeeName,meetingDate:doc.meetingDate,
              billIdentifier:action.billIdentifier??null,amendmentRef:action.amendmentRef??null,
              voteKind:action.voteKind,motionPassed:action.passed,motionText:action.motionText,
              individualVotesAvailable:false,committeeActionOnly:true,sourceVerified:true,
              textExtractionMethod:pdf.extractionMethod,
              meetingDateIsAvailability:false,asOfEligible:false,
              availabilityStatus:'official_archive_current_bytes_no_publication_timestamp',
              sameDayEligible:false,finalPassageStanceInferred:false,
              mechanicallyActionable:false,modelWeight:0,
              ingestionIdentityKey:`${doc.url}|action:${action.actionKind}|${actionHash}`,
            },
          });
        }

        const persisted=await persistDurableEvidence({
          sourceKind:'senate_committee_minutes',
          sourceUrl:doc.url,
          contentSha256:pdf.contentSha256,
          sessionSlug,
          chamberSlug:'senate',
          fetchedAt:pdf.fetchedAt,
          httpStatus:pdf.httpStatus,
          metadata:{
            publisher:'Minnesota Legislative Reference Library',
            committeeName:doc.committeeName,meetingDate:doc.meetingDate,
            parserVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
            actionsParserVersion:MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
            sourceVersion:MN_SENATE_COMMITTEE_SOURCE_VERSION,
            officialArchive:true,textExtractionMethod:pdf.extractionMethod,meetingDateIsAvailability:false,asOfEligible:false,
          },
        },drafts);
        inserted+=persisted.inserted;reused+=persisted.reused;

        const sourceKey=createHash('sha256').update(doc.url).digest('hex').slice(0,16);
        for(const [observationIndex,observation] of parsed.entries()){
          const billId=observation.billIdentifier
            ? (bills.get(observation.billIdentifier.toUpperCase())??null)
            : null;
          const externalKey=`senate-committee:${sourceKey}:${observationIndex}`;
          const event=await pool.query<{id:string}>(`
            INSERT INTO vote_events(
              session_id,chamber_id,bill_id,source_document_id,external_key,vote_kind,motion_text,
              amendment_ref,occurred_on,yea_count,nay_count,other_count,passed,is_passage,metadata
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,false,$13::jsonb)
            ON CONFLICT(session_id,chamber_id,external_key)
            DO UPDATE SET
              bill_id=EXCLUDED.bill_id,source_document_id=EXCLUDED.source_document_id,
              vote_kind=EXCLUDED.vote_kind,motion_text=EXCLUDED.motion_text,
              amendment_ref=EXCLUDED.amendment_ref,occurred_on=EXCLUDED.occurred_on,
              yea_count=EXCLUDED.yea_count,nay_count=EXCLUDED.nay_count,passed=EXCLUDED.passed,
              metadata=vote_events.metadata||EXCLUDED.metadata
            RETURNING id::text`,[
            context.sessionId,context.chamberId,billId,persisted.sourceDocumentId,externalKey,
            observation.voteKind,observation.motionText,observation.amendmentRef??null,
            doc.meetingDate,observation.yeaCount,observation.nayCount,observation.passed??null,
            JSON.stringify({
              source:'Minnesota Legislative Reference Library committee minutes',
              committeeName:doc.committeeName,committeeVote:true,
              individualVotesAvailable:observation.individualVotesAvailable,
              finalPassageStanceInferred:false,textExtractionMethod:pdf.extractionMethod,parserVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
            }),
          ]);
          for(const [ordinal,vote] of resolvedVotes[observationIndex].entries()){
            await pool.query(`
              INSERT INTO member_votes(
                vote_event_id,membership_id,source_member_name,normalized_member_name,choice,source_ordinal,metadata
              ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
              ON CONFLICT(vote_event_id,normalized_member_name)
              DO UPDATE SET membership_id=EXCLUDED.membership_id,choice=EXCLUDED.choice,metadata=member_votes.metadata||EXCLUDED.metadata`,[
              event.rows[0].id,vote.membershipId,vote.sourceName,vote.normalizedName,vote.choice,ordinal,
              JSON.stringify({committeeVote:true,reconciliationReason:vote.reason,textExtractionMethod:pdf.extractionMethod}),
            ]);
          }
        }
      }catch(error){
        failures+=1;
        if(failureSamples.length<30)failureSamples.push(`${doc.meetingDate} ${doc.committeeName}: ${safeMessage(error).slice(0,320)}`);
      }
    }

    const nextOffset=failures>0?offset:plannedNextOffset;
    const result={
      selectionPass:SELECTION_PASS,parserVersion:MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,
      actionsParserVersion:MN_SENATE_COMMITTEE_ACTIONS_PARSER_VERSION,
      sourceVersion:MN_SENATE_COMMITTEE_SOURCE_VERSION,totalDocuments:discovered.length,
      batchDocuments:batch.length,offset,nextOffset,plannedNextOffset,retryRequired:failures>0,discoveryByYear,documentsFetched,ocrDocuments,
      observations,namedObservations,countOnlyObservations,contextActions,voiceVoteActions,unanimousActions,resultOnlyActions,
      memberVotes,inserted,reused,
      unresolvedMembers,unresolvedBills,failures,failureSamples,unresolvedMemberSamples,
      sourceBoundary:{
        electronicMinutesBegin:2022,
        year2021:'official print minutes exist at LRL but no electronic Senate minutes corpus is exposed by the LRL index',
        year2022:'electronic and print collections may differ',
        years2023Plus:'LRL states Senate minutes are electronic-only',
      },
      policy:{
        meetingDateIsAvailability:false,asOfEligible:false,sameDayEligible:false,
        finalPassageStanceInferred:false,mechanicallyActionable:false,modelWeight:0,
        committeeActionsAreMemberVotes:false,productionAction:'none',
      },
    };
    await pool.query(`
      UPDATE ingestion_runs SET status=$2,finished_at=now(),source_documents=$3,
             vote_events=$4,member_votes=$5,unresolved_members=$6,error_summary=$7,
             metadata=metadata||$8::jsonb
       WHERE id=$1::uuid`,[
      runId,'complete',documentsFetched,observations,
      memberVotes,unresolvedMembers,failureSamples[0]??null,JSON.stringify(result),
    ]);
    console.log(JSON.stringify({senateCommitteeMinutesBackfill:result},null,2));
  }finally{
    await pool.end();
  }
}

main().catch(error=>{console.error(safeMessage(error));process.exitCode=1;});
