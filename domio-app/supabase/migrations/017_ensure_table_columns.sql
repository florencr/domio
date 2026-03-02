-- Ensure all required columns exist for the new table views

-- Check and add title to expenses if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='expenses' AND column_name='title') THEN
        ALTER TABLE expenses ADD COLUMN title TEXT;
    END IF;
END $$;

-- Check and add paid_at to expenses if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='expenses' AND column_name='paid_at') THEN
        ALTER TABLE expenses ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- Check and add paid_by to expenses if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='expenses' AND column_name='paid_by') THEN
        ALTER TABLE expenses ADD COLUMN paid_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Check and add created_at to bills if missing (use as date column)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bills' AND column_name='created_at') THEN
        ALTER TABLE bills ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;
