-- Plantcaer: AI Configuration
-- Stores per-user AI provider settings with encrypted API keys.
-- API keys are encrypted with AES-256-GCM server-side before storage.

-- 1. User AI configurations
CREATE TABLE user_ai_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  base_url text,
  encrypted_api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_ai_configs_user_id ON user_ai_configs(user_id);

ALTER TABLE user_ai_configs ENABLE ROW LEVEL SECURITY;

-- RLS: users can only manage their own config
CREATE POLICY "Users can manage own AI config"
  ON user_ai_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
