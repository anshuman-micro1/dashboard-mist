import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME, createSessionToken, getAuthCookieOptions, validateAdminCredentials } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid login payload' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  if (!validateAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken({
    email,
    name: email.split('@')[0] || 'Admin',
    role: 'admin',
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return response;
}
