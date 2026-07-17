import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { getSessionUserFromCookies } from '@/lib/auth';

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const session = await getSessionUserFromCookies();

  if (session) {
    redirect('/dashboard');
  }

  const resolvedSearchParams = (await searchParams) || {};
  const nextPath = resolvedSearchParams.next || '/dashboard';

  return (
    <main className="min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
            Hubstaff time operations
          </div>
          <div>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
              A sharper dashboard for expert elapsed time.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Review expert time, track progress, and resolve unmatched hours from one focused workspace.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Secure access', 'Sign in to continue'],
              ['Clear matching', 'Keep expert records aligned'],
              ['Fast review', 'See totals, activity, and status'],
            ].map(([title, description]) => (
              <div key={title} className="glass-panel rounded-[1.5rem] p-4">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#67d4ff]">Sign in</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Access the dashboard</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Enter your account details to continue.</p>
          </div>
          <div className="mt-8">
            <LoginForm nextPath={nextPath} />
          </div>
        </section>
      </div>
    </main>
  );
}
