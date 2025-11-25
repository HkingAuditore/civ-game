// 新手教程模态框组件
// 提供多步骤引导，帮助新玩家了解游戏机制

import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { TUTORIAL_STEPS } from '../../config/tutorialSteps';

/**
 * 新手教程模态框组件
 * @param {boolean} show - 是否显示教程
 * @param {Function} onComplete - 完成教程回调
 * @param {Function} onSkip - 跳过教程回调
 * @param {Function} onOpenWiki - 打开百科的回调
 */
export const TutorialModal = ({ show, onComplete, onSkip, onOpenWiki }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!show) return null;

  const tutorialSteps = TUTORIAL_STEPS;
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 sm:p-4 p-0">
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
          <StepContent step={currentStepData} onOpenWiki={onOpenWiki} isLastStep={isLastStep} />
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

const toneStyles = {
  info: { container: 'bg-blue-900/30 border-blue-500/30', text: 'text-blue-200' },
  success: { container: 'bg-emerald-900/30 border-emerald-500/30', text: 'text-emerald-200' },
  warning: { container: 'bg-amber-900/30 border-amber-500/30', text: 'text-amber-200' },
  tip: { container: 'bg-purple-900/30 border-purple-500/30', text: 'text-purple-200' },
};

const StepContent = ({ step, onOpenWiki, isLastStep }) => {
  if (!step) return null;

  return (
    <div className="space-y-4">
      {step.lead && (
        <p className="text-lg text-white font-semibold">
          {step.lead}
        </p>
      )}

      {step.paragraphs?.map((text, idx) => (
        <p key={idx} className="text-gray-300 leading-relaxed">
          {text}
        </p>
      ))}

      {step.cards?.length > 0 && (
        <div className="space-y-3">
          {step.cards.map((card, idx) => (
            <div key={`${card.title}-${idx}`} className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-white font-semibold mb-2 flex items-center gap-2">
                {card.icon && <Icon name={card.icon} size={16} className={card.iconColor || 'text-white'} />}
                {card.title}
              </p>
              <p className="text-sm text-gray-300">{card.text}</p>
            </div>
          ))}
        </div>
      )}

      {step.callouts?.length > 0 && (
        <div className="space-y-3">
          {step.callouts.map((callout, idx) => {
            const tone = toneStyles[callout.tone] || { container: 'bg-gray-800/40 border-gray-700', text: 'text-gray-200' };
            return (
              <div
                key={`${callout.title}-${idx}`}
                className={`p-4 rounded-lg border ${tone.container} ${tone.text}`}
              >
                <p className="text-sm font-semibold flex items-center gap-2 text-white">
                  {callout.icon && <Icon name={callout.icon} size={16} className="text-current" />}
                  {callout.title}
                </p>
                <p className="text-sm mt-2">
                  {callout.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {step.wikiPrompt && (
        <div className="bg-indigo-900/30 border border-indigo-500/40 p-4 rounded-lg space-y-3">
          <p className="text-indigo-200 flex items-center gap-2 text-sm">
            <Icon name="BookOpen" size={16} className="text-indigo-300" />
            {step.wikiPrompt.text}
          </p>
          {typeof onOpenWiki === 'function' && (
            <button
              type="button"
              onClick={onOpenWiki}
              className="px-4 py-2 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-sm font-semibold text-indigo-100 hover:bg-indigo-600/50 transition-colors flex items-center gap-2 max-w-xs"
            >
              <Icon name="Book" size={16} />
              {step.wikiPrompt.buttonLabel || '查看百科'}
            </button>
          )}
        </div>
      )}

      {step.footerNote && (
        <p className="text-center text-lg text-yellow-300 font-bold mt-6">
          {step.footerNote}
        </p>
      )}

      {isLastStep && !step.footerNote && (
        <p className="text-center text-lg text-yellow-300 font-bold mt-6">
          祝你好运，伟大的统治者！
        </p>
      )}
    </div>
  );
};
