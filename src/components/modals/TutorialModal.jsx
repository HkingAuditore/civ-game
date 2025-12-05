// 新手教程模态框组件
// 提供多步骤引导，帮助新玩家了解游戏机制

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  if (!show) return null;

  const tutorialSteps = TUTORIAL_STEPS;
  const currentStepData = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        onComplete();
      }, 300);
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
    setIsAnimatingOut(true);
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  const animationClass = isAnimatingOut ? 'animate-sheet-out' : 'animate-sheet-in';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/90 animate-fade-in"></div>

      {/* 内容面板 */}
      <div className={`relative w-full max-w-3xl bg-gray-900/95 backdrop-blur border-t-2 lg:border-2 border-blue-500/50 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] ${animationClass} lg:animate-slide-up font-sans`}>
        {/* 进度条 */}
        <div className="h-1.5 bg-gray-800 rounded-t-2xl lg:rounded-t-xl overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
          />
        </div>

        {/* 头部 */}
        <div className="flex-shrink-0 p-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name={currentStepData.icon} size={24} className={currentStepData.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white leading-tight  font-serif ">{currentStepData.title}</h2>
              <p className="text-[10px] text-gray-400 leading-tight font-sans">
                步骤 {currentStep + 1} / {tutorialSteps.length}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="px-2 py-1 text-[14px] text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors flex-shrink-0 font-sans"
            >
              跳过
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3 font-sans">
          <StepContent step={currentStepData} onOpenWiki={onOpenWiki} isLastStep={isLastStep} />
        </div>

        {/* 底部按钮 */}
        <div className="flex-shrink-0 p-3 border-t border-gray-700 flex items-center justify-between gap-2 font-sans">
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors font-sans ${
              isFirstStep
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-white bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Icon name="ChevronLeft" size={14} />
            <span className="hidden sm:inline">上一步</span>
          </button>

          <div className="flex gap-1.5">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index === currentStep ? 'bg-blue-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all shadow-lg font-sans"
          >
            {isLastStep ? (
              <>
                <Icon name="Play" size={14} />
                开始游戏
              </>
            ) : (
              <>
                <span className="hidden sm:inline">下一步</span>
                <Icon name="ChevronRight" size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
    <div className="space-y-2">
      {step.lead && (
        <p className="text-sm text-white font-semibold  font-serif leading-tight">
          {step.lead}
        </p>
      )}

      {step.paragraphs?.map((text, idx) => (
        <p key={idx} className="text-[12px] text-gray-300 leading-relaxed">
          {text}
        </p>
      ))}

      {step.cards?.length > 0 && (
        <div className="space-y-1.5">
          {step.cards.map((card, idx) => (
            <div key={`${card.title}-${idx}`} className="bg-gray-700/50 p-2 rounded-lg border border-gray-600">
              <p className="text-[14px] font-serif text-white font-semibold mb-1 flex items-center gap-1.5 leading-tight">
                {card.icon && <Icon name={card.icon} size={14} className={card.iconColor || 'text-white'} />}
                {card.title}
              </p>
              <p className="text-[12px] text-gray-300 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      )}

      {step.callouts?.length > 0 && (
        <div className="space-y-1.5">
          {step.callouts.map((callout, idx) => {
            const tone = toneStyles[callout.tone] || { container: 'bg-gray-800/40 border-gray-700', text: 'text-gray-200' };
            return (
              <div
                key={`${callout.title}-${idx}`}
                className={`p-2 rounded-lg border ${tone.container} ${tone.text}`}
              >
                <p className="text-[14px]  font-serif font-semibold flex items-center gap-1.5 text-white leading-tight">
                  {callout.icon && <Icon name={callout.icon} size={14} className="text-current" />}
                  {callout.title}
                </p>
                <p className="text-[12px] mt-1 leading-relaxed">
                  {callout.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {step.wikiPrompt && (
        <div className="bg-indigo-900/30 border border-indigo-500/40 p-2 rounded-lg space-y-2">
          <p className="text-indigo-200 flex items-center gap-1.5 text-[10px] leading-tight">
            <Icon name="BookOpen" size={14} className="text-indigo-300" />
            {step.wikiPrompt.text}
          </p>
          {typeof onOpenWiki === 'function' && (
            <button
              type="button"
              onClick={onOpenWiki}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-600/50 transition-colors flex items-center gap-1.5"
            >
              <Icon name="Book" size={14} />
              {step.wikiPrompt.buttonLabel || '查看百科'}
            </button>
          )}
        </div>
      )}

      {step.footerNote && (
        <p className="text-center text-sm text-yellow-300 font-bold mt-3 leading-tight">
          {step.footerNote}
        </p>
      )}

      {isLastStep && !step.footerNote && (
        <p className="text-center text-sm text-yellow-300 font-bold mt-3 leading-tight">
          祝你好运，伟大的统治者！
        </p>
      )}
    </div>
  );
};
