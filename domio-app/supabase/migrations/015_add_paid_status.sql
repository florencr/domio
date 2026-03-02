-- Add paid status tracking to bills and expenses
-- Run in Supabase SQL Editor

-- Bills: add paid_at timestamp (NULL = unpaid)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Expenses: add paid_at timestamp (NULL = unpaid)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
