import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function minutesToHoursText(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return `${hours}:${String(remainder).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = String(url.searchParams.get('from') || '').slice(0, 10);
  const to = String(url.searchParams.get('to') || '').slice(0, 10);
  const db = await getDb();
  const query: Record<string, unknown> = {
    resolvedAt: { $ne: null },
  };

  if (from) {
    query.rangeFrom = from;
  }
  if (to) {
    query.rangeTo = to;
  }

  const rows = await db.collection('aht_review_states').find(query).sort({ resolvedAt: -1, expertName: 1 }).toArray();
  const headers = [
    'Expert',
    'Personal Email',
    'Expert Email',
    'Status',
    'Issue Type',
    'Range From',
    'Range To',
    'Hours To Remove',
    'Minutes To Remove',
    'Total Remove Minutes',
    'Total Remove HH:MM',
    'Resolution',
    'Resolved At',
  ];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.expertName,
        row.personalEmail,
        row.expertEmail,
        row.status,
        row.reason === 'no-tasks' ? 'High priority no tasks' : 'AHT exception',
        row.rangeFrom,
        row.rangeTo,
        row.hoursToRemove || 0,
        row.minutesToRemove || 0,
        row.removalMinutes || 0,
        minutesToHoursText(Number(row.removalMinutes || 0)),
        row.resolutionText,
        row.resolvedAt ? new Date(row.resolvedAt).toISOString() : '',
      ]
        .map(csvCell)
        .join(','),
    ),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aht-hours-to-remove-${from || 'all'}-to-${to || 'all'}.csv"`,
    },
  });
}
