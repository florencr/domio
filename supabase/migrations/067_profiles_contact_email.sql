-- Add contact_email to profiles (additional email for contact; login email stays in auth.users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_email TEXT;
