import { parse } from 'csv-parse/sync';
import {
  clearCredentialsCache,
  getEnvironmentHubstaffCookieHeader,
  getEnvironmentHubstaffCredentials,
  resolveHubstaffCredentials,
  resolveHubstaffCredentialsWithSource,
  type HubstaffCredentials,
} from '@/lib/hubstaff-credentials';
import { coerceNumber, coerceString, normalizeLabel, parseDurationToMinutes } from '@/lib/parsers';

export type HubstaffEntry = {
  date: string;
  name: string;
  email: string;
  project: string;
  jobTitle: string;
  jobType: string;
  employeeId: string;
  timezone: string;
  location: string;
  elapsedMinutes: number;
  activity: number;
  breakMinutes: number;
  manualMinutes: number;
  raw: Record<string, unknown>;
  importedAt: Date;
};

function pickValue(row: Record<string, unknown>, aliases: string[]) {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [normalizeLabel(key), value] as const));

  for (const alias of aliases) {
    const value = lookup.get(normalizeLabel(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

function buildCookieHeader(credentials: HubstaffCredentials, rawCookieHeader = '') {
  if (rawCookieHeader) {
    return rawCookieHeader;
  }

  const cookies = [
    `organization=${process.env.HUBSTAFF_ORG_ID || ''}`,
    credentials.HUBSTAFF_STRIPE_MID && `__stripe_mid=${credentials.HUBSTAFF_STRIPE_MID}`,
    credentials.HUBSTAFF_INGRESS_COOKIE && `INGRESSCOOKIE=${credentials.HUBSTAFF_INGRESS_COOKIE}`,
    credentials.HUBSTAFF_XSRF_TOKEN && `XSRF-TOKEN=${credentials.HUBSTAFF_XSRF_TOKEN}`,
    credentials.HUBSTAFF_SESSION && `_hubstaff_session=${credentials.HUBSTAFF_SESSION}`,
    credentials.HUBSTAFF_ACCOUNT_REFRESH && `hubstaff_account_refresh=${credentials.HUBSTAFF_ACCOUNT_REFRESH}`,
  ].filter(Boolean);

  return cookies.join('; ');
}

function getHubstaffOrgId() {
  const orgId = process.env.HUBSTAFF_ORG_ID;

  if (!orgId) {
    throw new Error('Missing HUBSTAFF_ORG_ID');
  }

  return orgId;
}

function buildDailyReportUrl(dateStart: string, dateEnd: string) {
  const orgId = getHubstaffOrgId();
  const url = new URL(`https://app.hubstaff.com/reports/${orgId}/team/daily.csv`);
  url.searchParams.set('date', dateStart);
  url.searchParams.set('date_end', dateEnd);
  url.searchParams.set('group_by', 'date');
  url.searchParams.set('filters[show_email]', 'true');
  url.searchParams.set('filters[show_job_title]', 'true');
  url.searchParams.set('filters[show_job_type]', 'true');
  url.searchParams.set('filters[show_employee_id]', 'true');
  url.searchParams.set('filters[show_tax_info]', 'true');
  url.searchParams.set('filters[show_location]', 'true');
  url.searchParams.set('filters[show_timezone]', 'true');
  url.searchParams.set('filters[show_date_added]', 'true');
  url.searchParams.set('filters[show_spent]', 'true');
  url.searchParams.set('filters[show_activity]', 'true');
  url.searchParams.set('filters[show_manual]', 'true');
  url.searchParams.set('filters[show_break_time]', 'true');
  url.searchParams.set('filters[include_archived]', 'true');
  url.searchParams.set('filters[organization_id]', orgId);

  const projectId = process.env.HUBSTAFF_PROJECT_ID;
  if (projectId) {
    url.searchParams.append('filters[projects][]', projectId);
  }

  return url.toString();
}

function buildMembersUrl() {
  return `https://app.hubstaff.com/reports/${getHubstaffOrgId()}/members?filters%5Bappend_removed_label%5D=true`;
}

function buildBaseHeaders(credentials: HubstaffCredentials, referer: string, rawCookieHeader = '') {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: referer,
    Connection: 'keep-alive',
    DNT: '1',
    Cookie: buildCookieHeader(credentials, rawCookieHeader),
  };
}

function buildPostHeaders(credentials: HubstaffCredentials, referer: string) {
  return {
    ...buildBaseHeaders(credentials, referer),
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-Token': credentials.HUBSTAFF_CSRF_TOKEN,
    Origin: 'https://app.hubstaff.com',
  };
}

async function fetchHubstaffCsvWithCredentials(params: {
  from: string;
  to: string;
  credentials: HubstaffCredentials;
  rawCookieHeader?: string;
}) {
  const orgId = getHubstaffOrgId();
  const response = await fetch(buildDailyReportUrl(params.from, params.to), {
    headers: buildBaseHeaders(params.credentials, `https://app.hubstaff.com/reports/${orgId}/team/daily`, params.rawCookieHeader),
    cache: 'no-store',
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Hubstaff report request failed with ${response.status} ${response.statusText}`);
  }

  return {
    response,
    text,
    unexpectedResponse: describeUnexpectedHubstaffResponse(text),
  };
}

function parseRows(csvText: string) {
  return parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: false,
    delimiter: [',', '\t', ';'],
  }) as Record<string, unknown>[];
}

function isDateColumn(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasWideDailyColumns(rows: Record<string, unknown>[]) {
  return rows.some((row) => Object.keys(row).some(isDateColumn));
}

function parseWideDailyRows(rows: Record<string, unknown>[]): HubstaffEntry[] {
  return rows.flatMap((row) => {
    const dateColumns = Object.keys(row).filter(isDateColumn);
    const name = coerceString(pickValue(row, ['member', 'name', 'employee', 'user', 'team member']));
    const email = coerceString(pickValue(row, ['email', 'e mail', 'personal email', 'user email']));
    const timezone = coerceString(pickValue(row, ['time zone', 'timezone']));
    const project = coerceString(pickValue(row, ['project', 'project name']));
    const activity = coerceNumber(pickValue(row, ['activity', 'activity percentage', 'activity %']));

    return dateColumns
      .map((date) => {
        const elapsedMinutes = parseDurationToMinutes(row[date]);

        if (!elapsedMinutes) {
          return null;
        }

        return {
          date,
          name,
          email,
          project,
          jobTitle: '',
          jobType: '',
          employeeId: '',
          timezone,
          location: '',
          elapsedMinutes,
          activity,
          breakMinutes: 0,
          manualMinutes: 0,
          raw: row,
          importedAt: new Date(),
        } satisfies HubstaffEntry;
      })
      .filter((entry): entry is HubstaffEntry => Boolean(entry));
  });
}

function describeUnexpectedHubstaffResponse(csvText: string) {
  const sample = csvText.slice(0, 300).trimStart().toLowerCase();

  if (sample.startsWith('<!doctype') || sample.startsWith('<html')) {
    return 'Hubstaff returned HTML instead of CSV. The Hubstaff cookies in .env are probably expired or missing.';
  }

  if (sample.includes('<form') && sample.includes('login')) {
    return 'Hubstaff returned a login page instead of CSV. Refresh the Hubstaff cookies in .env.';
  }

  return null;
}

export function parseHubstaffCsv(csvText: string): HubstaffEntry[] {
  const unexpectedResponse = describeUnexpectedHubstaffResponse(csvText);
  if (unexpectedResponse) {
    throw new Error(unexpectedResponse);
  }

  const rows = parseRows(csvText);

  if (hasWideDailyColumns(rows)) {
    return parseWideDailyRows(rows);
  }

  return rows
    .map((row) => {
      const date = coerceString(pickValue(row, ['date', 'day', 'work date'])).slice(0, 10);
      const name = coerceString(pickValue(row, ['name', 'employee', 'user', 'team member']));
      const email = coerceString(pickValue(row, ['email', 'e mail', 'personal email', 'user email']));
      const project = coerceString(pickValue(row, ['project', 'project name']));
      const jobTitle = coerceString(pickValue(row, ['job title', 'title']));
      const jobType = coerceString(pickValue(row, ['job type', 'type']));
      const employeeId = coerceString(pickValue(row, ['employee id', 'id']));
      const timezone = coerceString(pickValue(row, ['timezone']));
      const location = coerceString(pickValue(row, ['location']));
      const elapsedMinutes = parseDurationToMinutes(pickValue(row, ['spent', 'time', 'duration', 'elapsed', 'total time', 'tracked time', 'tracked total']));
      const activity = coerceNumber(pickValue(row, ['activity', 'activity percentage']));
      const breakMinutes = parseDurationToMinutes(pickValue(row, ['break time', 'break', 'break minutes']));
      const manualMinutes = parseDurationToMinutes(pickValue(row, ['manual', 'manual time']));

      if (!date && !name && !email) {
        return null;
      }

      return {
        date,
        name,
        email,
        project,
        jobTitle,
        jobType,
        employeeId,
        timezone,
        location,
        elapsedMinutes,
        activity,
        breakMinutes,
        manualMinutes,
        raw: row,
        importedAt: new Date(),
      } satisfies HubstaffEntry;
    })
    .filter((entry): entry is HubstaffEntry => Boolean(entry));
}

export async function fetchHubstaffDailyCsv(from: string, to: string) {
  const resolved = await resolveHubstaffCredentialsWithSource();
  const firstAttempt = await fetchHubstaffCsvWithCredentials({
    from,
    to,
    credentials: resolved.credentials,
    rawCookieHeader: resolved.source === 'environment' ? getEnvironmentHubstaffCookieHeader() : '',
  });

  if (!firstAttempt.unexpectedResponse) {
    return firstAttempt.text;
  }

  if (resolved.source !== 'environment') {
    clearCredentialsCache();
    const fallbackAttempt = await fetchHubstaffCsvWithCredentials({
      from,
      to,
      credentials: getEnvironmentHubstaffCredentials(),
      rawCookieHeader: getEnvironmentHubstaffCookieHeader(),
    });

    if (!fallbackAttempt.unexpectedResponse) {
      return fallbackAttempt.text;
    }
  }

  const contentType = firstAttempt.response.headers.get('content-type') || 'unknown content type';
  throw new Error(`${firstAttempt.unexpectedResponse} Hubstaff responded with ${contentType} at ${firstAttempt.response.url}.`);
}

function pickMembersFromPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.members, record.users, record.data, record.results];
  const members = candidates.find(Array.isArray);
  return members || [];
}

export async function fetchHubstaffMembers() {
  const orgId = getHubstaffOrgId();
  const credentials = await resolveHubstaffCredentials();
  const members: unknown[] = [];
  let page = 1;

  while (page > 0) {
    const response = await fetch(buildMembersUrl(), {
      method: 'POST',
      headers: buildPostHeaders(credentials, `https://app.hubstaff.com/reports/${orgId}/team/members`),
      body: JSON.stringify({
        page,
        search: '',
        selected_only: false,
        selection: [],
        selection_type: 'select_all',
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Hubstaff members request failed with ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    members.push(...pickMembersFromPayload(payload));

    const pagination = payload.pagination as Record<string, unknown> | undefined;
    if (pagination?.last_page === true) {
      break;
    }

    const nextPage = Number(pagination?.next_page || 0);
    if (!nextPage || nextPage === page) {
      break;
    }

    page = nextPage;
  }

  return members;
}
