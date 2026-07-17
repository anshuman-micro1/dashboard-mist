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

    await db.collection('experts').deleteMany({});
    if (experts.length) {
      await db.collection('experts').insertMany(experts);
    }

    await db.collection('sync_runs').insertOne({
      source: 'Master Sheet',
      type: 'master-sheet',
      count: experts.length,
      importedAt: new Date(),
    });

    return NextResponse.json({ ok: true, imported: experts.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload master sheet',
      },
      { status: 500 },
    );
  }
}
