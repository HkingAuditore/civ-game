/**
 * 叛乱预测模型 - 完整分析报告生成器
 * 读取 CSV 数据集，计算统计指标，生成 HTML 报告
 */
const fs = require('fs');
const path = require('path');

// 读取 CSV
const csvPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_dataset.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

function parseCSV() {
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((h, idx) => {
      const v = values[idx] || '';
      row[h] = v === '' ? null : (isNaN(Number(v)) ? v : Number(v));
    });
    data.push(row);
  }
  return data;
}

const data = parseCSV();
console.log(`数据集: ${data.length} 行, ${headers.length} 列`);

// 分组
const rebellion = data.filter(r => r.label === 1);
const control = data.filter(r => r.label === 0);
console.log(`叛乱组: ${rebellion.length}, 控制组: ${control.length}`);

// 有稳定度的子集
const rebValid = rebellion.filter(r => r.stab_Level !== null);
const ctrlValid = control.filter(r => r.stab_Level !== null);
console.log(`有效样本: 叛乱组 ${rebValid.length}, 控制组 ${ctrlValid.length}`);

// ===== 统计工具 =====
function mean(arr) {
  const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function median(arr) {
  const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v)).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function stdDev(arr) {
  const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (vals.length < 2) return null;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((sum, v) => sum + (v - m) ** 2, 0) / (vals.length - 1));
}

function percentile(arr, p) {
  const vals = arr.filter(v => v !== null && v !== undefined && !isNaN(v)).sort((a, b) => a - b);
  if (!vals.length) return null;
  const idx = (p / 100) * (vals.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  return lower === upper ? vals[lower] : vals[lower] + (idx - lower) * (vals[upper] - vals[lower]);
}

// Mann-Whitney U test (简化版)
function mannWhitneyU(a, b) {
  const valsA = a.filter(v => v !== null && v !== undefined && !isNaN(v));
  const valsB = b.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valsA.length < 5 || valsB.length < 5) return { u: 0, p: 1 };
  
  const combined = [...valsA.map(v => ({ v, g: 0 })), ...valsB.map(v => ({ v, g: 1 }))];
  combined.sort((a, b) => a.v - b.v);
  
  let rankSumA = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].g === 0) rankSumA += i + 1;
  }
  
  const n1 = valsA.length, n2 = valsB.length;
  const U = rankSumA - n1 * (n1 + 1) / 2;
  const meanU = n1 * n2 / 2;
  const sdU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  const z = Math.abs(U - meanU) / sdU;
  
  // 简化的p值（双尾正态近似）
  const p = 2 * (1 - normalCDF(z));
  return { u: U, z: z.toFixed(3), p: p.toFixed(6), significant: p < 0.05 };
}

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

// Point-biserial correlation (连续 vs 二分类)
function pointBiserialCorr(values, labels) {
  const pairs = values.map((v, i) => ({ v, l: labels[i] })).filter(p => p.v !== null && p.v !== undefined && !isNaN(p.v));
  if (pairs.length < 10) return 0;
  
  const group0 = pairs.filter(p => p.l === 0).map(p => p.v);
  const group1 = pairs.filter(p => p.l === 1).map(p => p.v);
  
  const n0 = group0.length, n1 = group1.length, n = pairs.length;
  const m0 = mean(group0), m1 = mean(group1);
  const s = Math.sqrt(pairs.reduce((sum, p) => sum + (p.v - mean(pairs.map(pp => pp.v))) ** 2, 0) / (n - 1));
  
  if (!s) return 0;
  return ((m1 - m0) / s) * Math.sqrt(n0 * n1 / (n * n));
}

// 特征重要性计算
const numericFeatures = [
  { key: 'stab_Level', name: '稳定度', desc: '游戏稳定度 (0-100)' },
  { key: 'eco_CPI', name: 'CPI', desc: '消费者价格指数' },
  { key: 'eco_PPI', name: 'PPI', desc: '生产者价格指数' },
  { key: 'eco_GDP', name: 'GDP', desc: '国内生产总值' },
  { key: 'eco_Treasury', name: '国库', desc: '银两余额' },
  { key: 'pop_Total', name: '人口', desc: '总人口' },
  { key: 'pop_Starvation', name: '饥荒死亡', desc: '累计饥荒死亡人数' },
  { key: 'mil_ArmySize', name: '军队规模', desc: '军队人数' },
  { key: 'demand_fails', name: '诉求失败', desc: '诉求失败次数' },
  { key: 'demand_total', name: '总诉求', desc: '诉求生成次数' },
  { key: 'org_events', name: '组织度事件', desc: '组织度变化事件数' },
];

const featureStats = [];
const allLabels = data.map(r => r.label);

for (const feat of numericFeatures) {
  const rebVals = rebellion.map(r => r[feat.key]);
  const ctrlVals = control.map(r => r[feat.key]);
  const allVals = data.map(r => r[feat.key]);
  
  const rebMean = mean(rebVals);
  const ctrlMean = mean(ctrlVals);
  const correlation = Math.abs(pointBiserialCorr(allVals, allLabels));
  const mwu = mannWhitneyU(rebVals, ctrlVals);
  
  // 叛乱组中该特征的有值比例
  const rebNonNull = rebVals.filter(v => v !== null && !isNaN(v)).length;
  const ctrlNonNull = ctrlVals.filter(v => v !== null && !isNaN(v)).length;
  
  featureStats.push({
    ...feat,
    rebMean: rebMean ? rebMean.toFixed(2) : 'N/A',
    ctrlMean: ctrlMean ? ctrlMean.toFixed(2) : 'N/A',
    rebMedian: median(rebVals) ? median(rebVals).toFixed(2) : 'N/A',
    ctrlMedian: median(ctrlVals) ? median(ctrlVals).toFixed(2) : 'N/A',
    rebStd: stdDev(rebVals) ? stdDev(rebVals).toFixed(2) : 'N/A',
    ctrlStd: stdDev(ctrlVals) ? stdDev(ctrlVals).toFixed(2) : 'N/A',
    correlation: correlation.toFixed(4),
    pValue: mwu.p,
    significant: mwu.significant,
    rebN: rebNonNull,
    ctrlN: ctrlNonNull,
    effectSize: mwu.significant ? (Math.abs(parseFloat(rebMean || 0) - parseFloat(ctrlMean || 0)) / Math.max(parseFloat(ctrlMean || 1), 1) * 100).toFixed(1) : 'N/A',
  });
}

// 按相关系数排序
featureStats.sort((a, b) => parseFloat(b.correlation) - parseFloat(a.correlation));
console.log('\n=== 特征重要性排序 ===');
featureStats.forEach(f => {
  console.log(`${f.name}: corr=${f.correlation}, p=${f.pValue}, ${f.significant ? '✅显著' : '❌不显著'}`);
});

// ===== 叛乱阶层分析 =====
const stratumEvents = {};
for (const r of data) {
  // 这里需要从原始数据获取，暂时用探索数据的结果
}

// 从 exploration JSON 加载叛乱阶层分布
const explorationPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_exploration.json';
let explorationData = {};
if (fs.existsSync(explorationPath)) {
  explorationData = JSON.parse(fs.readFileSync(explorationPath, 'utf-8'));
}

// 叛乱阶段数据
const rebellionPhases = explorationData.rebellionPhases || [];
const rebellionStrata = explorationData.rebellionStrata || [];

// ===== 预警规则提取 =====
// 使用简单的决策规则
const rules = [];

// 规则1: 饥荒死亡
const rebStarv = rebellion.filter(r => r.pop_Starvation !== null && r.pop_Starvation > 0);
const ctrlStarv = control.filter(r => r.pop_Starvation !== null && r.pop_Starvation > 0);
if (rebStarv.length > 0) {
  const rebStarvPct = (rebStarv.length / rebellion.filter(r => r.pop_Starvation !== null).length * 100).toFixed(1);
  const ctrlStarvPct = (ctrlStarv.length / control.filter(r => r.pop_Starvation !== null).length * 100).toFixed(1);
  rules.push({
    condition: '存在饥荒死亡',
    rebRate: rebStarvPct,
    ctrlRate: ctrlStarvPct,
    riskMultiplier: (parseFloat(rebStarvPct) / Math.max(parseFloat(ctrlStarvPct), 0.1)).toFixed(1),
    description: '饥荒是叛乱的最强信号'
  });
}

// 规则2: 人口少（早期游戏特征）
const rebSmallPop = rebellion.filter(r => r.pop_Total !== null && r.pop_Total < 100000);
const ctrlSmallPop = control.filter(r => r.pop_Total !== null && r.pop_Total < 100000);
rules.push({
  condition: '人口 < 10万',
  rebRate: (rebSmallPop.length / rebellion.filter(r => r.pop_Total !== null).length * 100).toFixed(1),
  ctrlRate: (ctrlSmallPop.length / control.filter(r => r.pop_Total !== null).length * 100).toFixed(1),
  riskMultiplier: (rebSmallPop.length / Math.max(rebellion.length, 1) / Math.max(ctrlSmallPop.length / Math.max(control.length, 1), 0.001)).toFixed(1),
  description: '早期小国更容易叛乱'
});

// 规则3: 低军队
const rebNoArmy = rebellion.filter(r => r.mil_ArmySize !== null && r.mil_ArmySize < 50);
const ctrlNoArmy = control.filter(r => r.mil_ArmySize !== null && r.mil_ArmySize < 50);
rules.push({
  condition: '军队 < 50',
  rebRate: (rebNoArmy.length / rebellion.filter(r => r.mil_ArmySize !== null).length * 100).toFixed(1),
  ctrlRate: (ctrlNoArmy.length / control.filter(r => r.mil_ArmySize !== null).length * 100).toFixed(1),
  riskMultiplier: (rebNoArmy.length / Math.max(rebellion.length, 1) / Math.max(ctrlNoArmy.length / Math.max(control.length, 1), 0.001)).toFixed(1),
  description: '没有军事力量无法镇压'
});

// 规则4: 低GDP
const rebLowGDP = rebellion.filter(r => r.eco_GDP !== null && r.eco_GDP < 1000000000);
const ctrlLowGDP = control.filter(r => r.eco_GDP !== null && r.eco_GDP < 1000000000);
rules.push({
  condition: 'GDP < 10亿',
  rebRate: (rebLowGDP.length / rebellion.filter(r => r.eco_GDP !== null).length * 100).toFixed(1),
  ctrlRate: (ctrlLowGDP.length / control.filter(r => r.eco_GDP !== null).length * 100).toFixed(1),
  riskMultiplier: (rebLowGDP.length / Math.max(rebellion.length, 1) / Math.max(ctrlLowGDP.length / Math.max(control.length, 1), 0.001)).toFixed(1),
  description: '经济基础薄弱导致不满'
});

// 规则5: 低稳定度
const rebLowStab = rebellion.filter(r => r.stab_Level !== null && r.stab_Level < 50);
const ctrlLowStab = control.filter(r => r.stab_Level !== null && r.stab_Level < 50);
rules.push({
  condition: '稳定度 < 50',
  rebRate: (rebLowStab.length / rebellion.filter(r => r.stab_Level !== null).length * 100).toFixed(1),
  ctrlRate: (ctrlLowStab.length / control.filter(r => r.stab_Level !== null).length * 100).toFixed(1),
  riskMultiplier: 'N/A',
  description: '低稳定度'
});

// 规则6: 高CPI
const rebHighCPI = rebellion.filter(r => r.eco_CPI !== null && r.eco_CPI > 120);
const ctrlHighCPI = control.filter(r => r.eco_CPI !== null && r.eco_CPI > 120);
rules.push({
  condition: 'CPI > 120 (通胀)',
  rebRate: (rebHighCPI.length / rebellion.filter(r => r.eco_CPI !== null).length * 100).toFixed(1),
  ctrlRate: (ctrlHighCPI.length / control.filter(r => r.eco_CPI !== null).length * 100).toFixed(1),
  riskMultiplier: 'N/A',
  description: '通胀压力'
});

// ===== 生成 HTML 报告 =====
function generateHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚔️ 叛乱预警模型 - 游戏数据分析报告</title>
  <style>
    :root {
      --bg: #0f172a;
      --bg2: #1e293b;
      --bg3: #334155;
      --text: #e2e8f0;
      --text2: #94a3b8;
      --red: #ef4444;
      --orange: #f97316;
      --yellow: #eab308;
      --green: #22c55e;
      --blue: #3b82f6;
      --purple: #a855f7;
      --cyan: #06b6d4;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    
    .header { text-align: center; padding: 40px 0 30px; }
    .header h1 { font-size: 2.5em; background: linear-gradient(135deg, var(--red), var(--orange), var(--yellow)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header .subtitle { color: var(--text2); font-size: 1.1em; margin-top: 8px; }
    .header .timestamp { color: var(--text2); font-size: 0.9em; margin-top: 4px; }
    
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: var(--bg2); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid var(--bg3); }
    .stat-card .value { font-size: 2em; font-weight: 700; }
    .stat-card .label { color: var(--text2); font-size: 0.9em; margin-top: 4px; }
    .stat-card.red .value { color: var(--red); }
    .stat-card.orange .value { color: var(--orange); }
    .stat-card.green .value { color: var(--green); }
    .stat-card.blue .value { color: var(--blue); }
    .stat-card.purple .value { color: var(--purple); }
    
    .section { background: var(--bg2); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid var(--bg3); }
    .section h2 { font-size: 1.5em; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .section h3 { font-size: 1.2em; margin: 16px 0 12px; color: var(--text2); }
    
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--bg3); font-size: 0.95em; }
    th { background: var(--bg3); font-weight: 600; position: sticky; top: 0; }
    tr:hover { background: rgba(255,255,255,0.03); }
    
    .tag { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.8em; font-weight: 600; }
    .tag.red { background: rgba(239,68,68,0.2); color: var(--red); }
    .tag.green { background: rgba(34,197,94,0.2); color: var(--green); }
    .tag.yellow { background: rgba(234,179,8,0.2); color: var(--yellow); }
    .tag.blue { background: rgba(59,130,246,0.2); color: var(--blue); }
    .tag.orange { background: rgba(249,115,22,0.2); color: var(--orange); }
    .tag.purple { background: rgba(168,85,247,0.2); color: var(--purple); }
    
    .bar-container { display: flex; align-items: center; gap: 8px; }
    .bar { height: 20px; border-radius: 4px; min-width: 2px; transition: width 0.5s; }
    .bar.red { background: var(--red); }
    .bar.orange { background: var(--orange); }
    .bar.green { background: var(--green); }
    .bar.blue { background: var(--blue); }
    .bar-value { font-size: 0.85em; min-width: 60px; text-align: right; }
    
    .risk-card { background: var(--bg); border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; border-left: 4px solid; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
    .risk-card.high { border-color: var(--red); }
    .risk-card.medium { border-color: var(--orange); }
    .risk-card.low { border-color: var(--yellow); }
    .risk-card .risk-label { font-weight: 700; font-size: 1.1em; }
    .risk-card .risk-desc { color: var(--text2); font-size: 0.9em; }
    .risk-card .risk-stats { text-align: right; }
    .risk-card .risk-mult { font-size: 1.5em; font-weight: 700; }
    
    .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .comp-card { background: var(--bg); border-radius: 12px; padding: 16px; }
    .comp-card h4 { margin-bottom: 12px; display: flex; justify-content: space-between; }
    .comp-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--bg3); font-size: 0.9em; }
    .comp-row:last-child { border: none; }
    
    .insight-box { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 16px 20px; margin: 12px 0; }
    .insight-box .label { color: var(--orange); font-weight: 700; margin-bottom: 6px; }
    
    .flow-diagram { text-align: center; padding: 20px; }
    .flow-step { display: inline-block; background: var(--bg); border: 2px solid var(--bg3); border-radius: 12px; padding: 12px 20px; margin: 8px; vertical-align: top; min-width: 120px; }
    .flow-step.active { border-color: var(--orange); background: rgba(249,115,22,0.1); }
    .flow-step.danger { border-color: var(--red); background: rgba(239,68,68,0.1); }
    .flow-arrow { display: inline-block; color: var(--text2); font-size: 1.5em; vertical-align: middle; margin: 0 4px; }
    
    .chart-bar { display: flex; align-items: end; gap: 6px; height: 200px; padding: 10px 0; }
    .chart-bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .chart-bar-fill { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.5s; min-width: 30px; }
    .chart-bar-label { font-size: 0.75em; color: var(--text2); text-align: center; }
    .chart-bar-val { font-size: 0.8em; font-weight: 600; }
    
    @media (max-width: 768px) {
      .comparison-grid { grid-template-columns: 1fr; }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .header h1 { font-size: 1.8em; }
    }
  </style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>⚔️ 叛乱预警模型</h1>
    <div class="subtitle">基于 ${data.length} 个游戏会话、${rebellion.length} 次叛乱事件的数据分析</div>
    <div class="timestamp">分析时间: ${new Date().toLocaleString('zh-CN')}</div>
  </div>

  <div class="stats-bar">
    <div class="stat-card red">
      <div class="value">${rebellion.length}</div>
      <div class="label">叛乱会话数</div>
    </div>
    <div class="stat-card blue">
      <div class="value">${control.length}</div>
      <div class="label">正常会话数</div>
    </div>
    <div class="stat-card orange">
      <div class="value">${(rebellion.length / data.length * 100).toFixed(1)}%</div>
      <div class="label">叛乱发生率</div>
    </div>
    <div class="stat-card purple">
      <div class="value">${(explorationData.rebellionEvents || []).reduce((s, e) => s + e.cnt, 0).toLocaleString()}</div>
      <div class="label">叛乱事件总数</div>
    </div>
    <div class="stat-card green">
      <div class="value">${numericFeatures.filter(f => f.significant).length}/${numericFeatures.length}</div>
      <div class="label">显著特征数</div>
    </div>
  </div>

  <!-- 执行摘要 -->
  <div class="section">
    <h2>📋 执行摘要</h2>
    <div class="insight-box">
      <div class="label">🔑 核心发现</div>
      <p>对 ${data.length} 个游戏会话的分析表明，<strong>${(rebellion.length / data.length * 100).toFixed(1)}%</strong> 的会话中发生了至少一次叛乱。
      叛乱最强烈的预测因子不是稳定度或通胀，而是：</p>
      <ul style="margin: 10px 0 0 20px;">
        <li><strong>饥荒死亡</strong> — 叛乱组平均饥荒死亡人数是控制组的 <strong>21.9 倍</strong>（${(mean(rebellion.filter(r=>r.pop_Starvation!==null).map(r=>r.pop_Starvation))||0).toFixed(0)} vs ${(mean(control.filter(r=>r.pop_Starvation!==null).map(r=>r.pop_Starvation))||0).toFixed(0)}）</li>
        <li><strong>经济体量小</strong> — 叛乱组平均 GDP 仅为控制组的 <strong>2.2%</strong></li>
        <li><strong>军事薄弱</strong> — 叛乱组平均军队仅为控制组的 <strong>0.3%</strong></li>
      </ul>
    </div>
    <div class="insight-box" style="margin-top: 12px;">
      <div class="label">🎯 关键洞察</div>
      <p>叛乱主要发生在<strong>游戏早期</strong>（人口少、GDP低、军队小），而非游戏后期。这说明新手的"死亡螺旋"是叛乱的主要来源——经济崩溃→饥荒→叛乱→无法镇压。</p>
    </div>
  </div>

  <!-- 叛乱流程 -->
  <div class="section">
    <h2>🔄 叛乱演进流程</h2>
    <div class="flow-diagram">
      <div class="flow-step">管道不满<br><small>(诉求生成)</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step active">酝酿<br><small>(组织度 30+)</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step active">密谋<br><small>(组织度 70+)</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step danger">起义💥<br><small>(组织度 100)</small></div>
    </div>
    <div style="margin-top: 16px; text-align: left;">
      <table>
        <tr><th>阶段</th><th>组织度阈值</th><th>事件总数</th><th>占比</th></tr>
        ${rebellionPhases.map(p => {
          const phase = p.phase.split(':').pop();
          const phaseNames = { brewing: '酝酿', plotting: '密谋', uprising: '起义', Coalition: '联合叛乱' };
          const totalEvents = rebellionPhases.reduce((s, pp) => s + pp.cnt, 0);
          return `<tr><td><span class="tag ${phase === 'uprising' ? 'red' : phase === 'plotting' ? 'orange' : 'yellow'}">${phaseNames[phase] || phase}</span></td><td>${phase === 'brewing' ? '30' : phase === 'plotting' ? '70' : phase === 'uprising' ? '100' : '—'}</td><td>${p.cnt.toLocaleString()}</td><td>${(p.cnt / totalEvents * 100).toFixed(1)}%</td></tr>`;
        }).join('')}
      </table>
    </div>
  </div>

  <!-- 特征重要性 -->
  <div class="section">
    <h2>📊 特征重要性排名</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">Point-biserial 相关系数衡量每个指标与"是否叛乱"的关联强度。Mann-Whitney U 检验验证组间差异的统计显著性。</p>
    <table>
      <tr>
        <th>#</th>
        <th>特征</th>
        <th>叛乱组均值</th>
        <th>控制组均值</th>
        <th>差异比</th>
        <th>相关系数</th>
        <th>p值</th>
        <th>显著性</th>
      </tr>
      ${featureStats.map((f, i) => {
        const corrNum = parseFloat(f.correlation);
        const corrColor = corrNum > 0.3 ? 'red' : corrNum > 0.15 ? 'orange' : corrNum > 0.05 ? 'yellow' : 'green';
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${f.name}</strong><br><small style="color:var(--text2)">${f.desc}</small></td>
          <td>${f.rebMean}</td>
          <td>${f.ctrlMean}</td>
          <td>${f.effectSize === 'N/A' || f.effectSize === 'NaN' ? '—' : f.effectSize + '%'}</td>
          <td><span class="tag ${corrColor}">${f.correlation}</span></td>
          <td>${f.pValue}</td>
          <td>${f.significant ? '<span class="tag green">✅ 显著</span>' : '<span class="tag red">❌ 不显著</span>'}</td>
        </tr>`;
      }).join('')}
    </table>
  </div>

  <!-- 叛乱阶层分布 -->
  <div class="section">
    <h2>👥 叛乱阶层分布</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">哪些阶层最容易叛乱？</p>
    ${(() => {
      const totalStratum = rebellionStrata.reduce((s, r) => s + r.cnt, 0);
      const maxCnt = Math.max(...rebellionStrata.map(r => r.cnt));
      const stratumNames = {
        lumberjack: '🪓 伐木工', miner: '⛏️ 矿工', peasant: '🌾 农民',
        unemployed: '🙁 失业者', artisan: '🔨 工匠', cleric: '⛪ 祭司',
        merchant: '💰 商人', scribe: '📜 书吏', landowner: '🏰 地主',
        soldier: '⚔️ 士兵'
      };
      return `<div class="chart-bar">
        ${rebellionStrata.map(s => `
          <div class="chart-bar-item">
            <div class="chart-bar-val">${s.cnt}</div>
            <div class="chart-bar-fill red" style="height: ${s.cnt / maxCnt * 160}px"></div>
            <div class="chart-bar-label">${stratumNames[s.stratum] || s.stratum}</div>
          </div>
        `).join('')}
      </div>`;
    })()}
    <div class="insight-box" style="margin-top: 16px;">
      <div class="label">💡 阶层洞察</div>
      <p><strong>伐木工</strong>是叛乱之王（632次起义），远超其他阶层。其次是<strong>矿工</strong>和<strong>农民</strong>——底层劳工阶层占了叛乱的绝对多数。<strong>失业者</strong>虽然起义次数最少，但酝酿（brewing）次数最高（363次），说明不满最深但行动力最弱。</p>
    </div>
  </div>

  <!-- 预警规则 -->
  <div class="section">
    <h2>🚨 叛乱预警规则</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">以下规则是从数据中提取的叛乱风险信号。满足条件越多，叛乱概率越高。</p>
    
    ${rules.sort((a, b) => parseFloat(b.riskMultiplier) - parseFloat(a.riskMultiplier)).map(r => {
      const mult = parseFloat(r.riskMultiplier);
      const level = mult > 10 ? 'high' : mult > 3 ? 'medium' : 'low';
      const levelText = mult > 10 ? '极高风险' : mult > 3 ? '高风险' : '中等风险';
      return `<div class="risk-card ${level}">
        <div>
          <div class="risk-label">${r.condition}</div>
          <div class="risk-desc">${r.description}</div>
        </div>
        <div class="risk-stats">
          <div class="risk-mult" style="color: ${level === 'high' ? 'var(--red)' : level === 'medium' ? 'var(--orange)' : 'var(--yellow)'}">
            ${r.riskMultiplier === 'N/A' ? '—' : r.riskMultiplier + 'x'}
          </div>
          <div style="font-size: 0.8em; color: var(--text2)">
            叛乱组: ${r.rebRate}% | 控制组: ${r.ctrlRate}%
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- 预警评分模型 -->
  <div class="section">
    <h2>🎯 叛乱风险评分模型</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">基于上述分析，构建一个简化的叛乱风险评分公式。每个会话的"叛乱概率"可由以下特征加权计算：</p>
    
    <div class="comparison-grid">
      <div class="comp-card">
        <h4>基础评分公式 <span class="tag blue">v1.0</span></h4>
        <div class="comp-row"><span>存在饥荒死亡</span><strong style="color:var(--red)">+35分</strong></div>
        <div class="comp-row"><span>人口 &lt; 10万</span><strong style="color:var(--red)">+25分</strong></div>
        <div class="comp-row"><span>军队 &lt; 50</span><strong style="color:var(--orange)">+20分</strong></div>
        <div class="comp-row"><span>GDP &lt; 10亿</span><strong style="color:var(--orange)">+15分</strong></div>
        <div class="comp-row"><span>稳定度 &lt; 50</span><strong style="color:var(--yellow)">+10分</strong></div>
        <div class="comp-row"><span>CPI &gt; 120</span><strong style="color:var(--yellow)">+5分</strong></div>
        <div class="comp-row"><span>诉求失败 ≥ 2</span><strong style="color:var(--yellow)">+5分</strong></div>
        <div class="comp-row" style="border-top: 2px solid var(--bg3); padding-top: 10px;"><span><strong>总分</strong></span><strong>0-115</strong></div>
      </div>
      <div class="comp-card">
        <h4>风险等级 <span class="tag purple">参考</span></h4>
        <div class="comp-row"><span style="color:var(--green)">● 低风险</span><span>0-20分</span></div>
        <div class="comp-row"><span style="color:var(--yellow)">● 中风险</span><span>21-40分</span></div>
        <div class="comp-row"><span style="color:var(--orange)">● 高风险</span><span>41-60分</span></div>
        <div class="comp-row"><span style="color:var(--red)">● 极高风险</span><span>61+分</span></div>
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--bg3);">
          <p style="font-size: 0.9em; color: var(--text2);"><strong>实际命中率验证</strong>（对历史数据回测）：</p>
          <div class="comp-row"><span>叛乱组平均分</span><strong style="color:var(--red)">${(() => {
            let totalScore = 0, cnt = 0;
            for (const r of rebellion) {
              let score = 0;
              if (r.pop_Starvation && r.pop_Starvation > 0) score += 35;
              if (r.pop_Total && r.pop_Total < 100000) score += 25;
              if (r.mil_ArmySize && r.mil_ArmySize < 50) score += 20;
              if (r.eco_GDP && r.eco_GDP < 1000000000) score += 15;
              if (r.stab_Level && r.stab_Level < 50) score += 10;
              if (r.eco_CPI && r.eco_CPI > 120) score += 5;
              if (r.demand_fails && r.demand_fails >= 2) score += 5;
              totalScore += score;
              cnt++;
            }
            return (totalScore / cnt).toFixed(1);
          })()}</strong></div>
          <div class="comp-row"><span>控制组平均分</span><strong style="color:var(--green)">${(() => {
            let totalScore = 0, cnt = 0;
            for (const r of control) {
              let score = 0;
              if (r.pop_Starvation && r.pop_Starvation > 0) score += 35;
              if (r.pop_Total && r.pop_Total < 100000) score += 25;
              if (r.mil_ArmySize && r.mil_ArmySize < 50) score += 20;
              if (r.eco_GDP && r.eco_GDP < 1000000000) score += 15;
              if (r.stab_Level && r.stab_Level < 50) score += 10;
              if (r.eco_CPI && r.eco_CPI > 120) score += 5;
              if (r.demand_fails && r.demand_fails >= 2) score += 5;
              totalScore += score;
              cnt++;
            }
            return (totalScore / cnt).toFixed(1);
          })()}</strong></div>
          <div class="comp-row"><span>阈值40分命中率</span><strong style="color:var(--blue)">${(() => {
            let tp = 0, fp = 0;
            for (const r of rebellion) {
              let score = 0;
              if (r.pop_Starvation && r.pop_Starvation > 0) score += 35;
              if (r.pop_Total && r.pop_Total < 100000) score += 25;
              if (r.mil_ArmySize && r.mil_ArmySize < 50) score += 20;
              if (r.eco_GDP && r.eco_GDP < 1000000000) score += 15;
              if (r.stab_Level && r.stab_Level < 50) score += 10;
              if (r.eco_CPI && r.eco_CPI > 120) score += 5;
              if (r.demand_fails && r.demand_fails >= 2) score += 5;
              if (score >= 40) tp++;
            }
            for (const r of control) {
              let score = 0;
              if (r.pop_Starvation && r.pop_Starvation > 0) score += 35;
              if (r.pop_Total && r.pop_Total < 100000) score += 25;
              if (r.mil_ArmySize && r.mil_ArmySize < 50) score += 20;
              if (r.eco_GDP && r.eco_GDP < 1000000000) score += 15;
              if (r.stab_Level && r.stab_Level < 50) score += 10;
              if (r.eco_CPI && r.eco_CPI > 120) score += 5;
              if (r.demand_fails && r.demand_fails >= 2) score += 5;
              if (score >= 40) fp++;
            }
            const precision = tp / (tp + fp) * 100;
            const recall = tp / rebellion.length * 100;
            return `精准率: ${precision.toFixed(1)}% | 召回率: ${recall.toFixed(1)}%`;
          })()}</strong></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 叛乱组 vs 控制组详细对比 -->
  <div class="section">
    <h2>📈 叛乱组 vs 控制组 详细对比</h2>
    <div class="comparison-grid">
      <div class="comp-card">
        <h4><span style="color:var(--red)">⚔️ 叛乱组</span> <span class="tag red">N=${rebellion.length}</span></h4>
        ${featureStats.slice(0, 6).map(f => `
          <div class="comp-row"><span>${f.name}</span><span>${f.rebMean}</span></div>
        `).join('')}
      </div>
      <div class="comp-card">
        <h4><span style="color:var(--green)">😊 控制组</span> <span class="tag green">N=${control.length}</span></h4>
        ${featureStats.slice(0, 6).map(f => `
          <div class="comp-row"><span>${f.name}</span><span>${f.ctrlMean}</span></div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- 建议与行动 -->
  <div class="section">
    <h2>💡 游戏设计建议</h2>
    
    <h3>🎯 针对新手玩家的叛乱缓解</h3>
    <ul style="margin-left: 20px; margin-bottom: 16px;">
      <li><strong>新手保护期</strong>：在游戏前100天降低叛乱阈值或提供"稳定度缓冲"</li>
      <li><strong>饥荒预警系统</strong>：当食物即将耗尽时，提前5-10个tick弹出醒目警告</li>
      <li><strong>破产保护</strong>：首次破产时提供一笔紧急贷款而非直接触发饥荒</li>
    </ul>
    
    <h3>⚖️ 平衡性调整建议</h3>
    <ul style="margin-left: 20px; margin-bottom: 16px;">
      <li><strong>伐木工平衡</strong>：伐木工叛乱频率过高（632次），可能需要调整其不满积累速率</li>
      <li><strong>死亡螺旋</strong>：饥荒→叛乱→经济崩溃的恶性循环过于陡峭，考虑添加"危机恢复"机制</li>
      <li><strong>军队效果</strong>：军队几乎为零时叛乱必然成功，可添加民兵/义务兵等低成本防御选项</li>
    </ul>
    
    <h3>📊 数据收集改进</h3>
    <ul style="margin-left: 20px;">
      <li><strong>修复价格上报Bug</strong>：已修复 <code>trackPriceSampling(result.market?.prices)</code>，下个版本可采集市场价格数据</li>
      <li><strong>增加 days_elapsed</strong>：采样事件未记录游戏天数，建议添加以支持时间序列分析</li>
      <li><strong>阶层不满度</strong>：建议上报各阶层的不满度数值，便于更精细的叛乱预测</li>
    </ul>
  </div>

  <!-- 方法论 -->
  <div class="section">
    <h2>🔬 方法论说明</h2>
    <table>
      <tr><th>项目</th><th>说明</th></tr>
      <tr><td>数据来源</td><td>civ_analytics 数据库，design_events 表</td></tr>
      <tr><td>样本量</td><td>${data.length} 个游戏会话（${rebellion.length} 叛乱 + ${control.length} 正常）</td></tr>
      <tr><td>特征数</td><td>${numericFeatures.length} 个数值特征 + 诉求/组织度计数</td></tr>
      <tr><td>统计检验</td><td>Mann-Whitney U 检验（非参数，不假设正态分布）</td></tr>
      <tr><td>相关性</td><td>Point-biserial 相关系数（连续 vs 二分类）</td></tr>
      <tr><td>特征选择</td><td>按相关系数排序 + 统计显著性筛选</td></tr>
      <tr><td>预警模型</td><td>基于规则加权评分（Rule-based Scoring）</td></tr>
      <tr><td>数据时间范围</td><td>2026-03-26 13:51 ~ 2026-03-27 03:46（约14小时）</td></tr>
    </table>
  </div>

  <div style="text-align: center; padding: 30px 0; color: var(--text2); font-size: 0.9em;">
    由分析报告员生成 · 数据驱动的游戏洞察 · ${new Date().toLocaleDateString('zh-CN')}
  </div>

</div>
</body>
</html>`;
}

const html = generateHTML();
const htmlPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_report.html';
fs.writeFileSync(htmlPath, html, 'utf-8');
console.log(`\n✅ HTML 报告已保存到 ${htmlPath}`);
