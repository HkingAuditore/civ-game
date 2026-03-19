/**
 * 平衡性分析工具
 * 读取游戏配置，生成交互式 HTML 报告
 * 用法: node tools/balance-analyzer.mjs
 */

import { BUILDINGS } from '../src/config/buildings.js';
import { STRATA } from '../src/config/strata.js';
import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from '../src/config/buildingUpgrades.js';
import { EPOCHS } from '../src/config/epochs.js';
import { RESOURCES } from '../src/config/gameConstants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EPOCH_NAMES = EPOCHS.map(e => e.name);

function totalJobs(jobs) {
    if (!jobs) return 0;
    return Object.values(jobs).reduce((s, v) => s + v, 0);
}

function resourceValue(res, amounts) {
    let total = 0;
    for (const [k, v] of Object.entries(amounts || {})) {
        const r = RESOURCES[k];
        if (!r || r.type === 'virtual') continue;
        total += (r.basePrice || 1) * v;
    }
    return total;
}

// ===== 建筑分析数据 =====
function analyzeBuildingsData() {
    const rows = [];
    for (const b of BUILDINGS) {
        const maxLv = BUILDING_UPGRADES[b.id] ? BUILDING_UPGRADES[b.id].length : 0;
        for (let lv = 0; lv <= maxLv; lv++) {
            const cfg = getBuildingEffectiveConfig(b, lv);
            const jobs = totalJobs(cfg.jobs);
            const outVal = resourceValue(RESOURCES, cfg.output);
            const inVal = resourceValue(RESOURCES, cfg.input);
            const netVal = outVal - inVal;
            const perWorker = jobs > 0 ? netVal / jobs : 0;
            const upgCost = lv > 0 ? (BUILDING_UPGRADES[b.id]?.[lv - 1]?.cost || {}) : null;
            rows.push({
                id: b.id,
                name: lv === 0 ? b.name : cfg.name,
                level: lv,
                epoch: b.epoch,
                cat: b.cat,
                owner: cfg.owner || b.owner || '-',
                baseCost: lv === 0 ? b.baseCost : null,
                upgradeCost: upgCost,
                input: cfg.input,
                output: cfg.output,
                jobs: cfg.jobs,
                totalJobs: jobs,
                outVal: +outVal.toFixed(4),
                inVal: +inVal.toFixed(4),
                netVal: +netVal.toFixed(4),
                perWorker: +perWorker.toFixed(4),
                requiresTech: b.requiresTech || null,
            });
        }
    }
    return rows;
}

// ===== 阶层分析数据 =====
function analyzeStrataData() {
    const rows = [];
    for (const [id, s] of Object.entries(STRATA)) {
        const needsVal = resourceValue(RESOURCES, s.needs);
        const luxTiers = [];
        if (s.luxuryNeeds) {
            for (const [threshold, needs] of Object.entries(s.luxuryNeeds)) {
                luxTiers.push({
                    threshold: +threshold,
                    needs,
                    value: +resourceValue(RESOURCES, needs).toFixed(4),
                });
            }
        }
        rows.push({
            id,
            name: s.name,
            weight: s.weight,
            tax: s.tax,
            headTaxBase: s.headTaxBase,
            wealthWeight: s.wealthWeight,
            influenceBase: s.influenceBase,
            startingWealth: s.startingWealth,
            wealthElasticity: s.wealthElasticity,
            maxConsumptionMultiplier: s.maxConsumptionMultiplier,
            needs: s.needs,
            needsValue: +needsVal.toFixed(4),
            luxuryNeeds: luxTiers,
            buffs: s.buffs,
            unlockEpoch: s.unlockEpoch || 0,
        });
    }
    return rows;
}

// ===== 资源供需分析（按时代模拟） =====
function analyzeResourceBalance() {
    const epochData = [];
    for (let epoch = 0; epoch <= 9; epoch++) {
        const available = BUILDINGS.filter(b => b.epoch <= epoch);
        const supply = {};
        const demand = {};
        for (const b of available) {
            for (const [res, amt] of Object.entries(b.output || {})) {
                if (RESOURCES[res]?.type === 'virtual') continue;
                supply[res] = (supply[res] || 0) + amt;
            }
            for (const [res, amt] of Object.entries(b.input || {})) {
                demand[res] = (demand[res] || 0) + amt;
            }
        }
        epochData.push({ epoch, epochName: EPOCH_NAMES[epoch], supply, demand });
    }
    return epochData;
}

// ===== 预警分析 =====
function analyzeWarnings() {
    const warnings = [];

    for (const b of BUILDINGS) {
        const maxLv = BUILDING_UPGRADES[b.id] ? BUILDING_UPGRADES[b.id].length : 0;
        let prevPerWorker = null;
        for (let lv = 0; lv <= maxLv; lv++) {
            const cfg = getBuildingEffectiveConfig(b, lv);
            const jobs = totalJobs(cfg.jobs);
            const outVal = resourceValue(RESOURCES, cfg.output);
            const inVal = resourceValue(RESOURCES, cfg.input);
            const netVal = outVal - inVal;
            const perWorker = jobs > 0 ? netVal / jobs : 0;

            if (netVal < 0 && jobs > 0) {
                warnings.push({
                    type: 'negative_net',
                    severity: 'error',
                    building: lv === 0 ? b.name : cfg.name,
                    buildingId: b.id,
                    level: lv,
                    epoch: b.epoch,
                    detail: `净产出为负: 产出${outVal.toFixed(2)} - 投入${inVal.toFixed(2)} = ${netVal.toFixed(2)}`,
                });
            }

            if (lv > 0 && prevPerWorker !== null && perWorker < prevPerWorker * 0.95) {
                warnings.push({
                    type: 'upgrade_regression',
                    severity: 'warning',
                    building: cfg.name,
                    buildingId: b.id,
                    level: lv,
                    epoch: b.epoch,
                    detail: `升级后人均效率倒退: Lv${lv - 1}=${prevPerWorker.toFixed(2)} → Lv${lv}=${perWorker.toFixed(2)}`,
                });
            }
            prevPerWorker = perWorker;
        }
    }

    const producerMap = {};
    for (const b of BUILDINGS) {
        for (const res of Object.keys(b.output || {})) {
            if (!producerMap[res]) producerMap[res] = [];
            producerMap[res].push(b.id);
        }
    }
    for (const b of BUILDINGS) {
        for (const res of Object.keys(b.input || {})) {
            if (!producerMap[res] || producerMap[res].length === 0) {
                warnings.push({
                    type: 'no_producer',
                    severity: 'error',
                    building: b.name,
                    buildingId: b.id,
                    level: 0,
                    epoch: b.epoch,
                    detail: `消耗的资源 "${RESOURCES[res]?.name || res}" 没有任何建筑生产`,
                });
            }
        }
    }

    for (const [id, s] of Object.entries(STRATA)) {
        for (const res of Object.keys(s.needs || {})) {
            if (!producerMap[res] || producerMap[res].length === 0) {
                warnings.push({
                    type: 'unmet_need',
                    severity: 'warning',
                    building: s.name,
                    buildingId: id,
                    level: 0,
                    epoch: s.unlockEpoch || 0,
                    detail: `基础需求 "${RESOURCES[res]?.name || res}" 没有任何建筑生产`,
                });
            }
        }
    }

    return warnings;
}

// ===== 产业链分析 =====
function analyzeProductionChains() {
    const chains = {};
    for (const b of BUILDINGS) {
        for (const [res, amt] of Object.entries(b.input || {})) {
            if (!chains[res]) chains[res] = { consumers: [], producers: [] };
            chains[res].consumers.push({ id: b.id, name: b.name, amount: amt, epoch: b.epoch });
        }
        for (const [res, amt] of Object.entries(b.output || {})) {
            if (RESOURCES[res]?.type === 'virtual') continue;
            if (!chains[res]) chains[res] = { consumers: [], producers: [] };
            chains[res].producers.push({ id: b.id, name: b.name, amount: amt, epoch: b.epoch });
        }
    }
    return chains;
}

// ===== 生成 HTML =====
function generateHTML(buildingsData, strataData, resourceBalance, warnings, chains) {
    const data = {
        buildings: buildingsData,
        strata: strataData,
        resourceBalance,
        warnings,
        chains,
        resources: Object.fromEntries(Object.entries(RESOURCES).map(([k, v]) => [k, { name: v.name, basePrice: v.basePrice, type: v.type, unlockEpoch: v.unlockEpoch, tags: v.tags }])),
        epochNames: EPOCH_NAMES,
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>哈耶克的文明 — 数值平衡分析工具</title>
<style>
:root { --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #e2e8f0; --dim: #94a3b8; --accent: #38bdf8; --green: #4ade80; --red: #f87171; --yellow: #fbbf24; --purple: #a78bfa; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); font-size: 13px; }
.header { background: linear-gradient(135deg, #1e3a5f, #0f172a); padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 16px; }
.header h1 { font-size: 18px; font-weight: 600; }
.header .stats { color: var(--dim); font-size: 12px; }
.tabs { display: flex; gap: 2px; background: var(--card); padding: 4px; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
.tab { padding: 8px 16px; cursor: pointer; border-radius: 4px; font-size: 13px; color: var(--dim); transition: all .15s; }
.tab:hover { color: var(--text); background: rgba(255,255,255,0.05); }
.tab.active { color: var(--accent); background: rgba(56,189,248,0.1); font-weight: 600; }
.panel { display: none; padding: 16px; }
.panel.active { display: block; }
.filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.filters select, .filters input { background: var(--card); color: var(--text); border: 1px solid var(--border); padding: 6px 10px; border-radius: 4px; font-size: 12px; }
.filters label { color: var(--dim); font-size: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: var(--card); color: var(--dim); padding: 8px 6px; text-align: left; font-weight: 500; border-bottom: 1px solid var(--border); cursor: pointer; white-space: nowrap; user-select: none; position: sticky; top: 40px; z-index: 50; }
th:hover { color: var(--accent); }
th .sort-arrow { font-size: 10px; margin-left: 2px; }
td { padding: 6px; border-bottom: 1px solid rgba(51,65,85,0.5); vertical-align: top; }
tr:hover td { background: rgba(255,255,255,0.03); }
.res-list { display: flex; flex-wrap: wrap; gap: 2px 8px; }
.res-item { white-space: nowrap; }
.res-name { color: var(--dim); }
.res-val { font-weight: 500; }
.positive { color: var(--green); }
.negative { color: var(--red); }
.neutral { color: var(--dim); }
.badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; }
.badge-epoch { background: rgba(56,189,248,0.15); color: var(--accent); }
.badge-cat { background: rgba(167,139,250,0.15); color: var(--purple); }
.badge-lv { background: rgba(251,191,36,0.15); color: var(--yellow); }
.badge-error { background: rgba(248,113,113,0.2); color: var(--red); }
.badge-warning { background: rgba(251,191,36,0.2); color: var(--yellow); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.card h3 { font-size: 14px; margin-bottom: 8px; color: var(--accent); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.bar-container { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.bar { height: 14px; border-radius: 2px; min-width: 2px; }
.bar-supply { background: var(--green); }
.bar-demand { background: var(--red); }
.bar-label { font-size: 11px; color: var(--dim); width: 70px; text-align: right; flex-shrink: 0; }
.bar-value { font-size: 11px; width: 60px; flex-shrink: 0; }
.summary-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.summary-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; min-width: 140px; }
.summary-card .value { font-size: 24px; font-weight: 700; color: var(--accent); }
.summary-card .label { font-size: 11px; color: var(--dim); margin-top: 2px; }
.strata-section { margin-bottom: 16px; }
.strata-section h4 { font-size: 13px; margin-bottom: 4px; color: var(--yellow); }
.lux-tier { margin-left: 12px; margin-bottom: 4px; }
.lux-tier .threshold { color: var(--purple); font-weight: 600; }
.epoch-selector { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
.epoch-btn { padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; background: var(--card); border: 1px solid var(--border); color: var(--dim); }
.epoch-btn.active { background: rgba(56,189,248,0.15); color: var(--accent); border-color: var(--accent); }
.chain-node { display: inline-block; padding: 2px 8px; background: rgba(56,189,248,0.1); border-radius: 3px; margin: 1px; font-size: 11px; }
.search-box { width: 200px; }
</style>
</head>
<body>
<div class="header">
    <h1>⚖️ 哈耶克的文明 — 数值平衡分析工具</h1>
    <div class="stats" id="headerStats"></div>
</div>
<div class="tabs" id="tabBar"></div>
<div id="panels"></div>

<script>
const DATA = ${JSON.stringify(data)};
const RES = DATA.resources;
const EPOCH_NAMES = DATA.epochNames;
const CAT_NAMES = { gather:'采集', industry:'工业', civic:'民用', military:'军事' };

function resName(k) { return RES[k]?.name || k; }
function fmtRes(obj, cls) {
    if (!obj || Object.keys(obj).length === 0) return '<span class="neutral">—</span>';
    return Object.entries(obj).map(([k,v]) => {
        if (RES[k]?.type === 'virtual') return \`<span class="res-item"><span class="res-name">\${resName(k)}</span> <span class="res-val \${cls||''}">\${v}</span></span>\`;
        return \`<span class="res-item"><span class="res-name">\${resName(k)}</span> <span class="res-val \${cls||''}">\${+v.toFixed(4)}</span></span>\`;
    }).join(' ');
}
function fmtJobs(obj) {
    if (!obj || Object.keys(obj).length === 0) return '—';
    const strataMap = {};
    DATA.strata.forEach(s => strataMap[s.id] = s.name);
    return Object.entries(obj).map(([k,v]) => \`\${strataMap[k]||k}×\${v}\`).join(' ');
}
function fmtVal(v, digits=2) {
    if (v > 0) return \`<span class="positive">+\${v.toFixed(digits)}</span>\`;
    if (v < 0) return \`<span class="negative">\${v.toFixed(digits)}</span>\`;
    return \`<span class="neutral">0</span>\`;
}

// ===== Tab system =====
const TABS = [
    { id:'buildings', label:'🏗️ 建筑总览' },
    { id:'efficiency', label:'📊 效率排行' },
    { id:'strata', label:'👥 阶层需求' },
    { id:'supply', label:'📦 资源收支' },
    { id:'chains', label:'🔗 产业链' },
    { id:'warnings', label:'⚠️ 预警' },
];
let activeTab = 'buildings';

function renderTabs() {
    document.getElementById('tabBar').innerHTML = TABS.map(t =>
        \`<div class="tab \${t.id===activeTab?'active':''}" onclick="switchTab('\${t.id}')">\${t.label}</div>\`
    ).join('');
}
function switchTab(id) {
    activeTab = id;
    renderTabs();
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-'+id));
}

// ===== Buildings Panel =====
let bSort = { col: 'epoch', dir: 1 };
let bFilterEpoch = -1;
let bFilterCat = '';
let bSearch = '';

function renderBuildings() {
    let rows = DATA.buildings.filter(r => {
        if (bFilterEpoch >= 0 && r.epoch !== bFilterEpoch) return false;
        if (bFilterCat && r.cat !== bFilterCat) return false;
        if (bSearch && !r.name.includes(bSearch) && !r.id.includes(bSearch)) return false;
        return true;
    });
    const col = bSort.col;
    rows.sort((a,b) => {
        let va = a[col], vb = b[col];
        if (typeof va === 'string') return va.localeCompare(vb) * bSort.dir;
        return ((va||0) - (vb||0)) * bSort.dir;
    });

    const arrow = (c) => bSort.col===c ? (bSort.dir>0?'▲':'▼') : '';
    const th = (label, col) => \`<th onclick="sortBuildings('\${col}')">\${label} <span class="sort-arrow">\${arrow(col)}</span></th>\`;

    let html = \`<div class="filters">
        <label>时代:</label><select onchange="bFilterEpoch=+this.value;renderBuildings()">
            <option value="-1">全部</option>
            \${EPOCH_NAMES.map((n,i) => \`<option value="\${i}" \${bFilterEpoch===i?'selected':''}>\${i}.\${n}</option>\`).join('')}
        </select>
        <label>类别:</label><select onchange="bFilterCat=this.value;renderBuildings()">
            <option value="">全部</option>
            \${Object.entries(CAT_NAMES).map(([k,v]) => \`<option value="\${k}" \${bFilterCat===k?'selected':''}>\${v}</option>\`).join('')}
        </select>
        <input class="search-box" placeholder="搜索建筑名/ID..." value="\${bSearch}" oninput="bSearch=this.value;renderBuildings()">
        <span class="neutral">共 \${rows.length} 条</span>
    </div>
    <div style="overflow-x:auto"><table>
    <tr>\${th('建筑','name')}\${th('Lv','level')}\${th('时代','epoch')}\${th('类别','cat')}\${th('所有者','owner')}
    <th>建造/升级成本</th><th>投入 (每秒)</th><th>产出 (每秒)</th><th>岗位</th>
    \${th('总岗位','totalJobs')}\${th('产出价值','outVal')}\${th('投入价值','inVal')}\${th('净值','netVal')}\${th('人均净值','perWorker')}</tr>\`;

    for (const r of rows) {
        const netCls = r.netVal >= 0 ? 'positive' : 'negative';
        const pwCls = r.perWorker >= 0 ? 'positive' : 'negative';
        html += \`<tr>
            <td><strong>\${r.name}</strong><br><span class="neutral" style="font-size:11px">\${r.id}</span></td>
            <td>\${r.level > 0 ? \`<span class="badge badge-lv">Lv\${r.level}</span>\` : '基础'}</td>
            <td><span class="badge badge-epoch">\${r.epoch}.\${EPOCH_NAMES[r.epoch]||''}</span></td>
            <td><span class="badge badge-cat">\${CAT_NAMES[r.cat]||r.cat}</span></td>
            <td>\${DATA.strata.find(s=>s.id===r.owner)?.name || r.owner}</td>
            <td><div class="res-list">\${fmtRes(r.level===0 ? r.baseCost : r.upgradeCost)}</div></td>
            <td><div class="res-list">\${fmtRes(r.input, 'negative')}</div></td>
            <td><div class="res-list">\${fmtRes(r.output, 'positive')}</div></td>
            <td style="font-size:11px">\${fmtJobs(r.jobs)}</td>
            <td>\${r.totalJobs}</td>
            <td>\${r.outVal.toFixed(2)}</td>
            <td>\${r.inVal.toFixed(2)}</td>
            <td class="\${netCls}">\${r.netVal.toFixed(2)}</td>
            <td class="\${pwCls}">\${r.perWorker.toFixed(2)}</td>
        </tr>\`;
    }
    html += '</table></div>';
    document.getElementById('panel-buildings').innerHTML = html;
}
window.sortBuildings = function(col) {
    if (bSort.col === col) bSort.dir *= -1;
    else { bSort.col = col; bSort.dir = 1; }
    renderBuildings();
};

// ===== Efficiency Ranking =====
function renderEfficiency() {
    const base = DATA.buildings.filter(r => r.level === 0 && r.totalJobs > 0);
    base.sort((a,b) => b.perWorker - a.perWorker);

    let html = '<h3 style="margin-bottom:12px">建筑人均净产出价值排行（基础级）</h3>';
    html += '<div style="overflow-x:auto"><table><tr><th>#</th><th>建筑</th><th>时代</th><th>类别</th><th>总岗位</th><th>产出价值</th><th>投入价值</th><th>净产出</th><th>人均净值</th><th>最高升级人均</th></tr>';

    for (let i = 0; i < base.length; i++) {
        const r = base[i];
        const upgrades = DATA.buildings.filter(b => b.id === r.id && b.level > 0);
        const maxUpgPW = upgrades.length > 0 ? Math.max(...upgrades.map(u => u.perWorker)) : r.perWorker;
        const netCls = r.netVal >= 0 ? 'positive' : 'negative';
        html += \`<tr>
            <td>\${i+1}</td>
            <td><strong>\${r.name}</strong></td>
            <td><span class="badge badge-epoch">\${r.epoch}.\${EPOCH_NAMES[r.epoch]}</span></td>
            <td><span class="badge badge-cat">\${CAT_NAMES[r.cat]||r.cat}</span></td>
            <td>\${r.totalJobs}</td>
            <td>\${r.outVal.toFixed(2)}</td>
            <td>\${r.inVal.toFixed(2)}</td>
            <td class="\${netCls}">\${r.netVal.toFixed(2)}</td>
            <td class="\${r.perWorker>=0?'positive':'negative'}">\${r.perWorker.toFixed(2)}</td>
            <td class="\${maxUpgPW>=0?'positive':'negative'}">\${maxUpgPW.toFixed(2)}</td>
        </tr>\`;
    }
    html += '</table></div>';

    html += '<h3 style="margin:20px 0 12px">升级效率对比</h3>';
    html += '<div style="overflow-x:auto"><table><tr><th>建筑</th><th>时代</th>';
    html += '<th>Lv0 人均</th><th>Lv1 人均</th><th>Lv2 人均</th><th>Lv0→1 提升</th><th>Lv1→2 提升</th></tr>';

    const grouped = {};
    DATA.buildings.forEach(b => { if (!grouped[b.id]) grouped[b.id] = []; grouped[b.id].push(b); });

    for (const [id, levels] of Object.entries(grouped)) {
        if (levels.length <= 1) continue;
        levels.sort((a,b) => a.level - b.level);
        const lv0 = levels[0];
        const lv1 = levels[1];
        const lv2 = levels[2];
        const d1 = lv1 ? ((lv1.perWorker - lv0.perWorker) / Math.abs(lv0.perWorker || 1) * 100) : 0;
        const d2 = lv2 && lv1 ? ((lv2.perWorker - lv1.perWorker) / Math.abs(lv1.perWorker || 1) * 100) : 0;
        html += \`<tr>
            <td><strong>\${lv0.name}</strong></td>
            <td><span class="badge badge-epoch">\${lv0.epoch}.\${EPOCH_NAMES[lv0.epoch]}</span></td>
            <td>\${lv0.perWorker.toFixed(2)}</td>
            <td>\${lv1 ? lv1.perWorker.toFixed(2) : '—'}</td>
            <td>\${lv2 ? lv2.perWorker.toFixed(2) : '—'}</td>
            <td class="\${d1>=0?'positive':'negative'}">\${lv1 ? d1.toFixed(1)+'%' : '—'}</td>
            <td class="\${d2>=0?'positive':'negative'}">\${lv2 ? d2.toFixed(1)+'%' : '—'}</td>
        </tr>\`;
    }
    html += '</table></div>';
    document.getElementById('panel-efficiency').innerHTML = html;
}

// ===== Strata Panel =====
let sFilterEpoch = -1;
function renderStrata() {
    let rows = DATA.strata;
    if (sFilterEpoch >= 0) rows = rows.filter(s => (s.unlockEpoch || 0) <= sFilterEpoch);

    let html = \`<div class="filters">
        <label>可用于时代≤:</label><select onchange="sFilterEpoch=+this.value;renderStrata()">
            <option value="-1">全部</option>
            \${EPOCH_NAMES.map((n,i) => \`<option value="\${i}" \${sFilterEpoch===i?'selected':''}>\${i}.\${n}</option>\`).join('')}
        </select>
    </div>\`;

    for (const s of rows) {
        html += \`<div class="card"><h3>\${s.name} (\${s.id})</h3>
        <div class="grid3" style="margin-bottom:12px">
            <div><span class="neutral">权重:</span> \${s.weight} | <span class="neutral">税率:</span> \${s.tax} | <span class="neutral">财富权重:</span> \${s.wealthWeight}</div>
            <div><span class="neutral">影响力:</span> \${s.influenceBase} | <span class="neutral">初始财富:</span> \${s.startingWealth}</div>
            <div><span class="neutral">消费弹性:</span> \${s.wealthElasticity} | <span class="neutral">消费上限:</span> \${s.maxConsumptionMultiplier}x</div>
        </div>
        <div class="strata-section">
            <h4>基础需求 (每人每秒) — 价值: \${s.needsValue}</h4>
            <div class="res-list">\${fmtRes(s.needs)}</div>
        </div>\`;

        if (s.luxuryNeeds && s.luxuryNeeds.length > 0) {
            html += '<div class="strata-section"><h4>富裕需求 (按财富比解锁)</h4>';
            let cumValue = s.needsValue;
            for (const tier of s.luxuryNeeds) {
                cumValue += tier.value;
                html += \`<div class="lux-tier">
                    <span class="threshold">≥\${tier.threshold}x</span>
                    <span class="neutral"> (本层价值: \${tier.value.toFixed(2)}, 累计: \${cumValue.toFixed(2)})</span><br>
                    <div class="res-list" style="margin-left:8px">\${fmtRes(tier.needs)}</div>
                </div>\`;
            }
            html += '</div>';
        }

        if (s.buffs) {
            html += '<div class="strata-section"><h4>满意/不满效果</h4>';
            html += \`<div class="positive">满意: \${s.buffs.satisfied?.desc || '—'} \${Object.entries(s.buffs.satisfied||{}).filter(([k])=>k!=='desc').map(([k,v])=>\`\${k}:\${v>0?'+':''}\ \${v}\`).join(' ')}</div>\`;
            html += \`<div class="negative">不满: \${s.buffs.dissatisfied?.desc || '—'} \${Object.entries(s.buffs.dissatisfied||{}).filter(([k])=>k!=='desc').map(([k,v])=>\`\${k}:\${v>0?'+':''}\${v}\`).join(' ')}</div>\`;
            html += '</div>';
        }
        html += '</div>';
    }
    document.getElementById('panel-strata').innerHTML = html;
}

// ===== Supply/Demand =====
let sdEpoch = 0;
function renderSupply() {
    const ep = DATA.resourceBalance[sdEpoch];
    if (!ep) return;
    const allRes = new Set([...Object.keys(ep.supply), ...Object.keys(ep.demand)]);
    const items = [...allRes].map(r => ({
        name: resName(r),
        key: r,
        supply: ep.supply[r] || 0,
        demand: ep.demand[r] || 0,
        balance: (ep.supply[r] || 0) - (ep.demand[r] || 0),
    })).filter(i => RES[i.key]?.type !== 'virtual').sort((a,b) => a.balance - b.balance);

    const maxVal = Math.max(...items.map(i => Math.max(i.supply, i.demand)), 1);

    let html = '<div class="epoch-selector">';
    for (let i = 0; i <= 9; i++) {
        html += \`<div class="epoch-btn \${sdEpoch===i?'active':''}" onclick="sdEpoch=\${i};renderSupply()">\${i}.\${EPOCH_NAMES[i]}</div>\`;
    }
    html += '</div>';
    html += \`<p class="neutral" style="margin-bottom:12px">展示该时代及之前所有可用建筑的 <strong>单建筑</strong> 产出/消耗汇总（每种建筑各1座）</p>\`;

    html += '<div style="overflow-x:auto"><table><tr><th style="width:100px">资源</th><th style="width:80px">产出</th><th style="width:80px">消耗</th><th style="width:80px">差值</th><th>可视化</th></tr>';
    for (const i of items) {
        const bCls = i.balance >= 0 ? 'positive' : 'negative';
        const sw = Math.max(2, i.supply / maxVal * 300);
        const dw = Math.max(2, i.demand / maxVal * 300);
        html += \`<tr>
            <td><strong>\${i.name}</strong></td>
            <td class="positive">\${i.supply.toFixed(2)}</td>
            <td class="negative">\${i.demand.toFixed(2)}</td>
            <td class="\${bCls}">\${i.balance>=0?'+':''}\${i.balance.toFixed(2)}</td>
            <td>
                <div class="bar-container"><span class="bar-label">产出</span><div class="bar bar-supply" style="width:\${sw}px"></div><span class="bar-value positive">\${i.supply.toFixed(2)}</span></div>
                <div class="bar-container"><span class="bar-label">消耗</span><div class="bar bar-demand" style="width:\${dw}px"></div><span class="bar-value negative">\${i.demand.toFixed(2)}</span></div>
            </td>
        </tr>\`;
    }
    html += '</table></div>';
    document.getElementById('panel-supply').innerHTML = html;
}

// ===== Chains =====
let chainSearch = '';
function renderChains() {
    let keys = Object.keys(DATA.chains).filter(k => RES[k]?.type !== 'virtual');
    if (chainSearch) keys = keys.filter(k => resName(k).includes(chainSearch) || k.includes(chainSearch));
    keys.sort((a,b) => resName(a).localeCompare(resName(b)));

    let html = \`<div class="filters">
        <input class="search-box" placeholder="搜索资源..." value="\${chainSearch}" oninput="chainSearch=this.value;renderChains()">
        <span class="neutral">共 \${keys.length} 种资源</span>
    </div>\`;

    for (const k of keys) {
        const c = DATA.chains[k];
        html += \`<div class="card"><h3>\${resName(k)} (\${k})</h3><div class="grid2">
            <div><strong class="positive">生产者 (\${c.producers.length})</strong><br>\${
                c.producers.length ? c.producers.map(p => \`<span class="chain-node">\${p.name} <span class="positive">+\${p.amount.toFixed(2)}</span> <span class="neutral">[E\${p.epoch}]</span></span>\`).join(' ') : '<span class="neutral">无</span>'
            }</div>
            <div><strong class="negative">消耗者 (\${c.consumers.length})</strong><br>\${
                c.consumers.length ? c.consumers.map(p => \`<span class="chain-node">\${p.name} <span class="negative">-\${p.amount.toFixed(2)}</span> <span class="neutral">[E\${p.epoch}]</span></span>\`).join(' ') : '<span class="neutral">无</span>'
            }</div>
        </div></div>\`;
    }
    document.getElementById('panel-chains').innerHTML = html;
}

// ===== Warnings =====
function renderWarnings() {
    const w = DATA.warnings;
    const errors = w.filter(x => x.severity === 'error');
    const warns = w.filter(x => x.severity === 'warning');

    let html = \`<div class="summary-row">
        <div class="summary-card"><div class="value" style="color:var(--red)">\${errors.length}</div><div class="label">错误</div></div>
        <div class="summary-card"><div class="value" style="color:var(--yellow)">\${warns.length}</div><div class="label">警告</div></div>
        <div class="summary-card"><div class="value">\${DATA.buildings.filter(b=>b.level===0).length}</div><div class="label">建筑总数</div></div>
        <div class="summary-card"><div class="value">\${DATA.strata.length}</div><div class="label">阶层总数</div></div>
        <div class="summary-card"><div class="value">\${Object.keys(RES).filter(k=>RES[k].type!=='virtual').length}</div><div class="label">资源种类</div></div>
    </div>\`;

    html += '<div style="overflow-x:auto"><table><tr><th>严重度</th><th>类型</th><th>建筑/阶层</th><th>等级</th><th>时代</th><th>详情</th></tr>';
    for (const x of [...errors, ...warns]) {
        const typeNames = { negative_net:'净产出为负', upgrade_regression:'升级倒退', no_producer:'资源无来源', unmet_need:'需求无来源' };
        html += \`<tr>
            <td><span class="badge badge-\${x.severity}">\${x.severity==='error'?'错误':'警告'}</span></td>
            <td>\${typeNames[x.type]||x.type}</td>
            <td><strong>\${x.building}</strong></td>
            <td>\${x.level > 0 ? 'Lv'+x.level : '基础'}</td>
            <td><span class="badge badge-epoch">\${x.epoch}.\${EPOCH_NAMES[x.epoch]||''}</span></td>
            <td>\${x.detail}</td>
        </tr>\`;
    }
    html += '</table></div>';
    document.getElementById('panel-warnings').innerHTML = html;
}

// ===== Init =====
function init() {
    document.getElementById('headerStats').textContent =
        \`建筑: \${DATA.buildings.filter(b=>b.level===0).length} | 阶层: \${DATA.strata.length} | 资源: \${Object.keys(RES).filter(k=>RES[k].type!=='virtual').length} | 时代: \${EPOCH_NAMES.length}\`;

    renderTabs();

    let panelsHtml = '';
    for (const t of TABS) {
        panelsHtml += \`<div class="panel \${t.id===activeTab?'active':''}" id="panel-\${t.id}"></div>\`;
    }
    document.getElementById('panels').innerHTML = panelsHtml;

    renderBuildings();
    renderEfficiency();
    renderStrata();
    renderSupply();
    renderChains();
    renderWarnings();
}
init();
</script>
</body>
</html>`;
}

// ===== Main =====
const buildingsData = analyzeBuildingsData();
const strataData = analyzeStrataData();
const resourceBalance = analyzeResourceBalance();
const warnings = analyzeWarnings();
const chains = analyzeProductionChains();

const html = generateHTML(buildingsData, strataData, resourceBalance, warnings, chains);
const outPath = path.join(__dirname, 'balance-report.html');
fs.writeFileSync(outPath, html, 'utf-8');

console.log(`✅ 平衡分析报告已生成: ${outPath}`);
console.log(`   建筑: ${BUILDINGS.length} 种 (含 ${buildingsData.length - BUILDINGS.length} 个升级等级)`);
console.log(`   阶层: ${Object.keys(STRATA).length} 种`);
console.log(`   资源: ${Object.keys(RESOURCES).filter(k => RESOURCES[k].type !== 'virtual').length} 种`);
console.log(`   预警: ${warnings.filter(w => w.severity === 'error').length} 错误, ${warnings.filter(w => w.severity === 'warning').length} 警告`);
console.log(`\n请在浏览器中打开: file://${outPath.replace(/\\/g, '/')}`);
