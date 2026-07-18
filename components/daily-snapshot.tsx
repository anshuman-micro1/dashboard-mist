'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export type DailySnapshotItem = {
  date: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
  lines: string[];
};

export type DailySnapshotFilters = {
  from: string;
  to: string;
  q: string;
  status: string;
  time: string;
  aht: string;
  ahtTarget: number;
  sort: string;
  dir: string;
};

export function DailySnapshot({
  snapshot,
  selectedDate,
  filters,
}: {
  snapshot: DailySnapshotItem | null;
  selectedDate: string;
  filters: DailySnapshotFilters;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copySnapshot(key: string, lines: string[]) {
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <section className="glass-panel rounded-[2rem] p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">Daily snapshot</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Day-wise team summary</h2>
        </div>
        <form className="flex flex-wrap gap-3" method="get">
          <input type="hidden" name="from" value={filters.from} />
          <input type="hidden" name="to" value={filters.to} />
          <input type="hidden" name="q" value={filters.q} />
          <input type="hidden" name="status" value={filters.status} />
          <input type="hidden" name="time" value={filters.time} />
          <input type="hidden" name="aht" value={filters.aht} />
          <input type="hidden" name="ahtTarget" value={filters.ahtTarget} />
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="dir" value={filters.dir} />
          <input
            type="date"
            name="snapshotDate"
            defaultValue={selectedDate}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />
          <button type="submit" className="rounded-2xl bg-[#67d4ff] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#8fe0ff]">
            Get snapshot
          </button>
        </form>
      </div>

      <div className="mt-5">
        {snapshot ? (
          <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{snapshot.date}</h3>
              <button
                type="button"
                onClick={() => copySnapshot(snapshot.date, snapshot.lines)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#67d4ff] px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-[#8fe0ff]"
              >
                {copiedKey === snapshot.date ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copiedKey === snapshot.date ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-4 font-mono text-sm leading-7 text-slate-100">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {snapshot.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>
              {snapshot.lines.map((line) => (
                <span key={line} className="sr-only">
                  {line}
                </span>
              ))}
            </div>
          </article>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            No tracked time found for {selectedDate || 'this date'}.
          </p>
        )}
      </div>
    </section>
  );
}
