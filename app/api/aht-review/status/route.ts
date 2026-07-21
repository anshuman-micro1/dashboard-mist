import { NextResponse } from 'next/server';
import { getCurrentReviewWeekStart, type AhtReviewReason } from '@/lib/aht-review';
import { getDb } from '@/lib/mongodb';

function asReason(value: unknown): AhtReviewReason {
  return value === 'no-tasks' ? 'no-tasks' : 'aht';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      expertKey?: string;
      expertName?: string;
      personalEmail?: string;
      expertEmail?: string;
      status?: string;
      reason?: string;
      rangeFrom?: string;
      rangeTo?: string;
      resolutionText?: string;
      hoursToRemove?: number;
      minutesToRemove?: number;
    };
    const expertKey = String(body.expertKey || '').trim();
    const action = body.action === 'resolve' ? 'resolve' : 'contact';
    const reason = asReason(body.reason);
    const resolutionText = String(body.resolutionText || '').trim();
    const hoursToRemove = Number(body.hoursToRemove || 0);
    const minutesToRemove = Number(body.minutesToRemove || 0);
    const removalMinutes = Math.round(hoursToRemove * 60 + minutesToRemove);

    if (!expertKey) {
      return NextResponse.json({ error: 'Expert key is required.' }, { status: 400 });
    }
    if (action === 'resolve' && !resolutionText) {
      return NextResponse.json({ error: 'Resolution text is required.' }, { status: 400 });
    }
    if (!Number.isFinite(removalMinutes) || removalMinutes < 0) {
      return NextResponse.json({ error: 'Hours and minutes to remove must be valid non-negative numbers.' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const weekStart = getCurrentReviewWeekStart();
    const update =
      action === 'resolve'
        ? {
            $set: {
              expertName: String(body.expertName || ''),
              personalEmail: String(body.personalEmail || ''),
              expertEmail: String(body.expertEmail || ''),
              status: String(body.status || ''),
              rangeFrom: String(body.rangeFrom || ''),
              rangeTo: String(body.rangeTo || ''),
              contactedAt: now,
              resolvedAt: now,
              resolutionText,
              hoursToRemove,
              minutesToRemove,
              removalMinutes,
              updatedAt: now,
            },
            $setOnInsert: {
              expertKey,
              reason,
              weekStart,
              createdAt: now,
            },
          }
        : {
            $set: {
              expertName: String(body.expertName || ''),
              personalEmail: String(body.personalEmail || ''),
              expertEmail: String(body.expertEmail || ''),
              status: String(body.status || ''),
              rangeFrom: String(body.rangeFrom || ''),
              rangeTo: String(body.rangeTo || ''),
              contactedAt: now,
              updatedAt: now,
            },
            $setOnInsert: {
              expertKey,
              reason,
              weekStart,
              createdAt: now,
              resolvedAt: null,
              resolutionText: '',
            },
          };

    await db.collection('aht_review_states').updateOne({ expertKey, reason, weekStart }, update, { upsert: true });

    return NextResponse.json({ ok: true, action, contactedAt: now.toISOString(), resolvedAt: action === 'resolve' ? now.toISOString() : null });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update AHT review status.',
      },
      { status: 500 },
    );
  }
}
