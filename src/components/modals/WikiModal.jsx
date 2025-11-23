// 内置百科模态框组件
// 提供分类导航、搜索和详情展示

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import {
  BUILDINGS,
  TECHS,
  DECREES,
  RESOURCES,
  UNIT_TYPES,
  STRATA,
} from '../../config';

const CATEGORY_CONFIG = [
  { id: 'economy', label: '经济机制', icon: 'Coins' },
  { id: 'buildings', label: '建筑', icon: 'Home' },
  { id: 'military', label: '军事', icon: 'Shield' },
  { id: 'technologies', label: '科技', icon: 'Cpu' },
  { id: 'decrees', label: '政令', icon: 'Gavel' },
  { id: 'resources', label: '资源', icon: 'Package' },
];

const BUILDING_CATEGORY_LABELS = {
  gather: '采集',
  industry: '工业',
  civic: '民生',
  military: '军事',
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
      summary: data?.tags?.join(' · '),
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
  return `第 ${epoch + 1} 时代`;
};

const getResourceMeta = (key) => RESOURCES?.[key] || { name: key };

const flattenEffects = (source, prefix = '') => {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'string') return [source];
  if (typeof source === 'number') return [`${prefix}${prefix ? ': ' : ''}${formatNumber(source)}`];

  if (typeof source === 'object') {
    return Object.entries(source).flatMap(([key, value]) => {
      const nextPrefix = prefix ? `${prefix} › ${key}` : key;
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
      <p className="text-sm text-gray-400">岗位</p>
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
            <p className="text-xs uppercase tracking-wide text-gray-400">{state === 'satisfied' ? '满意' : '不满'}</p>
            <p className="text-sm text-gray-200 mt-1">{desc}</p>
            {renderListSection('效果', flattenEffects(rest))}
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <p className="text-sm uppercase tracking-widest text-indigo-400">Civilopedia</p>
            <h2 className="text-2xl font-bold text-white">文明百科</h2>
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
            <div className="grid grid-cols-2 gap-2 p-4">
              {CATEGORY_CONFIG.map((category) => {
                const isActive = category.id === selectedCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      isActive
                        ? 'border-indigo-400 bg-indigo-900/40 text-indigo-100'
                        : 'border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500'
                    }`}
                  >
                    <Icon name={category.icon} size={16} />
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-4 pb-2">
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-1">
                搜索
              </label>
              <div className="relative">
                <Icon
                  name="Search"
                  size={16}
                  className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="输入名称"
                  className="w-full bg-gray-800/70 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
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
                      className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                        isActive
                          ? 'bg-indigo-900/40 border-indigo-500/50'
                          : 'bg-gray-800/40 border-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <Icon name={entry.icon || 'Bookmark'} size={16} className={entry.iconColor} />
                        {entry.name}
                      </p>
                      {entry.summary && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{entry.summary}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex-1 flex flex-col">
            {selectedEntry ? (
              <>
                <div className="p-6 border-b border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gray-800">
                      <Icon name={selectedEntry.icon || 'Book'} size={28} className={selectedEntry.iconColor} />
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-widest text-indigo-400">
                        {CATEGORY_CONFIG.find((c) => c.id === selectedCategory)?.label}
                      </p>
                      <h3 className="text-2xl font-bold text-white">{selectedEntry.name}</h3>
                      {selectedEntry.summary && (
                        <p className="text-sm text-gray-400 mt-1">{selectedEntry.summary}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {renderEntryDetails(selectedEntry)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">请选择左侧条目查看详情</p>
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

const renderEconomyDetails = (data) => {
  const rows = [
    data.weight !== undefined && { label: '人口权重', value: formatNumber(data.weight) },
    data.tax !== undefined && { label: '税收贡献 (每秒)', value: formatNumber(data.tax) },
    data.headTaxBase !== undefined && { label: '人头税基准', value: `${formatNumber(data.headTaxBase)} 银币/日` },
    data.admin !== undefined && { label: '行政影响', value: formatNumber(data.admin) },
    data.wealthWeight !== undefined && { label: '财富权重', value: formatNumber(data.wealthWeight) },
    data.influenceBase !== undefined && { label: '基础影响力', value: formatNumber(data.influenceBase) },
    data.startingWealth !== undefined && { label: '起始财富', value: `${formatNumber(data.startingWealth)} 银币` },
    data.defaultResource && { label: '代表资源', value: getResourceMeta(data.defaultResource).name },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc}</p>
      <InfoGrid rows={rows} />
      {renderResourceSection('日常需求', data.needs)}
      <StrataBuffs buffs={data.buffs} />
    </div>
  );
};

const renderBuildingDetails = (data) => {
  const rows = [
    data.cat && { label: '建筑类别', value: BUILDING_CATEGORY_LABELS[data.cat] || data.cat },
    data.owner && { label: '所属阶层', value: stratumNameById(data.owner) },
    (data.epoch !== undefined || data.unlockEpoch !== undefined) && {
      label: '解锁时代',
      value: formatEpoch(data.epoch ?? data.unlockEpoch),
    },
    data.requiresTech && { label: '前置科技', value: techNameById(data.requiresTech) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc}</p>
      <InfoGrid rows={rows} />
      {renderResourceSection('建造成本', data.baseCost)}
      {renderResourceSection('运行消耗', data.input)}
      {renderResourceSection('产出', data.output)}
      {renderJobSection(data.jobs)}
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
    data.attack !== undefined && { label: '攻击', value: formatNumber(data.attack) },
    data.defense !== undefined && { label: '防御', value: formatNumber(data.defense) },
    data.speed !== undefined && { label: '速度', value: formatNumber(data.speed) },
    data.range !== undefined && { label: '射程', value: formatNumber(data.range) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc}</p>
      <InfoGrid rows={rows} />
      {renderResourceSection('征召成本', data.recruitCost)}
      {renderResourceSection('维护成本 (每秒)', data.maintenanceCost)}
      {renderListSection('能力', data.abilities)}
      {renderListSection('克制', flattenEffects(data.counters))}
      {renderListSection('弱点', Array.isArray(data.weakAgainst) ? data.weakAgainst.map((w) => UNIT_CATEGORY_LABELS[w] || w) : [])}
    </div>
  );
};

const renderTechDetails = (data) => {
  const rows = [
    data.epoch !== undefined && { label: '所属时代', value: formatEpoch(data.epoch) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc}</p>
      <InfoGrid rows={rows} />
      {renderResourceSection('科研成本', data.cost)}
      {renderListSection('效果', flattenEffects(data.effects))}
    </div>
  );
};

const renderDecreeDetails = (data) => {
  const rows = [
    data.category && { label: '政令类别', value: data.category },
    data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
    data.cost && { label: '行政力消耗', value: flattenEffects(data.cost).join('，') },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc}</p>
      <InfoGrid rows={rows} />
      {renderListSection('正面效果', data.effects)}
      {renderListSection('负面影响', data.drawbacks)}
      {renderListSection('数值改动', flattenEffects(data.modifiers))}
    </div>
  );
};

const renderResourceDetails = (data) => {
  const rows = [
    data.basePrice !== undefined && { label: '基础价格', value: `${formatNumber(data.basePrice)} 银币` },
    data.type && { label: '资源类型', value: data.type === 'currency' ? '货币' : data.type === 'virtual' ? '虚拟' : '实物' },
    data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
    data.unlockTech && { label: '解锁科技', value: techNameById(data.unlockTech) },
    data.defaultOwner && { label: '默认所有者', value: stratumNameById(data.defaultOwner) },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="text-gray-300 leading-relaxed">{data.desc || '基础资源信息'}</p>
      <InfoGrid rows={rows} />
      <ResourceTags tags={data.tags} />
    </div>
  );
};
