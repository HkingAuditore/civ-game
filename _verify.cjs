const fs = require('fs');
const content = fs.readFileSync('src/hooks/useGameLoop.js', 'utf8');
const lines = content.split('\n');
const garbledRe = /[\u93c6\u7490\u94b1\u5ef4\u5a13\u81b3\u6930\u7ebc\u8191\u6e3e\u580e\u9c9d\u5d7d\u80f3\u58a8\u6da8\u5ce8]/;
let count = 0;
lines.forEach((line, i) => {
    if (garbledRe.test(line)) {
        count++;
        console.log('L' + (i+1) + ': ' + line.trim().substring(0, 120));
    }
});
console.log('\nTotal garbled lines: ' + count);
