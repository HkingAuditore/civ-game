const fs = require('fs');
const f = 'src/hooks/useGameLoop.js';
const lines = fs.readFileSync(f, 'utf8').split('\n');
lines[5850] = '                                    // \u5C06\u5173\u7A0E\u8BB0\u5165tradeStats\uFF0C\u663E\u793A\u5728\u8D22\u653F\u9762\u677F\u4E2D';
fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Fixed L5851');
