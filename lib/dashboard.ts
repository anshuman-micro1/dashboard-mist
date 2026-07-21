import { getDb } from '@/lib/mongodb';
import { formatMinutes, normalizeSearch } from '@/lib/parsers';

export type DashboardSortKey = 'elapsed' | 'name' | 'tasks' | 'aht' | 'activity' | 'days' | 'latestDate' | 'status';
export type DashboardSortDirection = 'asc' | 'desc';
export type DashboardTimeFilter = 'all' | 'with-time' | 'without-time';
export type DashboardAhtFilter = 'all' | 'over' | 'under';

export type DashboardDayBreakdown = {
  date: string;
  elapsedMinutes: number;
  activityAverage: number;
  breakMinutes: number;
  manualMinutes: number;
  entries: number;
};

export type DashboardRow = {
  name: string;
  personalEmail: string;
  expertEmail: string;
  totalTasks: number;
  removedFromOnboardingChannel: boolean;
  inProduction: boolean;
  status: string;
  elapsedMinutes: number;
  activityAverage: number;
  breakMinutes: number;
  manualMinutes: number;
  activeDays: number;
  ahtHours: number | null;
  latestDate: string;
  lastUpdatedAt: string;
  dayBreakdown: DashboardDayBreakdown[];
};

export type DashboardSnapshot = {
  range: { from: string; to: string };
  filters: {
    query: string;
    status: string;
    time: DashboardTimeFilter;
    aht: DashboardAhtFilter;
    ahtTargetHours: number;
    sort: DashboardSortKey;
    direction: DashboardSortDirection;
  };
  summary: {
    totalElapsedMinutes: number;
    totalExperts: number;
    expertsWithTime: number;
    expertsInProduction: number;
    productionAhtHours: number | null;
    unmatchedMinutes: number;
    averageActivity: number;
  };
  chartData: Array<{ date: string; minutes: number }>;
  rows: DashboardRow[];
  unmatchedRows: Array<{
    name: string;
    email: string;
    elapsedMinutes: number;
    activityAverage: number;
    entries: number;
    dayBreakdown: DashboardDayBreakdown[];
    latestDate: string;
  }>;
  statuses: string[];
  latestSync: {
    source: string;
    importedAt: string;
    count: number;
  } | null;
};

export type UnmatchedLedgerSnapshot = {
  range: { from: string; to: string };
  unmatchedRows: DashboardSnapshot['unmatchedRows'];
  experts: Array<{
    id: string;
    name: string;
    personalEmail: string;
    expertEmail: string;
    status: string;
  }>;
};

export type DashboardSnapshotParams = {
  from: string;
  to: string;
  query?: string;
  status?: string;
  time?: string;
  aht?: string;
  ahtTargetHours?: number;
  sort?: string;
  direction?: string;
};

function toKey(value: string) {
  return normalizeSearch(value || '').replace(/[^a-z0-9]+/g, '');
}

export function getHubstaffIdentityKey(name: string, email = '') {
  return `${toKey(name)}:${toKey(email)}`;
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

function entryMatchesAssignment(entry: Record<string, unknown>, expert: Record<string, unknown>, assignments: Map<string, string>) {
  const assignedExpertId = assignments.get(getHubstaffIdentityKey(String(entry.name || ''), String(entry.email || '')));
  return Boolean(assignedExpertId && assignedExpertId === String(expert._id || ''));
}

function entryMatchesExpert(entry: Record<string, unknown>, expert: Record<string, unknown>, assignments = new Map<string, string>()) {
  if (entryMatchesAssignment(entry, expert, assignments)) {
    return true;
  }

  const entryEmail = toKey(String(entry.email || ''));
  const expertEmails = [expert.personalEmail, expert.expertEmail].map((value) => toKey(String(value || ''))).filter(Boolean);

  if (entryEmail && expertEmails.includes(entryEmail)) {
    return true;
  }

  return namesLikelyMatch(String(entry.name || ''), String(expert.name || ''));
}

function asTimeFilter(value: string | undefined): DashboardTimeFilter {
  return value === 'with-time' || value === 'without-time' ? value : 'all';
}

function asAhtFilter(value: string | undefined): DashboardAhtFilter {
  return value === 'over' || value === 'under' ? value : 'all';
}

function asSortKey(value: string | undefined): DashboardSortKey {
  const sortKeys: DashboardSortKey[] = ['elapsed', 'name', 'tasks', 'aht', 'activity', 'days', 'latestDate', 'status'];
  return sortKeys.includes(value as DashboardSortKey) ? (value as DashboardSortKey) : 'elapsed';
}

function asSortDirection(value: string | undefined): DashboardSortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function getEntryDate(entry: Record<string, unknown>) {
  return String(entry.date || '');
}

function buildDayBreakdown(entries: Record<string, unknown>[]): DashboardDayBreakdown[] {
  const days = new Map<string, { elapsedMinutes: number; weightedActivity: number; breakMinutes: number; manualMinutes: number; entries: number }>();

  for (const entry of entries) {
    const date = getEntryDate(entry);
    if (!date) {
      continue;
    }

    const elapsedMinutes = Number(entry.elapsedMinutes || 0);
    const existing = days.get(date) || {
      elapsedMinutes: 0,
      weightedActivity: 0,
      breakMinutes: 0,
      manualMinutes: 0,
      entries: 0,
    };

    existing.elapsedMinutes += elapsedMinutes;
    existing.weightedActivity += Number(entry.activity || 0) * elapsedMinutes;
    existing.breakMinutes += Number(entry.breakMinutes || 0);
    existing.manualMinutes += Number(entry.manualMinutes || 0);
    existing.entries += 1;
    days.set(date, existing);
  }

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      elapsedMinutes: value.elapsedMinutes,
      activityAverage: value.elapsedMinutes ? Number((value.weightedActivity / value.elapsedMinutes).toFixed(1)) : 0,
      breakMinutes: value.breakMinutes,
      manualMinutes: value.manualMinutes,
      entries: value.entries,
    }));
}

function buildUnmatchedRows(entries: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const entry of entries) {
    const name = String(entry.name || '');
    const email = String(entry.email || '');
    const key = `${toKey(name)}:${toKey(email)}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }

  return [...groups.values()]
    .map((group) => {
      const dayBreakdown = buildDayBreakdown(group);
      const elapsedMinutes = group.reduce((sum, entry) => sum + Number(entry.elapsedMinutes || 0), 0);
      const activityAverage = elapsedMinutes
        ? group.reduce((sum, entry) => sum + Number(entry.activity || 0) * Number(entry.elapsedMinutes || 0), 0) / elapsedMinutes
        : 0;

      return {
        name: String(group[0]?.name || ''),
        email: String(group[0]?.email || ''),
        elapsedMinutes,
        activityAverage: Number(activityAverage.toFixed(1)),
        entries: group.length,
        dayBreakdown,
        latestDate: dayBreakdown.length ? dayBreakdown[dayBreakdown.length - 1].date : '',
      };
    })
    .sort((left, right) => right.elapsedMinutes - left.elapsedMinutes);
}

async function getHubstaffAssignments() {
  const db = await getDb();
  const documents = await db.collection('hubstaff_assignments').find({}).toArray();

  return new Map(
    documents.map((document) => [
      getHubstaffIdentityKey(String(document.hubstaffName || ''), String(document.hubstaffEmail || '')),
      String(document.expertId || ''),
    ]),
  );
}

async function getDashboardSourceData(from: string, to: string) {
  const db = await getDb();
  const experts = await db.collection('experts').find({}).sort({ name: 1 }).toArray();
  const entries = await db
    .collection('hubstaff_entries')
    .find({
      date: {
        $gte: from.slice(0, 10),
        $lte: to.slice(0, 10),
      },
    })
    .toArray();
  const assignments = await getHubstaffAssignments();

  return { db, experts, entries, assignments };
}

function getSortValue(row: DashboardRow, sort: DashboardSortKey) {
  if (sort === 'name') {
    return row.name.toLowerCase();
  }
  if (sort === 'tasks') {
    return row.totalTasks;
  }
  if (sort === 'aht') {
    return row.ahtHours ?? -1;
  }
  if (sort === 'activity') {
    return row.activityAverage;
  }
  if (sort === 'days') {
    return row.activeDays;
  }
  if (sort === 'latestDate') {
    return row.latestDate;
  }
  if (sort === 'status') {
    return row.status.toLowerCase();
  }
  return row.elapsedMinutes;
}

function sortRows(rows: DashboardRow[], sort: DashboardSortKey, direction: DashboardSortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sort);
    const rightValue = getSortValue(right, sort);

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return String(leftValue).localeCompare(String(rightValue)) * multiplier;
    }

    return (Number(leftValue) - Number(rightValue)) * multiplier;
  });
}

function isActiveStatus(status: string) {
  return normalizeSearch(status) === 'active';
}

export async function getDashboardSnapshot(params: DashboardSnapshotParams) {
  const { db, experts, entries, assignments } = await getDashboardSourceData(params.from, params.to);

  const matchedEntries = entries.filter((entry) => experts.some((expert) => entryMatchesExpert(entry, expert, assignments)));
  const unmatchedEntries = entries.filter((entry) => !experts.some((expert) => entryMatchesExpert(entry, expert, assignments)));

  const search = normalizeSearch(params.query || '');
  const statusFilter = params.status || 'all';
  const timeFilter = asTimeFilter(params.time);
  const ahtFilter = asAhtFilter(params.aht);
  const ahtTargetHours = Number.isFinite(params.ahtTargetHours) && Number(params.ahtTargetHours) > 0 ? Number(params.ahtTargetHours) : 3;
  const sort = asSortKey(params.sort);
  const direction = asSortDirection(params.direction);
  const statuses = [...new Set(experts.map((expert) => String(expert.status || 'Unknown')).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

  const rows = experts.map((expert) => {
    const expertName = String(expert.name || '');
    const personalEmail = String(expert.personalEmail || '');
    const expertEmail = String(expert.expertEmail || '');

    const matched = matchedEntries.filter((entry) => entryMatchesExpert(entry, expert, assignments));

    const elapsedMinutes = matched.reduce((sum, entry) => sum + Number(entry.elapsedMinutes || 0), 0);
    const breakMinutes = matched.reduce((sum, entry) => sum + Number(entry.breakMinutes || 0), 0);
    const manualMinutes = matched.reduce((sum, entry) => sum + Number(entry.manualMinutes || 0), 0);
    const totalTasks = Number(expert.totalTasks || 0);
    const ahtHours = totalTasks > 0 ? Number((elapsedMinutes / 60 / totalTasks).toFixed(2)) : null;
    const status = String(expert.status || 'Unknown');
    const removedFromOnboardingChannel = Boolean(expert.removedFromOnboardingChannel);
    const inProduction = isActiveStatus(status) && removedFromOnboardingChannel;
    const dayBreakdown = buildDayBreakdown(matched);
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
      totalTasks,
      removedFromOnboardingChannel,
      inProduction,
      status,
      elapsedMinutes,
      activityAverage: Number(averageActivity.toFixed(1)),
      breakMinutes,
      manualMinutes,
      activeDays: new Set(matched.map((entry) => entry.date)).size,
      ahtHours,
      latestDate,
      lastUpdatedAt,
      dayBreakdown,
    } satisfies DashboardRow;
  });

  const filteredRows = rows.filter((row) => {
    const matchesSearch = search
      ? [row.name, row.personalEmail, row.expertEmail, row.status].some((value) => normalizeSearch(value).includes(search))
      : true;
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
    const matchesTime =
      timeFilter === 'all' || (timeFilter === 'with-time' && row.elapsedMinutes > 0) || (timeFilter === 'without-time' && row.elapsedMinutes === 0);
    const matchesAht =
      ahtFilter === 'all' ||
      (row.ahtHours !== null && ahtFilter === 'over' && row.ahtHours >= ahtTargetHours) ||
      (row.ahtHours !== null && ahtFilter === 'under' && row.ahtHours <= ahtTargetHours);

    return matchesSearch && matchesStatus && matchesTime && matchesAht;
  });

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
      if (row.inProduction) {
        accumulator.expertsInProduction += 1;
        accumulator.productionElapsedMinutes += row.elapsedMinutes;
        accumulator.productionTasks += row.totalTasks;
      }
      return accumulator;
    },
    {
      totalElapsedMinutes: 0,
      totalExperts: filteredRows.length,
      expertsWithTime: 0,
      expertsInProduction: 0,
      productionElapsedMinutes: 0,
      productionTasks: 0,
      productionAhtHours: null as number | null,
      expertsWithActivity: 0,
      unmatchedMinutes: unmatchedEntries.reduce((sum, entry) => sum + Number(entry.elapsedMinutes || 0), 0),
      averageActivity: 0,
    },
  );

  if (summary.expertsWithActivity) {
    summary.averageActivity = Number((summary.averageActivity / summary.expertsWithActivity).toFixed(1));
  }
  if (summary.productionTasks > 0) {
    summary.productionAhtHours = Number((summary.productionElapsedMinutes / 60 / summary.productionTasks).toFixed(2));
  }

  return {
    range: { from: params.from, to: params.to },
    filters: {
      query: params.query || '',
      status: statusFilter,
      time: timeFilter,
      aht: ahtFilter,
      ahtTargetHours,
      sort,
      direction,
    },
    summary,
    chartData,
    rows: sortRows(filteredRows, sort, direction),
    unmatchedRows: buildUnmatchedRows(unmatchedEntries),
    statuses,
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

export async function getUnmatchedLedgerSnapshot(params: { from: string; to: string }): Promise<UnmatchedLedgerSnapshot> {
  const { experts, entries, assignments } = await getDashboardSourceData(params.from, params.to);
  const unmatchedEntries = entries.filter((entry) => !experts.some((expert) => entryMatchesExpert(entry, expert, assignments)));

  return {
    range: { from: params.from, to: params.to },
    unmatchedRows: buildUnmatchedRows(unmatchedEntries),
    experts: experts.map((expert) => ({
      id: String(expert._id || ''),
      name: String(expert.name || ''),
      personalEmail: String(expert.personalEmail || ''),
      expertEmail: String(expert.expertEmail || ''),
      status: String(expert.status || 'Unknown'),
    })),
  };
}
