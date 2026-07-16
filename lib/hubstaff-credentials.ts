import { getDb } from '@/lib/mongodb';

export const HUBSTAFF_CREDENTIALS_ID = 'hubstaff_credentials';

export type HubstaffCredentials = {
  HUBSTAFF_XSRF_TOKEN: string;
  HUBSTAFF_SESSION: string;
  HUBSTAFF_ACCOUNT_REFRESH: string;
  HUBSTAFF_INGRESS_COOKIE: string;
  HUBSTAFF_STRIPE_MID: string;
  HUBSTAFF_CSRF_TOKEN: string;
};

export type HubstaffCredentialsDocument = HubstaffCredentials & {
  _id: typeof HUBSTAFF_CREDENTIALS_ID;
  updatedAt: Date;
};

const credentialFields = [
  'HUBSTAFF_XSRF_TOKEN',
  'HUBSTAFF_SESSION',
  'HUBSTAFF_ACCOUNT_REFRESH',
  'HUBSTAFF_INGRESS_COOKIE',
  'HUBSTAFF_STRIPE_MID',
  'HUBSTAFF_CSRF_TOKEN',
] as const;

let credentialsCache: HubstaffCredentials | null = null;

function emptyCredentials(): HubstaffCredentials {
  return {
    HUBSTAFF_XSRF_TOKEN: '',
    HUBSTAFF_SESSION: '',
    HUBSTAFF_ACCOUNT_REFRESH: '',
    HUBSTAFF_INGRESS_COOKIE: '',
    HUBSTAFF_STRIPE_MID: '',
    HUBSTAFF_CSRF_TOKEN: '',
  };
}

export function sanitizeHubstaffCredentials(value: Partial<Record<keyof HubstaffCredentials, unknown>>) {
  const credentials = emptyCredentials();

  for (const field of credentialFields) {
    credentials[field] = String(value[field] || '').trim();
  }

  return credentials;
}

function credentialsFromEnvironment() {
  return sanitizeHubstaffCredentials({
    HUBSTAFF_XSRF_TOKEN: process.env.HUBSTAFF_XSRF_TOKEN,
    HUBSTAFF_SESSION: process.env.HUBSTAFF_SESSION,
    HUBSTAFF_ACCOUNT_REFRESH: process.env.HUBSTAFF_ACCOUNT_REFRESH,
    HUBSTAFF_INGRESS_COOKIE: process.env.HUBSTAFF_INGRESS_COOKIE,
    HUBSTAFF_STRIPE_MID: process.env.HUBSTAFF_STRIPE_MID,
    HUBSTAFF_CSRF_TOKEN: process.env.HUBSTAFF_CSRF_TOKEN,
  });
}

export function getEnvironmentHubstaffCredentials() {
  return credentialsFromEnvironment();
}

export function getEnvironmentHubstaffCookieHeader() {
  return process.env.HUBSTAFF_COOKIE_HEADER || '';
}

function hasAnyCredential(credentials: HubstaffCredentials) {
  return credentialFields.some((field) => credentials[field]);
}

export function getCachedCredentials() {
  return credentialsCache;
}

export function setCachedCredentials(credentials: HubstaffCredentials | null) {
  credentialsCache = credentials;
}

export function clearCredentialsCache() {
  credentialsCache = null;
}

export async function getStoredHubstaffCredentials() {
  const db = await getDb();
  const document = await db
    .collection<HubstaffCredentialsDocument>('settings')
    .findOne({ _id: HUBSTAFF_CREDENTIALS_ID });

  if (!document) {
    return null;
  }

  return sanitizeHubstaffCredentials(document);
}

export async function saveHubstaffCredentials(credentials: HubstaffCredentials) {
  const db = await getDb();
  const sanitized = sanitizeHubstaffCredentials(credentials);
  const updatedAt = new Date();

  await db.collection<HubstaffCredentialsDocument>('settings').updateOne(
    { _id: HUBSTAFF_CREDENTIALS_ID },
    {
      $set: {
        ...sanitized,
        updatedAt,
      },
      $setOnInsert: {
        _id: HUBSTAFF_CREDENTIALS_ID,
      },
    },
    { upsert: true },
  );

  clearCredentialsCache();
  return { ...sanitized, updatedAt };
}

export async function resolveHubstaffCredentials() {
  const resolved = await resolveHubstaffCredentialsWithSource();
  return resolved.credentials;
}

export async function resolveHubstaffCredentialsWithSource() {
  const cached = getCachedCredentials();

  if (cached) {
    return { credentials: cached, source: 'cache' as const };
  }

  const stored = await getStoredHubstaffCredentials();

  if (stored && hasAnyCredential(stored)) {
    setCachedCredentials(stored);
    return { credentials: stored, source: 'database' as const };
  }

  const environmentCredentials = credentialsFromEnvironment();
  setCachedCredentials(environmentCredentials);
  return { credentials: environmentCredentials, source: 'environment' as const };
}

export function publicHubstaffCredentials(credentials: HubstaffCredentials | null) {
  if (!credentials) {
    return {};
  }

  return sanitizeHubstaffCredentials(credentials);
}
