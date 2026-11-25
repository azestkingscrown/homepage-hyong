import fs from "node:fs";
import path from "node:path";
import { HyeongError } from "../engine/hyeong/error.ts";
import { HyeongSession } from "../engine/hyeong/interpreter.ts";
import { parseHyeong } from "../engine/hyeong/parser.ts";
import type { HyeongCommand } from "../engine/hyeong/parser.ts";

const APP_DIR = path.resolve(process.cwd(), "app");

const commandCache = new Map<string, { mtimeMs: number; commands: HyeongCommand[] }>();

function loadHyeongCommands(filePath: string): HyeongCommand[] {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(APP_DIR + path.sep) && resolved !== APP_DIR) {
    throw new Error(`Forbidden .hyeong path: ${filePath}`);
  }
  const stat = fs.statSync(resolved);
  const cached = commandCache.get(resolved);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.commands;
  }
  const content = fs.readFileSync(resolved, "utf8");
  const commands = parseHyeong(content);
  commandCache.set(resolved, { mtimeMs: stat.mtimeMs, commands });
  return commands;
}

export function listHyeongFiles(): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".hyeong")) {
        results.push(path.relative(APP_DIR, full).replaceAll("\\", "/"));
      }
    }
  };
  walk(APP_DIR);
  return results.sort();
}

export function readHyeongSource(relPath: string): string | null {
  const normalized = path.posix.normalize(relPath.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized.endsWith(".hyeong") || normalized.includes("..")) return null;
  const full = path.resolve(APP_DIR, normalized);
  if (!full.startsWith(APP_DIR + path.sep)) return null;
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

export interface HyeongModuleResult {
  output: string;
  stderr: string;
  durationMs: number;
}

export function runHyeongModule(relModulePath: string, stdinText: string): HyeongModuleResult {
  const start = performance.now();
  const modulePath = path.join(APP_DIR, relModulePath);
  const commands = loadHyeongCommands(modulePath);

  const codepoints: number[] = [];
  for (const ch of stdinText) {
    codepoints.push(ch.codePointAt(0)!);
  }
  let readIdx = 0;

  let output = "";
  let stderr = "";

  const session = new HyeongSession({
    write: (text: string) => {
      output += text;
    },
    stderr: (text: string) => {
      stderr += text;
    },
    read: () => (readIdx < codepoints.length ? codepoints[readIdx++] : -1),
    maxSteps: 50_000_000,
  });

  try {
    const res = session.runCommands(commands);
    if (res.exitCode !== 0) {
      throw new Error(`[${relModulePath}] Hyeong exited abnormally (code ${res.exitCode}): ${stderr}`);
    }
  } catch (err) {
    if (err instanceof HyeongError) {
      throw new Error(`[${relModulePath}] ${err.message}`);
    }
    throw err;
  }

  return {
    output,
    stderr,
    durationMs: performance.now() - start,
  };
}
