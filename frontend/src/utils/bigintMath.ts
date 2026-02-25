/**
 * Bigint math utilities to avoid Number conversion precision loss
 */

/**
 * Get absolute value of a bigint
 */
export function bigintAbs(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}

/**
 * Clamp a bigint to be non-negative (return 0 if negative)
 */
export function bigintMax0(value: bigint): bigint {
  return value > BigInt(0) ? value : BigInt(0);
}

/**
 * Clamp a bigint to be non-positive (return 0 if positive)
 */
export function bigintMin0(value: bigint): bigint {
  return value < BigInt(0) ? value : BigInt(0);
}

/**
 * Sum an array of bigints
 */
export function bigintSum(values: bigint[]): bigint {
  return values.reduce((sum, val) => sum + val, BigInt(0));
}

/**
 * Return the maximum of two bigints
 */
export function bigintMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * Return the minimum of two bigints
 */
export function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
