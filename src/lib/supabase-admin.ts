/**
 * Supabase Admin Client
 * Uses the service role key to bypass RLS for admin operations
 * like PIN management and user updates.
 */

import { createClient } from '@supabase/supabase-js';

export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
