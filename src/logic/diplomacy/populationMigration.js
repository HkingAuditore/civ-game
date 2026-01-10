/**
 * 人口流动系统
 * 处理国家间的人口流动：经济移民、战争难民、政治流亡
 * 
 * 时代解锁：
 * - economic_migration: Era 3 (封建时代)
 * - war_refugees: Era 2 (古典时代)
 * - political_exile: Era 4 (探索时代)
 */

import { isDiplomacyUnlocked } from '../../config/diplomacy';

// 人口流动配置
export const MIGRATION_CONFIGS = {
    economic_migration: {
        name: '经济移民',
        description: '人口从低收入国家流向高收入国家',
        minEra: 3,
        // 触发条件：收入差距
        trigger: 'income_gap',
        // 每月基础迁移比例（占来源国人口）
        baseMonthlyRate: 0.002, // 0.2%
        // 移民的阶层权重
        stratumWeights: {
            worker: 0.35,
            peasant: 0.25,
            artisan: 0.20,
            merchant: 0.10,
            engineer: 0.05,
            official: 0.05,
        },
    },
    war_refugees: {
        name: '战争难民',
        description: '战争期间人口逃往和平国家',
        minEra: 2,
        trigger: 'war',
        // 每月基础迁移比例（战争期间持续流出）
        baseMonthlyRate: 0.01, // 1%
        stratumWeights: {
            peasant: 0.40,
            worker: 0.30,
            artisan: 0.15,
            merchant: 0.10,
            capitalist: 0.05,
        },
    },
    political_exile: {
        name: '政治流亡',
        description: '政治迫害导致精英阶层出逃',
        minEra: 4,
        trigger: 'low_approval',
        baseMonthlyRate: 0.003, // 0.3%
        stratumWeights: {
            official: 0.25,
            merchant: 0.20,
            capitalist: 0.20,
            engineer: 0.15,
            artisan: 0.10,
            scribe: 0.10,
        },
        // 触发阈值：阶层满意度低于此值
        approvalThreshold: 25,
    },
};

/**
 * 计算两国之间的收入差距
 * @param {Object} sourceNation - 来源国家
 * @param {Object} targetNation - 目标国家 (玩家)
 * @param {Object} playerResources - 玩家资源
 * @returns {number} 差距系数 (正数表示玩家更富裕)
 */
export const calculateIncomeGap = (sourceNation, targetNation, playerResources) => {
    const sourceWealth = sourceNation?.wealth || 1000;
    const targetWealth = playerResources?.silver || 1000;
    
    // 计算人均财富
    const sourcePerCapita = sourceWealth / Math.max(1, sourceNation?.population || 1000);
    const targetPerCapita = targetWealth / Math.max(1, targetNation?.population || 1000);
    
    // 返回差距系数
    return (targetPerCapita - sourcePerCapita) / Math.max(sourcePerCapita, 1);
};

/**
 * 检查是否满足经济移民条件
 * @param {Object} nation - 来源国家
 * @param {number} incomeGap - 收入差距
 * @returns {boolean}
 */
export const canEconomicMigrate = (nation, incomeGap, epoch) => {
    if (!isDiplomacyUnlocked('migration', 'economic_migration', epoch)) return false;
    if (nation.isAtWar) return false;
    if (nation.vassalOf === 'player') return false; // 附庸国不独立迁移
    
    // 收入差距超过50%才触发
    return incomeGap > 0.5;
};

/**
 * 检查是否满足战争难民条件
 * @param {Object} nation - 来源国家
 * @returns {boolean}
 */
export const canWarRefugee = (nation, epoch) => {
    if (!isDiplomacyUnlocked('migration', 'war_refugees', epoch)) return false;
    
    // 该国处于战争状态且不是与玩家交战
    return nation.isAtWar && !nation.isAtWar;
};

/**
 * 检查是否满足政治流亡条件
 * @param {Object} nation - 来源国家
 * @param {Object} classApproval - 玩家国阶层满意度
 * @returns {{ canExile: boolean, exileFrom: 'foreign' | 'domestic', stratum?: string }}
 */
export const canPoliticalExile = (nation, classApproval, epoch) => {
    if (!isDiplomacyUnlocked('migration', 'political_exile', epoch)) {
        return { canExile: false };
    }
    
    const threshold = MIGRATION_CONFIGS.political_exile.approvalThreshold;
    
    // 检查外国政治迫害（简化：满意度低）
    // 外国精英可能流入玩家国
    const foreignUnstable = (nation.socialStructure?.elites?.satisfaction || 50) < 40;
    if (foreignUnstable && !nation.isAtWar) {
        return { canExile: true, exileFrom: 'foreign' };
    }
    
    // 检查本国政治迫害（玩家国阶层满意度过低）
    for (const [stratum, approval] of Object.entries(classApproval || {})) {
        if (approval < threshold) {
            return { canExile: true, exileFrom: 'domestic', stratum };
        }
    }
    
    return { canExile: false };
};

/**
 * 计算单次移民人口数量
 * @param {string} migrationType - 移民类型
 * @param {Object} sourceNation - 来源国家
 * @param {number} modifier - 修正系数
 * @returns {{ totalMigrants: number, byStratum: Object }}
 */
export const calculateMigrationAmount = (migrationType, sourceNation, modifier = 1.0) => {
    const config = MIGRATION_CONFIGS[migrationType];
    if (!config) return { totalMigrants: 0, byStratum: {} };
    
    const sourcePopulation = sourceNation?.population || 1000;
    const totalMigrants = Math.floor(sourcePopulation * config.baseMonthlyRate * modifier);
    
    // 按阶层分配
    const byStratum = {};
    let remaining = totalMigrants;
    
    for (const [stratum, weight] of Object.entries(config.stratumWeights)) {
        const count = Math.floor(totalMigrants * weight);
        if (count > 0) {
            byStratum[stratum] = count;
            remaining -= count;
        }
    }
    
    // 剩余分配给权重最高的阶层
    if (remaining > 0) {
        const topStratum = Object.keys(config.stratumWeights)[0];
        byStratum[topStratum] = (byStratum[topStratum] || 0) + remaining;
    }
    
    return { totalMigrants, byStratum };
};

/**
 * 处理月度人口迁移
 * @param {Object} params - 参数
 * @returns {Object} 迁移结果
 */
export const processMonthlyMigration = ({
    nations,
    epoch,
    playerPopulation,
    playerResources,
    classApproval,
    daysElapsed,
}) => {
    const results = {
        immigrantsIn: 0,
        emigrantsOut: 0,
        byType: {
            economic_migration: { in: 0, out: 0 },
            war_refugees: { in: 0, out: 0 },
            political_exile: { in: 0, out: 0 },
        },
        byStratum: {},
        events: [],
    };
    
    if (!Array.isArray(nations)) return results;
    
    // 处理每个国家
    for (const nation of nations) {
        if (!nation || nation.id === 'player') continue;
        
        // 1. 经济移民：从贫穷国家流入
        const incomeGap = calculateIncomeGap(nation, { population: playerPopulation }, playerResources);
        if (canEconomicMigrate(nation, incomeGap, epoch)) {
            const modifier = Math.min(2.0, Math.max(0.5, incomeGap)); // 收入差距修正
            const migration = calculateMigrationAmount('economic_migration', nation, modifier);
            
            if (migration.totalMigrants > 0) {
                results.immigrantsIn += migration.totalMigrants;
                results.byType.economic_migration.in += migration.totalMigrants;
                
                for (const [stratum, count] of Object.entries(migration.byStratum)) {
                    results.byStratum[stratum] = (results.byStratum[stratum] || 0) + count;
                }
                
                results.events.push({
                    type: 'economic_migration',
                    sourceNation: nation.name,
                    amount: migration.totalMigrants,
                    day: daysElapsed,
                });
            }
        }
        
        // 2. 战争难民：从战争国家流入
        // 如果外国之间有战争（非与玩家），难民可能流入
        if (nation.foreignWars && nation.foreignWars.length > 0) {
            if (isDiplomacyUnlocked('migration', 'war_refugees', epoch)) {
                const migration = calculateMigrationAmount('war_refugees', nation, 0.5);
                
                if (migration.totalMigrants > 0) {
                    results.immigrantsIn += migration.totalMigrants;
                    results.byType.war_refugees.in += migration.totalMigrants;
                    
                    for (const [stratum, count] of Object.entries(migration.byStratum)) {
                        results.byStratum[stratum] = (results.byStratum[stratum] || 0) + count;
                    }
                    
                    results.events.push({
                        type: 'war_refugees',
                        sourceNation: nation.name,
                        amount: migration.totalMigrants,
                        day: daysElapsed,
                    });
                }
            }
        }
        
        // 3. 政治流亡：精英阶层流入
        const exileCheck = canPoliticalExile(nation, classApproval, epoch);
        if (exileCheck.canExile && exileCheck.exileFrom === 'foreign') {
            const migration = calculateMigrationAmount('political_exile', nation, 0.3);
            
            if (migration.totalMigrants > 0) {
                results.immigrantsIn += migration.totalMigrants;
                results.byType.political_exile.in += migration.totalMigrants;
                
                for (const [stratum, count] of Object.entries(migration.byStratum)) {
                    results.byStratum[stratum] = (results.byStratum[stratum] || 0) + count;
                }
                
                results.events.push({
                    type: 'political_exile',
                    sourceNation: nation.name,
                    amount: migration.totalMigrants,
                    day: daysElapsed,
                });
            }
        }
    }
    
    // 4. 处理玩家国人口外流（政治流亡出境）
    const domesticExile = canPoliticalExile({}, classApproval, epoch);
    if (domesticExile.canExile && domesticExile.exileFrom === 'domestic') {
        // 满意度极低的阶层人口外流
        const stratum = domesticExile.stratum;
        const approval = classApproval?.[stratum] || 50;
        const severity = (25 - approval) / 25; // 满意度越低，外流越多
        
        const emigrantCount = Math.floor(playerPopulation * 0.001 * severity);
        if (emigrantCount > 0) {
            results.emigrantsOut += emigrantCount;
            results.byType.political_exile.out += emigrantCount;
            results.byStratum[stratum] = (results.byStratum[stratum] || 0) - emigrantCount;
            
            results.events.push({
                type: 'political_exile',
                direction: 'out',
                stratum,
                amount: emigrantCount,
                day: daysElapsed,
            });
        }
    }
    
    return results;
};

/**
 * 应用移民结果到人口结构
 * @param {Object} popStructure - 当前人口结构
 * @param {Object} migrationByStratum - 按阶层的移民数量
 * @param {number} population - 当前总人口
 * @returns {Object} 新的人口结构
 */
export const applyMigrationToPopStructure = (popStructure, migrationByStratum, population) => {
    if (!popStructure || !migrationByStratum) return popStructure;
    
    const newStructure = { ...popStructure };
    const totalMigration = Object.values(migrationByStratum).reduce((sum, v) => sum + v, 0);
    
    if (totalMigration === 0 || population === 0) return newStructure;
    
    for (const [stratum, count] of Object.entries(migrationByStratum)) {
        if (newStructure[stratum] !== undefined && typeof newStructure[stratum] === 'number') {
            const currentCount = Math.floor(newStructure[stratum] * population);
            const newCount = currentCount + count;
            // 更新比例
            newStructure[stratum] = Math.max(0, newCount / (population + totalMigration));
        }
    }
    
    // 重新归一化
    const total = Object.values(newStructure).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    if (total > 0) {
        for (const key of Object.keys(newStructure)) {
            if (typeof newStructure[key] === 'number') {
                newStructure[key] /= total;
            }
        }
    }
    
    return newStructure;
};

/**
 * 生成移民事件日志
 * @param {Array} migrationEvents - 移民事件列表
 * @returns {Array} 日志消息列表
 */
export const generateMigrationLogs = (migrationEvents) => {
    if (!Array.isArray(migrationEvents) || migrationEvents.length === 0) return [];
    
    const logs = [];
    const typeLabels = {
        economic_migration: '经济移民',
        war_refugees: '战争难民',
        political_exile: '政治流亡',
    };
    
    for (const event of migrationEvents) {
        const label = typeLabels[event.type] || event.type;
        if (event.direction === 'out') {
            logs.push(`📤 ${label}：${event.amount}名${event.stratum || ''}人口移居海外`);
        } else {
            logs.push(`📥 ${label}：${event.amount}人从${event.sourceNation}移入`);
        }
    }
    
    return logs;
};
