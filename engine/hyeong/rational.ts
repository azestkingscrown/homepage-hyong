export interface Rational {
  readonly isNaN: boolean;
  readonly num: bigint;
  readonly den: bigint;
}

export const RATIONAL_NAN: Rational = { isNaN: true, num: 0n, den: 0n };
export const RATIONAL_ZERO: Rational = { isNaN: false, num: 0n, den: 1n };
export const RATIONAL_ONE: Rational = { isNaN: false, num: 1n, den: 1n };

const SMALL_INT_MIN = -16;
const SMALL_INT_MAX = 256;
const SMALL_INT_CACHE: Rational[] = Array.from(
  { length: SMALL_INT_MAX - SMALL_INT_MIN + 1 },
  (_, i) => {
    const v = BigInt(i + SMALL_INT_MIN);
    return { isNaN: false, num: v, den: 1n };
  },
);
SMALL_INT_CACHE[0 - SMALL_INT_MIN] = RATIONAL_ZERO;
SMALL_INT_CACHE[1 - SMALL_INT_MIN] = RATIONAL_ONE;

function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function fromInt(n: bigint | number): Rational {
  if (typeof n === "number") {
    if (n >= SMALL_INT_MIN && n <= SMALL_INT_MAX && Number.isInteger(n)) {
      return SMALL_INT_CACHE[n - SMALL_INT_MIN];
    }
    return { isNaN: false, num: BigInt(n), den: 1n };
  }
  if (n >= -16n && n <= 256n) {
    return SMALL_INT_CACHE[Number(n) - SMALL_INT_MIN];
  }
  return { isNaN: false, num: n, den: 1n };
}

export function makeRational(num: bigint, den: bigint): Rational {
  if (den === 0n) return RATIONAL_NAN;
  if (num === 0n) return RATIONAL_ZERO;
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (d === 1n) return { isNaN: false, num: n, den: 1n };
  const g = gcdBigInt(n, d);
  n /= g;
  d /= g;
  if (d === 1n && n === 1n) return RATIONAL_ONE;
  return { isNaN: false, num: n, den: d };
}

export function addR(a: Rational, b: Rational): Rational {
  if (a.isNaN || b.isNaN) return RATIONAL_NAN;
  if (a.den === 1n && b.den === 1n) {
    const sum = a.num + b.num;
    return sum === 0n ? RATIONAL_ZERO : { isNaN: false, num: sum, den: 1n };
  }
  return makeRational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function mulR(a: Rational, b: Rational): Rational {
  if (a.isNaN || b.isNaN) return RATIONAL_NAN;
  if (a.den === 1n && b.den === 1n) {
    const prod = a.num * b.num;
    return prod === 0n ? RATIONAL_ZERO : { isNaN: false, num: prod, den: 1n };
  }
  return makeRational(a.num * b.num, a.den * b.den);
}

export function negR(a: Rational): Rational {
  if (a.isNaN) return RATIONAL_NAN;
  if (a.num === 0n) return RATIONAL_ZERO;
  return { isNaN: false, num: -a.num, den: a.den };
}

export function invR(a: Rational): Rational {
  if (a.isNaN || a.num === 0n) return RATIONAL_NAN;
  if (a.num < 0n) {
    return { isNaN: false, num: -a.den, den: -a.num };
  }
  return { isNaN: false, num: a.den, den: a.num };
}

export function floorR(a: Rational): bigint {
  if (a.den === 1n) return a.num;
  if (a.num >= 0n) return a.num / a.den;
  return a.num / a.den - 1n;
}

export function ltIntR(a: Rational, n: bigint): boolean {
  if (a.isNaN) return false;
  if (a.den === 1n) return a.num < n;
  return a.num < n * a.den;
}

export function eqIntR(a: Rational, n: bigint): boolean {
  if (a.isNaN) return false;
  if (a.den === 1n) return a.num === n;
  return false;
}

export function formatRationalOutput(a: Rational): string {
  if (a.isNaN) return "너무 커엇...";
  const f = floorR(a);
  if (f < 0n) return (-f).toString(10);
  if (f > 0x10ffffn) return "\uFFFD";
  return String.fromCodePoint(Number(f));
}
