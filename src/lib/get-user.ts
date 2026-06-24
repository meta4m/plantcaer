/**
 * Server-side auth helper that handles both PIN mode and Supabase Auth.
 *
 * In hybrid mode, checks the PIN cookie first. If valid, returns the
 * household user (shared family access). Falls back to Supabase Auth.
 *
 * Returns null if not authenticated (caller should redirect to /auth/login).
 */

import { cookies } from 'next/headers';
import { verifyToken, getHouseholdUserId } from '@/lib/pin-auth';

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Get the authenticated user — checks PIN cookie first, then Supabase Auth.
 *
 * In PIN mode: returns the household user (shared family access).
 * In Supabase mode: returns the authenticated user from the session.
 *
 * Returns null if not authenticated (caller should redirect to /auth/login).
 */
export async function getAuthedUser(
  supabase: Awaited<ReturnType<typeof import('./supabase-server').createClient>>
): Promise<AuthedUser | null> {
  // Check PIN cookie first
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get('plantcaer_pin')?.value;
  if (pinCookie && await verifyToken(pinCookie)) {
    const householdId = await getHouseholdUserId();
    if (householdId) {
      return { id: householdId, email: 'household@plantcaer.app' };
    }
  }

  // Fall back to Supabase Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return { id: user.id, email: user.email ?? '' };
}

/**
 * Check if PIN mode is active (PIN entry is available).
 * Unlike the async version in pin-auth.ts, this is a quick env var check
 * for use in server components that need to know immediately.
 */
export function isPinMode(): boolean {
  return !!process.env.APP_PIN;
}
