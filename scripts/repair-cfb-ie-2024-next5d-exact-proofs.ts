import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';

const REPAIR_VERSION = 'cfb-ie-2024-next5d-exact-proof-repair-v1';
const SEGMENT_END_YEAR = 2024;
const EXPECTED_TIMING_DEBT_ROWS_BEFORE = 148;
const EXPECTED_EXACT_MAPPINGS = 148;
const EXPECTED_REMAINING_DEBT_AFTER = 0;
const MAX_REPORTS_PER_GROUP = 24;
const EXPECTED_GLOBAL_MAPPING_DIGEST =
  'c64c828d49b480e485f439794a71f09705b70da67f6c924c09ed11133777c5eb';

const TARGETS = [
  {
    registrationNumber:'41353',
    label:'MN Business & Labor Coalition',
    expectedDebtRows:37,
    expectedMappings:37,
    expectedDigest:'b9a146e56d77ba2a74544c8e5937ab531686fbd22ef0059a358c67e3afcf2404',
  },
  {
    registrationNumber:'30749',
    label:'Make Liberty Win',
    expectedDebtRows:35,
    expectedMappings:35,
    expectedDigest:'dcefb193f2150b43ec0796112f6938daf318b3071ea8cce7bd806f0ee2efa0fa',
  },
  {
    registrationNumber:'40741',
    label:'NFIB Minnesota Political Action Committee',
    expectedDebtRows:28,
    expectedMappings:28,
    expectedDigest:'7448399407817cca4105680b2755c926f248efbc64ee560e5d82fffb501b2138',
  },
  {
    registrationNumber:'30093',
    label:'SEIU Healthcare Minn (fka SEIU Local 113)',
    expectedDebtRows:24,
    expectedMappings:24,
    expectedDigest:'86d3da62cea542b4c19222f1460ad483b67775080bc0e3ae76ac1c31f04be4bd',
  },
  {
    registrationNumber:'41243',
    label:'Conservation Minnesota Voter Project',
    expectedDebtRows:24,
    expectedMappings:24,
    expectedDigest:'a32f6e6b30b7681fbcdf085807061869bb2094e2fa00e2d7d0d1f4b6f8fab7d8',
  },
] as const;

let secrets: string[] = [];

function mask(value: string) {
  if (value.length > 3) {
    console.log(
      '::add-mask::'
      + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'),
    );
  }
}

function safe(error: unknown) {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 2200);
}

async function chooseDb(env: Record<string, string | undefined>) {
  const { Pool } = await import('pg');
  async function works(value: string) {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8_000,
    });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method:'POST',
    headers:{authorization:'Bearer ' + secret},
    signal:AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

type Mapping = {
  rowKey:string;
  registrationNumber:string;
  availableOn:string;
  filedOn:string;
  reportName:string;
  proofUrl:string;
  proofTextSha256:string;
  proofContentSha256:string;
  proofFetchedAt:string;
  proofBytes:number;
};

function mappingLine(row:Mapping):string {
  return [
    row.rowKey,
    row.registrationNumber,
    row.availableOn,
    row.filedOn,
    row.reportName,
    row.proofUrl,
    row.proofTextSha256,
  ].join('|');
}

function mappingDigest(rows:readonly Mapping[]):string {
  const canonical=[...rows]
    .sort((a,b)=>
      a.registrationNumber.localeCompare(b.registrationNumber)
      || a.rowKey.localeCompare(b.rowKey))
    .map(mappingLine)
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

async function remainingDebt(pool:{query:(sql:string,args?:unknown[])=>Promise<{rows:Array<{count:number}>}>},targetRegs:string[]){
  const result=await pool.query(`
    WITH identities AS (
      SELECT
        ei.metadata->>'rowKey' AS row_key,
        bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'subtype'='independent_expenditure_record'
        AND ei.metadata->>'spenderRegistrationNumber'=ANY($1::text[])
        AND ei.metadata->>'year' IN ('2023','2024')
      GROUP BY ei.metadata->>'rowKey'
    )
    SELECT count(*)::int
    FROM identities
    WHERE NOT eligible
  `,[targetRegs]);
  return result.rows[0]?.count ?? -1;
}

async function main(){
  const apply=process.argv.includes('--apply');
  const envFile=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if(!envFile)throw new Error('Production env file required');
  const env=parseRuntimeEnvironment(readFileSync(envFile,'utf8'));
  secrets=Object.entries(env)
    .filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([,value])=>value)
    .filter((value):value is string=>typeof value==='string');
  secrets.forEach(mask);

  process.env.DATABASE_URL=await chooseDb(env);
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;

  const { pool }=await import('../src/lib/db/index.js');
  const { CFB_REPORT_AVAILABILITY_VERSION }=
    await import('../src/evidence/cfb-report-availability.js');
  const {
    discoverCampaignFinanceDownloadUrls,
    fetchCampaignFinanceBulkText,
  }=await import('../src/evidence/campaign-finance-live.js');
  const { parseCfbIndependentExpenditureCsv }=
    await import('../src/evidence/cfb-independent-expenditure-history.js');
  const {
    acquireCfbPcfHistoricalReportProofs,
    cfbPcfSegmentEndYear,
  }=await import('../src/evidence/cfb-pcf-report-history.js');
  const { firstProvenCfbFinanceAvailability }=
    await import('../src/evidence/cfb-report-finance-mapper.js');

  try{
    const targetRegs=TARGETS.map((target)=>target.registrationNumber);

    const existingBatch=await pool.query<{
      rowKey:string;
      registrationNumber:string;
      availableOn:string;
      filedOn:string;
      reportName:string;
      proofUrl:string;
      proofTextSha256:string;
      eligible:boolean;
      publishedAt:string|null;
    }>(`
      SELECT DISTINCT
        ei.metadata->>'rowKey' AS "rowKey",
        ei.metadata->>'spenderRegistrationNumber' AS "registrationNumber",
        ei.metadata->>'availableOn' AS "availableOn",
        ei.metadata->>'filedOn' AS "filedOn",
        ei.metadata->>'reportName' AS "reportName",
        ei.metadata->>'availabilityProofUrl' AS "proofUrl",
        ei.metadata->>'availabilityProofTextSha256' AS "proofTextSha256",
        (ei.metadata->>'asOfEligible'='true') AS eligible,
        ei.published_at::text AS "publishedAt"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'availabilityRepairVersion'=$1
      ORDER BY 2,1
    `,[REPAIR_VERSION]);

    if(existingBatch.rows.length!==0&&existingBatch.rows.length!==EXPECTED_EXACT_MAPPINGS){
      throw new Error(
        'Partial existing IE repair state: '
        +existingBatch.rows.length+'/'+EXPECTED_EXACT_MAPPINGS,
      );
    }

    if(existingBatch.rows.length===EXPECTED_EXACT_MAPPINGS){
      const verifyRows:Mapping[]=existingBatch.rows.map((row)=>({
        rowKey:row.rowKey,
        registrationNumber:row.registrationNumber,
        availableOn:row.availableOn,
        filedOn:row.filedOn,
        reportName:row.reportName,
        proofUrl:row.proofUrl,
        proofTextSha256:row.proofTextSha256,
        proofContentSha256:'',
        proofFetchedAt:'',
        proofBytes:0,
      }));
      const digest=mappingDigest(verifyRows);
      if(digest!==EXPECTED_GLOBAL_MAPPING_DIGEST){
        throw new Error('Existing IE repair mapping digest drifted');
      }
      if(existingBatch.rows.some((row)=>!row.eligible||!row.publishedAt)){
        throw new Error('Existing IE repair rows are not all historically eligible');
      }
      const remaining=await remainingDebt(pool,targetRegs);
      if(remaining!==EXPECTED_REMAINING_DEBT_AFTER){
        throw new Error('Existing IE repair remaining-debt count drifted');
      }

      console.log(JSON.stringify({
        cfbIe2024Next5dExactProofRepair:{
          version:REPAIR_VERSION,
          alreadyApplied:true,
          applied:false,
          exactMappedRowKeys:EXPECTED_EXACT_MAPPINGS,
          mappingDigest:digest,
          remainingTimingDebtRowKeys:remaining,
          contextOnly:true,
          mechanicallyActionable:false,
          modelWeight:0,
          servingChanged:false,
        },
      },null,2));
      return;
    }

    const debt=await pool.query<{rowKey:string;registrationNumber:string}>(`
      WITH identities AS (
        SELECT
          ei.metadata->>'rowKey' AS row_key,
          ei.metadata->>'spenderRegistrationNumber' AS registration_number,
          bool_or(ei.metadata->>'asOfEligible'='true' AND ei.published_at IS NOT NULL) AS eligible
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
          AND ei.metadata->>'subtype'='independent_expenditure_record'
          AND ei.metadata->>'spenderRegistrationNumber'=ANY($1::text[])
          AND ei.metadata->>'year' IN ('2023','2024')
          AND ei.metadata->>'rowKey' IS NOT NULL
        GROUP BY ei.metadata->>'rowKey',ei.metadata->>'spenderRegistrationNumber'
      )
      SELECT row_key AS "rowKey",registration_number AS "registrationNumber"
      FROM identities
      WHERE NOT eligible
      ORDER BY registration_number,row_key
    `,[targetRegs]);

    if(debt.rows.length!==EXPECTED_TIMING_DEBT_ROWS_BEFORE){
      throw new Error(
        'Expected '+EXPECTED_TIMING_DEBT_ROWS_BEFORE
        +' current target timing-debt row keys; found '+debt.rows.length,
      );
    }

    const debtKeys=new Set(debt.rows.map((row)=>row.rowKey));
    const urls=await discoverCampaignFinanceDownloadUrls();
    const text=await fetchCampaignFinanceBulkText(urls.independentExpenditures);
    const liveRows=parseCfbIndependentExpenditureCsv(text,{fromYear:2023,toYear:2024});
    const liveByKey=new Map(liveRows.map((row)=>[row.rowKey,row]));

    if([...debtKeys].some((rowKey)=>!liveByKey.has(rowKey))){
      throw new Error('At least one target timing-debt row key is missing from current official IE bulk');
    }

    const mappings:Mapping[]=[];
    const groups:Array<Record<string,unknown>>=[];

    for(const target of TARGETS){
      const targetDebt=debt.rows.filter(
        (row)=>row.registrationNumber===target.registrationNumber,
      );
      if(targetDebt.length!==target.expectedDebtRows){
        throw new Error(
          'Expected '+target.expectedDebtRows+' current debt rows for '
          +target.registrationNumber+'; found '+targetDebt.length,
        );
      }

      const targetRows=targetDebt
        .map((row)=>liveByKey.get(row.rowKey))
        .filter((row):row is NonNullable<typeof row>=>Boolean(row))
        .filter((row)=>cfbPcfSegmentEndYear(row.year)===SEGMENT_END_YEAR);

      const acquired=await acquireCfbPcfHistoricalReportProofs({
        registrationNumber:target.registrationNumber,
        segmentEndYear:SEGMENT_END_YEAR,
        maxReports:MAX_REPORTS_PER_GROUP,
      });
      if(acquired.failures.length!==0){
        throw new Error(
          'Repair aborted because '+target.registrationNumber
          +' had '+acquired.failures.length+' report proof acquisition failure(s)',
        );
      }

      const reports=acquired.reports.map((report)=>({
        proof:report.proof,
        text:report.text,
      }));

      const groupMappings:Mapping[]=[];
      for(const row of targetRows){
        const match=firstProvenCfbFinanceAvailability({
          registrationNumber:target.registrationNumber,
          transactionDate:row.transactionDate,
          kind:'expenditure',
          amount:row.amount,
          totalAmount:row.totalAmount,
          affectedCommitteeName:row.affectedCommitteeName,
          affectedCommitteeRegistrationNumber:row.affectedCommitteeRegistrationNumber,
        },reports);
        if(!match)continue;

        const acquiredProof=acquired.reports.find((report)=>
          report.proof.textSha256===match.proof.textSha256
          && report.proof.window.proofUrl===match.window.proofUrl);
        if(!acquiredProof){
          throw new Error(
            'Mapped IE row lacked acquired report-body provenance for '
            +target.registrationNumber+'/'+row.rowKey,
          );
        }

        groupMappings.push({
          rowKey:row.rowKey,
          registrationNumber:target.registrationNumber,
          availableOn:match.window.availableOn,
          filedOn:match.proof.filedOn,
          reportName:match.window.reportName,
          proofUrl:match.window.proofUrl,
          proofTextSha256:match.proof.textSha256,
          proofContentSha256:acquiredProof.contentSha256,
          proofFetchedAt:acquiredProof.fetchedAt,
          proofBytes:acquiredProof.bytes,
        });
      }

      if(groupMappings.length!==target.expectedMappings){
        throw new Error(
          'Expected '+target.expectedMappings+' mappings for '
          +target.registrationNumber+'; found '+groupMappings.length,
        );
      }
      const digest=mappingDigest(groupMappings);
      if(digest!==target.expectedDigest){
        throw new Error('Mapping digest drift for registration '+target.registrationNumber);
      }

      mappings.push(...groupMappings);
      groups.push({
        registrationNumber:target.registrationNumber,
        label:target.label,
        sourceDebtRows:targetDebt.length,
        referencesDiscovered:acquired.referencesDiscovered,
        selectedReports:acquired.selectedReports,
        proofsParsed:acquired.reports.length,
        proofFailures:0,
        exactMappings:groupMappings.length,
        mappingDigest:digest,
      });
    }

    if(mappings.length!==EXPECTED_EXACT_MAPPINGS){
      throw new Error(
        'Expected '+EXPECTED_EXACT_MAPPINGS+' exact mappings; found '+mappings.length,
      );
    }
    if(new Set(mappings.map((row)=>row.rowKey)).size!==EXPECTED_EXACT_MAPPINGS){
      throw new Error('Exact mapping set contains duplicate row keys');
    }
    const globalDigest=mappingDigest(mappings);
    if(globalDigest!==EXPECTED_GLOBAL_MAPPING_DIGEST){
      throw new Error('Global exact mapping digest drifted');
    }

    if(!apply){
      console.log(JSON.stringify({
        cfbIe2024Next5dExactProofRepair:{
          version:REPAIR_VERSION,
          alreadyApplied:false,
          applied:false,
          safeToApply:true,
          targetGroups:groups,
          targetTimingDebtRowKeys:debt.rows.length,
          exactMappedRowKeys:mappings.length,
          failClosedTargetRowKeys:debt.rows.length-mappings.length,
          mappingDigest:globalDigest,
          contextOnly:true,
          mechanicallyActionable:false,
          modelWeight:0,
          servingChanged:false,
          productionAction:'none',
        },
      },null,2));
      return;
    }

    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const updatedKeys=new Set<string>();

      for(let offset=0;offset<mappings.length;offset+=250){
        const batch=mappings.slice(offset,offset+250).map((mapping)=>({
          row_key:mapping.rowKey,
          available_on:mapping.availableOn,
          filed_on:mapping.filedOn,
          report_name:mapping.reportName,
          proof_url:mapping.proofUrl,
          proof_text_sha256:mapping.proofTextSha256,
          proof_content_sha256:mapping.proofContentSha256,
          proof_fetched_at:mapping.proofFetchedAt,
          proof_bytes:mapping.proofBytes,
        }));

        const updated=await client.query<{rowKey:string}>(`
          WITH disclosure AS (
            SELECT *
            FROM jsonb_to_recordset($1::jsonb) AS d(
              row_key text,
              available_on date,
              filed_on date,
              report_name text,
              proof_url text,
              proof_text_sha256 text,
              proof_content_sha256 text,
              proof_fetched_at timestamptz,
              proof_bytes integer
            )
          )
          UPDATE evidence_items ei
          SET
            published_at=(disclosure.available_on::text || 'T12:00:00Z')::timestamptz,
            metadata=ei.metadata || jsonb_strip_nulls(jsonb_build_object(
              'asOfEligible',true,
              'availabilityStatus','regulatory_disclosure_date_proven',
              'availabilityPolicyVersion',$2::text,
              'availableOn',disclosure.available_on::text,
              'filedOn',disclosure.filed_on::text,
              'reportName',disclosure.report_name,
              'availabilityProofKind','cfb_report_filing',
              'availabilityProofUrl',disclosure.proof_url,
              'availabilityProofTextSha256',disclosure.proof_text_sha256,
              'availabilityProofContentSha256',disclosure.proof_content_sha256,
              'availabilityProofFetchedAt',disclosure.proof_fetched_at::text,
              'availabilityProofBytes',disclosure.proof_bytes,
              'availabilityRepairVersion',$3::text,
              'disclosureDateIsAvailability',false,
              'filingDateDerivedAvailability',true,
              'transactionDateIsAvailability',false,
              'contextOnly',true,
              'mechanicallyActionable',false,
              'modelWeight',0
            ))
          FROM source_documents sd,disclosure
          WHERE sd.id=ei.source_document_id
            AND sd.source_kind='campaign_finance_independent_expenditure_bulk'
            AND ei.metadata->>'rowKey'=disclosure.row_key
            AND (ei.metadata->>'asOfEligible' IS DISTINCT FROM 'true' OR ei.published_at IS NULL)
          RETURNING ei.metadata->>'rowKey' AS "rowKey"
        `,[
          JSON.stringify(batch),
          CFB_REPORT_AVAILABILITY_VERSION,
          REPAIR_VERSION,
        ]);

        for(const row of updated.rows)updatedKeys.add(row.rowKey);
      }

      if(updatedKeys.size!==EXPECTED_EXACT_MAPPINGS){
        throw new Error(
          'Expected to update '+EXPECTED_EXACT_MAPPINGS
          +' distinct mapped row keys; updated '+updatedKeys.size,
        );
      }

      const remaining=await remainingDebt(client,targetRegs);
      if(remaining!==EXPECTED_REMAINING_DEBT_AFTER){
        throw new Error(
          'Expected '+EXPECTED_REMAINING_DEBT_AFTER
          +' target timing-debt row keys after repair; found '+remaining,
        );
      }

      await client.query('COMMIT');
    }catch(error){
      await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    }finally{
      client.release();
    }

    const verification=await pool.query<{
      rowKey:string;
      registrationNumber:string;
      availableOn:string;
      filedOn:string;
      reportName:string;
      proofUrl:string;
      proofTextSha256:string;
    }>(`
      SELECT DISTINCT
        ei.metadata->>'rowKey' AS "rowKey",
        ei.metadata->>'spenderRegistrationNumber' AS "registrationNumber",
        ei.metadata->>'availableOn' AS "availableOn",
        ei.metadata->>'filedOn' AS "filedOn",
        ei.metadata->>'reportName' AS "reportName",
        ei.metadata->>'availabilityProofUrl' AS "proofUrl",
        ei.metadata->>'availabilityProofTextSha256' AS "proofTextSha256"
      FROM evidence_items ei
      JOIN source_documents sd ON sd.id=ei.source_document_id
      WHERE sd.source_kind='campaign_finance_independent_expenditure_bulk'
        AND ei.metadata->>'availabilityRepairVersion'=$1
        AND ei.metadata->>'asOfEligible'='true'
        AND ei.published_at IS NOT NULL
      ORDER BY 2,1
    `,[REPAIR_VERSION]);

    const verificationMappings:Mapping[]=verification.rows.map((row)=>({
      ...row,
      proofContentSha256:'',
      proofFetchedAt:'',
      proofBytes:0,
    }));
    if(verificationMappings.length!==EXPECTED_EXACT_MAPPINGS){
      throw new Error('Post-apply repair row count verification failed');
    }
    const verificationDigest=mappingDigest(verificationMappings);
    if(verificationDigest!==EXPECTED_GLOBAL_MAPPING_DIGEST){
      throw new Error('Post-apply repair mapping digest verification failed');
    }

    console.log(JSON.stringify({
      cfbIe2024Next5dExactProofRepair:{
        version:REPAIR_VERSION,
        alreadyApplied:false,
        applied:true,
        updatedDistinctRowKeys:EXPECTED_EXACT_MAPPINGS,
        mappingDigest:verificationDigest,
        remainingTimingDebtRowKeys:await remainingDebt(pool,targetRegs),
        contextOnly:true,
        mechanicallyActionable:false,
        modelWeight:0,
        servingChanged:false,
      },
    },null,2));
  }finally{
    await pool.end().catch(()=>undefined);
  }
}

main().catch((error)=>{
  console.error(safe(error));
  process.exitCode=1;
});
