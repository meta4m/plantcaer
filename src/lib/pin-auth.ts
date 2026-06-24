'use server';

import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from './supabase-admin';

const COOKIE_NAME = 'plantcaer_pin';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Check whether PIN access is available — via APP_PIN env var OR DB-stored hash.
 */
export async function isPinMode(): Promise<boolean> {
  if (!!process.env.APP_PIN) return true;
  // Check DB for stored PIN hash
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('household_settings')
      .select('pin_hash')
      .not('pin_hash', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return !!data?.pin_hash;
  } catch {
    return false;
  }
}

/**
 * Validate a PIN against APP_PIN env var OR DB-stored hash.
 */
export async function validatePin(pin: string): Promise<boolean> {
  // Check APP_PIN env var first (legacy mode)
  if (process.env.APP_PIN) {
    return pin === process.env.APP_PIN;
  }

  // Check DB-stored hash
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('household_settings')
      .select('pin_hash, pin_salt')
      .not('pin_hash', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.pin_hash) return false;

    const hash = createHash('sha256')
      .update(pin + (data.pin_salt || ''))
      .digest('hex');

    return hash === data.pin_hash;
  } catch {
    return false;
  }
}

/**
 * Get the household user ID for PIN mode.
 * Priority: HOUSEHOLD_USER_ID env var > household_settings > first profile
 */
export async function getHouseholdUserId(): Promise<string | null> {
  // Check env var first
  if (process.env.HOUSEHOLD_USER_ID) {
    return process.env.HOUSEHOLD_USER_ID;
  }

  // Check DB
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('household_settings')
      .select('household_user_id')
      .not('household_user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.household_user_id) {
      return data.household_user_id;
    }
  } catch {
    // Fall through
  }

  // Fallback: first profile
  try {
    const { createClient } = await import('./supabase-server');
    const supabase = await createClient();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profiles && profiles.length > 0) {
      return profiles[0].id;
    }
  } catch {
    // No profiles yet
  }

  return null;
}

/**
 * Get the hashing secret for cookie signing.
 * Uses the PIN itself or a fallback so cookies created via APP_PIN or DB PIN both work.
 */
function getPinSecret(): string {
  return process.env.APP_PIN || process.env.HOUSEHOLD_USER_ID || 'plantcaer-hybrid-secret';
}

/**
 * Generate a cryptographically signed PIN token.
 */
function generateToken(): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${nonce}`;
  const signature = createHash('sha256')
    .update(`${payload}.${getPinSecret()}`)
    .digest('hex')
    .slice(0, 16);
  return `${payload}.${signature}`;
}

/**
 * Verify a PIN token.
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    const signature = parts[2];
    const expected = createHash('sha256')
      .update(`${payload}.${getPinSecret()}`)
      .digest('hex')
      .slice(0, 16);
    if (signature !== expected) return false;

    // Check expiry (7 days max)
    const timestamp = parseInt(parts[0], 10);
    const now = Math.floor(Date.now() / 1000);
    return now - timestamp < 7 * 24 * 60 * 60;
  } catch {
    return false;
  }
}

/**
 * Set the PIN cookie on successful authentication.
 */
export async function setPinCookie(): Promise<boolean> {
  if (!await isPinMode()) return false;

  const cookieStore = await cookies();
  const token = generateToken();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return true;
}

/**
 * Check if the current request has a valid PIN cookie.
 */
export async function hasValidPinCookie(): Promise<boolean> {
  if (!await isPinMode()) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  return await verifyToken(token);
}

/**
 * Clear the PIN cookie (logout from PIN mode).
 */
export async function clearPinCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

/**
 * Hash a PIN with a salt for DB storage.
 */
export async function hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const pinSalt = salt || randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(pin + pinSalt)
    .digest('hex');
  return { hash, salt: pinSalt };
}
