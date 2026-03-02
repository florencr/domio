-- Add generated_at column to bills table if missing
ALTER TABLE bills ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing bills to use created_at as generated_at if they exist
UPDATE bills SET generated_at = created_at WHERE generated_at IS NULL;
