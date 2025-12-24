/**
 * 游戏文本提取脚本
 * 从所有配置文件中提取中文文本，生成汇总报告
 * 
 * 使用方法: node scripts/extract_texts.js
 * 输出: 
 *   - scripts/output/game_texts.md (Markdown报告)
 *   - scripts/output/game_texts.json (JSON数据)
 *   - scripts/output/game_texts.xlsx (Excel表格)
 *   - scripts/output/game_texts_unique.txt (纯文本)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

// ES Module 兼容
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入配置文件
const configPath = path.resolve(__dirname, '../src/config');

// 动态导入所有配置
async function loadConfigs() {
    const configs = {};

    // 主配置文件
    const mainConfigs = [
        'buildings',
        'buildingUpgrades',
        'countries',
        'decrees',
        'epochs',
        'festivalEffects',
        'gameConstants',
        'industryChains',
        'militaryActions',
        'militaryUnits',
        'strata',
        'systemSynergies',
        'technologies',
        'tutorialSteps'
    ];

    for (const name of mainConfigs) {
        try {
            const module = await import(`file://${configPath}/${name}.js`);
            configs[name] = module;
        } catch (e) {
            console.log(`跳过 ${name}: ${e.message}`);
        }
    }

    // 事件配置文件
    const eventConfigs = [
        'baseEvents',
        'classConflictEvents',
        'coalitionRebellion',
        'diplomaticEvents',
        'economicEvents',
        'epochEvents',
        'rebellionEvents',
        'staticDiplomaticEvents'
    ];

    for (const name of eventConfigs) {
        try {
            const module = await import(`file://${configPath}/events/${name}.js`);
            configs[`events/${name}`] = module;
        } catch (e) {
            console.log(`跳过事件文件 ${name}: ${e.message}`);
        }
    }

    return configs;
}

// 从文件内容中静态提取中文文本（用于无法动态导入的文件）
function extractTextsFromFileContent(content, fileName) {
    const results = [];

    // 匹配各种形式的中文文本字符串
    // 1. 单引号字符串: 'xxx'
    // 2. 双引号字符串: "xxx"
    // 3. 模板字符串: `xxx`
    // 4. JSX文本内容

    const patterns = [
        // 匹配对象属性中的中文字符串（如 name: '名称'）
        /(?:name|title|desc|description|text|label|message|placeholder|tooltip|hint|warning|error|info|content):\s*['"`]([^'"`]*[\u4e00-\u9fff][^'"`]*)['"`]/g,
        // 匹配返回对象中的中文字符串（如 return { name: '名称' }）
        /(?:name|title|desc|description|text|label|message):\s*['"`]([^'"`]*[\u4e00-\u9fff][^'"`]*)['"`]/g,
        // 匹配JSX中的中文文本（如 >中文文本<）
        />([^<>]*[\u4e00-\u9fff][^<>]*)</g,
        // 匹配数组中的中文字符串
        /['"`]([^'"`]*[\u4e00-\u9fff][^'"`]*)['"`]\s*[,\]]/g,
    ];

    const seenTexts = new Set();
    let lineNum = 1;
    const lines = content.split('\n');

    for (const line of lines) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const text = match[1].trim();
                // 过滤掉太短或无意义的文本
                if (text.length >= 2 && /[\u4e00-\u9fff]/.test(text) && !seenTexts.has(text)) {
                    // 排除一些常见的非文本内容
                    if (!text.match(/^(className|style|onClick|onChange|ref|key|id)$/) &&
                        !text.includes('className') &&
                        !text.includes('style=') &&
                        !text.startsWith('import ') &&
                        !text.startsWith('export ')) {
                        seenTexts.add(text);
                        results.push({
                            path: `${fileName}:L${lineNum}`,
                            text: text
                        });
                    }
                }
            }
        }
        lineNum++;
    }

    return results;
}

// 加载需要静态提取的额外文件
async function loadStaticTexts() {
    const srcPath = path.resolve(__dirname, '../src');
    const extraTexts = {};

    // 需要静态扫描的文件列表
    const filesToScan = [
        // 执政联盟相关
        'logic/rulingCoalition.js',
        'components/panels/CoalitionPanel.jsx',
        // 事件相关（可能有依赖问题的）
        'config/events/coalitionRebellion.js',
        'config/events/diplomaticEvents.js',
        'config/events/rebellionEvents.js',
        // 其他可能包含文本的文件
        'logic/organizationSystem.js',
        'logic/rebellionSystem.js',
        'logic/strategicActions.js',
        'hooks/cheatCodes.js',
        // 主要组件
        'components/panels/StratumDetailSheet.jsx',
        'components/tabs/PoliticsTab.jsx',
        'components/tabs/SocialTab.jsx',
        'components/tabs/DiplomacyTab.jsx',
        'components/tabs/MilitaryTab.jsx',
        'components/common/UIComponents.jsx',
    ];

    for (const filePath of filesToScan) {
        const fullPath = path.join(srcPath, filePath);
        try {
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const texts = extractTextsFromFileContent(content, filePath);
                if (texts.length > 0) {
                    extraTexts[filePath] = texts;
                }
            }
        } catch (e) {
            console.log(`静态扫描失败 ${filePath}: ${e.message}`);
        }
    }

    return extraTexts;
}


// 提取文本的工具函数
function extractTexts(obj, path = '', results = []) {
    if (!obj) return results;

    if (typeof obj === 'string') {
        // 检查是否包含中文字符
        if (/[\u4e00-\u9fff]/.test(obj)) {
            results.push({ path, text: obj });
        }
        return results;
    }

    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            extractTexts(item, `${path}[${index}]`, results);
        });
        return results;
    }

    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            extractTexts(obj[key], path ? `${path}.${key}` : key, results);
        }
    }

    return results;
}

// 分类文本
function categorizeTexts(texts) {
    const categories = {
        names: [],        // 名称类文本
        descriptions: [], // 描述类文本
        effects: [],      // 效果说明
        dialogues: [],    // 对话/故事文本
        ui: [],           // UI文本
        other: []         // 其他
    };

    for (const item of texts) {
        const pathLower = item.path.toLowerCase();

        if (pathLower.includes('name') || pathLower.includes('title')) {
            categories.names.push(item);
        } else if (pathLower.includes('desc') || pathLower.includes('description')) {
            categories.descriptions.push(item);
        } else if (pathLower.includes('effect') || pathLower.includes('buff') || pathLower.includes('drawback')) {
            categories.effects.push(item);
        } else if (pathLower.includes('lead') || pathLower.includes('paragraph') || pathLower.includes('text') || pathLower.includes('callout')) {
            categories.dialogues.push(item);
        } else if (pathLower.includes('button') || pathLower.includes('label') || pathLower.includes('prompt')) {
            categories.ui.push(item);
        } else {
            categories.other.push(item);
        }
    }

    return categories;
}

// 生成 Markdown 报告
function generateReport(allTexts) {
    const lines = [];

    lines.push('# 游戏文本汇总报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    // 统计信息
    let totalTexts = 0;
    let totalChars = 0;

    for (const [source, texts] of Object.entries(allTexts)) {
        totalTexts += texts.length;
        totalChars += texts.reduce((sum, t) => sum + t.text.length, 0);
    }

    lines.push('## 📊 统计概览');
    lines.push('');
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 配置文件数 | ${Object.keys(allTexts).length} |`);
    lines.push(`| 文本条目数 | ${totalTexts} |`);
    lines.push(`| 总字符数 | ${totalChars.toLocaleString()} |`);
    lines.push('');

    // 按配置文件分组输出
    lines.push('## 📁 按配置文件分组');
    lines.push('');

    for (const [source, texts] of Object.entries(allTexts)) {
        if (texts.length === 0) continue;

        lines.push(`### ${source}`);
        lines.push('');
        lines.push(`共 ${texts.length} 条文本，${texts.reduce((sum, t) => sum + t.text.length, 0)} 字符`);
        lines.push('');

        // 分类显示
        const categories = categorizeTexts(texts);

        for (const [catName, catTexts] of Object.entries(categories)) {
            if (catTexts.length === 0) continue;

            const catDisplayName = {
                names: '📛 名称',
                descriptions: '📝 描述',
                effects: '⚡ 效果',
                dialogues: '💬 文案',
                ui: '🖥️ 界面',
                other: '📦 其他'
            }[catName] || catName;

            lines.push(`#### ${catDisplayName} (${catTexts.length}条)`);
            lines.push('');

            for (const item of catTexts) {
                // 截断过长的文本
                const displayText = item.text.length > 100
                    ? item.text.substring(0, 100) + '...'
                    : item.text;
                lines.push(`- \`${item.path}\`: ${displayText}`);
            }
            lines.push('');
        }

        lines.push('---');
        lines.push('');
    }

    // 生成纯文本列表 (用于翻译等)
    lines.push('## 📋 纯文本列表 (去重)');
    lines.push('');

    const uniqueTexts = new Set();
    for (const texts of Object.values(allTexts)) {
        for (const item of texts) {
            uniqueTexts.add(item.text);
        }
    }

    lines.push(`共 ${uniqueTexts.size} 条唯一文本`);
    lines.push('');
    lines.push('```');
    for (const text of Array.from(uniqueTexts).sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
        lines.push(text);
    }
    lines.push('```');

    return lines.join('\n');
}

// 生成 JSON 格式报告
function generateJsonReport(allTexts) {
    const result = {
        metadata: {
            generatedAt: new Date().toISOString(),
            totalFiles: Object.keys(allTexts).length,
            totalTexts: 0,
            totalChars: 0
        },
        files: {},
        uniqueTexts: []
    };

    const uniqueTexts = new Set();

    for (const [source, texts] of Object.entries(allTexts)) {
        result.files[source] = {
            count: texts.length,
            chars: texts.reduce((sum, t) => sum + t.text.length, 0),
            items: texts
        };
        result.metadata.totalTexts += texts.length;
        result.metadata.totalChars += result.files[source].chars;

        for (const item of texts) {
            uniqueTexts.add(item.text);
        }
    }

    result.uniqueTexts = Array.from(uniqueTexts).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    return JSON.stringify(result, null, 2);
}

// 获取文本类别
function getCategory(path) {
    const pathLower = path.toLowerCase();
    if (pathLower.includes('name') || pathLower.includes('title')) return '名称';
    if (pathLower.includes('desc') || pathLower.includes('description')) return '描述';
    if (pathLower.includes('effect') || pathLower.includes('buff') || pathLower.includes('drawback')) return '效果';
    if (pathLower.includes('lead') || pathLower.includes('paragraph') || pathLower.includes('text') || pathLower.includes('callout')) return '文案';
    if (pathLower.includes('button') || pathLower.includes('label') || pathLower.includes('prompt')) return '界面';
    return '其他';
}

// 生成 Excel 报告
function generateExcel(allTexts, outputPath) {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: 所有文本（完整列表）
    const allData = [];
    for (const [source, texts] of Object.entries(allTexts)) {
        for (const item of texts) {
            allData.push({
                '配置文件': source,
                '路径': item.path,
                '类别': getCategory(item.path),
                '中文文本': item.text,
                '字符数': item.text.length,
                '翻译': ''  // 空列，方便填写翻译
            });
        }
    }
    const ws1 = XLSX.utils.json_to_sheet(allData);

    // 设置列宽
    ws1['!cols'] = [
        { wch: 25 },  // 配置文件
        { wch: 40 },  // 路径
        { wch: 8 },   // 类别
        { wch: 60 },  // 中文文本
        { wch: 8 },   // 字符数
        { wch: 60 },  // 翻译
    ];
    XLSX.utils.book_append_sheet(workbook, ws1, '所有文本');

    // Sheet 2: 唯一文本（去重）
    const uniqueTexts = new Map();
    for (const texts of Object.values(allTexts)) {
        for (const item of texts) {
            if (!uniqueTexts.has(item.text)) {
                uniqueTexts.set(item.text, {
                    text: item.text,
                    count: 1,
                    sources: [item.path]
                });
            } else {
                const existing = uniqueTexts.get(item.text);
                existing.count++;
                if (existing.sources.length < 3) {
                    existing.sources.push(item.path);
                }
            }
        }
    }

    const uniqueData = Array.from(uniqueTexts.values())
        .sort((a, b) => a.text.localeCompare(b.text, 'zh-CN'))
        .map((item, index) => ({
            '序号': index + 1,
            '中文文本': item.text,
            '字符数': item.text.length,
            '出现次数': item.count,
            '示例路径': item.sources.join('; '),
            '翻译': ''
        }));

    const ws2 = XLSX.utils.json_to_sheet(uniqueData);
    ws2['!cols'] = [
        { wch: 6 },   // 序号
        { wch: 60 },  // 中文文本
        { wch: 8 },   // 字符数
        { wch: 10 },  // 出现次数
        { wch: 50 },  // 示例路径
        { wch: 60 },  // 翻译
    ];
    XLSX.utils.book_append_sheet(workbook, ws2, '唯一文本');

    // Sheet 3: 按配置文件统计
    const statsData = Object.entries(allTexts).map(([source, texts]) => {
        const categories = categorizeTexts(texts);
        return {
            '配置文件': source,
            '文本总数': texts.length,
            '总字符数': texts.reduce((sum, t) => sum + t.text.length, 0),
            '名称': categories.names.length,
            '描述': categories.descriptions.length,
            '效果': categories.effects.length,
            '文案': categories.dialogues.length,
            '界面': categories.ui.length,
            '其他': categories.other.length,
        };
    });

    const ws3 = XLSX.utils.json_to_sheet(statsData);
    ws3['!cols'] = [
        { wch: 30 },  // 配置文件
        { wch: 10 },  // 文本总数
        { wch: 10 },  // 总字符数
        { wch: 8 },   // 名称
        { wch: 8 },   // 描述
        { wch: 8 },   // 效果
        { wch: 8 },   // 文案
        { wch: 8 },   // 界面
        { wch: 8 },   // 其他
    ];
    XLSX.utils.book_append_sheet(workbook, ws3, '统计');

    // Sheet 4-N: 按配置文件分表
    for (const [source, texts] of Object.entries(allTexts)) {
        if (texts.length === 0) continue;

        // Excel sheet名称有长度限制，且不能包含 : \ / ? * [ ] 字符
        const sheetName = source
            .replace(/\[静态\]\s*/g, '_')
            .replace('events/', '')
            .replace('components/', '')
            .replace('logic/', '')
            .replace('config/', '')
            .replace(/[:\\/?*\[\]]/g, '_')
            .substring(0, 31);

        const sheetData = texts.map((item, index) => ({
            '序号': index + 1,
            '路径': item.path,
            '类别': getCategory(item.path),
            '中文文本': item.text,
            '翻译': ''
        }));

        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = [
            { wch: 6 },   // 序号
            { wch: 40 },  // 路径
            { wch: 8 },   // 类别
            { wch: 60 },  // 中文文本
            { wch: 60 },  // 翻译
        ];
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    }

    // 写入文件
    XLSX.writeFile(workbook, outputPath);
}

// 主函数
async function main() {
    console.log('🎮 游戏文本提取工具');
    console.log('====================');
    console.log('');

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('📦 正在加载配置文件...');
    const configs = await loadConfigs();
    console.log(`   已加载 ${Object.keys(configs).length} 个配置文件`);
    console.log('');

    console.log('🔍 正在从配置文件提取文本...');
    const allTexts = {};

    for (const [name, module] of Object.entries(configs)) {
        const texts = extractTexts(module);
        if (texts.length > 0) {
            allTexts[name] = texts;
            console.log(`   ${name}: ${texts.length} 条文本`);
        }
    }
    console.log('');

    console.log('📂 正在静态扫描组件和逻辑文件...');
    const staticTexts = await loadStaticTexts();
    for (const [name, texts] of Object.entries(staticTexts)) {
        if (texts.length > 0) {
            allTexts[`[静态] ${name}`] = texts;
            console.log(`   ${name}: ${texts.length} 条文本`);
        }
    }
    console.log('');


    console.log('📝 正在生成报告...');

    // 生成 Markdown 报告
    const mdReport = generateReport(allTexts);
    const mdPath = path.join(outputDir, 'game_texts.md');
    fs.writeFileSync(mdPath, mdReport, 'utf-8');
    console.log(`   ✅ Markdown 报告: ${mdPath}`);

    // 生成 JSON 报告
    const jsonReport = generateJsonReport(allTexts);
    const jsonPath = path.join(outputDir, 'game_texts.json');
    fs.writeFileSync(jsonPath, jsonReport, 'utf-8');
    console.log(`   ✅ JSON 报告: ${jsonPath}`);

    // 生成 Excel 报告
    const xlsxPath = path.join(outputDir, 'game_texts.xlsx');
    generateExcel(allTexts, xlsxPath);
    console.log(`   ✅ Excel 报告: ${xlsxPath}`);

    // 生成纯文本文件 (每行一条,方便翻译)
    const uniqueTexts = new Set();
    for (const texts of Object.values(allTexts)) {
        for (const item of texts) {
            uniqueTexts.add(item.text);
        }
    }
    const txtContent = Array.from(uniqueTexts).sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n');
    const txtPath = path.join(outputDir, 'game_texts_unique.txt');
    fs.writeFileSync(txtPath, txtContent, 'utf-8');
    console.log(`   ✅ 纯文本文件: ${txtPath}`);

    console.log('');
    console.log('🎉 完成！');
    console.log(`   共提取 ${Object.values(allTexts).reduce((sum, t) => sum + t.length, 0)} 条文本`);
    console.log(`   共 ${uniqueTexts.size} 条唯一文本`);
}

main().catch(console.error);

