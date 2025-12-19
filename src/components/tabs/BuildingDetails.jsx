import React, { useState, useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA, EPOCHS } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { getPublicAssetUrl } from '../../utils/assetPath';
import { getBuildingImageUrl } from '../../utils/imageRegistry';
import { BuildingUpgradePanel } from './BuildingUpgradePanel';
import { getBuildingEffectiveConfig } from '../../config/buildingUpgrades';
import { canBuildingUpgrade } from '../../utils/buildingUpgradeUtils';

// 最低工资下限
const MIN_ROLE_WAGE = 0.1;

/**
 * 获取角色的市场工资（直接从 market.wages 获取）
 * 这是 simulation.js 计算后的真实平均工资
 */
const getMarketWage = (role, market = {}) => {
    const wageFromMarket = market?.wages?.[role];
    if (Number.isFinite(wageFromMarket) && wageFromMarket > 0) {
        return wageFromMarket;
    }
    // Fallback: 使用阶层起始财富估算
    const starting = STRATA[role]?.startingWealth;
    if (Number.isFinite(starting) && starting > 0) {
        return Math.max(MIN_ROLE_WAGE, starting / 40);
    }
    return MIN_ROLE_WAGE;
};

/**
 * 计算建筑当前所有级别的加权平均收入
 * 雇员收入 = market.wages[role]
 * 业主收入 = (产出价值 - 投入成本 - 营业税 - 其他雇员工资) / 业主岗位数
 * @param {Object} building - 建筑配置
 * @param {number} count - 建筑数量
 * @param {Object} upgradeLevels - 各建筑实例的升级等级 {0: 1, 1: 0, 2: 2, ...}
 * @param {Object} market - 市场数据
 * @param {Object} taxPolicies - 税收政策
 * @returns {Object} 各角色的加权平均收入 {role: { avgIncome, isOwner }}
 */
const calculateBuildingAverageIncomes = (building, count, upgradeLevels = {}, market = {}, taxPolicies = {}) => {
    if (!building || count <= 0) return {};

    const ownerKey = building?.owner;
    const getResourcePrice = (key) => {
        if (!key || key === 'silver') return 1;
        return market?.prices?.[key] ?? (RESOURCES[key]?.basePrice || 0);
    };

    // 统计各等级建筑数量
    const levelCounts = {};
    for (let i = 0; i < count; i++) {
        const lvl = upgradeLevels[i] || 0;
        levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    }

    // 计算每个角色在各等级的总岗位数和总收入
    const roleStats = {}; // { role: { totalSlots: number, totalIncome: number, isOwner: boolean } }

    for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
        const lvl = parseInt(lvlStr);
        const config = getBuildingEffectiveConfig(building, lvl);
        const jobs = config.jobs || {};

        // 计算该等级每座建筑的产出价值和投入成本
        const outputValue = Object.entries(config.output || {}).reduce(
            (sum, [res, val]) => sum + getResourcePrice(res) * val, 0
        );
        const inputValue = Object.entries(config.input || {}).reduce(
            (sum, [res, val]) => sum + getResourcePrice(res) * val, 0
        );

        // 营业税
        const businessTaxMultiplier = taxPolicies?.businessTaxRates?.[building.id] ?? 1;
        const businessTaxBase = building.businessTaxBase ?? 0.1;
        const businessTax = businessTaxBase * businessTaxMultiplier;

        // 计算非业主雇员的工资总和
        let nonOwnerWageCost = 0;
        for (const [role, slotsPerBuilding] of Object.entries(jobs)) {
            if (!Number.isFinite(slotsPerBuilding) || slotsPerBuilding <= 0) continue;
            if (role === ownerKey) continue; // 跳过业主
            const wage = getMarketWage(role, market);
            nonOwnerWageCost += wage * slotsPerBuilding;
        }

        // 业主每座建筑的利润 = 产出 - 投入 - 营业税 - 其他雇员工资
        const ownerProfitPerBuilding = outputValue - inputValue - businessTax - nonOwnerWageCost;
        const ownerSlots = jobs[ownerKey] || 0;
        const ownerIncomePerSlot = ownerSlots > 0 ? ownerProfitPerBuilding / ownerSlots : 0;

        for (const [role, slotsPerBuilding] of Object.entries(jobs)) {
            if (!Number.isFinite(slotsPerBuilding) || slotsPerBuilding <= 0) continue;

            const totalSlotsAtLevel = slotsPerBuilding * lvlCount;
            const isOwner = role === ownerKey;
            const incomePerSlot = isOwner ? ownerIncomePerSlot : getMarketWage(role, market);

            if (!roleStats[role]) {
                roleStats[role] = { totalSlots: 0, totalIncome: 0, isOwner };
            }
            roleStats[role].totalSlots += totalSlotsAtLevel;
            roleStats[role].totalIncome += incomePerSlot * totalSlotsAtLevel;
        }
    }

    // 计算加权平均
    const result = {};
    for (const [role, stats] of Object.entries(roleStats)) {
        if (stats.totalSlots > 0) {
            result[role] = {
                avgIncome: stats.totalIncome / stats.totalSlots,
                isOwner: stats.isOwner
            };
        }
    }

    return result;
};

/**
 * 建筑沉浸式英雄图片组件
 * 图片作为背景，标题和图标叠加在上面
 */
const BuildingHeroImage = ({ building, hasImage, onImageLoad, onImageError }) => {
    const imagePath = getBuildingImageUrl(building.id)
        ?? getPublicAssetUrl(`images/buildings/${building.id}.webp`);

    return (
        <div className="relative w-full h-44 mb-4 rounded-xl overflow-hidden">
            {/* 背景图片 */}
            <img
                src={imagePath}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${hasImage ? 'opacity-100' : 'opacity-0'}`}
                style={{ minWidth: '100%', minHeight: '100%' }}
                onLoad={onImageLoad}
                onError={onImageError}
                loading="lazy"
            />

            {/* 底部渐变蒙版 */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent z-[1]" />

            {/* 边缘柔化暗角 */}
            <div className="absolute inset-0 z-[1]" style={{
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(17,24,39,0.6) 100%)'
            }} />

            {/* 叠加在图片上的标题区域 */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-[2]">
                <div className="flex items-end gap-3">
                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl ${building.visual.color} flex items-center justify-center shadow-xl border border-white/20 backdrop-blur-sm icon-metal-container`}>
                        <Icon name={building.visual.icon} size={28} className={`${building.visual.text} icon-metal drop-shadow-lg`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white leading-tight font-decorative drop-shadow-lg">
                            {building.name}
                        </h3>
                        {building.owner && (
                            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-yellow-200 bg-yellow-900/60 border border-yellow-600/40 rounded-full px-2.5 py-0.5 backdrop-blur-sm">
                                <Icon name="User" size={10} />
                                <span className="font-semibold">业主: {STRATA[building.owner]?.name || building.owner}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 装饰性边框 */}
            <div className="absolute inset-0 rounded-xl border border-gray-600/30 z-[3] pointer-events-none" />
        </div>
    );
};

/**
 * 详情面板中的信息区块
 * @param {string} title - 区块标题
 * @param {string} icon - 标题图标
 * @param {React.ReactNode} children - 内容
 * @param {string} [className] - 附加样式
 */
const DetailSection = ({ title, icon, children, className = '' }) => (
    <div className={`bg-gray-900/50 p-3 rounded-lg border border-gray-700/80 ${className}`}>
        <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5 font-decorative">
            <Icon name={icon} size={16} />
            {title}
        </h4>
        <div className="space-y-1 text-xs">{children}</div>
    </div>
);

/**
 * 用于显示键值对信息
 * @param {string} label - 标签
 * @param {string|number} value - 值
 * @param {string} valueClass - 值的CSS类
 */
const InfoRow = ({ label, value, valueClass = 'text-white' }) => (
    <div className="flex justify-between items-center py-0.5">
        <span className="text-gray-300">{label}</span>
        <span className={`font-mono font-semibold ${valueClass}`}>{value}</span>
    </div>
);

const formatResourceAmount = (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) return (abs / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return (abs / 1000).toFixed(1) + 'k';
    if (abs >= 10) return abs.toFixed(1);
    if (abs === Math.floor(abs)) return abs.toString();
    return abs.toFixed(2);
};

const ResourceSummaryBadge = ({ label, amount, positive }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${positive ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-200' : 'bg-rose-900/30 border-rose-600/40 text-rose-200'}`}>
        <span>{label}</span>
        <span className="font-mono">
            {positive ? '+' : '-'}
            {formatResourceAmount(amount)}
        </span>
    </span>
);

const StatCard = ({ label, icon, value, valueClass = 'text-white' }) => (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700/80 px-3 py-2 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
            {icon && <Icon name={icon} size={11} className="text-gray-400" />}
            {label}
        </span>
        <span className={`text-lg font-bold font-mono ${valueClass}`}>
            {value}
        </span>
    </div>
);

/**
 * 建筑详情组件
 * 在 BottomSheet 或 Modal 中显示
 * @param {Object} building - 建筑数据
 * @param {Object} gameState - 完整的游戏状态
 */
const formatCompactCost = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 10000) return (value / 1000).toFixed(0) + 'k';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
    return Math.floor(value).toString();
};

export const BuildingDetails = ({ building, gameState, onBuy, onSell, onUpgrade, onDowngrade, onBatchUpgrade, onBatchDowngrade, taxPolicies, onUpdateTaxPolicies }) => {
    if (!building || !gameState) return null;

    const { resources, epoch, market, buildings, buildingUpgrades, jobFill } = gameState;
    const count = buildings[building.id] || 0;
    const upgradeLevels = buildingUpgrades?.[building.id] || {};

    // 计算升级后的聚合效果（总值）和平均值
    const { effectiveTotalStats, averageBuilding } = useMemo(() => {
        const upgradeData = upgradeLevels || {};
        const effectiveOps = { input: {}, output: {}, jobs: {} };
        const levelCounts = {};

        // 统计各等级建筑数量
        let hasUpgrades = false;
        for (let i = 0; i < count; i++) {
            const lvl = upgradeData[i] || 0;
            if (lvl > 0) hasUpgrades = true;
            levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
        }

        if (!hasUpgrades && levelCounts[0] === count) {
            // 快速路径：无升级，总值为 基础 * count
            const totalStats = {
                input: Object.fromEntries(Object.entries(building.input || {}).map(([k, v]) => [k, v * count])),
                output: Object.fromEntries(Object.entries(building.output || {}).map(([k, v]) => [k, v * count])),
                jobs: Object.fromEntries(Object.entries(building.jobs || {}).map(([k, v]) => [k, v * count]))
            };
            return { effectiveTotalStats: totalStats, averageBuilding: building };
        }

        // 聚合计算
        for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
            const lvl = parseInt(lvlStr);
            const config = getBuildingEffectiveConfig(building, lvl);

            if (config.input) for (const [k, v] of Object.entries(config.input)) effectiveOps.input[k] = (effectiveOps.input[k] || 0) + v * lvlCount;
            if (config.output) for (const [k, v] of Object.entries(config.output)) effectiveOps.output[k] = (effectiveOps.output[k] || 0) + v * lvlCount;
            if (config.jobs) for (const [k, v] of Object.entries(config.jobs)) effectiveOps.jobs[k] = (effectiveOps.jobs[k] || 0) + v * lvlCount;
        }

        // 计算平均值
        const avg = { ...building, input: {}, output: {}, jobs: {} };
        if (count > 0) {
            for (const [k, v] of Object.entries(effectiveOps.input)) avg.input[k] = v / count;
            for (const [k, v] of Object.entries(effectiveOps.output)) avg.output[k] = v / count;
            for (const [k, v] of Object.entries(effectiveOps.jobs)) avg.jobs[k] = v / count;
        } else {
            // 如果数量为0，平均值显示基础值
            avg.input = building.input;
            avg.output = building.output;
            avg.jobs = building.jobs;
        }

        return { effectiveTotalStats: effectiveOps, averageBuilding: avg };
    }, [building, count, upgradeLevels]);

    const [draftMultiplier, setDraftMultiplier] = useState(null);

    // 图片加载状态管理
    const [hasImage, setHasImage] = useState(false);
    const [imageError, setImageError] = useState(false);

    // 使用 ref 追踪上一个建筑对象引用
    const prevBuildingRef = React.useRef(null);

    // 当建筑对象引用变化时重置图片状态
    if (prevBuildingRef.current !== building) {
        prevBuildingRef.current = building;
        if (hasImage || imageError) {
            setHasImage(false);
            setImageError(false);
        }
    }

    // --- 复用计算逻辑 ---
    // --- 复用 BuildTab 中的计算逻辑 ---
    const getResourcePrice = (key) => {
        if (!key || key === 'silver') return 1;
        return market?.prices?.[key] ?? (RESOURCES[key]?.basePrice || 0);
    };

    const getOwnerIncomePerBuilding = (b) => {
        const outputValue = Object.entries(b.output || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val, 0);
        const inputValue = Object.entries(b.input || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val, 0);
        const wageCost = Object.entries(b.jobs || {}).reduce((sum, [job, perBuilding]) => sum + (market?.wages?.[job] || 0) * perBuilding, 0);
        return outputValue - inputValue - wageCost;
    };

    // 修改：计算业主的“人均收入”
    const getOwnerPerCapitaIncome = (b) => {
        const profit = getOwnerIncomePerBuilding(b); // 这是纯利润
        let ownerWagesPerBuilding = 0;
        let ownerWorkersPerBuilding = 1; // 默认为1，防止除以0

        if (b.owner && b.jobs?.[b.owner]) {
            ownerWorkersPerBuilding = b.jobs[b.owner];
            ownerWagesPerBuilding = (market?.wages?.[b.owner] || 0) * ownerWorkersPerBuilding;
        }

        const totalIncomePerBuilding = profit + ownerWagesPerBuilding;
        return totalIncomePerBuilding / ownerWorkersPerBuilding;
    };

    const calculateCost = (b) => {
        const currentCount = buildings[b.id] || 0;
        const cost = {};
        for (let k in b.baseCost) {
            cost[k] = Math.ceil(b.baseCost[k] * Math.pow(1.15, currentCount));
        }
        return cost;
    };

    const nextCost = calculateCost(building);
    const nextSilverCost = calculateSilverCost(nextCost, market);
    const hasMaterials = Object.entries(nextCost).every(([res, val]) => (resources[res] || 0) >= val);
    const hasSilver = (resources.silver || 0) >= nextSilverCost;
    const canAffordNext = hasMaterials && hasSilver;

    const compactSilverCost = formatCompactCost(nextSilverCost);

    const totalJobSlots = Object.values(effectiveTotalStats.jobs || {}).reduce((sum, val) => sum + val, 0);
    const totalJobsFilled = Object.entries(effectiveTotalStats.jobs || {}).reduce((sum, [role, required]) => {
        const filled = jobFill?.[building.id]?.[role] ?? 0;
        return sum + Math.min(required, filled);
    }, 0);
    const jobFillRate = totalJobSlots > 0 ? (totalJobsFilled / totalJobSlots) * 100 : 0;

    // 获取实际产出/投入数据（包含科技和事件加成）
    const supplyBreakdown = market?.supplyBreakdown || {};
    const demandBreakdown = market?.demandBreakdown || {};

    // 获取加成来源数据
    const modifierSources = market?.modifiers?.sources || {};
    const techsUnlocked = gameState.techsUnlocked || [];
    const activeBuffs = gameState.activeBuffs || [];
    const activeDebuffs = gameState.activeDebuffs || [];

    // 计算建筑的各项加成（使用加法叠加，与 simulation.js 完全一致）
    const getBuildingModifiers = (b) => {
        const modList = [];
        let bonusSum = 0;  // 累加百分比加成

        // 1. 时代加成
        const currentEpoch = EPOCHS[epoch] || {};
        if (currentEpoch.bonuses) {
            if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
                const pct = currentEpoch.bonuses.gatherBonus;
                bonusSum += pct;
                modList.push({ label: '时代加成', pct });
            }
            if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
                const pct = currentEpoch.bonuses.industryBonus;
                bonusSum += pct;
                modList.push({ label: '时代加成', pct });
            }
        }

        // 2. 全局生产/工业 modifier（来自 buff/debuff）
        let productionPct = 0;
        let industryPct = 0;
        activeBuffs.forEach(buff => {
            if (buff.production) productionPct += buff.production;
            if (buff.industryBonus) industryPct += buff.industryBonus;
        });
        activeDebuffs.forEach(debuff => {
            if (debuff.production) productionPct += debuff.production;
            if (debuff.industryBonus) industryPct += debuff.industryBonus;
        });
        // 政令加成
        const productionBonus = modifierSources.productionBonus || 0;
        const industryBonus = modifierSources.industryBonus || 0;
        productionPct += productionBonus;
        industryPct += industryBonus;

        if ((b.cat === 'gather' || b.cat === 'civic') && productionPct !== 0) {
            bonusSum += productionPct;
            modList.push({ label: '生产修正', pct: productionPct });
        }
        if (b.cat === 'industry' && industryPct !== 0) {
            bonusSum += industryPct;
            modList.push({ label: '工业修正', pct: industryPct });
        }

        // 3. 类别加成 - 来自科技（现在直接存储加成百分比，如 0.25 = +25%）
        const techCategoryBonus = modifierSources.techCategoryBonus?.[b.cat] || 0;
        if (techCategoryBonus !== 0) {
            bonusSum += techCategoryBonus;
            modList.push({ label: '类别科技', pct: techCategoryBonus });
        }

        // 4. 事件加成
        const eventBuildingMod = modifierSources.eventBuildingProduction?.[b.id] || 0;
        const eventCategoryMod = modifierSources.eventBuildingProduction?.[b.cat] || 0;
        const eventAllMod = modifierSources.eventBuildingProduction?.['all'] || 0;
        if (eventBuildingMod !== 0) {
            bonusSum += eventBuildingMod;
            modList.push({ label: '事件(建筑)', pct: eventBuildingMod });
        }
        if (eventCategoryMod !== 0) {
            bonusSum += eventCategoryMod;
            modList.push({ label: '事件(类别)', pct: eventCategoryMod });
        }
        if (eventAllMod !== 0) {
            bonusSum += eventAllMod;
            modList.push({ label: '事件(全局)', pct: eventAllMod });
        }

        // 5. 建筑特定科技加成（现在直接存储加成百分比，如 0.25 = +25%）
        const techBuildingBonus = modifierSources.techBuildingBonus?.[b.id] || 0;
        if (techBuildingBonus !== 0) {
            bonusSum += techBuildingBonus;
            modList.push({ label: '科技(建筑)', pct: techBuildingBonus });
        }

        const totalMultiplier = 1 + bonusSum;
        return { totalMultiplier: parseFloat(totalMultiplier.toFixed(4)), bonusSum, modList, hasBonus: modList.length > 0 };
    };

    const buildingModifiers = getBuildingModifiers(building);

    // 计算实际产出（优先使用 supplyBreakdown 中的数据，包含加成）
    const totalOutputs = Object.entries(effectiveTotalStats.output || {}).map(([resKey, baseAmount]) => {
        const actualAmount = supplyBreakdown[resKey]?.buildings?.[building.id] ?? baseAmount;
        const hasBonus = actualAmount !== baseAmount && actualAmount > 0;
        return [resKey, actualAmount, baseAmount, hasBonus];
    }).filter(([, amount]) => amount > 0);

    // 计算实际投入（优先使用 demandBreakdown 中的数据）
    const totalInputs = Object.entries(effectiveTotalStats.input || {}).map(([resKey, baseAmount]) => {
        const actualAmount = demandBreakdown[resKey]?.buildings?.[building.id] ?? baseAmount;
        return [resKey, actualAmount, baseAmount];
    }).filter(([, amount]) => amount > 0);
    // 计算当前建筑所有级别的加权平均收入（区分业主和雇员）
    const buildingAvgIncomes = useMemo(() => {
        return calculateBuildingAverageIncomes(building, count, upgradeLevels, market, taxPolicies);
    }, [building, count, upgradeLevels, market, taxPolicies]);

    const jobBreakdown = useMemo(() => {
        const ownerKey = building?.owner;

        // 使用当前建筑的加权平均收入（所有级别的平均）
        // 业主收入 = (产出 - 投入 - 营业税 - 其他雇员工资) / 业主岗位数
        // 雇员收入 = market.wages[role]

        return Object.entries(effectiveTotalStats.jobs || {}).map(([role, required]) => {
            const filled = Math.min(jobFill?.[building.id]?.[role] ?? 0, required);
            const fillPercent = required > 0 ? (filled / required) * 100 : 0;
            const isOwner = role === ownerKey;

            // 使用当前建筑的加权平均收入
            const incomeData = buildingAvgIncomes[role];
            const actualIncome = incomeData?.avgIncome;
            const displayIncome = Number.isFinite(actualIncome)
                ? actualIncome
                : getMarketWage(role, market);

            return {
                role,
                required,
                filled,
                fillPercent,
                name: STRATA[role]?.name || role,
                actualIncome: parseFloat(displayIncome.toFixed(2)),
                isOwner
            };
        }).sort((a, b) => b.required - a.required);
    }, [effectiveTotalStats, jobFill, building, market, buildingAvgIncomes]);

    // 营业税逻辑
    const businessTaxMultiplier = taxPolicies?.businessTaxRates?.[building.id] ?? 1;
    const businessTaxBase = building.businessTaxBase ?? 0.1;
    const actualBusinessTax = businessTaxBase * businessTaxMultiplier;

    const handleDraftChange = (raw) => {
        setDraftMultiplier(raw);
    };

    const commitDraft = () => {
        if (draftMultiplier === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftMultiplier);
        const numeric = Number.isNaN(parsed) ? 1 : parsed; // 如果输入无效，重置为1
        onUpdateTaxPolicies(prev => ({
            ...prev,
            businessTaxRates: { ...(prev?.businessTaxRates || {}), [building.id]: numeric },
        }));
        setDraftMultiplier(null);
    };
    return (
        <div className="space-y-4">
            {/* 沉浸式英雄区块 - 当有图片时显示，标题叠加在图片上 */}
            {!imageError && (
                <BuildingHeroImage
                    building={building}
                    hasImage={hasImage}
                    onImageLoad={() => setHasImage(true)}
                    onImageError={() => setImageError(true)}
                />
            )}

            {/* 传统头部 - 仅当图片加载失败时显示 */}
            {imageError && (
                <div className="flex items-start gap-4 p-1">
                    <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${building.visual.color} flex items-center justify-center icon-metal-container icon-metal-container-lg`}>
                        <Icon name={building.visual.icon} size={36} className={`${building.visual.text} icon-metal`} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white font-decorative">{building.name}</h3>
                        <p className="text-sm text-gray-300 mt-1">{building.desc}</p>
                        {building.owner && (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-yellow-200 bg-yellow-900/40 border border-yellow-600/40 rounded-full px-2.5 py-1">
                                <Icon name="User" size={12} />
                                <span className="font-semibold">业主: {STRATA[building.owner]?.name || building.owner}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 建筑描述 - 当有沉浸式图片时单独显示描述 */}
            {!imageError && (
                <p className="text-sm text-gray-300 px-1">{building.desc}</p>
            )}

            {/* 营业税调整 */}
            {onUpdateTaxPolicies && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/80">
                    <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5 font-decorative">
                        <Icon name="Sliders" size={16} className="text-yellow-400" />
                        营业税调整
                    </h4>
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <div>
                            <div className="text-[10px] text-gray-400 mb-0.5 leading-none">税率系数</div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentValue = parseFloat(draftMultiplier ?? businessTaxMultiplier);
                                        const newValue = isNaN(currentValue) ? -1 : -currentValue;
                                        handleDraftChange(String(newValue));
                                        // 直接提交
                                        onUpdateTaxPolicies(prev => ({
                                            ...prev,
                                            businessTaxRates: { ...(prev?.businessTaxRates || {}), [building.id]: newValue },
                                        }));
                                        setDraftMultiplier(null);
                                    }}
                                    className="btn-compact flex-shrink-0 w-6 h-6 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[10px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                                    title="切换正负值（税收/补贴）"
                                >
                                    ±
                                </button>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    step="0.05"
                                    value={draftMultiplier ?? businessTaxMultiplier}
                                    onChange={(e) => handleDraftChange(e.target.value)}
                                    onBlur={commitDraft}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            commitDraft();
                                            e.target.blur();
                                        }
                                    }}
                                    className="flex-grow min-w-0 bg-gray-800/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                    placeholder="税率系数"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400 mb-0.5 leading-none">实际税额 (每次产出)</div>
                            <div className="bg-gray-800/50 rounded px-2 py-1.5 text-center">
                                <span className={`text-sm font-bold font-mono ${actualBusinessTax > 0 ? 'text-yellow-300' : actualBusinessTax < 0 ? 'text-green-300' : 'text-gray-400'
                                    }`}>
                                    {actualBusinessTax < 0 ? '补贴 ' : ''}{Math.abs(actualBusinessTax).toFixed(3)}
                                </span>
                                <Icon
                                    name={actualBusinessTax > 0 ? "TrendingUp" : actualBusinessTax < 0 ? "TrendingDown" : "Coins"}
                                    size={12}
                                    className={`inline-block ml-1 ${actualBusinessTax > 0 ? 'text-yellow-400' : actualBusinessTax < 0 ? 'text-green-400' : 'text-gray-500'}`}
                                />
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">
                        实际税额 = 建筑基准税额({businessTaxBase.toFixed(2)}) × 税率系数。负数系数代表补贴。
                    </p>
                </div>
            )}

            <DetailSection title="当前运行概览" icon="Activity">
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <StatCard label="已拥有" icon="Home" value={count} />
                    <StatCard
                        label="到岗率"
                        icon="Users"
                        value={`${jobFillRate.toFixed(0)}%`}
                        valueClass={jobFillRate >= 80 ? 'text-emerald-300' : jobFillRate >= 50 ? 'text-yellow-300' : 'text-red-300'}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                        <div className="text-[10px] uppercase text-emerald-300 mb-1 tracking-wide flex items-center gap-1">
                            总产出
                            {totalOutputs.some(([, , , hasBonus]) => hasBonus) && (
                                <span className="text-amber-400" title="包含科技/事件加成">★</span>
                            )}
                        </div>
                        {totalOutputs.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {totalOutputs.map(([resKey, amount, baseAmount, hasBonus]) => (
                                    <span
                                        key={`total-out-${resKey}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-900/30 border-emerald-600/40 text-emerald-200"
                                        title={hasBonus ? `基础: ${formatResourceAmount(baseAmount)} / 实际: ${formatResourceAmount(amount)}` : undefined}
                                    >
                                        <span>{RESOURCES[resKey]?.name || resKey}</span>
                                        <span className="font-mono">
                                            +{formatResourceAmount(amount)}
                                            {hasBonus && <span className="text-amber-400 ml-0.5">★</span>}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-gray-500">暂无产出</p>
                        )}
                    </div>
                    <div>
                        <div className="text-[10px] uppercase text-rose-300 mb-1 tracking-wide">总投入</div>
                        {totalInputs.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {totalInputs.map(([resKey, amount]) => (
                                    <ResourceSummaryBadge
                                        key={`total-in-${resKey}`}
                                        label={RESOURCES[resKey]?.name || resKey}
                                        amount={amount}
                                        positive={false}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-gray-500">无需额外投入</p>
                        )}
                    </div>
                </div>

                {/* 生产加成明细 */}
                {buildingModifiers.hasBonus && (
                    <div className="mb-3 p-2 rounded-lg bg-amber-900/10 border border-amber-600/30">
                        <div className="text-[10px] uppercase text-amber-300/80 mb-1.5 tracking-wide flex items-center gap-1">
                            <Icon name="Zap" size={10} className="text-amber-400" />
                            生产加成明细
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {buildingModifiers.modList.map((mod, idx) => (
                                <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${mod.pct >= 0
                                        ? 'bg-amber-900/30 border-amber-500/40 text-amber-200'
                                        : 'bg-rose-900/30 border-rose-500/40 text-rose-200'
                                        }`}
                                >
                                    <span>{mod.label}</span>
                                    <span className={`font-mono ${mod.pct >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>
                                        {mod.pct >= 0 ? '+' : ''}{(mod.pct * 100).toFixed(0)}%
                                    </span>
                                </span>
                            ))}
                            {buildingModifiers.modList.length > 0 && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${buildingModifiers.bonusSum >= 0
                                    ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200'
                                    : 'bg-rose-900/30 border-rose-500/40 text-rose-200'
                                    }`}>
                                    <span>累计</span>
                                    <span className={`font-mono ${buildingModifiers.bonusSum >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                        {buildingModifiers.bonusSum >= 0 ? '+' : ''}{(buildingModifiers.bonusSum * 100).toFixed(0)}%
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {jobBreakdown.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-[10px] uppercase text-gray-400 tracking-wide">岗位明细</div>
                {jobBreakdown.map(({ role, name, required, filled, fillPercent, actualIncome, isOwner }) => (
                            <div key={role} className="bg-gray-900/40 border border-gray-700/70 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between text-xs text-gray-200">
                                    <span className="flex items-center gap-1">
                                        {name}
                                        {isOwner && (
                                            <span className="text-[9px] text-amber-400 bg-amber-900/40 px-1 py-0.5 rounded">业主</span>
                                        )}
                                    </span>
                                    <span className="font-mono text-gray-300">
                                        {Math.round(filled)}/{Math.round(required)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                    <div>
                                        <span className="mr-2">总岗位 {Math.round(required)}</span>
                                        <span>实到 {Math.round(filled)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Icon name="Wallet" size={10} className={isOwner ? 'text-amber-400' : 'text-yellow-400'} />
                                        <span className={`font-mono font-semibold ${actualIncome < 0 ? 'text-red-400' : isOwner ? 'text-amber-300' : 'text-yellow-300'}`}>
                                            {actualIncome.toFixed(2)}
                                        </span>
                                        <Icon name="Coins" size={10} className="text-yellow-200" />
                                    </div>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, fillPercent)}%` }} />
                                </div>
                            </div>
                        ))}
                        <p className="text-[9px] text-gray-600 mt-1">
                            💡 业主收入 = (产出-投入-营业税-雇员工资)/岗位数；雇员收入 = 市场工资
                        </p>
                    </div>
                )}
            </DetailSection>

            <DetailSection title="下一座建造成本" icon="ShoppingCart">
                <p className="text-[11px] text-gray-400 mb-2">
                    需要先采购/支付下列资源与资金才能建造下一座建筑：
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(nextCost).map(([res, val]) => {
                        const hasEnough = (resources[res] || 0) >= val;
                        return (
                            <InfoRow
                                key={res}
                                label={RESOURCES[res]?.name || res}
                                value={`${val}`}
                                valueClass={hasEnough ? 'text-green-400' : 'text-red-400'}
                            />
                        );
                    })}
                </div>
                <div className="pt-2 mt-2 border-t border-gray-700/60">
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-gray-300 flex items-center gap-1.5">
                            <Icon name="Coins" size={14} className="text-yellow-400" /> 预计市场花费
                        </span>
                        <span className={`font-mono font-semibold ${hasSilver ? 'text-green-400' : 'text-red-400'}`}>
                            {formatSilverCost(nextSilverCost)}
                        </span>
                    </div>
                    {!canAffordNext && (
                        <p className="text-[10px] text-gray-500 mt-1">
                            当前库存或银币不足，需先从市场购入缺口资源。
                        </p>
                    )}
                </div>
            </DetailSection>

            {/* 建筑升级面板 */}
            {count > 0 && canBuildingUpgrade(building.id) && (
                <BuildingUpgradePanel
                    building={building}
                    count={count}
                    epoch={epoch}
                    upgradeLevels={upgradeLevels}
                    resources={resources}
                    market={market}
                    taxPolicies={taxPolicies}
                    onUpgrade={(instanceIndex) => onUpgrade?.(building.id, instanceIndex)}
                    onDowngrade={(instanceIndex) => onDowngrade?.(building.id, instanceIndex)}
                    onBatchUpgrade={(fromLevel, upgradeCount) => onBatchUpgrade?.(building.id, fromLevel, upgradeCount)}
                    onBatchDowngrade={(fromLevel, downgradeCount) => onBatchDowngrade?.(building.id, fromLevel, downgradeCount)}
                />
            )}

            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                    onClick={() => onBuy && onBuy(building.id)}
                    disabled={!canAffordNext}
                    className="w-full px-4 py-3 rounded-lg text-xs sm:text-sm font-bold transition-all bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/30 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                    <Icon name="Plus" size={16} />
                    <div className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-1 leading-tight whitespace-nowrap sm:whitespace-normal">
                        <span className="tracking-wide">建造</span>
                        <span className="font-mono text-[11px] sm:text-sm opacity-90 flex items-center gap-0.5">
                            <span className="inline-flex items-center gap-0.5 sm:hidden">
                                <Icon name="Coins" size={10} className="text-yellow-300" />
                                {compactSilverCost}
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-0.5">
                                <Icon name="Coins" size={12} className="text-yellow-300" />
                                ({formatSilverCost(nextSilverCost)})
                            </span>
                        </span>
                    </div>
                </button>

                {count > 0 && (
                    <button
                        onClick={() => onSell && onSell(building.id)}
                        className="w-full px-4 py-3 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-red-600/30 flex items-center justify-center gap-2"
                    >
                        <Icon name="Minus" size={16} />
                        <span>拆除</span>
                    </button>
                )}
            </div>
        </div>
    );
};
