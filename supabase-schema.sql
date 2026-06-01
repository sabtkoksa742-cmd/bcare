-- =============================================
-- Supabase Database Setup for BCare Project
-- =============================================
-- Run this SQL in Supabase SQL Editor to create the submissions table

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  data JSONB,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_submissions_session_id ON submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(type);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policy to allow anonymous inserts (for the form submissions)
CREATE POLICY "Allow anonymous inserts" ON submissions
  FOR INSERT TO anon WITH CHECK (true);

-- Policy to allow authenticated users to read (for admin dashboard)
CREATE POLICY "Allow authenticated reads" ON submissions
  FOR SELECT TO authenticated USING (true);

-- Policy to allow authenticated updates/deletes
CREATE POLICY "Allow authenticated modifications" ON submissions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated deletions" ON submissions
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- Optional: Create a function to automatically 
-- update timestamps
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Optional: Enable real-time subscriptions
-- =============================================
-- Note: You'll need to create a publication for real-time
-- ALTER PUBLICATION supabase_realtime ADD TABLE submissions;