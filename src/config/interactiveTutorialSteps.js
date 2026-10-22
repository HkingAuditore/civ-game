// 交互式新手教程步骤配置
// 设计原则：便于后续维护和修改，步骤可单独调整

/**
 * 教程步骤类型
 * - 'highlight': 高亮某个元素并显示提示
 * - 'action': 需要用户执行特定操作
 * - 'info': 纯信息展示，点击继续即可
 * - 'wait': 等待某个条件满足（如等待资源变化）
 */

/**
 * 触发类型
 * - 'click': 用户点击目标元素
 * - 'any-click': 用户点击任意位置
 * - 'state-change': 游戏状态发生变化
 * - 'auto': 自动在显示后延迟进入下一步
 */

export const INTERACTIVE_TUTORIAL_STEPS = [
    // ========== 阶段1: 欢迎与核心概念 ==========
    {
        id: 'welcome',
        phase: 'intro',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '🎮 欢迎来到哈耶克的文明',
            description: '这是一个关于自由市场经济的策略游戏。接下来我将手把手教你游戏的核心概念。',
            hint: '点击任意位置继续',
        },
        // 无需高亮
        targetSelector: null,
    },

    {
        id: 'core_concept_money',
        phase: 'intro',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '💰 核心概念：你只拥有银币',
            description: '在这个游戏中，你作为当政者只拥有国库中的银币。所有的资源（粮食、木材、石料等）都由人民生产和拥有。',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    {
        id: 'core_concept_market',
        phase: 'intro',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '🏪 核心概念：市场购买一切',
            description: '当你建造建筑时，所需的原材料会自动从市场购买。市场价格由供需决定——稀缺的资源价格更高。',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    {
        id: 'core_concept_needs',
        phase: 'intro',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '🍞 核心概念：人民的需求',
            description: '人民需要食物和布料才能生存。如果这些必需品短缺，他们会挨饿、不满，甚至离开你的国家！',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    // ========== 阶段2: 查看资源面板 ==========
    {
        id: 'show_resources',
        phase: 'resources',
        type: 'highlight',
        trigger: 'any-click',
        content: {
            title: '📦 资源面板',
            description: '左侧面板显示了国家的所有资源。注意：这些是人民拥有的资源，不是你直接控制的。',
            hint: '点击继续',
        },
        targetSelector: '[data-tutorial="resource-panel"]',
        highlightPadding: 8,
    },

    {
        id: 'show_treasury',
        phase: 'resources',
        type: 'highlight',
        trigger: 'any-click',
        content: {
            title: '💵 国库银币',
            description: '这是你真正拥有的东西——国库中的银币。你需要通过税收来增加国库收入。',
            hint: '点击继续',
        },
        targetSelector: '[data-tutorial="treasury"]',
        highlightPadding: 4,
    },

    // ========== 阶段3: 建造建筑 ==========
    {
        id: 'go_to_build_tab',
        phase: 'building',
        type: 'action',
        trigger: 'state-change', // 通过监听标签切换来推进
        content: {
            title: '🏗️ 进入建设面板',
            description: '点击"建设"标签，我们来建造第一个农田。',
            hint: '点击建设标签',
        },
        targetSelector: '[data-tutorial="tab-build"]',
        highlightPadding: 4,
        // 验证条件：切换到建设标签
        validation: {
            type: 'tab-change',
            expectedTab: 'build',
        },
    },

    {
        id: 'build_farm',
        phase: 'building',
        type: 'action',
        trigger: 'state-change',
        content: {
            title: '🌾 建造农田',
            description: '农田生产粮食——这是人民生存的必需品。\n\n点击农田卡片上的绿色"+"按钮来建造，或点击卡片进入详情后建造。',
            hint: '建造一个农田',
        },
        targetSelector: '[data-building-id="farm"]',
        highlightPadding: 4,
        tooltipPosition: 'right', // 提示框显示在右侧，避免遮挡
        validation: {
            type: 'building-count',
            buildingId: 'farm',
            condition: 'increased',
        },
    },

    {
        id: 'explain_building_cost',
        phase: 'building',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '💡 建造成本说明',
            description: '刚才你看到银币减少了。建造建筑时，系统会自动用国库银币从市场购买所需的木材、石料等原材料。',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    {
        id: 'tip_weaver',
        phase: 'building',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '🧵 布料生产提示',
            description: '除了食物，人民还需要布料（衣物）。\n\n记得建造「织布坊」来生产布料，现在先继续教程！',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    // ========== 阶段4: 税收系统 ==========
    {
        id: 'go_to_politics_tab',
        phase: 'taxation',
        type: 'action',
        trigger: 'state-change', // 通过监听标签切换来推进
        content: {
            title: '⚖️ 进入政令面板',
            description: '接下来学习如何通过税收赚钱。点击"政令"标签。',
            hint: '点击政令标签',
        },
        targetSelector: '[data-tutorial="tab-politics"]',
        highlightPadding: 4,
        validation: {
            type: 'tab-change',
            expectedTab: 'politics',
        },
    },

    {
        id: 'show_tax_panel',
        phase: 'taxation',
        type: 'highlight',
        trigger: 'any-click',
        content: {
            title: '💰 税收面板',
            description: '这里可以调整各种税率。税收是国库收入的主要来源，但过高的税率会让人民不满！',
            hint: '点击继续',
        },
        targetSelector: '[data-tutorial="tax-panel"]',
        highlightPadding: 8,
    },

    {
        id: 'explain_tax_approval',
        phase: 'taxation',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '⚠️ 税收与满意度',
            description: '每个社会阶层都有满意度。税率过高会降低满意度，导致生产效率下降，甚至引发叛乱！需要在收入和稳定之间找到平衡。',
            hint: '点击继续',
        },
        targetSelector: null,
    },

    // ========== 阶段5: 总结 ==========
    {
        id: 'summary',
        phase: 'summary',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '🎉 教程完成！',
            description: '你已经学会了游戏的核心概念：\n• 你只拥有银币，资源由人民生产\n• 建造需要从市场购买原材料\n• 食物和布料是人民的必需品\n• 税收是收入来源，但影响满意度',
            hint: '点击开始游戏',
        },
        targetSelector: null,
    },

    {
        id: 'tip_wiki',
        phase: 'summary',
        type: 'info',
        trigger: 'any-click',
        content: {
            title: '📚 更多帮助',
            description: '如果遇到不懂的概念，可以点击屏幕角落的「百科」按钮查阅详细说明。祝你游戏愉快！',
            hint: '点击完成教程',
        },
        targetSelector: null, // 不高亮，因为PC和移动端位置不同
    },
];

/**
 * 获取教程阶段信息
 */
export const TUTORIAL_PHASES = {
    intro: { name: '核心概念', order: 1 },
    resources: { name: '认识资源', order: 2 },
    building: { name: '建造建筑', order: 3 },
    taxation: { name: '税收系统', order: 4 },
    summary: { name: '总结', order: 5 },
};

/**
 * 获取教程总步骤数
 */
export const getTotalSteps = () => INTERACTIVE_TUTORIAL_STEPS.length;

/**
 * 根据ID获取步骤
 */
export const getStepById = (id) => INTERACTIVE_TUTORIAL_STEPS.find(step => step.id === id);

/**
 * 获取下一步ID
 */
export const getNextStepId = (currentId) => {
    const currentIndex = INTERACTIVE_TUTORIAL_STEPS.findIndex(step => step.id === currentId);
    if (currentIndex === -1 || currentIndex >= INTERACTIVE_TUTORIAL_STEPS.length - 1) {
        return null;
    }
    return INTERACTIVE_TUTORIAL_STEPS[currentIndex + 1].id;
};

/**
 * 获取步骤序号（从1开始）
 */
export const getStepNumber = (stepId) => {
    const index = INTERACTIVE_TUTORIAL_STEPS.findIndex(step => step.id === stepId);
    return index === -1 ? 0 : index + 1;
};
