'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export type SlackMessageExpert = {
  name: string;
  personalEmail: string;
  expertEmail: string;
  status: string;
  inProduction: boolean;
  totalTasks: number;
  elapsed: string;
  aht: string;
  ahtHours: number | null;
  latestDate: string;
  reason: 'aht' | 'no-tasks';
};

function defaultIntro(reason: SlackMessageExpert['reason']) {
  if (reason === 'no-tasks') {
    return 'Hi {name}, I noticed time was tracked but no tasks are showing for this period. Could you please help me understand if you are blocked starting tasks or if any task details are missing?';
  }

  return 'Hi {name}, I noticed your AHT is above the review threshold for this period. Could you please share if you are facing any difficulty starting tasks or if there is extra context around the time spent?';
}

function defaultSignoff() {
  return 'Thank you. Please share any blocker or task detail here when you get a chance.';
}

function applyTemplate(template: string, expert: SlackMessageExpert) {
  return template
    .replaceAll('{name}', expert.name || 'there')
    .replaceAll('{elapsed}', expert.elapsed)
    .replaceAll('{aht}', expert.aht)
    .replaceAll('{tasks}', String(expert.totalTasks))
    .replaceAll('{status}', expert.status || 'Unknown')
    .replaceAll('{latestDate}', expert.latestDate || 'N/A')
    .replaceAll('{production}', expert.inProduction ? 'Yes' : 'No');
}

function buildMessage(expert: SlackMessageExpert, intro: string, signoff: string, includeMetrics: boolean, includeEmojis: boolean) {
  const marker = includeEmojis ? (expert.reason === 'no-tasks' ? ':rotating_light: ' : ':warning: ') : '';
  const metrics = includeMetrics
    ? [
        '',
        `${includeEmojis ? ':bar_chart: ' : ''}Metrics:`,
        `- Elapsed: ${expert.elapsed}`,
        `- AHT: ${expert.aht}`,
        `- Tasks: ${expert.totalTasks}`,
        `- Status: ${expert.status || 'Unknown'}`,
        `- In production: ${expert.inProduction ? 'Yes' : 'No'}`,
        `- Latest date: ${expert.latestDate || 'N/A'}`,
      ]
    : [];

  return [marker + applyTemplate(intro, expert), ...metrics, '', applyTemplate(signoff, expert)].join('\n').trim();
}

function ahtReviewClass(value: number | null, thresholdHours: number) {
  if (value === null || value <= thresholdHours) {
    return 'text-slate-300';
  }
  if (value > 5) {
    return 'border-red-400/40 bg-red-500/15 text-red-100';
  }
  if (value < 5) {
    return 'border-yellow-300/40 bg-yellow-400/15 text-yellow-100';
  }
  return 'text-slate-300';
}

export function SlackMessageComposer({
  ahtExperts,
  highPriorityExperts,
  thresholdHours,
}: {
  ahtExperts: SlackMessageExpert[];
  highPriorityExperts: SlackMessageExpert[];
  thresholdHours: number;
}) {
  const [intro, setIntro] = useState(defaultIntro('aht'));
  const [highPriorityIntro, setHighPriorityIntro] = useState(defaultIntro('no-tasks'));
  const [signoff, setSignoff] = useState(defaultSignoff());
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function messageForExpert(expert: SlackMessageExpert) {
    return buildMessage(expert, expert.reason === 'no-tasks' ? highPriorityIntro : intro, signoff, includeMetrics, includeEmojis);
  }

  async function copyMessage(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <>
      <section className="glass-panel rounded-[2rem] p-6 sm:p-7">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">Slack message settings</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Polite follow-up template</h2>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="space-y-2 text-sm text-slate-300">
            <span>AHT intro</span>
            <textarea value={intro} onChange={(event) => setIntro(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>High priority intro</span>
            <textarea value={highPriorityIntro} onChange={(event) => setHighPriorityIntro(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Signoff</span>
            <textarea value={signoff} onChange={(event) => setSignoff(event.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
          </label>
          <div className="flex flex-wrap items-center gap-5 self-end rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={includeMetrics} onChange={(event) => setIncludeMetrics(event.target.checked)} className="h-4 w-4 rounded border-white/10 bg-white/5" />
              Include metrics
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={includeEmojis} onChange={(event) => setIncludeEmojis(event.target.checked)} className="h-4 w-4 rounded border-white/10 bg-white/5" />
              Include Slack emojis
            </label>
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="border-b border-red-400/20 px-6 py-5 sm:px-7">
          <p className="text-sm uppercase tracking-[0.28em] text-red-200">High priority pings</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Tracked time without tasks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-red-500/10 text-red-100">
              <tr>
                <th className="px-6 py-4 font-medium">Expert</th>
                <th className="px-6 py-4 font-medium">Contacts</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">In Production</th>
                <th className="px-6 py-4 font-medium">Tasks</th>
                <th className="px-6 py-4 font-medium">Elapsed</th>
                <th className="px-6 py-4 font-medium">Latest date</th>
                <th className="px-6 py-4 font-medium">Slack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {highPriorityExperts.map((expert) => {
                const key = `${expert.reason}-${expert.name}`;
                const message = messageForExpert(expert);

                return (
                  <tr key={key} className="border-red-400/40 bg-red-500/15 text-red-100">
                    <td className="px-6 py-4 font-semibold">{expert.name || 'Unnamed expert'}</td>
                    <td className="px-6 py-4">
                      <div>{expert.personalEmail || '—'}</div>
                      <div className="text-xs opacity-80">{expert.expertEmail || '—'}</div>
                    </td>
                    <td className="px-6 py-4">{expert.status || 'Unknown'}</td>
                    <td className="px-6 py-4">{expert.inProduction ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 font-semibold">{expert.totalTasks}</td>
                    <td className="px-6 py-4 font-semibold">{expert.elapsed}</td>
                    <td className="px-6 py-4">{expert.latestDate || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => copyMessage(key, message)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
                        {copiedKey === key ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                        {copiedKey === key ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!highPriorityExperts.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No experts have more than {thresholdHours.toFixed(1).replace(/\.0$/, '')}h tracked with zero tasks.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="border-b border-white/10 px-6 py-5 sm:px-7">
          <p className="text-sm uppercase tracking-[0.28em] text-[#ffb84d]">Review queue</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">AHT exceptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Expert</th>
                <th className="px-6 py-4 font-medium">Contacts</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">In Production</th>
                <th className="px-6 py-4 font-medium">Tasks</th>
                <th className="px-6 py-4 font-medium">Elapsed</th>
                <th className="px-6 py-4 font-medium">AHT</th>
                <th className="px-6 py-4 font-medium">Latest date</th>
                <th className="px-6 py-4 font-medium">Slack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {ahtExperts.map((expert) => {
                const key = `${expert.reason}-${expert.name}`;
                const message = messageForExpert(expert);

                return (
                  <tr key={key} className={ahtReviewClass(expert.ahtHours, thresholdHours)}>
                    <td className="px-6 py-4 font-semibold">{expert.name || 'Unnamed expert'}</td>
                    <td className="px-6 py-4">
                      <div>{expert.personalEmail || '—'}</div>
                      <div className="text-xs opacity-80">{expert.expertEmail || '—'}</div>
                    </td>
                    <td className="px-6 py-4">{expert.status || 'Unknown'}</td>
                    <td className="px-6 py-4">{expert.inProduction ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4">{expert.totalTasks}</td>
                    <td className="px-6 py-4">{expert.elapsed}</td>
                    <td className="px-6 py-4 font-semibold">{expert.aht}</td>
                    <td className="px-6 py-4">{expert.latestDate || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => copyMessage(key, message)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">
                        {copiedKey === key ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                        {copiedKey === key ? 'Copied' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!ahtExperts.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                    No experts are above {thresholdHours.toFixed(1).replace(/\.0$/, '')}h AHT for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
