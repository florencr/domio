-- Add period and template support for expenses
-- Templates (Config): template_id is null, period_month/year null - used for definitions
-- Generated recurrent: template_id points to template, period set - one per month
-- Ad-hoc: template_id null, period set - created when recording one-off expense

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_month SMALLINT CHECK (period_month >= 1 AND period_month <= 12);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS period_year SMALLINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES expenses(id) ON DELETE SET NULL;
