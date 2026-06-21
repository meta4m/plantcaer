-- Plantcaer: Initial Schema
-- Run this in the Supabase SQL Editor

-- 1. Create custom enum types
CREATE TYPE light_requirement AS ENUM ('direct_sun', 'bright_indirect', 'low_light', 'shade');
CREATE TYPE task_type AS ENUM ('watering', 'fertilizing', 'repotting', 'pruning', 'pest_disease', 'propagation');
CREATE TYPE share_permission AS ENUM ('view', 'contribute');

-- 2. Profiles table (syncs with auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Plants table
CREATE TABLE plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug text NOT NULL,
  common_name text NOT NULL,
  scientific_name text,
  nickname text,
  species text,
  location text,
  adopted_at date,
  light_requirement light_requirement,
  min_temp numeric,
  max_temp numeric,
  humidity_min integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, slug)
);

CREATE INDEX idx_plants_owner_id ON plants(owner_id);

ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

-- 4. Plant photos
CREATE TABLE plant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plant_photos_plant_id ON plant_photos(plant_id);

ALTER TABLE plant_photos ENABLE ROW LEVEL SECURITY;

-- 5. Care tasks (one per plant per task type)
CREATE TABLE care_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  task_type task_type NOT NULL,
  frequency_days integer,
  seasonal_adjustment jsonb DEFAULT '{}'::jsonb,
  amount text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plant_id, task_type)
);

CREATE INDEX idx_care_tasks_plant_id ON care_tasks(plant_id);

ALTER TABLE care_tasks ENABLE ROW LEVEL SECURITY;

-- 6. Care logs (when care was actually performed)
CREATE TABLE care_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  task_id uuid REFERENCES care_tasks(id) ON DELETE SET NULL,
  task_type task_type NOT NULL,
  logged_by uuid NOT NULL REFERENCES profiles(id),
  logged_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_care_logs_plant_id ON care_logs(plant_id);
CREATE INDEX idx_care_logs_task_id ON care_logs(task_id);
CREATE INDEX idx_care_logs_logged_at ON care_logs(logged_at);

ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;

-- 7. Growth tracking records
CREATE TABLE growth_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  height_cm numeric,
  leaf_count integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_growth_records_plant_id ON growth_records(plant_id);

ALTER TABLE growth_records ENABLE ROW LEVEL SECURITY;

-- 8. Journal entries
CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_plant_id ON journal_entries(plant_id);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- 9. Plant sharing (multi-user)
CREATE TABLE plant_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission share_permission NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plant_id, shared_with)
);

CREATE INDEX idx_plant_shares_plant_id ON plant_shares(plant_id);
CREATE INDEX idx_plant_shares_shared_with ON plant_shares(shared_with);

ALTER TABLE plant_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Plants: owner can CRUD; shared users can read
CREATE POLICY "Owner can CRUD own plants"
  ON plants FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Shared users can read plants"
  ON plants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = plants.id
        AND plant_shares.shared_with = auth.uid()
    )
  );

-- Plant photos: owner and shared users can read
CREATE POLICY "Owner can CRUD photos"
  ON plant_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = plant_photos.plant_id
        AND plants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can read photos"
  ON plant_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = plant_photos.plant_id
        AND plant_shares.shared_with = auth.uid()
    )
  );

-- Care tasks: owner can CRUD; shared can read
CREATE POLICY "Owner can CRUD care tasks"
  ON care_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = care_tasks.plant_id
        AND plants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can read care tasks"
  ON care_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = care_tasks.plant_id
        AND plant_shares.shared_with = auth.uid()
    )
  );

-- Care logs: owner and contributors can insert; all can read
CREATE POLICY "Owner and contributors can log care"
  ON care_logs FOR INSERT
  WITH CHECK (
    auth.uid() = logged_by
    AND (
      EXISTS (
        SELECT 1 FROM plants
        WHERE plants.id = care_logs.plant_id
          AND plants.owner_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM plant_shares
        WHERE plant_shares.plant_id = care_logs.plant_id
          AND plant_shares.shared_with = auth.uid()
          AND plant_shares.permission IN ('view', 'contribute')
      )
    )
  );

CREATE POLICY "Owner and shared users can read care logs"
  ON care_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = care_logs.plant_id
        AND (plants.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM plant_shares
            WHERE plant_shares.plant_id = plants.id
              AND plant_shares.shared_with = auth.uid()
          )
        )
    )
  );

-- Growth records: owner can CRUD; shared can read
CREATE POLICY "Owner can CRUD growth records"
  ON growth_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = growth_records.plant_id
        AND plants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can read growth records"
  ON growth_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = growth_records.plant_id
        AND plant_shares.shared_with = auth.uid()
    )
  );

-- Journal entries: owner can CRUD; shared can read and insert
CREATE POLICY "Owner can CRUD journal entries"
  ON journal_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = journal_entries.plant_id
        AND plants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can read journal entries"
  ON journal_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = journal_entries.plant_id
        AND plant_shares.shared_with = auth.uid()
    )
  );

CREATE POLICY "Shared users can insert journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM plant_shares
      WHERE plant_shares.plant_id = journal_entries.plant_id
        AND plant_shares.shared_with = auth.uid()
        AND plant_shares.permission IN ('view', 'contribute')
    )
  );

-- Plant shares: owner can manage; shared users can read
CREATE POLICY "Owner can manage shares"
  ON plant_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plants
      WHERE plants.id = plant_shares.plant_id
        AND plants.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can see shares"
  ON plant_shares FOR SELECT
  USING (shared_with = auth.uid());

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get the next available slug number for a given base name
CREATE OR REPLACE FUNCTION get_next_plant_slug(base_name text, owner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  existing_slugs text[];
  counter integer := 1;
  candidate text;
BEGIN
  SELECT array_agg(plants.slug) INTO existing_slugs
  FROM plants
  WHERE plants.owner_id = get_next_plant_slug.owner_id
    AND plants.slug ~ ('^' || base_name || '-\d+$');

  LOOP
    candidate := base_name || '-' || counter;
    IF NOT (candidate = ANY(existing_slugs)) THEN
      RETURN candidate;
    END IF;
    counter := counter + 1;
  END LOOP;
END;
$$;
