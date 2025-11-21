// 外交标签页组件
// 显示外交关系和外交行动

import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 外交标签页组件
 * 显示与其他国家的外交关系
 * @param {Array} nations - 国家列表
 */
export const DiplomacyTab = ({ nations }) => {
  /**
   * 获取关系等级
   * @param {number} relation - 关系值
   * @returns {Object} 关系等级信息
   */
  const getRelationLevel = (relation) => {
    if (relation >= 80) return { level: '盟友', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-600' };
    if (relation >= 60) return { level: '友好', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-600' };
    if (relation >= 40) return { level: '中立', color: 'text-gray-400', bg: 'bg-gray-700/20', border: 'border-gray-600' };
    if (relation >= 20) return { level: '冷淡', color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-600' };
    return { level: '敌对', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-600' };
  };

  return (
    <div className="space-y-4">
      {/* 外交说明 */}
      <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-purple-300 mb-1">关于外交</h3>
            <p className="text-xs text-gray-300">
              外交关系影响贸易、战争和文化交流。良好的关系可以带来贸易加成，
              而敌对关系可能导致战争。通过军事行动、贸易和文化交流来改善或恶化关系。
            </p>
          </div>
        </div>
      </div>

      {/* 外交概览 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="BarChart" size={16} className="text-blue-400" />
          外交概览
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">总国家数</p>
            <p className="text-lg font-bold text-white">{nations.length}</p>
          </div>
          <div className="bg-green-900/20 p-3 rounded border border-green-600/30">
            <p className="text-xs text-gray-400 mb-1">盟友</p>
            <p className="text-lg font-bold text-green-400">
              {nations.filter((n) => n.relation >= 80).length}
            </p>
          </div>
          <div className="bg-blue-900/20 p-3 rounded border border-blue-600/30">
            <p className="text-xs text-gray-400 mb-1">友好</p>
            <p className="text-lg font-bold text-blue-400">
              {nations.filter((n) => n.relation >= 60 && n.relation < 80).length}
            </p>
          </div>
          <div className="bg-yellow-900/20 p-3 rounded border border-yellow-600/30">
            <p className="text-xs text-gray-400 mb-1">冷淡</p>
            <p className="text-lg font-bold text-yellow-400">
              {nations.filter((n) => n.relation >= 20 && n.relation < 40).length}
            </p>
          </div>
          <div className="bg-red-900/20 p-3 rounded border border-red-600/30">
            <p className="text-xs text-gray-400 mb-1">敌对</p>
            <p className="text-lg font-bold text-red-400">
              {nations.filter((n) => n.relation < 20).length}
            </p>
          </div>
        </div>
      </div>

      {/* 国家列表 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="Globe" size={16} className="text-green-400" />
          国家关系
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {nations.map((nation) => {
            const relationInfo = getRelationLevel(nation.relation);

            return (
              <div
                key={nation.id}
                className={`p-4 rounded-lg border ${relationInfo.bg} ${relationInfo.border}`}
              >
                {/* 国家头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {nation.name}
                      <span className={`px-2 py-0.5 ${relationInfo.bg} ${relationInfo.color} text-xs rounded border ${relationInfo.border}`}>
                        {relationInfo.level}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">{nation.desc}</p>
                  </div>
                </div>

                {/* 关系进度条 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">关系值</span>
                    <span className={relationInfo.color}>{nation.relation}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        nation.relation >= 80 ? 'bg-green-500' :
                        nation.relation >= 60 ? 'bg-blue-500' :
                        nation.relation >= 40 ? 'bg-gray-500' :
                        nation.relation >= 20 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${nation.relation}%` }}
                    />
                  </div>
                </div>

                {/* 国家特性 */}
                <div className="space-y-2">
                  {/* 军事实力 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Icon name="Swords" size={12} className="text-red-400" />
                      <span className="text-gray-400">军事实力</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-sm ${
                            i < (nation.military || 3) ? 'bg-red-500' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 经济实力 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Icon name="Coins" size={12} className="text-yellow-400" />
                      <span className="text-gray-400">经济实力</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-sm ${
                            i < (nation.economy || 3) ? 'bg-yellow-500' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 科技水平 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Icon name="Lightbulb" size={12} className="text-blue-400" />
                      <span className="text-gray-400">科技水平</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-sm ${
                            i < (nation.tech || 3) ? 'bg-blue-500' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 外交行动按钮 */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    className="px-2 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-semibold transition-colors"
                    title="赠送礼物"
                  >
                    <Icon name="Gift" size={12} className="mx-auto" />
                  </button>
                  <button
                    className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors"
                    title="贸易协定"
                  >
                    <Icon name="Handshake" size={12} className="mx-auto" />
                  </button>
                  <button
                    className="px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
                    title="宣战"
                  >
                    <Icon name="Swords" size={12} className="mx-auto" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 外交建议 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
          <Icon name="MessageSquare" size={16} className="text-yellow-400" />
          外交建议
        </h3>

        <div className="space-y-2">
          {nations.filter((n) => n.relation < 30).length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-600/30 rounded">
              <Icon name="AlertTriangle" size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-300">警告</p>
                <p className="text-xs text-gray-300 mt-1">
                  你与 {nations.filter((n) => n.relation < 30).map((n) => n.name).join('、')} 的关系非常紧张，
                  可能随时爆发战争。建议加强军事防御或改善关系。
                </p>
              </div>
            </div>
          )}

          {nations.filter((n) => n.relation >= 70).length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-green-900/20 border border-green-600/30 rounded">
              <Icon name="ThumbsUp" size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-green-300">机会</p>
                <p className="text-xs text-gray-300 mt-1">
                  你与 {nations.filter((n) => n.relation >= 70).map((n) => n.name).join('、')} 的关系良好，
                  可以考虑建立贸易协定或军事同盟。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
