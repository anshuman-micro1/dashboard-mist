import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HubstaffCredentialsForm } from '@/components/hubstaff-credentials-form';
import { getSessionUserFromCookies } from '@/lib/auth';

export default async function SettingsPage() {
  const session = await getSessionUserFromCookies();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="glass-panel rounded-[2rem] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#67d4ff]">Settings</p>
              <h1 className="mt-3 text-3xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Hubstaff credentials
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Store browser-session credentials for Hubstaff report and member sync requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/import" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Import tools
              </Link>
              <Link href="/dashboard" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <HubstaffCredentialsForm />
      </div>
    </main>
  );
}
