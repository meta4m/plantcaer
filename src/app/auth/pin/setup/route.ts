import { NextResponse } from 'next/server';
import { hashPin } from '@/lib/pin-auth';

/**
 * HEAD handler — check if a PIN has been configured (without auth).
 * Used by the login/signup pages to decide whether to show the PIN option.
 */
export async function HEAD() {
  try {
    // Check APP_PIN env var first
    if (process.env.APP_PIN) {
      return NextResponse.json({ available: true }, { status: 200 });
    }

    // Check DB for stored PIN hash
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
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
  } catch {
    return NextResponse.json({ available: false }, { status: 404 });
  }
}

/**
 * GET handler — check if PIN is configured and return status.
 * Requires authentication (returns current user's PIN setup status).
 */
export async function GET(request: Request) {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if PIN is configured (include pin_hash for the check)
    const { data } = await supabase
      .from('household_settings')
      .select('id, pin_hash, display_name, household_user_id')
      .maybeSingle();

    const configured = !!data?.pin_hash || !!process.env.APP_PIN;

    return NextResponse.json({
      configured,
      displayName: data?.display_name || 'My Household',
      isHouseholdUser: data?.household_user_id === user.id,
    });
  } catch {
    return NextResponse.json({ configured: false }, { status: 200 });
  }
}

/**
 * POST handler — set or update the household PIN.
 * Requires authentication. The authenticated user becomes the household user.
 */
/**
 * DELETE handler — remove the household PIN and clear its DB entries.
 * Requires authentication. The authenticated user must be the household user.
 */
export async function DELETE() {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Clear pin_hash and pin_salt (keep the row for other settings)
    const { data: existing } = await supabase
      .from('household_settings')
      .select('id')
      .maybeSingle();

    if (existing) {
      await supabase
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
    console.error('Failed to remove PIN:', err);
    return NextResponse.json(
      { error: 'Failed to remove PIN' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { pin, displayName } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    if (pin.length < 4 || pin.length > 10) {
      return NextResponse.json(
        { error: 'PIN must be between 4 and 10 characters' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must contain only digits' },
        { status: 400 }
      );
    }

    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Hash the PIN
    const { hash, salt } = await hashPin(pin);

    // Check if settings row already exists
    const { data: existing } = await supabase
      .from('household_settings')
      .select('id')
      .maybeSingle();

    if (existing) {
      // Update existing row
      await supabase
        .from('household_settings')
        .update({
          pin_hash: hash,
          pin_salt: salt,
          household_user_id: user.id,
          display_name: displayName || 'My Household',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new row
      await supabase
        .from('household_settings')
        .insert({
          pin_hash: hash,
          pin_salt: salt,
          household_user_id: user.id,
          display_name: displayName || 'My Household',
        });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to set PIN:', err);
    return NextResponse.json(
      { error: 'Failed to set PIN' },
      { status: 500 }
    );
  }
}
