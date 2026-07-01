-- audios table
CREATE TABLE audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  reward_coins DECIMAL(10,2) NOT NULL CHECK (reward_coins > 0),
  category VARCHAR(50),
  language VARCHAR(20) DEFAULT 'ur',
  is_active BOOLEAN DEFAULT true,
  play_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- audio_sessions table
CREATE TABLE audio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  audio_id UUID REFERENCES audios(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  progress_percent DECIMAL(5,2) DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  reward_granted BOOLEAN DEFAULT false,
  ip_address INET,
  device_fingerprint TEXT,
  status VARCHAR(50) DEFAULT 'started',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- audio_heartbeats
CREATE TABLE audio_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES audio_sessions(id) ON DELETE CASCADE,
  progress_percent DECIMAL(5,2) NOT NULL,
  client_timestamp BIGINT NOT NULL,
  server_timestamp TIMESTAMPTZ DEFAULT now(),
  is_valid BOOLEAN DEFAULT true
);

-- RLS
ALTER TABLE audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_heartbeats ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "audios_public_read" ON audios
  FOR SELECT USING (is_active = true);

CREATE POLICY "audios_admin_all" ON audios
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));

CREATE POLICY "sessions_own_all" ON audio_sessions
  FOR ALL USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Storage bucket (run in Supabase dashboard)
-- Bucket: audio-files (private)