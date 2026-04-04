-- Community polls / formal resolutions: site-scoped, auditable vote records per unit or per user.

DO $$ BEGIN
  CREATE TYPE poll_classification AS ENUM ('informal_survey', 'formal_resolution');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


DO $$ BEGIN
  CREATE TYPE poll_category_scope AS ENUM ('apartment', 'parking', 'garden', 'global');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE poll_status AS ENUM ('draft', 'published', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE poll_question_kind AS ENUM ('single_select', 'multi_select');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  classification poll_classification NOT NULL,
  category_scope poll_category_scope NOT NULL,
  status poll_status NOT NULL DEFAULT 'draft',
  attachment_path TEXT,
  attachment_filename TEXT,
  attachment_mime TEXT,
  closes_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 70
    CHECK (threshold_percent >= 0 AND threshold_percent <= 100),
  threshold_question_id UUID,
  approval_option_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  help_text TEXT,
  kind poll_question_kind NOT NULL DEFAULT 'single_select',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_threshold_question_fk;
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_approval_option_fk;

ALTER TABLE polls
  ADD CONSTRAINT polls_threshold_question_fk
    FOREIGN KEY (threshold_question_id) REFERENCES poll_questions(id) ON DELETE SET NULL;

ALTER TABLE polls
  ADD CONSTRAINT polls_approval_option_fk
    FOREIGN KEY (approval_option_id) REFERENCES poll_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_polls_site ON polls(site_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_poll_questions_poll ON poll_questions(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_question ON poll_options(question_id);

CREATE TABLE IF NOT EXISTS poll_question_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE RESTRICT,
  voter_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
  option_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT poll_vote_options_non_empty CHECK (cardinality(option_ids) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_question_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_question ON poll_question_votes(question_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_unit ON poll_question_votes(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poll_votes_voter ON poll_question_votes(voter_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS poll_vote_formal_unit_unique
  ON poll_question_votes(poll_id, question_id, unit_id)
  WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_vote_informal_user_unique
  ON poll_question_votes(poll_id, question_id, voter_user_id)
  WHERE unit_id IS NULL;

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_question_votes ENABLE ROW LEVEL SECURITY;
