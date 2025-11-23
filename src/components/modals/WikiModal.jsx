// 内置百科模态框组件
// 提供分类导航、搜索和详情展示
// v2.1: 补充税收、人口增长、转职等核心机制说明

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import {
  BUILDINGS,
  TECHS,
  DECREES,
  RESOURCES,
  UNIT_TYPES,
  STRATA,
  EPOCHS,
} from '../../config';

// --- 核心机制攻略文案数据 ---
const MECHANICS_GUIDES = [
  {
    id: 'mech_economy',
    name: '市场与税收',
    icon: 'Coins',
    summary: '价格波动、进出口贸易与税收财政',
    content: [
      { type: 'h4', text: '1. 市场价格机制' },
      { type: 'p', text: '资源价格由供需关系实时决定。' },
      { type: 'list', items: [
        '供给 (Supply)：国内生产 + 进口',
        '需求 (Demand)：国内消耗 + 出口 + 人口维护',
        '当需求 > 供给时，价格上涨；反之价格下跌。',
        '银币是唯一的通用货币，不参与价格波动。'
      ]},
      { type: 'h4', text: '2. 财政税收体系' },
      { type: 'p', text: '国家收入主要来源于两种税收（可在政令-税收面板调整）：' },
      { type: 'list', items: [
        '人头税 (Head Tax)：按人口每日征收。针对不同阶层有不同的基准税率。这是最稳定的收入来源，但过高会降低阶层好感度。',
        '资源税 (Resource Tax)：对市场交易征收。每当资源在市场上买卖（无论是自动生产消耗还是进出口）时触发。工业发达时这笔收入很可观。',
        '负税率 (补贴)：你可以将人头税设为负数，变成向该阶层发放补贴，能快速提升好感度和财富。'
      ]},
      { type: 'h4', text: '3. 国际贸易' },
      { type: 'p', text: '利用“外交”标签页中的贸易功能进行套利：' },
      { type: 'list', items: [
        '出口：将盈余资源卖给高价收购的国家。',
        '进口：从低价出售的国家买入资源，用于国内生产或赚取差价。'
      ]}
    ]
  },
  {
    id: 'mech_strata',
    name: '人口与阶层流动',
    icon: 'Users',
    summary: '人口增长、职业转换与满意度影响',
    content: [
      { type: 'h4', text: '1. 人口增长机制' },
      { type: 'p', text: '人口不会凭空暴涨，需要满足以下条件才会自然增长：' },
      { type: 'list', items: [
        '住房充足：当前人口 < 人口上限 (MaxPop)。建造房屋可提升上限。',
        '粮食盈余：当前粮食库存 > 人口数 × 1.5。',
        '社会稳定：稳定度越高，人口增长概率越大。',
        '反之，如果粮食耗尽 (0)，人口会发生饥荒并减少。'
      ]},
      { type: 'h4', text: '2. 职业流动 (转职) 机制' },
      { type: 'p', text: '你的人民是“趋利”的，他们会自动寻找更有前途的工作：' },
      { type: 'list', items: [
        '自动填补：当有空缺岗位时，失业人口会自动填补。',
        '跳槽逻辑：如果某个职业的“潜在收入”（工资+资源出售收益）远高于当前职业，且目标职业有空缺，人口会辞职并转职。',
        '财富携带：转职时，他们会带走自己积累的财富。'
      ]},
      { type: 'h4', text: '3. 阶层满意度' },
      { type: 'p', text: '阶层好感度决定了Buff/Debuff：' },
      { type: 'list', items: [
        '物资需求：这是最关键的因素。满足日常需求（如商人的香料、工人的工具）能大幅提升好感。',
        '税率影响：低税率提升好感，高税率降低好感。',
        '如果好感度过低且该阶层影响力大，可能导致人口外流（带着财富离开）甚至叛乱。'
      ]}
    ]
  },
  {
    id: 'mech_admin',
    name: '行政与管理',
    icon: 'Scale',
    summary: '行政容量、压力与效率的关系',
    content: [
      { type: 'h4', text: '1. 行政容量 (Capacity)' },
      { type: 'p', text: '代表政府治理国家的能力上限。主要来源：市政厅建筑、科技、特定阶层（如官员）的加成。' },
      { type: 'h4', text: '2. 行政压力 (Strain)' },
      { type: 'p', text: '代表国家当前的运转负担。来源包括：' },
      { type: 'list', items: [
        '人口规模：人口越多，管理越难。',
        '军队规模：维持常备军需要大量行政力。',
        '政令数量：激活的政令越多，行政负担越重。'
      ]},
      { type: 'h4', text: '3. 超限惩罚' },
      { type: 'p', text: '当行政压力 > 行政容量时，国家进入“行政过载”状态。后果包括：' },
      { type: 'list', items: [
        '税收效率大幅下降（收不上税）。',
        '政令效果减弱。',
        '社会稳定度逐渐降低。'
      ]}
    ]
  },
  {
    id: 'mech_military',
    name: '军事与战争',
    icon: 'Swords',
    summary: '兵种克制、战斗计算与战利品',
    content: [
      { type: 'h4', text: '1. 兵种克制循环' },
      { type: 'p', text: '战场遵循严格的克制关系，利用好这一点可以以少胜多：' },
      { type: 'list', items: [
        '骑兵 克制 弓箭手/远程 (+50%~80% 伤害)',
        '弓箭手 克制 步兵 (+50% 伤害)',
        '步兵/长矛兵 克制 骑兵 (+80% 伤害)',
        '坦克/火炮 对旧时代单位有毁灭性打击。'
      ]},
      { type: 'h4', text: '2. 战斗力计算' },
      { type: 'p', text: '总战力 = (单位攻击+防御) × 数量 × 时代加成 × 克制修正。' },
      { type: 'p', text: '此外，社会阶层（如军人、骑士）的满意度会提供全局军事Buff。' },
      { type: 'h4', text: '3. 战利品与损失' },
      { type: 'p', text: '战斗胜利可以掠夺敌国资源（粮食、银币等）。压倒性胜利（战力比 > 2:1）能大幅减少己方伤亡并增加战利品。' }
    ]
  },
  {
    id: 'mech_tech',
    name: '科技与时代',
    icon: 'Cpu',
    summary: '时代演进与科技解锁逻辑',
    content: [
      { type: 'h4', text: '1. 时代升级' },
      { type: 'p', text: '时代是文明发展的里程碑。升级时代需要满足三个条件：' },
      { type: 'list', items: [
        '科研点数达标',
        '人口规模达标',
        '文化点数达标（封建时代起）'
      ]},
      { type: 'h4', text: '2. 解锁新机制' },
      { type: 'p', text: '新时代不仅仅解锁建筑，还会解锁核心机制：' },
      { type: 'list', items: [
        '青铜时代：解锁贸易系统和基础外交。',
        '古典时代：解锁文化系统和高级政令。',
        '封建时代：解锁宗教和更复杂的阶层互动。',
        '工业时代：解锁产业链深度加工（如煤→钢）。'
      ]}
    ]
  }
];

const CATEGORY_CONFIG = [
  { id: 'mechanics', label: '核心机制', icon: 'BookOpen' },
  { id: 'economy', label: '社会阶层', icon: 'Users' },
  { id: 'buildings', label: '建筑设施', icon: 'Home' },
  { id: 'military', label: '军事单位', icon: 'Shield' },
  { id: 'technologies', label: '科技研究', icon: 'Cpu' },
  { id: 'decrees', label: '国家政令', icon: 'Gavel' },
  { id: 'resources', label: '物资资源', icon: 'Package' },
];

// 汉化映射表
const BUILDING_CATEGORY_LABELS = {
  gather: '采集与农业',
  industry: '工业生产',
  civic: '民生与行政',
  military: '军事设施',
};

const UNIT_CATEGORY_LABELS = {
  infantry: '步兵',
  archer: '远程',
  cavalry: '骑兵',
  siege: '攻城',
  support: '支援',
};

const TECH_NAME_MAP = (TECHS || []).reduce((acc, tech) => {
  acc[tech.id] = tech.name;
  return acc;
}, {});

const STRATA_NAME_MAP = Object.entries(STRATA || {}).reduce((acc, [key, value]) => {
  acc[key] = value?.name || key;
  return acc;
}, {});

const techNameById = (id) => TECH_NAME_MAP[id] || id;
const stratumNameById = (id) => STRATA_NAME_MAP[id] || id;

const WIKI_DATA = buildWikiData();

function buildWikiData() {
  return {
    mechanics: MECHANICS_GUIDES.map(guide => ({
      id: guide.id,
      name: guide.name,
      summary: guide.summary,
      icon: guide.icon,
      iconColor: 'text-blue-300',
      type: 'mechanics',
      data: guide.content
    })),
    economy: Object.entries(STRATA || {}).map(([id, data]) => ({
      id,
      name: data?.name || id,
      summary: data?.desc,
      icon: data?.icon || 'Users',
      iconColor: 'text-amber-200',
      type: 'economy',
      data,
    })),
    buildings: (BUILDINGS || []).map((building) => ({
      id: building.id,
      name: building.name,
      summary: building.desc,
      icon: building.visual?.icon || 'Home',
      iconColor: building.visual?.text || 'text-slate-200',
      type: 'building',
      data: building,
    })),
    military: Object.values(UNIT_TYPES || {}).map((unit) => ({
      id: unit.id,
      name: unit.name,
      summary: unit.desc,
      icon: unit.icon || 'Swords',
      iconColor: 'text-red-200',
      type: 'military',
      data: unit,
    })),
    technologies: (TECHS || []).map((tech) => ({
      id: tech.id,
      name: tech.name,
      summary: tech.desc,
      icon: 'Cpu',
      iconColor: 'text-purple-200',
      type: 'technology',
      data: tech,
    })),
    decrees: (DECREES || []).map((decree) => ({
      id: decree.id,
      name: decree.name,
      summary: decree.desc,
      icon: 'Gavel',
      iconColor: 'text-amber-200',
      type: 'decree',
      data: decree,
    })),
    resources: Object.entries(RESOURCES || {}).map(([id, data]) => ({
      id,
      name: data?.name || id,
      summary: data?.tags?.map(tag => {
        if(tag === 'raw_material') return '原料';
        if(tag === 'manufactured') return '加工品';
        if(tag === 'luxury') return '奢侈品';
        if(tag === 'essential') return '必需品';
        if(tag === 'special') return '特殊';
        if(tag === 'virtual') return '虚拟';
        if(tag === 'currency') return '货币';
        if(tag === 'industrial') return '工业品';
        return tag;
      }).join(' · '),
      icon: data?.icon || 'Package',
      iconColor: data?.color || 'text-slate-200',
      type: 'resource',
      data: { ...data, id },
    })),
  };
}

const formatNumber = (value) => {
  if (typeof value !== 'number') return value;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value - Math.round(value)) < 0.001) return Math.round(value).toString();
  return value.toFixed(2);
};

const formatEpoch = (epoch) => {
  if (epoch === undefined || epoch === null || Number.isNaN(epoch)) return undefined;
  const epochName = EPOCHS[epoch]?.name || `第 ${epoch + 1} 时代`;
  return epochName;
};

const getResourceMeta = (key) => RESOURCES?.[key] || { name: key };

const flattenEffects = (source, prefix = '') => {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'string') return [source];
  if (typeof source === 'number') return [`${prefix}${prefix ? ': ' : ''}${formatNumber(source)}`];

  if (typeof source === 'object') {
    return Object.entries(source).flatMap(([key, value]) => {
      // 汉化效果键名
      let cnKey = key;
      if(key === 'production') cnKey = '全局生产';
      else if(key === 'taxIncome') cnKey = '税收收入';
      else if(key === 'stability') cnKey = '稳定度';
      else if(key === 'scienceBonus') cnKey = '科研产出';
      else if(key === 'cultureBonus') cnKey = '文化产出';
      else if(key === 'industry') cnKey = '工业效率';
      else if(key === 'gather') cnKey = '采集效率';
      else if(key === 'admin') cnKey = '行政容量';
      else if(key === 'maxPop') cnKey = '人口上限';
      
      const nextPrefix = prefix ? `${prefix} › ${cnKey}` : cnKey;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return flattenEffects(value, nextPrefix);
      }
      if (Array.isArray(value)) {
        return value.map((item) => `${nextPrefix}: ${item}`);
      }
      return [`${nextPrefix}: ${formatNumber(value)}`];
    });
  }

  return [];
};

const renderResourceSection = (label, resources) => {
  if (!resources || typeof resources !== 'object') return null;
  const entries = Object.entries(resources);
  if (!entries.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => {
          const meta = getResourceMeta(key);
          return (
            <span
              key={`${label}-${key}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/70 text-gray-200 text-xs border border-gray-700"
            >
              {meta.icon && <Icon name={meta.icon} size={14} className={meta.color || 'text-gray-200'} />}
              <span>{meta.name || key}</span>
              {value !== undefined && <span className="font-mono text-[11px]">{formatNumber(value)}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const renderJobSection = (jobs) => {
  if (!jobs || typeof jobs !== 'object') return null;
  const entries = Object.entries(jobs);
  if (!entries.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">提供岗位</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => {
          const stratum = STRATA?.[key];
          return (
            <span
              key={`job-${key}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/70 text-gray-200 text-xs border border-gray-700"
            >
              {stratum?.icon && <Icon name={stratum.icon} size={14} className="text-slate-200" />}
              <span>{stratum?.name || key}</span>
              <span className="font-mono text-[11px]">x{formatNumber(value)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

const renderListSection = (label, items) => {
  if (!items || !items.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400">{label}</p>
      <ul className="list-disc list-inside text-gray-200 text-sm space-y-1">
        {items.map((item, idx) => (
          <li key={`${label}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const InfoGrid = ({ rows }) => {
  if (!rows || !rows.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((row) => (
        <div key={row.label} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-400">{row.label}</p>
          <p className="text-sm text-white font-semibold mt-1">{row.value}</p>
        </div>
      ))}
    </div>
  );
};

const StrataBuffs = ({ buffs }) => {
  if (!buffs) return null;
  const entries = Object.entries(buffs);
  if (!entries.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {entries.map(([state, info]) => {
        const { desc, ...rest } = info || {};
        return (
          <div key={state} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">{state === 'satisfied' ? '满意效果' : '不满后果'}</p>
            <p className="text-sm text-gray-200 mt-1 font-semibold">{desc}</p>
            {renderListSection('数值影响', flattenEffects(rest))}
          </div>
        );
      })}
    </div>
  );
};

const ResourceTags = ({ tags }) => {
  if (!tags || !tags.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 text-[11px] uppercase tracking-wide bg-gray-800/70 border border-gray-700 rounded-full text-gray-300"
        >
          {tag}
        </span>
      ))}
    </div>
  );
};

export const WikiModal = ({ show, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_CONFIG[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  useEffect(() => {
    if (!show) return;
    setSelectedEntryId((prev) => prev || (WIKI_DATA[selectedCategory]?.[0]?.id ?? null));
  }, [show, selectedCategory]);
  const entries = useMemo(() => WIKI_DATA[selectedCategory] || [], [selectedCategory]);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredEntries = useMemo(() => {
    if (!normalizedSearch) return entries;
    return entries.filter((entry) => {
      const haystack = `${entry.name} ${entry.summary || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [entries, normalizedSearch]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedEntryId(null);
      return;
    }
    if (!filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId]);

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedEntryId) ||
    entries.find((entry) => entry.id === selectedEntryId) ||
    filteredEntries[0];

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900/95 backdrop-blur-lg rounded-2xl border border-indigo-500/40 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-400 mb-1">CIVILIZATION KNOWLEDGE BASE</p>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Icon name="BookOpen" size={24} className="text-indigo-300"/>
              文明百科全书
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            aria-label="关闭百科"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 border-r border-gray-800 bg-gray-900/60 flex flex-col">
            {/* 侧边栏分类按钮 */}
            <div className="grid grid-cols-2 gap-2 p-4">
              {CATEGORY_CONFIG.map((category) => {
                const isActive = category.id === selectedCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-indigo-400 bg-indigo-900/40 text-indigo-100'
                        : 'border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500'
                    }`}
                  >
                    <Icon name={category.icon} size={14} />
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 搜索框 */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Icon
                  name="Search"
                  size={14}
                  className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`搜索${CATEGORY_CONFIG.find(c=>c.id===selectedCategory)?.label}...`}
                  className="w-full bg-gray-800/70 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 条目列表 */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
              {filteredEntries.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-4 text-center border border-dashed border-gray-800 rounded-lg">
                  暂无符合条件的条目
                </p>
              ) : (
                filteredEntries.map((entry) => {
                  const isActive = entry.id === selectedEntryId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-indigo-900/30 border-indigo-500/40 shadow-sm'
                          : 'bg-transparent border-transparent hover:bg-gray-800/50 hover:border-gray-700'
                      }`}
                    >
                      <p className={`text-sm font-semibold flex items-center gap-2 ${isActive ? 'text-indigo-200' : 'text-gray-300'}`}>
                        <Icon name={entry.icon || 'Bookmark'} size={14} className={isActive ? 'text-indigo-300' : entry.iconColor} />
                        {entry.name}
                      </p>
                      {entry.summary && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate ml-6">{entry.summary}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex-1 flex flex-col bg-gray-900/30">
            {selectedEntry ? (
              <>
                <div className="p-6 border-b border-gray-800 bg-gray-800/20">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gray-800 shadow-lg border border-gray-700">
                      <Icon name={selectedEntry.icon || 'Book'} size={32} className={selectedEntry.iconColor} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-1">
                        {CATEGORY_CONFIG.find((c) => c.id === selectedCategory)?.label}
                      </p>
                      <h3 className="text-3xl font-bold text-white">{selectedEntry.name}</h3>
                      {selectedEntry.summary && (
                        <p className="text-sm text-gray-400 mt-1">{selectedEntry.summary}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-gray-600">
                  {renderEntryDetails(selectedEntry)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                <Icon name="BookOpen" size={64} className="mb-4" />
                <p>请从左侧选择一个条目查看详情</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const renderEntryDetails = (entry) => {
  const { data, type } = entry;
  if (!data) {
    return <p className="text-gray-400">暂无详情。</p>;
  }

  switch (type) {
    case 'mechanics':
      return renderMechanicsDetails(data);
    case 'economy':
      return renderEconomyDetails(data);
    case 'building':
      return renderBuildingDetails(data);
    case 'military':
      return renderMilitaryDetails(data);
    case 'technology':
      return renderTechDetails(data);
    case 'decree':
      return renderDecreeDetails(data);
    case 'resource':
      return renderResourceDetails(data);
    default:
      return (
        <div className="space-y-4">
          <p className="text-gray-300">{entry.summary || '暂无描述。'}</p>
        </div>
      );
  }
};

const renderMechanicsDetails = (content) => {
  if (!Array.isArray(content)) return null;
  
  return (
    <div className="space-y-6 max-w-3xl">
      {content.map((block, idx) => {
        if (block.type === 'h4') {
          return <h4 key={idx} className="text-lg font-bold text-indigo-300 mt-6 mb-2 pb-2 border-b border-gray-700">{block.text}</h4>;
        }
        if (block.type === 'p') {
          return <p key={idx} className="text-gray-300 leading-7 text-sm">{block.text}</p>;
        }
        if (block.type === 'list') {
          return (
            <ul key={idx} className="list-disc list-inside space-y-2 bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
              {block.items.map((item, i) => (
                <li key={i} className="text-gray-300 text-sm">{item}</li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
};

const renderEconomyDetails = (data) => {
  const rows = [
    data.weight !== undefined && { label: '分配权重', value: formatNumber(data.weight) },
    data.tax !== undefined && { label: '税收贡献 (每人)', value: formatNumber(data.tax) },
    data.headTaxBase !== undefined && { label: '人头税基准', value: `${formatNumber(data.headTaxBase)} 银币/日` },
    data.admin !== undefined && { label: '行政压力', value: formatNumber(data.admin) },
    data.wealthWeight !== undefined && { label: '财富系数', value: formatNumber(data.wealthWeight) },
    data.influenceBase !== undefined && { label: '基础影响力', value: formatNumber(data.influenceBase) },
    data.startingWealth !== undefined && { label: '初始财富', value: `${formatNumber(data.startingWealth)} 银币` },
    data.defaultResource && { label: '生产资源', value: getResourceMeta(data.defaultResource).name },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
      </div>
      <InfoGrid rows={rows} />
      {renderResourceSection('日常物资需求', data.needs)}
      <StrataBuffs buffs={data.buffs} />
    </div>
  );
};

const renderBuildingDetails = (data) => {
  const rows = [
    data.cat && { label: '建筑类别', value: BUILDING_CATEGORY_LABELS[data.cat] || data.cat },
    data.owner && { label: '运营阶层', value: stratumNameById(data.owner) },
    (data.epoch !== undefined || data.unlockEpoch !== undefined) && {
      label: '解锁时代',
      value: formatEpoch(data.epoch ?? data.unlockEpoch),
    },
    data.requiresTech && { label: '前置科技', value: techNameById(data.requiresTech) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
      </div>
      <InfoGrid rows={rows} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderResourceSection('建造成本', data.baseCost)}
        {renderResourceSection('产出资源', data.output)}
        {renderResourceSection('消耗原料', data.input)}
        {renderJobSection(data.jobs)}
      </div>
    </div>
  );
};

const renderMilitaryDetails = (data) => {
  const rows = [
    data.category && { label: '兵种类别', value: UNIT_CATEGORY_LABELS[data.category] || data.category },
    data.epoch !== undefined && { label: '解锁时代', value: formatEpoch(data.epoch) },
    data.adminCost !== undefined && { label: '行政消耗', value: formatNumber(data.adminCost) },
    data.populationCost !== undefined && { label: '人口占用', value: formatNumber(data.populationCost) },
    data.trainingTime !== undefined && { label: '训练时间 (秒)', value: formatNumber(data.trainingTime) },
    data.attack !== undefined && { label: '攻击力', value: formatNumber(data.attack) },
    data.defense !== undefined && { label: '防御力', value: formatNumber(data.defense) },
    data.speed !== undefined && { label: '机动速度', value: formatNumber(data.speed) },
    data.range !== undefined && { label: '射程', value: formatNumber(data.range) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
      </div>
      <InfoGrid rows={rows} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderResourceSection('征召成本', data.recruitCost)}
        {renderResourceSection('每日维护', data.maintenanceCost)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderListSection('特殊能力', data.abilities)}
        {renderListSection('克制对象', flattenEffects(data.counters).map(s => s.replace('infantry', '步兵').replace('cavalry', '骑兵').replace('archer', '远程').replace('siege', '攻城')))}
      </div>
    </div>
  );
};

const renderTechDetails = (data) => {
  const rows = [
    data.epoch !== undefined && { label: '所属时代', value: formatEpoch(data.epoch) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
      </div>
      <InfoGrid rows={rows} />
      {renderResourceSection('科研成本', data.cost)}
      {renderListSection('科技效果', flattenEffects(data.effects))}
    </div>
  );
};

const renderDecreeDetails = (data) => {
  const rows = [
    data.category && { label: '政令类别', value: data.category === 'economy' ? '经济' : data.category === 'military' ? '军事' : data.category === 'culture' ? '文化' : '社会' },
    data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
    data.cost && { label: '行政消耗', value: flattenEffects(data.cost).join('，') },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
      </div>
      <InfoGrid rows={rows} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
          {renderListSection('正面效果', data.effects)}
        </div>
        <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
          {renderListSection('负面代价', data.drawbacks)}
        </div>
      </div>
    </div>
  );
};

const renderResourceDetails = (data) => {
  const rows = [
    data.basePrice !== undefined && { label: '基础价格', value: `${formatNumber(data.basePrice)} 银币` },
    data.type && { label: '资源类型', value: data.type === 'currency' ? '货币' : data.type === 'virtual' ? '概念' : '实物' },
    data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
    data.unlockTech && { label: '解锁科技', value: techNameById(data.unlockTech) },
    data.defaultOwner && { label: '主要生产者', value: stratumNameById(data.defaultOwner) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
        <p className="text-gray-300 leading-relaxed text-sm">{data.desc || '基础资源信息'}</p>
      </div>
      <InfoGrid rows={rows} />
      <ResourceTags tags={data.tags} />
    </div>
  );
};