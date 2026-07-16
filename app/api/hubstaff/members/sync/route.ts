import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { fetchHubstaffMembers } from '@/lib/hubstaff';

export async function POST() {
  try {
    const members = await fetchHubstaffMembers();
    const importedAt = new Date();
    const documents = members.map((member) => ({
      raw: member,
      importedAt,
    }));

    const db = await getDb();
    const collection = db.collection('hubstaff_members');
    await collection.deleteMany({});

    if (documents.length) {
      await collection.insertMany(documents);
    }

    await db.collection('sync_runs').insertOne({
      source: 'Hubstaff Members',
      type: 'hubstaff-members',
      count: documents.length,
      importedAt,
    });

    return NextResponse.json({ ok: true, imported: documents.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync Hubstaff members',
      },
      { status: 500 },
    );
  }
}
