export const TRASH_STACK = 99;

export function hyeongPushWord(letterCount: number, dotCount: number): string {
  if (letterCount < 1) throw new Error(`Invalid letterCount: ${letterCount}`);
  if (dotCount < 0) throw new Error(`Invalid dotCount: ${dotCount}`);
  const word =
    letterCount === 1 ? "형" : `혀${"어".repeat(letterCount - 2)}엉`;
  return dotCount === 0 ? word : `${word}${".".repeat(dotCount)}`;
}

export function hyeongWord(
  op: "add" | "mul" | "neg" | "inv" | "swi",
  letterCount: number,
  dotCount: number,
): string {
  if (letterCount < 1) throw new Error(`Invalid letterCount: ${letterCount}`);
  if (dotCount < 0) throw new Error(`Invalid dotCount: ${dotCount}`);
  let word = "";
  if (letterCount === 1) {
    switch (op) {
      case "add":
        word = "항";
        break;
      case "mul":
        word = "핫";
        break;
      case "neg":
        word = "흣";
        break;
      case "inv":
        word = "흡";
        break;
      case "swi":
        word = "흑";
        break;
    }
  } else {
    const mid = op === "add" || op === "mul" ? "아" : "으";
    const start = op === "add" || op === "mul" ? "하" : "흐";
    const end =
      op === "add"
        ? "앙"
        : op === "mul"
          ? "앗"
          : op === "neg"
            ? "읏"
            : op === "inv"
              ? "읍"
              : "윽";
    word = `${start}${mid.repeat(letterCount - 2)}${end}`;
  }
  return dotCount === 0 ? word : `${word}${".".repeat(dotCount)}`;
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  if (x <= 0n) x = 1n;
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}

function bestFactorPair(n: number): [number, number] | null {
  if (n <= 0) return null;
  let bestA = 1;
  let bestB = n;
  let bestCost = 1 + n;
  const limit = Math.floor(Math.sqrt(n));
  for (let a = 2; a <= limit; a++) {
    if (n % a === 0) {
      const b = n / a;
      if (a + b < bestCost) {
        bestA = a;
        bestB = b;
        bestCost = a + b;
      }
    }
  }
  return bestCost <= 32 ? [bestA, bestB] : null;
}

/**
 * Emits commands that push `n` onto `targetStack` (assuming `currentStack === targetStack`),
 * OR if `directOutStack` is provided, consumes the generated value and pushes it directly to `directOutStack`
 * (staying on `currentStack`).
 */
export function encodePushNumberTo(
  n: bigint,
  currentStack = 3,
  directOutStack?: number,
  trashStack = TRASH_STACK,
): string {
  if (n === 0n) {
    if (directOutStack !== undefined && directOutStack !== currentStack) {
      return `형 ${hyeongWord("add", 1, directOutStack)}`;
    }
    return "형";
  }

  if (n < 0n) {
    const absCode = encodePushNumberTo(-n, currentStack, undefined, trashStack);
    if (directOutStack !== undefined && directOutStack !== currentStack) {
      return `${absCode} ${hyeongWord("neg", 1, trashStack)} ${hyeongWord("add", 1, directOutStack)}`;
    }
    return `${absCode} ${hyeongWord("neg", 1, trashStack)}`;
  }

  if (n <= 1024n) {
    const pair = bestFactorPair(Number(n));
    if (pair) {
      const pushCmd = hyeongPushWord(pair[0], pair[1]);
      if (directOutStack !== undefined && directOutStack !== currentStack) {
        return `${pushCmd} ${hyeongWord("add", 1, directOutStack)}`;
      }
      return pushCmd;
    }
  }

  const s = isqrt(n);
  const q = n / s;
  const r = n - q * s;
  const dest = directOutStack ?? currentStack;

  if (r === 0n) {
    return `${encodePushNumberTo(q, currentStack, undefined, trashStack)} ${encodePushNumberTo(
      s,
      currentStack,
      undefined,
      trashStack,
    )} ${hyeongWord("mul", 2, dest)}`;
  }

  return `${encodePushNumberTo(q, currentStack, undefined, trashStack)} ${encodePushNumberTo(
    s,
    currentStack,
    undefined,
    trashStack,
  )} ${hyeongWord("mul", 2, currentStack)} ${encodePushNumberTo(
    r,
    currentStack,
    undefined,
    trashStack,
  )} ${hyeongWord("add", 2, dest)}`;
}

export function encodeNumber(n: bigint): string {
  return encodePushNumberTo(n, 3);
}

/**
 * Emits commands (running on `currentStack`) that print `text` to stdout (stack 1).
 * If `withExit` is true and `text` is non-empty, prints the last character via `흑. 흣` to terminate cleanly.
 */
export function encodePrintText(
  text: string,
  currentStack = 3,
  withExit = false,
  trashStack = TRASH_STACK,
): string {
  const cps = Array.from(text, (ch) => BigInt(ch.codePointAt(0)!));
  if (cps.length === 0) return "";

  const parts: string[] = [];
  const limit = withExit ? cps.length - 1 : cps.length;
  for (let i = 0; i < limit; i++) {
    parts.push(encodePushNumberTo(cps[i], currentStack, 1, trashStack));
  }
  if (withExit) {
    const last = cps[cps.length - 1];
    parts.push(`${encodePushNumberTo(last, currentStack, undefined, trashStack)} 흑. 흣`);
  }
  return parts.join(" ");
}

/**
 * Encodes `text` as a standalone complete `혀엉...` program that outputs `text` and exits cleanly.
 */
export function encodeText(text: string): string {
  if (text.length === 0) return "";
  return encodePrintText(text, 3, true);
}
