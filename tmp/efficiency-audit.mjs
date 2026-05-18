// 效率审计脚本：找出所有产业链中后期建筑人均产能 ≤ 前期建筑的情况
import { BUILDINGS } from '../src/config/buildings.js';
import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from '../src/config/buildingUpgrades.js';

function totalJobs(jobs) {
    if (!jobs) return 0;
    return Object.values(jobs).reduce((s, v) => s + v, 0);
}

// 判断某资源是否是该建筑的"主产"（输出量最大的资源）
// silver 参与 max 比较但不报告 silver 自身（货币不是生产链资源）
// 严格判定：必须是最大输出资源才算主产（避免次级副产被误判）
function isMainOutput(cfg, res) {
    if (res === 'maxPop' || res === 'militaryCapacity' || res === 'silver') return false;
    // silver 折算为 1/4（因为 silver 数值通常较大）
    const allOutputs = Object.entries(cfg.output || {})
        .filter(([k, v]) => k !== 'maxPop' && k !== 'militaryCapacity' && v > 0)
        .map(([k, v]) => [k, k === 'silver' ? v / 4 : v]);
    if (allOutputs.length === 0) return false;
    const maxAmt = Math.max(...allOutputs.map(([, v]) => v));
    const target = cfg.output[res] || 0;
    // 严格主产：必须是最大输出（≥ 95% 最大输出量）
    return target >= maxAmt * 0.95;
}

// 收集每种资源的"主产"生产者（含所有等级），按 epoch 排序
function buildProducers() {
    const map = {};
    for (const b of BUILDINGS) {
        const maxLv = BUILDING_UPGRADES[b.id] ? BUILDING_UPGRADES[b.id].length : 0;
        for (let lv = 0; lv <= maxLv; lv++) {
            const cfg = getBuildingEffectiveConfig(b, lv);
            const jobs = totalJobs(cfg.jobs);
            if (jobs <= 0) continue;
            for (const [res, amt] of Object.entries(cfg.output || {})) {
                if (res === 'maxPop' || res === 'militaryCapacity' || res === 'silver') continue;
                if (!amt || amt <= 0) continue;
                if (!isMainOutput(cfg, res)) continue; // 只考虑主产
                if (!map[res]) map[res] = [];
                map[res].push({
                    id: b.id,
                    name: lv === 0 ? b.name : cfg.name,
                    level: lv,
                    epoch: b.epoch,
                    jobs,
                    output: amt,
                    perWorker: amt / jobs,
                });
            }
        }
    }
    return map;
}

const producers = buildProducers();

// 对每种资源，按 (epoch, level) 排序，检查跨 epoch 是否人均严格递增
// 同 epoch 内不强制递增（因为玩家在同 epoch 内有选择权）
// 同 epoch 内 Lv 越高的建筑要求 > 该建筑自身的低 Lv（同建筑内升级递增）
const issues = [];
for (const [res, list] of Object.entries(producers)) {
    if (list.length < 2) continue;
    // 排序：先按 epoch，再按 level
    list.sort((a, b) => a.epoch - b.epoch || a.level - b.level);

    // 计算每个 epoch 的最大人均效率
    const epochMaxByEpoch = new Map();
    for (const cur of list) {
        const prev = epochMaxByEpoch.get(cur.epoch) || 0;
        if (cur.perWorker > prev) epochMaxByEpoch.set(cur.epoch, cur.perWorker);
    }

    // 跨 epoch 检查：当前建筑必须 > 之前所有 epoch 的最大值
    // 同一建筑内升级检查：高 lv 必须 > 该建筑自身的低 lv
    const buildingMaxLevel = new Map(); // id -> {perWorker, name, level}
    let prevEpochMax = 0;
    let prevEpochMaxName = '';
    let lastEpoch = -1;
    for (const cur of list) {
        // 当 epoch 改变时，更新 prevEpochMax 为之前所有 epoch 的最大值
        if (cur.epoch !== lastEpoch && lastEpoch !== -1) {
            // 累计之前所有 epoch 的最大值
            for (const [ep, maxV] of epochMaxByEpoch.entries()) {
                if (ep < cur.epoch && maxV > prevEpochMax) {
                    prevEpochMax = maxV;
                    // 找出该 epoch max 对应的建筑名
                    for (const it of list) {
                        if (it.epoch === ep && it.perWorker === maxV) {
                            prevEpochMaxName = `${it.name}(${it.id} E${it.epoch} Lv${it.level})`;
                            break;
                        }
                    }
                }
            }
        }
        lastEpoch = cur.epoch;

        // 跨 epoch 检查
        if (cur.epoch > 0 && cur.perWorker < prevEpochMax * 1.001) {
            issues.push({
                res,
                kind: 'epoch',
                building: `${cur.name}(${cur.id} E${cur.epoch} Lv${cur.level})`,
                jobs: cur.jobs,
                output: cur.output.toFixed(3),
                perWorker: cur.perWorker.toFixed(3),
                vs: `${prevEpochMaxName} (人均 ${prevEpochMax.toFixed(3)})`,
                regression: ((cur.perWorker / prevEpochMax - 1) * 100).toFixed(1) + '%',
            });
        }

        // 同建筑内升级检查
        const prevLv = buildingMaxLevel.get(cur.id);
        if (prevLv && cur.perWorker < prevLv.perWorker * 1.001) {
            issues.push({
                res,
                kind: 'level',
                building: `${cur.name}(${cur.id} E${cur.epoch} Lv${cur.level})`,
                jobs: cur.jobs,
                output: cur.output.toFixed(3),
                perWorker: cur.perWorker.toFixed(3),
                vs: `${prevLv.name} (Lv${prevLv.level} 人均 ${prevLv.perWorker.toFixed(3)})`,
                regression: ((cur.perWorker / prevLv.perWorker - 1) * 100).toFixed(1) + '%',
            });
        }
        if (!prevLv || cur.perWorker > prevLv.perWorker) {
            buildingMaxLevel.set(cur.id, { perWorker: cur.perWorker, name: cur.name, level: cur.level });
        }
    }
}

console.log(`\n=== 共发现 ${issues.length} 处人均效率倒挂 ===\n`);
const byRes = {};
for (const issue of issues) {
    if (!byRes[issue.res]) byRes[issue.res] = [];
    byRes[issue.res].push(issue);
}
for (const [res, list] of Object.entries(byRes)) {
    console.log(`\n[${res}]`);
    for (const i of list) {
        console.log(`  ❌ ${i.building} 人均=${i.perWorker} (output=${i.output}/jobs=${i.jobs}) vs ${i.vs} ${i.regression}`);
    }
}
