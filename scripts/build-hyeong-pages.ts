import fs from "node:fs";
import path from "node:path";
import { HyeongProgramBuilder } from "../engine/hyeong/compiler.ts";
import { HyeongStdlib } from "../engine/hyeong/stdlib.ts";

function writeHyeong(rel: string, content: string): void {
  const full = path.join(process.cwd(), "app", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart(), "utf8");
}

type Locale = "ko" | "en";

interface PageShellOpts {
  activePath: string;
  titleKo: string;
  titleEn: string;
  showFooter?: boolean;
}

function buildShellHead(opts: PageShellOpts, locale: Locale): string {
  const isKo = locale === "ko";
  const title = isKo ? opts.titleKo : opts.titleEn;
  const nextLang = isKo ? "en" : "ko";
  const nextLangLabel = isKo ? "EN" : "KO";
  const desc = isKo
    ? "아제스트의 개인 워크스페이스 및 서버 인프라 대시보드 (혀엉... 언어 구동)"
    : "Azest's Personal Workspace & Infra Dashboard (Powered by hyeong-lang)";

  const navCore = [
    { href: "/", label: "Overview" },
    { href: "/playground", label: isKo ? "💗 혀엉... 플레이그라운드" : "💗 Hyeong Playground", tag: ".hyeong" },
    { href: "/chzzk-bot-guide", label: isKo ? "치지직 봇 가이드" : "Chzzk Bot Guide" },
    { href: "/chzzk-bot-update", label: isKo ? "업데이트 내역" : "Changelog" },
    { href: "/technical-info", label: isKo ? "기술 문서" : "Technical Docs" },
  ];

  const navSvc = [
    { href: "/ddns", label: isKo ? "DDNS 관리" : "DDNS Manager", tag: "DNS" },
    { href: "/minecraft", label: isKo ? "Minecraft 제어" : "Minecraft Control", tag: "Docker" },
    { href: "/hosting", label: "File Hosting", tag: "OTP" },
    { href: "/admin", label: isKo ? "Admin 대시보드" : "Admin Dashboard", tag: "OTP" },
  ];

  const renderNavItems = (items: { href: string; label: string; tag?: string }[]) =>
    items
      .map(
        (it) =>
          `<li><a class="nav-item${opts.activePath === it.href ? " active" : ""}" href="${it.href}"><span>${it.label}</span>${it.tag ? `<span class="nav-tag">${it.tag}</span>` : ""}</a></li>`,
      )
      .join("");

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <nav class="sidebar-desktop" aria-label="Primary Sidebar">
    <div class="sidebar-top">
      <a class="brand-link" href="/">
        <span class="brand-badge">AK</span>
        <div style="min-width:0">
          <p class="brand-title">Azest_Kingscrown</p>
          <p class="brand-sub">hyeong-lang Edition</p>
        </div>
      </a>
      <div style="display:flex;gap:0.25rem">
        <button type="button" class="icon-btn" data-action="toggle-lang" data-next-lang="${nextLang}" title="Switch Language">${nextLangLabel}</button>
        <button type="button" class="icon-btn" data-action="toggle-theme" id="theme-label" title="Toggle Theme">SYSTEM</button>
      </div>
    </div>

    <div class="nav-group">
      <span class="nav-label">Workspace</span>
      <ul class="nav-list">${renderNavItems(navCore)}</ul>
    </div>

    <div class="nav-group">
      <span class="nav-label">Services &amp; Admin</span>
      <ul class="nav-list">${renderNavItems(navSvc)}</ul>
    </div>

    <div class="sidebar-foot">
      <div>💗 Powered by <strong>hyeong-lang</strong> (.hyeong)</div>
      <div style="margin-top:0.25rem"><a href="https://gist.github.com/xnuk/d9f883ede568d97caa158255e4b4d069" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">난해한 혀엉... 언어 v0.4.5</a></div>
    </div>
  </nav>

  <header class="mobile-header">
    <a class="brand-link" href="/" style="flex:0 1 auto">
      <span class="brand-badge">AK</span>
      <div>
        <p class="brand-title">Azest_Kingscrown</p>
        <p class="brand-sub">hyeong-lang Edition</p>
      </div>
    </a>
    <div style="display:flex;gap:0.35rem;align-items:center">
      <button type="button" class="icon-btn" data-action="toggle-lang" data-next-lang="${nextLang}">${nextLangLabel}</button>
      <button type="button" class="icon-btn" data-action="toggle-theme">THEME</button>
      <button type="button" class="icon-btn" data-action="open-drawer">☰</button>
    </div>
  </header>

  <div class="mobile-drawer" id="mobile-drawer">
    <div class="mobile-drawer-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <strong>Azest_Kingscrown</strong>
        <button type="button" class="icon-btn" data-action="close-drawer">✕</button>
      </div>
      <div class="nav-group">
        <span class="nav-label">Workspace</span>
        <ul class="nav-list">${renderNavItems(navCore)}</ul>
      </div>
      <div class="nav-group">
        <span class="nav-label">Services &amp; Admin</span>
        <ul class="nav-list">${renderNavItems(navSvc)}</ul>
      </div>
    </div>
  </div>

  <div class="main-shell">
    <main class="main-container">
      <div class="stack">
        <div class="hyeong-trace">
          <span id="hyeong-trace-text" class="font-mono">💗 Executed directly by hyeong-lang (.hyeong)</span>
          <a href="/playground" style="font-weight:600;text-decoration:underline">${isKo ? ".hyeong 소스 보기 / 실행 →" : "Inspect / Run .hyeong →"}</a>
        </div>
`;
}

function buildShellFoot(opts: PageShellOpts, locale: Locale): string {
  const footer =
    opts.showFooter === false
      ? ""
      : `<footer class="site-footer">
    <div class="footer-inner">
      <span class="sub" style="margin:0">© 2026 Azest_Kingscrown · Entirely rendered in <strong>hyeong-lang (.hyeong)</strong></span>
      <div class="btn-row">
        <a class="btn" href="/playground">💗 Playground</a>
        <a class="btn" href="https://gist.github.com/xnuk/d9f883ede568d97caa158255e4b4d069" target="_blank" rel="noopener noreferrer">혀엉... Spec</a>
      </div>
    </div>
  </footer>`;

  void locale;
  return `      </div>
    </main>
    ${footer}
  </div>
  <!--HYEONG_TRACE_DATA-->
  <script src="/client.js"></script>
</body>
</html>`;
}

function buildPageHyeong(
  relPath: string,
  opts: PageShellOpts,
  bodyKo: string,
  bodyEn: string,
  status = 200,
): void {
  const htmlKo = `${buildShellHead(opts, "ko")}${bodyKo}${buildShellFoot(opts, "ko")}`;
  const htmlEn = `${buildShellHead(opts, "en")}${bodyEn}${buildShellFoot(opts, "en")}`;

  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const readLoc = b.block("pg_rloc");
  const chkKo = b.block("pg_cko");
  const koBlk = b.block("pg_ko");
  const enBlk = b.block("pg_en");

  std.emitSkipLine(b.entry, readLoc); // skip method
  std.emitReadLine(readLoc, std.strArg, chkKo);
  const resBlk = b.block("pg_res");
  std.strEq(chkKo, "ko", resBlk);
  resBlk.branch("eq0", enBlk, koBlk);

  koBlk.printLiteral(`HTTP\n${status}\ntext/html; charset=utf-8\n`);
  koBlk.printLiteral(htmlKo.slice(0, -1));
  koBlk.exitWithChar(htmlKo.slice(-1));

  enBlk.printLiteral(`HTTP\n${status}\ntext/html; charset=utf-8\n`);
  enBlk.printLiteral(htmlEn.slice(0, -1));
  enBlk.exitWithChar(htmlEn.slice(-1));

  writeHyeong(relPath, b.build());
}

const t0 = performance.now();

// 1. app/pages/home.hyeong
buildPageHyeong(
  "pages/home.hyeong",
  {
    activePath: "/",
    titleKo: "Azest_Kingscrown | 혀엉... 워크스페이스",
    titleEn: "Azest_Kingscrown | Hyeong-lang Workspace",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Overview</h1>
      <p class="sub">개인 워크스페이스, 인프라 모니터링 및 서비스 대시보드 · 혀엉...(.hyeong)으로 전면 구동</p>
    </div>
    <span class="badge badge-indigo">💗 Powered by hyeong-lang</span>
  </div>

  <section class="grid-12">
    <div class="card col-8" style="display:flex;flex-direction:column;justify-content:space-between;gap:1.25rem">
      <div>
        <span class="badge badge-indigo">WELCOME · 혀엉...!</span>
        <h2 class="h1" style="margin-top:0.65rem">안녕하세요. 아제스트 입니다.</h2>
        <p class="sub" style="margin-top:0.6rem;line-height:1.7">
          이 홈페이지는 라우팅·모니터링 계산·SVG 생성·HTML 렌더링까지
          스택 기반 난해한 언어 <strong>혀엉...(hyeong-lang v0.4.5) <code>.hyeong</code></strong> 코드로 직접 구동되는 실험적 대시보드입니다.
        </p>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="/playground">💗 혀엉... 플레이그라운드</a>
        <a class="btn" href="/chzzk-bot-guide">치지직 봇 가이드</a>
        <a class="btn" href="/chzzk-bot-update">업데이트 내역</a>
        <a class="btn" href="https://gist.github.com/xnuk/d9f883ede568d97caa158255e4b4d069" target="_blank" rel="noopener noreferrer">혀엉... 명세 ↗</a>
      </div>
    </div>
    <div class="card col-4" id="discord-presence-card">
      <p class="sub">Discord 상태 불러오는 중...</p>
    </div>
  </section>

  <section class="stack" style="gap:0.9rem">
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <h2 class="h2">Server Status</h2>
        <span class="badge badge-emerald">Real-time · .hyeong computed</span>
      </div>
      <a href="/minecraft" style="font-size:0.8rem;color:var(--accent-text);font-weight:600">Minecraft 제어 패널 →</a>
    </div>
    <div class="grid-2" id="server-status-grid">
      <div class="card"><p class="sub">서버 상태 수집 중...</p></div>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 class="h2">Architecture (Hyeong CGI / Effect Bridge)</h2>
      <span class="badge badge-indigo">0 Runtime Dependencies</span>
    </div>
    <p class="sub" style="margin:0;line-height:1.7">
      Node.js는 최소한의 HTTP/OS Effect Bridge만 수행하며, 모든 경로 분기(<code>router.hyeong</code>),
      가동률(%) 연산 및 JSON 조립(<code>api/status.hyeong</code>), Discord SVG 배지 렌더링(<code>api/discord.hyeong</code>),
      전체 웹 페이지 HTML 출력(<code>pages/*.hyeong</code>)은 요청마다 실제 <code>hyeong-lang</code> 인터프리터가 실행합니다.
    </p>
  </section>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Overview</h1>
      <p class="sub">Personal Workspace, Infrastructure Monitoring &amp; Services · Powered by hyeong-lang (.hyeong)</p>
    </div>
    <span class="badge badge-indigo">💗 Powered by hyeong-lang</span>
  </div>

  <section class="grid-12">
    <div class="card col-8" style="display:flex;flex-direction:column;justify-content:space-between;gap:1.25rem">
      <div>
        <span class="badge badge-indigo">WELCOME · 혀엉...!</span>
        <h2 class="h1" style="margin-top:0.65rem">Hello, I'm Azest.</h2>
        <p class="sub" style="margin-top:0.6rem;line-height:1.7">
          This homepage runs routing, availability math, SVG badge generation, and HTML page rendering
          live inside the esoteric stack language <strong>hyeong-lang v0.4.5 (<code>.hyeong</code>)</strong>!
        </p>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary" href="/playground">💗 Hyeong Playground</a>
        <a class="btn" href="/chzzk-bot-guide">Chzzk Bot Guide</a>
        <a class="btn" href="/chzzk-bot-update">Changelog</a>
        <a class="btn" href="https://gist.github.com/xnuk/d9f883ede568d97caa158255e4b4d069" target="_blank" rel="noopener noreferrer">Hyeong Spec ↗</a>
      </div>
    </div>
    <div class="card col-4" id="discord-presence-card">
      <p class="sub">Loading Discord presence...</p>
    </div>
  </section>

  <section class="stack" style="gap:0.9rem">
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:0.6rem">
        <h2 class="h2">Server Status</h2>
        <span class="badge badge-emerald">Real-time · .hyeong computed</span>
      </div>
      <a href="/minecraft" style="font-size:0.8rem;color:var(--accent-text);font-weight:600">Minecraft Control Panel →</a>
    </div>
    <div class="grid-2" id="server-status-grid">
      <div class="card"><p class="sub">Loading server status...</p></div>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2 class="h2">Architecture (Hyeong CGI / Effect Bridge)</h2>
      <span class="badge badge-indigo">0 Runtime Dependencies</span>
    </div>
    <p class="sub" style="margin:0;line-height:1.7">
      Node.js acts strictly as a thin HTTP/OS effect bridge, while routing (<code>router.hyeong</code>),
      uptime/availability math (<code>api/status.hyeong</code>), SVG generation (<code>api/discord.hyeong</code>),
      and HTML rendering (<code>pages/*.hyeong</code>) execute live inside <code>hyeong-lang</code>.
    </p>
  </section>`,
);

const DEFAULT_HELLO_HYEONG = `혀어어어어어어어엉........ 핫. 혀엉..... 흑... 하앗... 흐윽... 형.  하앙.
혀엉.... 하앙... 흐윽... 항. 항. 형... 하앙. 흐으윽... 형... 흡... 혀엉..
하아아앗. 혀엉.. 흡... 흐읍... 형.. 하앗. 하아앙... 형... 하앙... 흐윽...
혀어어엉.. 하앙. 항. 형... 하앙. 혀엉.... 하앙. 흑... 항. 형... 흡  하앗.
혀엉..... 흑. 흣`;

// 2. app/pages/playground.hyeong
buildPageHyeong(
  "pages/playground.hyeong",
  {
    activePath: "/playground",
    titleKo: "혀엉... 플레이그라운드 & 소스 뷰어 | Azest_Kingscrown",
    titleEn: "Hyeong-lang Playground & Source Inspector | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">💗 혀엉... 플레이그라운드</h1>
      <p class="sub">브라우저에서 난해한 혀엉... 언어(.hyeong)를 바로 실행하고, 이 웹사이트를 돌리는 실제 .hyeong 소스 코드도 확인해 보세요.</p>
    </div>
    <span class="badge badge-indigo">hyeong v0.4.5</span>
  </div>

  <div id="hyeong-playground" class="stack">
    <div class="card">
      <div class="card-header">
        <strong>에디터 &amp; 실행 (Ctrl/⌘ + Enter)</strong>
        <div class="btn-row">
          <button type="button" class="btn" data-preset="hello">Hello, world!</button>
          <button type="button" class="btn" data-preset="neg">음수/유리수</button>
          <button type="button" class="btn" data-preset="nan">너무 커엇...</button>
          <button type="button" class="btn" data-preset="heart">하트 분기</button>
          <button type="button" class="btn" data-preset="echo">입력 Echo</button>
          <button type="button" class="btn btn-primary" id="pg-run-btn">▶ 실행</button>
        </div>
      </div>

      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          <textarea id="pg-code" class="textarea" rows="13">${DEFAULT_HELLO_HYEONG}</textarea>
          <div>
            <label for="pg-stdin" class="sub" style="display:block;margin-bottom:0.25rem">표준 입력 (0번 스택)</label>
            <input id="pg-stdin" class="input font-mono" placeholder="0번 스택에서 뽑을 입력 문자열..." />
          </div>
          <div style="display:flex;gap:0.5rem">
            <input id="pg-encode-input" class="input" placeholder="글을 혀엉... 출력 코드로 변환..." value="혀엉... 안녕!" />
            <button type="button" class="btn" id="pg-encode-btn" style="white-space:nowrap">글 인코드</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:0.875rem">실행 결과 (1번 스택 stdout)</strong>
            <span id="pg-meta" class="font-mono sub" style="margin:0">대기 중</span>
          </div>
          <pre id="pg-output" class="code-block" style="flex:1;min-height:260px;white-space:pre-wrap"></pre>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <strong>이 홈페이지를 구동하는 실제 .hyeong 소스 코드</strong>
          <p class="sub" style="margin:0"><code>app/</code> 폴더 안의 파일들을 선택해 직접 열람할 수 있습니다.</p>
        </div>
        <select id="pg-source-select" class="select" style="width:auto;min-width:220px"></select>
      </div>
      <pre id="pg-source-view" class="code-block" style="max-height:420px;overflow:auto"></pre>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">💗 Hyeong-lang Playground</h1>
      <p class="sub">Run hyeong-lang (.hyeong) code live and inspect the actual .hyeong source files powering this website.</p>
    </div>
    <span class="badge badge-indigo">hyeong v0.4.5</span>
  </div>

  <div id="hyeong-playground" class="stack">
    <div class="card">
      <div class="card-header">
        <strong>Editor &amp; Runner (Ctrl/⌘ + Enter)</strong>
        <div class="btn-row">
          <button type="button" class="btn" data-preset="hello">Hello, world!</button>
          <button type="button" class="btn" data-preset="neg">Negative/Rational</button>
          <button type="button" class="btn" data-preset="nan">NaN Output</button>
          <button type="button" class="btn" data-preset="heart">Hearts (?/!)</button>
          <button type="button" class="btn" data-preset="echo">Echo</button>
          <button type="button" class="btn btn-primary" id="pg-run-btn">▶ Run</button>
        </div>
      </div>

      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          <textarea id="pg-code" class="textarea" rows="13">${DEFAULT_HELLO_HYEONG}</textarea>
          <div>
            <label for="pg-stdin" class="sub" style="display:block;margin-bottom:0.25rem">Standard Input (Stack 0)</label>
            <input id="pg-stdin" class="input font-mono" placeholder="Input read from stack 0..." />
          </div>
          <div style="display:flex;gap:0.5rem">
            <input id="pg-encode-input" class="input" placeholder="Encode text into hyeong-lang..." value="혀엉... Hello!" />
            <button type="button" class="btn" id="pg-encode-btn" style="white-space:nowrap">Encode Text</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:0.875rem">Output (Stack 1 stdout)</strong>
            <span id="pg-meta" class="font-mono sub" style="margin:0">Ready</span>
          </div>
          <pre id="pg-output" class="code-block" style="flex:1;min-height:260px;white-space:pre-wrap"></pre>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <strong>Live .hyeong Source Code Powering This Website</strong>
          <p class="sub" style="margin:0">Browse any file inside <code>app/</code>.</p>
        </div>
        <select id="pg-source-select" class="select" style="width:auto;min-width:220px"></select>
      </div>
      <pre id="pg-source-view" class="code-block" style="max-height:420px;overflow:auto"></pre>
    </div>
  </div>`,
);

// 3. app/pages/update.hyeong
buildPageHyeong(
  "pages/update.hyeong",
  {
    activePath: "/chzzk-bot-update",
    titleKo: "치지직 디스코드 봇 업데이트 내역 | Azest_Kingscrown",
    titleEn: "Chzzk Discord Bot Changelog | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <div class="btn-row"><span class="badge badge-indigo">Changelog</span><span class="badge badge-emerald">Discord Verified App</span></div>
      <h1 class="h1" style="margin-top:0.5rem">치지직 디스코드 봇 업데이트 내역</h1>
      <p class="sub">아키텍처 개편, 인프라 확장 및 커스텀 알림 기능 패치 노트</p>
    </div>
    <a class="btn" href="/chzzk-bot-guide">전체 가이드</a>
  </div>

  <div class="card">
    <div class="card-header"><strong>20샤드 내부 샤딩 &amp; Dynamic Failover 아키텍처 개편</strong><span class="badge">2026.06.29</span></div>
    <ul style="margin:0;padding-left:1.25rem;color:var(--text-body)">
      <li><strong>무정지 고정 20샤드 가동:</strong> 20개 샤드(0~19번)를 영구 고정 운영하여 최대 20,000~50,000대 서버 확장 대응</li>
      <li><strong>초절전형 단일 프로세스 내부 샤딩:</strong> GCP 955MB 저사양에서도 약 80MB대 메모리로 20샤드 구동</li>
      <li><strong>SQLite WAL 모드 도입:</strong> 다중 샤드 동시 쓰기에도 파일 락 충돌 없는 비동기 큐잉 적용</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-header"><strong>커스텀 알림 &amp; 선택 등록</strong><span class="badge badge-indigo">Feature</span></div>
    <p class="sub" style="margin-top:0"><code>/알림메시지설정</code> 명령어로 스트리머별·알림 종류별(방송시작/커뮤니티) 멘션과 문구를 자유롭게 지정할 수 있습니다.</p>
    <pre class="code-block">/알림메시지설정 스트리머:강소연 종류:방송시작 멘션역할:@everyone 메시지: 드디어 {streamer}님이 방송을 켰습니다!</pre>
  </div>`,
  `<div class="page-head">
    <div>
      <div class="btn-row"><span class="badge badge-indigo">Changelog</span><span class="badge badge-emerald">Discord Verified App</span></div>
      <h1 class="h1" style="margin-top:0.5rem">Chzzk Discord Bot Changelog</h1>
      <p class="sub">Architecture overhaul, global proxy expansion &amp; custom notification patch notes</p>
    </div>
    <a class="btn" href="/chzzk-bot-guide">Full Guide</a>
  </div>

  <div class="card">
    <div class="card-header"><strong>20-Shard Internal Sharding &amp; Dynamic Failover Overhaul</strong><span class="badge">2026.06.29</span></div>
    <ul style="margin:0;padding-left:1.25rem;color:var(--text-body)">
      <li><strong>Zero-Downtime Fixed 20 Shards:</strong> Scales seamlessly up to 20,000–50,000 Discord servers.</li>
      <li><strong>Ultra-Low-Memory Sharding:</strong> Operates all 20 shards smoothly within ~80MB RAM.</li>
      <li><strong>SQLite WAL Mode:</strong> Eliminates lock contention under concurrent multi-shard writes.</li>
    </ul>
  </div>

  <div class="card">
    <div class="card-header"><strong>Custom Alerts &amp; Selective Subscriptions</strong><span class="badge badge-indigo">Feature</span></div>
    <p class="sub" style="margin-top:0">Customize mention targets and alert templates per streamer with <code>/알림메시지설정</code>.</p>
    <pre class="code-block">/알림메시지설정 스트리머:강소연 종류:방송시작 멘션역할:@everyone 메시지: {streamer} is now live!</pre>
  </div>`,
);

// 4. app/pages/minecraft.hyeong
buildPageHyeong(
  "pages/minecraft.hyeong",
  {
    activePath: "/minecraft",
    titleKo: "마인크래프트 서버 대시보드 | Azest_Kingscrown",
    titleEn: "Minecraft Server Dashboard | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">마인크래프트 서버 대시보드</h1>
      <p class="sub">Docker 컨테이너 상태 모니터링 및 원격 시작/종료 제어 (API: <code>api/server.hyeong</code>)</p>
    </div>
    <a class="btn" href="/admin">관리자 로그 확인</a>
  </div>

  <div id="minecraft-panel" class="grid-2">
    <div class="card">
      <div class="card-header"><strong>컨테이너 상태</strong><span class="badge">3s polling</span></div>
      <p class="h2 font-mono" id="mc-status-text">확인 중...</p>
    </div>
    <div class="card">
      <div class="card-header"><strong>서버 제어</strong><span class="badge badge-indigo">Docker Bridge</span></div>
      <div class="btn-row">
        <button type="button" class="btn btn-success" data-mc-action="start">서버 켜기</button>
        <button type="button" class="btn btn-danger" data-mc-action="stop">서버 끄기</button>
      </div>
    </div>
  </div>

  <div class="grid-2" id="server-status-grid"></div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Minecraft Server Dashboard</h1>
      <p class="sub">Docker container status &amp; remote start/stop control (API: <code>api/server.hyeong</code>)</p>
    </div>
    <a class="btn" href="/admin">View Admin Logs</a>
  </div>

  <div id="minecraft-panel" class="grid-2">
    <div class="card">
      <div class="card-header"><strong>Container Status</strong><span class="badge">3s polling</span></div>
      <p class="h2 font-mono" id="mc-status-text">Checking...</p>
    </div>
    <div class="card">
      <div class="card-header"><strong>Server Controls</strong><span class="badge badge-indigo">Docker Bridge</span></div>
      <div class="btn-row">
        <button type="button" class="btn btn-success" data-mc-action="start">Start Server</button>
        <button type="button" class="btn btn-danger" data-mc-action="stop">Stop Server</button>
      </div>
    </div>
  </div>

  <div class="grid-2" id="server-status-grid"></div>`,
);

// 5. app/pages/ddns.hyeong
buildPageHyeong(
  "pages/ddns.hyeong",
  {
    activePath: "/ddns",
    titleKo: "DDNS 관리 | Azest_Kingscrown",
    titleEn: "DDNS Manager | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Cloudflare DDNS 관리</h1>
      <p class="sub">기기별 DNS A 레코드 동적 관리 (API: <code>api/ddns.hyeong</code>)</p>
    </div>
    <span class="badge badge-indigo">Your IP: <span id="ddns-client-ip" class="font-mono">-</span></span>
  </div>

  <div id="ddns-root" class="stack">
    <div class="card">
      <div class="card-header"><strong>새 기기 등록</strong><span class="font-mono sub" style="margin:0">Token: <span id="ddns-token">-</span></span></div>
      <form id="ddns-add-form" class="btn-row">
        <input id="ddns-new-domain" class="input" style="max-width:240px" placeholder="서브도메인 (예: nas)" required />
        <input id="ddns-new-label" class="input" style="max-width:220px" placeholder="기기 이름 (예: Home NAS)" />
        <button type="submit" class="btn btn-primary">추가</button>
      </form>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>도메인</th><th>기기명</th><th>OS</th><th>현재 IP</th><th style="text-align:right">작업</th></tr></thead>
        <tbody id="ddns-list"></tbody>
      </table>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Cloudflare DDNS Manager</h1>
      <p class="sub">Dynamic DNS A record management (API: <code>api/ddns.hyeong</code>)</p>
    </div>
    <span class="badge badge-indigo">Your IP: <span id="ddns-client-ip" class="font-mono">-</span></span>
  </div>

  <div id="ddns-root" class="stack">
    <div class="card">
      <div class="card-header"><strong>Add Device</strong><span class="font-mono sub" style="margin:0">Token: <span id="ddns-token">-</span></span></div>
      <form id="ddns-add-form" class="btn-row">
        <input id="ddns-new-domain" class="input" style="max-width:240px" placeholder="Subdomain (e.g. nas)" required />
        <input id="ddns-new-label" class="input" style="max-width:220px" placeholder="Device label" />
        <button type="submit" class="btn btn-primary">Add</button>
      </form>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Domain</th><th>Label</th><th>OS</th><th>Current IP</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody id="ddns-list"></tbody>
      </table>
    </div>
  </div>`,
);

// 6. app/pages/hosting.hyeong
buildPageHyeong(
  "pages/hosting.hyeong",
  {
    activePath: "/hosting",
    titleKo: "Private File Hosting | Azest_Kingscrown",
    titleEn: "Private File Hosting | Azest_Kingscrown",
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">Private File Hosting</h1>
      <p class="sub">관리자 OTP 인증 기반 파일 업로드 및 호스팅 (데모 기본 OTP: <code>000000</code>)</p>
    </div>
  </div>

  <div id="hosting-root" class="stack">
    <div id="hosting-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>관리자 OTP 인증</strong><span class="badge">OTP</span></div>
      <form id="hosting-login-form" class="stack" style="gap:0.75rem">
        <input id="hosting-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">인증 및 입장</button>
      </form>
    </div>

    <div id="hosting-panel-box" class="stack" style="display:none">
      <div class="card">
        <form id="hosting-upload-form" class="btn-row">
          <input id="hosting-file-input" type="file" accept="image/*" class="input" style="max-width:340px" />
          <button type="submit" class="btn btn-primary">업로드</button>
        </form>
      </div>
      <div id="hosting-images-grid" class="grid-3"></div>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Private File Hosting</h1>
      <p class="sub">Admin OTP authenticated file hosting (Demo default OTP: <code>000000</code>)</p>
    </div>
  </div>

  <div id="hosting-root" class="stack">
    <div id="hosting-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Admin OTP Auth</strong><span class="badge">OTP</span></div>
      <form id="hosting-login-form" class="stack" style="gap:0.75rem">
        <input id="hosting-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
    </div>

    <div id="hosting-panel-box" class="stack" style="display:none">
      <div class="card">
        <form id="hosting-upload-form" class="btn-row">
          <input id="hosting-file-input" type="file" accept="image/*" class="input" style="max-width:340px" />
          <button type="submit" class="btn btn-primary">Upload</button>
        </form>
      </div>
      <div id="hosting-images-grid" class="grid-3"></div>
    </div>
  </div>`,
);

// 7. app/pages/admin.hyeong
buildPageHyeong(
  "pages/admin.hyeong",
  {
    activePath: "/admin",
    titleKo: "관리자 대시보드 | Azest_Kingscrown",
    titleEn: "Admin Dashboard | Azest_Kingscrown",
    showFooter: false,
  },
  `<div class="page-head">
    <div>
      <h1 class="h1">마인크래프트 관리자 대시보드</h1>
      <p class="sub">Discord 화이트리스트 및 서버 제어 이력 관리 (데모 기본 OTP: <code>000000</code>)</p>
    </div>
    <a class="btn" href="/minecraft">제어 페이지</a>
  </div>

  <div id="admin-root" class="stack">
    <div id="admin-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Google OTP 인증</strong><span class="badge">Admin</span></div>
      <form id="admin-login-form" class="stack" style="gap:0.75rem">
        <input id="admin-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">인증 확인</button>
      </form>
    </div>

    <div id="admin-panel-box" class="stack" style="display:none">
      <div class="card">
        <div class="card-header"><strong>Discord 화이트리스트</strong></div>
        <form id="admin-add-wl-form" class="btn-row" style="margin-bottom:1rem">
          <input id="wl-new-id" class="input font-mono" style="max-width:240px" placeholder="디스코드 ID (17~19자리)" />
          <input id="wl-new-name" class="input" style="max-width:200px" placeholder="사용자명" />
          <button type="submit" class="btn btn-primary">추가</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Discord ID</th><th>이름</th><th style="text-align:right">작업</th></tr></thead>
            <tbody id="admin-whitelist-body"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><strong>최근 제어 기록</strong></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>시간</th><th>작업</th><th>사용자</th></tr></thead>
            <tbody id="admin-logs-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`,
  `<div class="page-head">
    <div>
      <h1 class="h1">Admin Console</h1>
      <p class="sub">Discord whitelist &amp; server control logs (Demo default OTP: <code>000000</code>)</p>
    </div>
    <a class="btn" href="/minecraft">Control Panel</a>
  </div>

  <div id="admin-root" class="stack">
    <div id="admin-auth-box" class="card" style="max-width:420px">
      <div class="card-header"><strong>Google OTP Auth</strong><span class="badge">Admin</span></div>
      <form id="admin-login-form" class="stack" style="gap:0.75rem">
        <input id="admin-otp-input" class="input font-mono" maxlength="6" placeholder="000000" style="text-align:center;font-size:1.15rem;letter-spacing:0.3em" />
        <button type="submit" class="btn btn-primary">Verify</button>
      </form>
    </div>

    <div id="admin-panel-box" class="stack" style="display:none">
      <div class="card">
        <div class="card-header"><strong>Discord Whitelist</strong></div>
        <form id="admin-add-wl-form" class="btn-row" style="margin-bottom:1rem">
          <input id="wl-new-id" class="input font-mono" style="max-width:240px" placeholder="Discord ID (17-19 digits)" />
          <input id="wl-new-name" class="input" style="max-width:200px" placeholder="Display name" />
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Discord ID</th><th>Name</th><th style="text-align:right">Action</th></tr></thead>
            <tbody id="admin-whitelist-body"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><strong>Recent Control Logs</strong></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>User</th></tr></thead>
            <tbody id="admin-logs-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`,
);

// 8. app/pages/unauthorized.hyeong (404 / 403)
buildPageHyeong(
  "pages/unauthorized.hyeong",
  {
    activePath: "/unauthorized",
    titleKo: "페이지를 찾을 수 없거나 접근 권한 없음 | Azest_Kingscrown",
    titleEn: "Not Found or Access Denied | Azest_Kingscrown",
  },
  `<div class="card" style="max-width:34rem;margin:2rem auto;text-align:center">
    <span class="badge badge-red">404 / 403</span>
    <h1 class="h1" style="margin-top:0.75rem">혀엉... 여긴 못 찾는 곳이야</h1>
    <p class="sub" style="margin-top:0.5rem">요청하신 페이지가 없거나 접근 권한이 없습니다.</p>
    <div class="btn-row" style="justify-content:center;margin-top:1.25rem">
      <a class="btn btn-primary" href="/">메인으로 이동</a>
      <a class="btn" href="/playground">💗 혀엉... 플레이그라운드</a>
    </div>
  </div>`,
  `<div class="card" style="max-width:34rem;margin:2rem auto;text-align:center">
    <span class="badge badge-red">404 / 403</span>
    <h1 class="h1" style="margin-top:0.75rem">Page Not Found or Access Denied</h1>
    <p class="sub" style="margin-top:0.5rem">The requested route does not exist or requires authorization.</p>
    <div class="btn-row" style="justify-content:center;margin-top:1.25rem">
      <a class="btn btn-primary" href="/">Go to Overview</a>
      <a class="btn" href="/playground">💗 Hyeong Playground</a>
    </div>
  </div>`,
  404,
);

// 9. app/pages/doc.hyeong — Streams static/docs/*.html via Effect Bridge!
function buildDocPage(): string {
  const b = new HyeongProgramBuilder({ preloadMaxLines: 7 });
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const locStk = b.allocStack();
  const pathStk = b.allocStack();

  const rLoc = b.block("doc_rloc");
  const sHost = b.block("doc_shost");
  const rPath = b.block("doc_rpath");
  const sQ = b.block("doc_sq");
  const sIp = b.block("doc_sip");
  const rEff = b.block("doc_reff");

  std.emitSkipLine(b.entry, rLoc); // method
  std.emitReadLine(rLoc, locStk, sHost);
  std.emitSkipLine(sHost, rPath);
  std.emitReadLine(rPath, pathStk, sQ);
  std.emitSkipLine(sQ, sIp);
  std.emitSkipLine(sIp, rEff);

  const effRes = b.block("doc_er");
  const noEff = b.block("doc_ne");
  const hasEff = b.block("doc_he");

  std.emitReadLine(rEff, std.strArg, effRes);
  const effCmp = b.block("doc_ec");
  std.strEq(effRes, "0", effCmp);
  effCmp.branch("eq0", hasEff, noEff);

  const mvPath = b.block("doc_mvp");
  const chkGuide = b.block("doc_cg");
  const isGuide = b.block("doc_ig");
  const isTech = b.block("doc_it");
  const gKo = b.block("doc_gko");
  const gEn = b.block("doc_gen");
  const tKo = b.block("doc_tko");
  const tEn = b.block("doc_ten");
  const gRes = b.block("doc_gr");
  const tRes = b.block("doc_tr");

  noEff.printLiteral("EFFECT\nread_doc\n");
  std.emitMoveStr(noEff, pathStk, std.strArg, mvPath);
  std.strEq(mvPath, "/chzzk-bot-guide", chkGuide);
  chkGuide.branch("eq0", isTech, isGuide);

  std.emitMoveStr(isGuide, locStk, std.strArg, gRes);
  const gRes2 = b.block("doc_gr2");
  std.strEq(gRes, "ko", gRes2);
  gRes2.branch("eq0", gEn, gKo);

  std.emitMoveStr(isTech, locStk, std.strArg, tRes);
  const tRes2 = b.block("doc_tr2");
  std.strEq(tRes, "ko", tRes2);
  tRes2.branch("eq0", tEn, tKo);

  gKo.printLiteral("chzzk-bot-guide.htm").exitWithChar("l");
  gEn.printLiteral("chzzk-bot-guide.en.htm").exitWithChar("l");
  tKo.printLiteral("technical-info.htm").exitWithChar("l");
  tEn.printLiteral("technical-info.en.htm").exitWithChar("l");

  hasEff.printLiteral("HTTP\n200\ntext/html; charset=utf-8\n").exitStreamingStdin();

  return b.build();
}

writeHyeong("pages/doc.hyeong", buildDocPage());

console.log(`Generated all 9 app/pages/*.hyeong modules in ${(performance.now() - t0).toFixed(1)} ms!`);
