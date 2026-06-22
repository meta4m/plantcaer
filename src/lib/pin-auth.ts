'use server';

import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

const COOKIE_NAME = 'plantcaer_pin';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Check whether PIN mode is active.
 * PIN mode is activated by setting the APP_PIN environment variable.
 */
export function isPinMode(): boolean {
  return !!process.env.APP_PIN;
}

/**
 * Validate a PIN against the APP_PIN environment variable.
 */
export function validatePin(pin: string): boolean {
  if (!process.env.APP_PIN) return false;
  return pin === process.env.APP_PIN;
}

/**
 * Generate a cryptographically signed PIN token.
 * The token includes a random nonce to prevent replay within the same cookie.
 */
function generateToken(): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${nonce}`;
  const signature = createHash('sha256')
    .update(`${payload}.${process.env.APP_PIN || 'fallback-secret'}`)
    .digest('hex')
    .slice(0, 16);
  return `${payload}.${signature}`;
}

/**
 * Verify a PIN token and return whether it's valid.
 */
export function verifyToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    const signature = parts[2];
    const expected = createHash('sha256')
      .update(`${payload}.${process.env.APP_PIN || 'fallback-secret'}`)
      .digest('hex')
      .slice(0, 16);
    if (signature !== expected) return false;

    // Check expiry (30 days max)
    const timestamp = parseInt(parts[0], 10);
    const now = Math.floor(Date.now() / 1000);
    return now - timestamp < 30 * 24 * 60 * 60;
  } catch {
    return false;
  }
}

/**
 * Set the PIN cookie on successful authentication.
 * Returns true if the cookie was set.
 */
export async function setPinCookie(): Promise<boolean> {
  if (!isPinMode()) return false;

  const cookieStore = await cookies();
  const token = generateToken();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: false, // Allow client-side detection for navbar sign-out
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
  if (!isPinMode()) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  return verifyToken(token);
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
