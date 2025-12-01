// 外交标签页
// 展示国家状态、贸易套利与和平谈判

import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';

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
  tradeRoutes = { routes: [] },
  onTradeRouteAction,
  playerInstallmentPayment = null,
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
  const selectedRelation = selectedNation ? relationInfo(selectedNation.relation) : null;

  const totalAllies = visibleNations.filter((n) => (n.relation || 0) >= 80).length;
  const totalWars = visibleNations.filter((n) => n.isAtWar).length;

  // 检查是否已存在贸易路线
  const hasTradeRoute = (nationId, resourceKey, type) => {
    if (!tradeRoutes || !tradeRoutes.routes || !Array.isArray(tradeRoutes.routes)) {
      return false;
    }
    return tradeRoutes.routes.some(
      route => route.nationId === nationId && route.resource === resourceKey && route.type === type
    );
  };

  const handleTradeRoute = (resourceKey, type) => {
    if (!selectedNation || !onTradeRouteAction) return;
    const exists = hasTradeRoute(selectedNation.id, resourceKey, type);
    if (exists) {
      // 取消贸易路线
      onTradeRouteAction(selectedNation.id, 'cancel', { resource: resourceKey, type });
    } else {
      // 创建贸易路线
      onTradeRouteAction(selectedNation.id, 'create', { resource: resourceKey, type });
    }
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
    <div className="space-y-2">
      {/* 精简的统计信息 - 仅在桌面端显示 */}
      <div className="hidden md:flex gap-2 text-xs">
        <div className="bg-gray-800/60 px-2 py-1 rounded border border-gray-700">
          <span className="text-gray-400">国家:</span>
          <span className="text-white font-bold ml-1">{visibleNations.length}</span>
        </div>
        <div className="bg-green-900/20 px-2 py-1 rounded border border-green-600/20">
          <span className="text-gray-400">盟友:</span>
          <span className="text-green-300 font-bold ml-1">{totalAllies}</span>
        </div>
        <div className="bg-red-900/20 px-2 py-1 rounded border border-red-600/30">
          <span className="text-gray-400">战争:</span>
          <span className="text-red-300 font-bold ml-1">{totalWars}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 h-[calc(100vh-180px)] md:h-[600px]">
        <div className="bg-gray-800/40 rounded-lg border border-gray-700 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 border-b border-gray-700/80 text-[10px] uppercase tracking-wide text-gray-400">
            国家列表
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 hover:scrollbar-thumb-gray-500">
            {visibleNations.map((nation, idx) => {
              if (!nation) return null;
              const relation = relationInfo(nation.relation || 0);
              const isSelected = nation.id === selectedNation?.id;
              return (
                <button
                  key={nation.id}
                  onClick={() => setSelectedNationId(nation.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors border-b border-gray-700/60 focus:outline-none ${
                    isSelected ? 'bg-blue-900/30 border-l-2 border-l-blue-400' : 'hover:bg-gray-800/60'
                  } ${idx === visibleNations.length - 1 ? 'border-b-0' : ''}`}
                >
                  <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{nation.name || '未知国家'}</span>
                      <span className={`px-1 py-0.5 rounded text-[9px] ${relation.bg} ${relation.color}`}>
                        {relation.label}
                      </span>
                    </div>
                  </div>
                  <Icon
                    name={(nation.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                    size={12}
                    className={(nation.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                  />
                </button>
              );
            })}
            {visibleNations.length === 0 && (
              <div className="p-3 text-xs text-gray-400">当前时代暂无可接触的国家。</div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-2 max-h-[calc(100vh-180px)] md:max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
          {selectedNation ? (
            <>
              <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon name="Globe" size={14} className="text-amber-300" />
                    <h3 className="text-sm font-bold text-white">{selectedNation?.name || '未知国家'}</h3>
                    {selectedRelation && (
                      <span className={`px-1.5 py-0.5 text-[9px] rounded ${selectedRelation.bg} ${selectedRelation.color}`}>
                        {selectedRelation.label}
                      </span>
                    )}
                  </div>
                  <Icon
                    name={(selectedNation?.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                    size={14}
                    className={(selectedNation?.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                  />
                </div>
                <div className="flex gap-1.5 text-xs">
                  <button
                    className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-500 rounded text-white flex items-center justify-center gap-1"
                    onClick={() => handleSimpleAction(selectedNation.id, 'gift')}
                  >
                    <Icon name="Gift" size={12} /> 礼物
                  </button>
                  <button
                    className="flex-1 px-2 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-white flex items-center justify-center gap-1"
                    onClick={() => handleSimpleAction(selectedNation.id, 'demand')}
                  >
                    <Icon name="ShieldAlert" size={12} /> 索要
                  </button>
                  <button
                    className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 ${
                      selectedNation.isAtWar ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'
                    }`}
                    onClick={() =>
                      handleSimpleAction(selectedNation.id, (selectedNation?.isAtWar === true) ? 'peace' : 'declare_war')
                    }
                  >
                    <Icon name={(selectedNation?.isAtWar === true) ? 'Flag' : 'Swords'} size={12} />
                    {(selectedNation?.isAtWar === true) ? '求和' : '宣战'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1">
                    <Icon name="Route" size={12} className="text-blue-300" />
                    贸易路线管理
                  </h3>
                  <div className="text-[10px] text-gray-400">
                    创建贸易路线以自动进出口资源
                  </div>
                </div>
                <div className="space-y-1">
                  {tradableResources.map(([key, res]) => {
                    if (!selectedNation) return null;
                    const local = getLocalPrice(key);
                    const foreign = calculateForeignPrice(key, selectedNation, daysElapsed);
                    const diff = foreign - local;
                    const tradeStatus = calculateTradeStatus(key, selectedNation, daysElapsed) || {};
                    const shortageCapacity = Math.floor(tradeStatus.shortageAmount || 0);
                    const surplusCapacity = Math.floor(tradeStatus.surplusAmount || 0);
                    
                    // 检查是否已解锁该资源
                    const isUnlocked = (res.unlockEpoch ?? 0) <= epoch;
                    // 如果未解锁，则不显示
                    if (!isUnlocked) return null;
                    
                    // 检查是否处于战争
                    const isAtWar = selectedNation?.isAtWar || false;
                    
                    // 检查是否已有贸易路线
                    const hasExportRoute = hasTradeRoute(selectedNation.id, key, 'export');
                    const hasImportRoute = hasTradeRoute(selectedNation.id, key, 'import');
                    
                    // 所有已解锁的资源都显示，允许创建出口或进口路线
                    // 战争期间不能创建新路线，但已有路线仍然显示
                    
                    return (
                      <div key={key} className="bg-gray-900/40 rounded p-1.5 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Icon name={res.icon || 'Box'} size={12} className={res.color || 'text-gray-400'} />
                            <span className="text-xs font-semibold text-white">{res.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {tradeStatus.isShortage && (
                              <span className="text-red-400 font-mono">缺{shortageCapacity}</span>
                            )}
                            {tradeStatus.isSurplus && (
                              <span className="text-green-400 font-mono">余{surplusCapacity}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex gap-2 text-gray-400">
                            <span>本地: <span className="text-white font-mono">{local.toFixed(1)}</span></span>
                            <span>外国: <span className={`font-mono ${diff > 0 ? 'text-green-300' : 'text-red-300'}`}>{foreign.toFixed(1)}</span></span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              className={`px-1.5 py-0.5 rounded text-white flex items-center gap-0.5 ${
                                hasExportRoute 
                                  ? 'bg-red-600 hover:bg-red-500' 
                                  : isAtWar
                                  ? 'bg-gray-600 cursor-not-allowed'
                                  : 'bg-teal-600 hover:bg-teal-500'
                              }`}
                              onClick={() => handleTradeRoute(key, 'export')}
                              disabled={isAtWar && !hasExportRoute}
                              title={isAtWar && !hasExportRoute ? '战争期间无法创建新贸易路线' : ''}
                            >
                              <Icon name={hasExportRoute ? 'X' : 'ArrowUpRight'} size={10} />
                              {hasExportRoute ? '取消' : '出口'}
                            </button>
                            <button
                              className={`px-1.5 py-0.5 rounded text-white flex items-center gap-0.5 ${
                                hasImportRoute 
                                  ? 'bg-red-600 hover:bg-red-500' 
                                  : isAtWar
                                  ? 'bg-gray-600 cursor-not-allowed'
                                  : 'bg-purple-600 hover:bg-purple-500'
                              }`}
                              onClick={() => handleTradeRoute(key, 'import')}
                              disabled={isAtWar && !hasImportRoute}
                              title={isAtWar && !hasImportRoute ? '战争期间无法创建新贸易路线' : ''}
                            >
                              <Icon name={hasImportRoute ? 'X' : 'ArrowDownLeft'} size={10} />
                              {hasImportRoute ? '取消' : '进口'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedNation.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil && (
                <div className="bg-green-900/20 p-2 rounded-lg border border-green-600/30 mb-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5">
                    <Icon name="HandHeart" size={12} className="text-green-300" />
                    和平协议
                  </h3>
                  <p className="text-[10px] text-gray-300">
                    剩余天数: <span className="text-green-300 font-bold">{selectedNation.peaceTreatyUntil - daysElapsed}</span>
                  </p>
                  {selectedNation.installmentPayment && (
                    <p className="text-[10px] text-gray-300 mt-1">
                      分期支付: 每天 <span className="text-yellow-300 font-bold">{selectedNation.installmentPayment.amount}</span> 银币
                      （剩余 {selectedNation.installmentPayment.remainingDays} 天）
                    </p>
                  )}
                </div>
              )}

              {selectedNation.isAtWar && (
                <div className="bg-red-900/20 p-2 rounded-lg border border-red-600/30">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5">
                    <Icon name="AlertTriangle" size={12} className="text-red-300" />
                    战争状态
                  </h3>
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <div className="flex gap-2 text-gray-300">
                      <span>分数: <span className="text-red-300 font-bold">{selectedNation.warScore?.toFixed(0) || 0}</span></span>
                      <span>天数: <span className="text-white font-bold">{selectedNation.warDuration || 0}</span></span>
                      <span>损失: <span className="text-white font-bold">{selectedNation.enemyLosses || 0}</span></span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1.5">{renderPeaceHint(selectedNation)}</p>
                  <button
                    className="w-full px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                    onClick={() => handleSimpleAction(selectedNation.id, 'peace')}
                  >
                    提出和平协议
                  </button>
                </div>
              )}
              
              {playerInstallmentPayment && playerInstallmentPayment.nationId === selectedNation.id && (
                <div className="bg-yellow-900/20 p-2 rounded-lg border border-yellow-600/30 mt-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5">
                    <Icon name="Coins" size={12} className="text-yellow-300" />
                    你的分期支付
                  </h3>
                  <p className="text-[10px] text-gray-300">
                  每天支付: <span className="text-yellow-300 font-bold">{playerInstallmentPayment.amount}</span> 银币
                  </p>
                  <p className="text-[10px] text-gray-300 mt-1">
                  剩余天数: <span className="text-white font-bold">{playerInstallmentPayment.remainingDays}</span>
                  </p>
                  <p className="text-[10px] text-gray-300 mt-1">
                  已支付: <span className="text-green-300 font-bold">{playerInstallmentPayment.paidAmount}</span> / 
                    <span className="text-white font-bold"> {playerInstallmentPayment.totalAmount}</span> 银币
                  </p>
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
