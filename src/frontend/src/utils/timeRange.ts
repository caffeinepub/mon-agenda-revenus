/**
 * Time range utilities for precise bigint nanosecond timestamp comparisons
 * Avoids Number conversion precision loss for Internet Computer Time values
 */

/**
 * Get the start of a month as nanosecond bigint timestamp
 */
export function getMonthStartNanos(year: number, month: number): bigint {
  const date = new Date(year, month - 1, 1, 0, 0, 0, 0);
  return BigInt(date.getTime()) * BigInt(1_000_000);
}

/**
 * Get the end of a month as nanosecond bigint timestamp (last millisecond)
 */
export function getMonthEndNanos(year: number, month: number): bigint {
  const date = new Date(year, month, 0, 23, 59, 59, 999);
  return BigInt(date.getTime()) * BigInt(1_000_000);
}

/**
 * Get current time as nanosecond bigint timestamp
 */
export function getNowNanos(): bigint {
  return BigInt(Date.now()) * BigInt(1_000_000);
}

/**
 * Check if a bigint timestamp is within a month range (inclusive start, exclusive end)
 */
export function isInMonth(timestamp: bigint, year: number, month: number): boolean {
  const start = getMonthStartNanos(year, month);
  const end = getMonthEndNanos(year, month);
  return timestamp >= start && timestamp <= end;
}

/**
 * Check if a bigint timestamp is in the past or present (not future)
 */
export function isNotFuture(timestamp: bigint): boolean {
  return timestamp <= getNowNanos();
}
