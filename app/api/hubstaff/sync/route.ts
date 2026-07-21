import { NextResponse } from 'next/server';
import { defaultDateRange } from '@/lib/date-range';
import { getDb } from '@/lib/mongodb';
import { fetchHubstaffDailyCsv, parseHubstaffCsv } from '@/lib/hubstaff';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const defaults = defaultDateRange();
    const from = String(body?.from || defaults.start);
    const to = String(body?.to || defaults.end);

    const csv = await fetchHubstaffDailyCsv(from, to);
    const entries = parseHubstaffCsv(csv);

    const db = await getDb();
    const entriesCollection = db.collection('hubstaff_entries');
    await entriesCollection.deleteMany({
      date: {
        $gte: from.slice(0, 10),
        $lte: to.slice(0, 10),
      },
    });

    if (entries.length) {
      await entriesCollection.insertMany(entries);
    }

    await db.collection('sync_runs').insertOne({
      source: 'Hubstaff',
      type: 'hubstaff',
      from,
      to,
      count: entries.length,
      importedAt: new Date(),
    });

    return NextResponse.json({ ok: true, imported: entries.length, from, to });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync Hubstaff data',
      },
      { status: 500 },
    );
  }
}
