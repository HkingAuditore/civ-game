// 交互式教程系统 Hook
// 管理教程状态、步骤推进、事件监听

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getNextStepId,
    getStepById,
    getStepNumber,
    getTotalSteps,
    INTERACTIVE_TUTORIAL_STEPS,
} from '../config/interactiveTutorialSteps';

// 本地存储键名
const STORAGE_KEY_COMPLETED = 'tutorial_completed';
const STORAGE_KEY_CURRENT_STEP = 'tutorial_current_step';

/**
 * 交互式教程系统 Hook
 * @param {Object} options - 配置选项
 * @param {Object} options.gameState - 游戏状态对象
 * @param {string} options.currentTab - 当前激活的标签页
 * @param {Function} options.onComplete - 教程完成回调
 */
export const useTutorialSystem = ({ gameState, currentTab, onComplete } = {}) => {
    // 教程是否激活
    const [isActive, setIsActive] = useState(false);
    // 当前步骤ID
    const [currentStepId, setCurrentStepId] = useState('welcome');
    // 目标元素的位置信息
    const [targetRect, setTargetRect] = useState(null);
    // 是否正在等待状态变化
    const [isWaitingForChange, setIsWaitingForChange] = useState(false);

    // 用于比较状态变化
    const prevGameStateRef = useRef(null);
    // 用于记录建筑数量的初始值
    const buildingCountRef = useRef({});

    // 获取当前步骤信息
    const currentStep = getStepById(currentStepId);
    const stepNumber = getStepNumber(currentStepId);
    const totalSteps = getTotalSteps();

    /**
     * 检查教程是否已完成（首次启动检测）
     */
    const checkTutorialCompleted = useCallback(() => {
        try {
            return localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
        } catch {
            return false;
        }
    }, []);

    /**
     * 标记教程已完成
     */
    const markTutorialCompleted = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
        } catch {
            // 忽略存储错误
        }
    }, []);

    /**
     * 开始教程
     */
    const startTutorial = useCallback(() => {
        setCurrentStepId('welcome');
        setIsActive(true);
        setIsWaitingForChange(false);
        buildingCountRef.current = {};
    }, []);

    /**
     * 重置教程（从菜单手动触发时使用）
     */
    const resetTutorial = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY_COMPLETED);
            localStorage.removeItem(STORAGE_KEY_CURRENT_STEP);
        } catch {
            // 忽略存储错误
        }
        startTutorial();
    }, [startTutorial]);

    /**
     * 关闭/跳过教程
     */
    const skipTutorial = useCallback(() => {
        setIsActive(false);
        markTutorialCompleted();
        onComplete?.();
    }, [markTutorialCompleted, onComplete]);

    /**
     * 进入下一步
     */
    const nextStep = useCallback(() => {
        const nextId = getNextStepId(currentStepId);
        if (nextId) {
            // 获取下一步的配置
            const nextStepConfig = getStepById(nextId);

            setCurrentStepId(nextId);
            setIsWaitingForChange(false);
            setTargetRect(null);

            // 只在进入需要 building-count 验证的步骤时，更新对应建筑的参考数量
            if (nextStepConfig?.validation?.type === 'building-count' && gameState?.buildings) {
                const buildingIds = Array.isArray(nextStepConfig.validation.buildingId)
                    ? nextStepConfig.validation.buildingId
                    : [nextStepConfig.validation.buildingId];

                // 只更新需要验证的建筑的参考数量
                buildingIds.forEach(id => {
                    buildingCountRef.current[id] = gameState.buildings[id] || 0;
                });
            }
        } else {
            // 教程完成
            setIsActive(false);
            markTutorialCompleted();
            onComplete?.();
        }
    }, [currentStepId, gameState, markTutorialCompleted, onComplete]);

    /**
     * 更新目标元素位置
     * 支持移动端/桌面端适配：选择当前可见的目标元素
     */
    const updateTargetPosition = useCallback(() => {
        if (!currentStep?.targetSelector) {
            setTargetRect(null);
            return;
        }

        // 获取所有匹配的元素
        const elements = document.querySelectorAll(currentStep.targetSelector);
        if (elements.length === 0) {
            setTargetRect(null);
            return;
        }

        // 找到可见的元素（在视口内且有尺寸）
        let visibleElement = null;
        for (const element of elements) {
            const rect = element.getBoundingClientRect();
            // 检查元素是否可见：有尺寸且在视口内
            const isVisible =
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top < window.innerHeight &&
                rect.bottom > 0 &&
                rect.left < window.innerWidth &&
                rect.right > 0 &&
                getComputedStyle(element).display !== 'none' &&
                getComputedStyle(element).visibility !== 'hidden';

            if (isVisible) {
                visibleElement = element;
                break; // 找到第一个可见元素就停止
            }
        }

        if (visibleElement) {
            const rect = visibleElement.getBoundingClientRect();
            const padding = currentStep.highlightPadding || 0;
            setTargetRect({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
                element: visibleElement,
            });
        } else {
            setTargetRect(null);
        }
    }, [currentStep]);

    /**
     * 验证当前步骤是否完成
     */
    const validateStep = useCallback(() => {
        if (!currentStep?.validation) return false;

        const { type, expectedTab, buildingId, condition } = currentStep.validation;

        switch (type) {
            case 'tab-change':
                return currentTab === expectedTab;

            case 'building-count': {
                if (!gameState?.buildings) return false;

                const buildingIds = Array.isArray(buildingId) ? buildingId : [buildingId];
                const prevCounts = buildingCountRef.current;

                for (const id of buildingIds) {
                    const prevCount = prevCounts[id] || 0;
                    const currentCount = gameState.buildings[id] || 0;

                    if (condition === 'increased' && currentCount > prevCount) {
                        return true;
                    }
                }
                return false;
            }

            default:
                return false;
        }
    }, [currentStep, currentTab, gameState]);

    /**
     * 处理点击事件
     */
    const handleClick = useCallback((event) => {
        if (!isActive || !currentStep) return;

        const { trigger, targetSelector } = currentStep;

        if (trigger === 'any-click') {
            // 点击任意位置继续
            nextStep();
        } else if (trigger === 'click' && targetSelector) {
            // 检查是否点击了目标元素
            const targetElement = document.querySelector(targetSelector);
            if (targetElement && (targetElement === event.target || targetElement.contains(event.target))) {
                // 如果有验证条件，需要等待状态变化
                if (currentStep.validation) {
                    setIsWaitingForChange(true);
                } else {
                    nextStep();
                }
            }
        }
    }, [isActive, currentStep, nextStep]);

    // 首次加载时检查是否需要启动教程
    useEffect(() => {
        if (!checkTutorialCompleted()) {
            // 首次游戏，自动启动教程
            startTutorial();
        }
    }, [checkTutorialCompleted, startTutorial]);

    // 监听目标元素位置变化
    useEffect(() => {
        if (!isActive) return;

        updateTargetPosition();

        // 创建观察器监听DOM变化
        const observer = new MutationObserver(() => {
            updateTargetPosition();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
        });

        // 监听窗口大小变化
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition, true);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition, true);
        };
    }, [isActive, currentStepId, updateTargetPosition]);

    // 监听状态变化（用于验证步骤完成）
    useEffect(() => {
        if (!isActive || !currentStep?.validation) return;

        // 对于 state-change 触发器，直接监听状态变化
        // 对于其他触发器，需要先通过 handleClick 设置 isWaitingForChange
        const shouldValidate =
            currentStep.trigger === 'state-change' ||
            isWaitingForChange;

        if (shouldValidate && validateStep()) {
            nextStep();
        }
    }, [isActive, isWaitingForChange, currentStep, gameState, currentTab, validateStep, nextStep]);

    // 记录初始建筑数量
    useEffect(() => {
        if (isActive && gameState?.buildings && Object.keys(buildingCountRef.current).length === 0) {
            buildingCountRef.current = { ...gameState.buildings };
        }
    }, [isActive, gameState]);

    // 教程激活时自动暂停游戏，关闭时恢复
    const wasPausedBeforeTutorialRef = useRef(false);
    const setIsPausedRef = useRef(null);

    // 保持对 setIsPaused 函数的引用，避免依赖整个 gameState
    useEffect(() => {
        setIsPausedRef.current = gameState?.setIsPaused;
    }, [gameState?.setIsPaused]);

    useEffect(() => {
        const setIsPaused = setIsPausedRef.current;
        if (!setIsPaused) return;

        if (isActive) {
            // 记录教程开始前的暂停状态（只在 isActive 变为 true 时执行一次）
            wasPausedBeforeTutorialRef.current = gameState?.isPaused || false;
            // 暂停游戏
            setIsPaused(true);
        } else {
            // 教程结束后，恢复到教程开始前的状态
            // 如果教程前就是暂停的，保持暂停；否则恢复运行
            setIsPaused(wasPausedBeforeTutorialRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]); // 只依赖 isActive，确保只在教程激活/关闭时执行

    return {
        // 状态
        isActive,
        currentStep,
        currentStepId,
        stepNumber,
        totalSteps,
        targetRect,

        // 操作
        startTutorial,
        resetTutorial,
        skipTutorial,
        nextStep,
        handleClick,

        // 工具函数
        checkTutorialCompleted,
    };
};

export default useTutorialSystem;
