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

    const appPin = process.env.APP_PIN || 'fallback-secret';
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
  const isPinMode = !!process.env.APP_PIN;

  // Auth pages
  const isAuthPage = pathname.startsWith('/auth');

  // Static files and API routes (except auth API)
  const isStaticFile = pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/);

  if (isStaticFile) return NextResponse.next();

  // PIN mode handling
  if (isPinMode) {
    const hasPin = await verifyPinCookie(request);

    // PIN auth pages
    if (pathname === '/auth/pin') {
      if (hasPin) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      return NextResponse.next();
    }

    // Auth pages (except /auth/pin and its verify endpoint) — redirect to PIN page
    if (isAuthPage && pathname !== '/auth/pin' && pathname !== '/auth/pin/verify') {
      return NextResponse.redirect(new URL('/auth/pin', request.url));
    }

    // Protected routes — require PIN
    if (!hasPin) {
      return NextResponse.redirect(new URL('/auth/pin', request.url));
    }

    // PIN is valid, allow access
    return NextResponse.next();
  }

  // Normal Supabase Auth mode
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

  // Redirect authenticated users away from auth pages
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect unauthenticated users to login
  if (!isAuthPage && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
