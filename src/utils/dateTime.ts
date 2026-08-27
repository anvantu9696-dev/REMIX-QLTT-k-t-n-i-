/**
 * Utilities for parsing, converting and synchronizing server and local timestamps with real-time.
 */

/**
 * Parses any server timestamp (SQLite CURRENT_TIMESTAMP, ISO-8601, timestamp number)
 * ensuring UTC timestamps from SQLite ('YYYY-MM-DD HH:MM:SS') are correctly converted
 * to the browser's local timezone (e.g. GMT+7 Vietnam).
 */
export function parseServerDate(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = String(dateInput).trim();
  if (!str) return null;

  // Handle SQLite standard CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS.SSS"
  // SQLite CURRENT_TIMESTAMP is stored in UTC, so append 'Z' if no timezone is specified
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str = str + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date to full date and time string in Vietnamese locale: "14:35:20 18/08/2026"
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  includeSeconds = true
): string {
  const d = parseServerDate(dateInput);
  if (!d) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (includeSeconds) {
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
  }
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

/**
 * Format date only: "18/08/2026"
 */
export function formatDate(dateInput: string | number | Date | null | undefined): string {
  const d = parseServerDate(dateInput);
  if (!d) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format time only: "14:35:20"
 */
export function formatTime(
  dateInput: string | number | Date | null | undefined,
  includeSeconds = true
): string {
  const d = parseServerDate(dateInput);
  if (!d) return '—';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

/**
 * Humanized relative time relative to real-time ("vừa xong", "5 phút trước", "Hôm nay 14:30", v.v.)
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  const d = parseServerDate(dateInput);
  if (!d) return '—';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Future dates
  if (diffSec < -10) {
    return formatDateTime(d, false);
  }

  if (diffSec < 15) {
    return 'Vừa xong';
  }
  if (diffSec < 60) {
    return `${diffSec} giây trước`;
  }
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }
  if (diffHour < 24) {
    const isSameDay = now.getDate() === d.getDate() && now.getMonth() === d.getMonth() && now.getFullYear() === d.getFullYear();
    if (isSameDay) {
      return `Hôm nay, ${formatTime(d, false)}`;
    }
    return `${diffHour} giờ trước`;
  }
  if (diffDay === 1) {
    return `Hôm qua, ${formatTime(d, false)}`;
  }
  if (diffDay < 7) {
    return `${diffDay} ngày trước`;
  }

  return formatDateTime(d, false);
}

/**
 * Structured log timestamp information
 */
export function formatLogTimestamp(dateInput: string | number | Date | null | undefined) {
  const d = parseServerDate(dateInput);
  return {
    full: formatDateTime(d, true),
    short: formatDateTime(d, false),
    relative: formatRelativeTime(d),
    date: formatDate(d),
    time: formatTime(d, true)
  };
}
