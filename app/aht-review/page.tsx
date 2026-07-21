import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SlackMessageComposer, type SlackMessageExpert } from '@/components/slack-message-composer';
import { getAhtReviewExpertKey, getAhtReviewStateKey, getAhtReviewStates } from '@/lib/aht-review';
import { getSessionUserFromCookies } from '@/lib/auth';
import { defaultDateRange } from '@/lib/date-range';
import { getDashboardSnapshot, minutesToDisplay } from '@/lib/dashboard';

function ahtDisplay(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}h`;
}

function hourDisplay(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')}h`;
}

function elapsedHours(minutes: number) {
  return minutes / 60;
}

function toSlackMessageExpert(row: (Awaited<ReturnType<typeof getDashboardSnapshot>>['rows'])[number], reason: SlackMessageExpert['reason']): SlackMessageExpert {
  return {
    name: row.name || 'Unnamed expert',
    expertKey: getAhtReviewExpertKey(row),
    personalEmail: row.personalEmail,
    expertEmail: row.expertEmail,
    status: row.status || 'Unknown',
    inProduction: row.inProduction,
    totalTasks: row.totalTasks,
    elapsed: minutesToDisplay(row.elapsedMinutes).short,
    aht: ahtDisplay(row.ahtHours),
    ahtHours: row.ahtHours,
    latestDate: row.latestDate || 'N/A',
    reason,
    contactedAt: null,
  };
}

export default async function AhtReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    q?: string;
    status?: string;
    time?: string;
    threshold?: string;
  }>;
}) {
  const session = await getSessionUserFromCookies();

  if (!session) {
    redirect('/login');
  }

  const defaults = defaultDateRange();
  const resolvedSearchParams = (await searchParams) || {};
  const from = resolvedSearchParams.from || defaults.start;
  const to = resolvedSearchParams.to || defaults.end;
  const query = resolvedSearchParams.q || '';
  const thresholdHours = Number(resolvedSearchParams.threshold || 4);
  const safeThresholdHours = Number.isFinite(thresholdHours) && thresholdHours > 0 ? thresholdHours : 4;
  const snapshot = await getDashboardSnapshot({
    from,
    to,
    query,
    status: resolvedSearchParams.status,
    time: resolvedSearchParams.time,
    aht: 'all',
    ahtTargetHours: safeThresholdHours,
    sort: 'aht',
    direction: 'desc',
  });
  const highPriorityRows = snapshot.rows
    .filter((row) => row.totalTasks === 0 && elapsedHours(row.elapsedMinutes) > safeThresholdHours)
    .sort((left, right) => right.elapsedMinutes - left.elapsedMinutes);
  const ahtReviewRows = snapshot.rows.filter((row) => row.ahtHours !== null && row.ahtHours > safeThresholdHours);
  const reviewExpertKeys = [...highPriorityRows, ...ahtReviewRows].map((row) => getAhtReviewExpertKey(row));
  const reviewStates = await getAhtReviewStates(reviewExpertKeys);
  const visibleHighPriorityRows = highPriorityRows.filter((row) => !reviewStates.get(getAhtReviewStateKey(getAhtReviewExpertKey(row), 'no-tasks'))?.resolvedAt);
  const visibleAhtReviewRows = ahtReviewRows.filter((row) => !reviewStates.get(getAhtReviewStateKey(getAhtReviewExpertKey(row), 'aht'))?.resolvedAt);
  const overFiveCount = visibleAhtReviewRows.filter((row) => row.ahtHours !== null && row.ahtHours > 5).length;
  const thresholdToFiveCount = visibleAhtReviewRows.filter((row) => row.ahtHours !== null && row.ahtHours > safeThresholdHours && row.ahtHours < 5).length;
  const yellowBandLabel = safeThresholdHours < 5 ? `Between ${hourDisplay(safeThresholdHours)} and 5h` : 'Yellow range';
  const highPriorityMessageExperts = visibleHighPriorityRows.map((row) => {
    const expert = toSlackMessageExpert(row, 'no-tasks');
    const state = reviewStates.get(getAhtReviewStateKey(expert.expertKey, 'no-tasks'));
    return { ...expert, contactedAt: state?.contactedAt || null };
  });
  const ahtMessageExperts = visibleAhtReviewRows.map((row) => {
    const expert = toSlackMessageExpert(row, 'aht');
    const state = reviewStates.get(getAhtReviewStateKey(expert.expertKey, 'aht'));
    return { ...expert, contactedAt: state?.contactedAt || null };
  });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="glass-panel rounded-[2rem] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
                AHT review
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
                Experts above {hourDisplay(safeThresholdHours)} AHT
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Review experts whose average handling time is above the production threshold for the selected range.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/dashboard?from=${from}&to=${to}`} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                Dashboard
              </Link>
              <Link href={`/unmatched?from=${from}&to=${to}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                Unmatched ledger
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="glass-panel rounded-[2rem] px-6 py-5 sm:px-7">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_1.2fr_1.1fr_0.9fr_auto]" method="get">
            <input type="date" name="from" defaultValue={from} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
            <input type="date" name="to" defaultValue={to} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search expert"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <select name="status" defaultValue={snapshot.filters.status} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
              <option value="all">All statuses</option>
              {snapshot.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="time" defaultValue={snapshot.filters.time} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
              <option value="all">All experts</option>
              <option value="with-time">With time</option>
              <option value="without-time">Without time</option>
            </select>
            <input
              type="number"
              name="threshold"
              min="0.1"
              step="0.1"
              defaultValue={safeThresholdHours}
              aria-label="AHT threshold hours"
              placeholder="Threshold hrs"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
            />
            <button type="submit" className="rounded-xl bg-[#ffb84d] px-4 py-2.5 text-sm font-semibold text-slate-950">
              Apply
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            [`Experts above ${hourDisplay(safeThresholdHours)}`, String(visibleAhtReviewRows.length), 'Experts requiring AHT review'],
            ['High priority pings', String(visibleHighPriorityRows.length), `No-task experts above ${hourDisplay(safeThresholdHours)} elapsed`],
            ['Above 5h', String(overFiveCount), 'Marked red in the review table'],
            [yellowBandLabel, String(thresholdToFiveCount), 'Marked yellow in the review table'],
            ['Production AHT', ahtDisplay(snapshot.summary.productionAhtHours), 'Elapsed hours per task for production experts'],
          ].map(([label, value, description]) => (
            <article key={label} className="glass-panel rounded-[1.75rem] p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">{label}</p>
              <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </article>
          ))}
        </section>

        <SlackMessageComposer ahtExperts={ahtMessageExperts} highPriorityExperts={highPriorityMessageExperts} thresholdHours={safeThresholdHours} from={from} to={to} />
      </div>
    </main>
  );
}
