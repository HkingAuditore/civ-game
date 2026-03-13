const fs = require('fs');
const filePath = 'src/hooks/useGameLoop.js';
let content = fs.readFileSync(filePath, 'utf8');

// Direct string replacements - garbled -> correct
// Using the exact garbled strings found in the file
const pairs = [
    // L1164
    ['// [NEW] \u7d2f\u7a4d\u7a0e\u6536\u51b2\u51fb\u5386\u53f2', '// [NEW] \u7D2F\u79EF\u7A0E\u6536\u51B2\u51FB\u5386\u53F2'],
    // Already fixed above, but these are new ones:
    // L1378
    ['\u6f14\u5904\u7406\u5f3a\u5236\u8865\u8d34\u6548\u679c\uff08\u6bcf\u65e5\u4ece\u56fd\u5e93\u652f\u4ed8\u7ed9\u6307\u5b9a\u9636\u5c42\uff09', '\u5904\u7406\u5F3A\u5236\u8865\u8D34\u6548\u679C\uFF08\u6BCF\u65E5\u4ECE\u56FD\u5E93\u652F\u4ED8\u7ED9\u6307\u5B9A\u9636\u5C42\uFF09'],
];

// More reliable: use line-by-line replacement with garbled detection
const lines = content.split('\n');

// Garbled character detection regex - these are common mojibake patterns
const garbledRe = /[\u93c6\u7490\u94b1\u5ef4\u5a13\u81b3\u6930\u7ebc\u8191\u6e3e\u580e\u9c9d\u5d7d\u80f3\u58a8\u6da8\u5ce8\u9519\u8d70]/;

// Line-specific replacements (1-based line numbers -> replacement text)
// We'll find remaining garbled lines and replace them
const fixes = {};

// Scan and collect all garbled lines with their fixes
lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (!garbledRe.test(line)) return;
    
    const trimmed = line.trim();
    
    // Skip non-comment lines (don't touch code)
    // But some garbled content is in string literals inside console.log, we should fix those too
    
    // Map known garbled patterns
    const knownFixes = {
        // 1164 - already fixed
        // 1378
        '// \u6f14\u5904\u7406\u5f3a\u5236\u8865\u8d34\u6548\u679c': '// \u5904\u7406\u5F3A\u5236\u8865\u8D34\u6548\u679C',
        
        // Fiscal log comments (L1425-1440) - these are commented out console.logs, fix inline
        // L1425
        "// console.group('\ud83d\udcb0 [\u8d22\u653f\u8be6\u60c5] Tick '": "// console.group('\uD83D\uDCB0 [\u8D22\u653F\u8BE6\u60C5] Tick '",
        // L1426
        "// console.log('\ud83c\udfe0 \u56fd\u5e93\u8d77\u59cb\u4f59\u989d:'": "// console.log('\uD83C\uDFE0 \u56FD\u5E93\u8D77\u59CB\u4F59\u989D:'",
        // L1428
        '// \u4ece simulation \u8fd4\u56de\u7684\u7a0e\u6536\u6570\u636e': '// \u4ECEsimulation\u8FD4\u56DE\u7684\u7A0E\u6536\u6570\u636E',
    };
});

// Simpler approach: just do direct string replacements for all known garbled strings
const directReplacements = [
    // L1378 - 处理强制补贴
    ['// 澶勭悊寮哄埗琛ヨ创鏁堟灉锛堟瘡鏃ヤ粠鍥藉簱鏀粯缁欐寚瀹氶樁灞傦級', '// 处理强制补贴效果（每日从国库支付给指定阶层）'],
    // L1383
    ['// 璁＄畻琛ヨ创瀵瑰悇闃跺眰璐㈠瘜鐨勫鍔犻噺锛堢◇鍚庡悎骞跺埌 adjustedClassWealth锛?', '// 计算补贴对各阶层财富的增加量（稍后合并到 adjustedClassWealth）'],
    // L1399
    ['// 璁板綍闃跺眰璐㈠瘜澧炲姞閲?', '// 记录阶层财富增加量'],
    // L1420-1421
    ['// === 璇︾粏璐㈡斂鏃ュ織 ===', '// === 详细财政日志 ==='],
    ['// 璁板綍鎵€鏈夊奖鍝嶅浗搴撶殑鏀跺叆鍜屾敮鍑洪」', '// 记录所有影响国库的收入和支出项'],
    // L1425 - commented out console.group
    ["// console.group('\ud83d\udcb5 [\u8d22\u653f\u8be6\u60c5] Tick '", "// console.group('\uD83D\uDCB5 [\u8D22\u653F\u8BE6\u60C5] Tick '"],
    // L1426
    ["// console.log('\ud83c\udfe0 \u56fd\u5e93\u8d77\u59cb\u4f59\u989d:'", "// console.log('\uD83C\uDFE0 \u56FD\u5E93\u8D77\u59CB\u4F59\u989D:'"],
    // L1428
    ['// 浠巗imulation杩斿洖鐨勭◣鏀舵暟鎹?', '// 从simulation返回的税收数据'],
    // L1432-1440 commented out console.logs
    ["// console.group('\ud83d\udcc8 鏀跺叆椤?);", "// console.group('\uD83D\uDCC8 收入项');"],
    ['//   浜哄ご绋?', '//   人头税:'],
    ['//   浜ゆ槗绋?', '//   交易税:'],
    ['//   钀ヤ笟绋?', '//   营业税:'],
    ['//   鍏崇◣:', '//   关税:'],
    ['//   鎴樹簤璧旀鏀跺叆:', '//   战争赔款收入:'],
    ['//   璐告槗璺嚎绋庢敹:', '//   贸易路线税收:'],
    ['//   鏀夸护鏀剁泭:', '//   政令收益:'],
    ['//   浠锋牸绠″埗鏀跺叆:', '//   价格管制收入:'],
    // L1460-1461
    ['// === 鍐涢槦鏀嚭锛堜娇鐢╯imulation杩斿洖鐨勭湡瀹炴暟鎹級===', '// === 军队支出（使用simulation返回的真实数据）==='],
    ['// 娉ㄦ剰锛歴imulation.js涓凡缁忓鐞嗕簡璧勬簮璐拱銆佹椂浠ｅ姞鎴愩€佽妯℃儵缃氥€佸啗楗峰€嶇巼', '// 注意：simulation.js中已经处理了资源购买、时代加成、规模惩罚、军饷倍率'],
    // L1676-1678
    ['// ========== 闄勫焊姣忔棩鏇存柊锛堟湞璐′笌鐙珛鍊惧悜锛?- 绉诲埌涓籹etResources涔嬪墠 ==========', '// ========== 附庸每日更新（朝贡与独立倾向）- 移到主setResources之前 =========='],
    ['// [FIX] 灏嗛檮搴告湞璐℃敹鍏ュ拰鎺у埗鎴愭湰鏁村悎鍒?adjustedResources 鍜?auditEntries 涓?', '// [FIX] 将附庸朝贡收入和控制成本整合到 adjustedResources 和 auditEntries 中'],
    ['// 閬垮厤浜х敓宸ㄥぇ鐨?瀵硅处宸"', '// 避免产生巨大的"对账差额"'],
    // L1742-1743
    ['// === 璐㈡斂鏃ュ織缁撴潫 ===', '// === 财政日志结束 ==='],
    ["console.log('\ud83d\udd34\ud83d\udd34\ud83d\udd34 [DEBUG-CHECKPOINT] 璐㈡斂鏃ュ織缁撴潫锛岀户缁墽琛?..');", "console.log('\uD83D\uDD34\uD83D\uDD34\uD83D\uDD34 [DEBUG-CHECKPOINT] 财政日志结束，继续执行..');"],
    // L1839-1841
    ['// 鍒涘缓闃跺眰璐㈠瘜瀵硅薄锛屽悎骞惰ˉ璐磋浆璐?', '// 创建阶层财富对象，合并补贴转账'],
    ['// 灏嗚ˉ璐村閲忔坊鍔犲埌闃跺眰璐㈠瘜', '// 将补贴增量添加到阶层财富'],
    // L1988
    ['// 鏈懆鏈熷鐞嗗畬姣曪紝娓呯┖ lastProcessDay', '// 本周期处理完毕，清空 lastProcessDay'],
    // L2028-2032
    ['// 鏉＄害缁存姢璐瑰凡鍦?simulation 鍐呯粺涓€鎵ｉ櫎骞惰璐︼紝閬垮厤涓荤嚎绋嬮噸澶嶆墸鍑忋€?', '// 条约维护费已在 simulation 内统一扣除并记账，避免主线程重复扣减'],
    ['// [MOVED] 闄勫焊姣忔棩鏇存柊宸茬Щ鑷充富 setResources 璋冪敤涔嬪墠锛岄伩鍏嶄骇鐢熷璐﹀樊棰?', '// [MOVED] 附庸每日更新已移至主 setResources 调用之前，避免产生对账差额'],
    ['// ========== 瀹樺憳鎴愰暱绯荤粺锛堟瘡鏃ョ粡楠屼笌鍗囩骇锛?==========', '// ========== 官员成长系统（每日经验与升级）=========='],
    // L4195-4198
    ['// 鎵ф斂鑱旂洘', '// 执政联盟'],
    ['difficultyLevel: current.difficulty, // 娓告垙闅惧害', 'difficultyLevel: current.difficulty, // 游戏难度'],
    ['// [NEW] 缁勭粐搴﹀闀夸慨姝?', '// [NEW] 组织度增长修正'],
    ['// 娉ㄦ剰锛歝lassInfluence/totalInfluence 宸叉槸浣嶇疆鍙傛暟锛屾棤闇€鍦ㄦ閲嶅', '// 注意：classInfluence/totalInfluence 已是位置参数，无需在此重复'],
    // L4922
    ["if (log.startsWith('\ud83d\udce6 鍟嗕汉璐告槗瀹屾垚'))", "if (log.startsWith('\uD83D\uDCE6 商人贸易完成'))"],
    // L5423
    ['// 灏嗛挶鎸夋瘮渚嬭浆鍏ュ悇闃跺眰璐㈠瘜', '// 将钱按比例转入各阶层财富'],
    // L5465
    ['// 涓烘瘡涓樁灞傛坊鍔犺ˉ璐存晥鏋?', '// 为每个阶层添加补贴效果'],
    // L5844
    ['// 妫€娴婣I璐告槗浜嬩欢锛堣祫婧愬彉鍖栧凡鍦╯imulation涓鐞嗭紝杩欓噷鍙渶璁板綍鍜屾樉绀猴級', '// 检测AI贸易事件（资源变化已在simulation中处理，这里只需记录和显示）'],
    // L5851
    ['// 灏嗗叧绋庤鍏radeStats锛屾樉绀哄湪璐㈡斂闈㈡澘涓?', '// 将关税记入tradeStats，显示在财政面板中'],
    // L5856-5857
    ['// 鐢熸垚璇︾粏鐨勮锤鏄撴棩蹇楋紙鐜╁鏀垮簻鍙敹鍏崇◣锛?', '// 生成详细的贸易日志（玩家政府只收关税）'],
    ['// 杩欎簺灞炰簬鈥滆锤鏄撹矾绾?甯傚満璐告槗鈥濈被鏃ュ織锛屽彈 showTradeRouteLogs 鎺у埗', '// 这些属于"贸易路线/市场贸易"类日志，受 showTradeRouteLogs 控制'],
    // L5860
    ['// 鐜╁鍑哄彛锛氳祫婧愬噺灏戯紝鍙敹鍏崇◣', '// 玩家出口：资源减少，可收关税'],
    // L6929
    ['}, tickInterval); // 鏍规嵁娓告垙閫熷害鍔ㄦ€佽皟鏁存墽琛岄鐜?', '}, tickInterval); // 根据游戏速度动态调整执行频率'],
    // L6931
    ['// 渚濊禆娓告垙閫熷害銆佹殏鍋滅姸鎬佸拰搴嗗吀鐩稿叧鐘舵€?', '// 依赖游戏速度、暂停状态和庆典相关状态'],
];

let count = 0;
for (const [garbled, correct] of directReplacements) {
    if (content.includes(garbled)) {
        content = content.split(garbled).join(correct);
        count++;
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Round 2: Fixed ' + count + ' garbled patterns');

// Verify remaining
const verifyLines = content.split('\n');
let remaining = 0;
verifyLines.forEach((line, i) => {
    // Check for common garbled chars
    if (/[\u93c6\u7490\u94b1\u5ef4\u5a13\u81b3\u6930\u7ebc\u8191\u6e3e\u580e\u9c9d\u5d7d\u80f3]/.test(line)) {
        remaining++;
        if (remaining <= 20) {
            console.log('  Still garbled L' + (i+1) + ': ' + line.trim().substring(0, 120));
        }
    }
});
console.log('Remaining garbled lines: ' + remaining);
