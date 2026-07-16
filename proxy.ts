import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const protectedPrefixes = ['/dashboard', '/import', '/settings', '/api/hubstaff', '/api/master-sheet', '/api/settings'];
const authTokenName = 'mist_auth_token';
const tokenSecret = new TextEncoder().encode(process.env.JWT_SECRET || 'development-only-secret');

async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get(authTokenName)?.value;

  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, tokenSecret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request);

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/import/:path*', '/settings/:path*', '/api/hubstaff/:path*', '/api/master-sheet/:path*', '/api/settings/:path*'],
};
