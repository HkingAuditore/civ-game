const fs = require('fs');
const c = fs.readFileSync(__dirname + '/src/config/technologies.js', 'utf8');

// 更可靠的解析方式：查找每个 id: 'xxx' 并向前/向后搜索块边界
const items = [];
const idRe = /id:\s*'(\w+)'/g;
let m;
while ((m = idRe.exec(c)) !== null) {
    // 找到包含这个id的最近的 { 开头（考虑嵌套）
    let braceCount = 0;
    let blockStart = m.index;
    for (let i = m.index; i >= 0; i--) {
        if (c[i] === '}') braceCount++;
        if (c[i] === '{') {
            if (braceCount === 0) { blockStart = i; break; }
            braceCount--;
        }
    }
    // 找到这个块的 } 结尾
    braceCount = 0;
    let blockEnd = m.index;
    for (let i = blockStart; i < c.length; i++) {
        if (c[i] === '{') braceCount++;
        if (c[i] === '}') {
            braceCount--;
            if (braceCount === 0) { blockEnd = i; break; }
        }
    }
    const block = c.substring(blockStart, blockEnd + 1);
    const epochM = block.match(/epoch:\s*(\d+)/);
    const preM = block.match(/prerequisites:\s*\[([^\]]*)\]/);
    if (epochM) {
        const prereqs = preM ? preM[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean) : [];
        items.push({ id: m[1], ep: +epochM[1], prereqs });
    }
}

const ids = new Set(items.map(i => i.id));
let err = 0;

// Check invalid refs
items.forEach(i => {
    i.prereqs.forEach(p => {
        if (!ids.has(p)) { console.log('BAD REF: ' + i.id + ' -> ' + p); err++; }
    });
});

// Check missing prereqs (epoch 0 roots are OK, coal_gasification is industrial root)
const roots = new Set(['barter', 'stone_axes', 'animal_husbandry', 'coal_gasification']);
items.forEach(i => {
    if (i.ep > 0 && i.prereqs.length === 0 && !roots.has(i.id)) {
        console.log('NO PREREQ: E' + i.ep + ' ' + i.id); err++;
    }
});

// Check cycles (DFS)
const map = {};
items.forEach(i => { map[i.id] = i; });
const vis = new Set();
const stk = new Set();
function dfs(id, p) {
    if (stk.has(id)) { console.log('CYCLE: ' + p.join(' > ') + ' > ' + id); err++; return; }
    if (vis.has(id)) return;
    vis.add(id); stk.add(id);
    const tech = map[id];
    if (tech) {
        tech.prereqs.forEach(pid => { if (ids.has(pid)) dfs(pid, p.concat([id])); });
    }
    stk.delete(id);
}
items.forEach(i => { if (!vis.has(i.id)) dfs(i.id, []); });

// Summary
console.log('Total: ' + items.length + ', Errors: ' + err);
if (!err) console.log('OK - All validations passed!');
