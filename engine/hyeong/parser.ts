export type HyeongOp = "push" | "add" | "mul" | "neg" | "inv" | "swi";

export type HeartTree =
  | { readonly kind: "none" }
  | { readonly kind: "heart"; readonly heart: number }
  | { readonly kind: "return" }
  | { readonly kind: "compare"; readonly left: HeartTree; readonly right: HeartTree }
  | { readonly kind: "equal"; readonly left: HeartTree; readonly right: HeartTree };

export interface HyeongCommand {
  readonly op: HyeongOp;
  readonly letterCount: number;
  readonly dotCount: number;
  readonly heart: HeartTree;
}

type InstStart = "maybePush" | "addMul" | "negInvSwi";

type HeartToken =
  | { readonly kind: "filled"; readonly codePoint: number }
  | { readonly kind: "empty" }
  | { readonly kind: "question" }
  | { readonly kind: "exclamation" };

type Token =
  | { readonly kind: "hangul" }
  | { readonly kind: "single"; readonly op: HyeongOp }
  | { readonly kind: "start"; readonly start: InstStart }
  | { readonly kind: "end"; readonly op: HyeongOp }
  | { readonly kind: "dot"; readonly count: number }
  | { readonly kind: "heart"; readonly heart: HeartToken };

type SemiCmd =
  | { readonly kind: "inst"; readonly op: HyeongOp; readonly letterCount: number }
  | { readonly kind: "dot"; readonly count: number }
  | { readonly kind: "heart"; readonly heart: HeartToken };

const U_GA = 0xac00;
const U_HIH = 0xd7a3;

const SINGLE_MAP = new Map<number, HyeongOp>([
  [0xd615, "push"], // 형
  [0xd56d, "add"],  // 항
  [0xd56b, "mul"],  // 핫
  [0xd763, "neg"],  // 흣
  [0xd761, "inv"],  // 흡
  [0xd751, "swi"],  // 흑
]);

const START_MAP = new Map<number, InstStart>([
  [0xd600, "maybePush"], // 혀
  [0xd558, "addMul"],    // 하
  [0xd750, "negInvSwi"], // 흐
]);

const END_MAP = new Map<number, HyeongOp>([
  [0xc5c9, "push"], // 엉
  [0xc559, "add"],  // 앙
  [0xc557, "mul"],  // 앗
  [0xc74f, "neg"],  // 읏
  [0xc74d, "inv"],  // 읍
  [0xc73d, "swi"],  // 윽
]);

const FILLED_HEARTS = new Set<number>(
  Array.from("♥❤💕💖💗💘💙💚💛💜💝", (ch) => ch.codePointAt(0)!),
);

function isMatchingEnd(start: InstStart, op: HyeongOp): boolean {
  if (start === "maybePush") return op === "push";
  if (start === "addMul") return op === "add" || op === "mul";
  return op === "neg" || op === "inv" || op === "swi";
}

function isHangulToken(t: Token): boolean {
  return t.kind === "hangul" || t.kind === "single" || t.kind === "start" || t.kind === "end";
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < source.length; ) {
    const cp = source.codePointAt(i)!;
    i += cp > 0xffff ? 2 : 1;

    if (cp >= U_GA && cp <= U_HIH) {
      const s = SINGLE_MAP.get(cp);
      if (s) {
        tokens.push({ kind: "single", op: s });
        continue;
      }
      const st = START_MAP.get(cp);
      if (st) {
        tokens.push({ kind: "start", start: st });
        continue;
      }
      const en = END_MAP.get(cp);
      if (en) {
        tokens.push({ kind: "end", op: en });
        continue;
      }
      tokens.push({ kind: "hangul" });
      continue;
    }

    if (cp === 0x2e) {
      tokens.push({ kind: "dot", count: 1 });
    } else if (cp === 0x2026 || cp === 0x22ef || cp === 0x22ee) {
      tokens.push({ kind: "dot", count: 3 });
    } else if (cp === 0x2661) {
      tokens.push({ kind: "heart", heart: { kind: "empty" } });
    } else if (cp === 0x3f) {
      tokens.push({ kind: "heart", heart: { kind: "question" } });
    } else if (cp === 0x21) {
      tokens.push({ kind: "heart", heart: { kind: "exclamation" } });
    } else if (FILLED_HEARTS.has(cp)) {
      tokens.push({ kind: "heart", heart: { kind: "filled", codePoint: cp } });
    }
  }
  return tokens;
}

const NO_HEART: HeartTree = { kind: "none" };
const RETURN_HEART: HeartTree = { kind: "return" };

function parseHeartLeaf(hearts: HeartToken[], start: number, end: number): HeartTree {
  if (start >= end) return NO_HEART;
  const first = hearts[start];
  if (first.kind === "filled") return { kind: "heart", heart: first.codePoint };
  if (first.kind === "empty") return RETURN_HEART;
  return NO_HEART;
}

function parseHeartEqual(hearts: HeartToken[], start: number, end: number): HeartTree {
  if (start >= end) return NO_HEART;
  for (let i = start; i < end; i++) {
    if (hearts[i].kind === "exclamation") {
      return {
        kind: "equal",
        left: parseHeartLeaf(hearts, start, i),
        right: parseHeartEqual(hearts, i + 1, end),
      };
    }
  }
  return parseHeartLeaf(hearts, start, end);
}

function parseHeartTree(hearts: HeartToken[], start = 0, end = hearts.length): HeartTree {
  if (start >= end) return NO_HEART;
  for (let i = start; i < end; i++) {
    if (hearts[i].kind === "question") {
      return {
        kind: "compare",
        left: parseHeartEqual(hearts, start, i),
        right: parseHeartTree(hearts, i + 1, end),
      };
    }
  }
  return parseHeartEqual(hearts, start, end);
}

export function parseHyeong(source: string): HyeongCommand[] {
  const tokens = tokenize(source);
  const semis: SemiCmd[] = [];

  for (let i = 0; i < tokens.length; ) {
    const tok = tokens[i];
    if (tok.kind === "single") {
      semis.push({ kind: "inst", op: tok.op, letterCount: 1 });
      i++;
    } else if (tok.kind === "start") {
      let foundEnd = -1;
      let endOp: HyeongOp = "push";
      let hangulCount = 0;
      for (let j = i + 1; j < tokens.length; j++) {
        const cur = tokens[j];
        if (cur.kind === "end" && isMatchingEnd(tok.start, cur.op)) {
          foundEnd = j;
          endOp = cur.op;
          break;
        }
        if (isHangulToken(cur)) hangulCount++;
      }
      if (foundEnd !== -1) {
        semis.push({ kind: "inst", op: endOp, letterCount: hangulCount + 2 });
        i = foundEnd + 1;
      } else {
        i++;
      }
    } else if (tok.kind === "dot") {
      semis.push({ kind: "dot", count: tok.count });
      i++;
    } else if (tok.kind === "heart") {
      semis.push({ kind: "heart", heart: tok.heart });
      i++;
    } else {
      i++;
    }
  }

  const commands: HyeongCommand[] = [];
  let curOp: HyeongOp | null = null;
  let curLetters = 0;
  let curDots = 0;
  let curHearts: HeartToken[] = [];
  let parseDot = false;

  const flush = () => {
    if (curOp === null) return;
    commands.push({
      op: curOp,
      letterCount: curLetters,
      dotCount: curDots,
      heart: parseHeartTree(curHearts),
    });
  };

  for (const s of semis) {
    if (s.kind === "inst") {
      flush();
      curOp = s.op;
      curLetters = s.letterCount;
      curDots = 0;
      curHearts = [];
      parseDot = true;
    } else if (s.kind === "dot") {
      if (parseDot && curOp !== null) {
        curDots += s.count;
      }
    } else if (s.kind === "heart") {
      if (curOp !== null) {
        parseDot = false;
        curHearts.push(s.heart);
      }
    }
  }
  flush();

  return commands;
}

const OP_KO: Record<HyeongOp, string> = {
  push: "형",
  add: "항",
  mul: "핫",
  neg: "흣",
  inv: "흡",
  swi: "흑",
};

export function formatHeartPrefix(tree: HeartTree): string {
  switch (tree.kind) {
    case "none":
      return "_";
    case "return":
      return "♡";
    case "heart":
      return String.fromCodePoint(tree.heart);
    case "compare":
      return `?${formatHeartPrefix(tree.left)}${formatHeartPrefix(tree.right)}`;
    case "equal":
      return `!${formatHeartPrefix(tree.left)}${formatHeartPrefix(tree.right)}`;
  }
}

export function formatCommandPrefix(cmd: HyeongCommand): string {
  const base = `${OP_KO[cmd.op]} ${cmd.letterCount} ${cmd.dotCount}`;
  return cmd.heart.kind === "none" ? base : `${base} ${formatHeartPrefix(cmd.heart)}`;
}
