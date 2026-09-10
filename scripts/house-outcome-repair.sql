WITH input AS (
 SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,identifier text,date date,yea_count int,nay_count int,passed boolean,"sourceUrl" text,"contentSha256" text,"resultText" text,"extractionVersion" text)
), valid AS (
 SELECT i.*,c.jurisdiction_id,ve.session_id,ve.chamber_id FROM input i
 JOIN vote_events ve ON ve.id=i.id AND ve.occurred_on=i.date AND ve.yea_count=i.yea_count AND ve.nay_count=i.nay_count
 JOIN bills b ON b.id=ve.bill_id AND b.identifier=i.identifier
 JOIN chambers c ON c.id=ve.chamber_id AND c.slug='house'
 WHERE ve.passed IS NULL AND ve.is_passage AND i.passed IS NOT NULL
 AND i."sourceUrl" LIKE 'https://www.house.mn.gov/cco/journals/%'
 AND i."contentSha256" ~ '^[a-f0-9]{64}$'
), documents AS (
 INSERT INTO source_documents(jurisdiction_id,session_id,chamber_id,source_kind,source_url,content_sha256,http_status,metadata)
 SELECT DISTINCT jurisdiction_id,session_id,chamber_id,'house_journal',"sourceUrl","contentSha256",200,
 jsonb_build_object('purpose','explicit passage outcome recovery','extractionVersion','house-journal-outcome-v1') FROM valid
 ON CONFLICT(source_url,content_sha256) DO UPDATE SET metadata=source_documents.metadata || EXCLUDED.metadata
 RETURNING id,source_url,content_sha256
)
UPDATE vote_events ve SET passed=v.passed,
 metadata=ve.metadata || jsonb_build_object('officialOutcome',jsonb_build_object(
 'sourceDocumentId',d.id,'sourceUrl',v."sourceUrl",'contentSha256',v."contentSha256",
 'resultText',v."resultText",'extractionVersion',v."extractionVersion",'recoveredAt',now()))
FROM valid v JOIN documents d ON d.source_url=v."sourceUrl" AND d.content_sha256=v."contentSha256"
WHERE ve.id=v.id AND ve.passed IS NULL
