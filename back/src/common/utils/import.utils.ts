export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseExcelTime(value: string | number | Date | null) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      String(value.getHours()).padStart(2, '0'),
      String(value.getMinutes()).padStart(2, '0'),
      String(value.getSeconds()).padStart(2, '0'),
    ].join(':');
  }

  if (typeof value === 'number') {
    return parseNumericExcelTime(value);
  }

  const cleaned = String(value).trim();
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned
    .replace(/[hH]/g, ':')
    .replace(/\./g, ':')
    .replace(/\s+/g, '');

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(normalized)) {
    return normalized.length === 5 ? `${normalized}:00` : normalized;
  }

  if (/^\d{3,4}$/.test(normalized)) {
    const padded = normalized.padStart(4, '0');
    const hours = Number(padded.slice(0, 2));
    const minutes = Number(padded.slice(2, 4));
    return formatTimeParts(hours, minutes, 0);
  }

  const numeric = Number(normalized.replace(',', '.'));
  if (!Number.isNaN(numeric)) {
    return parseNumericExcelTime(numeric);
  }

  return null;
}

export function buildIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidCalendarDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function parseNumericExcelTime(numeric: number) {
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric >= 0 && numeric < 1) {
    const totalSeconds = Math.round(numeric * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return formatTimeParts(hours, minutes, seconds);
  }

  if (numeric >= 0 && numeric <= 24) {
    const hours = Math.floor(numeric);
    const minutes = Math.round((numeric - hours) * 60);
    return formatTimeParts(hours, minutes, 0);
  }

  const fraction = numeric % 1;
  if (fraction > 0) {
    return parseNumericExcelTime(fraction);
  }

  return null;
}

function formatTimeParts(hours: number, minutes: number, seconds: number) {
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}
