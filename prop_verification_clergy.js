
// 验证脚本：prop_verification_clergy.js
// 用途：重现神职人员在有基础短缺时，组织度上限仍被卡在50%的问题

import { updateAllOrganizationStates, updateStratumOrganization } from './src/logic/organizationSystem.js';

// Mock STRATA
const STRATA = {
    cleric: {
        name: "神职人员",
        needs: { food: 0.6, cloth: 0.09, papyrus: 0.035, ale: 0.035, culture: 0.06 },
        luxuryNeeds: {},
        headTaxBase: 0.05
    }
};

// Mock RESOURCES
const RESOURCES = {
    food: { name: '粮食', basePrice: 1 },
    cloth: { name: '布料', basePrice: 2 },
    papyrus: { name: '纸张', basePrice: 3 },
    ale: { name: '美酒', basePrice: 2 },
    culture: { name: '文化', basePrice: 5 }
};

// Monkey patch global imports for organizationSystem.js if needed or just rely on passing options
// assert that updateAllOrganizationStates uses the right logic

// 1. 测试 updateStratumOrganization (单元测试)
console.log('--- 测试用例 1: updateStratumOrganization 单元测试 ---');

const mockDriverContextSuccess = {
    driverScore: 0.5,
    hasBasicShortage: true, // 明确标记有短缺
    demands: []
};

const currentState = {
    organization: 50,
    stage: 'mobilizing',
    growthRate: 0
};

const result1 = updateStratumOrganization(
    currentState,
    20, // 满意度极低
    0.05, // 影响力占比
    50, // 稳定度
    'cleric',
    100, // currentDay
    {
        hasActivePromise: false,
        driverContext: mockDriverContextSuccess,
        hasBasicShortage: true // 参数传递
    }
);

console.log(`[Unit] org=50, hasBasicShortage=true. Result: org=${result1.organization}`);

if (result1.organization > 50) {
    console.log('✅ 单元测试通过：有短缺时突破了 50% 上限');
} else {
    console.log('❌ 单元测试失败：有短缺时仍受限于 50% 上限');
}


// 2. 测试 updateAllOrganizationStates (集成测试) - 验证 hasBasicShortage 是否正确计算
console.log('\n--- 测试用例 2: updateAllOrganizationStates 集成测试 ---');

// Mock 数据
const organizationStates = {
    cleric: { ...currentState }
};
const classApproval = { cleric: 20 };
const classInfluence = { cleric: 50 };
const totalInfluence = 1000;
const stability = 50;
const currentDay = 100;
const promiseTasks = [];
const classShortages = {
    cleric: [
        { resource: 'food', reason: 'unaffordable' } // 这里有基础需求短缺
    ]
};
const options = {
    classIncome: { cleric: 100 },
    classExpense: { cleric: 200 },
    popStructure: { cleric: 100 },
    taxPolicies: {},
    market: { prices: {} },
    classLivingStandard: { cleric: { level: '赤贫' } },
    livingStandardStreaks: {},
    epoch: 0
};

// 我们无法直接mock organizationSystem.js 内部引用的 STRATA 和 RESOURCES。
// 但是 organizationSystem.js 实际上是从 '../config/strata' 和 '../config' 导入的。
// 在 node 环境下运行此脚本，这些导入会失败，除非我们有 module loader hook 或者文件确实存在且无其他依赖。
// 之前的报错说明它尝试导入但失败了。

// 既然如此，我们直接把 organizationSystem.js 里的 buildDriverContext 逻辑复制出来测试，或者仅仅依靠刚才的单元测试。
// 鉴于我们已经确认 updateStratumOrganization 逻辑本身（如果 hasBasicShortage 传对的话），
// 现在的关键是 buildDriverContext 是否正确识别了 classShortages。

// 让我们手动复制 simulation.js 里生成 shortages 的逻辑片段来验证"用户看到的现象"：
// 用户说：粮食、布料、纸张、美酒 买不起。
// 这意味着 classShortages['cleric'] 应该包含这些。

// 假设 simulation.js 正确生成了 classShortages（用户描述看到的现象通常是UI上的表现，而UI通常源自 state）。
// 如果 UI 显示买不起，那么 shortages 数组里肯定有东西。

// 关键问题：organizationSystem.js 的 buildDriverContext 是否正确解析了这个 shortages 数组？
// 让我们看 organizationSystem.js 的源码 (第 177-191 行):
/*
    const basicShortages = [];
    const luxuryShortages = [];
    shortages.forEach(entry => {
        if (!entry || !entry.resource) return;
        const resourceKey = entry.resource;
        if (luxuryNeedsSet.has(resourceKey)) {
            luxuryShortages.push(entry);
            return;
        }
        if (basicNeedsSet.has(resourceKey)) {
            basicShortages.push(entry);
            return;
        }
        luxuryShortages.push(entry);
    });
*/

// 这里依赖 STRATA[stratumKey].needs (basicNeedsSet)。
// 如果 papyrus (纸张) 和 ale (美酒) 被定义在 luxuryNeeds 里而不是 needs 里，
// 那么它们就会被分到 luxuryShortages，从而 hasBasicShortage = false (如果只有这些短缺的话)。

// 让我就这个假设进行验证：
// 检查 STRATA.cleric 的 needs 定义。

console.log('检查 Cleric 需求定义...');
// 这里只是打印 log，实际需要我去 view_file 确认 strata.js 的 cleric 定义。
