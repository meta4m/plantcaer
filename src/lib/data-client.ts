/**
 * PIN-aware Supabase data client for server components.
 *
 * In PIN mode, the regular supabase-server client has no Supabase auth session,
 * so RLS blocks all queries. This helper returns the admin client (service role)
 * when a valid PIN cookie is present, bypassing RLS while still filtering by
 * owner_id in the calling page.
 *
 * In regular Supabase auth mode, it returns the standard server client.
 */

import { createClient as createServerClient } from './supabase-server';
import { createAdminClient } from './supabase-admin';
import { cookies } from 'next/headers';
import { verifyToken } from './pin-auth';

export async function createDataClient() {
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get('plantcaer_pin')?.value;

  if (pinCookie && (await verifyToken(pinCookie))) {
    // PIN mode — use admin client (bypass RLS, queries must filter by owner_id)
    return createAdminClient();
  }

  // Regular Supabase auth mode
  return createServerClient();
}
