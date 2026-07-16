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
  totalTasks: ['totaltasks🤖', 'totaltasks', 'total tasks'],
  removedFromOnboardingChannel: [
    '❌removedfromonboardingchannel',
    'removedfromonboardingchannel',
    'removed from onboarding channel',
  ],
  status: ['status✏️', 'status'],
} as const;

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
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  } else {
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
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
