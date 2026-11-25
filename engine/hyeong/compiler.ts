import { encodePrintText, encodePushNumberTo, hyeongPushWord, hyeongWord } from "./encode.ts";

/**
 * Stack layout used by HyeongProgramBuilder:
 *   0: stdin (spec)
 *   1: stdout (spec)
 *   2: stderr (spec)
 *   3: WORK (default expression & data stack)
 *   4: INIT_FLAG ([0] during Pass 1 registration, [9] during Normal Run)
 *   5: RET_STACK (call-site return IDs for reusable subroutines)
 *   6: RET_TMP (temporary stack for return-dispatch matching)
 *   7: SWAP_A (scratch stack for swap/popStackToWork)
 *   8: BRANCH_TMP (scratch stack for jump/branch evaluation)
 *   9: TRASH (discard sink + bottom sentinel 0; chardot base 9 * blockId)
 *   10: EXIT_FLAG ([0] before entry, [1] when ready to flush & exit)
 *   11: OUT_BUF (buffered stdout codepoints in push order)
 *   12: OUT_REV (reversed stdout buffer for printing)
 *   13: STDIN_BUF (preloaded stdin codepoints, first char on top, -1 sentinel at bottom)
 *   14: STDIN_TMP (preload scratch stack)
 *   15+: Allocated variable / string stacks
 */
export const STK_STDIN = 0;
export const STK_STDOUT = 1;
export const STK_STDERR = 2;
export const STK_WORK = 3;
export const STK_INIT = 4;
export const STK_RET = 5;
export const STK_RET_TMP = 6;
export const STK_SWAP = 7;
export const STK_BRANCH = 8;
export const STK_TRASH = 9;
export const STK_EXIT_FLAG = 10;
export const STK_OUT_BUF = 11;
export const STK_OUT_REV = 12;
export const STK_STDIN_BUF = 13;
export const STK_STDIN_TMP = 14;
export const STK_STREAM_TAIL = 15;

const HEART_BLOCK = "♥";

export class HyeongBlock {
  readonly id: number;
  readonly name: string;
  readonly lines: string[] = [];
  private readonly builder: HyeongProgramBuilder;

  constructor(builder: HyeongProgramBuilder, id: number, name: string) {
    this.builder = builder;
    this.id = id;
    this.name = name;
  }

  emit(code: string): this {
    if (code) this.lines.push(code);
    return this;
  }

  /** Push constant integer onto WORK (3). */
  pushInt(n: bigint | number): this {
    return this.emit(encodePushNumberTo(BigInt(n), STK_WORK, undefined, STK_TRASH));
  }

  /** Pop `count` items from WORK (3) into TRASH (9). */
  drop(count = 1): this {
    if (count <= 0) return this;
    return this.emit(hyeongWord("add", count, STK_TRASH));
  }

  /** Pop top of WORK (3) and push onto `stack`. */
  moveWorkToStack(stack: number): this {
    return this.emit(hyeongWord("add", 1, stack));
  }

  /** Pop top of `stack` (must be non-empty!) and push onto WORK (3). Assumes currently on WORK (3). */
  moveStackToWork(stack: number): this {
    this.emit(hyeongWord("swi", 1, stack));
    this.emit(hyeongWord("add", 1, STK_TRASH));
    this.emit(hyeongWord("add", 1, STK_WORK));
    this.emit(hyeongWord("swi", 1, STK_WORK));
    this.emit(hyeongWord("add", 1, STK_TRASH));
    return this;
  }

  /** Duplicate top of WORK (3): [..., x] -> [..., x, x]. */
  dup(): this {
    return this.emit(hyeongWord("swi", 1, STK_WORK));
  }

  /** Swap top two items on WORK (3): [..., a, b] -> [..., b, a]. */
  swap(): this {
    this.emit(hyeongWord("add", 1, STK_SWAP)); // 3:[a], 7:[0, b]
    this.emit(hyeongWord("add", 1, STK_BRANCH)); // 3:[], 8:[..., a]
    this.emit(hyeongWord("swi", 1, STK_SWAP));
    this.emit(hyeongWord("add", 1, STK_TRASH)); // 7:[0, b]
    this.emit(hyeongWord("add", 1, STK_WORK)); // 3:[b], 7:[0]
    this.emit(hyeongWord("swi", 1, STK_BRANCH));
    this.emit(hyeongWord("add", 1, STK_TRASH)); // 8:[..., a]
    this.emit(hyeongWord("add", 1, STK_WORK)); // 3:[b, a]
    this.emit(hyeongWord("swi", 1, STK_WORK));
    this.emit(hyeongWord("add", 1, STK_TRASH));
    return this;
  }

  /** Add top two on WORK (3): [..., a, b] -> [..., a + b]. */
  add(): this {
    return this.emit(hyeongWord("add", 2, STK_WORK));
  }

  /** Multiply top two on WORK (3): [..., a, b] -> [..., a * b]. */
  mul(): this {
    return this.emit(hyeongWord("mul", 2, STK_WORK));
  }

  /** Negate top of WORK (3): [..., x] -> [..., -x]. */
  neg(): this {
    return this.emit(hyeongWord("neg", 1, STK_TRASH));
  }

  /** Subtract top from second on WORK (3): [..., a, b] -> [..., a - b]. */
  sub(): this {
    this.neg();
    return this.add();
  }

  /** Reciprocal of top of WORK (3): [..., x] -> [..., 1/x]. */
  inv(): this {
    return this.emit(hyeongWord("inv", 1, STK_TRASH));
  }

  /** Buffer literal string into OUT_BUF (11) without altering WORK (3). */
  printLiteral(text: string): this {
    for (const ch of text) {
      const cp = BigInt(ch.codePointAt(0)!);
      this.emit(encodePushNumberTo(cp, STK_WORK, STK_OUT_BUF, STK_TRASH));
    }
    return this;
  }

  /** Pop top 1 char/number from WORK (3) and buffer into OUT_BUF (11). */
  printTopChar(): this {
    return this.emit(hyeongWord("add", 1, STK_OUT_BUF));
  }

  /** Read 1 Unicode codepoint from stdin (0) onto WORK (3) (pushes NaN at EOF). */
  readStdinChar(): this {
    this.emit(hyeongWord("swi", 1, STK_STDIN)); // 0:[..., workTop], cur=0
    this.emit(hyeongWord("add", 1, STK_TRASH)); // pop workTop off 0 -> 0 is unread stdin!
    this.emit(hyeongWord("add", 1, STK_WORK)); // pop 1 char from 0 (or NaN) -> push to WORK
    this.emit(hyeongWord("swi", 1, STK_WORK)); // move back to WORK (copies char to 0,Wait!)
    // CAREFUL!! Look at `swi(1, STK_WORK)` while on STK_STDIN (0)!!
    // `swi(1, 3)` POPS from STK_STDIN (0) (consuming a SECOND stdin char!), pushes it to 3 AND back to 0!
    // We MUST NOT pop a second char from STK_STDIN (0)!!
    throw new Error("readStdinChar must not switch from stack 0 via swi");
  }

  /** Push literal string onto `stack` with `-1` bottom sentinel and first char on top. */
  pushLiteralStringTo(stack: number, text: string): this {
    const cps = Array.from(text, (ch) => BigInt(ch.codePointAt(0)!));
    this.pushInt(-1).moveWorkToStack(stack);
    for (let i = cps.length - 1; i >= 0; i--) {
      this.pushInt(cps[i]).moveWorkToStack(stack);
    }
    return this;
  }

  /**
   * Unconditional jump to `target`.
   * During Pass 1 (INIT_FLAG = 0), falls through cleanly on STK_INIT (4) to the next block.
   */
  jump(target: HyeongBlock): this {
    // Switch to STK_INIT without changing WORK:
    this.emit(hyeongWord("swi", 1, STK_INIT));
    this.emit(hyeongWord("add", 1, STK_TRASH)); // 4:[flag]
    this.emit(hyeongWord("swi", 1, STK_BRANCH)); // 8:[..., flag], 4:[flag], cur=8
    this.emit(encodePushNumberTo(BigInt(target.id), STK_BRANCH, undefined, STK_TRASH));
    this.emit(hyeongWord("mul", 2, STK_BRANCH)); // 8:[..., flag * target.id]
    this.emit(`${hyeongWord("swi", target.id, STK_TRASH)}${HEART_BLOCK}!`);
    // Pass 1 fallthrough (on STK_TRASH): switch back to STK_INIT (4)
    this.emit(hyeongWord("swi", 1, STK_INIT));
    this.emit(hyeongWord("add", 1, STK_TRASH));
    return this;
  }

  /**
   * Conditional branch on top of WORK (3):
   *   - 'eq0': top == 0
   *   - 'lt0': top < 0 (and not NaN)
   *   - 'notNaN': !isNaN(top)
   * Pops `top` from WORK (3). Safe during Pass 1 (always falls through on STK_INIT).
   */
  branch(mode: "eq0" | "lt0" | "notNaN", trueTarget: HyeongBlock, falseTarget: HyeongBlock): this {
    const m = trueTarget.id;
    // Compute raw expression on WORK (3) and move to STK_BRANCH (8)
    if (mode === "eq0") {
      this.pushInt(m).add(); // top + m
      this.emit(hyeongWord("add", 1, STK_BRANCH)); // 8:[..., top+m]
      this.emit(hyeongWord("swi", 1, STK_INIT));
      this.emit(hyeongWord("add", 1, STK_TRASH)); // 4:[flag]
      this.emit(hyeongWord("swi", 1, STK_BRANCH)); // 8:[..., top+m, flag], cur=8
      this.emit(hyeongWord("mul", 2, STK_BRANCH)); // 8:[..., flag*(top+m)]
    } else if (mode === "notNaN") {
      this.pushInt(0).mul().pushInt(m).add(); // top*0 + m
      this.emit(hyeongWord("add", 1, STK_BRANCH));
      this.emit(hyeongWord("swi", 1, STK_INIT));
      this.emit(hyeongWord("add", 1, STK_TRASH));
      this.emit(hyeongWord("swi", 1, STK_BRANCH));
      this.emit(hyeongWord("mul", 2, STK_BRANCH));
    } else {
      // lt0: (9 - flag) * m + flag * (top + m)
      this.pushInt(m).add(); // top + m
      this.emit(hyeongWord("add", 1, STK_BRANCH)); // 8:[..., top+m]
      this.emit(hyeongWord("swi", 1, STK_INIT));
      this.emit(hyeongWord("add", 1, STK_TRASH)); // 4:[flag]
      this.emit(hyeongWord("swi", 1, STK_BRANCH)); // 8:[..., top+m, flag], cur=8
      this.emit(hyeongWord("swi", 1, STK_BRANCH)); // 8:[..., top+m, flag, flag]
      this.emit(hyeongWord("add", 1, STK_SWAP)); // 8:[..., top+m, flag], 7:[..., flag]
      this.emit(hyeongWord("mul", 2, STK_BRANCH)); // 8:[..., flag*(top+m)]
      // Compute (9 - flag) * m on STK_SWAP (7):
      this.emit(hyeongWord("swi", 1, STK_SWAP));
      this.emit(hyeongWord("add", 1, STK_TRASH)); // 7:[..., flag]
      this.emit(hyeongWord("neg", 1, STK_TRASH)); // 7:[..., -flag]
      this.emit(encodePushNumberTo(9n, STK_SWAP, undefined, STK_TRASH));
      this.emit(hyeongWord("add", 2, STK_SWAP)); // 7:[..., 9 - flag]
      this.emit(encodePushNumberTo(BigInt(m), STK_SWAP, undefined, STK_TRASH));
      this.emit(hyeongWord("mul", 2, STK_SWAP)); // 7:[..., (9-flag)*m]
      this.emit(hyeongWord("add", 1, STK_BRANCH)); // 8:[..., flag*(top+m), (9-flag)*m]
      this.emit(hyeongWord("swi", 1, STK_BRANCH));
      this.emit(hyeongWord("add", 1, STK_TRASH)); // cur=8
      this.emit(hyeongWord("add", 2, STK_BRANCH)); // 8:[..., combined]
    }

    const opSym = mode === "lt0" ? "?" : "!";
    this.emit(`${hyeongWord("swi", m, STK_TRASH)}${HEART_BLOCK}${opSym}`);

    // False / Pass 1 fallthrough (on STK_TRASH): return to WORK (3) to invoke jump(falseTarget)
    this.emit(hyeongWord("swi", 1, STK_WORK));
    this.emit(hyeongWord("add", 1, STK_TRASH));
    return this.jump(falseTarget);
  }

  /**
   * Call a multi-caller subroutine: pushes `wrapper.id` onto RET_STACK (5) and jumps to `sub.entry`.
   * Return block `retBlock` must be registered by the caller.
   */
  call(sub: HyeongSubroutine, retBlock: HyeongBlock): this {
    const caller = sub.registerCaller(retBlock);
    this.pushInt(caller.wrapper.id).moveWorkToStack(STK_RET);
    return this.jump(sub.entry);
  }

  /** Finish program execution: jump to MAIN_DISPATCH to flush OUT_BUF (11) to stdout (1) and exit. */
  exit(): this {
    return this.jump(this.builder.exitAnchor);
  }

  /** Flush OUT_BUF (11), then stream remaining unread stack 0 (stdin) directly to stdout (1) and exit. */
  exitStreamingStdin(): this {
    this.pushInt(1).moveWorkToStack(STK_STREAM_TAIL);
    return this.jump(this.builder.exitAnchor);
  }

  /** Buffer `ch` and exit cleanly. */
  exitWithChar(ch: string): this {
    this.printLiteral(ch);
    return this.exit();
  }

  /** Reference builder for helper creation */
  getBuilder(): HyeongProgramBuilder {
    return this.builder;
  }
}

export class HyeongSubroutine {
  readonly entry: HyeongBlock;
  readonly callers: { retId: number; retBlock: HyeongBlock; wrapper: HyeongBlock }[] = [];
  private readonly builder: HyeongProgramBuilder;

  constructor(builder: HyeongProgramBuilder, name: string) {
    this.builder = builder;
    this.entry = builder.block(`${name}:entry`);
  }

  registerCaller(retBlock: HyeongBlock): { retId: number; retBlock: HyeongBlock; wrapper: HyeongBlock } {
    const existing = this.callers.find((c) => c.retBlock === retBlock);
    if (existing) return existing;
    const retId = this.callers.length + 1;
    const wrapper = this.builder.block(`${this.entry.name}:ret_${retId}`);
    const entry = { retId, retBlock, wrapper };
    this.callers.push(entry);
    return entry;
  }

  /** Emits the return dispatcher block (`retBlock` of this subroutine). Call AFTER all call sites are registered. */
  emitReturnDispatcher(dispatchBlock: HyeongBlock): void {
    const C = this.callers.length;
    if (C === 0) {
      dispatchBlock.emit(hyeongWord("swi", 1, STK_INIT)).emit(hyeongWord("add", 1, STK_TRASH));
      return;
    }
    if (C === 1) {
      // Single caller: pop retId from RET_STACK and jump straight to retBlock!
      dispatchBlock.emit(hyeongWord("swi", 1, STK_RET));
      dispatchBlock.emit(hyeongWord("add", 1, STK_TRASH));
      dispatchBlock.emit(hyeongWord("add", 1, STK_TRASH)); // pop retId
      dispatchBlock.emit(hyeongWord("swi", 1, STK_WORK));
      dispatchBlock.emit(hyeongWord("add", 1, STK_TRASH));
      dispatchBlock.jump(this.callers[0].retBlock);
      return;
    }

    // Multi-caller: pop myRetId off STK_RET (5) into STK_RET_TMP (6) cleanly
    // Wait: during Pass 1, STK_RET is empty (NaN), so we guard with STK_INIT first!
    // Easiest: switch to STK_INIT (4). If flag == 0 (Pass 1), fall through on STK_INIT!
    // Wait: if we have a single `dispatchBody` block, `dispatchBlock.jump`? No, we can't jump forward to `dispatchBody` if `dispatchBody` isn't registered yet, so put `dispatchBody` BEFORE `dispatchBlock`!
    // Even simpler: compute on STK_RET directly! During Pass 1, STK_RET has [NaN], so `NaN == 9*j` is always FALSE!
    // Just make sure Pass 1 exits on STK_INIT at the end!
    const totalCopies = (C * (C + 3)) / 2;
    dispatchBlock.emit(hyeongWord("swi", 1, STK_RET));
    dispatchBlock.emit(hyeongWord("add", 1, STK_TRASH)); // cur=5, top=myRetId
    dispatchBlock.emit(hyeongWord("add", 1, STK_RET_TMP)); // pops myRetId to 6, 5 is now [..., outer]
    dispatchBlock.emit(hyeongWord("swi", 1, STK_RET_TMP)); // copies outer onto 6, cur=6
    dispatchBlock.emit(hyeongWord("add", 1, STK_TRASH)); // pops outer copy; 6 is [..., myRetId]
    dispatchBlock.emit(hyeongWord("swi", totalCopies, STK_RET_TMP)); // 6 has totalCopies+1 copies of myRetId

    let consumed = 0;
    for (let j = 1; j <= C; j++) {
      const caller = this.callers[j - 1];
      consumed += j + 1;
      const remOnTmp = totalCopies - consumed + 1;
      // wrapper cleans remaining copies on 6 and jumps to caller.retBlock:
      // Note: wrapper is entered via `(9 * wrapper.id, ♥)` on stack 6 (or Pass 1 on stack 4).
      // Since wrapper was already registered, normal entry from dispatcher arrives on STK_RET_TMP (6)!
      // Wait: standard block entry expects STK_INIT (4) or STK_TRASH (9) so `흑...` copies something harmless!
      // On STK_RET_TMP (6), `흑...` copies `myRetId` to WORK and pops it cleanly!
      if (remOnTmp > 0) {
        caller.wrapper.emit(hyeongWord("swi", 1, STK_RET_TMP));
        caller.wrapper.emit(hyeongWord("add", 1, STK_TRASH));
        caller.wrapper.emit(hyeongWord("add", remOnTmp, STK_TRASH));
        caller.wrapper.emit(hyeongWord("swi", 1, STK_WORK));
        caller.wrapper.emit(hyeongWord("add", 1, STK_TRASH));
      }
      caller.wrapper.jump(caller.retBlock);

      // In dispatchBlock: test `myRetId == 9 * j` (`add(j, STK_TRASH)!<wrapper>`)
      //Wait: `add(j, 9)!` has `chardot = 9 * j`, which jumps to `(9 * j, ♥)` — NOT `wrapper.id`!
      // Instead, test `myRetId == 9 * wrapper.id` by doing `swi(wrapper.id, 9)!♥`?
      // Remember `swi(wrapper.id, 9)` pushes `wrapper.id` copies to `9`, leaves 1 on `6`, and switches to `9`!
      // So if we do `add(1, 9)` first? No, `myRetId` is `9 * j`, not `9 * wrapper.id`!
      // Fix: make call-site push `wrapper.id * 9` instead of `j * 9`!!
      // Wait: if we push `wrapper.id * 9`, then `swi(wrapper.id, 9)!♥` tests `myRetId == 9 * wrapper.id` directly in 1 command!!
      // Let's trace `swi(wrapper.id, 9)!♥`!
      // If `6` has `C` copies of `myRetId` (no `totalCopies` formula needed — just `C` copies on `6`!):
      // Wait: `swi(wrapper.id, 9)` switches to `9` (`TRASH`)! If it DOESN'T jump, it's on `9`, so next check must switch back to `6` (`swi(1, 6)` + `add(1, 7)?` no `add(1, 9)`), pop the 1 copy left on `6` (`add(1, 9)`), and test the next `caller`!
      // Even better! If `myRetId` is `wrapper.id * 9`, and `6` has `C` copies (`swi(C, 6)`):
      // Wait: on `swi(wrapper.id, 9)!♥`, if it JUMPS to `wrapper`, `6` STILL had `C - 1` copies (actually `C` copies because `swi` pushed 1 back to `6`, so `add(C, 9)` in `wrapper` pops `C - j + 1` copies from `6`!).
    }
    throw new Error("Replaced below with wrapper.id * 9 logic");
  }
}

export class HyeongProgramBuilder {
  private nextId = 1;
  private maxStack = STK_STREAM_TAIL;
  private readonly blocks: HyeongBlock[] = [];
  private readonly subroutines: { sub: HyeongSubroutine; dispatch: HyeongBlock }[] = [];
  private preloadMaxLines: number | null = null;
  readonly entry: HyeongBlock;
  readonly exitAnchor: HyeongBlock;

  constructor(opts?: { preloadMaxLines?: number }) {
    this.preloadMaxLines = opts?.preloadMaxLines ?? null;
    // Reserve exitAnchor id (not in this.blocks; placed inside MAIN after DRAIN!)
    this.exitAnchor = new HyeongBlock(this, this.nextId++, "MAIN_EXIT");
    this.entry = this.block("MAIN_ENTRY");
  }

  allocStack(): number {
    this.maxStack++;
    return this.maxStack;
  }

  block(name: string): HyeongBlock {
    const id = this.nextId++;
    const b = new HyeongBlock(this, id, name);
    this.blocks.push(b);
    return b;
  }

  subroutine(name: string): { sub: HyeongSubroutine; ret: HyeongBlock } {
    const sub = new HyeongSubroutine(this, name);
    const ret = this.block(`${name}:ret`);
    this.subroutines.push({ sub, dispatch: ret });
    return { sub, ret };
  }

  /**
   * Pops 1 Unicode codepoint from preloaded STDIN_BUF (13) onto WORK (3).
   * Returns `-1` (or `NaN`) at EOF. Safe during Pass 1 (never touches stack 0!).
   */
  emitReadStdinChar(block: HyeongBlock): void {
    block.moveStackToWork(STK_STDIN_BUF);
  }

  /** Emits a `DRAIN(stack)` loop on `MAIN` (Normal Run, after Pass 1!). */
  emitDrainStack(target: HyeongBlock, stack: number): void {
    const HEART_DRAIN = "❤";
    const sWord = encodePushNumberTo(BigInt(stack), stack, undefined, STK_TRASH);
    target.emit(hyeongWord("swi", 1, stack));
    target.emit("형"); // dummy 0 so first loopTop pops 3 items cleanly
    target.emit(`${hyeongPushWord(1, stack)}${HEART_DRAIN}`); // loopTop: reg (stack, ❤), pushes `stack`
    target.emit(hyeongWord("add", 3, STK_TRASH)); // pops stackId, prevCopy/dummy, topItem
    target.emit(hyeongWord("swi", 1, stack)); // peeks next (or NaN)
    target.emit("형");
    target.emit(hyeongWord("mul", 2, stack));
    target.emit(sWord);
    target.emit(hyeongWord("add", 2, stack)); // `stack` (if finite) or `NaN`
    target.emit(`${hyeongWord("swi", 1, stack)}${HEART_DRAIN}!`);
    target.emit(hyeongWord("add", 2, STK_TRASH)); // clean 2 NaNs
    if (stack !== STK_WORK) {
      target.emit(hyeongWord("swi", 1, STK_WORK));
      target.emit(hyeongWord("add", 1, STK_TRASH));
    }
  }

  build(): string {
    const out: string[] = [];
    out.push(`# Generated Hyeong-lang v0.4.5 program`);
    out.push(
      `형 ${hyeongWord("add", 1, STK_INIT)} 형 ${hyeongWord("add", 1, STK_TRASH)} ${hyeongWord("swi", 1, STK_INIT)} ${hyeongWord("add", 1, STK_TRASH)}`,
    );

    for (const { sub, dispatch } of this.subroutines) {
      this.buildReturnDispatcher(sub, dispatch);
    }

    for (const b of this.blocks) {
      out.push(`# [B${b.id}] ${b.name}`);
      out.push(
        `${hyeongPushWord(b.id, STK_TRASH)}${HEART_BLOCK} ${hyeongWord("add", 1, STK_TRASH)} ${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`,
      );
      for (const line of b.lines) {
        out.push(line);
      }
    }

    out.push(`# [MAIN]`);
    out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`);

    // Drain all working stacks touched during Pass 1 (skip STK_TRASH=9, which is write-only sink)
    const drainBlock = new HyeongBlock(this, 0, "DRAIN");
    for (let s = STK_WORK; s <= this.maxStack; s++) {
      if (s === STK_TRASH) continue;
      this.emitDrainStack(drainBlock, s);
    }
    out.push(...drainBlock.lines);

    // Initialize runtime sentinels
    out.push(`${encodePushNumberTo(9n, STK_WORK, STK_INIT, STK_TRASH)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_RET)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_RET_TMP)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_SWAP)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_BRANCH)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_TRASH)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_STDIN)}`);
    out.push(`형`); // bottom sentinel 0 on STK_WORK (3)

    // Exit sentinel & output buffer sentinels:
    //   STK_EXIT_FLAG (10)   = [0]
    //   STK_OUT_BUF (11)     = [-1]
    //   STK_OUT_REV (12)     = [-1]
    //   STK_STDIN_BUF (13)   = [-1]
    //   STK_STDIN_TMP (14)   = [-1, -1]
    //   STK_STREAM_TAIL (15) = [0]
    out.push(`형 ${hyeongWord("add", 1, STK_EXIT_FLAG)}`);
    out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 1, STK_OUT_BUF)}`);
    out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 1, STK_OUT_REV)}`);
    out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 1, STK_STDIN_BUF)}`);
    out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 1, STK_STDIN_TMP)}`);
    out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 1, STK_STDIN_TMP)}`);
    out.push(`형 ${hyeongWord("add", 1, STK_STREAM_TAIL)}`);

    // PRELOAD_STDIN: read chars from stack 0 into STK_STDIN_TMP (14), optionally stopping after `preloadMaxLines` newlines
    const HEART_STDIN = "💘";
    out.push(`# [PRELOAD_STDIN]`);
    if (this.preloadMaxLines !== null) {
      // Push remaining line count on STK_BRANCH (8)
      out.push(`${encodePushNumberTo(BigInt(this.preloadMaxLines), STK_WORK, STK_BRANCH, STK_TRASH)}`);
    }
    out.push(`형`); // dummy 0 on WORK (3) popped on iter 0 of PRELOAD_TOP
    out.push(`${hyeongPushWord(1, STK_STDIN_TMP)}${HEART_STDIN} ${hyeongWord("add", 2, STK_TRASH)}`); // PRELOAD_TOP
    out.push(`${hyeongWord("swi", 1, STK_STDIN)} ${hyeongWord("add", 2, STK_TRASH)}`); // cur=0, pop work/tmp copy + [0]
    out.push(`${hyeongWord("add", 1, STK_STDIN_TMP)}`); // pop 1 char from 0 (or NaN on EOF) -> 14
    out.push(`형`); // push [0] back onto 0
    out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=14, top=ch_or_NaN
    if (this.preloadMaxLines !== null) {
      // Stop reading after `preloadMaxLines` newlines OR EOF (NaN).
      // 1. If !isNaN(ch) && ch != 10 -> inv(ch - 10) * 0 + 14 == 14 -> loop to PRELOAD_TOP!
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}`);
      out.push(`${encodePushNumberTo(10n, STK_STDIN_TMP, undefined, STK_TRASH)} ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 2, STK_STDIN_TMP)}`);
      out.push(`${hyeongWord("inv", 1, STK_TRASH)} 형 ${hyeongWord("mul", 2, STK_STDIN_TMP)} ${encodePushNumberTo(BigInt(STK_STDIN_TMP), STK_STDIN_TMP, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_STDIN_TMP)}`);
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}${HEART_STDIN}!`);
      out.push(`${hyeongWord("add", 1, STK_TRASH)}`); // pop leftover check val; 14:[..., ch_or_NaN]

      // 2. ch == 10 or ch == NaN: save ch to 7, decrement remLines on 8, compute (0*ch+1) * (inv(rem-1)*0 + 14)
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}`);
      out.push(`${hyeongWord("add", 1, STK_BRANCH)}`);
      out.push(`${hyeongWord("swi", 1, STK_BRANCH)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=8, [0, rem, ch]
      out.push(`${hyeongWord("add", 1, STK_SWAP)}`); // ch -> 7; 8:[0, rem]
      out.push(`형. ${hyeongWord("neg", 1, STK_TRASH)} ${hyeongWord("add", 2, STK_BRANCH)}`); // rem - 1
      out.push(`${hyeongWord("swi", 1, STK_BRANCH)}`); // [0, rem-1, rem-1]
      out.push(`${hyeongWord("inv", 1, STK_TRASH)} 형 ${hyeongWord("mul", 2, STK_BRANCH)} ${encodePushNumberTo(BigInt(STK_STDIN_TMP), STK_BRANCH, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_BRANCH)}`); // 14_or_NaN
      out.push(`${hyeongWord("swi", 1, STK_SWAP)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=7, [..., ch]
      out.push(`형 ${hyeongWord("mul", 2, STK_SWAP)} 형. ${hyeongWord("add", 2, STK_SWAP)}`); // 0*ch + 1
      out.push(`${hyeongWord("add", 1, STK_BRANCH)}`);
      out.push(`${hyeongWord("swi", 1, STK_BRANCH)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=8
      out.push(`${hyeongWord("mul", 2, STK_BRANCH)}`); // val = 14 (iff !NaN && rem-1 != 0) else NaN
      out.push(`${hyeongWord("add", 1, STK_STDIN_TMP)}`); // push val -> 14:[..., ch, val]
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=14, [..., ch, val]
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}${HEART_STDIN}!`); // if val == 14: jump PRELOAD_TOP (pops 2 -> keeps ch=10!)
      out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // fallthrough (EOF or rem==0): pop val and ch/NaN off 14!
    } else {
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}`);
      out.push(`형 ${hyeongWord("mul", 2, STK_STDIN_TMP)} ${encodePushNumberTo(BigInt(STK_STDIN_TMP), STK_STDIN_TMP, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_STDIN_TMP)}`);
      out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}${HEART_STDIN}!`); // if !isNaN: loop back to PRELOAD_TOP with cur=14!
      out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // pop 2 NaNs off 14 -> 14 is [-1, -1, c_0, ..., c_{n-1}]
    }

    // Reverse 14 -> 13 until -1:
    out.push(`형`); // dummy 0 on 14
    out.push(`${hyeongPushWord(1, STK_STDIN_TMP)}💝 ${hyeongWord("add", 2, STK_TRASH)}`); // REV_STDIN_TOP
    out.push(`${hyeongWord("add", 1, STK_STDIN_BUF)}`); // pop top of 14 -> 13
    out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}`); // peek nextTop on 14
    out.push(`${encodePushNumberTo(BigInt(STK_STDIN_TMP), STK_STDIN_TMP, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_STDIN_TMP)}`); // nextTop + 14 (< 14 iff nextTop < 0)
    out.push(`${hyeongWord("swi", 1, STK_STDIN_TMP)}?_💝`);
    out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // pop check val + bottom -1 off 14
    out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // back to WORK (3)

    // MAIN_DISPATCH (exitAnchor):
    //   1st visit (flag == 0): sets EXIT_FLAG = [0, 1] and jumps to entry!
    //   2nd visit (flag == 1 via exit()): falls through to FLUSH!
    const exitId = this.exitAnchor.id;
    out.push(`# [MAIN_DISPATCH]`);
    out.push(`${hyeongPushWord(exitId, STK_TRASH)}${HEART_BLOCK} ${hyeongWord("add", 1, STK_TRASH)}`);
    out.push(`${hyeongWord("swi", 1, STK_EXIT_FLAG)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=10, top=flag
    out.push(`${hyeongWord("add", 1, STK_RET_TMP)}`); // pop flag -> 6
    out.push(`형.`); // push 1 onto 10 so 10 has 1 on top for 2nd visit
    out.push(`${hyeongWord("swi", 1, STK_RET_TMP)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=6, top=flag
    out.push(`${hyeongWord("neg", 1, STK_TRASH)} 형. ${hyeongWord("add", 2, STK_RET_TMP)}`); // 1 - flag
    out.push(`${encodePushNumberTo(BigInt(this.entry.id * 9), STK_RET_TMP, undefined, STK_TRASH)} ${hyeongWord("mul", 2, STK_RET_TMP)}`);
    out.push(`${hyeongWord("swi", this.entry.id, STK_TRASH)}${HEART_BLOCK}!`);

    // FLUSH (reached only on 2nd visit to MAIN_DISPATCH, >= 2 buffered chars):
    const HEART_FLUSH_REV = "💕";
    const HEART_FLUSH_PRINT = "💖";
    out.push(`# [FLUSH_REVERSE]`);
    out.push(`${hyeongWord("swi", 1, STK_OUT_BUF)} ${hyeongWord("add", 1, STK_TRASH)}`);
    out.push(`형`); // dummy 0 popped on iter 0
    out.push(`${hyeongPushWord(1, STK_OUT_BUF)}${HEART_FLUSH_REV} ${hyeongWord("add", 2, STK_TRASH)}`);
    out.push(`${hyeongWord("add", 1, STK_OUT_REV)}`);
    out.push(`${hyeongWord("swi", 1, STK_OUT_BUF)}`);
    out.push(`${encodePushNumberTo(BigInt(STK_OUT_BUF), STK_OUT_BUF, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_OUT_BUF)}`);
    out.push(`${hyeongWord("swi", 1, STK_OUT_BUF)}?_${HEART_FLUSH_REV}`);
    out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // pop leftover check val + -1 off 11

    out.push(`# [FLUSH_PRINT]`);
    out.push(`${hyeongWord("swi", 1, STK_OUT_REV)} ${hyeongWord("add", 1, STK_TRASH)}`);
    out.push(`${hyeongWord("add", 1, STK_WORK)}`); // pop c_0 -> WORK (3)
    out.push(`형`); // dummy 0 popped on iter 0
    out.push(`${hyeongPushWord(1, STK_OUT_REV)}${HEART_FLUSH_PRINT} ${hyeongWord("add", 2, STK_TRASH)}`); // PRINT_LOOP
    out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=3
    out.push(`${hyeongWord("add", 1, STK_STDOUT)}`); // print prev char on WORK (3)
    out.push(`${hyeongWord("swi", 1, STK_OUT_REV)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=12
    out.push(`${hyeongWord("add", 1, STK_WORK)}`); // pop next char -> WORK (3)
    out.push(`${hyeongWord("swi", 1, STK_OUT_REV)}`); // peek nextTop on 12
    out.push(`${hyeongWord("neg", 1, STK_TRASH)} ${encodePushNumberTo(BigInt(STK_OUT_REV - 1), STK_OUT_REV, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_OUT_REV)}`); // -nextTop + 11 (< 12 iff nextTop >= 0)
    out.push(`${hyeongWord("swi", 1, STK_OUT_REV)}${HEART_FLUSH_PRINT}?`);
    out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // pop leftover check val + -1 off 12
    out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=3, top=last char
    if (this.preloadMaxLines === null) {
      out.push(`흑. 흣`);
    } else {
      // Precompute gate15 = inv(flag15) * 0 + 1 ONCE (NaN if 0, 1 if 1) onto STK_STREAM_TAIL
      out.push(`${hyeongWord("swi", 1, STK_STREAM_TAIL)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=15
      out.push(`${hyeongWord("inv", 1, STK_TRASH)} 형 ${hyeongWord("mul", 2, STK_STREAM_TAIL)} 형. ${hyeongWord("add", 2, STK_STREAM_TAIL)}`); // [0, 1_or_NaN]
      out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=3
      // Stream remaining unread stack 0 directly to stdout (1) if gate15 == 1
      out.push(`형`); // dummy 0 on WORK (3) popped on iter 0 of STREAM_TOP
      out.push(`${hyeongPushWord(1, STK_WORK)}💜 ${hyeongWord("add", 2, STK_TRASH)}`); // STREAM_TOP: cur=3, [0, prevChar]
      out.push(`${hyeongWord("add", 1, STK_STDOUT)}`); // print prevChar
      out.push(`${hyeongWord("swi", 1, STK_STDIN)} ${hyeongWord("add", 2, STK_TRASH)}`); // cur=0, pop [0] + 0-sentinel
      out.push(`${hyeongWord("add", 1, STK_WORK)}`); // pop ch (or NaN) -> WORK (3)
      out.push(`형`); // push [0] back to 0
      out.push(`${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // cur=3, [0, ch]
      out.push(`${hyeongWord("swi", 1, STK_STREAM_TAIL)} ${hyeongWord("add", 1, STK_TRASH)} ${hyeongWord("swi", 1, STK_STREAM_TAIL)} ${hyeongWord("add", 1, STK_WORK)} ${hyeongWord("swi", 1, STK_WORK)} ${hyeongWord("add", 1, STK_TRASH)}`); // copy gate15 -> 3
      out.push(`${hyeongWord("mul", 2, STK_WORK)}`); // [0, ch_or_NaN]
      out.push(`${hyeongWord("swi", 1, STK_WORK)} 형 ${hyeongWord("mul", 2, STK_WORK)} ${encodePushNumberTo(BigInt(STK_WORK), STK_WORK, undefined, STK_TRASH)} ${hyeongWord("add", 2, STK_WORK)}`); // [0, ch, 3_or_NaN]
      out.push(`${hyeongWord("swi", 1, STK_WORK)}💜!`); // if !isNaN: jumps to STREAM_TOP with [0, ch, 3]
      out.push(`${hyeongWord("add", 2, STK_TRASH)}`); // pop 2 NaNs off 3
      out.push(`${encodePushNumberTo(10n, STK_WORK, undefined, STK_TRASH)} 흑. 흣`);
    }

    return out.join("\n") + "\n";
  }

  private buildReturnDispatcher(sub: HyeongSubroutine, dispatch: HyeongBlock): void {
    const C = sub.callers.length;
    if (C === 0) {
      return;
    }
    if (C === 1) {
      // Pop myRetId off STK_RET (5) and jump to single caller
      dispatch.emit(hyeongWord("swi", 1, STK_RET));
      dispatch.emit(hyeongWord("add", 1, STK_TRASH)); // pop WORK-copy
      dispatch.emit(hyeongWord("add", 1, STK_TRASH)); // pop myRetId
      dispatch.emit(hyeongWord("swi", 1, STK_WORK));
      dispatch.emit(hyeongWord("add", 1, STK_TRASH));
      dispatch.jump(sub.callers[0].retBlock);
      return;
    }

    // Multi-caller: pop myRetId (wrapper.id) from STK_RET (5) into STK_RET_TMP (6),
    // then multiply by STK_INIT flag (0 in Pass 1 -> never matches; 9 in Normal Run -> 9 * wrapper.id).
    dispatch.emit(hyeongWord("swi", 1, STK_RET));
    dispatch.emit(hyeongWord("add", 1, STK_TRASH));
    dispatch.emit(hyeongWord("add", 1, STK_RET_TMP)); // myRetId -> 6
    dispatch.emit(hyeongWord("swi", 1, STK_INIT));
    dispatch.emit(hyeongWord("add", 1, STK_TRASH)); // cur=4, top=flag (0 or 9)
    dispatch.emit(hyeongWord("swi", 1, STK_RET_TMP)); // copies flag -> 6, cur=6
    dispatch.emit(hyeongWord("mul", 2, STK_RET_TMP)); // 6:[..., myRetId * flag]
    dispatch.emit(hyeongWord("swi", C, STK_RET_TMP)); // 6:[..., val x (C+1)]
    dispatch.emit(hyeongWord("add", 1, STK_TRASH)); // 6:[..., val x C]

    for (let j = 0; j < C; j++) {
      const caller = sub.callers[j];
      const remOnTmp = C - j; // includes the copy left on 6 by swi(wrapper.id, 9)!
      caller.wrapper.emit(hyeongWord("swi", 1, STK_RET_TMP));
      caller.wrapper.emit(hyeongWord("add", 1, STK_TRASH)); // pop entry-copy
      caller.wrapper.emit(hyeongWord("add", remOnTmp, STK_TRASH)); // clean remaining copies on 6
      caller.wrapper.emit(hyeongWord("swi", 1, STK_WORK));
      caller.wrapper.emit(hyeongWord("add", 1, STK_TRASH));
      caller.wrapper.jump(caller.retBlock);

      // Test `myRetId == 9 * wrapper.id` via `swi(wrapper.id, STK_TRASH)!♥`:
      // On 6: swi(wrapper.id, 9) pops 1 copy, pushes wrapper.id copies to 9, pushes 1 copy back to 6, moves to 9.
      // `!` pops 1 copy from 9 and compares == 9 * wrapper.id!
      // If match -> jumps to caller.wrapper!
      // If no match (or Pass 1 NaN) -> on 9: switch back to 6 (`swi(1, 6)` + `add(1, 9)` pops 9-copy), pop the 1 copy left on 6 (`add(1, 9)`).
      dispatch.emit(`${hyeongWord("swi", caller.wrapper.id, STK_TRASH)}${HEART_BLOCK}!`);
      dispatch.emit(hyeongWord("swi", 1, STK_RET_TMP));
      dispatch.emit(hyeongWord("add", 1, STK_TRASH));
      dispatch.emit(hyeongWord("add", 1, STK_TRASH));
    }

    // Pass 1 fallthrough: return to WORK (3) (note: jump expects STK_INIT? No, next block entry accepts STK_INIT or STK_TRASH, and dispatch finishes on STK_RET_TMP (6), so switch to STK_INIT (4))
    dispatch.emit(hyeongWord("swi", 1, STK_INIT));
    dispatch.emit(hyeongWord("add", 1, STK_TRASH));
  }
}
