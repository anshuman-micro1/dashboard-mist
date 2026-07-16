'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm({ nextPath = '/dashboard' }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEFAULT_EMAIL || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to sign in');
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2 text-sm text-slate-300">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-[#67d4ff]/70 focus:ring-2 focus:ring-[#67d4ff]/20"
          placeholder="hubstaff@micro1.ai"
          required
        />
      </label>

      <label className="block space-y-2 text-sm text-slate-300">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-[#67d4ff]/70 focus:ring-2 focus:ring-[#67d4ff]/20"
          placeholder="••••••••"
          required
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-[#ffb84d] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Signing in...' : 'Access dashboard'}
      </button>
    </form>
  );
}
