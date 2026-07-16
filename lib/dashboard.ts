import { getDb } from '@/lib/mongodb';
import { formatMinutes, normalizeSearch } from '@/lib/parsers';

export type DashboardRow = {
  name: string;
  personalEmail: string;
  expertEmail: string;
  totalTasks: number;
  removedFromOnboardingChannel: boolean;
  status: string;
  elapsedMinutes: number;
  activityAverage: number;
  breakMinutes: number;
  manualMinutes: number;
  activeDays: number;
  latestDate: string;
  lastUpdatedAt: string;
};

export type DashboardSnapshot = {
  range: { from: string; to: string };
  summary: {
    totalElapsedMinutes: number;
    totalExperts: number;
    expertsWithTime: number;
    unmatchedMinutes: number;
    averageActivity: number;
  };
  chartData: Array<{ date: string; minutes: number }>;
  rows: DashboardRow[];
  latestSync: {
    source: string;
    importedAt: string;
    count: number;
  } | null;
};

function toKey(value: string) {
  return normalizeSearch(value || '').replace(/[^a-z0-9]+/g, '');
}

function formatIsoDate(value: Date | string) {
  return new Date(value).toISOString();
}

function getPersonNameParts(value: string) {
  const parts = normalizeSearch(value)
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]+/g, ''))
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return {
    firstInitial: parts[0].slice(0, 1),
    lastName: parts[parts.length - 1],
  };
}

function namesLikelyMatch(left: string, right: string) {
  const leftKey = toKey(left);
  const rightKey = toKey(right);

  if (!leftKey || !rightKey) {
    return false;
  }

  if (leftKey === rightKey) {
    return true;
  }

  const leftParts = getPersonNameParts(left);
  const rightParts = getPersonNameParts(right);

  return Boolean(
    leftParts &&
      rightParts &&
      leftParts.firstInitial === rightParts.firstInitial &&
      leftParts.lastName === rightParts.lastName,
  );
}

function entryMatchesExpert(entry: Record<string, unknown>, expert: Record<string, unknown>) {
  const entryEmail = toKey(String(entry.email || ''));
  const expertEmails = [expert.personalEmail, expert.expertEmail].map((value) => toKey(String(value || ''))).filter(Boolean);

  if (entryEmail && expertEmails.includes(entryEmail)) {
    return true;
  }

  return namesLikelyMatch(String(entry.name || ''), String(expert.name || ''));
}

export async function getDashboardSnapshot(params: { from: string; to: string; query?: string }) {
  const db = await getDb();
  const experts = await db.collection('experts').find({}).sort({ name: 1 }).toArray();
  const entries = await db
    .collection('hubstaff_entries')
    .find({
      date: {
        $gte: params.from.slice(0, 10),
        $lte: params.to.slice(0, 10),
      },
    })
    .toArray();

  const matchedEntries = entries.filter((entry) => experts.some((expert) => entryMatchesExpert(entry, expert)));
  const unmatchedEntries = entries.filter((entry) => !experts.some((expert) => entryMatchesExpert(entry, expert)));

  const search = normalizeSearch(params.query || '');
  const rows = experts.map((expert) => {
    const expertName = String(expert.name || '');
    const personalEmail = String(expert.personalEmail || '');
    const expertEmail = String(expert.expertEmail || '');

    const matched = matchedEntries.filter((entry) => entryMatchesExpert(entry, expert));

    const elapsedMinutes = matched.reduce((sum, entry) => sum + Number(entry.elapsedMinutes || 0), 0);
    const breakMinutes = matched.reduce((sum, entry) => sum + Number(entry.breakMinutes || 0), 0);
    const manualMinutes = matched.reduce((sum, entry) => sum + Number(entry.manualMinutes || 0), 0);
    const averageActivity = elapsedMinutes
      ? matched.reduce((sum, entry) => sum + Number(entry.activity || 0) * Number(entry.elapsedMinutes || 0), 0) / elapsedMinutes
      : 0;
    const latestDate = matched.length
      ? matched.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), '')
      : '';
    const lastUpdatedAt = matched.length
      ? formatIsoDate(matched.reduce((latest, entry) => {
          const importedAt = new Date(entry.importedAt || 0);
          return importedAt > latest ? importedAt : latest;
        }, new Date(0)))
      : '';

    return {
      name: expertName,
      personalEmail,
      expertEmail,
      totalTasks: Number(expert.totalTasks || 0),
      removedFromOnboardingChannel: Boolean(expert.removedFromOnboardingChannel),
      status: String(expert.status || 'Unknown'),
      elapsedMinutes,
      activityAverage: Number(averageActivity.toFixed(1)),
      breakMinutes,
      manualMinutes,
      activeDays: new Set(matched.map((entry) => entry.date)).size,
      latestDate,
      lastUpdatedAt,
    } satisfies DashboardRow;
  });

  const filteredRows = search
    ? rows.filter((row) =>
        [row.name, row.personalEmail, row.expertEmail, row.status].some((value) => normalizeSearch(value).includes(search)),
      )
    : rows;

  const chartMap = new Map<string, number>();
  for (const entry of entries) {
    chartMap.set(entry.date, (chartMap.get(entry.date) || 0) + Number(entry.elapsedMinutes || 0));
  }

  const chartData = [...chartMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, minutes]) => ({ date, minutes }));

  const latestSyncDoc = await db.collection('sync_runs').findOne({}, { sort: { importedAt: -1 } });

  const summary = filteredRows.reduce(
    (accumulator, row) => {
      accumulator.totalElapsedMinutes += row.elapsedMinutes;
      if (row.activityAverage > 0) {
        accumulator.averageActivity += row.activityAverage;
        accumulator.expertsWithActivity += 1;
      }
      if (row.elapsedMinutes > 0) {
        accumulator.expertsWithTime += 1;
      }
      return accumulator;
    },
    {
      totalElapsedMinutes: 0,
      totalExperts: filteredRows.length,
      expertsWithTime: 0,
      expertsWithActivity: 0,
      unmatchedMinutes: unmatchedEntries.reduce((sum, entry) => sum + Number(entry.elapsedMinutes || 0), 0),
      averageActivity: 0,
    },
  );

  if (summary.expertsWithActivity) {
    summary.averageActivity = Number((summary.averageActivity / summary.expertsWithActivity).toFixed(1));
  }

  return {
    range: { from: params.from, to: params.to },
    summary,
    chartData,
    rows: filteredRows.sort((left, right) => right.elapsedMinutes - left.elapsedMinutes),
    latestSync: latestSyncDoc
      ? {
          source: String(latestSyncDoc.source || 'Hubstaff'),
          importedAt: formatIsoDate(latestSyncDoc.importedAt || new Date()),
          count: Number(latestSyncDoc.count || 0),
        }
      : null,
  } satisfies DashboardSnapshot;
}

export function minutesToDisplay(minutes: number) {
  return formatMinutes(minutes);
}
