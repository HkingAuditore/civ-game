const { execSync } = require('child_process');
const files = execSync('git --no-pager diff --name-only -- *.js *.jsx', { encoding: 'utf8' })
    .trim().split('\n').filter(f => f.startsWith('src/'));

let fails = [];
for (const f of files) {
    try {
        execSync('node --check ' + f, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        fails.push(f);
    }
}

if (fails.length) {
    console.log('FAILED FILES (' + fails.length + '):');
    fails.forEach(f => console.log('  ' + f));
} else {
    console.log('All ' + files.length + ' files OK');
}
