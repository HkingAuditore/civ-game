// Fix garbled GBK comments in useGameLoop.js
// Strategy: match lines containing garbled characters and replace entire comment
const fs = require('fs');
const filePath = 'src/hooks/useGameLoop.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Map: line number (1-based) -> replacement content
// We read the garbled lines and replace them with correct Chinese
const lineReplacements = {
    1: '// \u6E38\u620F\u5FAA\u73AF\u94A9\u5B50',
    2: '// \u5904\u7406\u6E38\u620F\u7684\u6838\u5FC3\u5FAA\u73AF\u903B\u8F91\uFF0C\u5305\u62EC\u8D44\u6E90\u751F\u4EA7\u3001\u4EBA\u53E3\u589E\u957F\u7B49',
    65: '// \u53DB\u4E71\u4E8B\u4EF6\uFF08\u4FDD\u7559\u4E8B\u4EF6\u521B\u5EFA\u51FD\u6570\uFF09',
    179: ' * \u6839\u636E\u53EF\u7528\u58EB\u5175\u6570\u91CF\u540C\u6B65\u73B0\u5F79\u90E8\u961F\u4E0E\u8BAD\u7EC3\u961F\u5217',
    180: ' * [FIX] \u79FB\u9664 autoRecruitEnabled \u53C2\u6570 - \u4EBA\u53E3\u4E0D\u8DB3\u89E3\u6563\u4E0D\u518D\u89E6\u53D1\u81EA\u52A8\u8865\u5175',
    210: '    // [FIX] \u51CF\u5C0F\u5BB9\u5DEE\u503C\uFF0C\u9632\u6B62\u957F\u671F\u8D85\u5458\u5BFC\u81F4\u65E0\u9650\u7206\u5175',
    211: '    // \u53EA\u4FDD\u75591\u70B9\u5BB9\u5DEE\u7528\u4E8E\u5904\u7406\u6BD5\u4E1A\u65F6\u7684\u65F6\u5E8F\u95EE\u9898',
    245: '    // [FIX] \u79FB\u9664 unitsToRequeue \u903B\u8F91 - \u4EBA\u53E3\u4E0D\u8DB3\u5BFC\u81F4\u7684\u89E3\u6563\u4E0D\u5E94\u89E6\u53D1\u81EA\u52A8\u8865\u5175',
    246: '    // \u53EA\u6709\u6218\u6597\u635F\u5931(\u901A\u8FC7 AUTO_REPLENISH_LOSSES \u65E5\u5FD7)\u624D\u5E94\u89E6\u53D1\u81EA\u52A8\u8865\u5175',
    248: '    // [FIX] \u51CF\u5C0F\u5BB9\u5DEE\u503C\uFF0C\u53EA\u4E3A\u5373\u5C06\u6BD5\u4E1A\u7684\u5355\u4F4D\u4FDD\u7559\u5BB9\u5DEE',
    249: '    // \u57FA\u7840\u5BB9\u5DEE\u4ECE3\u51CF\u52301\uFF0C\u9632\u6B62\u957F\u671F\u8D85\u5458\u5BFC\u81F4\u65E0\u9650\u7206\u5175',
    270: '        // [FIX] \u79FB\u9664\u81EA\u52A8\u91CD\u65B0\u6392\u961F\u903B\u8F91 - \u4EBA\u53E3\u4E0D\u8DB3\u5BFC\u81F4\u7684\u89E3\u6563\u662F\u771F\u6B63\u7684\u89E3\u6563',
    271: '        // \u4E0D\u5E94\u8BE5\u6D88\u8017\u8D44\u6E90\u91CD\u65B0\u62DB\u52DF\uFF0C\u8FD9\u6837\u505A\u4F1A\u5BFC\u81F4\u65E0\u9650\u5FAA\u73AF',
};

let changeCount = 0;

for (const [lineNumStr, replacement] of Object.entries(lineReplacements)) {
    const lineIdx = parseInt(lineNumStr) - 1;
    if (lineIdx >= 0 && lineIdx < lines.length) {
        lines[lineIdx] = replacement;
        changeCount++;
    }
}

// Now handle the remaining garbled lines by scanning for them
// Pattern: lines that start with // or * and contain common garbled character sequences
const garbledChars = [
    '\u93C6', '\u7490', '\u94B1', '\u5EF4', '\u5A13', '\u81B3',
    '\u6930', '\u7EBC', '\u8191', '\u6E3E', '\u580E', '\u9C9D',
    '\u5D7D', '\u80F3', '\u58A8', '\u6DA8', '\u5CE8'
];

// Build a regex to detect garbled content
const garbledRegex = new RegExp('[' + garbledChars.join('') + ']');

// More targeted: replace known garbled patterns at specific line ranges
const moreReplacements = [
    // Line 280: training time comment
    [280, /\[NEW\].*$/, '[NEW] \u8BB0\u5F55\u8BAD\u7EC3\u65F6\u95F4\u7528\u4E8E\u91CD\u65B0\u6392\u961F'],
    // Lines 486-491: JSDoc
    [486, /^.*$/, ' * \u6E38\u620F\u5FAA\u73AF\u94A9\u5B50'],
    [487, /^.*$/, ' * \u5904\u7406\u6E38\u620F\u7684\u6838\u5FC3\u5FAA\u73AF\u903B\u8F91'],
    [488, /^.*$/, ' * @param {Object} gameState - \u6E38\u620F\u72B6\u6001\u5BF9\u8C61'],
    [489, /^.*$/, ' * @param {Function} addLog - \u6DFB\u52A0\u65E5\u5FD7\u51FD\u6570'],
    [490, /^.*$/, ' * @param {Object} actions - \u6E38\u620F\u64CD\u4F5C\u51FD\u6570\u96C6'],
    // Line 511: price controls
    [511, /priceControls,.*$/, 'priceControls, // [NEW] \u4EF7\u683C\u7BA1\u5236\u8BBE\u7F6E'],
    // Line 535
    [535, /setApprovalBreakdown,.*$/, 'setApprovalBreakdown, // [NEW] \u7528\u4E8E\u4FDD\u5B58 simulation \u8FD4\u56DE\u7684\u6EE1\u610F\u5EA6\u5206\u89E3\u6570\u636E'],
    // Lines 629-636
    [629, /setModifiers,.*$/, 'setModifiers, // \u4FEE\u6B63\u503C\u66F4\u65B0\u51FD\u6570'],
    [630, /difficulty,.*$/, 'difficulty, // \u6E38\u620F\u96BE\u5EA6'],
    [631, /officials,.*$/, 'officials, // \u5B98\u5458\u7CFB\u7EDF'],
    [632, /setOfficials,.*$/, 'setOfficials, // \u5B98\u5458\u72B6\u6001\u66F4\u65B0\u51FD\u6570'],
    [635, /officialCapacity,.*$/, 'officialCapacity, // \u5B98\u5458\u5BB9\u91CF'],
    [636, /setOfficialCapacity,.*$/, 'setOfficialCapacity, // \u5B98\u5458\u5BB9\u91CF\u66F4\u65B0\u51FD\u6570'],
    [643, /overseasInvestments,.*$/, 'overseasInvestments, // \u6D77\u5916\u6295\u8D44\u5217\u8868'],
    [644, /setOverseasInvestments,.*$/, 'setOverseasInvestments, // \u6D77\u5916\u6295\u8D44\u66F4\u65B0\u51FD\u6570'],
    [646, /foreignInvestments,.*$/, 'foreignInvestments, // [NEW] \u7528\u4E8E simulation \u8BA1\u7B97'],
    [704, /legitimacy,.*$/, 'legitimacy, // \u5F53\u524D\u5408\u6CD5\u6027\u503C'],
    [705, /difficulty,.*$/, 'difficulty, // \u6E38\u620F\u96BE\u5EA6'],
    [707, /officialCapacity,.*$/, 'officialCapacity, // [FIX] \u6DFB\u52A0\u5B98\u5458\u5BB9\u91CF\uFF0C\u7528\u4E8E getCabinetStatus \u8BA1\u7B97'],
    [714, /priceControls,.*$/, 'priceControls, // [NEW] \u4EF7\u683C\u7BA1\u5236\u8BBE\u7F6E'],
    [733, /.*$/, '    // [NEW] \u6D77\u5916\u6295\u8D44\u5206\u6279\u5904\u7406\u72B6\u6001\u8FFD\u8E2A'],
    [738, /.*$/, '    // \u4F7F\u7528 Ref \u5B58\u50A8\u9AD8\u9891\u66F4\u65B0\u7684\u5386\u53F2\u6570\u636E\uFF0C\u907F\u514D\u6BCF\u5E27\u89E6\u53D1 React \u91CD\u6E32\u67D3'],
    [739, /.*$/, '    // \u4EC5\u5728\u8282\u6D41\u95F4\u9694\u5230\u8FBE\u65F6\u540C\u6B65\u5230 State \u4F9B UI \u663E\u793A'],
    [749, /.*$/, '    // \u521D\u59CB\u5316/\u540C\u6B65 Ref'],
    [752, /.*$/, '    }, []); // \u4EC5\u6302\u8F7D\u65F6\u540C\u6B65\uFF0C\u540E\u7EED\u7531 loop \u7EF4\u62A4'],
    [771, /.*$/, '    const HISTORY_UPDATE_INTERVAL = 5; // \u6BCF5\u4E2Atick\u540C\u6B65\u4E00\u6B21\u5386\u53F2\u6570\u636E\u5230UI'],
    [834, /legitimacy,.*$/, 'legitimacy, // \u5F53\u524D\u5408\u6CD5\u6027\u503C'],
    [835, /difficulty,.*$/, 'difficulty, // \u6E38\u620F\u96BE\u5EA6'],
    [839, /activeDecrees,.*$/, 'activeDecrees, // \u5F53\u524D\u751F\u6548\u7684\u6539\u9769\u6CD5\u4EE4'],
    [840, /expansionSettings,.*$/, 'expansionSettings, // \u81EA\u7531\u5E02\u573A\u6269\u5F20\u8BBE\u7F6E'],
    [841, /quotaTargets,.*$/, 'quotaTargets, // \u8BA1\u5212\u7ECF\u6D4E\u76EE\u6807\u914D\u989D'],
    [842, /officialCapacity,.*$/, 'officialCapacity, // \u5B98\u5458\u5BB9\u91CF'],
    [846, /priceControls,.*$/, 'priceControls, // [NEW] \u8BA1\u5212\u7ECF\u6D4E\u4EF7\u683C\u7BA1\u5236\u8BBE\u7F6E'],
    [847, /foreignInvestments,.*$/, 'foreignInvestments, // [NEW] \u6D77\u5916\u6295\u8D44'],
    [859, /.*$/, '    // \u76D1\u542C\u56FD\u5BB6\u5217\u8868\u53D8\u5316\uFF0C\u81EA\u52A8\u6E05\u7406\u65E0\u6548\u7684\u8D38\u6613\u8DEF\u7EBF\u548C\u5546\u4EBA\u6D3E\u9A7B'],
    [925, /.*console\.log.*$/, "                        console.log('[\u5546\u4EBA\u7CFB\u7EDF] \u5DF2\u6E05\u7A7A\u6240\u6709\u65E0\u6548\u7684\u5546\u4EBA\u6D3E\u9A7B\uFF0C\u7CFB\u7EDF\u5C06\u91CD\u65B0\u5206\u914D\u5546\u4EBA');"],
    [956, /.*$/, '    // \u6E38\u620F\u6838\u5FC3\u5FAA\u73AF'],
    [958, /.*$/, '        // \u521D\u59CB\u5316\u4F5C\u5F0A\u7801\u7CFB\u7EDF'],
    [963, /.*$/, '        // \u6682\u505C\u65F6\u4E0D\u8BBE\u7F6E\u6E38\u620F\u5FAA\u73AF\u5B9A\u65F6\u5668\uFF0C\u4F46\u81EA\u52A8\u4FDD\u5B58\u5B9A\u65F6\u5668\u9700\u8981\u5355\u72EC\u7BA1\u7406'],
    [965, /.*$/, '            // \u8BBE\u7F6E\u72EC\u7ACB\u7684\u81EA\u52A8\u4FDD\u5B58\u5B9A\u65F6\u5668\uFF08\u6BCF60\u79D2\u68C0\u67E5\u4E00\u6B21\uFF09'],
    [981, /.*$/, '        // \u8BA1\u7B97 Tick \u95F4\u9694\uFF1A\u57FA\u4E8E\u6E38\u620F\u901F\u5EA6\u52A8\u6001\u8C03\u6574'],
    [992, /.*$/, '            // \u81EA\u52A8\u5B58\u6863\u68C0\u6D4B\uFF1A\u5373\u4F7F\u6682\u505C\u4E5F\u7167\u5E38\u8FD0\u884C\uFF0C\u907F\u514D\u957F\u65F6\u95F4\u505C\u7559\u4E22\u8FDB\u5EA6'],
    [1002, /.*$/, '            // \u68C0\u67E5\u662F\u5426\u9700\u8981\u89E6\u53D1\u5E74\u5EA6\u5E86\u5178'],
    [1003, /.*$/, '            // \u4FEE\u590D\uFF1A\u68C0\u6D4B\u5E74\u4EFD\u53D8\u5316\u800C\u975E\u7279\u5B9A\u65E5\u671F\uFF0C\u907F\u514D\u52A0\u901F\u6A21\u5F0F\u4E0B\u8DF3\u8FC7\u89E6\u53D1\u70B9'],
    [1063, /.*$/, '                    // \u8BB0\u5F55\u8FC7\u671F\u6CD5\u4EE4\u65E5\u5FD7'],
    [1072, /.*$/, '            // \u6267\u884C\u6E38\u620F\u6A21\u62DF'],
    [1073, /.*$/, '            // \u3010\u5173\u952E\u3011\u5F3A\u5236\u5C06 gameSpeed \u8BBE\u4E3A 1\uFF0C\u786E\u4FDD\u5355\u6B21 Tick \u53EA\u8BA1\u7B97 1 \u4E2A\u5355\u4F4D\u65F6\u95F4\u7684\u4EA7\u51FA'],
    [1074, /.*$/, '            // \u539F\u56E0\uFF1A\u6211\u4EEC\u5DF2\u7ECF\u901A\u8FC7\u8C03\u6574 setInterval \u7684\u9891\u7387\u6765\u5B9E\u73B0\u52A0\u901F\uFF08\u65F6\u95F4\u6D41\uFF09'],
    [1075, /.*$/, '            // \u5982\u679C\u8FD9\u91CC\u4E0D\u5F52\u4E00\u5316\uFF0CsimulateTick \u5185\u90E8\u4F1A\u518D\u6B21\u4E58\u4EE5 gameSpeed\uFF0C\u5BFC\u81F4\u500D\u7387\u53E0\u52A0'],
    [1076, /.*$/, '            // \u4F8B\u5982\uFF1A5\u500D\u901F\u65F6\uFF0C\u9891\u7387\u5DF2\u7ECF\u662F 5 \u500D\uFF08200ms/\u6B21\uFF09\uFF0C\u5982\u679C\u518D\u4F20 gameSpeed=5\uFF0C'],
    [1077, /.*$/, '            // \u5B9E\u9645\u901F\u5EA6\u4F1A\u53D8\u6210 25 \u500D\uFF085\u00D75\uFF09\uFF0C\u8FD9\u662F\u9519\u8BEF\u7684'],
    [1090, /.*$/, '            // \u5B98\u5458\u85AA\u6C34\u8BA1\u7B97'],
    [1094, /.*$/, '            // Build simulation parameters - \u624B\u52A8\u5217\u51FA\u53EF\u5E8F\u5217\u5316\u5B57\u6BB5\uFF0C\u6392\u9664\u51FD\u6570\u5BF9\u8C61\uFF08\u5982 actions\uFF09'],
    [1095, /.*$/, '            // \u8FD9\u6837\u53EF\u4EE5\u6B63\u786E\u542F\u7528 Web Worker \u52A0\u901F\uFF0C\u907F\u514D DataCloneError'],
    [1097, /.*$/, '                // \u57FA\u7840\u6E38\u620F\u6570\u636E'],
    [1131, /.*$/, '                // \u8FD9\u786E\u4FDD\u4E3B\u5BFC\u5224\u5B9A\u4E0E UI \u663E\u793A\u4E00\u81F4'],
    [1133, /.*$/, '                    // \u4E0E App.jsx Line 1130 \u4FDD\u6301\u4E00\u81F4\u7684\u8BA1\u7B97\u903B\u8F91'],
    [1134, /.*$/, '                    // \u4F7F\u7528 hook \u4F5C\u7528\u57DF\u4E2D\u7684 jobsAvailable\uFF08\u800C\u975E current.jobsAvailable\uFF09'],
    [1147, /.*$/, '                    // [DEBUG] \u4E3B\u7EBF\u7A0B\u68C0\u67E5'],
];

for (const [lineNum, pattern, replacement] of moreReplacements) {
    const lineIdx = lineNum - 1;
    if (lineIdx >= 0 && lineIdx < lines.length && garbledRegex.test(lines[lineIdx])) {
        if (replacement) {
            lines[lineIdx] = replacement;
        } else {
            lines[lineIdx] = lines[lineIdx].replace(pattern, replacement);
        }
        changeCount++;
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed ' + changeCount + ' garbled lines');

// Count remaining garbled lines
let remainCount = 0;
const finalLines = fs.readFileSync(filePath, 'utf8').split('\n');
finalLines.forEach((line, i) => {
    if (garbledRegex.test(line)) {
        remainCount++;
        if (remainCount <= 30) {
            console.log('  Remaining L' + (i+1) + ': ' + line.trim().substring(0, 100));
        }
    }
});
console.log('Remaining garbled lines: ' + remainCount);
