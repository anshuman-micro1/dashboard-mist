#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FROM = new Date().toISOString().slice(0, 10);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value.replace(/\\n/g, '\n');
  }

  return values;
}

function loadEnv() {
  const fileEnv = {
    ...parseEnvFile(path.join(ROOT, '.env')),
    ...parseEnvFile(path.join(ROOT, '.env.local')),
  };

  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const options = {
    from: process.env.REPORT_DATE_START || DEFAULT_FROM,
    to: process.env.REPORT_DATE_END || process.env.REPORT_DATE_START || DEFAULT_FROM,
    out: '',
    projectId: process.env.HUBSTAFF_PROJECT_ID || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--from' && next) {
      options.from = next;
      index += 1;
    } else if (arg === '--to' && next) {
      options.to = next;
      index += 1;
    } else if (arg === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (arg === '--project-id' && next) {
      options.projectId = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  validateDate(options.from, '--from');
  validateDate(options.to, '--to');
  return options;
}

function validateDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be in YYYY-MM-DD format. Received: ${value}`);
  }
}

function printHelp() {
  console.log(`
Fetch the raw Hubstaff daily report CSV and save it locally.

Usage:
  npm run hubstaff:csv -- --from 2026-07-01 --to 2026-07-15
  npm run hubstaff:csv -- --from 2026-07-01 --to 2026-07-15 --out ./hubstaff-exports/sample.csv

Environment:
  HUBSTAFF_ORG_ID             Required
  HUBSTAFF_COOKIE_HEADER      Preferred, copied from an authenticated Hubstaff browser request
  HUBSTAFF_PROJECT_ID         Optional default project filter

Fallback cookie pieces are also supported:
  HUBSTAFF_XSRF_TOKEN
  HUBSTAFF_SESSION
  HUBSTAFF_ACCOUNT_REFRESH
  HUBSTAFF_INGRESS_COOKIE
  HUBSTAFF_STRIPE_MID
`);
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function buildCookieHeader(orgId) {
  if (process.env.HUBSTAFF_COOKIE_HEADER) {
    return process.env.HUBSTAFF_COOKIE_HEADER;
  }

  const cookies = [
    `organization=${orgId}`,
    process.env.HUBSTAFF_STRIPE_MID && `__stripe_mid=${process.env.HUBSTAFF_STRIPE_MID}`,
    process.env.HUBSTAFF_INGRESS_COOKIE && `INGRESSCOOKIE=${process.env.HUBSTAFF_INGRESS_COOKIE}`,
    process.env.HUBSTAFF_XSRF_TOKEN && `XSRF-TOKEN=${process.env.HUBSTAFF_XSRF_TOKEN}`,
    process.env.HUBSTAFF_SESSION && `_hubstaff_session=${process.env.HUBSTAFF_SESSION}`,
    process.env.HUBSTAFF_ACCOUNT_REFRESH && `hubstaff_account_refresh=${process.env.HUBSTAFF_ACCOUNT_REFRESH}`,
  ].filter(Boolean);

  if (cookies.length === 1) {
    throw new Error('Missing Hubstaff cookies. Set HUBSTAFF_COOKIE_HEADER or the fallback cookie pieces.');
  }

  return cookies.join('; ');
}

function buildDailyReportUrl({ from, to, projectId }) {
  const orgId = requireEnv('HUBSTAFF_ORG_ID');
  const url = new URL(`https://app.hubstaff.com/reports/${orgId}/team/daily.csv`);

  url.searchParams.set('date', from);
  url.searchParams.set('date_end', to);
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

  if (projectId) {
    url.searchParams.append('filters[projects][]', projectId);
  }

  return url;
}

function looksLikeHtml(text) {
  const sample = text.slice(0, 300).trimStart().toLowerCase();
  return sample.startsWith('<!doctype') || sample.startsWith('<html') || sample.includes('<form');
}

function looksLikeCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  return firstLine.includes(',') || firstLine.includes('\t') || firstLine.includes(';');
}

function getOutputPath(options, bodyText, contentType) {
  if (options.out) {
    const resolved = path.resolve(ROOT, options.out);
    const statTarget = fs.existsSync(resolved) ? fs.statSync(resolved) : null;

    if (statTarget?.isDirectory()) {
      return path.join(resolved, defaultFileName(options, bodyText, contentType));
    }

    return resolved;
  }

  return path.join(ROOT, 'hubstaff-exports', defaultFileName(options, bodyText, contentType));
}

function defaultFileName({ from, to }, bodyText, contentType) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let extension = 'csv';

  if (looksLikeHtml(bodyText) || contentType.includes('html')) {
    extension = 'html';
  } else if (!looksLikeCsv(bodyText) && !contentType.includes('csv')) {
    extension = 'txt';
  }

  return `hubstaff-daily-${from}_to_${to}-${timestamp}.${extension}`;
}

async function main() {
  loadEnv();

  const options = parseArgs(process.argv.slice(2));
  const orgId = requireEnv('HUBSTAFF_ORG_ID');
  const url = buildDailyReportUrl(options);
  const referer = `https://app.hubstaff.com/reports/${orgId}/team/daily`;

  console.log(`Fetching Hubstaff daily CSV for ${options.from} to ${options.to}`);
  console.log(`URL: ${url.toString()}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
      Accept: 'text/csv,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: referer,
      Connection: 'keep-alive',
      DNT: '1',
      Cookie: buildCookieHeader(orgId),
    },
  });

  const bodyText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const outputPath = getOutputPath(options, bodyText, contentType);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, bodyText, 'utf8');

  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${contentType || 'unknown'}`);
  console.log(`Bytes saved: ${Buffer.byteLength(bodyText, 'utf8')}`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`First line: ${(bodyText.split(/\r?\n/, 1)[0] || '').slice(0, 240)}`);

  if (!response.ok) {
    process.exitCode = 1;
    console.error('Hubstaff returned a non-2xx response. The raw response was still saved for inspection.');
    return;
  }

  if (looksLikeHtml(bodyText)) {
    process.exitCode = 1;
    console.error('Hubstaff returned HTML instead of CSV. Your Hubstaff cookies are probably expired or incomplete.');
  } else if (!looksLikeCsv(bodyText)) {
    process.exitCode = 1;
    console.error('The response does not look like CSV. Inspect the saved file before importing it.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
