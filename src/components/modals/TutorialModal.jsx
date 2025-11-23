// 新手教程模态框组件
// 提供多步骤引导，帮助新玩家了解游戏机制

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 新手教程模态框组件
 * @param {boolean} show - 是否显示教程
 * @param {Function} onComplete - 完成教程回调
 * @param {Function} onSkip - 跳过教程回调
 */
export const TutorialModal = ({ show, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!show) return null;

  // 教程步骤内容
  const tutorialSteps = [
    {
      title: '欢迎来到文明崛起',
      icon: 'Globe',
      iconColor: 'text-blue-400',
      content: (
        <div className="space-y-4">
          <p className="text-lg text-white font-semibold">
            欢迎，伟大的统治者！
          </p>
          <p className="text-gray-300 leading-relaxed">
            你将带领一个小小的部落，从原始时代开始，逐步发展成为强大的文明帝国。
          </p>
          <p className="text-gray-300 leading-relaxed">
            在这个旅程中，你需要管理资源、发展科技、维护社会稳定，并与其他文明进行外交或战争。
          </p>
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg">
            <p className="text-sm text-blue-300">
              💡 <span className="font-semibold">游戏目标：</span>
              从部落发展到现代文明，解锁所有时代，建立繁荣的帝国！
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '资源管理',
      icon: 'Package',
      iconColor: 'text-yellow-400',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 leading-relaxed">
            <span className="text-white font-semibold">左侧面板</span>显示了你的所有资源。资源是文明发展的基础！
          </p>
          <div className="space-y-3">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Wheat" size={16} className="text-yellow-400" />
                基础资源
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-yellow-300">食物</span>、<span className="text-yellow-300">木材</span>、<span className="text-yellow-300">石头</span> 等是最基础的资源，用于建造和维持人口。
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Coins" size={16} className="text-yellow-400" />
                银币系统
              </p>
              <p className="text-sm text-gray-300">
                <span className="text-yellow-300">银币</span>是经济核心！所有实物资源都在市场流通，你的仓库存货是用银币按当前价格买入的。
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Pickaxe" size={16} className="text-emerald-400" />
                获取资源
              </p>
              <p className="text-sm text-gray-300">
                点击左下角的<span className="text-emerald-300">「手动采集」</span>按钮可以获得少量银币，但主要还是通过建造建筑和分配人口来自动生产。
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '人口与社会',
      icon: 'Users',
      iconColor: 'text-blue-400',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 leading-relaxed">
            <span className="text-white font-semibold">人口是文明的核心</span>，他们会自动填补建筑创造的岗位，并转化为对应的社会阶层。
          </p>
          <div className="space-y-3">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Wheat" size={16} className="text-yellow-400" />
                维持人口
              </p>
              <p className="text-sm text-gray-300">
                人口需要<span className="text-yellow-300">食物</span>维持。确保食物产量为正，否则人口会饿死！
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Home" size={16} className="text-blue-400" />
                增加人口上限
              </p>
              <p className="text-sm text-gray-300">
                建造<span className="text-blue-300">房屋</span>可以提高人口上限。人口会自然增长，直到达到上限。
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Users" size={16} className="text-purple-400" />
                社会阶层
              </p>
              <p className="text-sm text-gray-300">
                不同建筑会创造不同阶层的岗位（农民、工匠、商人等）。留意各阶层的需求和好感度，避免社会动荡！
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '科技与时代',
      icon: 'Cpu',
      iconColor: 'text-purple-400',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300 leading-relaxed">
            通过<span className="text-white font-semibold">科技研究</span>解锁新建筑和能力，推动文明进入新时代！
          </p>
          <div className="space-y-3">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="BookOpen" size={16} className="text-blue-400" />
                科研系统
              </p>
              <p className="text-sm text-gray-300">
                建造<span className="text-blue-300">图书馆</span>产生科研点数。在<span className="text-purple-300">「科技」</span>标签页中研究新科技。
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="TrendingUp" size={16} className="text-yellow-400" />
                时代升级
              </p>
              <p className="text-sm text-gray-300">
                满足条件后可以升级时代（原始→古典→中世纪→工业→现代）。每个时代都会解锁新的建筑、科技和外交对手。
              </p>
            </div>
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                <Icon name="Scale" size={16} className="text-purple-400" />
                行政容量
              </p>
              <p className="text-sm text-gray-300">
                注意<span className="text-purple-300">行政压力</span>不要超过<span className="text-purple-300">行政容量</span>，否则税收和政策效率会下降！
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '开始你的征程',
      icon: 'Sparkles',
      iconColor: 'text-yellow-400',
      content: (
        <div className="space-y-4">
          <p className="text-lg text-white font-semibold">
            准备好了吗？
          </p>
          <p className="text-gray-300 leading-relaxed">
            现在你已经掌握了基础知识，是时候开始建立你的文明了！
          </p>
          <div className="space-y-3">
            <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-lg">
              <p className="text-sm text-emerald-300">
                ✨ <span className="font-semibold">开局建议：</span>
                先建造农田和伐木场，确保食物和木材稳定增长。
              </p>
            </div>
            <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg">
              <p className="text-sm text-blue-300">
                🎊 <span className="font-semibold">年度庆典：</span>
                从第2年开始，每年都会有庆典活动，你可以选择一项祝福效果！
              </p>
            </div>
            <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-lg">
              <p className="text-sm text-purple-300">
                💡 <span className="font-semibold">游戏提示：</span>
                右侧有详细的统治指南和新手教程，随时可以查看。
              </p>
            </div>
          </div>
          <p className="text-center text-lg text-yellow-300 font-bold mt-6">
            祝你好运，伟大的统治者！
          </p>
        </div>
      ),
    },
  ];

  const currentStepData = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900/95 backdrop-blur rounded-xl border-2 border-blue-500/50 max-w-3xl w-full shadow-2xl">
        {/* 进度条 */}
        <div className="h-2 bg-gray-800 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
          />
        </div>

        {/* 模态框头部 */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-800 rounded-lg">
                <Icon name={currentStepData.icon} size={32} className={currentStepData.iconColor} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentStepData.title}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  步骤 {currentStep + 1} / {tutorialSteps.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              跳过教程
            </button>
          </div>
        </div>

        {/* 模态框内容 */}
        <div className="p-8 min-h-[400px]">
          {currentStepData.content}
        </div>

        {/* 模态框底部按钮 */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              isFirstStep
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-white bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Icon name="ChevronLeft" size={16} />
            上一步
          </button>

          <div className="flex gap-2">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-blue-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all shadow-lg"
          >
            {isLastStep ? (
              <>
                <Icon name="Play" size={16} />
                开始游戏
              </>
            ) : (
              <>
                下一步
                <Icon name="ChevronRight" size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
