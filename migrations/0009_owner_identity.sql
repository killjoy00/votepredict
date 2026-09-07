CREATE TABLE IF NOT EXISTS votepredict_owner_identity (
  singleton boolean PRIMARY KEY DEFAULT true,
  user_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votepredict_owner_identity_singleton_check CHECK (singleton)
);
