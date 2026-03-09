-- Add locale column to profiles (for i18n: "en" or "al")
-- Default "en" for existing users

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';
-- Optional: constrain to known values (comment out if you add more languages later)
-- ALTER TABLE profiles ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('en', 'al'));
