import * as XLSX from 'xlsx';
import { coerceBoolean, coerceNumber, coerceString, normalizeLabel } from '@/lib/parsers';

export type ExpertRecord = {
  name: string;
  personalEmail: string;
  expertEmail: string;
  totalTasks: number;
  removedFromOnboardingChannel: boolean;
  status: string;
  sourceFile: string;
  updatedAt: Date;
  raw: Record<string, unknown>;
};

const fieldAliases = {
  name: ['name🤖', 'name'],
  personalEmail: ['personalemail🤖', 'personalemail', 'personal email'],
  expertEmail: ['expertemail🤖', 'expertemail', 'expert email'],
  totalTasks: [
    'totaltasks🤖',
    'totaltaskssubmitted🤖',
    'totaltasks',
    'total tasks',
    'total tasks submitted',
    'tasks submitted',
    'submitted tasks',
    'tasks',
  ],
  removedFromOnboardingChannel: [
    '❌removedfromonboardingchannel',
    'removedfromonboardingchannel',
    'removed from onboarding channel',
  ],
  status: ['status✏️', 'status'],
} as const;

function matchesAnyAlias(value: unknown, aliases: readonly string[]) {
  const normalized = normalizeLabel(coerceString(value));
  return aliases.some((alias) => normalized === normalizeLabel(alias));
}

function isHeaderRow(row: unknown[]) {
  const hasName = row.some((value) => matchesAnyAlias(value, fieldAliases.name));
  const hasIdentityColumn = [...fieldAliases.personalEmail, ...fieldAliases.expertEmail].some((alias) =>
    row.some((value) => normalizeLabel(coerceString(value)) === normalizeLabel(alias)),
  );
  const hasMetadataColumn = [...fieldAliases.totalTasks, ...fieldAliases.status].some((alias) =>
    row.some((value) => normalizeLabel(coerceString(value)) === normalizeLabel(alias)),
  );

  return hasName && (hasIdentityColumn || hasMetadataColumn);
}

function sheetToRows(sheet: XLSX.WorkSheet) {
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  const headerIndex = table.findIndex(isHeaderRow);

  if (headerIndex < 0) {
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  const headers = table[headerIndex].map((value) => coerceString(value));

  return table.slice(headerIndex + 1).map((values) => {
    const row: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      if (header) {
        row[header] = values[index] ?? '';
      }
    });

    return row;
  });
}

function pickValue(row: Record<string, unknown>, aliases: readonly string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeLabel(key), value] as const);
  const normalizedLookup = new Map(normalizedEntries);

  for (const alias of aliases) {
    const value = normalizedLookup.get(normalizeLabel(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
}

export function parseMasterSheet(buffer: ArrayBuffer, fileName: string): ExpertRecord[] {
  const lowerFileName = fileName.toLowerCase();
  let rows: Record<string, unknown>[] = [];

  if (lowerFileName.endsWith('.csv') || lowerFileName.endsWith('.tsv')) {
    const text = Buffer.from(buffer).toString('utf8');
    const workbook = XLSX.read(text, { type: 'string', raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = sheetToRows(sheet);
  } else {
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = sheetToRows(sheet);
  }

  return rows
    .map((row) => {
      const name = coerceString(pickValue(row, fieldAliases.name));
      const personalEmail = coerceString(pickValue(row, fieldAliases.personalEmail));
      const expertEmail = coerceString(pickValue(row, fieldAliases.expertEmail));
      const totalTasks = coerceNumber(pickValue(row, fieldAliases.totalTasks));
      const removedFromOnboardingChannel = coerceBoolean(pickValue(row, fieldAliases.removedFromOnboardingChannel));
      const status = coerceString(pickValue(row, fieldAliases.status));

      if (!name && !personalEmail && !expertEmail) {
        return null;
      }

      return {
        name,
        personalEmail,
        expertEmail,
        totalTasks,
        removedFromOnboardingChannel,
        status,
        sourceFile: fileName,
        updatedAt: new Date(),
        raw: row,
      } satisfies ExpertRecord;
    })
    .filter((record): record is ExpertRecord => Boolean(record));
}
