const fs = require('fs');
const filePath = 'src/hooks/useGameLoop.js';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Line-based replacements (1-indexed)
const lineMap = {
    1166: '                // 贸易',
    1204: '                // 游戏速度（强制归一化）',
    1365: '                // 如果薪水为负数，则从官员那里收取费用（需要在simulation中处理官员财富扣除）',
    1372: '                    // 负薪酬：从官员那里收钱到国库',
    1374: '                    // 这里先记录预期收入（负数），实际收入会在simulation中更新',
    1375: '                    officialSalaryPaid = officialDailySalary; // 负数表示预期收入',
    1383: '                // 计算补贴对各阶层财富的增加量（稍后合并到 adjustedClassWealth）',
    1425: "                // console.group('\uD83D\uDCB5 [财政详情] Tick ' + (current.daysElapsed || 0));",
    1438: "                // if (breakdown.tradeRouteTax) console.log('  贸易路线税收:', breakdown.tradeRouteTax.toFixed(2));",
    1461: '                // 注意：simulation.js中已经处理了资源购买、时代加成、规模惩罚、军饷倍率',
    1676: '                // ========== 附庸每日更新（朝贡与独立倾向）- 移到主setResources之前 ==========',
    1743: "                console.log('\uD83D\uDD34\uD83D\uDD34\uD83D\uDD34 [DEBUG-CHECKPOINT] 财政日志结束，继续执行..');",
    1841: '                // 将补贴增量添加到阶层财富',
    1988: '                            // 本周期处理完毕，清空 lastProcessDay',
    2028: '                // 条约维护费已在 simulation 内统一扣除并记账，避免主线程重复扣减',
    2030: '                // [MOVED] 附庸每日更新已移至主 setResources 调用之前，避免产生对账差额',
    4922: "                        if (log.startsWith('\uD83D\uDCE6 商人贸易完成')) {",
    5465: '                                                    // 为每个阶层添加补贴效果',
    5844: '                            // 检测AI贸易事件（资源变化已在simulation中处理，这里只需记录和显示）',
};

let count = 0;
for (const [lineNumStr, replacement] of Object.entries(lineMap)) {
    const idx = parseInt(lineNumStr) - 1;
    if (idx >= 0 && idx < lines.length) {
        lines[idx] = replacement;
        count++;
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Round 3: Replaced ' + count + ' lines directly');

// Verify
const finalLines = fs.readFileSync(filePath, 'utf8').split('\n');
let remaining = 0;
const garbledRe = /[\u9519\u7490\u94b1\u5ef4\u5a13\u81b3\u6930\u7ebc\u8191\u6e3e\u580e\u9c9d\u5d7d\u80f3\u58a8\u6da8\u5ce8\u93c6]/;
finalLines.forEach((line, i) => {
    if (garbledRe.test(line)) {
        remaining++;
        if (remaining <= 20) console.log('  L' + (i+1) + ': ' + line.trim().substring(0, 100));
    }
});
console.log('Remaining: ' + remaining);
