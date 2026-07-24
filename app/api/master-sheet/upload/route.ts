import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { parseMasterSheet } from '@/lib/master-sheet';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Master sheet file is required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const experts = parseMasterSheet(buffer, file.name);

    if (!experts.length) {
      return NextResponse.json(
        { error: 'No expert rows were found. Check that the file includes Name, Personal Email, or Expert Email columns.' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const expertsByKey = new Map(experts.map((expert) => [expert.expertKey, expert]));
    const uniqueExperts = [...expertsByKey.values()];
    const expertKeys = uniqueExperts.map((expert) => expert.expertKey);

    await db.collection('experts').bulkWrite(
      uniqueExperts.map((expert) => ({
        updateOne: {
          filter: { expertKey: expert.expertKey },
          update: {
            $set: expert,
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    );
    await db.collection('experts').deleteMany({ expertKey: { $nin: expertKeys } });

    await db.collection('sync_runs').insertOne({
      source: 'Master Sheet',
      type: 'master-sheet',
      count: uniqueExperts.length,
      importedAt: new Date(),
    });

    return NextResponse.json({ ok: true, imported: uniqueExperts.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload master sheet',
      },
      { status: 500 },
    );
  }
}
