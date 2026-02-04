import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Activity, PieChart, BarChart3, Globe } from 'lucide-react';
import { RESOURCES } from '../../config/gameConstants';
import { STRATA } from '../../config/strata';

/**
 * 经济数据看板 - 专业的国家经济数据展示面板
 */
// 中文映射表
const LABEL_MAP = {
  // 收入项
  wage: '工资',
  ownerRevenue: '所有者收入',
  subsidy: '补贴',
  profit: '利润',
  rent: '租金',
  dividend: '股息',
  salary: '薪水',
  
  // 支出项
  transactionTax: '交易税',
  businessTax: '营业税',
  essentialNeeds: '必需品消费',
  luxuryNeeds: '奢侈品消费',
  decay: '资产折旧',
  productionCosts: '生产成本',
  investmentCosts: '投资成本',
  maintenanceCosts: '维护成本',
};

export const EconomicDashboard = ({ 
  isOpen, 
  onClose, 
  economicIndicators,
  history,
  marketPrices,
  equilibriumPrices,
  classFinancialData,
  treasury,
  dailyTreasuryIncome,
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, gdp, prices, trade, classes

  // 🎯 调试日志：当面板打开时输出所有数据
  React.useEffect(() => {
    if (isOpen) {
      console.group('💰 [ECONOMIC DASHBOARD OPENED]');
      console.log('📊 Economic Indicators:', economicIndicators);
      console.log('🔍 CPI By Tier:', economicIndicators?.cpiByTier);
      console.log('💵 Treasury:', treasury);
      console.log('📈 Daily Income:', dailyTreasuryIncome);
      console.log('🏷️ Market Prices:', marketPrices);
      console.log('⚖️ Equilibrium Prices:', equilibriumPrices);
      console.log('👥 Class Financial Data:', classFinancialData);
      console.groupEnd();
    }
  }, [isOpen, economicIndicators, treasury, dailyTreasuryIncome, marketPrices, equilibriumPrices, classFinancialData]);

  if (!isOpen) return null;

  // 安全获取数据
  const gdp = economicIndicators?.gdp || { total: 0, consumption: 0, investment: 0, government: 0, netExports: 0, change: 0 };
  const cpi = economicIndicators?.cpi || { index: 100, change: 0, breakdown: {} };
  const ppi = economicIndicators?.ppi || { index: 100, change: 0, breakdown: {} };

  // 格式化数字
  const formatAmount = (value) => {
    if (!value || isNaN(value)) return '0';
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  // 格式化百分比
  const formatPercent = (value) => {
    if (!value || isNaN(value)) return '0.0%';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // 获取资源的中文名称
  const getResourceName = (resourceKey) => {
    return RESOURCES[resourceKey]?.name || resourceKey;
  };

  // 获取趋势图标
  const TrendIcon = (value) => {
    if (!value || value === 0) return null;
    return value > 0 ? 
      <TrendingUp className="w-3 h-3 text-green-400" /> : 
      <TrendingDown className="w-3 h-3 text-red-400" />;
  };

  // 计算通胀率（CPI变化）
  const inflationRate = cpi.change || 0;
  const inflationStatus = inflationRate > 5 ? 'danger' : inflationRate > 2 ? 'warning' : 'good';

  // 计算GDP增长率
  const gdpGrowthRate = gdp.change || 0;
  const growthStatus = gdpGrowthRate > 3 ? 'good' : gdpGrowthRate > 0 ? 'warning' : 'danger';

  // 计算财政健康度（国库储备占年GDP的百分比）
  // 注意：这里的GDP是每日GDP，需要乘以365得到年GDP
  const annualGDP = gdp.total * 365;
  const fiscalHealth = annualGDP > 0 ? (treasury / annualGDP) * 100 : 0;
  const fiscalStatus = fiscalHealth > 20 ? 'good' : fiscalHealth > 10 ? 'warning' : 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[95vw] h-[90vh] max-w-[1400px] bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900 rounded-xl border border-blue-500/30 shadow-2xl overflow-hidden">
        
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-500/30 bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-100">国家经济数据看板</h2>
              <p className="text-xs text-gray-400">Economic Dashboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors border border-transparent hover:border-red-500/30"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-red-400" />
          </button>
        </div>

        {/* 标签页导航 */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-700/50 bg-gray-900/60">
          {[
            { id: 'overview', label: '总览', icon: Activity },
            { id: 'gdp', label: 'GDP分析', icon: PieChart },
            { id: 'prices', label: '物价指数', icon: TrendingUp },
            { id: 'trade', label: '贸易数据', icon: Globe },
            { id: 'classes', label: '阶层经济', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="h-[calc(100%-140px)] overflow-y-auto p-6">
          
          {/* 总览标签页 */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* 核心指标卡片 */}
              <div className="grid grid-cols-4 gap-4">
                
                {/* GDP卡片 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl border border-blue-500/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-blue-300/80 uppercase tracking-wide">GDP 总量</span>
                    {TrendIcon(gdpGrowthRate)}
                  </div>
                  <div className="text-3xl font-bold text-blue-100 mb-1">
                    {formatAmount(gdp.total)}
                  </div>
                  <div className={`text-sm ${gdpGrowthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(gdpGrowthRate)} 增长率
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-500/20">
                    <div className="text-xs text-gray-400">
                      <div className="flex justify-between mb-1">
                        <span>消费</span>
                        <span className="text-white">{formatAmount(gdp.consumption)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>投资</span>
                        <span className="text-white">{formatAmount(gdp.investment)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CPI卡片 */}
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl border border-orange-500/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-orange-300/80 uppercase tracking-wide">消费者物价指数</span>
                    {TrendIcon(cpi.change)}
                  </div>
                  <div className="text-3xl font-bold text-orange-100 mb-1">
                    {cpi.index.toFixed(1)}
                  </div>
                  <div className={`text-sm ${cpi.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatPercent(cpi.change)} 变化
                  </div>
                  <div className="mt-3 pt-3 border-t border-orange-500/20">
                    <div className="text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>通胀状态</span>
                        <span className={`font-medium ${
                          inflationStatus === 'good' ? 'text-green-400' :
                          inflationStatus === 'warning' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {inflationStatus === 'good' ? '健康' :
                           inflationStatus === 'warning' ? '温和' : '过热'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PPI卡片 */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl border border-purple-500/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-purple-300/80 uppercase tracking-wide">生产者物价指数</span>
                    {TrendIcon(ppi.change)}
                  </div>
                  <div className="text-3xl font-bold text-purple-100 mb-1">
                    {ppi.index.toFixed(1)}
                  </div>
                  <div className={`text-sm ${ppi.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatPercent(ppi.change)} 变化
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    <div className="text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>基准价格</span>
                        <span className="text-white">90日均价</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 财政健康度卡片 */}
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl border border-green-500/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-green-300/80 uppercase tracking-wide">财政健康度</span>
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-3xl font-bold text-green-100 mb-1">
                    {fiscalHealth.toFixed(1)}%
                  </div>
                  <div className={`text-sm ${
                    fiscalStatus === 'good' ? 'text-green-400' :
                    fiscalStatus === 'warning' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    国库/年GDP比率
                  </div>
                  <div className="mt-3 pt-3 border-t border-green-500/20">
                    <div className="text-xs text-gray-400">
                      <div className="flex justify-between mb-1">
                        <span>国库</span>
                        <span className="text-white">{formatAmount(treasury)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>日收入</span>
                        <span className={dailyTreasuryIncome >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {formatAmount(dailyTreasuryIncome)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* GDP构成饼图区域 */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* GDP构成 */}
                <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                    GDP构成分析 (支出法)
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: '消费 (C)', value: gdp.consumption, color: 'bg-blue-500', percent: (gdp.consumption / gdp.total * 100) },
                      { label: '投资 (I)', value: gdp.investment, color: 'bg-green-500', percent: (gdp.investment / gdp.total * 100) },
                      { label: '政府支出 (G)', value: gdp.government, color: 'bg-yellow-500', percent: (gdp.government / gdp.total * 100) },
                      { label: '净出口 (NX)', value: gdp.netExports, color: 'bg-purple-500', percent: (gdp.netExports / gdp.total * 100) },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-400">{item.label}</span>
                          <span className="text-sm font-medium text-white">{formatAmount(item.value)}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.color} transition-all duration-500`}
                            style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.percent.toFixed(1)}% of GDP
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 物价指数对比 */}
                <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                    物价指数趋势
                  </h3>
                  <div className="space-y-4">
                    {/* CPI趋势 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-orange-300">CPI (消费者)</span>
                        <span className="text-lg font-bold text-orange-100">{cpi.index.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>基准: 100</span>
                        <span className={cpi.change >= 0 ? 'text-red-400' : 'text-green-400'}>
                          {formatPercent(cpi.change)}
                        </span>
                      </div>
                    </div>

                    {/* PPI趋势 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-300">PPI (生产者)</span>
                        <span className="text-lg font-bold text-purple-100">{ppi.index.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>基准: 100</span>
                        <span className={ppi.change >= 0 ? 'text-red-400' : 'text-green-400'}>
                          {formatPercent(ppi.change)}
                        </span>
                      </div>
                    </div>

                    {/* 价格传导分析 */}
                    <div className="pt-3 border-t border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-2">价格传导分析</div>
                      <div className="text-sm">
                        {ppi.change > cpi.change ? (
                          <span className="text-yellow-400">
                            ⚠️ 生产成本上涨可能传导至消费端
                          </span>
                        ) : ppi.change < cpi.change ? (
                          <span className="text-blue-400">
                            ℹ️ 消费需求旺盛，生产成本稳定
                          </span>
                        ) : (
                          <span className="text-green-400">
                            ✓ 价格传导平衡
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* 经济健康度指标 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                  经济健康度评估
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  
                  {/* 增长指标 */}
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${
                      growthStatus === 'good' ? 'text-green-400' :
                      growthStatus === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {growthStatus === 'good' ? '优' :
                       growthStatus === 'warning' ? '良' : '差'}
                    </div>
                    <div className="text-xs text-gray-400 mb-1">经济增长</div>
                    <div className="text-sm text-white">{formatPercent(gdpGrowthRate)}</div>
                  </div>

                  {/* 通胀指标 */}
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${
                      inflationStatus === 'good' ? 'text-green-400' :
                      inflationStatus === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {inflationStatus === 'good' ? '优' :
                       inflationStatus === 'warning' ? '良' : '差'}
                    </div>
                    <div className="text-xs text-gray-400 mb-1">通胀控制</div>
                    <div className="text-sm text-white">{formatPercent(inflationRate)}</div>
                  </div>

                  {/* 财政指标 */}
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${
                      fiscalStatus === 'good' ? 'text-green-400' :
                      fiscalStatus === 'warning' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {fiscalStatus === 'good' ? '优' :
                       fiscalStatus === 'warning' ? '良' : '差'}
                    </div>
                    <div className="text-xs text-gray-400 mb-1">财政状况</div>
                    <div className="text-sm text-white">{fiscalHealth.toFixed(1)}%</div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* GDP分析标签页 */}
          {activeTab === 'gdp' && (
            <div className="space-y-6">
              
              {/* GDP总览 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">GDP总量与增长</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">当前GDP (日)</div>
                    <div className="text-4xl font-bold text-blue-100 mb-1">{formatAmount(gdp.total)}</div>
                    <div className={`text-lg ${gdpGrowthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(gdpGrowthRate)} 增长率
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">预估年GDP</div>
                    <div className="text-4xl font-bold text-purple-100">{formatAmount(gdp.total * 365)}</div>
                    <div className="text-sm text-gray-400 mt-2">基于当前日GDP × 365天</div>
                  </div>
                </div>
              </div>

              {/* GDP构成详细分析 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">GDP构成详细分析 (支出法)</h3>
                <div className="space-y-6">
                  
                  {/* 消费 (C) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-base font-medium text-blue-200">消费 (Consumption)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-100">{formatAmount(gdp.consumption)}</div>
                        <div className="text-sm text-gray-400">{((gdp.consumption / gdp.total) * 100).toFixed(1)}% of GDP</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(gdp.consumption / gdp.total) * 100}%` }}></div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      包括：居民必需品消费 + 奢侈品消费
                    </div>
                  </div>

                  {/* 投资 (I) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-base font-medium text-green-200">投资 (Investment)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-100">{formatAmount(gdp.investment)}</div>
                        <div className="text-sm text-gray-400">{((gdp.investment / gdp.total) * 100).toFixed(1)}% of GDP</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(gdp.investment / gdp.total) * 100}%` }}></div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      包括：建筑建造成本 + 建筑升级成本
                    </div>
                  </div>

                  {/* 政府支出 (G) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-base font-medium text-yellow-200">政府支出 (Government)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-100">{formatAmount(gdp.government)}</div>
                        <div className="text-sm text-gray-400">{((gdp.government / gdp.total) * 100).toFixed(1)}% of GDP</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: `${(gdp.government / gdp.total) * 100}%` }}></div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      包括：军费开支 + 官员薪资 + 政府补贴
                    </div>
                  </div>

                  {/* 净出口 (NX) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-base font-medium text-purple-200">净出口 (Net Exports)</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${gdp.netExports >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                          {gdp.netExports >= 0 ? '+' : ''}{formatAmount(gdp.netExports)}
                        </div>
                        <div className="text-sm text-gray-400">{((gdp.netExports / gdp.total) * 100).toFixed(1)}% of GDP</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${gdp.netExports >= 0 ? 'bg-purple-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.abs((gdp.netExports / gdp.total) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      出口 - 进口 = {formatAmount(gdp.breakdown?.exports || 0)} - {formatAmount(gdp.breakdown?.imports || 0)}
                    </div>
                  </div>

                </div>
              </div>

              {/* GDP公式说明 */}
              <div className="bg-blue-900/20 rounded-xl border border-blue-500/30 p-5">
                <h3 className="text-sm font-semibold text-blue-300 mb-3">📚 GDP计算公式 (支出法)</h3>
                <div className="text-center text-2xl font-mono text-blue-100 mb-3">
                  GDP = C + I + G + NX
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-blue-300 font-medium mb-1">C</div>
                    <div className="text-gray-400">消费</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-300 font-medium mb-1">I</div>
                    <div className="text-gray-400">投资</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-300 font-medium mb-1">G</div>
                    <div className="text-gray-400">政府支出</div>
                  </div>
                  <div className="text-center">
                    <div className="text-purple-300 font-medium mb-1">NX</div>
                    <div className="text-gray-400">净出口</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 物价指数标签页 */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              
              {/* 分层CPI总览 */}
              {economicIndicators.cpiByTier && (
                <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                  <h3 className="text-lg font-semibold text-blue-300 mb-4">分层消费者物价指数 (CPI)</h3>
                  <div className="text-xs text-gray-400 mb-4">
                    基于各阶层实际消费数据动态计算，反映不同阶层的生活成本变化
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    {/* 综合CPI */}
                    <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-lg border border-orange-500/30 p-4">
                      <div className="text-xs text-orange-300 mb-1">综合CPI</div>
                      <div className="text-2xl font-bold text-orange-100">{cpi.index.toFixed(1)}</div>
                      <div className={`text-sm font-medium mt-1 ${cpi.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPercent(cpi.change)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">全体居民</div>
                    </div>
                    
                    {/* 底层CPI */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg border border-blue-500/30 p-4">
                      <div className="text-xs text-blue-300 mb-1">底层CPI</div>
                      <div className="text-2xl font-bold text-blue-100">
                        {economicIndicators.cpiByTier.lower.index.toFixed(1)}
                      </div>
                      <div className={`text-sm font-medium mt-1 ${economicIndicators.cpiByTier.lower.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPercent(economicIndicators.cpiByTier.lower.change)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">农民/工人</div>
                    </div>
                    
                    {/* 中层CPI */}
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-lg border border-green-500/30 p-4">
                      <div className="text-xs text-green-300 mb-1">中层CPI</div>
                      <div className="text-2xl font-bold text-green-100">
                        {economicIndicators.cpiByTier.middle.index.toFixed(1)}
                      </div>
                      <div className={`text-sm font-medium mt-1 ${economicIndicators.cpiByTier.middle.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPercent(economicIndicators.cpiByTier.middle.change)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">工匠/商人</div>
                    </div>
                    
                    {/* 上层CPI */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg border border-purple-500/30 p-4">
                      <div className="text-xs text-purple-300 mb-1">上层CPI</div>
                      <div className="text-2xl font-bold text-purple-100">
                        {economicIndicators.cpiByTier.upper.index.toFixed(1)}
                      </div>
                      <div className={`text-sm font-medium mt-1 ${economicIndicators.cpiByTier.upper.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatPercent(economicIndicators.cpiByTier.upper.change)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">贵族/资本家</div>
                    </div>
                  </div>
                  
                  {/* 阶层差异分析 */}
                  <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                    <div className="text-sm font-medium text-blue-300 mb-2">阶层差异分析</div>
                    <div className="text-sm text-gray-200">
                      {(() => {
                        const lowerChange = economicIndicators.cpiByTier.lower.change;
                        const upperChange = economicIndicators.cpiByTier.upper.change;
                        const diff = lowerChange - upperChange;
                        
                        if (diff > 2) {
                          return '⚠️ 底层生活成本上涨显著高于上层，贫富差距可能扩大';
                        } else if (diff < -2) {
                          return '📈 上层生活成本上涨更快，奢侈品价格上涨';
                        } else {
                          return '✓ 各阶层生活成本变化相对均衡';
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* CPI详细分解 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-orange-300 mb-4">消费者物价指数 (CPI) 详细分解</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">综合指数</span>
                    <span className="text-3xl font-bold text-orange-100">{cpi.index.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">变化率</span>
                    <span className={`text-xl font-medium ${cpi.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatPercent(cpi.change)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 mt-6">
                  {Object.entries(cpi.breakdown || {}).map(([resource, data]) => (
                    <div key={resource} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{getResourceName(resource)}</span>
                          <span className="text-xs text-gray-500">权重: {(data.weight * 100).toFixed(0)}%</span>
                        </div>
                        <span className="text-sm font-bold text-orange-200">{data.currentPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">基准价: {data.basePrice?.toFixed(2) || '0.00'}</span>
                        <span className={`font-medium ${data.priceChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {data.priceChange >= 0 ? '+' : ''}{data.priceChange?.toFixed(1) || '0.0'}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        对CPI贡献: {data.contribution >= 0 ? '+' : ''}{data.contribution?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PPI详细分解 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-purple-300 mb-4">生产者物价指数 (PPI) 详细分解</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">综合指数</span>
                    <span className="text-3xl font-bold text-purple-100">{ppi.index.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">变化率</span>
                    <span className={`text-xl font-medium ${ppi.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatPercent(ppi.change)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 mt-6">
                  {Object.entries(ppi.breakdown || {}).map(([resource, data]) => (
                    <div key={resource} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{getResourceName(resource)}</span>
                          <span className="text-xs text-gray-500">权重: {(data.weight * 100).toFixed(0)}%</span>
                        </div>
                        <span className="text-sm font-bold text-purple-200">{data.currentPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">基准价: {data.basePrice?.toFixed(2) || '0.00'}</span>
                        <span className={`font-medium ${data.priceChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {data.priceChange >= 0 ? '+' : ''}{data.priceChange?.toFixed(1) || '0.0'}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        对PPI贡献: {data.contribution >= 0 ? '+' : ''}{data.contribution?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 价格传导分析 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">价格传导分析</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-500/30">
                    <div className="text-sm text-orange-300 mb-2">CPI变化</div>
                    <div className="text-3xl font-bold text-orange-100">{formatPercent(cpi.change)}</div>
                    <div className="text-xs text-gray-400 mt-2">消费端价格压力</div>
                  </div>
                  <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-500/30">
                    <div className="text-sm text-purple-300 mb-2">PPI变化</div>
                    <div className="text-3xl font-bold text-purple-100">{formatPercent(ppi.change)}</div>
                    <div className="text-xs text-gray-400 mt-2">生产端成本压力</div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <div className="text-sm font-medium text-blue-300 mb-2">传导状态</div>
                  <div className="text-base text-gray-200">
                    {ppi.change > cpi.change + 2 ? (
                      <span>⚠️ 生产成本上涨显著，可能向消费端传导</span>
                    ) : ppi.change < cpi.change - 2 ? (
                      <span>📈 消费需求旺盛，生产成本相对稳定</span>
                    ) : (
                      <span>✓ 价格传导平衡，经济运行平稳</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 贸易数据标签页 */}
          {activeTab === 'trade' && (
            <div className="space-y-6">
              
              {/* 贸易总览 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl border border-green-500/30 p-5">
                  <div className="text-sm text-green-300 mb-2">出口总额</div>
                  <div className="text-3xl font-bold text-green-100">{formatAmount(gdp.breakdown?.exports || 0)}</div>
                  <div className="text-xs text-gray-400 mt-2">Export Value</div>
                </div>
                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl border border-red-500/30 p-5">
                  <div className="text-sm text-red-300 mb-2">进口总额</div>
                  <div className="text-3xl font-bold text-red-100">{formatAmount(gdp.breakdown?.imports || 0)}</div>
                  <div className="text-xs text-gray-400 mt-2">Import Value</div>
                </div>
                <div className={`bg-gradient-to-br rounded-xl border p-5 ${
                  gdp.netExports >= 0 
                    ? 'from-blue-500/10 to-blue-600/5 border-blue-500/30' 
                    : 'from-orange-500/10 to-orange-600/5 border-orange-500/30'
                }`}>
                  <div className={`text-sm mb-2 ${gdp.netExports >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>
                    贸易差额
                  </div>
                  <div className={`text-3xl font-bold ${gdp.netExports >= 0 ? 'text-blue-100' : 'text-orange-100'}`}>
                    {gdp.netExports >= 0 ? '+' : ''}{formatAmount(gdp.netExports)}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {gdp.netExports >= 0 ? '贸易顺差' : '贸易逆差'}
                  </div>
                </div>
              </div>

              {/* 贸易平衡分析 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">贸易平衡分析</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">出口占GDP比重</span>
                      <span className="text-lg font-bold text-green-300">
                        {((gdp.breakdown?.exports || 0) / gdp.total * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${((gdp.breakdown?.exports || 0) / gdp.total * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">进口占GDP比重</span>
                      <span className="text-lg font-bold text-red-300">
                        {((gdp.breakdown?.imports || 0) / gdp.total * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500" 
                        style={{ width: `${((gdp.breakdown?.imports || 0) / gdp.total * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <div className="text-sm font-medium text-blue-300 mb-2">贸易状态评估</div>
                  <div className="text-base text-gray-200">
                    {gdp.netExports > gdp.total * 0.05 ? (
                      <span>✓ 贸易顺差健康，出口竞争力强</span>
                    ) : gdp.netExports < -gdp.total * 0.05 ? (
                      <span>⚠️ 贸易逆差较大，需关注外汇储备</span>
                    ) : (
                      <span>✓ 贸易基本平衡</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 说明 */}
              <div className="bg-yellow-900/20 rounded-xl border border-yellow-500/30 p-4">
                <div className="text-sm text-yellow-300">
                  💡 <span className="font-medium">数据说明</span>
                </div>
                <div className="text-sm text-gray-300 mt-2">
                  贸易数据基于游戏中的资源出口记录。出口值 = 出口数量 × 市场价格。
                  净出口 (NX) = 出口 - 进口，正值表示贸易顺差，负值表示贸易逆差。
                </div>
              </div>

            </div>
          )}

          {/* 阶层经济标签页 */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              
              {/* 阶层经济总览 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">各阶层经济状况</h3>
                <div className="space-y-4">
                  {Object.entries(classFinancialData || {}).map(([className, data]) => {
                    const totalIncome = Object.values(data.income || {}).reduce((sum, val) => sum + (val || 0), 0);
                    
                    // 修复：正确计算总支出（处理嵌套对象）
                    const totalExpense = Object.values(data.expense || {}).reduce((sum, val) => {
                      if (typeof val === 'object' && val !== null) {
                        // 如果是对象（如essentialNeeds），计算其中所有项的cost总和
                        const objTotal = Object.values(val).reduce((objSum, item) => {
                          const cost = item?.cost || item?.totalCost || 0;
                          return objSum + cost;
                        }, 0);
                        return sum + objTotal;
                      }
                      // 如果是数字，直接累加
                      return sum + (val || 0);
                    }, 0);
                    
                    const netIncome = totalIncome - totalExpense;
                    
                    return (
                      <div key={className} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-base font-medium text-gray-200">{STRATA[className]?.name || className}</span>
                          <span className={`text-lg font-bold ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {netIncome >= 0 ? '+' : ''}{formatAmount(netIncome)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">总收入</div>
                            <div className="text-sm font-medium text-green-300">{formatAmount(totalIncome)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">总支出</div>
                            <div className="text-sm font-medium text-red-300">{formatAmount(totalExpense)}</div>
                          </div>
                        </div>

                        {/* 收入明细 */}
                        <details className="mt-2">
                          <summary className="text-xs text-blue-300 cursor-pointer hover:text-blue-200">
                            查看收入明细
                          </summary>
                          <div className="mt-2 pl-4 space-y-1">
                            {Object.entries(data.income || {}).map(([key, value]) => (
                              value > 0 && (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="text-gray-400">{LABEL_MAP[key] || key}</span>
                                  <span className="text-green-400">{formatAmount(value)}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </details>

                        {/* 支出明细 */}
                        <details className="mt-2">
                          <summary className="text-xs text-orange-300 cursor-pointer hover:text-orange-200">
                            查看支出明细
                          </summary>
                          <div className="mt-2 pl-4 space-y-1">
                            {Object.entries(data.expense || {}).map(([key, value]) => {
                              // 如果是对象（如essentialNeeds），计算总和
                              if (typeof value === 'object' && value !== null) {
                                const total = Object.values(value).reduce((sum, item) => {
                                  const cost = item?.cost || item?.totalCost || 0;
                                  return sum + cost;
                                }, 0);
                                return total > 0 && (
                                  <div key={key} className="flex justify-between text-xs">
                                    <span className="text-gray-400">{LABEL_MAP[key] || key}</span>
                                    <span className="text-red-400">{formatAmount(total)}</span>
                                  </div>
                                );
                              }
                              // 如果是数字
                              return value > 0 && (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="text-gray-400">{LABEL_MAP[key] || key}</span>
                                  <span className="text-red-400">{formatAmount(value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </details>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 阶层经济健康度 */}
              <div className="bg-gray-900/60 rounded-xl border border-gray-700/50 p-5">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">阶层经济健康度</h3>
                <div className="space-y-3">
                  {Object.entries(classFinancialData || {}).map(([className, data]) => {
                    const totalIncome = Object.values(data.income || {}).reduce((sum, val) => sum + (val || 0), 0);
                    const totalExpense = Object.values(data.expense || {}).reduce((sum, val) => sum + (val || 0), 0);
                    const netIncome = totalIncome - totalExpense;
                    const healthPercent = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
                    
                    return (
                      <div key={className}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300 capitalize">{className}</span>
                          <span className={`text-sm font-medium ${
                            healthPercent > 20 ? 'text-green-400' :
                            healthPercent > 0 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {healthPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              healthPercent > 20 ? 'bg-green-500' :
                              healthPercent > 0 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, healthPercent))}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-xs text-gray-400">
                  健康度 = (净收入 / 总收入) × 100%。绿色表示健康，黄色表示一般，红色表示亏损。
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};