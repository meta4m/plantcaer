import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Helper to verify PIN cookie using Web Crypto API (Edge Runtime compatible)
async function verifyPinCookie(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('plantcaer_pin')?.value;
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}.${parts[1]}`;
    const signature = parts[2];

    // Use the same secret logic as pin-auth.ts
    const appPin = process.env.APP_PIN || process.env.HOUSEHOLD_USER_ID || 'plantcaer-hybrid-secret';
    const data = new TextEncoder().encode(`${payload}.${appPin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expected = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    if (signature !== expected) return false;

    const timestamp = parseInt(parts[0], 10);
    const now = Math.floor(Date.now() / 1000);
    return now - timestamp < 7 * 24 * 60 * 60;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth pages
  const isAuthPage = pathname.startsWith('/auth');

  // Static files and API routes (except auth API)
  const isStaticFile = pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/);

  if (isStaticFile) return NextResponse.next();

  // Check for PIN cookie
  const hasPin = await verifyPinCookie(request);

  // Check for Supabase session
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const hasSession = !!user;

  // Determine if authenticated via either method
  const isAuthenticated = hasPin || hasSession;

  // === HYBRID AUTH LOGIC ===

  // Auth pages (login, signup, pin, pin/verify)
  if (isAuthPage) {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated) {
      // Don't redirect away from pin/verify since it needs to process the request
      if (pathname === '/auth/pin/verify') {
        return response;
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Allow access to auth pages
    return response;
  }

  // Protected routes — require either PIN or Supabase session
  if (!isAuthenticated) {
    // Redirect to login page with redirect_to for post-auth navigation
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect_to', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
