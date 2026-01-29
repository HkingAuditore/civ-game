// 检查建筑升级的投入产出比
import { BUILDINGS } from './src/config/buildings.js';
import { BUILDING_UPGRADES } from './src/config/buildingUpgrades.js';

console.log('=== 检查建筑升级的投入产出比 ===\n');

// 修复过的建筑列表
const fixedBuildings = [
    'loom_house',
    'brickworks',
    'tailor_workshop',
    'large_estate',
    'monastery_cellar',
    'wool_workshop',
    'trade_port',
    'coffee_plantation'
];

fixedBuildings.forEach(buildingId => {
    const baseBuilding = BUILDINGS.find(b => b.id === buildingId);
    if (!baseBuilding) return;

    const upgrades = BUILDING_UPGRADES[buildingId];
    const baseInput = baseBuilding.input || {};
    const baseOutput = baseBuilding.output || {};

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${baseBuilding.name} (${buildingId})`);
    console.log(`${'='.repeat(60)}`);

    console.log('\n📦 基础建筑:');
    console.log('  投入:', JSON.stringify(baseInput));
    console.log('  产出:', JSON.stringify(baseOutput));

    upgrades.forEach((upgrade, level) => {
        const upgradeInput = upgrade.input || {};
        const upgradeOutput = upgrade.output || {};

        console.log(`\n🔧 ${upgrade.name} (Lv${level + 1}):`);
        console.log('  投入:', JSON.stringify(upgradeInput));
        console.log('  产出:', JSON.stringify(upgradeOutput));

        // 计算投入倍率
        console.log('\n  投入倍率:');
        Object.keys(baseInput).forEach(resource => {
            const baseValue = baseInput[resource];
            const upgradeValue = upgradeInput[resource] || 0;
            const ratio = upgradeValue / baseValue;
            console.log(`    ${resource}: ${baseValue} → ${upgradeValue} (${ratio.toFixed(2)}x)`);
        });

        // 计算产出倍率
        console.log('  产出倍率:');
        Object.keys(baseOutput).forEach(resource => {
            if (resource === 'maxPop' || resource === 'militaryCapacity') return;
            const baseValue = baseOutput[resource];
            const upgradeValue = upgradeOutput[resource] || 0;
            const ratio = upgradeValue / baseValue;
            console.log(`    ${resource}: ${baseValue} → ${upgradeValue} (${ratio.toFixed(2)}x)`);
        });

        // 检查是否需要调整投入
        const expectedOutputMultiplier = level === 0 ? 1.3 : 2.25;
        console.log(`\n  ⚖️  平衡性分析:`);
        console.log(`    预期产出倍率: ${expectedOutputMultiplier}x`);

        // 如果有投入资源，检查投入是否也同比例增加
        const inputResources = Object.keys(baseInput);
        if (inputResources.length > 0) {
            const avgInputRatio = inputResources.reduce((sum, resource) => {
                const baseValue = baseInput[resource];
                const upgradeValue = upgradeInput[resource] || 0;
                return sum + (upgradeValue / baseValue);
            }, 0) / inputResources.length;

            console.log(`    平均投入倍率: ${avgInputRatio.toFixed(2)}x`);

            if (avgInputRatio < expectedOutputMultiplier * 0.8) {
                console.log(`    ⚠️  警告：投入增长不足！建议投入也增加到约 ${expectedOutputMultiplier}x`);
            } else {
                console.log(`    ✅ 投入产出比例合理`);
            }
        } else {
            console.log(`    ℹ️  基础建筑无投入需求`);
        }
    });
});

console.log('\n\n' + '='.repeat(60));
console.log('分析完成');
console.log('='.repeat(60));
