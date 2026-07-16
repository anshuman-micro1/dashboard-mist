'use client';

import { useState } from 'react';

export function ImportPanel({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [syncMessage, setSyncMessage] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSync(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSyncing(true);
    setSyncMessage('');

    try {
      const response = await fetch('/api/hubstaff/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; imported?: number };

      if (!response.ok) {
        throw new Error(payload.error || 'Hubstaff sync failed');
      }

      setSyncMessage(`Imported ${payload.imported || 0} Hubstaff rows.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Hubstaff sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData(form);
      const file = formData.get('file');

      if (!(file instanceof File)) {
        throw new Error('Choose a master sheet file first');
      }

      const payload = new FormData();
      payload.set('file', file);

      const response = await fetch('/api/master-sheet/upload', {
        method: 'POST',
        body: payload,
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string; imported?: number };

      if (!response.ok) {
        throw new Error(result.error || 'Master sheet upload failed');
      }

      setUploadMessage(`Imported ${result.imported || 0} experts.`);
      form.reset();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Master sheet upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleSync} className="glass-panel rounded-[1.75rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">Hubstaff sync</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Refresh elapsed time</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            Uses saved Hubstaff credentials with <span className="font-semibold text-white">.env</span> fallback
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Start date</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#67d4ff]/70"
              required
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>End date</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#67d4ff]/70"
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={syncing}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#67d4ff] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {syncing ? 'Syncing Hubstaff...' : 'Sync Hubstaff export'}
        </button>

        {syncMessage ? <p className="mt-4 text-sm text-slate-200">{syncMessage}</p> : null}
      </form>

      <form onSubmit={handleUpload} className="glass-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[#ffb84d]">Master sheet</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Upload experts and status rows</h3>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Accepts CSV or XLSX exports with the columns Name, Personal Email, Expert Email, Total Tasks, Removed From
          Onboarding Channel, and Status.
        </p>

        <label className="mt-6 block space-y-2 text-sm text-slate-300">
          <span>Master sheet file</span>
          <input
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            required
          />
        </label>

        <button
          type="submit"
          disabled={uploading}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#ffb84d] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {uploading ? 'Uploading master sheet...' : 'Upload master sheet'}
        </button>

        {uploadMessage ? <p className="mt-4 text-sm text-slate-200">{uploadMessage}</p> : null}
      </form>
    </div>
  );
}
