-- Check existing policies first
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'submissions';

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow anonymous inserts" ON submissions;
DROP POLICY IF EXISTS "Allow anonymous reads" ON submissions;

-- Recreate with full permissions for anonymous access
CREATE POLICY "Allow anonymous inserts" ON submissions
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous reads" ON submissions
FOR SELECT TO anon
WITH CHECK (true);