import { NextResponse } from 'next/server';
import { validatePin, setPinCookie, clearPinCookie } from '@/lib/pin-auth';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PIN is required' },
        { status: 400 }
      );
    }

    if (!(await validatePin(pin))) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN' },
        { status: 401 }
      );
    }

    // === Create a real Supabase session so ALL pages work ===
    let session: { access_token: string; refresh_token: string } | null = null;

    try {
      const admin = createAdminClient();

      // Get the household user's email
      const { data: settingsData } = await admin
        .from('household_settings')
        .select('household_user_id')
        .not('household_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsData?.household_user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(
          settingsData.household_user_id
        );
        const email = userData?.user?.email ?? null;

        if (email) {
          // Generate a magic link (admin API — does NOT send email, returns token)
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
          });

          const actionLink = linkData?.properties?.action_link;
          if (actionLink) {
            const token = new URL(actionLink).searchParams.get('token');

            if (token) {
              // Verify the OTP using the anon key + plain fetch
              // This creates a session and returns tokens without needing cookies()
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
              const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

              const otpRes = await fetch(
                `${supabaseUrl}/auth/v1/verify`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: anonKey,
                  },
                  body: JSON.stringify({
                    type: 'magiclink',
                    token,
                    email,
                  }),
                }
              );

              if (otpRes.ok) {
                const otpData = await otpRes.json();
                if (otpData.access_token && otpData.refresh_token) {
                  session = {
                    access_token: otpData.access_token,
                    refresh_token: otpData.refresh_token,
                  };
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Session creation error:', err);
      // Fall through — PIN cookie still works for middleware access
    }

    // Set the PIN cookie as backup
    await setPinCookie();

    return NextResponse.json({
      success: true,
      session, // client will call supabase.auth.setSession() with this
    });
  } catch (err) {
    console.error('PIN verify error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearPinCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
