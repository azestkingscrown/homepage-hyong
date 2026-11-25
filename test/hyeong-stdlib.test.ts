import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HyeongProgramBuilder } from "../engine/hyeong/compiler.ts";
import { HyeongSession } from "../engine/hyeong/interpreter.ts";
import { HyeongStdlib } from "../engine/hyeong/stdlib.ts";

function runCompiled(b: HyeongProgramBuilder, stdin = ""): string {
  const code = b.build();
  const cps = Array.from(stdin, (c) => c.codePointAt(0)!);
  let idx = 0;
  let out = "";
  const res = new HyeongSession({
    write: (t) => {
      out += t;
    },
    read: () => (idx < cps.length ? cps[idx++] : -1),
    maxSteps: 1_000_000,
  }).run(code);
  assert.equal(res.exitCode, 0);
  return out;
}

describe("HyeongStdlib compiled subroutines", () => {
  it("supports readLine, strEq, strStartsWith, strContains, printStrArg", () => {
    const b = new HyeongProgramBuilder();
    const std = new HyeongStdlib(b);
    const s1 = b.block("s1");
    const s2 = b.block("s2");
    const s2b = b.block("s2b");
    const s3 = b.block("s3");
    const s3b = b.block("s3b");
    const s4 = b.block("s4");
    const s4b = b.block("s4b");
    const s5 = b.block("s5");
    const s5b = b.block("s5b");
    const s6 = b.block("s6");

    std.initStacks(b.entry);
    std.emitReadLine(b.entry, std.strArg, s1);

    // strEq("hello/world") -> 1
    std.strEq(s1, "hello/world", s2);
    s2.pushInt(48).add().printTopChar().printLiteral(",");
    std.strEq(s2, "hello", s2b);
    s2b.pushInt(48).add().printTopChar().printLiteral(",");

    // strStartsWith("hello/") -> 1
    std.strStartsWith(s2b, "hello/", s3);
    s3.pushInt(48).add().printTopChar().printLiteral(",");
    std.strStartsWith(s3, "world", s3b);
    s3b.pushInt(48).add().printTopChar().printLiteral(",");

    // strContains("lo/wo") -> 1, strContains("xyz") -> 0
    std.strContains(s3b, "lo/wo", s4);
    s4.pushInt(48).add().printTopChar().printLiteral(",");
    std.strContains(s4, "xyz", s4b);
    s4b.pushInt(48).add().printTopChar().printLiteral(":");

    // Non-destructive printStrArg + escapeJson
    std.printStrArg(s4b, s5);
    s5.printLiteral("|");
    std.printStrArgJson(s5, s5b);
    s5b.printLiteral("|");
    std.printStrArgHtml(s5b, s6);
    s6.exitWithChar("\n");

    assert.equal(
      runCompiled(b, "hello/world\nignored"),
      "1,0,1,0,1,0:hello/world|hello/world|hello/world\n",
    );
  });

  it("supports strArgToInt, divMod, printInt, readFieldUntil, and escaping", () => {
    const b = new HyeongProgramBuilder();
    const std = new HyeongStdlib(b);
    const lineStk = b.allocStack();
    const s1 = b.block("s1");
    const s2 = b.block("s2");
    const s3 = b.block("s3");
    const s4 = b.block("s4");
    const s5 = b.block("s5");
    const s6 = b.block("s6");
    const s7 = b.block("s7");

    std.initStacks(b.entry);
    std.emitReadLine(b.entry, lineStk, s1);
    std.emitReadFieldUntil(s1, lineStk, 9, std.strArg, s2); // field 1 -> strArg
    std.strArgToInt(s2, s3);
    s3.pushInt(7);
    std.divMod(s3, s4); // q, r on WORK
    // Save r on std.strArg, print q, print ":", pop r, print r
    s4.moveWorkToStack(std.strArg);
    std.printInt(s4, s5);
    s5.printLiteral(":");
    s5.moveStackToWork(std.strArg);
    std.printInt(s5, s6);
    s6.printLiteral("|");
    std.emitReadFieldUntil(s6, lineStk, 9, std.strArg, s7);
    const s8 = b.block("s8");
    const s9 = b.block("s9");
    std.printStrArgJson(s7, s8);
    s8.printLiteral("|");
    std.printStrArgHtml(s8, s9);
    s9.exitWithChar("\n");

    // 100 / 7 = 14 rem 2
    assert.equal(runCompiled(b, '100\t<a>"b"&\'c\n'), '14:2|<a>\\"b\\"&\'c|&lt;a&gt;&quot;b&quot;&amp;&#39;c\n');
  });
});
