import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Activity, PieChart, BarChart3, Globe } from 'lucide-react';

/**
 * 经济数据看板 - 专业的国家经济数据展示面板
 */
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

  // 计算财政健康度（国库/GDP比率）
  const fiscalHealth = gdp.total > 0 ? (treasury / gdp.total) * 100 : 0;
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
                    国库/GDP比率
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

          {/* 其他标签页内容待实现 */}
          {activeTab !== 'overview' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-2">功能开发中...</p>
                <p className="text-sm">该标签页内容即将推出</p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};