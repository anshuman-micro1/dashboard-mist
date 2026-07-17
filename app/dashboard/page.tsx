import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ElapsedChart } from '@/components/elapsed-chart';
import { getSessionUserFromCookies } from '@/lib/auth';
import { getDashboardSnapshot, minutesToDisplay, type DashboardDayBreakdown } from '@/lib/dashboard';

function defaultDateRange() {
  const end = process.env.REPORT_DATE_END || new Date().toISOString().slice(0, 10);
  const start = process.env.REPORT_DATE_START || new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);
  return { start, end };
}

function ahtDisplay(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}h`;
}

function SortMarker({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) {
    return null;
  }

  return <span className="text-xs text-slate-500">{direction === 'desc' ? 'desc' : 'asc'}</span>;
}

function DayBreakdownTable({ days }: { days: DashboardDayBreakdown[] }) {
  if (!days.length) {
    return <p className="mt-3 text-xs text-slate-500">No tracked days in this range.</p>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-xs">
        <thead className="bg-white/[0.04] text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-right font-medium">Tracked</th>
            <th className="px-3 py-2 text-right font-medium">Activity</th>
            <th className="px-3 py-2 text-right font-medium">Entries</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-slate-300">
          {days.map((day) => (
            <tr key={day.date}>
              <td className="px-3 py-2">{day.date}</td>
              <td className="px-3 py-2 text-right font-semibold text-white">{minutesToDisplay(day.elapsedMinutes).short}</td>
              <td className="px-3 py-2 text-right">{day.activityAverage.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">{day.entries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    q?: string;
    status?: string;
    time?: string;
    aht?: string;
    ahtTarget?: string;
    sort?: string;
    dir?: string;
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
  const ahtTargetHours = Number(resolvedSearchParams.ahtTarget || 3);
  const snapshot = await getDashboardSnapshot({
    from,
    to,
    query,
    status: resolvedSearchParams.status,
    time: resolvedSearchParams.time,
    aht: resolvedSearchParams.aht,
    ahtTargetHours,
    sort: resolvedSearchParams.sort,
    direction: resolvedSearchParams.dir,
  });

  const totalElapsed = minutesToDisplay(snapshot.summary.totalElapsedMinutes);
  const unmatched = minutesToDisplay(snapshot.summary.unmatchedMinutes);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="glass-panel rounded-[2rem] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
                Mist dashboard
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
                Hubstaff elapsed time tracking
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Synced through MongoDB and matched to the master sheet for expert status, tasks, and time totals.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/import" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                Import tools
              </Link>
              <Link href={`/unmatched?from=${from}&to=${to}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                Unmatched ledger
              </Link>
              <Link href="/settings" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                Hubstaff settings
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          {[
            ['Total elapsed', totalElapsed.short, 'Hubstaff minutes in the selected range'],
            ['Experts tracked', String(snapshot.summary.totalExperts), 'Matched master sheet rows'],
            ['Experts with time', String(snapshot.summary.expertsWithTime), 'People with elapsed time recorded'],
            ['Unmatched minutes', unmatched.short, 'Hubstaff rows not matched to the master sheet'],
          ].map(([label, value, description]) => (
            <article key={label} className="glass-panel rounded-[1.75rem] p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">{label}</p>
              <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="glass-panel rounded-[2rem] p-6 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">Elapsed trend</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Daily hours over the selected range</h2>
              </div>
              <form className="flex flex-wrap gap-3" method="get">
                <input type="date" name="from" defaultValue={from} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
                <input type="date" name="to" defaultValue={to} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Search expert"
                  className="min-w-[220px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <input type="hidden" name="status" value={snapshot.filters.status} />
                <input type="hidden" name="time" value={snapshot.filters.time} />
                <input type="hidden" name="aht" value={snapshot.filters.aht} />
                <input type="hidden" name="ahtTarget" value={snapshot.filters.ahtTargetHours} />
                <input type="hidden" name="sort" value={snapshot.filters.sort} />
                <input type="hidden" name="dir" value={snapshot.filters.direction} />
                <button type="submit" className="rounded-2xl bg-[#67d4ff] px-4 py-3 text-sm font-semibold text-slate-950">
                  Filter
                </button>
              </form>
            </div>
            <div className="mt-6">
              <ElapsedChart data={snapshot.chartData} />
            </div>
          </article>

          <aside className="glass-panel rounded-[2rem] p-6 sm:p-7">
            <p className="text-sm uppercase tracking-[0.28em] text-[#ffb84d]">Sync state</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Selected range</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {snapshot.range.from} to {snapshot.range.to}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Latest sync</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {snapshot.latestSync ? new Date(snapshot.latestSync.importedAt).toLocaleString() : 'Not synced yet'}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {snapshot.latestSync ? `${snapshot.latestSync.count} records imported from ${snapshot.latestSync.source}` : 'Run the Hubstaff sync to pull fresh data.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Average activity</p>
                <p className="mt-2 text-3xl font-semibold text-white">{snapshot.summary.averageActivity}%</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="glass-panel overflow-hidden rounded-[2rem]">
          <div className="border-b border-white/10 px-6 py-5 sm:px-7">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Expert ledger</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Elapsed time by expert</h2>
            <form className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1.2fr_1.2fr_1.1fr_1fr_0.8fr]" method="get">
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <label className="space-y-2 text-xs text-slate-400">
                <span>Search</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Name, email, status"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>Status</span>
                <select name="status" defaultValue={snapshot.filters.status} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All statuses</option>
                  {snapshot.statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>Time</span>
                <select name="time" defaultValue={snapshot.filters.time} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All experts</option>
                  <option value="with-time">With time</option>
                  <option value="without-time">Without time</option>
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>AHT filter</span>
                <select name="aht" defaultValue={snapshot.filters.aht} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">Any AHT</option>
                  <option value="over">At or above target</option>
                  <option value="under">At or below target</option>
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>AHT target</span>
                <input
                  type="number"
                  name="ahtTarget"
                  min="0.1"
                  step="0.1"
                  defaultValue={snapshot.filters.ahtTargetHours}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>Sort</span>
                <select name="sort" defaultValue={snapshot.filters.sort} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="elapsed">Elapsed</option>
                  <option value="name">Name</option>
                  <option value="tasks">Tasks</option>
                  <option value="aht">AHT</option>
                  <option value="activity">Activity</option>
                  <option value="days">Days</option>
                  <option value="latestDate">Latest date</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>Direction</span>
                <select name="dir" defaultValue={snapshot.filters.direction} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </label>
              <button type="submit" className="rounded-xl bg-[#ffb84d] px-4 py-2.5 text-sm font-semibold text-slate-950 md:col-span-2 xl:col-span-7">
                Apply ledger filters
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Expert <SortMarker active={snapshot.filters.sort === 'name'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Contacts</th>
                  <th className="px-6 py-4 font-medium">Status <SortMarker active={snapshot.filters.sort === 'status'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Tasks <SortMarker active={snapshot.filters.sort === 'tasks'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Elapsed <SortMarker active={snapshot.filters.sort === 'elapsed'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">AHT <SortMarker active={snapshot.filters.sort === 'aht'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Activity <SortMarker active={snapshot.filters.sort === 'activity'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Days <SortMarker active={snapshot.filters.sort === 'days'} direction={snapshot.filters.direction} /></th>
                  <th className="px-6 py-4 font-medium">Latest date <SortMarker active={snapshot.filters.sort === 'latestDate'} direction={snapshot.filters.direction} /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {snapshot.rows.map((row) => (
                  <tr key={`${row.name}-${row.personalEmail}-${row.expertEmail}`} className="hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <details>
                        <summary className="cursor-pointer list-none font-semibold text-white transition hover:text-[#67d4ff]">
                          {row.name || 'Unnamed expert'}
                        </summary>
                        <DayBreakdownTable days={row.dayBreakdown} />
                      </details>
                      <div className="mt-1 text-xs text-slate-400">{row.removedFromOnboardingChannel ? 'Removed from onboarding channel' : 'Active in onboarding channel'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{row.personalEmail || '—'}</div>
                      <div className="text-xs text-slate-500">{row.expertEmail || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{row.status || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-300">{row.totalTasks}</td>
                    <td className="px-6 py-4 font-semibold text-white">{minutesToDisplay(row.elapsedMinutes).short}</td>
                    <td className="px-6 py-4 text-slate-300">{ahtDisplay(row.ahtHours)}</td>
                    <td className="px-6 py-4 text-slate-300">{row.activityAverage.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-slate-300">{row.activeDays}</td>
                    <td className="px-6 py-4 text-slate-300">{row.latestDate || '—'}</td>
                  </tr>
                ))}
                {!snapshot.rows.length ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                      No experts matched this filter yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
