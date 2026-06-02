-- Create pings table for real-time user activity tracking
CREATE TABLE IF NOT EXISTS pings (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  current_page TEXT,
  last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS pings_session_id_idx ON pings(session_id);
CREATE INDEX IF NOT EXISTS pings_last_ping_idx ON pings(last_ping DESC);

-- Allow anonymous inserts
DROP POLICY IF EXISTS "Allow anonymous inserts to pings" ON pings;
CREATE POLICY "Allow anonymous inserts to pings" ON pings
FOR INSERT TO anon
WITH CHECK (true);

-- Allow authenticated selects
DROP POLICY IF EXISTS "Allow anonymous select from pings" ON pings;
CREATE POLICY "Allow anonymous select from pings" ON pings
FOR SELECT TO anon
USING (true);

-- Enable RLS
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;

-- Clean up old pings (keep only last 100 per session)
-- This can be run periodically as a maintenance task
/*
DELETE FROM pings 
WHERE id NOT IN (
  SELECT id FROM pings p1 
  WHERE p1.session_id = pings.session_id 
  ORDER BY p1.last_ping DESC 
  LIMIT 100
);
*/

-- Add columns to submissions table for current_page tracking
-- Note: These are optional, the pings table handles the main tracking

-- Add current_page column to submissions if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'current_page'
  ) THEN
    ALTER TABLE submissions ADD COLUMN current_page TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'last_ping'
  ) THEN
    ALTER TABLE submissions ADD COLUMN last_ping TIMESTAMPTZ;
  END IF;
END $$;