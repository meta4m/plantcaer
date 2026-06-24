import { NextResponse } from 'next/server';
import { hashPin } from '@/lib/pin-auth';
import { createAdminClient } from '@/lib/supabase-admin';

/** Helper: extract and verify user ID from Authorization header */
async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7); // Remove 'Bearer '
  if (!token) return null;

  try {
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.getUser(token);
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * HEAD handler — check if a PIN has been configured (no auth required).
 */
export async function HEAD() {
  try {
    if (process.env.APP_PIN) {
      return NextResponse.json({ available: true }, { status: 200 });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from('household_settings')
      .select('pin_hash')
      .not('pin_hash', 'is', null)
      .limit(1)
      .maybeSingle();

    if (data?.pin_hash) {
      return NextResponse.json({ available: true }, { status: 200 });
    }

    return NextResponse.json({ available: false }, { status: 404 });
  } catch {
    return NextResponse.json({ available: false }, { status: 404 });
  }
}

/**
 * GET handler — check PIN configuration status.
 * Requires Authorization: Bearer <token> header.
 */
export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from('household_settings')
      .select('id, pin_hash, display_name, household_user_id')
      .maybeSingle();

    const configured = !!data?.pin_hash || !!process.env.APP_PIN;

    return NextResponse.json({
      configured,
      displayName: data?.display_name || 'My Household',
      isHouseholdUser: data?.household_user_id === userId,
    });
  } catch (err) {
    console.error('GET /auth/pin/setup error:', err);
    return NextResponse.json({ configured: false }, { status: 200 });
  }
}

/**
 * DELETE handler — remove the household PIN.
 * Requires Authorization: Bearer <token> header.
 */
export async function DELETE(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('household_settings')
      .select('id')
      .maybeSingle();

    if (existing) {
      await admin
        .from('household_settings')
        .update({
          pin_hash: null,
          pin_salt: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /auth/pin/setup error:', err);
    return NextResponse.json({ error: 'Failed to remove PIN' }, { status: 500 });
  }
}

/**
 * POST handler — set or update the household PIN.
 * Requires Authorization: Bearer <token> header.
 */
export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { pin, displayName } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    if (pin.length < 4 || pin.length > 10) {
      return NextResponse.json(
        { error: 'PIN must be between 4 and 10 digits' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must contain only digits' }, { status: 400 });
    }

    // Hash the PIN
    const { hash, salt } = await hashPin(pin);

    // Use admin client for DB operations (bypasses RLS)
    const admin = createAdminClient();

    // Check if settings row already exists
    const { data: existing } = await admin
      .from('household_settings')
      .select('id')
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await admin
        .from('household_settings')
        .update({
          pin_hash: hash,
          pin_salt: salt,
          household_user_id: userId,
          display_name: displayName || 'My Household',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update PIN in DB:', updateError);
        return NextResponse.json({ error: 'Database error: ' + updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await admin
        .from('household_settings')
        .insert({
          pin_hash: hash,
          pin_salt: salt,
          household_user_id: userId,
          display_name: displayName || 'My Household',
        });

      if (insertError) {
        console.error('Failed to insert PIN in DB:', insertError);
        return NextResponse.json({ error: 'Database error: ' + insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /auth/pin/setup error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to set PIN' },
      { status: 500 }
    );
  }
}
