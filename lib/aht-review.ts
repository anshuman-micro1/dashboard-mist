import { getDb } from '@/lib/mongodb';
import { normalizeSearch } from '@/lib/parsers';

export type AhtReviewReason = 'aht' | 'no-tasks';

export type AhtReviewState = {
  expertKey: string;
  reason: AhtReviewReason;
  weekStart: string;
  contactedAt: string | null;
  resolvedAt: string | null;
  resolutionText: string;
  removalMinutes: number;
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getCurrentReviewWeekStart() {
  const today = new Date();
  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setDate(today.getDate() - daysSinceMonday);

  return formatDateInputValue(weekStart);
}

export function getAhtReviewExpertKey({
  personalEmail,
  expertEmail,
  name,
}: {
  personalEmail: string;
  expertEmail: string;
  name: string;
}) {
  const identity = expertEmail || personalEmail || name;
  return normalizeSearch(identity).replace(/[^a-z0-9@.]+/g, '');
}

export function getAhtReviewStateKey(expertKey: string, reason: AhtReviewReason) {
  return `${reason}:${expertKey}`;
}

export async function getAhtReviewStates(expertKeys: string[], weekStart = getCurrentReviewWeekStart()) {
  if (!expertKeys.length) {
    return new Map<string, AhtReviewState>();
  }

  const db = await getDb();
  const documents = await db
    .collection('aht_review_states')
    .find({
      weekStart,
      expertKey: { $in: [...new Set(expertKeys)] },
    })
    .toArray();

  return new Map(
    documents.map((document) => [
      getAhtReviewStateKey(String(document.expertKey || ''), document.reason === 'no-tasks' ? 'no-tasks' : 'aht'),
      {
        expertKey: String(document.expertKey || ''),
        reason: document.reason === 'no-tasks' ? 'no-tasks' : 'aht',
        weekStart: String(document.weekStart || weekStart),
        contactedAt: document.contactedAt ? new Date(document.contactedAt).toISOString() : null,
        resolvedAt: document.resolvedAt ? new Date(document.resolvedAt).toISOString() : null,
        resolutionText: String(document.resolutionText || ''),
        removalMinutes: Number(document.removalMinutes || 0),
      } satisfies AhtReviewState,
    ]),
  );
}
