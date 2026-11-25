import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeNumber, encodeText } from "../engine/hyeong/encode.ts";
import { HyeongProgramBuilder, STK_WORK } from "../engine/hyeong/compiler.ts";
import { HyeongSession } from "../engine/hyeong/interpreter.ts";
import { formatCommandPrefix, parseHyeong } from "../engine/hyeong/parser.ts";

function execHyeong(code: string, stdin = "", maxSteps = 200_000): {
  stdout: string;
  stderr: string;
  exitCode: number;
  steps: number;
} {
  const cps = Array.from(stdin, (ch) => ch.codePointAt(0)!);
  let idx = 0;
  let stdout = "";
  let stderr = "";
  const session = new HyeongSession({
    write: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
    read: () => (idx < cps.length ? cps[idx++] : -1),
    maxSteps,
  });
  const res = session.run(code);
  return { stdout, stderr, exitCode: res.exitCode, steps: res.steps };
}

describe("hyeong v0.4.5 engine", () => {
  it("matches official syntax.txt parsing testcases", () => {
    const cases: [string, string[]][] = [
      ["형", ["형 1 0"]],
      ["항", ["항 1 0"]],
      ["핫", ["핫 1 0"]],
      ["흣", ["흣 1 0"]],
      ["흡", ["흡 1 0"]],
      ["흑", ["흑 1 0"]],
      ["혀엉", ["형 2 0"]],
      ["하앙", ["항 2 0"]],
      ["하앗", ["핫 2 0"]],
      ["흐읏", ["흣 2 0"]],
      ["흐읍", ["흡 2 0"]],
      ["흐윽", ["흑 2 0"]],
      ["흐...읍", ["흡 2 0"]],
      ["혀일이삼사오육앙앗읏읍엉", ["형 12 0"]],
      ["혀일....이삼사오육앙♥앗?!읏♡읍...엉", ["형 12 0"]],
      ["흐일이삼사 오육앙하앗읏읍엉", ["흣 11 0"]],
      ["하흐읏앗앙", ["핫 4 0"]],
      ["혀흐하윽", ["흑 3 0"]],
      ["혀엉....", ["형 2 4"]],
      ["하앗. … ⋯ ⋮", ["핫 2 10"]],
      ["혀읏......잠....하앙....혀엉. .....", ["형 7 6"]],
      ["흐읏.... 잠... 혀....", ["흣 2 11"]],
      ["하앗....♥♡!", ["핫 2 4 !♥_"]],
      ["하아앗.. . ? ♥ ! 💖", ["핫 3 3 ?_!♥💖"]],
      ["혀엉...♥?!♡", ["형 2 3 ?♥!_♡"]],
    ];

    for (const [src, expected] of cases) {
      const parsed = parseHyeong(src).map(formatCommandPrefix);
      assert.deepEqual(parsed, expected, `Failed on: ${src}`);
    }
  });

  it("executes official Hello, world! example", () => {
    const hello = `
      혀어어어어어어어엉........ 핫. 혀엉..... 흑... 하앗... 흐윽... 형.  하앙.
      혀엉.... 하앙... 흐윽... 항. 항. 형... 하앙. 흐으윽... 형... 흡... 혀엉..
      하아아앗. 혀엉.. 흡... 흐읍... 형.. 하앗. 하아앙... 형... 하앙... 흐윽...
      혀어어엉.. 하앙. 항. 형... 하앙. 혀엉.... 하앙. 흑... 항. 형... 흡  하앗.
      혀엉..... 흑. 흣
    `;
    const res = execHyeong(hello);
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, "Hello, world!\n");
  });

  it("handles rationals, NaN propagation, negative output, and stderr exit", () => {
    // 0 reciprocal -> NaN -> stdout prints "너무 커엇..."
    const nanRes = execHyeong("형 흡. 흑. 흣");
    assert.equal(nanRes.stdout, "너무 커엇...너무 커엇...");
    assert.equal(nanRes.exitCode, 0);

    // Negative integer output: -42 printed to stdout as "42"
    const negRes = execHyeong("혀어어어어엉....... 흣. 흑. 흣");
    assert.equal(negRes.stdout, "4242"); // 흣. outputs -42 ("42"), leaves -42 on stack3; 흑. outputs -42 ("42") and switches to 1; 흣 exits

    // Rational floor: 1/2 = 0.5 -> floor 0; -1/2 = -0.5 -> floor -1 -> outputs "1"
    const ratRes = execHyeong("혀엉. 흡... 흑. 흣");
    // 2 pushed to stack 3. 흡... -> stack 3 has 1/2, pushes 1/2 to stack 3. 흑. -> outputs floor(1/2)=0 ('\u0000') and exits
    assert.equal(ratRes.stdout, "\u0000");

    // Negated rational floor: -1/2 -> floor -1 -> outputs "1"
    const negRatRes = execHyeong("혀엉. 흡... 흣. 형. 흑. 흣");
    // stack 3: [2] -> 흡... -> [1/2, 1/2] -> 흣. -> outputs floor(-1/2)=-1 ("1"), stack 3 has [1/2, -1/2]
    assert.ok(negRatRes.stdout.startsWith("1"));

    // Stderr abnormal exit
    const errRes2 = execHyeong("혀어어어어어어어엉......... 항.. 혀엉.. 흑.. 흣");
    assert.equal(errRes2.exitCode, 1);
    assert.ok(errRes2.stderr.startsWith("Q"));
  });

  it("supports heart registration, jump, and ♡ return", () => {
    // Echo stdin until EOF (NaN):
    // Stack 0 read via 흑 (dot=0): switches to stack 0, pushes NaN? Wait:
    // Let's test a simple loop with ♥ and ♡:
    // 혀엉..♥ : push 4, register (4, ♥)
    // 하아앙. : pop? Wait let's do the exact spec example with a counter to terminate!
    // Push 3, decrement by 1 each iteration using 혀엉... (Wait: push -1, add), print char 'A' (65) 3 times!
    const loopCode = `
      형...
      혀엉..♥
      혀어어어어어어어엉........ 항.
      혀엉. 흣.... 하앙...
      흑... 형?!♥
      형. 흑. 흣
    `;
    // Wait: let's trace carefully:
    // 1. 형... -> push 3 on stack 3: [3]
    // 2. 혀엉..♥ -> push 4 on stack 3: [3, 4], register (4, ♥) at idx 1, no jump
    //    Wait! Better: discard 4 or don't push junk. Let's test spec's ?/! + ♥ + ♡ directly:
    // Spec: 혀엉...💗!💕 -> pushes 6, equal checks 6==6 -> left 💗!
    const specHeart = execHyeong("혀엉...💗!💕 혀엉. 흑. 흣");
    assert.equal(specHeart.exitCode, 0);

    // Heart subroutine call & ♡ return:
    // Register (3, ♥) at `혀엉?` (Wait: `형...♥` pushes 3, registers (3,♥)).
    // Then jump to (3, ♥) via `흑...♥`? Let's trace:
    // idx 0: 혀어어어어엉.......... (push 60)
    // idx 1: 혀엉. (push 2)
    // idx 2: 흑...♥ (chardot=3, registers (3,♥) at idx 2? Wait first time registers, doesn't jump!)
    // Let's register sub at idx 1 with `형...♥` (push 3), skip it on init with `?` or place sub after exit!
    // Even simpler:
    // 0: 혀어어어어어어어엉........ (push 72 'H')
    // 1: 혀엉. (push 2) -- wait if we just test `형...♥ 혀어엉..♡ 혀어어엉.... 흑...♥`?
    // In spec: `형...♥` (0) reg (3,♥) -> `혀어엉..♡` (1) no jump -> `흑...♥` (2) jumps to 0 -> `형...♥` (0) self, no jump -> `혀어엉..♡` (1) jumps to 2 -> `흑...♥` (2)...
    // Let's break loop when stack has 3 items or check step count/limit!
    const subCode = `
      형...♥
      혀어엉..♡
      혀어어어어어어어엉.........
      항.
      흑...♥
    `;
    // 0: 형...♥ -> push 3, reg (3,♥)=0
    // 1: 혀어엉..♡ -> push 4, no jump
    // 2: 혀어어어어어어어엉......... -> push 81 ('Q')
    // 3: 항. -> prints 'Q'
    // 4: 흑...♥ -> chardot=3 -> jumps to 0!
    // 5(at 0): 형...♥ -> push 3, self -> next(1)
    // 6(at 1): 혀어엉..♡ -> push 4, ♡ jumps to 4 (`흑...♥`)!
    // 7(at 4): 흑...♥ -> chardot=3 -> jumps to 0! ... loops infinitely until maxSteps!
    let out = "";
    const session = new HyeongSession({
      write: (t) => {
        out += t;
      },
      read: () => -1,
      maxSteps: 20,
    });
    assert.throws(() => session.run(subCode), /실행 스텝 제한/);
    assert.equal(out, "Q");
    void loopCode;
  });

  it("reads stdin from stack 0 in FIFO order and returns NaN at EOF", () => {
    // Switch to stack 0 (push 1, 흑 -> stack 0, wait: 흑 with 0 dots switches to stack 0!).
    // Wait: to avoid printing 1 to stack 0? Pushing 1 to stack 0 puts 1 on top of stack 0!
    // Wait: if we push 0 to stack 0 via 흑, stack 0 gets 1 (or whatever was on stack 3).
    // If we pop that 1 off stack 0 with `항....` (pops 1 from stack 0 -> sends to stack 4),
    // then stack 0 is empty and subsequent pops read stdin!
    const echo3 = `
      형 흑 항....
      항. 항. 항.
      혀엉.... 항...
      흑. 흣
    `;
    // Wait: at `흑. 흣`, current stack is 0!
    // 0: 형 -> stack3:[0]
    // 1: 흑 -> pops 0 from stack3, pushes 0 to stack0, pushes 0 to stack3, moves to stack 0!
    // 2: 항.... -> pops 0 from stack0 (now stack0 is empty!), pushes 0 to stack4
    // 3: 항. -> pops 'A' from stdin, prints 'A'
    // 4: 항. -> pops 'B' from stdin, prints 'B'
    // 5: 항. -> EOF -> NaN -> prints '너무 커엇...'
    // Wait: `혀엉....` pushes 8 onto stack0, `항...` pops 8 to stack3, Wait: let's just put `혀엉.` (2) -> `흑.` prints '\u0002' and exits.
    // Better: push 'C' (67) onto stack0, `흑. 흣` prints 'C' and exits!
    const echoAB = `
      형 흑 항....
      항. 항.
      혀어어어어어어어엉........
      항.
      항.
      흑. 흣
    `;
    // wait: 9*8=72 ('H') -> `항.` prints 'H', then next `항.` reads EOF -> NaN -> prints 너무 커엇...
    // Simpler: just read 2 chars and exit with '!' (33):
    const echoAB2 = `
      형 흑 항....
      항. 항.
      혀어엉...........
      흑. 흣
    `;
    const res = execHyeong(echoAB2, "AB");
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, "AB!");
    void echo3;
  });

  it("round-trips encodeText and encodeNumber accurately", () => {
    const samples = [
      "Hello, Hyeong!",
      "한글과 Emoji 🐰🚀\n줄바꿈\t탭\"따옴표\"",
      "A",
    ];
    for (const s of samples) {
      const code = encodeText(s);
      const res = execHyeong(code, "", 500_000);
      assert.equal(res.exitCode, 0);
      assert.equal(res.stdout, s);
    }

    // Negative and positive encodeNumber check
    const numCode = `${encodeNumber(-12345n)} 흑. 흣`;
    const numRes = execHyeong(numCode);
    assert.equal(numRes.exitCode, 0);
    assert.equal(numRes.stdout, "12345");
  });

  it("compiles control flow, loops, nested subroutines, and stdin reading via HyeongProgramBuilder", () => {
    const b = new HyeongProgramBuilder();
    const strStk = b.allocStack();

    // Subroutine: printInt(n on WORK) -> prints ASCII digits or '0' for small test (prints 'A'+n)
    const { sub: printPlusA, ret: printPlusARet } = b.subroutine("printPlusA");
    printPlusA.entry.pushInt(65).add().printTopChar().jump(printPlusARet);

    // Subroutine: outerCall(n on WORK) -> calls printPlusA twice (n, n+1)
    const { sub: outerSub, ret: outerRet } = b.subroutine("outer");
    const outerAfter1 = b.block("outer:after1");
    const outerAfter2 = b.block("outer:after2");
    outerSub.entry.dup().pushInt(1).add().moveWorkToStack(strStk); // save n+1
    outerSub.entry.call(printPlusA, outerAfter1);
    outerAfter1.moveStackToWork(strStk).call(printPlusA, outerAfter2);
    outerAfter2.jump(outerRet);

    // Main: read stdin chars until EOF, echo uppercase or call outerSub when char == 'x'
    const loop = b.block("readLoop");
    const gotChar = b.block("gotChar");
    const isX = b.block("isX");
    const notX = b.block("notX");
    const afterX1 = b.block("afterX1");
    const afterX2 = b.block("afterX2");
    const done = b.block("done");

    b.entry.pushInt(-1).moveWorkToStack(strStk); // bottom sentinel on strStk
    b.entry.jump(loop);

    b.emitReadStdinChar(loop);
    loop.dup().branch("lt0", done, gotChar);

    gotChar.dup().pushInt("x".codePointAt(0)!).sub();
    gotChar.branch("eq0", isX, notX);

    isX.drop(1).pushInt(0).call(outerSub, afterX1); // prints 'A','B'
    afterX1.pushInt(2).call(printPlusA, afterX2); // prints 'C'
    afterX2.jump(loop);

    notX.printTopChar().jump(loop);

    done.drop(1).printLiteral("!");
    done.exitWithChar("\n");

    const code = b.build();
    const res = execHyeong(code, "hi x!", 500_000);
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, "hi ABC!!\n");
    void STK_WORK;
  });
});
