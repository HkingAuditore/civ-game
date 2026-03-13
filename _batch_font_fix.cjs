const fs = require('fs');
const path = require('path');

function walk(dir, exts) {
    let results = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory() && !f.startsWith('.') && f !== 'node_modules') {
            results = results.concat(walk(p, exts));
        } else if (exts.some(ext => f.endsWith(ext))) {
            results.push(p);
        }
    }
    return results;
}

const files = walk('src', ['.jsx', '.js']);

const replacements = {
    'text-[7px]': 'text-[10px]',
    'text-[8px]': 'text-xs',
    'text-[9px]': 'text-xs',
    'text-[10px]': 'text-xs',
    'text-[11px]': 'text-xs',
};

let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let fileReplacements = 0;

    for (const [oldVal, newVal] of Object.entries(replacements)) {
        const count = content.split(oldVal).length - 1;
        if (count > 0) {
            content = content.split(oldVal).join(newVal);
            fileReplacements += count;
        }
    }

    if (fileReplacements > 0) {
        fs.writeFileSync(file, content, 'utf8');
        totalFiles++;
        totalReplacements += fileReplacements;
        console.log(`  ${file} (${fileReplacements} replacements)`);
    }
}

console.log(`\nTotal: ${totalFiles} files, ${totalReplacements} replacements`);
