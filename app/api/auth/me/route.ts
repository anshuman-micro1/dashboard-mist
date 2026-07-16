import { NextResponse } from 'next/server';
import { getSessionUserFromCookies } from '@/lib/auth';

export async function GET() {
  const session = await getSessionUserFromCookies();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}
