import { HyeongError } from "./error.ts";
import { parseHyeong } from "./parser.ts";
import type { HeartTree, HyeongCommand } from "./parser.ts";
import {
  RATIONAL_NAN,
  RATIONAL_ONE,
  RATIONAL_ZERO,
  addR,
  eqIntR,
  formatRationalOutput,
  fromInt,
  invR,
  ltIntR,
  mulR,
  negR,
} from "./rational.ts";
import type { Rational } from "./rational.ts";

export interface HyeongIO {
  write(text: string): void;
  stderr?(text: string): void;
  read(): number;
  maxSteps?: number;
}

export interface HyeongRunResult {
  exitCode: number;
  steps: number;
}

export function runHyeong(source: string, io: HyeongIO): HyeongRunResult {
  return new HyeongSession(io).run(source);
}

export class HyeongSession {
  private readonly io: HyeongIO;

  constructor(io: HyeongIO) {
    this.io = io;
  }

  run(source: string): HyeongRunResult {
    const commands = parseHyeong(source);
    return this.runCommands(commands);
  }

  runCommands(commands: readonly HyeongCommand[]): HyeongRunResult {
    if (commands.length === 0) {
      return { exitCode: 0, steps: 0 };
    }

    const stacks = new Map<number, Rational[]>();
    const getStack = (idx: number): Rational[] => {
      let s = stacks.get(idx);
      if (!s) {
        s = [];
        stacks.set(idx, s);
      }
      return s;
    };

    const register = new Map<number, Map<bigint, number>>();
    let lastJumpFrom: number | null = null;
    let currentStack = 3;
    let pc = 0;
    let exitCode: number | null = null;
    let steps = 0;
    const maxSteps = this.io.maxSteps ?? Number.POSITIVE_INFINITY;

    const pushTo = (idx: number, val: Rational): void => {
      if (idx === 1) {
        this.io.write(formatRationalOutput(val));
        return;
      }
      if (idx === 2) {
        const text = formatRationalOutput(val);
        if (this.io.stderr) this.io.stderr(text);
        else this.io.write(text);
        return;
      }
      getStack(idx).push(val);
    };

    const popOne = (): Rational | null => {
      if (currentStack === 1) {
        exitCode = 0;
        return null;
      }
      if (currentStack === 2) {
        exitCode = 1;
        return null;
      }
      const st = getStack(currentStack);
      if (st.length > 0) {
        return st.pop()!;
      }
      if (currentStack === 0) {
        const cp = this.io.read();
        return cp < 0 ? RATIONAL_NAN : fromInt(cp);
      }
      return RATIONAL_NAN;
    };

    const popMany = (count: number): Rational[] | null => {
      const out: Rational[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const v = popOne();
        if (v === null) return null;
        out[i] = v;
      }
      return out;
    };

    const advanceHeart = (chardot: bigint, tree: HeartTree): void => {
      let node = tree;
      while (exitCode === null) {
        switch (node.kind) {
          case "none": {
            pc = pc + 1 >= commands.length ? 0 : pc + 1;
            return;
          }
          case "heart": {
            let byChardot = register.get(node.heart);
            if (!byChardot) {
              byChardot = new Map<bigint, number>();
              register.set(node.heart, byChardot);
            }
            const target = byChardot.get(chardot);
            if (target !== undefined) {
              if (target === pc) {
                pc = pc + 1 >= commands.length ? 0 : pc + 1;
              } else {
                lastJumpFrom = pc;
                pc = target;
              }
            } else {
              byChardot.set(chardot, pc);
              pc = pc + 1 >= commands.length ? 0 : pc + 1;
            }
            return;
          }
          case "return": {
            if (lastJumpFrom !== null) {
              pc = lastJumpFrom;
            } else {
              pc = pc + 1 >= commands.length ? 0 : pc + 1;
            }
            return;
          }
          case "compare": {
            const x = popOne();
            if (x === null) return;
            node = !x.isNaN && ltIntR(x, chardot) ? node.left : node.right;
            break;
          }
          case "equal": {
            const x = popOne();
            if (x === null) return;
            node = !x.isNaN && eqIntR(x, chardot) ? node.left : node.right;
            break;
          }
        }
      }
    };

    while (exitCode === null) {
      if (steps >= maxSteps) {
        throw new HyeongError(`실행 스텝 제한(${maxSteps})을 초과했습니다.`);
      }
      steps++;

      const cmd = commands[pc];
      const k = cmd.letterCount;
      const d = cmd.dotCount;
      const chardot = BigInt(k) * BigInt(d);

      switch (cmd.op) {
        case "push": {
          pushTo(currentStack, fromInt(chardot));
          break;
        }
        case "add": {
          const vals = popMany(k);
          if (vals === null) break;
          let sum = RATIONAL_ZERO;
          for (let i = 0; i < vals.length; i++) {
            sum = addR(sum, vals[i]);
          }
          pushTo(d, sum);
          break;
        }
        case "mul": {
          const vals = popMany(k);
          if (vals === null) break;
          let prod = RATIONAL_ONE;
          for (let i = 0; i < vals.length; i++) {
            prod = mulR(prod, vals[i]);
          }
          pushTo(d, prod);
          break;
        }
        case "neg": {
          const vals = popMany(k);
          if (vals === null) break;
          let sum = RATIONAL_ZERO;
          for (let i = vals.length - 1; i >= 0; i--) {
            const negVal = negR(vals[i]);
            pushTo(currentStack, negVal);
            sum = addR(sum, negVal);
          }
          pushTo(d, sum);
          break;
        }
        case "inv": {
          const vals = popMany(k);
          if (vals === null) break;
          let prod = RATIONAL_ONE;
          for (let i = vals.length - 1; i >= 0; i--) {
            const invVal = invR(vals[i]);
            pushTo(currentStack, invVal);
            prod = mulR(prod, invVal);
          }
          pushTo(d, prod);
          break;
        }
        case "swi": {
          const val = popOne();
          if (val === null) break;
          for (let i = 0; i < k; i++) {
            pushTo(d, val);
          }
          pushTo(currentStack, val);
          currentStack = d;
          break;
        }
      }

      if (exitCode !== null) break;
      advanceHeart(chardot, cmd.heart);
    }

    return { exitCode, steps };
  }
}
