import { normalizeSearch } from '@/lib/parsers';

export function getExpertIdentityKey({
  personalEmail,
  expertEmail,
  name,
}: {
  personalEmail: string;
  expertEmail: string;
  name: string;
}) {
  const identity = expertEmail || personalEmail || name;
  return normalizeSearch(identity).replace(/[^a-z0-9@.]+/g, '');
}

export function getPossibleExpertIdentityKeys({
  personalEmail,
  expertEmail,
  name,
}: {
  personalEmail: string;
  expertEmail: string;
  name: string;
}) {
  return [...new Set([expertEmail, personalEmail, name].map((value) => normalizeSearch(value).replace(/[^a-z0-9@.]+/g, '')).filter(Boolean))];
}
