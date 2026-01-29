// 验证建筑升级倍率的脚本
import { BUILDINGS } from './src/config/buildings.js';
import { BUILDING_UPGRADES } from './src/config/buildingUpgrades.js';

console.log('=== 检查建筑升级产出倍率 ===\n');

let issues = [];

Object.keys(BUILDING_UPGRADES).forEach(buildingId => {
    const baseBuilding = BUILDINGS.find(b => b.id === buildingId);
    if (!baseBuilding) {
        console.log(`⚠️  警告：找不到基础建筑 ${buildingId}`);
        return;
    }

    const upgrades = BUILDING_UPGRADES[buildingId];
    const baseOutput = baseBuilding.output || {};

    upgrades.forEach((upgrade, level) => {
        const upgradeOutput = upgrade.output || {};
        const expectedMultiplier = level === 0 ? 1.3 : 2.25;

        console.log(`\n${baseBuilding.name} → ${upgrade.name} (Lv${level + 1}):`);

        // 检查每个产出资源
        Object.keys(baseOutput).forEach(resource => {
            if (resource === 'maxPop' || resource === 'militaryCapacity') {
                return; // 跳过非生产资源
            }

            const baseValue = baseOutput[resource];
            const upgradeValue = upgradeOutput[resource] || 0;
            const actualMultiplier = upgradeValue / baseValue;

            const isExpected = Math.abs(actualMultiplier - expectedMultiplier) < 0.1;
            const status = upgradeValue >= baseValue ?
                (isExpected ? '✅' : '⚠️ ') :
                '❌';

            console.log(`  ${status} ${resource}: ${baseValue} → ${upgradeValue} (${actualMultiplier.toFixed(2)}x, 预期 ${expectedMultiplier}x)`);

            if (upgradeValue < baseValue) {
                issues.push({
                    building: baseBuilding.name,
                    upgrade: upgrade.name,
                    level: level + 1,
                    resource,
                    baseValue,
                    upgradeValue,
                    actualMultiplier
                });
            }
        });

        // 检查新增的产出资源
        Object.keys(upgradeOutput).forEach(resource => {
            if (!baseOutput[resource] && resource !== 'maxPop' && resource !== 'militaryCapacity') {
                console.log(`  ➕ ${resource}: 0 → ${upgradeOutput[resource]} (新增)`);
            }
        });
    });
});

if (issues.length > 0) {
    console.log('\n\n❌ 发现减产问题：\n');
    issues.forEach(issue => {
        console.log(`  ${issue.building} → ${issue.upgrade} (Lv${issue.level})`);
        console.log(`    ${issue.resource}: ${issue.baseValue} → ${issue.upgradeValue} (${issue.actualMultiplier.toFixed(2)}x)`);
    });
} else {
    console.log('\n\n✅ 所有建筑升级产出正常！');
}
