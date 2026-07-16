import { NextResponse } from 'next/server';
import {
  clearCredentialsCache,
  getStoredHubstaffCredentials,
  publicHubstaffCredentials,
  sanitizeHubstaffCredentials,
  saveHubstaffCredentials,
} from '@/lib/hubstaff-credentials';

export async function GET() {
  try {
    const credentials = await getStoredHubstaffCredentials();
    return NextResponse.json(publicHubstaffCredentials(credentials));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load settings',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const credentials = sanitizeHubstaffCredentials(body);
    const saved = await saveHubstaffCredentials(credentials);

    clearCredentialsCache();
    return NextResponse.json({ ok: true, credentials: publicHubstaffCredentials(saved), updatedAt: saved.updatedAt });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save settings',
      },
      { status: 500 },
    );
  }
}
