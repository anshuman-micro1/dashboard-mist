import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ElapsedChart } from '@/components/elapsed-chart';
import { getSessionUserFromCookies } from '@/lib/auth';
import { getDashboardSnapshot, minutesToDisplay } from '@/lib/dashboard';

function defaultDateRange() {
  const end = process.env.REPORT_DATE_END || new Date().toISOString().slice(0, 10);
  const start = process.env.REPORT_DATE_START || new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);
  return { start, end };
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string; q?: string }> }) {
  const session = await getSessionUserFromCookies();

  if (!session) {
    redirect('/login');
  }

  const defaults = defaultDateRange();
  const resolvedSearchParams = (await searchParams) || {};
  const from = resolvedSearchParams.from || defaults.start;
  const to = resolvedSearchParams.to || defaults.end;
  const query = resolvedSearchParams.q || '';
  const snapshot = await getDashboardSnapshot({ from, to, query });

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
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Expert</th>
                  <th className="px-6 py-4 font-medium">Contacts</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Tasks</th>
                  <th className="px-6 py-4 font-medium">Elapsed</th>
                  <th className="px-6 py-4 font-medium">Activity</th>
                  <th className="px-6 py-4 font-medium">Days</th>
                  <th className="px-6 py-4 font-medium">Latest date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {snapshot.rows.map((row) => (
                  <tr key={`${row.name}-${row.personalEmail}-${row.expertEmail}`} className="hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{row.name || 'Unnamed expert'}</div>
                      <div className="mt-1 text-xs text-slate-400">{row.removedFromOnboardingChannel ? 'Removed from onboarding channel' : 'Active in onboarding channel'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{row.personalEmail || '—'}</div>
                      <div className="text-xs text-slate-500">{row.expertEmail || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{row.status || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-300">{row.totalTasks}</td>
                    <td className="px-6 py-4 font-semibold text-white">{minutesToDisplay(row.elapsedMinutes).short}</td>
                    <td className="px-6 py-4 text-slate-300">{row.activityAverage.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-slate-300">{row.activeDays}</td>
                    <td className="px-6 py-4 text-slate-300">{row.latestDate || '—'}</td>
                  </tr>
                ))}
                {!snapshot.rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
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
