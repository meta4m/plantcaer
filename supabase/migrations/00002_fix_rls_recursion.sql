-- Plantcaer: Fix circular RLS dependencies
-- 
-- The original policies had a circular dependency:
--   1. plants policy queries plant_shares 
--   2. plant_shares policy queries plants
-- This caused "infinite recursion detected in policy for relation 'plants'"
--
-- Fix: Create SECURITY DEFINER helper functions that bypass RLS for subqueries,
--       breaking the recursion cycle.

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

-- Check if a plant is shared with a specific user (bypasses RLS to avoid cycles)
CREATE OR REPLACE FUNCTION public.is_plant_shared_with_user(plant_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plant_shares
    WHERE plant_shares.plant_id = $1
      AND plant_shares.shared_with = $2
  );
$$;

-- Check if a plant is shared with a specific user with at least 'contribute' permission
CREATE OR REPLACE FUNCTION public.can_user_contribute_to_plant(plant_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plant_shares
    WHERE plant_shares.plant_id = $1
      AND plant_shares.shared_with = $2
      AND plant_shares.permission IN ('view', 'contribute')
  );
$$;

-- Check if a user owns a plant (also used by child table policies to avoid cycles)
CREATE OR REPLACE FUNCTION public.is_plant_owned_by_user(plant_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plants
    WHERE plants.id = $1
      AND plants.owner_id = $2
  );
$$;

-- ============================================================
-- FIX PLANTS POLICIES
-- ============================================================

-- Drop and recreate the shared user policy using the helper function
DROP POLICY IF EXISTS "Shared users can read plants" ON public.plants;

CREATE POLICY "Shared users can read plants"
  ON public.plants FOR SELECT
  USING (public.is_plant_shared_with_user(id, auth.uid()));

-- ============================================================
-- FIX PLANT PHOTOS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner can CRUD photos" ON public.plant_photos;
DROP POLICY IF EXISTS "Shared users can read photos" ON public.plant_photos;

CREATE POLICY "Owner can CRUD photos"
  ON public.plant_photos FOR ALL
  USING (public.is_plant_owned_by_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can read photos"
  ON public.plant_photos FOR SELECT
  USING (public.is_plant_shared_with_user(plant_id, auth.uid()));

-- ============================================================
-- FIX CARE TASKS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner can CRUD care tasks" ON public.care_tasks;
DROP POLICY IF EXISTS "Shared users can read care tasks" ON public.care_tasks;

CREATE POLICY "Owner can CRUD care tasks"
  ON public.care_tasks FOR ALL
  USING (public.is_plant_owned_by_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can read care tasks"
  ON public.care_tasks FOR SELECT
  USING (public.is_plant_shared_with_user(plant_id, auth.uid()));

-- ============================================================
-- FIX CARE LOGS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner and contributors can log care" ON public.care_logs;
DROP POLICY IF EXISTS "Owner and shared users can read care logs" ON public.care_logs;

CREATE POLICY "Owner and contributors can log care"
  ON public.care_logs FOR INSERT
  WITH CHECK (
    auth.uid() = logged_by
    AND (
      public.is_plant_owned_by_user(plant_id, auth.uid())
      OR
      public.can_user_contribute_to_plant(plant_id, auth.uid())
    )
  );

CREATE POLICY "Owner and shared users can read care logs"
  ON public.care_logs FOR SELECT
  USING (
    public.is_plant_owned_by_user(plant_id, auth.uid())
    OR
    public.is_plant_shared_with_user(plant_id, auth.uid())
  );

-- ============================================================
-- FIX GROWTH RECORDS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner can CRUD growth records" ON public.growth_records;
DROP POLICY IF EXISTS "Shared users can read growth records" ON public.growth_records;

CREATE POLICY "Owner can CRUD growth records"
  ON public.growth_records FOR ALL
  USING (public.is_plant_owned_by_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can read growth records"
  ON public.growth_records FOR SELECT
  USING (public.is_plant_shared_with_user(plant_id, auth.uid()));

-- ============================================================
-- FIX JOURNAL ENTRIES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner can CRUD journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Shared users can read journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Shared users can insert journal entries" ON public.journal_entries;

CREATE POLICY "Owner can CRUD journal entries"
  ON public.journal_entries FOR ALL
  USING (public.is_plant_owned_by_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can read journal entries"
  ON public.journal_entries FOR SELECT
  USING (public.is_plant_shared_with_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can insert journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_user_contribute_to_plant(plant_id, auth.uid())
  );

-- ============================================================
-- FIX PLANT SHARES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Owner can manage shares" ON public.plant_shares;
DROP POLICY IF EXISTS "Shared users can see shares" ON public.plant_shares;

CREATE POLICY "Owner can manage shares"
  ON public.plant_shares FOR ALL
  USING (public.is_plant_owned_by_user(plant_id, auth.uid()));

CREATE POLICY "Shared users can see shares"
  ON public.plant_shares FOR SELECT
  USING (shared_with = auth.uid());
