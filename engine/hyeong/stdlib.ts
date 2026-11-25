import {
  HyeongBlock,
  HyeongProgramBuilder,
  HyeongSubroutine,
} from "./compiler.ts";

/**
 * Reusable string, I/O, math, and escaping helpers compiled into pure `hyeong` v0.4.5.
 * String representation on stack S: bottom sentinel `-1`, first char on TOP (`[-1, c_{n-1}, ..., c_0]`).
 */
export class HyeongStdlib {
  readonly b: HyeongProgramBuilder;
  readonly strArg: number;
  readonly patStk: number;
  private readonly patBackup: number;
  private readonly patCopyTmp: number;
  private readonly strTmp: number;
  private readonly containsTmp: number;
  private readonly mathA: number;
  private readonly mathB: number;
  private readonly mathP: number;
  private readonly mathQ: number;
  private readonly digitsStk: number;

  private subStrEq?: HyeongSubroutine;
  private subStartsWith?: HyeongSubroutine;
  private subContains?: HyeongSubroutine;
  private subDivMod?: HyeongSubroutine;
  private subPrintInt?: HyeongSubroutine;
  private subStrToInt?: HyeongSubroutine;
  private subPrintStrArg?: HyeongSubroutine;
  private subPrintStrArgJson?: HyeongSubroutine;
  private subPrintStrArgHtml?: HyeongSubroutine;

  constructor(b: HyeongProgramBuilder) {
    this.b = b;
    this.strArg = b.allocStack();
    this.patStk = b.allocStack();
    this.patBackup = b.allocStack();
    this.patCopyTmp = b.allocStack();
    this.strTmp = b.allocStack();
    this.containsTmp = b.allocStack();
    this.mathA = b.allocStack();
    this.mathB = b.allocStack();
    this.mathP = b.allocStack();
    this.mathQ = b.allocStack();
    this.digitsStk = b.allocStack();
  }

  /** Initialize all stdlib string/sentinel stacks with `-1` or `0` at bottom (call once in `b.entry`). */
  initStacks(block: HyeongBlock): void {
    for (const s of [
      this.strArg,
      this.patStk,
      this.patBackup,
      this.patCopyTmp,
      this.strTmp,
      this.containsTmp,
      this.digitsStk,
    ]) {
      block.pushInt(-1).moveWorkToStack(s);
    }
    for (const s of [this.mathA, this.mathB, this.mathP, this.mathQ]) {
      block.pushInt(0).moveWorkToStack(s);
    }
  }

  /** Drain `stack` until `-1` sentinel (or empty `NaN`) and leave `[-1]` on top. */
  emitClearStr(from: HyeongBlock, stack: number, next: HyeongBlock): void {
    const loop = this.b.block(`clear_${stack}`);
    const chkNeg = this.b.block(`clear_${stack}_neg`);
    const popCont = this.b.block(`clear_${stack}_pop`);
    const popContNan = this.b.block(`clear_${stack}_nan`);
    from.jump(loop);
    loop.moveStackToWork(stack).dup().branch("notNaN", chkNeg, popContNan);
    chkNeg.branch("lt0", popCont, loop);
    popContNan.drop(1).jump(popCont);
    popCont.pushInt(-1).moveWorkToStack(stack).jump(next);
  }

  /** Pop chars `>= 0` from `src` and push onto `dest` until `src` hits `-1` (leaving `-1` on `src`). */
  emitReverseStr(from: HyeongBlock, src: number, dest: number, next: HyeongBlock): void {
    const loop = this.b.block(`rev_${src}_${dest}`);
    const pushChar = this.b.block(`rev_${src}_${dest}_push`);
    const done = this.b.block(`rev_${src}_${dest}_done`);
    from.jump(loop);
    loop.moveStackToWork(src).dup().branch("lt0", done, pushChar);
    pushChar.moveWorkToStack(dest).jump(loop);
    done.drop(1).pushInt(-1).moveWorkToStack(src).jump(next);
  }

  /** Non-destructively copy `src` to `dest` (clears `dest` first; `tmp` must be `[-1]`). */
  emitCopyStr(from: HyeongBlock, src: number, dest: number, tmp: number, next: HyeongBlock): void {
    const step1 = this.b.block(`cp_${src}_${dest}_s1`);
    const step2 = this.b.block(`cp_${src}_${dest}_s2`);
    const loop2 = this.b.block(`cp_${src}_${dest}_l2`);
    const pushBoth = this.b.block(`cp_${src}_${dest}_pb`);
    const done = this.b.block(`cp_${src}_${dest}_done`);

    this.emitClearStr(from, dest, step1);
    this.emitReverseStr(step1, src, tmp, step2);
    step2.jump(loop2);
    loop2.moveStackToWork(tmp).dup().branch("lt0", done, pushBoth);
    pushBoth.dup().moveWorkToStack(src).moveWorkToStack(dest).jump(loop2);
    done.drop(1).pushInt(-1).moveWorkToStack(tmp).jump(next);
  }

  /** Move string from `src` to `dest` (clears `dest` first, leaves `src` as `[-1]`). */
  emitMoveStr(from: HyeongBlock, src: number, dest: number, next: HyeongBlock): void {
    const cleared = this.b.block(`mv_${src}_${dest}_clr`);
    const rev = this.b.block(`mv_${src}_${dest}_rev`);
    this.emitClearStr(from, dest, cleared);
    this.emitReverseStr(cleared, src, this.strTmp, rev);
    this.emitReverseStr(rev, this.strTmp, dest, next);
  }

  /** Read 1 line from STDIN_BUF (13) into `dest` (clears `dest` first; skips `\r`, stops on `\n` or EOF). */
  emitReadLine(from: HyeongBlock, dest: number, next: HyeongBlock): void {
    const cleared = this.b.block(`rl_${dest}_clr`);
    const loop = this.b.block(`rl_${dest}_loop`);
    const notEof = this.b.block(`rl_${dest}_neof`);
    const notNl = this.b.block(`rl_${dest}_nnl`);
    const skipCr = this.b.block(`rl_${dest}_cr`);
    const pushCh = this.b.block(`rl_${dest}_push`);
    const doneRead = this.b.block(`rl_${dest}_done`);

    this.emitClearStr(from, dest, cleared);
    cleared.jump(loop);

    this.b.emitReadStdinChar(loop);
    loop.dup().branch("lt0", doneRead, notEof);

    notEof.dup().pushInt(10).sub().branch("eq0", doneRead, notNl);
    notNl.dup().pushInt(13).sub().branch("eq0", skipCr, pushCh);
    skipCr.drop(1).jump(loop);
    pushCh.moveWorkToStack(this.strTmp).jump(loop);

    doneRead.drop(1);
    this.emitReverseStr(doneRead, this.strTmp, dest, next);
  }

  /** Skip 1 line from STDIN_BUF (13) up to `\n` or EOF. */
  emitSkipLine(from: HyeongBlock, next: HyeongBlock): void {
    const loop = this.b.block("skipline_loop");
    const notEof = this.b.block("skipline_neof");
    const done = this.b.block("skipline_done");
    from.jump(loop);
    this.b.emitReadStdinChar(loop);
    loop.dup().branch("lt0", done, notEof);
    notEof.pushInt(10).sub().branch("eq0", next, loop);
    done.drop(1).jump(next);
  }

  /** Stream all remaining bytes in STDIN_BUF (13) into OUT_BUF (11). */
  emitStreamStdinRest(from: HyeongBlock, next: HyeongBlock): void {
    const loop = this.b.block("stream_loop");
    const writeCh = this.b.block("stream_write");
    const done = this.b.block("stream_done");
    from.jump(loop);
    this.b.emitReadStdinChar(loop);
    loop.dup().branch("lt0", done, writeCh);
    writeCh.printTopChar().jump(loop);
    done.drop(1).jump(next);
  }

  /** Read all remaining bytes from STDIN_BUF (13) into `dest` (clears `dest` first). */
  emitReadAllTo(from: HyeongBlock, dest: number, next: HyeongBlock): void {
    const cleared = this.b.block(`ra_${dest}_clr`);
    const loop = this.b.block(`ra_${dest}_loop`);
    const pushCh = this.b.block(`ra_${dest}_push`);
    const doneRead = this.b.block(`ra_${dest}_done`);
    this.emitClearStr(from, dest, cleared);
    cleared.jump(loop);
    this.b.emitReadStdinChar(loop);
    loop.dup().branch("lt0", doneRead, pushCh);
    pushCh.moveWorkToStack(this.strTmp).jump(loop);
    doneRead.drop(1);
    this.emitReverseStr(doneRead, this.strTmp, dest, next);
  }

  /**
   * Consume next field from `src` up to `delimCode` (or `-1`) and write it to `dest` (clears `dest` first).
   * Consumes `delimCode` if encountered; leaves `-1` on `src` if end of `src` reached.
   */
  emitReadFieldUntil(
    from: HyeongBlock,
    src: number,
    delimCode: number,
    dest: number,
    next: HyeongBlock,
  ): void {
    const cleared = this.b.block(`rf_${src}_${dest}_clr`);
    const loop = this.b.block(`rf_${src}_${dest}_loop`);
    const notEnd = this.b.block(`rf_${src}_${dest}_nend`);
    const pushCh = this.b.block(`rf_${src}_${dest}_push`);
    const hitEnd = this.b.block(`rf_${src}_${dest}_end`);
    const hitDelim = this.b.block(`rf_${src}_${dest}_delim`);
    const rev = this.b.block(`rf_${src}_${dest}_rev`);

    this.emitClearStr(from, dest, cleared);
    cleared.jump(loop);

    loop.moveStackToWork(src).dup().branch("lt0", hitEnd, notEnd);
    notEnd.dup().pushInt(delimCode).sub().branch("eq0", hitDelim, pushCh);
    pushCh.moveWorkToStack(this.strTmp).jump(loop);

    hitEnd.drop(1).pushInt(-1).moveWorkToStack(src).jump(rev);
    hitDelim.drop(1).jump(rev);
    this.emitReverseStr(rev, this.strTmp, dest, next);
  }

  /** Non-destructively print `src` to OUT_BUF (11) in forward order. */
  emitPrintStr(from: HyeongBlock, src: number, next: HyeongBlock): void {
    const loop = this.b.block(`ps_${src}_l`);
    const out = this.b.block(`ps_${src}_o`);
    const restore = this.b.block(`ps_${src}_r`);
    from.jump(loop);
    loop.moveStackToWork(src).dup().branch("lt0", restore, out);
    out.dup().moveWorkToStack(this.strTmp).printTopChar().jump(loop);
    restore.drop(1).pushInt(-1).moveWorkToStack(src);
    this.emitReverseStr(restore, this.strTmp, src, next);
  }

  /** Non-destructively print `this.strArg` to OUT_BUF (11) using a shared subroutine. */
  printStrArg(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subPrintStrArg) {
      const { sub, ret } = this.b.subroutine("std:printStrArg");
      this.subPrintStrArg = sub;
      this.emitPrintStr(sub.entry, this.strArg, ret);
    }
    from.call(this.subPrintStrArg, next);
  }

  /** Non-destructively print `this.strArg` escaped for JSON strings to OUT_BUF (11). */
  printStrArgJson(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subPrintStrArgJson) {
      const { sub, ret } = this.b.subroutine("std:printStrArgJson");
      this.subPrintStrArgJson = sub;
      const loop = this.b.block("pjson_l");
      const chkQuote = this.b.block("pjson_q");
      const chkSlash = this.b.block("pjson_s");
      const chkNl = this.b.block("pjson_n");
      const chkCr = this.b.block("pjson_cr");
      const chkTab = this.b.block("pjson_t");
      const emitQ = this.b.block("pjson_eq");
      const emitS = this.b.block("pjson_es");
      const emitN = this.b.block("pjson_en");
      const emitCr = this.b.block("pjson_ecr");
      const emitT = this.b.block("pjson_et");
      const emitRaw = this.b.block("pjson_raw");
      const done = this.b.block("pjson_d");

      sub.entry.jump(loop);
      loop.moveStackToWork(this.strArg).dup().branch("lt0", done, chkQuote);

      chkQuote.dup().moveWorkToStack(this.strTmp); // save char to strTmp
      chkQuote.dup().pushInt(34).sub().branch("eq0", emitQ, chkSlash);
      emitQ.drop(1).printLiteral('\\"').jump(loop);

      chkSlash.dup().pushInt(92).sub().branch("eq0", emitS, chkNl);
      emitS.drop(1).printLiteral("\\\\").jump(loop);

      chkNl.dup().pushInt(10).sub().branch("eq0", emitN, chkCr);
      emitN.drop(1).printLiteral("\\n").jump(loop);

      chkCr.dup().pushInt(13).sub().branch("eq0", emitCr, chkTab);
      emitCr.drop(1).printLiteral("\\r").jump(loop);

      chkTab.dup().pushInt(9).sub().branch("eq0", emitT, emitRaw);
      emitT.drop(1).printLiteral("\\t").jump(loop);

      emitRaw.printTopChar().jump(loop);

      done.drop(1).pushInt(-1).moveWorkToStack(this.strArg);
      this.emitReverseStr(done, this.strTmp, this.strArg, ret);
    }
    from.call(this.subPrintStrArgJson, next);
  }

  /** Non-destructively print `this.strArg` escaped for HTML/SVG text to OUT_BUF (11). */
  printStrArgHtml(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subPrintStrArgHtml) {
      const { sub, ret } = this.b.subroutine("std:printStrArgHtml");
      this.subPrintStrArgHtml = sub;
      const loop = this.b.block("phtml_l");
      const chkAmp = this.b.block("phtml_a");
      const chkLt = this.b.block("phtml_lt");
      const chkGt = this.b.block("phtml_gt");
      const chkQuot = this.b.block("phtml_q");
      const chkApos = this.b.block("phtml_ap");
      const emitAmp = this.b.block("phtml_ea");
      const emitLt = this.b.block("phtml_elt");
      const emitGt = this.b.block("phtml_egt");
      const emitQuot = this.b.block("phtml_eq");
      const emitApos = this.b.block("phtml_eap");
      const emitRaw = this.b.block("phtml_raw");
      const done = this.b.block("phtml_d");

      sub.entry.jump(loop);
      loop.moveStackToWork(this.strArg).dup().branch("lt0", done, chkAmp);

      chkAmp.dup().moveWorkToStack(this.strTmp);
      chkAmp.dup().pushInt(38).sub().branch("eq0", emitAmp, chkLt);
      emitAmp.drop(1).printLiteral("&amp;").jump(loop);

      chkLt.dup().pushInt(60).sub().branch("eq0", emitLt, chkGt);
      emitLt.drop(1).printLiteral("&lt;").jump(loop);

      chkGt.dup().pushInt(62).sub().branch("eq0", emitGt, chkQuot);
      emitGt.drop(1).printLiteral("&gt;").jump(loop);

      chkQuot.dup().pushInt(34).sub().branch("eq0", emitQuot, chkApos);
      emitQuot.drop(1).printLiteral("&quot;").jump(loop);

      chkApos.dup().pushInt(39).sub().branch("eq0", emitApos, emitRaw);
      emitApos.drop(1).printLiteral("&#39;").jump(loop);

      emitRaw.printTopChar().jump(loop);

      done.drop(1).pushInt(-1).moveWorkToStack(this.strArg);
      this.emitReverseStr(done, this.strTmp, this.strArg, ret);
    }
    from.call(this.subPrintStrArgHtml, next);
  }

  private ensureStrEqSub(): HyeongSubroutine {
    if (this.subStrEq) return this.subStrEq;
    const { sub, ret } = this.b.subroutine("std:strEq");
    this.subStrEq = sub;
    const loop = this.b.block("streq_loop");
    const sEnded = this.b.block("streq_send");
    const sEndedFail = this.b.block("streq_send_f");
    const sMore = this.b.block("streq_smore");
    const cmp = this.b.block("streq_cmp");
    const failPatEnded = this.b.block("streq_f_patend");
    const failMismatch = this.b.block("streq_f_mis");
    const okRestore = this.b.block("streq_ok");
    const retTrue = this.b.block("streq_t");
    const retFalse = this.b.block("streq_f");

    sub.entry.jump(loop);
    loop.moveStackToWork(this.strArg).dup().branch("lt0", sEnded, sMore);

    sEnded.drop(1).pushInt(-1).moveWorkToStack(this.strArg);
    sEnded.moveStackToWork(this.patStk).branch("lt0", okRestore, sEndedFail);
    this.emitClearStr(sEndedFail, this.patStk, failMismatch);

    sMore.moveWorkToStack(this.strTmp);
    sMore.moveStackToWork(this.patStk).dup().branch("lt0", failPatEnded, cmp);

    failPatEnded.drop(1).pushInt(-1).moveWorkToStack(this.patStk).jump(failMismatch);

    cmp.moveStackToWork(this.strTmp).dup().moveWorkToStack(this.strTmp);
    cmp.sub().branch("eq0", loop, this.makeClearPatThen(failMismatch));

    this.emitReverseStr(okRestore, this.strTmp, this.strArg, retTrue);
    retTrue.pushInt(1).jump(ret);

    this.emitReverseStr(failMismatch, this.strTmp, this.strArg, retFalse);
    retFalse.pushInt(0).jump(ret);

    return sub;
  }

  private ensureStartsWithSub(): HyeongSubroutine {
    if (this.subStartsWith) return this.subStartsWith;
    const { sub, ret } = this.b.subroutine("std:startsWith");
    this.subStartsWith = sub;
    const loop = this.b.block("sw_loop");
    const patMore = this.b.block("sw_pmore");
    const sMore = this.b.block("sw_smore");
    const sEnded = this.b.block("sw_send");
    const okRestore = this.b.block("sw_ok");
    const failRestore = this.b.block("sw_fail");
    const retTrue = this.b.block("sw_t");
    const retFalse = this.b.block("sw_f");

    sub.entry.jump(loop);
    loop.moveStackToWork(this.patStk).dup().branch("lt0", okRestore, patMore);
    okRestore.drop(1).pushInt(-1).moveWorkToStack(this.patStk);
    this.emitReverseStr(okRestore, this.strTmp, this.strArg, retTrue);
    retTrue.pushInt(1).jump(ret);

    patMore.moveStackToWork(this.strArg).dup().branch("lt0", sEnded, sMore);
    sEnded.drop(1).drop(1).pushInt(-1).moveWorkToStack(this.strArg);
    this.emitClearStr(sEnded, this.patStk, failRestore);

    sMore.dup().moveWorkToStack(this.strTmp);
    sMore.sub().branch("eq0", loop, this.makeClearPatThen(failRestore));

    this.emitReverseStr(failRestore, this.strTmp, this.strArg, retFalse);
    retFalse.pushInt(0).jump(ret);

    return sub;
  }

  private ensureContainsSub(): HyeongSubroutine {
    if (this.subContains) return this.subContains;
    const swSub = this.ensureStartsWithSub();
    const { sub, ret } = this.b.subroutine("std:contains");
    this.subContains = sub;

    const loop = this.b.block("cnt_loop");
    const afterSw = this.b.block("cnt_after_sw");
    const adv = this.b.block("cnt_adv");
    const found = this.b.block("cnt_found");
    const notFound = this.b.block("cnt_notfound");
    const retTrue = this.b.block("cnt_t");
    const retFalse = this.b.block("cnt_f");

    // Copy patStk -> patBackup (note: clears patStk too)
    this.emitMoveStr(sub.entry, this.patStk, this.patBackup, loop);

    // Copy patBackup -> patStk and call startsWith
    this.emitCopyStr(loop, this.patBackup, this.patStk, this.patCopyTmp, afterSw);
    // Actually call startsWith from a helper block right after copy:
    const callSw = this.b.block("cnt_call_sw");
    const evalSw = this.b.block("cnt_eval_sw");
    // Re-wire: afterSw -> callSw? No, `emitCopyStr` already jumped to `afterSw`!
    // Let's have `afterSw` call `swSub` and resume at `evalSw`:
    afterSw.call(swSub, evalSw);
    evalSw.branch("eq0", adv, found);

    // Advance 1 char from strArg into containsTmp
    adv.moveStackToWork(this.strArg).dup().branch("lt0", notFound, callSw);
    callSw.moveWorkToStack(this.containsTmp).jump(loop);

    this.emitClearStr(found, this.patBackup, retTrue);
    this.emitReverseStr(retTrue, this.containsTmp, this.strArg, foundEnd(this.b, 1, ret));

    notFound.drop(1).pushInt(-1).moveWorkToStack(this.strArg);
    this.emitClearStr(notFound, this.patBackup, retFalse);
    this.emitReverseStr(retFalse, this.containsTmp, this.strArg, foundEnd(this.b, 0, ret));

    return sub;
  }

  /** Compare `strArg == literal`. Non-destructive on `strArg`; leaves `1` or `0` on WORK (3). */
  strEq(from: HyeongBlock, literal: string, next: HyeongBlock): void {
    const sub = this.ensureStrEqSub();
    from.pushLiteralStringTo(this.patStk, literal).call(sub, next);
  }

  /** Test `strArg.startsWith(literal)`. Non-destructive on `strArg`; leaves `1` or `0` on WORK (3). */
  strStartsWith(from: HyeongBlock, literal: string, next: HyeongBlock): void {
    const sub = this.ensureStartsWithSub();
    from.pushLiteralStringTo(this.patStk, literal).call(sub, next);
  }

  /** Test `strArg.contains(literal)`. Non-destructive on `strArg`; leaves `1` or `0` on WORK (3). */
  strContains(from: HyeongBlock, literal: string, next: HyeongBlock): void {
    const sub = this.ensureContainsSub();
    from.pushLiteralStringTo(this.patStk, literal).call(sub, next);
  }

  /**
   * Non-destructive integer division (`a >= 0`, `b >= 1`).
   * Input on WORK: `[..., a, b]`. Output on WORK: `[..., q, r]`.
   */
  divMod(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subDivMod) {
      const { sub, ret } = this.b.subroutine("std:divMod");
      this.subDivMod = sub;

      const dblLoop = this.b.block("dm_dbl");
      const dblStep = this.b.block("dm_dbl_step");
      const halveLoop = this.b.block("dm_halve");
      const checkSub = this.b.block("dm_chk");
      const doSub = this.b.block("dm_sub");
      const done = this.b.block("dm_done");

      // WORK has [..., a, b] -> store b in mathB, a in mathA, p=1 in mathP, q=0 in mathQ
      sub.entry.moveWorkToStack(this.mathB);
      sub.entry.moveWorkToStack(this.mathA);
      sub.entry.pushInt(1).moveWorkToStack(this.mathP);
      sub.entry.pushInt(0).moveWorkToStack(this.mathQ);
      sub.entry.jump(dblLoop);

      // Check a - b * p < 0 (if < 0 -> halveLoop, else -> dblStep)
      dblLoop.moveStackToWork(this.mathA).dup().moveWorkToStack(this.mathA);
      dblLoop.moveStackToWork(this.mathB).dup().moveWorkToStack(this.mathB);
      dblLoop.moveStackToWork(this.mathP).dup().moveWorkToStack(this.mathP);
      dblLoop.mul().sub().branch("lt0", halveLoop, dblStep);

      // p = p * 2
      dblStep.moveStackToWork(this.mathP).pushInt(2).mul().moveWorkToStack(this.mathP).jump(dblLoop);

      // halve: p = p * (1/2); if p < 1 -> done, else -> checkSub
      halveLoop.moveStackToWork(this.mathP).pushInt(2).inv().mul().dup().moveWorkToStack(this.mathP);
      halveLoop.pushInt(1).sub().branch("lt0", done, checkSub);

      // check a - b * p < 0
      checkSub.moveStackToWork(this.mathA).dup().moveWorkToStack(this.mathA);
      checkSub.moveStackToWork(this.mathB).dup().moveWorkToStack(this.mathB);
      checkSub.moveStackToWork(this.mathP).dup().moveWorkToStack(this.mathP);
      checkSub.mul().sub().branch("lt0", halveLoop, doSub);

      // a = a - b * p; q = q + p
      doSub.moveStackToWork(this.mathA);
      doSub.moveStackToWork(this.mathB).dup().moveWorkToStack(this.mathB);
      doSub.moveStackToWork(this.mathP).dup().moveWorkToStack(this.mathP);
      doSub.mul().sub().moveWorkToStack(this.mathA);
      doSub.moveStackToWork(this.mathQ).moveStackToWork(this.mathP).dup().moveWorkToStack(this.mathP);
      doSub.add().moveWorkToStack(this.mathQ).jump(halveLoop);

      // Return [q, r] on WORK (drop temp mathB, mathP)
      done.moveStackToWork(this.mathP).drop(1);
      done.moveStackToWork(this.mathB).drop(1);
      done.moveStackToWork(this.mathQ);
      done.moveStackToWork(this.mathA);
      done.jump(ret);
    }
    from.call(this.subDivMod, next);
  }

  /**
   * Print non-negative integer `n` (top of WORK) as decimal digits to OUT_BUF (11).
   * Pops `n` from WORK.
   */
  printInt(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subPrintInt) {
      const { sub, ret } = this.b.subroutine("std:printInt");
      this.subPrintInt = sub;

      const zeroCase = this.b.block("pi_zero");
      const loop = this.b.block("pi_loop");
      const afterDiv = this.b.block("pi_adiv");
      const checkDone = this.b.block("pi_chk");
      const emitDigits = this.b.block("pi_emit");
      const emitOne = this.b.block("pi_one");
      const done = this.b.block("pi_done");

      sub.entry.dup().branch("eq0", zeroCase, loop);
      zeroCase.drop(1).printLiteral("0").jump(ret);

      loop.pushInt(10);
      this.divMod(loop, afterDiv); // WORK:[..., q, r]
      afterDiv.pushInt(48).add().moveWorkToStack(this.digitsStk); // '0' + r
      afterDiv.dup().branch("eq0", checkDone, loop);

      checkDone.drop(1).jump(emitDigits);
      emitDigits.moveStackToWork(this.digitsStk).dup().branch("lt0", done, emitOne);
      emitOne.printTopChar().jump(emitDigits);
      done.drop(1).pushInt(-1).moveWorkToStack(this.digitsStk).jump(ret);
    }
    from.call(this.subPrintInt, next);
  }

  /**
   * Parse decimal digits from `this.strArg` (consumes `this.strArg`, leaves `[-1]`) -> pushes integer on WORK (3).
   * Stops on first non-digit and drains remaining chars of `strArg`.
   */
  strArgToInt(from: HyeongBlock, next: HyeongBlock): void {
    if (!this.subStrToInt) {
      const { sub, ret } = this.b.subroutine("std:strToInt");
      this.subStrToInt = sub;

      const loop = this.b.block("sti_loop");
      const checkLow = this.b.block("sti_low");
      const checkHigh = this.b.block("sti_high");
      const accStep = this.b.block("sti_acc");
      const nonDigit = this.b.block("sti_nondig");
      const endEof = this.b.block("sti_eof");
      const done = this.b.block("sti_done");

      // acc = 0 on WORK
      sub.entry.pushInt(0).jump(loop);

      loop.moveStackToWork(this.strArg).dup().branch("lt0", endEof, checkLow);
      checkLow.dup().pushInt(48).sub().branch("lt0", nonDigit, checkHigh);
      checkHigh.dup().pushInt(58).sub().branch("lt0", accStep, nonDigit);

      // WORK:[acc, ch] -> acc * 10 + (ch - 48)
      accStep.pushInt(48).sub();
      accStep.moveWorkToStack(this.mathA); // save digit
      accStep.pushInt(10).mul();
      accStep.moveStackToWork(this.mathA).add().jump(loop);

      nonDigit.drop(1);
      this.emitClearStr(nonDigit, this.strArg, done);
      endEof.drop(1).pushInt(-1).moveWorkToStack(this.strArg).jump(done);
      done.jump(ret);
    }
    from.call(this.subStrToInt, next);
  }

  private makeClearPatThen(next: HyeongBlock): HyeongBlock {
    const blk = this.b.block("pat_clean");
    const loop = this.b.block("pat_clean_l");
    const done = this.b.block("pat_clean_d");
    blk.jump(loop);
    loop.moveStackToWork(this.patStk).branch("lt0", done, loop);
    done.pushInt(-1).moveWorkToStack(this.patStk).jump(next);
    return blk;
  }
}

function foundEnd(b: HyeongProgramBuilder, val: number, ret: HyeongBlock): HyeongBlock {
  const blk = b.block(`cnt_ret_${val}`);
  blk.pushInt(val).jump(ret);
  return blk;
}
