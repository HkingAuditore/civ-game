/**
 * 创建 OTA zip 包 —— 使用 archiver 确保路径用正斜杠（兼容 Android）。
 *
 * Usage: node scripts/create_ota_zip.cjs <outputPath> [sourceDir]
 *   sourceDir defaults to "dist"
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const outputPath = process.argv[2];
const sourceDir = process.argv[3] || 'dist';

if (!outputPath) {
    console.error('Usage: node scripts/create_ota_zip.cjs <outputPath> [sourceDir]');
    process.exit(1);
}

const absSource = path.resolve(sourceDir);
if (!fs.existsSync(absSource)) {
    console.error(`Source directory not found: ${absSource}`);
    process.exit(1);
}

const absOutput = path.resolve(outputPath);
const outputDir = path.dirname(absOutput);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const output = fs.createWriteStream(absOutput);
const archive = archiver('zip', { zlib: { level: 6 } });

output.on('close', () => {
    console.log(`ZIP created: ${absOutput} (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
    console.error('Archive error:', err);
    process.exit(1);
});

archive.pipe(output);
archive.directory(absSource, false);
archive.finalize();
