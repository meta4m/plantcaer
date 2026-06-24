import { NextResponse } from 'next/server';
import { hashPin } from '@/lib/pin-auth';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';

/**
 * HEAD handler — check if a PIN has been configured (without auth).
 */
export async function HEAD() {
  try {
    if (process.env.APP_PIN) {
      return NextResponse.json({ available: true }, { status: 200 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from('household_settings')
      .select('pin_hash')
      .not('pin_hash', 'is', null)
      .limit(1)
      .maybeSingle();

    if (data?.pin_hash) {
      return NextResponse.json({ available: true }, { status: 200 });
    }

    return NextResponse.json({ available: false }, { status: 404 });
  } catch (err) {
    console.error('HEAD /auth/pin/setup error:', err);
    return NextResponse.json({ available: false }, { status: 404 });
  }
}

/**
 * GET handler — check if PIN is configured and return status.
 * Requires authentication.
 */
export async function GET(request: Request) {
  try {
    // Authenticate — try Authorization header first, fall back to cookies
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const admin = createAdminClient();
      const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    if (!userId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

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
 * Requires authentication.
 */
export async function DELETE(request: Request) {
  try {
    // Authenticate — try Authorization header first, fall back to cookies
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const admin = createAdminClient();
      const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    if (!userId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in again.' },
        { status: 401 }
      );
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
 * Requires authentication. The authenticated user becomes the household user.
 */
export async function POST(request: Request) {
  try {
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

    // Authenticate — try Authorization header first, fall back to cookies
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      // Verify token from Authorization header using admin client
      const admin = createAdminClient();
      const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    if (!userId) {
      // Fallback: try cookie-based auth
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated. Please sign in again.' },
        { status: 401 }
      );
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
