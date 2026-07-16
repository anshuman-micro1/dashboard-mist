import crypto from 'crypto';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

export const AUTH_COOKIE_NAME = 'mist_auth_token';

export type SessionUser = {
  email: string;
  name: string;
  role: 'admin';
};

const tokenSecret = new TextEncoder().encode(process.env.JWT_SECRET || 'development-only-secret');

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

function safeEqual(expected: string, actual: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function validateAdminCredentials(email: string, password: string) {
  const expectedEmail = process.env.AUTH_EMAIL || '';
  const expectedPassword = process.env.AUTH_PASSWORD || '';

  return safeEqual(expectedEmail, email) && safeEqual(expectedPassword, password);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(tokenSecret);
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify<SessionUser>(token, tokenSecret);
  return result.payload;
}

export async function getSessionUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token);
    return {
      email: payload.email,
      name: payload.name,
      role: payload.role,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}
