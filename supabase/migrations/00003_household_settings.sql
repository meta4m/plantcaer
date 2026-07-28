-- Plantcaer: Household Settings for PIN-based shared access
-- Stores the hashed family PIN and the household user reference.
-- When a PIN is set, any user entering it operates as the household user (shared data).

CREATE TABLE household_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash text,
  pin_salt text,
  household_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT 'My Household',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE household_settings ENABLE ROW LEVEL SECURITY;

-- Only allow the household user to view/update settings
CREATE POLICY "Household user can manage settings"
  ON household_settings FOR ALL
  USING (auth.uid() = household_user_id);

-- Allow service role to read for PIN verification
-- (The PIN verify endpoint uses the service role key to check the hash)
