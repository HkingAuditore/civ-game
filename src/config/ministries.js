// 尚书省（六部）配置
// 定义各部尚书的职责、加成效果和自动建设逻辑

// 官职名称演变配置
const MINISTRY_NAMES = {
    agriculture: {
        0: '治粟内史', // 原始/青铜
        1: '治粟内史',
        2: '大司农',   // 古典
        3: '户部尚书', // 封建
        4: '农务大臣', // 探索
        5: '农务大臣', // 启蒙
        6: '农林总长', // 工业
        7: '农业部长', // 信息
    },
    industry: {
        0: '司空',
        1: '司空',
        2: '将作大匠',
        3: '工部尚书',
        4: '工部总办',
        5: '工部总办',
        6: '实业总长',
        7: '工业部长',
    },
    commerce: {
        0: '司市',
        1: '司市',
        2: '少府',
        3: '转运使',
        4: '通商大臣',
        5: '通商大臣',
        6: '工商总长',
        7: '商务部长',
    },
    municipal: {
        0: '内史',
        1: '内史',
        2: '京兆尹',
        3: '顺天府尹',
        4: '巡警部尚书',
        5: '巡警部尚书',
        6: '内务总长',
        7: '建设部长',
    },
    military: {
        0: '司马',
        1: '司马',
        2: '太尉',
        3: '兵部尚书',
        4: '军机大臣',
        5: '军机大臣',
        6: '陆军总长',
        7: '国防部长',
    },
    diplomacy: {
        0: '行人',
        1: '行人',
        2: '大鸿胪',
        3: '礼部尚书',
        4: '总理各国大臣',
        5: '总理各国大臣',
        6: '外交总长',
        7: '外交部长',
    },
};

/**
 * 获取指定时代的官职名称
 * @param {string} ministryId 部门ID
 * @param {number} epoch 时代ID
 * @returns {string} 官职名称
 */
export const getMinistryName = (ministryId, epoch = 0) => {
    const names = MINISTRY_NAMES[ministryId];
    if (!names) return '大臣';
    // 向下兼容：如果当前时代没有定义，尝试找上一个时代的，直到找到为止
    for (let e = epoch; e >= 0; e--) {
        if (names[e]) return names[e];
    }
    return names[0] || '大臣';
};

export const MINISTRIES = {
    agriculture: {
        id: 'agriculture',
        defaultName: '户部尚书 (农业)', // Fallback
        description: '负责土地、户籍与赋税。主管农业发展与粮食储备。',
        icon: 'Wheat',
        color: 'text-amber-600',
        allowedAttributes: ['admin', 'management'], // 影响效果的属性
        effectDescription: '提升农业产出，根据粮食供需自动扩建农田。',
        autoBuild: {
            category: 'gather', // 关注采集类
            resourceFocus: ['food', 'wood', 'cotton'], // 关注的资源
            budgetRatio: 0.2, // 每次自动建设最大使用国库比例
        },
        bonuses: {
            // 基础加成 (每点属性)
            production: 0.01, // 农业产出 +1%
        }
    },
    industry: {
        id: 'industry',
        defaultName: '工部尚书 (工业)',
        description: '负责工程、营造与屯田。主管工业制造与基础设施。',
        icon: 'Hammer',
        color: 'text-orange-600',
        allowedAttributes: ['intelligence', 'management'],
        effectDescription: '提升工业产出，根据工业品供需自动扩建工厂。',
        autoBuild: {
            category: 'industry', // 关注工业类
            resourceFocus: ['tools', 'bricks', 'steel', 'cloth'],
            budgetRatio: 0.25,
        },
        bonuses: {
            production: 0.01, // 工业产出 +1%
            constructionSpeed: 0.01, // 建造速度(暂未实装，可作为预留)
        }
    },
    commerce: {
        id: 'commerce',
        defaultName: '度支尚书 (商业)',
        description: '负责财政收支与贸易流通。主管商业贸易。',
        icon: 'Coins',
        color: 'text-yellow-600',
        allowedAttributes: ['charm', 'management'],
        effectDescription: '提升贸易收入，自动扩建市场与商贸设施。',
        autoBuild: {
            targetBuildings: ['market', 'bank', 'port'], // 指定建筑
            budgetRatio: 0.3,
        },
        bonuses: {
            tradeRevenue: 0.01, // 贸易收入 +1%
            taxEfficiency: 0.005, // 税收效率 +0.5%
        }
    },
    municipal: {
        id: 'municipal',
        defaultName: '都官尚书 (市政)',
        description: '负责刑狱与治安。主管城市设施与民心稳定。',
        icon: 'Landmark',
        color: 'text-blue-600',
        allowedAttributes: ['admin', 'charm'],
        effectDescription: '提升城市人口容量与稳定度，自动扩建住宅与公共设施。',
        autoBuild: {
            category: 'civic', // 关注市政类
            budgetRatio: 0.15,
        },
        bonuses: {
            stability: 0.5, // 稳定度 +0.5
            maxPop: 0.01,   // 人口上限 +1%
        }
    },
    military: {
        id: 'military',
        defaultName: '兵部尚书 (军事)',
        description: '负责武选、地图与甲胄。主管军队训练与国防。',
        icon: 'Swords',
        color: 'text-red-600',
        allowedAttributes: ['command', 'bravery'],
        effectDescription: '提升军队战斗力与训练速度，自动扩建兵营。',
        autoBuild: {
            targetBuildings: ['barracks', 'archery_range', 'stable'],
            budgetRatio: 0.2,
        },
        bonuses: {
            combatPower: 0.01, // 战斗力 +1%
            recruitSpeed: 0.01, // 招募速度(预留)
        }
    },
    diplomacy: {
        id: 'diplomacy',
        defaultName: '礼部尚书 (外交)',
        description: '负责礼仪、祭祀与贡举。主管外交关系与科举。',
        icon: 'Scroll',
        color: 'text-purple-600',
        allowedAttributes: ['charm', 'intelligence'],
        effectDescription: '提升外交关系改善速度与条约成功率。',
        autoBuild: null, // 外交大臣不负责建设
        bonuses: {
            relationGain: 0.02, // 关系提升速度 +2%
            negotiationChance: 0.01, // 谈判成功率 +1%
        }
    }
};
