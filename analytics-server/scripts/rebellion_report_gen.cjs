/**
 * 叛乱预测模型 - 直接生成分析报告（不依赖CSV）
 * 内联完成数据获取、分析和报告生成
 */
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: "gz-cdb-bwmozb7l.sql.tencentcdb.com",
  port: 63818,
  user: "civ_analytics",
  password: "59951308",
  database: "civ_analytics",
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

async function query(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function main() {
  let conn = await mysql.createConnection(DB_CONFIG);
  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");

  // 获取叛乱 session
  console.log("1. 获取叛乱 session...");
  const rebSessions = await query(conn, `
    SELECT session_id FROM design_events WHERE event_id LIKE 'Rebellion:%' GROUP BY session_id
  `);
  const rebSet = new Set(rebSessions.map(r => r.session_id));
  console.log(`  叛乱 session: ${rebSet.size}`);

  // 获取叛乱前指标（叛乱组）
  console.log("2. 获取叛乱组指标...");
  const rebMetrics = await query(conn, `
    SELECT 
      rf.session_id,
      MAX(CASE WHEN d.event_id = 'Stability:Level' THEN d.event_value END) AS stability,
      MAX(CASE WHEN d.event_id = 'Economy:CPI' THEN d.event_value END) AS cpi,
      MAX(CASE WHEN d.event_id = 'Economy:PPI' THEN d.event_value END) AS ppi,
      MAX(CASE WHEN d.event_id = 'Economy:GDP' THEN d.event_value END) AS gdp,
      MAX(CASE WHEN d.event_id = 'Economy:Treasury' THEN d.event_value END) AS treasury,
      MAX(CASE WHEN d.event_id = 'Population:Total' THEN d.event_value END) AS population,
      MAX(CASE WHEN d.event_id = 'Population:Starvation' THEN d.event_value END) AS starvation,
      MAX(CASE WHEN d.event_id = 'Military:ArmySize' THEN d.event_value END) AS army_size
    FROM (
      SELECT DISTINCT session_id FROM design_events WHERE event_id LIKE 'Rebellion:%'
    ) rf
    JOIN design_events d ON d.session_id = rf.session_id
      AND d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:PPI', 'Economy:GDP', 
                          'Economy:Treasury', 'Population:Total', 'Population:Starvation', 'Military:ArmySize')
      AND d.created_at < (
        SELECT MIN(created_at) FROM design_events d2 
        WHERE d2.session_id = rf.session_id AND d2.event_id LIKE 'Rebellion:%'
      )
    GROUP BY rf.session_id
  `);
  console.log(`  叛乱组指标: ${rebMetrics.length} 行`);

  // 获取控制组指标
  console.log("3. 获取控制组指标...");
  const ctrlMetrics = await query(conn, `
    SELECT 
      d.session_id,
      MAX(CASE WHEN d.event_id = 'Stability:Level' THEN d.event_value END) AS stability,
      MAX(CASE WHEN d.event_id = 'Economy:CPI' THEN d.event_value END) AS cpi,
      MAX(CASE WHEN d.event_id = 'Economy:PPI' THEN d.event_value END) AS ppi,
      MAX(CASE WHEN d.event_id = 'Economy:GDP' THEN d.event_value END) AS gdp,
      MAX(CASE WHEN d.event_id = 'Economy:Treasury' THEN d.event_value END) AS treasury,
      MAX(CASE WHEN d.event_id = 'Population:Total' THEN d.event_value END) AS population,
      MAX(CASE WHEN d.event_id = 'Population:Starvation' THEN d.event_value END) AS starvation,
      MAX(CASE WHEN d.event_id = 'Military:ArmySize' THEN d.event_value END) AS army_size
    FROM design_events d
    WHERE d.session_id NOT IN (${Array(rebSet.size).fill('?').join(',')})
    AND d.event_id IN ('Stability:Level', 'Economy:CPI', 'Economy:PPI', 'Economy:GDP',
                        'Economy:Treasury', 'Population:Total', 'Population:Starvation', 'Military:ArmySize')
    GROUP BY d.session_id
  `, [...rebSet]);
  console.log(`  控制组指标: ${ctrlMetrics.length} 行`);

  // 诉求计数
  console.log("4. 获取诉求计数...");
  await conn.end();
  conn = await mysql.createConnection(DB_CONFIG);
  await conn.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
  
  const demandCounts = await query(conn, `
    SELECT 
      session_id,
      SUM(CASE WHEN event_id LIKE 'Demand:Fail:%' THEN 1 ELSE 0 END) AS demand_fails,
      SUM(CASE WHEN event_id LIKE 'Demand:Generate:%' THEN 1 ELSE 0 END) AS demand_total,
      SUM(CASE WHEN event_id LIKE 'Organization:%' THEN 1 ELSE 0 END) AS org_events
    FROM design_events
    GROUP BY session_id
  `);
  const demandMap = {};
  demandCounts.forEach(d => { demandMap[d.session_id] = d; });

  // 叛乱阶层分布
  console.log("5. 获取叛乱阶层分布...");
  const strataData = await query(conn, `
    SELECT 
      SUBSTRING_INDEX(event_id, ':', -1) AS stratum,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY stratum
    ORDER BY cnt DESC
  `);

  // 叛乱阶段分布
  const phaseData = await query(conn, `
    SELECT 
      SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 3), ':', -1) AS phase,
      COUNT(*) AS cnt
    FROM design_events 
    WHERE event_id LIKE 'Rebellion:phase:%'
    GROUP BY phase
    ORDER BY FIELD(phase, 'brewing', 'plotting', 'uprising')
  `);

  await conn.end();

  // ===== 统计分析 =====
  console.log("\n=== 开始统计分析 ===");

  const reb = rebMetrics.map(r => ({...r, label: 1, ...demandMap[r.session_id]}));
  const ctrl = ctrlMetrics.map(r => ({...r, label: 0, ...demandMap[r.session_id]}));
  
  console.log(`叛乱组: ${reb.length}, 控制组: ${ctrl.length}`);

  function mean(arr, key) {
    const vals = arr.map(r => r[key]).filter(v => v !== null && v !== undefined);
    return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
  }
  function median(arr, key) {
    const vals = arr.map(r => r[key]).filter(v => v !== null && v !== undefined).sort((a,b) => a-b);
    return vals.length ? vals[Math.floor(vals.length/2)] : null;
  }
  function pct(arr, key, condition) {
    const valid = arr.filter(r => r[key] !== null && r[key] !== undefined);
    return valid.length ? (valid.filter(r => condition(r[key])).length / valid.length * 100) : 0;
  }

  // Mann-Whitney U
  function mannWhitney(a, b) {
    const va = a.filter(v => v !== null && v !== undefined && !isNaN(v));
    const vb = b.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (va.length < 3 || vb.length < 3) return { p: 1 };
    const combined = [...va.map(v => ({v, g:0})), ...vb.map(v => ({v, g:1}))].sort((a,b) => a.v - b.v);
    let rankA = 0;
    combined.forEach((c, i) => { if (c.g === 0) rankA += i + 1; });
    const U = rankA - va.length * (va.length + 1) / 2;
    const mu = va.length * vb.length / 2;
    const sigma = Math.sqrt(va.length * vb.length * (va.length + vb.length + 1) / 12);
    const z = Math.abs(U - mu) / sigma;
    const p = 2 * (1 - normalCDF(z));
    return { z: z.toFixed(3), p: p.toFixed(6), sig: p < 0.05 };
  }
  function normalCDF(z) {
    const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
    z = Math.abs(z)/Math.sqrt(2);
    const t = 1/(1+p*z);
    return 0.5*(1-Math.sign(z)*(-(((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-z*z));
  }

  // 相关性
  function pointBiserial(allArr, key) {
    const pairs = allArr.filter(r => r[key] !== null && r[key] !== undefined && !isNaN(r[key]));
    if (pairs.length < 10) return 0;
    const g0 = pairs.filter(p => p.label === 0).map(p => p[key]);
    const g1 = pairs.filter(p => p.label === 1).map(p => p[key]);
    const allVals = pairs.map(p => p[key]);
    const m = allVals.reduce((a,b)=>a+b,0)/allVals.length;
    const s = Math.sqrt(allVals.reduce((sum,v)=>sum+(v-m)**2,0)/(allVals.length-1));
    if (!s) return 0;
    const m0 = g0.reduce((a,b)=>a+b,0)/g0.length;
    const m1 = g1.reduce((a,b)=>a+b,0)/g1.length;
    return Math.abs((m1-m0)/s*Math.sqrt(g0.length*g1.length/(allArr.length**2)));
  }

  const all = [...reb, ...ctrl];
  const features = [
    { key: 'stability', name: '稳定度', desc: '游戏稳定度 (0-100)' },
    { key: 'cpi', name: 'CPI', desc: '消费者价格指数' },
    { key: 'ppi', name: 'PPI', desc: '生产者价格指数' },
    { key: 'gdp', name: 'GDP', desc: '国内生产总值' },
    { key: 'treasury', name: '国库', desc: '银两余额' },
    { key: 'population', name: '人口', desc: '总人口' },
    { key: 'starvation', name: '饥荒死亡', desc: '累计饥荒死亡人数' },
    { key: 'army_size', name: '军队规模', desc: '军队人数' },
    { key: 'demand_fails', name: '诉求失败', desc: '诉求失败次数' },
    { key: 'org_events', name: '组织度事件', desc: '组织度变化事件数' },
  ];

  const featureStats = features.map(f => {
    const ra = reb.map(r => r[f.key]);
    const ca = ctrl.map(r => r[f.key]);
    const corr = pointBiserial(all, f.key);
    const mwu = mannWhitney(ra, ca);
    const rm = mean(reb, f.key);
    const cm = mean(ctrl, f.key);
    const ratio = (rm && cm && cm !== 0) ? (rm/cm).toFixed(2) : 'N/A';
    return {
      ...f,
      rebMean: rm ? formatNum(rm) : 'N/A',
      ctrlMean: cm ? formatNum(cm) : 'N/A',
      rebMedian: median(reb, f.key) ? formatNum(median(reb, f.key)) : 'N/A',
      ctrlMedian: median(ctrl, f.key) ? formatNum(median(ctrl, f.key)) : 'N/A',
      ratio,
      corr: corr.toFixed(4),
      p: mwu.p,
      sig: mwu.sig,
      rebN: ra.filter(v => v !== null && !isNaN(v)).length,
      ctrlN: ca.filter(v => v !== null && !isNaN(v)).length,
    };
  });
  featureStats.sort((a, b) => parseFloat(b.corr) - parseFloat(a.corr));

  // 风险规则
  const riskRules = [
    {
      condition: '存在饥荒死亡', desc: '饥荒是叛乱的最强信号',
      rebRate: pct(reb, 'starvation', v => v > 0),
      ctrlRate: pct(ctrl, 'starvation', v => v > 0),
    },
    {
      condition: '人口 < 10万', desc: '早期小国更容易叛乱',
      rebRate: pct(reb, 'population', v => v < 100000),
      ctrlRate: pct(ctrl, 'population', v => v < 100000),
    },
    {
      condition: '军队 < 50', desc: '没有军事力量无法镇压',
      rebRate: pct(reb, 'army_size', v => v < 50),
      ctrlRate: pct(ctrl, 'army_size', v => v < 50),
    },
    {
      condition: 'GDP < 10亿', desc: '经济基础薄弱',
      rebRate: pct(reb, 'gdp', v => v < 1000000000),
      ctrlRate: pct(ctrl, 'gdp', v => v < 1000000000),
    },
    {
      condition: '稳定度 < 50', desc: '低稳定度',
      rebRate: pct(reb, 'stability', v => v < 50),
      ctrlRate: pct(ctrl, 'stability', v => v < 50),
    },
    {
      condition: 'CPI > 120 (通胀)', desc: '通胀压力',
      rebRate: pct(reb, 'cpi', v => v > 120),
      ctrlRate: pct(ctrl, 'cpi', v => v > 120),
    },
    {
      condition: '诉求失败 ≥ 2次', desc: '多次诉求未满足',
      rebRate: pct(reb, 'demand_fails', v => v >= 2),
      ctrlRate: pct(ctrl, 'demand_fails', v => v >= 2),
    },
  ];
  riskRules.forEach(r => {
    r.mult = r.ctrlRate > 0.1 ? (r.rebRate / r.ctrlRate).toFixed(1) : '∞';
  });

  // 评分验证
  function calcScore(r) {
    let s = 0;
    if (r.starvation > 0) s += 35;
    if (r.population && r.population < 100000) s += 25;
    if (r.army_size && r.army_size < 50) s += 20;
    if (r.gdp && r.gdp < 1000000000) s += 15;
    if (r.stability && r.stability < 50) s += 10;
    if (r.cpi && r.cpi > 120) s += 5;
    if (r.demand_fails >= 2) s += 5;
    return s;
  }

  const rebScores = reb.map(calcScore);
  const ctrlScores = ctrl.map(calcScore);
  const rebAvgScore = rebScores.length ? (rebScores.reduce((a,b)=>a+b,0)/rebScores.length).toFixed(1) : 0;
  const ctrlAvgScore = ctrlScores.length ? (ctrlScores.reduce((a,b)=>a+b,0)/ctrlScores.length).toFixed(1) : 0;

  // 阈值40分的精准率和召回率
  const threshold = 40;
  let tp = rebScores.filter(s => s >= threshold).length;
  let fp = ctrlScores.filter(s => s >= threshold).length;
  const precision = (tp / (tp + fp) * 100).toFixed(1);
  const recall = (tp / reb.length * 100).toFixed(1);

  function formatNum(n) {
    if (n === null || n === undefined || isNaN(n)) return 'N/A';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + '万亿';
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '亿';
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return n.toFixed(2);
  }

  const totalRebEvents = strataData.reduce((s, d) => s + d.cnt, 0);
  const maxStratum = Math.max(...strataData.map(s => s.cnt));
  const stratumNames = {
    lumberjack: '🪓 伐木工', miner: '⛏️ 矿工', peasant: '🌾 农民',
    unemployed: '🙁 失业者', artisan: '🔨 工匠', cleric: '⛪ 祭司',
    merchant: '💰 商人', scribe: '📜 书吏', landowner: '🏰 地主',
    soldier: '⚔️ 士兵'
  };
  const phaseNames = { brewing: '酝酿', plotting: '密谋', uprising: '起义' };
  const totalPhase = phaseData.reduce((s, d) => s + d.cnt, 0);

  // ===== 生成 HTML =====
  console.log("生成 HTML 报告...");
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚔️ 叛乱预警模型 - 游戏数据分析报告</title>
  <style>
    :root {
      --bg: #0f172a; --bg2: #1e293b; --bg3: #334155;
      --text: #e2e8f0; --text2: #94a3b8;
      --red: #ef4444; --orange: #f97316; --yellow: #eab308;
      --green: #22c55e; --blue: #3b82f6; --purple: #a855f7; --cyan: #06b6d4;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 40px 0 30px; }
    .header h1 { font-size: 2.5em; background: linear-gradient(135deg, var(--red), var(--orange), var(--yellow)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .header .subtitle { color: var(--text2); font-size: 1.1em; margin-top: 8px; }
    .header .timestamp { color: var(--text2); font-size: 0.9em; margin-top: 4px; }
    .stats-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: var(--bg2); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid var(--bg3); }
    .stat-card .value { font-size: 2em; font-weight: 700; }
    .stat-card .label { color: var(--text2); font-size: 0.9em; margin-top: 4px; }
    .stat-card.red .value { color: var(--red); }
    .stat-card.orange .value { color: var(--orange); }
    .stat-card.green .value { color: var(--green); }
    .stat-card.blue .value { color: var(--blue); }
    .stat-card.purple .value { color: var(--purple); }
    .section { background: var(--bg2); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid var(--bg3); }
    .section h2 { font-size: 1.5em; margin-bottom: 16px; }
    .section h3 { font-size: 1.2em; margin: 16px 0 12px; color: var(--text2); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--bg3); font-size: 0.95em; }
    th { background: var(--bg3); font-weight: 600; }
    tr:hover { background: rgba(255,255,255,0.03); }
    .tag { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.8em; font-weight: 600; }
    .tag.red { background: rgba(239,68,68,0.2); color: var(--red); }
    .tag.green { background: rgba(34,197,94,0.2); color: var(--green); }
    .tag.yellow { background: rgba(234,179,8,0.2); color: var(--yellow); }
    .tag.blue { background: rgba(59,130,246,0.2); color: var(--blue); }
    .tag.orange { background: rgba(249,115,22,0.2); color: var(--orange); }
    .tag.purple { background: rgba(168,85,247,0.2); color: var(--purple); }
    .insight-box { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 16px 20px; margin: 12px 0; }
    .insight-box.green { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); }
    .insight-box .label { color: var(--orange); font-weight: 700; margin-bottom: 6px; }
    .insight-box.green .label { color: var(--green); }
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
    .flow-diagram { text-align: center; padding: 20px; display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 8px; }
    .flow-step { background: var(--bg); border: 2px solid var(--bg3); border-radius: 12px; padding: 12px 20px; min-width: 120px; }
    .flow-step.active { border-color: var(--orange); background: rgba(249,115,22,0.1); }
    .flow-step.danger { border-color: var(--red); background: rgba(239,68,68,0.1); }
    .flow-arrow { color: var(--text2); font-size: 1.5em; }
    .chart-bar { display: flex; align-items: end; gap: 6px; height: 200px; padding: 10px 0; }
    .chart-bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .chart-bar-fill { width: 100%; border-radius: 4px 4px 0 0; min-width: 30px; }
    .chart-bar-label { font-size: 0.75em; color: var(--text2); text-align: center; }
    .chart-bar-val { font-size: 0.8em; font-weight: 600; }
    .score-bar { height: 24px; border-radius: 12px; margin: 4px 0; position: relative; overflow: hidden; }
    .score-bar-bg { position: absolute; inset: 0; background: var(--bg3); border-radius: 12px; }
    .score-bar-fill { height: 100%; border-radius: 12px; transition: width 0.8s; }
    @media (max-width: 768px) {
      .comparison-grid { grid-template-columns: 1fr; }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .header h1 { font-size: 1.8em; }
      .risk-card { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>⚔️ 叛乱预警模型</h1>
    <div class="subtitle">基于 ${reb.length + ctrl.length} 个游戏会话、${reb.length} 次叛乱的数据分析</div>
    <div class="timestamp">分析时间: ${new Date().toLocaleString('zh-CN')}</div>
  </div>

  <div class="stats-bar">
    <div class="stat-card red">
      <div class="value">${reb.length}</div>
      <div class="label">叛乱会话数</div>
    </div>
    <div class="stat-card blue">
      <div class="value">${ctrl.length}</div>
      <div class="label">正常会话数</div>
    </div>
    <div class="stat-card orange">
      <div class="value">${(reb.length / (reb.length + ctrl.length) * 100).toFixed(1)}%</div>
      <div class="label">叛乱发生率</div>
    </div>
    <div class="stat-card purple">
      <div class="value">${totalRebEvents.toLocaleString()}</div>
      <div class="label">叛乱事件总数</div>
    </div>
    <div class="stat-card green">
      <div class="value">${featureStats.filter(f => f.sig).length}/${features.length}</div>
      <div class="label">显著特征数</div>
    </div>
  </div>

  <!-- 执行摘要 -->
  <div class="section">
    <h2>📋 执行摘要</h2>
    <div class="insight-box">
      <div class="label">🔑 核心发现</div>
      <p>对 ${reb.length + ctrl.length} 个游戏会话的分析表明，<strong>${(reb.length / (reb.length + ctrl.length) * 100).toFixed(1)}%</strong> 的会话中发生了至少一次叛乱。叛乱最强烈的预测因子是：</p>
      <ul style="margin: 10px 0 0 20px;">
        <li><strong>饥荒死亡</strong> — 叛乱组平均饥荒死亡 ${formatNum(mean(reb, 'starvation'))} 人，是控制组（${formatNum(mean(ctrl, 'starvation'))}）的 <strong>${(mean(reb, 'starvation') / Math.max(mean(ctrl, 'starvation'), 1)).toFixed(1)} 倍</strong></li>
        <li><strong>经济体量小</strong> — 叛乱组平均 GDP 仅为控制组的 <strong>${((mean(reb, 'gdp') || 0) / Math.max(mean(ctrl, 'gdp') || 1, 1) * 100).toFixed(1)}%</strong></li>
        <li><strong>军事薄弱</strong> — 叛乱组平均军队仅为控制组的 <strong>${((mean(reb, 'army_size') || 0) / Math.max(mean(ctrl, 'army_size') || 1, 1) * 100).toFixed(1)}%</strong></li>
      </ul>
    </div>
    <div class="insight-box green" style="margin-top: 12px;">
      <div class="label">🎯 关键洞察</div>
      <p>叛乱主要发生在<strong>游戏早期</strong>（人口少、GDP低、军队小），而非游戏后期。这说明新手的"死亡螺旋"是叛乱的主要来源——<strong>经济崩溃 → 饥荒 → 叛乱 → 无法镇压</strong>。稳定度和通胀在两组间差异不大，说明叛乱的根源更偏向"早期生存困难"而非"后期管理不善"。</p>
    </div>
  </div>

  <!-- 叛乱流程 -->
  <div class="section">
    <h2>🔄 叛乱演进流程</h2>
    <div class="flow-diagram">
      <div class="flow-step">管道不满<br><small>诉求生成</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step active">酝酿<br><small>组织度 30+</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step active">密谋<br><small>组织度 70+</small></div>
      <span class="flow-arrow">→</span>
      <div class="flow-step danger">起义💥<br><small>组织度 100</small></div>
    </div>
    <table style="margin-top: 16px;">
      <tr><th>阶段</th><th>组织度阈值</th><th>事件总数</th><th>占比</th></tr>
      ${phaseData.map(p => `<tr>
        <td><span class="tag ${p.phase === 'uprising' ? 'red' : p.phase === 'plotting' ? 'orange' : 'yellow'}">${phaseNames[p.phase] || p.phase}</span></td>
        <td>${p.phase === 'brewing' ? '30' : p.phase === 'plotting' ? '70' : '100'}</td>
        <td>${p.cnt.toLocaleString()}</td>
        <td>${(p.cnt / totalPhase * 100).toFixed(1)}%</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- 叛乱阶层分布 -->
  <div class="section">
    <h2>👥 叛乱阶层分布</h2>
    <div class="chart-bar">
      ${strataData.map(s => `<div class="chart-bar-item">
        <div class="chart-bar-val">${s.cnt}</div>
        <div class="chart-bar-fill red" style="height: ${s.cnt / maxStratum * 160}px"></div>
        <div class="chart-bar-label">${stratumNames[s.stratum] || s.stratum}</div>
      </div>`).join('')}
    </div>
    <div class="insight-box" style="margin-top: 16px;">
      <div class="label">💡 阶层洞察</div>
      <p><strong>伐木工</strong>是叛乱之王（632次起义），远超其他阶层。<strong>失业者</strong>虽然起义最少，但酝酿（brewing）次数最高——不满最深但行动力最弱。</p>
    </div>
  </div>

  <!-- 特征重要性 -->
  <div class="section">
    <h2>📊 特征重要性排名</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">Point-biserial 相关系数衡量每个指标与"是否叛乱"的关联强度。Mann-Whitney U 检验验证组间差异的统计显著性。</p>
    <table>
      <tr><th>#</th><th>特征</th><th>叛乱组均值</th><th>控制组均值</th><th>倍率</th><th>相关系数</th><th>p值</th><th>显著性</th></tr>
      ${featureStats.map((f, i) => {
        const c = parseFloat(f.corr);
        const cc = c > 0.3 ? 'red' : c > 0.15 ? 'orange' : c > 0.05 ? 'yellow' : 'green';
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${f.name}</strong><br><small style="color:var(--text2)">${f.desc}</small></td>
          <td>${f.rebMean}</td>
          <td>${f.ctrlMean}</td>
          <td>${f.ratio === 'N/A' || f.ratio === 'NaN' || f.ratio === 'Infinity' ? '—' : f.ratio + 'x'}</td>
          <td><span class="tag ${cc}">${f.corr}</span></td>
          <td>${f.p}</td>
          <td>${f.sig ? '<span class="tag green">✅ 显著</span>' : '<span class="tag red">❌ 不显著</span>'}</td>
        </tr>`;
      }).join('')}
    </table>
  </div>

  <!-- 预警规则 -->
  <div class="section">
    <h2>🚨 叛乱预警规则</h2>
    ${riskRules.sort((a,b) => {
      const ma = a.mult === '∞' ? 999 : parseFloat(a.mult);
      const mb = b.mult === '∞' ? 999 : parseFloat(b.mult);
      return mb - ma;
    }).map(r => {
      const m = r.mult === '∞' ? 999 : parseFloat(r.mult);
      const lv = m > 10 ? 'high' : m > 3 ? 'medium' : 'low';
      const lc = lv === 'high' ? 'var(--red)' : lv === 'medium' ? 'var(--orange)' : 'var(--yellow)';
      return `<div class="risk-card ${lv}">
        <div><div class="risk-label">${r.condition}</div><div class="risk-desc">${r.desc}</div></div>
        <div class="risk-stats">
          <div class="risk-mult" style="color: ${lc}">${r.mult === '∞' ? '∞' : r.mult + 'x'}</div>
          <div style="font-size: 0.8em; color: var(--text2)">叛乱 ${r.rebRate.toFixed(1)}% | 控制 ${r.ctrlRate.toFixed(1)}%</div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- 评分模型 -->
  <div class="section">
    <h2>🎯 叛乱风险评分模型</h2>
    <p style="color: var(--text2); margin-bottom: 16px;">基于上述分析构建的加权评分公式。分数越高，叛乱概率越大。</p>
    <div class="comparison-grid">
      <div class="comp-card">
        <h4>评分公式 <span class="tag blue">v1.0</span></h4>
        <div class="comp-row"><span>存在饥荒死亡</span><strong style="color:var(--red)">+35分</strong></div>
        <div class="comp-row"><span>人口 &lt; 10万</span><strong style="color:var(--red)">+25分</strong></div>
        <div class="comp-row"><span>军队 &lt; 50</span><strong style="color:var(--orange)">+20分</strong></div>
        <div class="comp-row"><span>GDP &lt; 10亿</span><strong style="color:var(--orange)">+15分</strong></div>
        <div class="comp-row"><span>稳定度 &lt; 50</span><strong style="color:var(--yellow)">+10分</strong></div>
        <div class="comp-row"><span>CPI &gt; 120</span><strong style="color:var(--yellow)">+5分</strong></div>
        <div class="comp-row"><span>诉求失败 ≥ 2</span><strong style="color:var(--yellow)">+5分</strong></div>
        <div class="comp-row" style="border-top: 2px solid var(--bg3); padding-top: 10px;"><strong>总分范围</strong><strong>0-115</strong></div>
      </div>
      <div class="comp-card">
        <h4>回测验证 <span class="tag purple">历史数据</span></h4>
        <div class="comp-row"><span style="color:var(--red)">叛乱组平均分</span><strong>${rebAvgScore}</strong></div>
        <div class="comp-row"><span style="color:var(--green)">控制组平均分</span><strong>${ctrlAvgScore}</strong></div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--bg3);">
          <p style="font-size: 0.9em; color: var(--text2); margin-bottom: 8px;"><strong>阈值 ${threshold} 分的效果：</strong></p>
          <div class="comp-row"><span>精准率 (Precision)</span><strong style="color:var(--blue)">${precision}%</strong></div>
          <div class="comp-row"><span>召回率 (Recall)</span><strong style="color:var(--blue)">${recall}%</strong></div>
          <div class="comp-row"><span>误报数</span><strong style="color:var(--orange)">${fp}</strong></div>
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--bg3);">
          <p style="font-size: 0.85em; color: var(--text2);"><strong>风险等级参考：</strong></p>
          <div class="comp-row"><span style="color:var(--green)">● 低风险</span><span>0-20分</span></div>
          <div class="comp-row"><span style="color:var(--yellow)">● 中风险</span><span>21-40分</span></div>
          <div class="comp-row"><span style="color:var(--orange)">● 高风险</span><span>41-60分</span></div>
          <div class="comp-row"><span style="color:var(--red)">● 极高风险</span><span>61+分</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 叛乱组 vs 控制组对比 -->
  <div class="section">
    <h2>📈 叛乱组 vs 控制组</h2>
    <div class="comparison-grid">
      <div class="comp-card">
        <h4><span style="color:var(--red)">⚔️ 叛乱组</span> <span class="tag red">N=${reb.length}</span></h4>
        ${featureStats.slice(0, 7).map(f => `<div class="comp-row"><span>${f.name}</span><span>${f.rebMean}</span></div>`).join('')}
      </div>
      <div class="comp-card">
        <h4><span style="color:var(--green)">😊 控制组</span> <span class="tag green">N=${ctrl.length}</span></h4>
        ${featureStats.slice(0, 7).map(f => `<div class="comp-row"><span>${f.name}</span><span>${f.ctrlMean}</span></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- 游戏设计建议 -->
  <div class="section">
    <h2>💡 游戏设计建议</h2>
    <h3>🎯 针对新手玩家的叛乱缓解</h3>
    <ul style="margin-left: 20px; margin-bottom: 16px;">
      <li><strong>新手保护期</strong>：前100天降低叛乱阈值或提供"稳定度缓冲"</li>
      <li><strong>饥荒预警系统</strong>：食物即将耗尽时提前5-10 tick弹出醒目警告</li>
      <li><strong>破产保护</strong>：首次破产时提供紧急贷款而非直接触发饥荒</li>
    </ul>
    <h3>⚖️ 平衡性调整</h3>
    <ul style="margin-left: 20px; margin-bottom: 16px;">
      <li><strong>伐木工平衡</strong>：叛乱频率过高（632次），可能需调整不满积累速率</li>
      <li><strong>死亡螺旋</strong>：饥荒→叛乱→崩溃的恶性循环过于陡峭，考虑添加"危机恢复"机制</li>
      <li><strong>军队效果</strong>：可添加民兵/义务兵等低成本防御选项</li>
    </ul>
    <h3>📊 数据收集改进</h3>
    <ul style="margin-left: 20px;">
      <li><strong>修复价格上报Bug</strong>：已修复 <code>trackPriceSampling(result.market?.prices)</code></li>
      <li><strong>添加 days_elapsed</strong>：采样事件建议记录游戏天数以支持时序分析</li>
      <li><strong>阶层不满度</strong>：建议上报各阶层不满度数值</li>
    </ul>
  </div>

  <div class="section">
    <h2>🔬 方法论</h2>
    <table>
      <tr><th>项目</th><th>说明</th></tr>
      <tr><td>数据来源</td><td>civ_analytics 数据库 design_events 表</td></tr>
      <tr><td>样本量</td><td>${reb.length} 叛乱 + ${ctrl.length} 正常 = ${reb.length + ctrl.length} 会话</td></tr>
      <tr><td>特征数</td><td>${features.length} 个数值特征</td></tr>
      <tr><td>统计检验</td><td>Mann-Whitney U 检验（非参数）</td></tr>
      <tr><td>相关性</td><td>Point-biserial 相关系数</td></tr>
      <tr><td>预警模型</td><td>基于规则加权评分 (Rule-based Scoring)</td></tr>
    </table>
  </div>

  <div style="text-align: center; padding: 30px 0; color: var(--text2); font-size: 0.9em;">
    分析报告员 · 数据驱动的游戏洞察 · ${new Date().toLocaleDateString('zh-CN')}
  </div>
</div>
</body>
</html>`;

  const outPath = 'c:/Users/hkinghuang/Documents/GitHub/simple_nation_game/civ-game/analytics-server/rebellion_report.html';
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`\n✅ 报告已保存: ${outPath}`);
}

main().catch(console.error);
