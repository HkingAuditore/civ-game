// 政令标签页组件
// 显示可用政令和切换功能

import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 政令标签页组件
 * 显示所有政令及其效果
 * @param {Array} decrees - 政令数组
 * @param {Function} onToggle - 切换政令回调
 */
export const PoliticsTab = ({ decrees, onToggle }) => {
  // 按类别分组政令
  const categories = {
    economy: { name: '经济政策', icon: 'Coins', color: 'text-yellow-400' },
    military: { name: '军事政策', icon: 'Shield', color: 'text-red-400' },
    culture: { name: '文化政策', icon: 'Book', color: 'text-purple-400' },
    social: { name: '社会政策', icon: 'Users', color: 'text-blue-400' },
  };

  const decreesByCategory = decrees.reduce((acc, decree) => {
    const category = decree.category || 'social';
    if (!acc[category]) acc[category] = [];
    acc[category].push(decree);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* 政令说明 */}
      <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-300 mb-1">关于政令</h3>
            <p className="text-xs text-gray-300">
              政令是国家的政策方针，可以带来各种加成或减益。激活的政令会立即生效，
              但某些政令可能会影响社会阶层的满意度。请根据国家发展需要谨慎选择。
            </p>
          </div>
        </div>
      </div>

      {/* 按类别显示政令 */}
      {Object.entries(categories).map(([catKey, catInfo]) => {
        const categoryDecrees = decreesByCategory[catKey] || [];
        if (categoryDecrees.length === 0) return null;

        return (
          <div key={catKey} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {/* 类别标题 */}
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300">
              <Icon name={catInfo.icon} size={16} className={catInfo.color} />
              {catInfo.name}
            </h3>

            {/* 政令列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categoryDecrees.map((decree) => (
                <div
                  key={decree.id}
                  className={`p-4 rounded-lg border transition-all ${
                    decree.active
                      ? 'bg-green-900/20 border-green-600 shadow-lg'
                      : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {/* 政令头部 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {decree.name}
                        {decree.active && (
                          <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                            生效中
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">{decree.desc}</p>
                    </div>
                  </div>

                  {/* 政令效果 */}
                  <div className="space-y-2 mb-3">
                    {/* 正面效果 */}
                    {decree.effects && decree.effects.length > 0 && (
                      <div className="p-2 bg-green-900/20 rounded">
                        <p className="text-xs text-gray-400 mb-1">正面效果：</p>
                        <div className="space-y-1">
                          {decree.effects.map((effect, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Icon name="Plus" size={12} className="text-green-400" />
                              <span className="text-green-300">{effect}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 负面效果 */}
                    {decree.drawbacks && decree.drawbacks.length > 0 && (
                      <div className="p-2 bg-red-900/20 rounded">
                        <p className="text-xs text-gray-400 mb-1">负面效果：</p>
                        <div className="space-y-1">
                          {decree.drawbacks.map((drawback, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs">
                              <Icon name="Minus" size={12} className="text-red-400" />
                              <span className="text-red-300">{drawback}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 切换按钮 */}
                  <button
                    onClick={() => onToggle(decree.id)}
                    className={`w-full px-4 py-2 rounded text-sm font-semibold transition-all ${
                      decree.active
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {decree.active ? (
                      <span className="flex items-center justify-center gap-2">
                        <Icon name="X" size={14} />
                        废除政令
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Icon name="Check" size={14} />
                        颁布政令
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 当前生效的政令统计 */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-300">
          <Icon name="FileText" size={16} className="text-blue-400" />
          政令统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">总政令数</p>
            <p className="text-lg font-bold text-white">{decrees.length}</p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">生效中</p>
            <p className="text-lg font-bold text-green-400">
              {decrees.filter((d) => d.active).length}
            </p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">未启用</p>
            <p className="text-lg font-bold text-gray-400">
              {decrees.filter((d) => !d.active).length}
            </p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded">
            <p className="text-xs text-gray-400 mb-1">政策效率</p>
            <p className="text-lg font-bold text-blue-400">
              {((decrees.filter((d) => d.active).length / decrees.length) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
