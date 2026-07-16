export function normalizeLabel(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function coerceString(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

export function coerceNumber(value: unknown) {
  const text = coerceString(value).replace(/,/g, '').replace(/\s*%$/, '');

  if (!text) {
    return 0;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function coerceBoolean(value: unknown) {
  const text = coerceString(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'checked'].includes(text);
}

export function parseDurationToMinutes(value: unknown) {
  const text = coerceString(value);

  if (!text) {
    return 0;
  }

  const normalized = text.replace(/\s+/g, '');

  if (normalized.includes(':')) {
    const parts = normalized.split(':').map((part) => Number(part));

    if (parts.length === 2 && parts.every(Number.isFinite)) {
      return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
    }
  }

  const hourMatch = normalized.match(/(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?/i);

  if (hourMatch && (hourMatch[1] || hourMatch[2] || hourMatch[3])) {
    const hours = Number(hourMatch[1] || 0);
    const minutes = Number(hourMatch[2] || 0);
    const seconds = Number(hourMatch[3] || 0);
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    return Math.round(numeric * 60);
  }

  return 0;
}

export function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return {
    totalHours: Number((safeMinutes / 60).toFixed(2)),
    short: `${hours}h ${String(remainder).padStart(2, '0')}m`,
    long: `${hours}h ${remainder}m`,
  };
}

export function startOfDayIso(value: string) {
  return `${value.slice(0, 10)}T00:00:00.000Z`;
}

export function endOfDayIso(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`;
}

export function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
