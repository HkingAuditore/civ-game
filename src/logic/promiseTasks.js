// 承诺任务系统
// 用于生成和评估“承诺(Promise)”策略产生的限时任务

export const PROMISE_TASK_TYPES = {
    APPROVAL: 'approval', // 在期限内将满意度提升到指定阈值
};

/**
 * 创建一个满意度提升承诺任务
 * @param {Object} params
 * @param {string} params.stratumKey - 阶层 key
 * @param {string} params.stratumName - 阶层名称（用于描述）
 * @param {number} params.currentApproval - 当前满意度
 * @param {number} params.duration - 任务持续天数
 * @param {number} params.currentDay - 当前游戏天数
 * @param {Object} params.failurePenalty - 失败惩罚
 * @returns {Object} Promise 任务对象
 */
export function createApprovalPromiseTask({
    stratumKey,
    stratumName,
    currentApproval = 0,
    duration = 30,
    currentDay = 0,
    failurePenalty = {},
}) {
    const targetApproval = Math.min(90, Math.max(55, Math.round(currentApproval + 15)));

    return {
        id: `promise_${stratumKey}_${Date.now()}`,
        type: PROMISE_TASK_TYPES.APPROVAL,
        stratumKey,
        stratumName,
        targetApproval,
        createdDay: currentDay,
        deadlineDay: currentDay + duration,
        failurePenalty,
        description: `${stratumName} 期望在 ${duration} 天内将满意度提高到 ${targetApproval}%`,
    };
}

/**
 * 计算承诺任务剩余天数
 * @param {Object} task
 * @param {number} currentDay
 * @returns {number}
 */
export function getPromiseTaskRemainingDays(task, currentDay) {
    if (!task) return 0;
    return Math.max(0, (task.deadlineDay || 0) - currentDay);
}

const isTaskFulfilled = (task, context) => {
    const { classApproval = {} } = context || {};
    switch (task.type) {
        case PROMISE_TASK_TYPES.APPROVAL: {
            const approval = classApproval[task.stratumKey] || 0;
            return approval >= (task.targetApproval || 0);
        }
        default:
            return false;
    }
};

/**
 * 评估承诺任务状态
 * @param {Array} tasks - 当前任务列表
 * @param {Object} context - 游戏上下文
 * @param {number} context.currentDay - 当前游戏天数
 * @param {Object} context.classApproval - 各阶层满意度
 * @returns {{completed: Array, failed: Array, remaining: Array}}
 */
export function evaluatePromiseTasks(tasks = [], context = {}) {
    const { currentDay = 0 } = context;
    const completed = [];
    const failed = [];
    const remaining = [];

    tasks.forEach(task => {
        if (!task) return;
        if (isTaskFulfilled(task, context)) {
            completed.push(task);
            return;
        }
        if (currentDay >= (task.deadlineDay || 0)) {
            failed.push(task);
            return;
        }
        remaining.push(task);
    });

    return { completed, failed, remaining };
}

export default {
    PROMISE_TASK_TYPES,
    createApprovalPromiseTask,
    evaluatePromiseTasks,
    getPromiseTaskRemainingDays,
};
