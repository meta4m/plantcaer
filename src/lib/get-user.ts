/**
 * Server-side auth helper that handles both PIN mode and Supabase Auth.
 *
 * In PIN mode (APP_PIN is set), returns a "household" user from the
 * database using the service role key (bypasses RLS).
 * In normal mode, returns the authenticated Supabase user.
 *
 * If neither is available, returns null (caller should redirect).
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/pin-auth';

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Get the authenticated user in either PIN mode or Supabase Auth mode.
 *
 * In PIN mode: uses the service role to look up a household user.
 *   - If HOUSEHOLD_USER_ID is set in env, uses that user directly.
 *   - Otherwise, looks up the admin user (first user in profiles).
 *
 * In Supabase mode: returns the authenticated user from the session.
 *
 * Returns null if not authenticated (caller should redirect to /auth/pin or /auth/login).
 */
export async function getAuthedUser(
  supabase: Awaited<ReturnType<typeof import('./supabase-server').createClient>>
): Promise<AuthedUser | null> {
  const isPinMode = !!process.env.APP_PIN;

  if (isPinMode) {
    const cookieStore = await cookies();
    const pinCookie = cookieStore.get('plantcaer_pin')?.value;
    if (!pinCookie || !verifyToken(pinCookie)) return null;

    // PIN is valid — use a household user
    const householdId = process.env.HOUSEHOLD_USER_ID;

    if (householdId) {
      return { id: householdId, email: 'household@plantcaer.app' };
    }

    // Fallback: look up the first user in profiles
    try {
      const { createClient } = await import('./supabase-server');
      const svcSupabase = await createClient();
      const { data: profiles } = await svcSupabase
        .from('profiles')
        .select('id, display_name')
        .limit(1);

      if (profiles && profiles.length > 0) {
        return { id: profiles[0].id, email: profiles[0].display_name || 'household@plantcaer.app' };
      }
    } catch {
      // If all else fails, return null
    }

    return null;
  }

  // Normal Supabase Auth mode
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return { id: user.id, email: user.email ?? '' };
}

/**
 * Check if PIN mode is active.
 */
export function isPinMode(): boolean {
  return !!process.env.APP_PIN;
}
