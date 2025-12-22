/**
 * 执政联盟面板组件
 * 允许玩家选择与哪些阶层联合执政
 */

import React from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config';
import {
    getLegitimacyLevel,
    getLegitimacyLevelInfo,
    getEligibleCoalitionStrata,
    LEGITIMACY_THRESHOLD,
    calculateLegitimacy, // 用于实时计算合法性
    getLegitimacyTaxModifier, // 税收修正
    getLegitimacyOrganizationModifier, // 组织度增长修正
    getLegitimacyApprovalModifier, // 满意度修正
    COALITION_SENSITIVITY, // 联盟阶层敏感度配置
} from '../../logic/rulingCoalition';

// 阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'knight', 'engineer'],
    },
    middle: {
        name: '中产阶级',
        keys: ['artisan', 'soldier', 'cleric', 'scribe', 'navigator'],
    },
    lower: {
        name: '下层阶级',
        keys: ['peasant', 'serf', 'lumberjack', 'worker', 'miner'],
    },
};

// 阶层分类定义（用于政体判断）
const STRATA_CATEGORIES = {
    // 传统贵族/精英阶层
    aristocracy: ['landowner', 'knight', 'official'],
    // 资产阶级
    bourgeoisie: ['capitalist', 'merchant', 'engineer'],
    // 工农阶级
    proletariat: ['worker', 'miner', 'peasant', 'serf', 'lumberjack'],
    // 军事阶层
    military: ['soldier', 'knight'],
    // 宗教阶层
    clerical: ['cleric'],
    // 知识阶层
    intellectual: ['scribe', 'engineer'],
    // 商业阶层
    commercial: ['merchant', 'navigator'],
    // 农业阶层
    agrarian: ['peasant', 'serf', 'landowner', 'lumberjack'],
    // 工业阶层
    industrial: ['worker', 'artisan', 'capitalist', 'engineer', 'miner'],
};

/**
 * 获取政体描述词
 * @param {string[]} coalition - 联盟成员阶层键数组
 * @param {Object} classInfluence - 各阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @returns {Object} { name: 政体名称, description: 描述, icon: 图标, color: 颜色 }
 */
const getGovernmentType = (coalition, classInfluence, totalInfluence) => {
    if (coalition.length === 0) {
        return {
            name: '无执政联盟',
            description: '尚未建立执政联盟，政府缺乏社会基础',
            icon: 'HelpCircle',
            color: 'text-gray-400',
        };
    }

    // 计算联盟内各分类的影响力占比
    const getCategoryInfluence = (category) => {
        let influence = 0;
        STRATA_CATEGORIES[category].forEach(stratum => {
            if (coalition.includes(stratum)) {
                influence += classInfluence[stratum] || 0;
            }
        });
        return influence;
    };

    // 计算联盟总影响力
    let coalitionTotalInfluence = 0;
    coalition.forEach(key => {
        coalitionTotalInfluence += classInfluence[key] || 0;
    });

    // 计算各分类在联盟中的占比
    const getShare = (category) => {
        if (coalitionTotalInfluence <= 0) return 0;
        return getCategoryInfluence(category) / coalitionTotalInfluence;
    };

    const aristocracyShare = getShare('aristocracy');
    const bourgeoisieShare = getShare('bourgeoisie');
    const proletariatShare = getShare('proletariat');
    const militaryShare = getShare('military');
    const clericalShare = getShare('clerical');
    const commercialShare = getShare('commercial');
    const agrarianShare = getShare('agrarian');
    const industrialShare = getShare('industrial');

    // 计算联盟成员数量
    const memberCount = coalition.length;

    // 检查特定阶层是否在联盟中
    const hasStratum = (key) => coalition.includes(key);

    // 政体判断逻辑（按优先级）

    // 1. 单一阶层执政 - 特殊政体
    if (memberCount === 1) {
        const singleMember = coalition[0];
        const singleGovernments = {
            landowner: { name: '封建地主专制', description: '由大地主阶级独揽政权', icon: 'Castle', color: 'text-amber-500' },
            capitalist: { name: '垄断资本独裁', description: '资本家独占国家权力', icon: 'Briefcase', color: 'text-blue-400' },
            knight: { name: '军事贵族专政', description: '骑士阶层掌控一切', icon: 'Shield', color: 'text-red-500' },
            official: { name: '官僚集权', description: '官僚阶层垄断政权', icon: 'ScrollText', color: 'text-purple-400' },
            merchant: { name: '商业寡头政治', description: '商人阶层掌控国家', icon: 'Coins', color: 'text-yellow-400' },
            cleric: { name: '神权政治', description: '神职人员统治国家', icon: 'Cross', color: 'text-indigo-400' },
            soldier: { name: '军人专政', description: '军队独揽大权', icon: 'Swords', color: 'text-red-400' },
            worker: { name: '工人无产阶级专政', description: '工人阶级独揽政权', icon: 'Hammer', color: 'text-red-600' },
            peasant: { name: '农民专政', description: '农民阶级掌控政权', icon: 'Wheat', color: 'text-green-500' },
            engineer: { name: '技术官僚政治', description: '工程师主导国家', icon: 'Cog', color: 'text-cyan-400' },
            scribe: { name: '学者治国', description: '知识分子掌权', icon: 'Feather', color: 'text-blue-300' },
            artisan: { name: '行会共和', description: '工匠行会主政', icon: 'Anvil', color: 'text-orange-400' },
            navigator: { name: '海上共和国', description: '航海家主导政权', icon: 'Compass', color: 'text-teal-400' },
            miner: { name: '矿业工人政权', description: '矿工阶级执政', icon: 'Pickaxe', color: 'text-gray-400' },
            serf: { name: '农奴起义政权', description: '佃农阶级执政', icon: 'Users', color: 'text-brown-400' },
            lumberjack: { name: '林业工人政权', description: '樵夫阶级执政', icon: 'Trees', color: 'text-green-600' },
        };
        return singleGovernments[singleMember] || { name: '独裁政体', description: '单一阶层执政', icon: 'Crown', color: 'text-amber-400' };
    }

    // 2. 特定组合政体
    // 工农联盟
    if (hasStratum('worker') && hasStratum('peasant') && proletariatShare >= 0.7) {
        if (memberCount === 2) {
            return { name: '工农联合政府', description: '工人和农民阶级联合执政', icon: 'Handshake', color: 'text-red-500' };
        }
        return { name: '人民民主专政', description: '以工农联盟为基础的人民政权', icon: 'Users', color: 'text-red-600' };
    }

    // 资产阶级民主（资本家+商人）
    if (bourgeoisieShare >= 0.6 && !hasStratum('landowner') && !hasStratum('knight')) {
        if (hasStratum('worker') || hasStratum('artisan')) {
            return { name: '资产阶级共和国', description: '资产阶级主导的民主政体', icon: 'Building2', color: 'text-blue-400' };
        }
        return { name: '资本主义寡头政治', description: '资产阶级独占政权', icon: 'Briefcase', color: 'text-blue-500' };
    }

    // 贵族联盟
    if (aristocracyShare >= 0.6) {
        if (hasStratum('cleric')) {
            return { name: '封建神权联盟', description: '传统贵族与教会联合执政', icon: 'Crown', color: 'text-purple-500' };
        }
        return { name: '贵族寡头政治', description: '传统贵族阶层联合执政', icon: 'Castle', color: 'text-amber-500' };
    }

    // 军政府
    if (militaryShare >= 0.5) {
        if (hasStratum('capitalist') || hasStratum('landowner')) {
            return { name: '军事-精英联盟', description: '军队与精英阶层联合执政', icon: 'Shield', color: 'text-red-500' };
        }
        return { name: '军人政府', description: '军事力量主导的政权', icon: 'Swords', color: 'text-red-600' };
    }

    // 3. 大联盟政体
    if (memberCount >= 5) {
        // 全民政府（包含上中下各阶层）
        const hasUpper = coalition.some(k => STRATA_GROUPS.upper.keys.includes(k));
        const hasMiddle = coalition.some(k => STRATA_GROUPS.middle.keys.includes(k));
        const hasLower = coalition.some(k => STRATA_GROUPS.lower.keys.includes(k));

        if (hasUpper && hasMiddle && hasLower) {
            if (memberCount >= 8) {
                return { name: '全民联合政府', description: '跨越阶级的广泛联盟', icon: 'Globe', color: 'text-green-400' };
            }
            return { name: '民族团结政府', description: '各阶层联合执政', icon: 'Users', color: 'text-teal-400' };
        }

        if (proletariatShare >= 0.5) {
            return { name: '人民阵线', description: '以劳动阶层为主体的广泛联盟', icon: 'Flag', color: 'text-red-500' };
        }

        return { name: '大联盟政府', description: '多阶层联合执政', icon: 'Users', color: 'text-blue-400' };
    }

    // 4. 按主导阶层分类的政体
    // 工业主导
    if (industrialShare >= 0.6) {
        if (hasStratum('capitalist')) {
            return { name: '工业资本主义政府', description: '工业资产阶级主导', icon: 'Factory', color: 'text-blue-500' };
        }
        if (hasStratum('worker') && hasStratum('artisan')) {
            return { name: '劳工联合政府', description: '工业劳动者联合执政', icon: 'Hammer', color: 'text-orange-500' };
        }
    }

    // 农业主导
    if (agrarianShare >= 0.6) {
        if (hasStratum('landowner') && proletariatShare > 0) {
            return { name: '地主-农民联盟', description: '农村阶层联合执政', icon: 'Wheat', color: 'text-green-500' };
        }
        if (proletariatShare >= 0.5) {
            return { name: '农民政府', description: '农民阶级主导政权', icon: 'Wheat', color: 'text-green-600' };
        }
    }

    // 商业主导
    if (commercialShare >= 0.5) {
        return { name: '商业共和国', description: '商业阶层主导政权', icon: 'Ship', color: 'text-teal-400' };
    }

    // 知识分子主导
    if (hasStratum('scribe') && hasStratum('engineer')) {
        return { name: '技术精英政府', description: '知识分子联合执政', icon: 'GraduationCap', color: 'text-cyan-400' };
    }

    // 5. 按阶层数量和成分的通用分类
    if (proletariatShare >= 0.7) {
        return { name: '无产阶级政府', description: '劳动人民掌握政权', icon: 'Hammer', color: 'text-red-500' };
    }

    if (bourgeoisieShare + aristocracyShare >= 0.7) {
        return { name: '精英联盟政府', description: '上层阶级联合执政', icon: 'Crown', color: 'text-amber-400' };
    }

    // 6. 默认政体
    if (memberCount === 2) {
        return { name: '双头政治', description: '两个阶层联合执政', icon: 'Scale', color: 'text-gray-400' };
    }

    if (memberCount === 3) {
        return { name: '三方联盟', description: '三个阶层共同执政', icon: 'Triangle', color: 'text-gray-400' };
    }

    return { name: '联合政府', description: '多阶层联合执政', icon: 'Users', color: 'text-gray-400' };
};

/**
 * 执政联盟面板
 * @param {Object} props
 * @param {string[]} props.rulingCoalition - 当前联盟成员阶层键数组
 * @param {Function} props.onUpdateCoalition - 更新联盟回调函数
 * @param {Object} props.classInfluence - 各阶层影响力
 * @param {number} props.totalInfluence - 总影响力
 * @param {number} props.legitimacy - 当前合法性值
 * @param {Object} props.popStructure - 人口结构
 */
export const CoalitionPanel = ({
    rulingCoalition = [],
    onUpdateCoalition,
    classInfluence = {},
    totalInfluence = 0,
    legitimacy = 0,
    popStructure = {},
    classApproval = {}, // 新增：各阶层满意度
}) => {
    // 获取可选阶层
    const eligibleStrata = getEligibleCoalitionStrata(popStructure);

    // 计算联盟总影响力占比
    const coalitionInfluenceShare = React.useMemo(() => {
        if (totalInfluence <= 0) return 0;
        let share = 0;
        rulingCoalition.forEach(key => {
            share += classInfluence[key] || 0;
        });
        return share / totalInfluence;
    }, [rulingCoalition, classInfluence, totalInfluence]);

    // 计算政体描述词
    const governmentType = React.useMemo(() => {
        return getGovernmentType(rulingCoalition, classInfluence, totalInfluence);
    }, [rulingCoalition, classInfluence, totalInfluence]);

    // 实时计算合法性值和等级（不依赖传入的 legitimacy，暂停时也能更新）
    const realTimeLegitimacy = React.useMemo(() => {
        return calculateLegitimacy(coalitionInfluenceShare, {
            classApproval,
            coalitionMembers: rulingCoalition,
            classInfluence,
        });
    }, [coalitionInfluenceShare, classApproval, rulingCoalition, classInfluence]);

    // 实时计算税收修正和组织度修正
    const taxModifier = React.useMemo(() => {
        return getLegitimacyTaxModifier(realTimeLegitimacy);
    }, [realTimeLegitimacy]);

    const orgModifier = React.useMemo(() => {
        // 非联盟阶层的组织度增长修正
        return getLegitimacyOrganizationModifier(realTimeLegitimacy, false);
    }, [realTimeLegitimacy]);

    // 获取合法性等级信息（基于实时计算值）
    const legitimacyLevel = getLegitimacyLevel(realTimeLegitimacy);
    const legitimacyInfo = getLegitimacyLevelInfo(legitimacyLevel);

    // 满意度修正（非法政府惩罚）
    const approvalModifier = React.useMemo(() => {
        return getLegitimacyApprovalModifier(realTimeLegitimacy);
    }, [realTimeLegitimacy]);

    // 计算联盟成员加权平均满意度和满意度因子
    const { avgCoalitionApproval, approvalLegitimacyFactor } = React.useMemo(() => {
        if (rulingCoalition.length === 0) {
            return { avgCoalitionApproval: 50, approvalLegitimacyFactor: 1.0 };
        }
        let totalWeight = 0;
        let weightedApproval = 0;
        rulingCoalition.forEach(key => {
            const approval = classApproval[key] ?? 50;
            const influence = classInfluence[key] || 1;
            weightedApproval += approval * influence;
            totalWeight += influence;
        });
        const avg = totalWeight > 0 ? weightedApproval / totalWeight : 50;
        const factor = avg < 50 ? (0.5 + avg / 100) : 1.0;
        return { avgCoalitionApproval: avg, approvalLegitimacyFactor: factor };
    }, [rulingCoalition, classApproval, classInfluence]);

    // 切换阶层联盟状态
    const toggleCoalitionMember = (stratumKey) => {
        if (!onUpdateCoalition) return;

        if (rulingCoalition.includes(stratumKey)) {
            // 移除
            onUpdateCoalition(rulingCoalition.filter(k => k !== stratumKey));
        } else {
            // 添加
            onUpdateCoalition([...rulingCoalition, stratumKey]);
        }
    };

    // 渲染单个阶层选择卡片
    const renderStratumCard = (stratumKey) => {
        const stratum = STRATA[stratumKey];
        if (!stratum) return null;

        const isSelected = rulingCoalition.includes(stratumKey);
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? (influence / totalInfluence * 100).toFixed(1) : '0.0';
        const population = popStructure[stratumKey] || 0;

        return (
            <button
                key={stratumKey}
                onClick={() => toggleCoalitionMember(stratumKey)}
                className={`
                    relative p-2 rounded-lg border transition-all cursor-pointer
                    ${isSelected
                        ? 'bg-amber-900/30 border-amber-500/50 ring-1 ring-amber-400/30'
                        : 'bg-gray-900/30 border-gray-700/50 hover:border-gray-600'
                    }
                `}
            >
                {/* 选中指示器 */}
                {isSelected && (
                    <div className="absolute top-1 right-1">
                        <Icon name="Check" size={12} className="text-amber-400" />
                    </div>
                )}

                {/* 阶层信息 */}
                <div className="flex items-center gap-2 mb-1">
                    <Icon name={stratum.icon || 'User'} size={16} className={isSelected ? 'text-amber-400' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                        {stratum.name}
                    </span>
                </div>

                {/* 影响力和人口 */}
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>影响力 {influenceShare}%</span>
                    <span>{population.toLocaleString()}人</span>
                </div>
            </button>
        );
    };

    // 渲染阶层组
    const renderStrataGroup = (groupKey, group) => {
        const groupStrata = group.keys.filter(k => eligibleStrata.includes(k));
        if (groupStrata.length === 0) return null;

        return (
            <div key={groupKey} className="mb-3">
                <h5 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    {group.name}
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {groupStrata.map(key => renderStratumCard(key))}
                </div>
            </div>
        );
    };

    return (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30 mb-4">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Users" size={16} className="text-amber-400" />
                    执政联盟
                </h3>

                {/* 合法性状态徽章 */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${legitimacyInfo.bgColor} border ${legitimacyInfo.borderColor}`}>
                    <Icon name={legitimacyInfo.icon} size={14} className={legitimacyInfo.color} />
                    <span className={`text-xs font-semibold ${legitimacyInfo.color}`}>
                        {legitimacyInfo.name}
                    </span>
                </div>
            </div>

            {/* 政体描述词徽章 */}
            <div className="mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2">
                    <Icon name={governmentType.icon} size={18} className={governmentType.color} />
                    <div className="flex-1">
                        <div className={`text-sm font-bold ${governmentType.color}`}>
                            {governmentType.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            {governmentType.description}
                        </div>
                    </div>
                    {rulingCoalition.length > 0 && (
                        <div className="text-[10px] text-gray-500 bg-gray-900/50 px-1.5 py-0.5 rounded">
                            {rulingCoalition.length}个阶层
                        </div>
                    )}
                </div>
            </div>

            {/* 合法性说明 */}
            <div className="mb-3 p-2 bg-gray-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">联盟影响力</span>
                    <span className={`text-sm font-bold ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>
                        {(coalitionInfluenceShare * 100).toFixed(1)}%
                    </span>
                </div>

                {/* 进度条 */}
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                        style={{ width: `${Math.min(100, coalitionInfluenceShare * 100)}%` }}
                    />
                    {/* 40%阈值标记 */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                        style={{ left: `${LEGITIMACY_THRESHOLD * 100}%` }}
                    />
                </div>

                <p className="text-[10px] text-gray-500 mt-1">
                    {legitimacyInfo.description}
                </p>

                {/* 合法性效果显示 */}
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    {/* 合法性数值 - 突出显示 */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600/30">
                        <span className="text-sm font-bold text-gray-300">政府合法性</span>
                        <span className={`text-lg font-bold ${legitimacyInfo.color}`}>
                            {realTimeLegitimacy.toFixed(0)}
                        </span>
                    </div>

                    {/* 数据区域 - 联盟满意度相关 */}
                    {rulingCoalition.length > 0 && (
                        <div className="mb-2">
                            <div className="text-[9px] text-gray-500 mb-1">数据</div>
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Heart" size={10} className="text-pink-400" />联盟满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className={`text-xs font-bold ${avgCoalitionApproval >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                    {avgCoalitionApproval.toFixed(0)}
                                </span>
                            </div>
                            {approvalLegitimacyFactor < 1 && (
                                <div className="flex items-center py-0.5">
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                        <Icon name="TrendingDown" size={10} className="text-red-400" />满意度对合法性的影响
                                    </span>
                                    <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                    <span className="text-xs font-bold text-red-400">
                                        ×{approvalLegitimacyFactor.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 效果区域 */}
                    <div>
                        <div className="text-[9px] text-gray-500 mb-1">效果</div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Coins" size={10} className="text-yellow-400" />税收效率
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${taxModifier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(taxModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Users" size={10} className="text-orange-400" />在野阶层组织度变化修正
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${orgModifier <= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(orgModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        {approvalModifier !== 0 && (
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Frown" size={10} className="text-red-400" />全民满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className="text-xs font-bold text-red-400">
                                    {approvalModifier}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 阶层选择网格 */}
            <div className="space-y-2">
                {Object.entries(STRATA_GROUPS).map(([key, group]) => renderStrataGroup(key, group))}
            </div>

            {/* 警告提示 */}
            {rulingCoalition.length > 0 && (
                <div className="mt-3 p-2 bg-amber-900/20 rounded-lg border border-amber-700/30">
                    <div className="flex items-start gap-2">
                        <Icon name="AlertTriangle" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-[10px] text-amber-300/80">
                            <p className="font-semibold mb-1">联盟代价：</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
                                <li>提高叛乱组织度增速：<span className="text-red-400">+50%</span>（联盟阶层掌握更多政治权利，更容易组织叛乱）</li>
                                <li>降低叛乱门槛：<span className="text-red-400">无视低影响力阶层无法叛乱的限制</span></li>
                                <li>更难以接受高税负：税负占比的不满阈值{(COALITION_SENSITIVITY.TAX_THRESHOLD_NORMAL * 100).toFixed(0)}% → <span className="text-red-400">{(COALITION_SENSITIVITY.TAX_THRESHOLD_COALITION * 100).toFixed(0)}%</span></li>
                                <li>需要更高的预期收入：预期收入×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_NORMAL.toFixed(2)} → <span className="text-red-400">×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_COALITION.toFixed(2)}</span></li>
                                <li>基础物资短缺将造成更多不满：{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                                <li>奢侈品短缺将造成更多不满：{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
