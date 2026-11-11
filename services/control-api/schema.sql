CREATE TABLE IF NOT EXISTS documents (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scripts (
  id text PRIMARY KEY,
  version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE SEQUENCE IF NOT EXISTS script_case_number_seq;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS case_number bigint;
ALTER TABLE scripts ALTER COLUMN case_number SET DEFAULT nextval('script_case_number_seq');
UPDATE scripts SET case_number=nextval('script_case_number_seq') WHERE case_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scripts_case_number_unique ON scripts(case_number);
ALTER TABLE scripts ALTER COLUMN case_number SET NOT NULL;
CREATE TABLE IF NOT EXISTS script_versions (
  script_id text NOT NULL REFERENCES scripts(id),
  version integer NOT NULL,
  body jsonb NOT NULL,
  source_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(script_id,version)
);
CREATE SEQUENCE IF NOT EXISTS script_test_case_number_seq;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS test_case_number bigint;
CREATE UNIQUE INDEX IF NOT EXISTS scripts_test_case_number_unique ON scripts(test_case_number);
WITH pending AS (
 SELECT s.id, row_number() OVER (ORDER BY s.case_number,s.id)
  + COALESCE((SELECT max(test_case_number) FROM scripts),0) AS number
 FROM scripts s JOIN script_versions v ON v.script_id=s.id AND v.version=s.version
 WHERE s.deleted_at IS NULL AND s.test_case_number IS NULL
  AND COALESCE(v.body->>'caseType','test') <> 'flow'
)
UPDATE scripts s SET test_case_number=p.number FROM pending p WHERE s.id=p.id;
DO $$
DECLARE assigned bigint;
BEGIN
 SELECT max(test_case_number) INTO assigned FROM scripts;
 IF assigned IS NOT NULL THEN
  PERFORM setval('script_test_case_number_seq',GREATEST(assigned,(SELECT last_value FROM script_test_case_number_seq)),true);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  test_version text NOT NULL UNIQUE,
  script_id text NOT NULL,
  script_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','passed','failed','skipped','cancelled')),
  message text NOT NULL DEFAULT '',
  completed integer NOT NULL DEFAULT 0,
  cancel_requested boolean NOT NULL DEFAULT false,
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  FOREIGN KEY(script_id,script_version) REFERENCES script_versions(script_id,version)
);
CREATE INDEX IF NOT EXISTS runs_queue ON runs(created_at) WHERE status='queued';
CREATE TABLE IF NOT EXISTS run_events (
  run_id uuid NOT NULL REFERENCES runs(id),
  sequence integer NOT NULL,
  event jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,sequence)
);
CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS llm_jobs (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK(provider IN ('codex','claude','gemini')),
  prompt text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','passed','failed')),
  result jsonb,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_status (
  name text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active_script ON runs(script_id) WHERE status IN ('queued','running');
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  test_version text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_test_version_key;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS batch_position integer;
CREATE INDEX IF NOT EXISTS runs_batch_order ON runs(batch_id,batch_position);
CREATE TABLE IF NOT EXISTS source_imports (
  id uuid PRIMARY KEY,
  body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS llm_connection_checks (
  connection_id text PRIMARY KEY,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK(status IN ('checking','passed','failed')),
  message text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz
);
CREATE TABLE IF NOT EXISTS api_analysis_jobs (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 project_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 body jsonb NOT NULL,
 cancel_requested boolean NOT NULL DEFAULT false,
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS api_analysis_one_active_project ON api_analysis_jobs(project_id) WHERE status IN ('queued','running');

CREATE TABLE IF NOT EXISTS request_catalogs (
 id uuid PRIMARY KEY,
 project_id text NOT NULL,
 snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
 version integer NOT NULL,
 body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,version), UNIQUE(project_id,snapshot_id)
);
CREATE TABLE IF NOT EXISTS api_cases (
 id uuid PRIMARY KEY, project_id text NOT NULL, version integer NOT NULL, body jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS api_case_versions (
 case_id uuid NOT NULL REFERENCES api_cases(id), version integer NOT NULL, body jsonb NOT NULL,
 PRIMARY KEY(case_id,version)
);
CREATE TABLE IF NOT EXISTS api_request_runs (
 id uuid PRIMARY KEY, request_id uuid NOT NULL UNIQUE, project_id text NOT NULL,
 catalog_id uuid NOT NULL REFERENCES request_catalogs(id), request_key text NOT NULL,
 status text NOT NULL, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS api_schemas (
 environment_id text NOT NULL, project_id text NOT NULL, hash text NOT NULL,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(environment_id,project_id,hash)
);
CREATE TABLE IF NOT EXISTS api_catalog_revisions (
 catalog_id uuid NOT NULL REFERENCES request_catalogs(id), revision integer NOT NULL, body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(catalog_id,revision)
);
ALTER TABLE request_catalogs DROP CONSTRAINT IF EXISTS request_catalogs_project_id_snapshot_id_key;
CREATE INDEX IF NOT EXISTS request_catalog_snapshot ON request_catalogs(project_id,snapshot_id);
CREATE TABLE IF NOT EXISTS api_environment_settings (
 project_id text NOT NULL, id text NOT NULL, body jsonb NOT NULL, PRIMARY KEY(project_id,id)
);
CREATE TABLE IF NOT EXISTS api_environment_secrets (
 project_id text NOT NULL, environment_id text NOT NULL, body text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,environment_id)
);

CREATE TABLE IF NOT EXISTS api_workflow_jobs (
 id uuid PRIMARY KEY, project_id text NOT NULL, status text NOT NULL,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_workflow_project ON api_workflow_jobs(project_id,created_at DESC);

CREATE INDEX IF NOT EXISTS api_request_run_case ON api_request_runs(project_id,(body->>'caseId'),created_at DESC);

CREATE TABLE IF NOT EXISTS api_case_responses (
 case_id uuid PRIMARY KEY REFERENCES api_cases(id), project_id text NOT NULL,
 run_id uuid NOT NULL REFERENCES api_request_runs(id), body jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE llm_connection_checks ADD COLUMN IF NOT EXISTS reported_model text;

ALTER TABLE runs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE api_workflow_jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS android_profiles (
 id uuid PRIMARY KEY, owner text NOT NULL, name text NOT NULL,
 avd text NOT NULL UNIQUE, state text NOT NULL CHECK(state IN ('new','ready')),
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS android_runs (id uuid PRIMARY KEY, request_id uuid NOT NULL UNIQUE, body jsonb NOT NULL);

CREATE TABLE IF NOT EXISTS android_agent_tasks (
 id uuid PRIMARY KEY, owner text NOT NULL, script_id text NOT NULL, thread_id text NOT NULL,
 revision integer NOT NULL, body jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner,script_id,thread_id)
);
CREATE TABLE IF NOT EXISTS android_agent_observations (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES android_agent_tasks(id) ON DELETE CASCADE,
 label text NOT NULL, xml text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE TABLE IF NOT EXISTS android_agent_inbox (
 task_id uuid NOT NULL REFERENCES android_agent_tasks(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,question text NOT NULL,
 sequence bigserial NOT NULL,consumed_at timestamptz,
 PRIMARY KEY(task_id,request_id)
);
CREATE INDEX IF NOT EXISTS android_agent_inbox_pending ON android_agent_inbox(task_id,sequence) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS android_agent_observation_task ON android_agent_observations(task_id,created_at DESC);
ALTER TABLE llm_jobs ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE llm_jobs ADD COLUMN IF NOT EXISTS agent_meta jsonb;
