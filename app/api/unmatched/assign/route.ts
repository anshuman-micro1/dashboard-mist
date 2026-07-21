import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { getHubstaffIdentityKey } from '@/lib/dashboard';
import { getDb } from '@/lib/mongodb';

function redirectToUnmatched(params: Record<string, string>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: `/unmatched${query ? `?${query}` : ''}`,
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const hubstaffName = String(formData.get('hubstaffName') || '').trim();
  const hubstaffEmail = String(formData.get('hubstaffEmail') || '').trim();
  const expertId = String(formData.get('expertId') || '').trim();
  const from = String(formData.get('from') || '');
  const to = String(formData.get('to') || '');

  if (!hubstaffName && !hubstaffEmail) {
    return redirectToUnmatched({ from, to, error: 'Cannot assign a blank Hubstaff identity.' });
  }

  if (!ObjectId.isValid(expertId)) {
    return redirectToUnmatched({ from, to, error: 'Choose a valid expert before assigning.' });
  }

  const db = await getDb();
  const expert = await db.collection('experts').findOne({ _id: new ObjectId(expertId) });

  if (!expert) {
    return redirectToUnmatched({ from, to, error: 'Selected expert was not found.' });
  }

  const identityKey = getHubstaffIdentityKey(hubstaffName, hubstaffEmail);
  const assignedAt = new Date();

  await db.collection('hubstaff_assignments').updateOne(
    { identityKey },
    {
      $set: {
        identityKey,
        hubstaffName,
        hubstaffEmail,
        expertId: new ObjectId(expertId),
        expertName: String(expert.name || ''),
        expertEmail: String(expert.expertEmail || expert.personalEmail || ''),
        assignedAt,
      },
      $setOnInsert: {
        createdAt: assignedAt,
      },
    },
    { upsert: true },
  );

  return redirectToUnmatched({ from, to, assigned: '1' });
}
