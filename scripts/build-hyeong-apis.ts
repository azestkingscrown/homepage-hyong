import fs from "node:fs";
import path from "node:path";
import { HyeongBlock, HyeongProgramBuilder } from "../engine/hyeong/compiler.ts";
import { HyeongStdlib } from "../engine/hyeong/stdlib.ts";

function writeHyeong(rel: string, content: string): void {
  const full = path.join(process.cwd(), "app", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trimStart(), "utf8");
}

// ---------------------------------------------------------------------------
// 0. app/router.hyeong
// ---------------------------------------------------------------------------
function buildRouter(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);

  const hostStk = b.allocStack();
  const pathStk = b.allocStack();
  const cookieStk = b.allocStack();
  const acceptStk = b.allocStack();
  const isKoStk = b.allocStack();

  std.initStacks(b.entry);
  b.entry.pushInt(0).moveWorkToStack(isKoStk);

  const rHost = b.block("r_host");
  const rPath = b.block("r_path");
  const rQuery = b.block("r_query");
  const rCookie = b.block("r_cookie");
  const rAccept = b.block("r_accept");

  std.emitSkipLine(b.entry, rHost);
  std.emitReadLine(rHost, hostStk, rPath);
  std.emitReadLine(rPath, std.strArg, rQuery); // pathname in strArg
  std.emitSkipLine(rQuery, rCookie);
  std.emitReadLine(rCookie, cookieStk, rAccept);
  const checkHidden = b.block("chk_hidden");
  std.emitReadLine(rAccept, acceptStk, checkHidden);

  // 1. isHiddenDotPath(pathname)
  const chkHidden2 = b.block("chk_hidden2");
  const isHidden = b.block("is_hidden");
  const notHidden = b.block("not_hidden");
  const chkHiddenRes = b.block("chk_hidden_res");
  std.strStartsWith(checkHidden, "/.", chkHidden2);
  chkHidden2.branch("eq0", chkHiddenRes, isHidden);
  const savePath = b.block("save_path");
  std.strContains(chkHiddenRes, "/.", notHidden);
  notHidden.branch("eq0", savePath, isHidden);

  isHidden.printLiteral("HTTP\n404\ntext/plain; charset=utf-8\nNot Found").exitWithChar("\n");

  // Save pathname -> pathStk, then detectLocale
  const detLoc = b.block("det_loc");
  std.emitMoveStr(savePath, std.strArg, pathStk, detLoc);

  const locChkKo = b.block("loc_ko");
  const locChkEn = b.block("loc_en");
  const locChkCookieKo = b.block("loc_cko");
  const locMoveAccept = b.block("loc_mv_acc");
  const locChkAccKo = b.block("loc_acco");
  const locSetKo = b.block("loc_set_ko");
  const locSetEn = b.block("loc_set_en");
  const afterLoc = b.block("after_loc");

  std.emitMoveStr(detLoc, cookieStk, std.strArg, locChkKo);
  const locRes1 = b.block("loc_r1");
  std.strEq(locChkKo, "ko", locRes1);
  locRes1.branch("eq0", locChkEn, locSetKo);

  const locRes2 = b.block("loc_r2");
  std.strEq(locChkEn, "en", locRes2);
  locRes2.branch("eq0", locChkCookieKo, locSetEn);

  const locRes3 = b.block("loc_r3");
  std.strContains(locChkCookieKo, "ko", locRes3);
  locRes3.branch("eq0", locMoveAccept, locSetKo);

  std.emitMoveStr(locMoveAccept, acceptStk, std.strArg, locChkAccKo);
  const locRes4 = b.block("loc_r4");
  std.strContains(locChkAccKo, "ko", locRes4);
  locRes4.branch("eq0", locSetEn, locSetKo);

  locSetKo.moveStackToWork(isKoStk).drop(1).pushInt(1).moveWorkToStack(isKoStk).jump(afterLoc);
  locSetEn.moveStackToWork(isKoStk).drop(1).pushInt(0).moveWorkToStack(isKoStk).jump(afterLoc);

  // 3. rewriteChzzkPath(host, path)
  const chkChzzkRes = b.block("chzzk_res");
  const restorePathNoChzzk = b.block("path_nochzzk");
  const restorePathChzzk = b.block("path_chzzk");
  const rwGuideCheck = b.block("rw_guide");
  const rwUpdateCheck = b.block("rw_update");
  const rwSetGuide = b.block("rw_set_guide");
  const rwSetUpdate = b.block("rw_set_update");
  const routeEntry = b.block("route_entry");

  const mvHost = b.block("mv_host");
  std.emitMoveStr(afterLoc, hostStk, std.strArg, mvHost);
  std.strContains(mvHost, "chzzk.", chkChzzkRes);
  chkChzzkRes.branch("eq0", restorePathNoChzzk, restorePathChzzk);

  std.emitMoveStr(restorePathNoChzzk, pathStk, std.strArg, routeEntry);
  std.emitMoveStr(restorePathChzzk, pathStk, std.strArg, rwGuideCheck);

  const rwR1 = b.block("rw_r1");
  const rwC2 = b.block("rw_c2");
  const rwR2 = b.block("rw_r2");
  std.strEq(rwGuideCheck, "/", rwR1);
  rwR1.branch("eq0", rwC2, rwSetGuide);
  std.strEq(rwC2, "/guide", rwR2);
  rwR2.branch("eq0", rwUpdateCheck, rwSetGuide);

  const rwC3 = b.block("rw_c3");
  const rwC4 = b.block("rw_c4");
  const rwC5 = b.block("rw_c5");
  const rwR3 = b.block("rw_r3");
  const rwR4 = b.block("rw_r4");
  const rwR5 = b.block("rw_r5");
  std.strEq(rwUpdateCheck, "/update", rwR3);
  rwR3.branch("eq0", rwC4, rwSetUpdate);
  std.strEq(rwC4, "/updates", rwR4);
  rwR4.branch("eq0", rwC5, rwSetUpdate);
  std.strEq(rwC5, "/changelog", rwR5);
  rwR5.branch("eq0", routeEntry, rwSetUpdate);

  const clrG = b.block("clr_g");
  std.emitClearStr(rwSetGuide, std.strArg, clrG);
  clrG.pushLiteralStringTo(std.strArg, "/chzzk-bot-guide").jump(routeEntry);

  const clrU = b.block("clr_u");
  std.emitClearStr(rwSetUpdate, std.strArg, clrU);
  clrU.pushLiteralStringTo(std.strArg, "/chzzk-bot-update").jump(routeEntry);

  // 4. routeModule(resolvedPath in strArg)
  const routes: [string, string][] = [
    ["/", "pages/home.hyeong"],
    ["/playground", "pages/playground.hyeong"],
    ["/chzzk-bot-update", "pages/update.hyeong"],
    ["/chzzk-bot-guide", "pages/doc.hyeong"],
    ["/technical-info", "pages/doc.hyeong"],
    ["/minecraft", "pages/minecraft.hyeong"],
    ["/ddns", "pages/ddns.hyeong"],
    ["/hosting", "pages/hosting.hyeong"],
    ["/admin", "pages/admin.hyeong"],
    ["/ip", "api/ip.hyeong"],
    ["/api/status", "api/status.hyeong"],
    ["/api/discord", "api/discord.hyeong"],
    ["/api/discord-status", "api/discord.hyeong"],
    ["/api/server", "api/server.hyeong"],
    ["/api/ddns", "api/ddns.hyeong"],
    ["/api/ddns/myip", "api/ddns.hyeong"],
    ["/nic/update", "api/ddns.hyeong"],
    ["/api/images", "api/hosting.hyeong"],
    ["/api/delete", "api/hosting.hyeong"],
    ["/api/hyeong/run", "api/hyeong.hyeong"],
    ["/api/hyeong/source", "api/hyeong.hyeong"],
  ];

  const emitDispatch = (blk: HyeongBlock, modName: string) => {
    const pLoc = b.block(`disp_loc_${blk.id}`);
    const pKo = b.block(`disp_ko_${blk.id}`);
    const pEn = b.block(`disp_en_${blk.id}`);
    const pPath = b.block(`disp_path_${blk.id}`);
    const done = b.block(`disp_done_${blk.id}`);
    blk.printLiteral(`DISPATCH\n${modName}\n`);
    blk.moveStackToWork(isKoStk).branch("eq0", pEn, pKo);
    pKo.printLiteral("ko\n").jump(pPath);
    pEn.printLiteral("en\n").jump(pPath);
    std.printStrArg(pPath, done);
    done.exitWithChar("\n");
    void pLoc;
  };

  let curCheck = routeEntry;
  for (let i = 0; i < routes.length; i++) {
    const [routePath, modName] = routes[i];
    const resBlk = b.block(`rt_res_${i}`);
    const hitBlk = b.block(`rt_hit_${i}`);
    const nextBlk = i === routes.length - 1 ? b.block("rt_404") : b.block(`rt_chk_${i + 1}`);
    std.strEq(curCheck, routePath, resBlk);
    resBlk.branch("eq0", nextBlk, hitBlk);
    emitDispatch(hitBlk, modName);
    curCheck = nextBlk;
  }
  emitDispatch(curCheck, "pages/unauthorized.hyeong");

  return b.build();
}

// ---------------------------------------------------------------------------
// 1. app/api/ip.hyeong
// ---------------------------------------------------------------------------
function buildIpApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  let cur = b.entry;
  for (let i = 0; i < 5; i++) {
    const nxt = b.block(`ip_skip_${i}`);
    std.emitSkipLine(cur, nxt);
    cur = nxt;
  }
  const printOut = b.block("ip_out");
  const done = b.block("ip_done");
  std.emitReadLine(cur, std.strArg, printOut);
  printOut.printLiteral("HTTP\n200\ntext/plain; charset=utf-8\n");
  std.printStrArg(printOut, done);
  done.exitWithChar("\n");
  return b.build();
}

// ---------------------------------------------------------------------------
// 2. app/api/status.hyeong — Computes uptime & availability% in pure Hyeong!
// ---------------------------------------------------------------------------
function buildStatusApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const rawStk = b.allocStack();
  const cpuStk = b.allocStack();
  const cpuItemStk = b.allocStack();
  const firstCpuStk = b.allocStack();
  const upValStk = b.allocStack();
  const totValStk = b.allocStack();
  const secValStk = b.allocStack();

  // Reusable subroutine: formatAvail(upValStk, totValStk) -> prints "XX.XX"
  const { sub: fmtAvailSub, ret: fmtAvailRet } = b.subroutine("formatAvail");
  {
    const chk100 = b.block("fa_chk100");
    const out100 = b.block("fa_100");
    const calc = b.block("fa_calc");
    const afterDiv = b.block("fa_adiv");
    const afterDiv100 = b.block("fa_adiv100");
    const printWhole = b.block("fa_whole");
    const padZero = b.block("fa_pad");
    const printRem = b.block("fa_rem");
    const remStk = b.allocStack();
    fmtAvailSub.entry.pushInt(0).moveWorkToStack(remStk);

    // Check tot < 1
    fmtAvailSub.entry.moveStackToWork(totValStk).dup().moveWorkToStack(totValStk);
    fmtAvailSub.entry.pushInt(1).sub().branch("lt0", out100, calc);

    out100.printLiteral("100.00").jump(fmtAvailRet);

    // up * 10000 / tot
    calc.moveStackToWork(upValStk).pushInt(10000).mul();
    calc.moveStackToWork(totValStk);
    std.divMod(calc, afterDiv); // WORK:[q, r]
    afterDiv.drop(1); // drop r, keep q = pct100
    afterDiv.dup().pushInt(10000).sub().branch("lt0", chk100, out100Drop(b, out100));

    chk100.pushInt(100);
    std.divMod(chk100, afterDiv100); // WORK:[whole, rem]
    afterDiv100.moveWorkToStack(remStk);
    std.printInt(afterDiv100, printWhole);
    printWhole.printLiteral(".");
    printWhole.moveStackToWork(remStk).dup().pushInt(10).sub().branch("lt0", padZero, printRem);
    padZero.printLiteral("0").jump(printRem);
    std.printInt(printRem, fmtAvailRet);
  }

  // Reusable subroutine: formatUptime(secValStk) -> prints "Xd Xh Xm Xs"
  const { sub: fmtUpSub, ret: fmtUpRet } = b.subroutine("formatUptime");
  {
    const aDays = b.block("fu_ad");
    const pDays = b.block("fu_pd");
    const aHours = b.block("fu_ah");
    const pHours = b.block("fu_ph");
    const aMins = b.block("fu_am");
    const pMins = b.block("fu_pm");

    fmtUpSub.entry.moveStackToWork(secValStk).pushInt(86400);
    std.divMod(fmtUpSub.entry, aDays); // [days, rem1]
    aDays.moveWorkToStack(secValStk);
    std.printInt(aDays, pDays);
    pDays.printLiteral("d ");

    pDays.moveStackToWork(secValStk).pushInt(3600);
    std.divMod(pDays, aHours); // [hours, rem2]
    aHours.moveWorkToStack(secValStk);
    std.printInt(aHours, pHours);
    pHours.printLiteral("h ");

    pHours.moveStackToWork(secValStk).pushInt(60);
    std.divMod(pHours, aMins); // [mins, secs]
    aMins.moveWorkToStack(secValStk);
    std.printInt(aMins, pMins);
    pMins.printLiteral("m ");
    pMins.moveStackToWork(secValStk);
    std.printInt(pMins, fmtUpRet);
    // Append 's' after returning? Or right in a wrapper:
  }

  let cur = b.entry;
  for (let i = 0; i < 6; i++) {
    const nxt = b.block(`st_skip_${i}`);
    std.emitSkipLine(cur, nxt);
    cur = nxt;
  }
  const chkEff = b.block("st_chkeff");
  const effRes = b.block("st_effres");
  const noEff = b.block("st_noeff");
  const hasEff = b.block("st_haseff");

  std.emitReadLine(cur, std.strArg, chkEff);
  std.strEq(chkEff, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  noEff.printLiteral("EFFECT\nsys_metrics").exitWithChar("\n");

  // Parse tab-separated payload
  const fName = b.block("st_fname");
  const fCpu = b.block("st_fcpu");
  const hdr = b.block("st_hdr");
  std.emitReadAllTo(hasEff, rawStk, fName);
  std.emitReadFieldUntil(fName, rawStk, 9, std.strArg, fCpu); // Main Server (ignored)
  std.emitReadFieldUntil(fCpu, rawStk, 9, cpuStk, hdr);

  hdr.printLiteral('HTTP\n200\napplication/json; charset=utf-8\n{"servers":[{"name":"Main Server","cpus":[');
  hdr.pushInt(1).moveWorkToStack(firstCpuStk);

  // CPU JSON loop
  const cpuLoop = b.block("cpu_loop");
  const cpuHas = b.block("cpu_has");
  const cpuSplit = b.block("cpu_split");
  const cpuComma = b.block("cpu_comma");
  const cpuPrintId = b.block("cpu_pid");
  const cpuReadUsage = b.block("cpu_rusage");
  const cpuPrintUsage = b.block("cpu_pusage");
  const cpuEnd = b.block("cpu_end");
  const cpuDone = b.block("cpu_done");

  hdr.jump(cpuLoop);
  cpuLoop.moveStackToWork(cpuStk).dup().branch("lt0", cpuDone, cpuHas);
  cpuHas.moveWorkToStack(cpuStk); // put char back onto cpuStk
  std.emitReadFieldUntil(cpuHas, cpuStk, 44, cpuItemStk, cpuSplit); // ','
  cpuSplit.moveStackToWork(firstCpuStk).branch("eq0", cpuComma, cpuPrintId);
  cpuComma.printLiteral(",").jump(cpuPrintId);

  cpuPrintId.pushInt(0).moveWorkToStack(firstCpuStk);
  cpuPrintId.printLiteral('{"id":');
  std.emitReadFieldUntil(cpuPrintId, cpuItemStk, 58, std.strArg, cpuReadUsage); // ':'
  const afterIdPrint = b.block("cpu_aid");
  std.printStrArg(cpuReadUsage, afterIdPrint);
  afterIdPrint.printLiteral(',"usage":"');
  std.emitReadFieldUntil(afterIdPrint, cpuItemStk, 58, std.strArg, cpuPrintUsage);
  std.printStrArg(cpuPrintUsage, cpuEnd);
  cpuEnd.printLiteral('"}').jump(cpuLoop);

  cpuDone.drop(1).printLiteral('],"memory":{"usedGB":"');

  // Read & print memUsed, memTotal, memPct, zUsed, zTotal, zPct, down, up
  const jsonFields: [string, string][] = [
    ['","totalGB":"', "memUsed"],
    ['","percentage":"', "memTotal"],
    ['"},"zram":{"usedGB":"', "memPct"],
    ['","totalGB":"', "zUsed"],
    ['","percentage":"', "zTotal"],
    ['"},"network":{"down":"', "zPct"],
    ['","up":"', "down"],
    ['"},"uptime":"', "up"],
  ];

  let chain = cpuDone;
  for (let i = 0; i < jsonFields.length; i++) {
    const [suffix, label] = jsonFields[i];
    const readBlk = b.block(`st_rf_${label}`);
    const prBlk = b.block(`st_pr_${label}`);
    std.emitReadFieldUntil(chain, rawStk, 9, std.strArg, readBlk);
    std.printStrArg(readBlk, prBlk);
    prBlk.printLiteral(suffix);
    chain = prBlk;
  }

  // Uptime sec -> formatUptime
  const upParse = b.block("st_up_parse");
  const upCall = b.block("st_up_call");
  const upAfter = b.block("st_up_after");
  std.emitReadFieldUntil(chain, rawStk, 9, std.strArg, upParse);
  std.strArgToInt(upParse, upCall);
  upCall.moveWorkToStack(secValStk).call(fmtUpSub, upAfter);
  upAfter.printLiteral('s","availability":"');

  // Helper to read (up, tot) and call formatAvail
  const emitAvail = (from: HyeongBlock, tag: string): HyeongBlock => {
    const rUp = b.block(`av_rup_${tag}`);
    const pUp = b.block(`av_pup_${tag}`);
    const rTot = b.block(`av_rtot_${tag}`);
    const pTot = b.block(`av_ptot_${tag}`);
    const done = b.block(`av_done_${tag}`);
    std.emitReadFieldUntil(from, rawStk, 9, std.strArg, rUp);
    std.strArgToInt(rUp, pUp);
    pUp.moveWorkToStack(upValStk);
    std.emitReadFieldUntil(pUp, rawStk, 9, std.strArg, rTot);
    std.strArgToInt(rTot, pTot);
    pTot.moveWorkToStack(totValStk).call(fmtAvailSub, done);
    return done;
  };

  const avOracleDone = emitAvail(upAfter, "oracle");
  avOracleDone.printLiteral('"},{"name":"Mini Server","error":"Offline","availability":"');
  const avMiniDone = emitAvail(avOracleDone, "mini");
  avMiniDone.printLiteral('"},{"name":"Sub Server","error":"Offline","availability":"');
  const avTabDone = emitAvail(avMiniDone, "tablet");
  avTabDone.printLiteral('"}]').exitWithChar("}");

  return b.build();
}

function out100Drop(b: HyeongProgramBuilder, out100: HyeongBlock): HyeongBlock {
  const blk = b.block("fa_100_drop");
  blk.drop(1).jump(out100);
  return blk;
}

// ---------------------------------------------------------------------------
// 3. app/api/discord.hyeong — JSON + Dynamic SVG Badge
// ---------------------------------------------------------------------------
function buildDiscordApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const pathStk = b.allocStack();
  const queryStk = b.allocStack();
  const rawStk = b.allocStack();
  const stStk = b.allocStack();
  const userStk = b.allocStack();
  const gnameStk = b.allocStack();
  const idStk = b.allocStack();
  const avStk = b.allocStack();
  const avB64Stk = b.allocStack();
  const isKoStk = b.allocStack();
  const isLightStk = b.allocStack();

  b.entry.pushInt(0).moveWorkToStack(isKoStk);
  b.entry.pushInt(0).moveWorkToStack(isLightStk);

  const sLoc = b.block("dc_sloc");
  const sHost = b.block("dc_shost");
  const rPath = b.block("dc_rpath");
  const rQuery = b.block("dc_rquery");
  const sIp = b.block("dc_sip");
  const rEff = b.block("dc_reff");
  const chkEff = b.block("dc_chkeff");
  const effRes = b.block("dc_effres");
  const noEff = b.block("dc_noeff");
  const hasEff = b.block("dc_haseff");

  std.emitSkipLine(b.entry, sLoc);
  std.emitSkipLine(sLoc, sHost);
  std.emitSkipLine(sHost, rPath);
  std.emitReadLine(rPath, pathStk, rQuery);
  std.emitReadLine(rQuery, queryStk, sIp);
  std.emitSkipLine(sIp, rEff);
  std.emitReadLine(rEff, std.strArg, chkEff);
  std.strEq(chkEff, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  noEff.printLiteral("EFFECT\nlanyard").exitWithChar("\n");

  // Parse 6 tab fields
  const f1 = b.block("dc_f1");
  const f2 = b.block("dc_f2");
  const f3 = b.block("dc_f3");
  const f4 = b.block("dc_f4");
  const f5 = b.block("dc_f5");
  const f6 = b.block("dc_f6");
  const routePath = b.block("dc_route");

  std.emitReadAllTo(hasEff, rawStk, f1);
  std.emitReadFieldUntil(f1, rawStk, 9, stStk, f2);
  std.emitReadFieldUntil(f2, rawStk, 9, userStk, f3);
  std.emitReadFieldUntil(f3, rawStk, 9, gnameStk, f4);
  std.emitReadFieldUntil(f4, rawStk, 9, idStk, f5);
  std.emitReadFieldUntil(f5, rawStk, 9, avStk, f6);
  std.emitReadFieldUntil(f6, rawStk, 9, avB64Stk, routePath);

  const mvPath = b.block("dc_mvpath");
  const chkApi = b.block("dc_chkapi");
  const doJson = b.block("dc_json");
  const doSvg = b.block("dc_svg");
  std.emitCopyStr(routePath, pathStk, std.strArg, b.allocStack(), mvPath);
  std.strEq(mvPath, "/api/discord", chkApi);
  chkApi.branch("eq0", doSvg, doJson);

  // /api/discord JSON
  const j1 = b.block("dc_j1");
  const j2 = b.block("dc_j2");
  const j3 = b.block("dc_j3");
  const j4 = b.block("dc_j4");
  const j5 = b.block("dc_j5");
  const j6 = b.block("dc_j6");
  const j7 = b.block("dc_j7");
  const j8 = b.block("dc_j8");
  const j9 = b.block("dc_j9");
  const j10 = b.block("dc_j10");

  doJson.printLiteral('HTTP\n200\napplication/json; charset=utf-8\n{"success":true,"data":{"discord_status":"');
  std.emitCopyStr(doJson, stStk, std.strArg, b.allocStack(), j1);
  std.printStrArgJson(j1, j2);
  j2.printLiteral('","discord_user":{"username":"');
  std.emitCopyStr(j2, userStk, std.strArg, b.allocStack(), j3);
  std.printStrArgJson(j3, j4);
  j4.printLiteral('","global_name":"');
  std.emitCopyStr(j4, gnameStk, std.strArg, b.allocStack(), j5);
  std.printStrArgJson(j5, j6);
  j6.printLiteral('","id":"');
  std.emitCopyStr(j6, idStk, std.strArg, b.allocStack(), j7);
  std.printStrArgJson(j7, j8);
  j8.printLiteral('","avatar":"');
  std.emitCopyStr(j8, avStk, std.strArg, b.allocStack(), j9);
  std.printStrArgJson(j9, j10);
  j10.printLiteral('"}}').exitWithChar("}");

  // /api/discord-status SVG
  const svgQ = b.block("dc_svgq");
  const svgTheme = b.block("dc_svgt");
  const svgThemeRes = b.block("dc_svgtr");
  const setKo = b.block("dc_setko");
  const setLight = b.block("dc_setlt");
  const svgStart = b.block("dc_svgs");

  std.emitMoveStr(doSvg, queryStk, std.strArg, svgQ);
  const svgKoRes = b.block("dc_svgkor");
  std.strContains(svgQ, "lang=ko", svgKoRes);
  svgKoRes.branch("eq0", svgTheme, setKo);
  setKo.moveStackToWork(isKoStk).drop(1).pushInt(1).moveWorkToStack(isKoStk).jump(svgTheme);

  std.strContains(svgTheme, "theme=light", svgThemeRes);
  svgThemeRes.branch("eq0", svgStart, setLight);
  setLight.moveStackToWork(isLightStk).drop(1).pushInt(1).moveWorkToStack(isLightStk).jump(svgStart);

  const svgStyleL = b.block("dc_stl");
  const svgStyleD = b.block("dc_std");
  const svgAvChk = b.block("dc_avchk");
  const svgAvYes = b.block("dc_avy");
  const svgAvNo = b.block("dc_avn");
  const svgAvPrinted = b.block("dc_avp");

  svgStart.printLiteral('HTTP\n200\nimage/svg+xml; charset=utf-8\n<svg xmlns="http://www.w3.org/2000/svg" width="360" height="96" viewBox="0 0 360 96" fill="none"><defs><clipPath id="av"><circle cx="50" cy="48" r="26"/></clipPath></defs>');
  svgStart.moveStackToWork(isLightStk).branch("eq0", svgStyleD, svgStyleL);
  svgStyleL.printLiteral("<style>.bg{fill:#fff;stroke:#e5e7eb}.t{fill:#111827}.s{fill:#6b7280}.b{stroke:#fff}</style>").jump(svgAvChk);
  svgStyleD.printLiteral("<style>.bg{fill:#090e1a;stroke:#1f2937}.t{fill:#f9fafb}.s{fill:#9ca3af}.b{stroke:#090e1a}</style>").jump(svgAvChk);

  svgAvChk.printLiteral('<rect class="bg" x="0.5" y="0.5" width="359" height="95" rx="16"/>');
  svgAvChk.moveStackToWork(avB64Stk).dup().branch("lt0", svgAvNo, svgAvYes);
  svgAvNo.drop(1).printLiteral('<circle cx="50" cy="48" r="26" fill="#4f46e5"/><text x="50" y="54" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="18" font-weight="700">AK</text>').jump(svgAvPrinted);

  const avP2 = b.block("dc_avp2");
  svgAvYes.moveWorkToStack(avB64Stk);
  svgAvYes.printLiteral('<image href="');
  std.emitMoveStr(svgAvYes, avB64Stk, std.strArg, avP2);
  const avP3 = b.block("dc_avp3");
  std.printStrArg(avP2, avP3);
  avP3.printLiteral('" x="24" y="22" width="52" height="52" clip-path="url(#av)"/>').jump(svgAvPrinted);

  // Status color helper (prints color for stStk)
  const { sub: colorSub, ret: colorRet } = b.subroutine("dc:color");
  {
    const c1 = b.block("dcc_1");
    const c2 = b.block("dcc_2");
    const c3 = b.block("dcc_3");
    const c1r = b.block("dcc_1r");
    const c2r = b.block("dcc_2r");
    const c3r = b.block("dcc_3r");
    const on = b.block("dcc_on");
    const idl = b.block("dcc_idl");
    const dnd = b.block("dcc_dnd");
    const off = b.block("dcc_off");
    std.emitCopyStr(colorSub.entry, stStk, std.strArg, b.allocStack(), c1);
    std.strEq(c1, "online", c1r);
    c1r.branch("eq0", c2, on);
    std.strEq(c2, "idle", c2r);
    c2r.branch("eq0", c3, idl);
    std.strEq(c3, "dnd", c3r);
    c3r.branch("eq0", off, dnd);
    on.printLiteral("#3ba55c").jump(colorRet);
    idl.printLiteral("#faa61a").jump(colorRet);
    dnd.printLiteral("#ed4245").jump(colorRet);
    off.printLiteral("#747f8d").jump(colorRet);
  }

  const afterColor1 = b.block("dc_ac1");
  const printName = b.block("dc_pname");
  const afterName = b.block("dc_aname");
  const afterColor2 = b.block("dc_ac2");
  const printLabel = b.block("dc_plbl");

  svgAvPrinted.printLiteral('<circle class="b" cx="69" cy="67" r="7.5" fill="').call(colorSub, afterColor1);
  afterColor1.printLiteral('" stroke-width="3"/><text class="t" x="92" y="43" font-family="Inter,sans-serif" font-size="16" font-weight="700">');
  std.emitMoveStr(afterColor1, gnameStk, std.strArg, printName);
  std.printStrArgHtml(printName, afterName);
  afterName.printLiteral('</text><circle cx="96" cy="62" r="4" fill="').call(colorSub, afterColor2);
  afterColor2.printLiteral('"/><text class="s" x="106" y="66" font-family="Inter,sans-serif" font-size="13" font-weight="500">');
  std.emitMoveStr(afterColor2, stStk, std.strArg, printLabel);

  const lblKo = b.block("dc_lbl_ko");
  const lblEn = b.block("dc_lbl_en");
  const svgEnd = b.block("dc_svg_end");
  printLabel.moveStackToWork(isKoStk).branch("eq0", lblEn, lblKo);

  const emitLblBranch = (blk: HyeongBlock, map: [string, string, string][]) => {
    const [a, bLbl, c] = map[0];
    const [a2, bLbl2, c2] = map[1];
    const [a3, bLbl3, c3] = map[2];
    const r1 = b.block(`lbl_r1_${blk.id}`);
    const k2 = b.block(`lbl_k2_${blk.id}`);
    const r2 = b.block(`lbl_r2_${blk.id}`);
    const k3 = b.block(`lbl_k3_${blk.id}`);
    const r3 = b.block(`lbl_r3_${blk.id}`);
    const h1 = b.block(`lbl_h1_${blk.id}`);
    const h2 = b.block(`lbl_h2_${blk.id}`);
    const h3 = b.block(`lbl_h3_${blk.id}`);
    const h4 = b.block(`lbl_h4_${blk.id}`);
    std.strEq(blk, a, r1);
    r1.branch("eq0", k2, h1);
    std.strEq(k2, a2, r2);
    r2.branch("eq0", k3, h2);
    std.strEq(k3, a3, r3);
    r3.branch("eq0", h4, h3);
    h1.printLiteral(bLbl).jump(svgEnd);
    h2.printLiteral(bLbl2).jump(svgEnd);
    h3.printLiteral(bLbl3).jump(svgEnd);
    h4.printLiteral(c3).jump(svgEnd);
    void c;
    void c2;
  };
  emitLblBranch(lblKo, [
    ["online", "온라인", ""],
    ["idle", "수면 중", ""],
    ["dnd", "다른 용무 중", "오프라인"],
  ]);
  emitLblBranch(lblEn, [
    ["online", "Online", ""],
    ["idle", "Sleeping", ""],
    ["dnd", "Do Not Disturb", "Offline"],
  ]);

  svgEnd.printLiteral("</text></svg").exitWithChar(">");

  return b.build();
}

// ---------------------------------------------------------------------------
// 4. app/api/server.hyeong
// ---------------------------------------------------------------------------
function buildServerApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const methodStk = b.allocStack();
  const rawStk = b.allocStack();
  const statusStk = b.allocStack();
  const healthStk = b.allocStack();

  const skip4 = (from: HyeongBlock, tag: string): HyeongBlock => {
    let cur = from;
    for (let i = 0; i < 5; i++) {
      const n = b.block(`sv_${tag}_${i}`);
      std.emitSkipLine(cur, n);
      cur = n;
    }
    return cur;
  };

  const afterMethod = b.block("sv_am");
  std.emitReadLine(b.entry, methodStk, afterMethod);
  const rEff = skip4(afterMethod, "s");
  const chkEff = b.block("sv_ce");
  const effRes = b.block("sv_er");
  const noEff = b.block("sv_ne");
  const hasEff = b.block("sv_he");

  std.emitReadLine(rEff, std.strArg, chkEff);
  std.strEq(chkEff, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  // hasEffect == 0
  const neMv = b.block("sv_nemv");
  const neRes = b.block("sv_neres");
  const neGet = b.block("sv_neget");
  const nePost = b.block("sv_nepost");
  const nePostDone = b.block("sv_nepd");
  std.emitCopyStr(noEff, methodStk, std.strArg, b.allocStack(), neMv);
  std.strEq(neMv, "GET", neRes);
  neRes.branch("eq0", nePost, neGet);
  neGet.printLiteral("EFFECT\ndocker_status").exitWithChar("\n");
  nePost.printLiteral("EFFECT\nserver_action\n");
  std.emitStreamStdinRest(nePost, nePostDone);
  nePostDone.exitWithChar("\n");

  // hasEffect == 1
  const heMv = b.block("sv_hemv");
  const heRes = b.block("sv_heres");
  const heGet = b.block("sv_heget");
  const hePost = b.block("sv_hepost");
  std.emitMoveStr(hasEff, methodStk, std.strArg, heMv);
  std.strEq(heMv, "GET", heRes);
  heRes.branch("eq0", hePost, heGet);

  // GET response
  const g1 = b.block("sv_g1");
  const g2 = b.block("sv_g2");
  const g3 = b.block("sv_g3");
  const g4 = b.block("sv_g4");
  const g5 = b.block("sv_g5");
  const g6 = b.block("sv_g6");
  std.emitReadAllTo(heGet, rawStk, g1);
  std.emitReadFieldUntil(g1, rawStk, 9, statusStk, g2);
  std.emitReadFieldUntil(g2, rawStk, 9, healthStk, g3);
  g3.printLiteral('HTTP\n200\napplication/json; charset=utf-8\n{"status":"');
  std.emitMoveStr(g3, statusStk, std.strArg, g4);
  std.printStrArgJson(g4, g5);
  g5.printLiteral('","health":"');
  std.emitMoveStr(g5, healthStk, std.strArg, g6);
  const g7 = b.block("sv_g7");
  std.printStrArgJson(g6, g7);
  g7.printLiteral('"').exitWithChar("}");

  // POST response: detect status 401/400/503
  const pRead = b.block("sv_pr");
  const pC401 = b.block("sv_401");
  const pC400 = b.block("sv_400");
  const pC503 = b.block("sv_503");
  const p200 = b.block("sv_p200");
  const p401 = b.block("sv_p401");
  const p400 = b.block("sv_p400");
  const p503 = b.block("sv_p503");
  const pBody = b.block("sv_pbody");
  const pDone = b.block("sv_pdone");

  std.emitReadAllTo(hePost, std.strArg, pRead);
  std.strContains(pRead, '"status":401', pC401);
  pC401.branch("eq0", pC400, p401);
  const pR400 = b.block("sv_r400");
  std.strContains(pC400, '"status":400', pR400);
  pR400.branch("eq0", pC503, p400);
  const pR503 = b.block("sv_r503");
  std.strContains(pC503, '"status":503', pR503);
  pR503.branch("eq0", p200, p503);

  p200.printLiteral("HTTP\n200\napplication/json; charset=utf-8\n").jump(pBody);
  p401.printLiteral("HTTP\n401\napplication/json; charset=utf-8\n").jump(pBody);
  p400.printLiteral("HTTP\n400\napplication/json; charset=utf-8\n").jump(pBody);
  p503.printLiteral("HTTP\n503\napplication/json; charset=utf-8\n").jump(pBody);
  std.printStrArg(pBody, pDone);
  pDone.exitWithChar("\n");

  return b.build();
}

// ---------------------------------------------------------------------------
// 5. app/api/ddns.hyeong
// ---------------------------------------------------------------------------
function buildDdnsApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const methodStk = b.allocStack();
  const pathStk = b.allocStack();
  const ipStk = b.allocStack();

  const s1 = b.block("dd_s1");
  const s2 = b.block("dd_s2");
  const rPath = b.block("dd_rp");
  const sQ = b.block("dd_sq");
  const rIp = b.block("dd_rip");
  const rEff = b.block("dd_reff");

  std.emitReadLine(b.entry, methodStk, s1);
  std.emitSkipLine(s1, s2);
  std.emitSkipLine(s2, rPath);
  std.emitReadLine(rPath, pathStk, sQ);
  std.emitSkipLine(sQ, rIp);
  std.emitReadLine(rIp, ipStk, rEff);

  const chkMyIp = b.block("dd_myip_c");
  const chkMyIpRes = b.block("dd_myip_r");
  const doMyIp = b.block("dd_myip_do");
  const notMyIp = b.block("dd_not_myip");

  std.emitReadLine(rEff, std.strArg, chkMyIp); // strArg = hasEffect
  // Check pathStk == "/api/ddns/myip" first via temp
  const pathChk = b.block("dd_pc");
  const effStk = b.allocStack();
  std.emitMoveStr(chkMyIp, std.strArg, effStk, pathChk);
  std.emitMoveStr(pathChk, pathStk, std.strArg, chkMyIpRes);
  const myIpFlag = b.block("dd_myip_f");
  std.strEq(chkMyIpRes, "/api/ddns/myip", myIpFlag);
  myIpFlag.branch("eq0", notMyIp, doMyIp);

  const myIpP1 = b.block("dd_mp1");
  const myIpP2 = b.block("dd_mp2");
  doMyIp.printLiteral('HTTP\n200\napplication/json; charset=utf-8\n{"ip":"');
  std.emitMoveStr(doMyIp, ipStk, std.strArg, myIpP1);
  std.printStrArgJson(myIpP1, myIpP2);
  myIpP2.printLiteral('"').exitWithChar("}");

  const effChk = b.block("dd_ec");
  const effRes = b.block("dd_er");
  const noEff = b.block("dd_ne");
  const hasEff = b.block("dd_he");
  std.emitMoveStr(notMyIp, effStk, std.strArg, effChk);
  std.strEq(effChk, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  const neMv = b.block("dd_nemv");
  const neRes = b.block("dd_ner");
  const neGet = b.block("dd_neget");
  const nePost = b.block("dd_nepost");
  const nePostD = b.block("dd_nepd");
  std.emitMoveStr(noEff, methodStk, std.strArg, neMv);
  std.strEq(neMv, "GET", neRes);
  neRes.branch("eq0", nePost, neGet);
  neGet.printLiteral("EFFECT\nddns\nGE").exitWithChar("T");
  nePost.printLiteral("EFFECT\nddns\n");
  std.emitStreamStdinRest(nePost, nePostD);
  nePostD.exitWithChar("\n");

  const heD = b.block("dd_hed");
  hasEff.printLiteral("HTTP\n200\napplication/json; charset=utf-8\n");
  std.emitStreamStdinRest(hasEff, heD);
  heD.exitWithChar("\n");

  return b.build();
}

// ---------------------------------------------------------------------------
// 6. app/api/hosting.hyeong
// ---------------------------------------------------------------------------
function buildHostingApi(): string {
  const b = new HyeongProgramBuilder();
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const pathStk = b.allocStack();
  const s1 = b.block("ho_s1");
  const s2 = b.block("ho_s2");
  const s3 = b.block("ho_s3");
  const rPath = b.block("ho_rp");
  const sQ = b.block("ho_sq");
  const sIp = b.block("ho_sip");
  const rEff = b.block("ho_reff");

  std.emitSkipLine(b.entry, s1);
  std.emitSkipLine(s1, s2);
  std.emitSkipLine(s2, s3);
  std.emitReadLine(s3, pathStk, rPath);
  std.emitSkipLine(rPath, sQ);
  std.emitSkipLine(sQ, sIp);
  std.emitReadLine(sIp, std.strArg, rEff);

  const effRes = b.block("ho_er");
  const noEff = b.block("ho_ne");
  const hasEff = b.block("ho_he");
  std.strEq(rEff, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  const neMv = b.block("ho_nemv");
  const neRes = b.block("ho_ner");
  const neImg = b.block("ho_neimg");
  const neDel = b.block("ho_nedel");
  const neDelD = b.block("ho_nedeld");
  std.emitMoveStr(noEff, pathStk, std.strArg, neMv);
  std.strEq(neMv, "/api/images", neRes);
  neRes.branch("eq0", neDel, neImg);
  neImg.printLiteral("EFFECT\nhosting\nlis").exitWithChar("t");
  neDel.printLiteral("EFFECT\nhosting\n");
  std.emitStreamStdinRest(neDel, neDelD);
  neDelD.exitWithChar("\n");

  const heRead = b.block("ho_her");
  const heChk = b.block("ho_hechk");
  const he200 = b.block("ho_200");
  const he401 = b.block("ho_401");
  const heOut = b.block("ho_out");
  const heDone = b.block("ho_done");
  std.emitReadAllTo(hasEff, std.strArg, heRead);
  std.strContains(heRead, '"status":401', heChk);
  heChk.branch("eq0", he200, he401);
  he200.printLiteral("HTTP\n200\napplication/json; charset=utf-8\n").jump(heOut);
  he401.printLiteral("HTTP\n401\napplication/json; charset=utf-8\n").jump(heOut);
  std.printStrArg(heOut, heDone);
  heDone.exitWithChar("\n");

  return b.build();
}

// ---------------------------------------------------------------------------
// 7. app/api/hyeong.hyeong — Playground Runner & .hyeong Source Inspector!
// ---------------------------------------------------------------------------
function buildHyeongApi(): string {
  const b = new HyeongProgramBuilder({ preloadMaxLines: 7 });
  const std = new HyeongStdlib(b);
  std.initStacks(b.entry);

  const pathStk = b.allocStack();
  const queryStk = b.allocStack();
  const s1 = b.block("hy_s1");
  const s2 = b.block("hy_s2");
  const s3 = b.block("hy_s3");
  const rPath = b.block("hy_rp");
  const rQuery = b.block("hy_rq");
  const sIp = b.block("hy_sip");
  const rEff = b.block("hy_reff");

  std.emitSkipLine(b.entry, s1);
  std.emitSkipLine(s1, s2);
  std.emitSkipLine(s2, s3);
  std.emitReadLine(s3, pathStk, rPath);
  std.emitReadLine(rPath, queryStk, rQuery);
  std.emitSkipLine(rQuery, sIp);
  std.emitReadLine(sIp, std.strArg, rEff);

  const effRes = b.block("hy_er");
  const noEff = b.block("hy_ne");
  const hasEff = b.block("hy_he");
  std.strEq(rEff, "0", effRes);
  effRes.branch("eq0", hasEff, noEff);

  const neMv = b.block("hy_nemv");
  const neRes = b.block("hy_ner");
  const neRun = b.block("hy_nerun");
  const neSrc = b.block("hy_nesrc");
  std.emitMoveStr(noEff, pathStk, std.strArg, neMv);
  std.strEq(neMv, "/api/hyeong/run", neRes);
  neRes.branch("eq0", neSrc, neRun);
  neRun.printLiteral("EFFECT\nhyeong_eval\n").exitStreamingStdin();

  // Parse ?file=... from queryStk
  const qLoop = b.block("hy_qloop");
  const qMore = b.block("hy_qmore");
  const qChk = b.block("hy_qchk");
  const qRes = b.block("hy_qres");
  const qFound = b.block("hy_qfound");
  const qNotFound = b.block("hy_qnf");
  neSrc.jump(qLoop);
  qLoop.moveStackToWork(queryStk).dup().branch("lt0", qNotFound, qMore);
  qMore.moveWorkToStack(queryStk);
  std.emitReadFieldUntil(qMore, queryStk, 38, std.strArg, qChk); // '&'
  std.strStartsWith(qChk, "file=", qRes);
  qRes.branch("eq0", qLoop, qFound);

  // Drop 5 chars ("file=") from std.strArg
  for (let i = 0; i < 5; i++) {
    qFound.moveStackToWork(std.strArg).drop(1);
  }
  const qOut = b.block("hy_qout");
  qFound.printLiteral("EFFECT\nhyeong_source\n");
  std.printStrArg(qFound, qOut);
  qOut.exitWithChar("\n");

  qNotFound.drop(1).printLiteral("EFFECT\nhyeong_source\nlis").exitWithChar("t");

  hasEff.printLiteral("HTTP\n200\napplication/json; charset=utf-8\n").exitStreamingStdin();

  return b.build();
}

const t0 = performance.now();
writeHyeong("router.hyeong", buildRouter());
writeHyeong("api/ip.hyeong", buildIpApi());
writeHyeong("api/status.hyeong", buildStatusApi());
writeHyeong("api/discord.hyeong", buildDiscordApi());
writeHyeong("api/server.hyeong", buildServerApi());
writeHyeong("api/ddns.hyeong", buildDdnsApi());
writeHyeong("api/hosting.hyeong", buildHostingApi());
writeHyeong("api/hyeong.hyeong", buildHyeongApi());
console.log(`Generated router.hyeong + 7 app/api/*.hyeong modules in ${(performance.now() - t0).toFixed(1)} ms!`);
