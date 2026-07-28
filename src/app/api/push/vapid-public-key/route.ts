/**
 * GET /api/push/vapid-public-key
 *
 * Returns the VAPID public key for push notification subscription.
 * The client needs this key to create a push subscription.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID public key not configured' },
      { status: 501 },
    );
  }

  return NextResponse.json({ publicKey });
}
