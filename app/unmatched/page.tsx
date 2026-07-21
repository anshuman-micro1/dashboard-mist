import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUserFromCookies } from '@/lib/auth';
import { defaultDateRange } from '@/lib/date-range';
import { getUnmatchedLedgerSnapshot, minutesToDisplay, type DashboardDayBreakdown } from '@/lib/dashboard';

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

export default async function UnmatchedPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; assigned?: string; error?: string }>;
}) {
  const session = await getSessionUserFromCookies();

  if (!session) {
    redirect('/login');
  }

  const defaults = defaultDateRange();
  const resolvedSearchParams = (await searchParams) || {};
  const from = resolvedSearchParams.from || defaults.start;
  const to = resolvedSearchParams.to || defaults.end;
  const snapshot = await getUnmatchedLedgerSnapshot({ from, to });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="glass-panel rounded-[2rem] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#ffb84d]">Unmatched ledger</p>
              <h1 className="mt-3 text-3xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Hubstaff hours without a master-sheet match
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Assign a Hubstaff identity to an expert once, and future dashboard totals will treat that identity as matched.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/dashboard?from=${from}&to=${to}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Back to dashboard
              </Link>
              <Link href="/import" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Import tools
              </Link>
            </div>
          </div>
        </header>

        <section className="glass-panel rounded-[2rem] p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <form className="flex flex-wrap gap-3" method="get">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Start date</span>
                <input type="date" name="from" defaultValue={from} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>End date</span>
                <input type="date" name="to" defaultValue={to} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <button type="submit" className="self-end rounded-2xl bg-[#ffb84d] px-4 py-3 text-sm font-semibold text-slate-950">
                Filter ledger
              </button>
            </form>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-slate-400">Unmatched total</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {minutesToDisplay(snapshot.unmatchedRows.reduce((sum, row) => sum + row.elapsedMinutes, 0)).short}
              </p>
            </div>
          </div>
          {resolvedSearchParams.assigned ? <p className="mt-4 text-sm text-[#67d4ff]">Assignment saved. Dashboard totals now include that Hubstaff identity.</p> : null}
          {resolvedSearchParams.error ? <p className="mt-4 text-sm text-red-300">{resolvedSearchParams.error}</p> : null}
        </section>

        <section className="glass-panel overflow-hidden rounded-[2rem]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Hubstaff identity</th>
                  <th className="px-6 py-4 font-medium">Elapsed</th>
                  <th className="px-6 py-4 font-medium">Activity</th>
                  <th className="px-6 py-4 font-medium">Rows</th>
                  <th className="px-6 py-4 font-medium">Latest date</th>
                  <th className="px-6 py-4 font-medium">Assign to expert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {snapshot.unmatchedRows.map((row) => (
                  <tr key={`${row.name}-${row.email}`} className="hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <details>
                        <summary className="cursor-pointer list-none font-semibold text-white transition hover:text-[#ffb84d]">
                          {row.name || row.email || 'Blank Hubstaff row'}
                        </summary>
                        <DayBreakdownTable days={row.dayBreakdown} />
                      </details>
                      <div className="mt-1 text-xs text-slate-500">{row.email || 'No email in export'}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{minutesToDisplay(row.elapsedMinutes).short}</td>
                    <td className="px-6 py-4 text-slate-300">{row.activityAverage.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-slate-300">{row.entries}</td>
                    <td className="px-6 py-4 text-slate-300">{row.latestDate || '—'}</td>
                    <td className="px-6 py-4">
                      <form action="/api/unmatched/assign" method="post" className="flex min-w-[360px] gap-2">
                        <input type="hidden" name="hubstaffName" value={row.name} />
                        <input type="hidden" name="hubstaffEmail" value={row.email} />
                        <input type="hidden" name="from" value={from} />
                        <input type="hidden" name="to" value={to} />
                        <select name="expertId" required className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                          <option value="">Choose expert</option>
                          {snapshot.experts.map((expert) => (
                            <option key={expert.id} value={expert.id}>
                              {expert.name} · {expert.status}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-xl bg-[#67d4ff] px-4 py-2 text-sm font-semibold text-slate-950">
                          Assign
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!snapshot.unmatchedRows.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      No unmatched Hubstaff time in this range.
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
