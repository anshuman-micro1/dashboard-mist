'use client';

import { useEffect, useState } from 'react';

type CredentialField =
  | 'HUBSTAFF_XSRF_TOKEN'
  | 'HUBSTAFF_SESSION'
  | 'HUBSTAFF_ACCOUNT_REFRESH'
  | 'HUBSTAFF_INGRESS_COOKIE'
  | 'HUBSTAFF_STRIPE_MID'
  | 'HUBSTAFF_CSRF_TOKEN';

type Credentials = Record<CredentialField, string>;

type HarHeader = {
  name?: string;
  value?: string;
};

type HarEntry = {
  request?: {
    url?: string;
    headers?: HarHeader[];
  };
};

type HarFile = {
  log?: {
    entries?: HarEntry[];
  };
};

const credentialFields: Array<{ key: CredentialField; label: string; multiline?: boolean }> = [
  { key: 'HUBSTAFF_XSRF_TOKEN', label: 'XSRF Token' },
  { key: 'HUBSTAFF_SESSION', label: 'Session', multiline: true },
  { key: 'HUBSTAFF_ACCOUNT_REFRESH', label: 'Account Refresh' },
  { key: 'HUBSTAFF_INGRESS_COOKIE', label: 'Ingress Cookie' },
  { key: 'HUBSTAFF_STRIPE_MID', label: 'Stripe MID' },
  { key: 'HUBSTAFF_CSRF_TOKEN', label: 'CSRF Token (POST)' },
];

const emptyCredentials: Credentials = {
  HUBSTAFF_XSRF_TOKEN: '',
  HUBSTAFF_SESSION: '',
  HUBSTAFF_ACCOUNT_REFRESH: '',
  HUBSTAFF_INGRESS_COOKIE: '',
  HUBSTAFF_STRIPE_MID: '',
  HUBSTAFF_CSRF_TOKEN: '',
};

function parseCookieHeader(cookieHeader: string) {
  const values: Partial<Credentials> = {};
  const cookieMap = new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
      }),
  );

  values.HUBSTAFF_XSRF_TOKEN = cookieMap.get('XSRF-TOKEN') || '';
  values.HUBSTAFF_SESSION = cookieMap.get('_hubstaff_session') || '';
  values.HUBSTAFF_ACCOUNT_REFRESH = cookieMap.get('hubstaff_account_refresh') || '';
  values.HUBSTAFF_INGRESS_COOKIE = cookieMap.get('INGRESSCOOKIE') || '';
  values.HUBSTAFF_STRIPE_MID = cookieMap.get('__stripe_mid') || '';

  return values;
}

function findQuotedArguments(command: string, flagPattern: string) {
  const matches: string[] = [];
  const regex = new RegExp(`${flagPattern}\\s+(['"])([\\s\\S]*?)\\1`, 'g');
  let match = regex.exec(command);

  while (match) {
    matches.push(match[2]);
    match = regex.exec(command);
  }

  return matches;
}

function parseCurl(command: string) {
  const values: Partial<Credentials> = {};
  const headers = findQuotedArguments(command, '(?:-H|--header)');
  const cookieArguments = findQuotedArguments(command, '(?:-b|--cookie)');
  const cookieHeader =
    cookieArguments[0] ||
    headers
      .map((header) => {
        const separatorIndex = header.indexOf(':');
        const name = separatorIndex === -1 ? '' : header.slice(0, separatorIndex).trim().toLowerCase();
        return name === 'cookie' ? header.slice(separatorIndex + 1).trim() : '';
      })
      .find(Boolean) ||
    '';

  Object.assign(values, parseCookieHeader(cookieHeader));

  const csrfHeader = headers.find((header) => header.toLowerCase().startsWith('x-csrf-token:'));
  if (csrfHeader) {
    values.HUBSTAFF_CSRF_TOKEN = csrfHeader.slice(csrfHeader.indexOf(':') + 1).trim();
  }

  return values;
}

function mergeCredentials(current: Credentials, patch: Partial<Credentials>) {
  return credentialFields.reduce((accumulator, field) => {
    accumulator[field.key] = patch[field.key] ?? current[field.key] ?? '';
    return accumulator;
  }, { ...emptyCredentials });
}

function extractFromHar(value: HarFile) {
  const entries = value.log?.entries || [];
  const hubstaffRequest = entries.find((entry) => entry.request?.url?.includes('hubstaff.com'));
  const headers = hubstaffRequest?.request?.headers || [];
  const cookieHeader = headers.find((header) => header.name?.toLowerCase() === 'cookie')?.value || '';
  const csrfHeader = headers.find((header) => header.name?.toLowerCase() === 'x-csrf-token')?.value || '';

  return {
    ...parseCookieHeader(cookieHeader),
    HUBSTAFF_CSRF_TOKEN: csrfHeader,
  } satisfies Partial<Credentials>;
}

export function HubstaffCredentialsForm() {
  const [credentials, setCredentials] = useState<Credentials>(emptyCredentials);
  const [curlText, setCurlText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch('/api/settings');
        const payload = (await response.json().catch(() => ({}))) as Partial<Credentials> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load credentials');
        }

        if (active) {
          setCredentials(mergeCredentials(emptyCredentials, payload));
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Failed to load credentials');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  function updateField(field: CredentialField, value: string) {
    setCredentials((current) => ({ ...current, [field]: value }));
  }

  function applyCurl() {
    const parsed = parseCurl(curlText);
    setCredentials((current) => mergeCredentials(current, parsed));
    setMessage('Extracted Hubstaff credentials from the pasted cURL.');
  }

  async function handleHarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as HarFile;
      const extracted = extractFromHar(parsed);
      setCredentials((current) => mergeCredentials(current, extracted));
      setMessage('Extracted Hubstaff credentials from the HAR file.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to parse HAR file');
    } finally {
      event.target.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save credentials');
      }

      setMessage('Hubstaff credentials saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="glass-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">Stored credentials</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Hubstaff browser session</h2>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {credentialFields.map((field) => (
            <label key={field.key} className={field.multiline ? 'block space-y-2 lg:col-span-2' : 'block space-y-2'}>
              <span className="text-sm text-slate-300">{field.label}</span>
              {field.multiline ? (
                <textarea
                  value={credentials[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#67d4ff]/70"
                  disabled={loading}
                />
              ) : (
                <input
                  value={credentials[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#67d4ff]/70"
                  disabled={loading}
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-[#ffb84d]">DevTools cURL</p>
          <textarea
            value={curlText}
            onChange={(event) => setCurlText(event.target.value)}
            rows={10}
            className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-[#ffb84d]/70"
          />
          <button
            type="button"
            onClick={applyCurl}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#ffb84d] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Extract from cURL
          </button>
        </div>

        <div className="glass-panel rounded-[1.75rem] p-6">
          <p className="text-sm uppercase tracking-[0.28em] text-[#67d4ff]">HAR import</p>
          <label className="mt-4 block space-y-2 text-sm text-slate-300">
            <span>HAR file</span>
            <input
              type="file"
              accept=".har,.json,application/json"
              onChange={handleHarUpload}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={saving || loading}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#67d4ff] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving credentials...' : 'Save credentials'}
          </button>
          {message ? <p className="mt-4 text-sm text-slate-200">{message}</p> : null}
        </div>
      </section>
    </form>
  );
}
