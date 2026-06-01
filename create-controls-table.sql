-- Create controls table for persistent control storage
CREATE TABLE IF NOT EXISTS controls (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS controls_session_id_idx ON controls(session_id);

-- Allow anonymous inserts
DROP POLICY IF EXISTS "Allow anonymous inserts to controls" ON controls;
CREATE POLICY "Allow anonymous inserts to controls" ON controls
FOR INSERT TO anon
WITH CHECK (true);

-- Allow anonymous selects
DROP POLICY IF EXISTS "Allow anonymous select from controls" ON controls;
CREATE POLICY "Allow anonymous select from controls" ON controls
FOR SELECT TO anon
USING (true);

-- Allow anonymous deletes
DROP POLICY IF EXISTS "Allow anonymous delete from controls" ON controls;
CREATE POLICY "Allow anonymous delete from controls" ON controls
FOR DELETE TO anon
USING (true);

-- Enable RLS
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;