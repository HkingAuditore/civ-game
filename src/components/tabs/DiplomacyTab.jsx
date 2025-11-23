// 外交标签页
// 展示国家状态、贸易套利与和平谈判

import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateForeignPrice } from '../../utils/foreignTrade';

const relationInfo = (relation = 0) => {
  if (relation >= 80) return { label: '盟友', color: 'text-green-300', bg: 'bg-green-900/20' };
  if (relation >= 60) return { label: '友好', color: 'text-blue-300', bg: 'bg-blue-900/20' };
  if (relation >= 40) return { label: '中立', color: 'text-gray-300', bg: 'bg-gray-800/40' };
  if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300', bg: 'bg-yellow-900/20' };
  return { label: '敌对', color: 'text-red-300', bg: 'bg-red-900/20' };
};

export const DiplomacyTab = ({
  nations = [],
  epoch = 0,
  market = {},
  resources = {},
  daysElapsed = 0,
  onDiplomaticAction,
}) => {
  const [selectedNationId, setSelectedNationId] = useState(null);
  const [tradeAmount, setTradeAmount] = useState(10);

  const tradableResources = useMemo(
    () =>
      Object.entries(RESOURCES).filter(
        ([key, def]) =>
          def.type !== 'virtual' &&
          key !== 'silver' &&
          (def.unlockEpoch ?? 0) <= epoch
      ),
    [epoch]
  );

  const visibleNations = useMemo(
    () =>
      nations.filter(
        (nation) =>
          epoch >= (nation.appearEpoch ?? 0) &&
          (nation.expireEpoch == null || epoch <= nation.expireEpoch)
      ),
    [nations, epoch]
  );

  useEffect(() => {
    if (!selectedNationId && visibleNations.length > 0) {
      setSelectedNationId(visibleNations[0].id);
    } else if (selectedNationId && !visibleNations.some((n) => n.id === selectedNationId)) {
      setSelectedNationId(visibleNations[0]?.id || null);
    }
  }, [selectedNationId, visibleNations]);

  const selectedNation =
    visibleNations.find((nation) => nation.id === selectedNationId) || visibleNations[0] || null;

  const totalAllies = visibleNations.filter((n) => (n.relation || 0) >= 80).length;
  const totalWars = visibleNations.filter((n) => n.isAtWar).length;

  const handleTrade = (resourceKey, isImport = false) => {
    if (!selectedNation || !onDiplomaticAction) return;
    const action = isImport ? 'import' : 'trade';
    onDiplomaticAction(selectedNation.id, action, { resource: resourceKey, amount: tradeAmount });
  };

  const handleSimpleAction = (nationId, action) => {
    if (onDiplomaticAction) {
      onDiplomaticAction(nationId, action);
    }
  };

  const getLocalPrice = (resourceKey) => {
    return market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
  };

  const renderPeaceHint = (nation) => {
    if (!nation?.isAtWar) return null;
    if ((nation.warScore || 0) > 0) {
      return '我方占优，可尝试索赔停战。';
    }
    if ((nation.warScore || 0) < 0) {
      return '局势不利，可能需要赔款求和。';
    }
    return '僵持阶段，继续作战或准备谈判。';
  };

  return (
    <div className="space-y-4">
      <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={18} className="text-indigo-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-200 space-y-1">
            <p>
              外交关系决定即时套利贸易与战争爆发。保持高关系可获取更低的进口成本，而敌对国家会主动宣战。
            </p>
            <p>
              开战后可通过军事胜利累积战争分数，逼迫敌国赔款和平；若劣势，则需要支付银币才能脱身。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800/60 p-3 rounded border border-gray-700">
          <p className="text-xs text-gray-400 mb-1">可见国家</p>
          <p className="text-lg font-bold text-white">{visibleNations.length}</p>
        </div>
        <div className="bg-green-900/20 p-3 rounded border border-green-600/20">
          <p className="text-xs text-gray-400 mb-1">盟友</p>
          <p className="text-lg font-bold text-green-300">{totalAllies}</p>
        </div>
        <div className="bg-red-900/20 p-3 rounded border border-red-600/30">
          <p className="text-xs text-gray-400 mb-1">战争中</p>
          <p className="text-lg font-bold text-red-300">{totalWars}</p>
        </div>
        <div className="bg-blue-900/20 p-3 rounded border border-blue-600/30">
          <p className="text-xs text-gray-400 mb-1">贸易套利金额</p>
          <p className="text-lg font-bold text-blue-300">{tradeAmount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-[calc(100vh-300px)]">
        <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
          {visibleNations.map((nation) => {
            const relation = relationInfo(nation.relation);
            return (
              <div
                key={nation.id}
                className={`p-4 rounded-lg border border-gray-700 bg-gray-800/50 ${
                  nation.id === selectedNation?.id ? 'ring-1 ring-blue-400' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {nation.name}
                      <span className={`px-2 py-0.5 text-[11px] rounded ${relation.bg} ${relation.color}`}>
                        {relation.label}
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      {nation.type} · 时代 {nation.appearEpoch ?? 0}-{nation.expireEpoch ?? '∞'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      nation.isAtWar ? 'bg-red-900/40 text-red-300' : 'bg-green-900/20 text-green-300'
                    }`}
                  >
                    {nation.isAtWar ? '战争' : '和平'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{nation.desc}</p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>关系 {nation.relation}</span>
                    <span>财富 {Math.floor(nation.wealth || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-green-400"
                      style={{ width: `${Math.min(100, nation.relation || 0)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-gray-400">市场波动</p>
                    <p className="text-white font-mono">
                      {(nation.marketVolatility || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 rounded p-2">
                    <p className="text-gray-400">侵略性</p>
                    <p className="text-white font-mono">{(nation.aggression || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <button
                    className="px-2 py-1.5 bg-green-600 hover:bg-green-500 rounded text-white flex items-center justify-center gap-1"
                    onClick={() => handleSimpleAction(nation.id, 'gift')}
                  >
                    <Icon name="Gift" size={12} /> 礼物
                  </button>
                  <button
                    className="px-2 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-white flex items-center justify-center gap-1"
                    onClick={() => handleSimpleAction(nation.id, 'demand')}
                  >
                    <Icon name="ShieldAlert" size={12} /> 索要
                  </button>
                  <button
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white flex items-center justify-center gap-1"
                    onClick={() => setSelectedNationId(nation.id)}
                  >
                    <Icon name="ShoppingCart" size={12} /> 贸易
                  </button>
                  <button
                    className={`px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 ${
                      nation.isAtWar
                        ? 'bg-purple-600 hover:bg-purple-500'
                        : 'bg-red-600 hover:bg-red-500'
                    }`}
                    onClick={() =>
                      handleSimpleAction(nation.id, nation.isAtWar ? 'peace' : 'declare_war')
                    }
                  >
                    <Icon name={nation.isAtWar ? 'Flag' : 'Swords'} size={12} />
                    {nation.isAtWar ? '求和' : '宣战'}
                  </button>
                </div>
              </div>
            );
          })}
          {visibleNations.length === 0 && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded text-sm text-gray-400">
              当前时代暂无可接触的国家。
            </div>
          )}
        </div>

        <div className="xl:col-span-2 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
          {selectedNation ? (
            <>
              <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Icon name="BarChart" size={14} className="text-blue-300" />
                    即时套利贸易 · {selectedNation.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>批量</span>
                    <input
                      type="number"
                      min="1"
                      className="w-16 bg-gray-900/70 border border-gray-700 rounded px-2 py-0.5 text-right text-white"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-gray-300">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left py-1">资源</th>
                        <th className="text-left py-1">对方库存</th>
                        <th className="text-left py-1">缺口/盈余</th>
                        <th className="text-left py-1">本地价格</th>
                        <th className="text-left py-1">外国价格</th>
                        <th className="text-left py-1">差价</th>
                        <th className="text-right py-1">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradableResources.map(([key, res]) => {
                        const local = getLocalPrice(key);
                        const foreign = calculateForeignPrice(key, selectedNation, daysElapsed);
                        const diff = foreign - local;
                        const profitable = diff > 0;
                        const nationInventory = (selectedNation.inventory || {})[key] || 0;
                        const targetInventory = 500;
                        const isShortage = nationInventory < targetInventory * 0.5;
                        const isSurplus = nationInventory > targetInventory * 1.5;
                        
                        // 计算缺口和盈余数量
                        const shortageAmount = isShortage ? Math.floor(targetInventory - nationInventory) : 0;
                        const surplusAmount = isSurplus ? Math.floor(nationInventory - targetInventory) : 0;
                        
                        return (
                          <tr key={key} className="border-t border-gray-700/50">
                            <td className="py-1">{res.name}</td>
                            <td className="py-1">
                              <span className={`font-mono ${
                                isShortage ? 'text-red-400' : 
                                isSurplus ? 'text-green-400' : 
                                'text-gray-400'
                              }`}>
                                {nationInventory.toFixed(0)}
                              </span>
                            </td>
                            <td className="py-1">
                              {isShortage && (
                                <span className="text-red-400 font-mono text-[11px]">
                                  缺口: {shortageAmount}
                                </span>
                              )}
                              {isSurplus && (
                                <span className="text-green-400 font-mono text-[11px]">
                                  盈余: {surplusAmount}
                                </span>
                              )}
                              {!isShortage && !isSurplus && (
                                <span className="text-gray-500 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-1 text-gray-400">{local.toFixed(2)}</td>
                            <td
                              className={`py-1 ${
                                profitable ? 'text-green-300' : 'text-red-300'
                              } font-mono`}
                            >
                              {foreign.toFixed(2)}
                            </td>
                            <td
                              className={`py-1 font-mono ${
                                profitable ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {diff >= 0 ? '+' : ''}
                              {diff.toFixed(2)}
                            </td>
                            <td className="py-1 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  className="px-2 py-1 bg-teal-600 hover:bg-teal-500 rounded text-white flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleTrade(key, false)}
                                  disabled={!isShortage}
                                  title={isShortage ? "对方有缺口，可以出口" : "对方无缺口，无法出口"}
                                >
                                  <Icon name="ArrowUpRight" size={12} /> 出口
                                </button>
                                <button
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleTrade(key, true)}
                                  disabled={!isSurplus}
                                  title={isSurplus ? "对方有盈余，可以进口" : "对方无盈余，无法进口"}
                                >
                                  <Icon name="ArrowDownLeft" size={12} /> 进口
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedNation.isAtWar && (
                <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                    <Icon name="AlertTriangle" size={14} className="text-red-300" />
                    和平谈判 · {selectedNation.name}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300">
                    <div className="bg-red-900/20 p-2 rounded border border-red-600/30">
                      <p className="text-gray-400">战争分数</p>
                      <p className="text-lg font-bold text-red-300">
                        {selectedNation.warScore?.toFixed(0) || 0}
                      </p>
                    </div>
                    <div className="bg-gray-900/40 p-2 rounded border border-gray-700">
                      <p className="text-gray-400">持续天数</p>
                      <p className="text-lg font-bold text-white">
                        {selectedNation.warDuration || 0}
                      </p>
                    </div>
                    <div className="bg-gray-900/40 p-2 rounded border border-gray-700">
                      <p className="text-gray-400">敌军损失</p>
                      <p className="text-lg font-bold text-white">
                        {selectedNation.enemyLosses || 0}
                      </p>
                    </div>
                    <div className="bg-gray-900/40 p-2 rounded border border-gray-700">
                      <p className="text-gray-400">剩余财富</p>
                      <p className="text-lg font-bold text-white">
                        {Math.floor(selectedNation.wealth || 0)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{renderPeaceHint(selectedNation)}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                      onClick={() => handleSimpleAction(selectedNation.id, 'peace')}
                    >
                      提出和平协议
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-sm text-gray-400">
              请选择一个国家以查看贸易与谈判选项。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
