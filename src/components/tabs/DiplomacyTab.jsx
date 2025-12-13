// 外交标签页
// 展示国家状态、贸易套利与和平谈判

import React, { useMemo, useState, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { Modal } from '../common/UnifiedUI';
import { DeclareWarModal } from '../modals/DeclareWarModal';
import TradeRoutesModal from '../modals/TradeRoutesModal';
import { RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { calculateDynamicGiftCost } from '../../utils/diplomaticUtils';

const relationInfo = (relation = 0, isAllied = false) => {
    // 如果是正式盟友，显示盟友标签
    if (isAllied) return { label: '盟友', color: 'text-green-300', bg: 'bg-green-900/20' };
    // 否则根据关系值显示
    if (relation >= 80) return { label: '亲密', color: 'text-emerald-300', bg: 'bg-emerald-900/20' };
    if (relation >= 60) return { label: '友好', color: 'text-blue-300', bg: 'bg-blue-900/20' };
    if (relation >= 40) return { label: '中立', color: 'text-gray-300', bg: 'bg-gray-800/40' };
    if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300', bg: 'bg-yellow-900/20' };
    return { label: '敌对', color: 'text-red-300', bg: 'bg-red-900/20' };
};

/**
 * Calculate max trade routes allowed with a nation based on relation and alliance
 * @param {number} relation - Relation value (0-100)
 * @param {boolean} isAllied - Whether formally allied with this nation
 * @returns {number} Max trade routes allowed
 */
const getMaxTradeRoutesForRelation = (relation = 0, isAllied = false) => {
    if (isAllied) return 5; // Formal alliance: 5 routes
    if (relation >= 80) return 4; // Very friendly: 4 routes
    if (relation >= 60) return 3; // Friendly: 3 routes
    if (relation >= 40) return 2; // Neutral: 2 routes
    if (relation >= 20) return 1; // Cold: 1 route
    return 0; // Hostile: no trade
};

/**
 * Get count of trade routes with a specific nation
 * @param {Array} routes - All trade routes
 * @param {string} nationId - Target nation ID
 * @returns {number} Number of routes with this nation
 */
const getRouteCountWithNation = (routes = [], nationId) => {
    return routes.filter(r => r.nationId === nationId).length;
};

const formatStatValue = (value, unit = '') => {
    if (!Number.isFinite(value)) return `未知${unit}`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${unit}`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K${unit}`;
    return `${Math.max(0, Math.floor(value))}${unit}`;
};

// 动态送礼成本将在组件内根据双方财富计算

const getPreferredResources = (nation) => {
    if (!nation?.economyTraits?.resourceBias) return [];
    return Object.entries(nation.economyTraits.resourceBias)
        .filter(([, bias]) => bias > 1.05)
        .sort((a, b) => b[1] - a[1])
        .map(([key, bias]) => ({
            key,
            bias,
            name: RESOURCES[key]?.name || key,
            icon: RESOURCES[key]?.icon || 'Box',
            color: RESOURCES[key]?.color || 'text-gray-300',
        }));
};

const CULTURAL_TRAIT_LABELS = {
    // --- 适应与生存 ---
    adaptability: '环境适应力',      // 比“适应性”更有生命力
    austereLiving: '清苦自律',       // 对应斯巴达/斯多葛学派，比“简朴生活”更有哲学感
    resourcefulSurvival: '绝境求生', // 体现利用有限资源的智慧
    frontierSpirit: '开拓精神',      // 对应美国边疆历史
    sacrificialCulture: '血祭传统',  // “献祭”略显中性，阿兹特克风格通常带血腥色彩

    // --- 军事与战争 ---
    ageRegiments: '年龄组兵制',      // 对应祖鲁 Impi 的同龄兵团制度
    bushidoCode: '武士道',
    cavalryTradition: '骑术传统',
    conquistadorSpirit: '征服者',    // 西班牙特有
    defensiveFocus: '城防重地',      // 比“防御重心”更像战略术语
    flowerWars: '荣冠战争',          // 阿兹特克 Xochiyaoyotl 的意译，或保留“花之战争”
    gunpowderEmpire: '火药帝国',
    honorCode: '荣誉信条',
    horseLordSupremacy: '马背霸权',  // 比“骑兵霸权”更有游牧感
    janissarySystem: '耶尼切里制',   // 奥斯曼特有新军，比“近卫军”更准确
    mercenaryArmy: '雇佣兵团',
    militaryDiscipline: '军纪严明',
    militaryFocus: '尚武之风',       // “军事聚焦”太生硬
    militaryInnovation: '军事革新',
    militaryPrecision: '兵贵精准',
    militarySociety: '军国社会',
    militaryTradition: '戎马传统',
    mobilityFocus: '机动战术',
    navalSupremacy: '海上霸主',
    navalTradition: '航海传统',
    raidingCulture: '掠夺成性',      // 维京/游牧风格
    rapidConquest: '兵贵神速',       // 意译 Rapid Conquest
    strategicDepth: '战略纵深',      // 如果有 vastTerritory 类似的

    // --- 政治与统治 ---
    autocraticRule: '独裁统治',
    bureaucraticEfficiency: '吏治高效', // “官僚效率”太现代
    bureaucraticState: '科层国家',      // 或“官僚体制”
    celestialMandate: '天命所归',       // 中国特色
    colonialEmpire: '殖民帝国',
    democracyBirthplace: '民主摇篮',
    democraticIdeals: '民主理想',
    diplomaticMastery: '纵横捭阖',      // 极具外交手腕的雅称
    diplomaticModifier: '外交修正',     // 游戏术语保留
    divineKingship: '神授王权',
    examSystem: '科举制度',             // 专指中国/东亚
    helotSystem: '黑劳士制',            // 斯巴达特有奴隶制
    imperialGrandeur: '帝国荣光',
    imperialLegacy: '帝国遗产',
    isolationism: '闭关锁国',           // 比“孤立主义”更有历史感
    isolationist: '排外倾向',
    junkertradition: '容克贵族',        // 普鲁士
    laborTax: '徭役制度',               // 古代劳役税的专称
    legalTradition: '法典传统',
    manifestDestiny: '天命昭昭',        // 美国西进运动专有名词
    multiculturalRule: '多元共治',
    nobleRepublic: '贵族共和',          // 波兰立陶宛联邦
    parliamentarySystem: '议会政治',
    tributeSystem: '朝贡体系',          // 东方外交体系

    // --- 经济与贸易 ---
    agriculturalFocus: '农本思想',      // 或“重农传统”
    cattleWealth: '牧群资产',           // 非洲游牧民族以牛为财
    financialExpertise: '金融专长',
    financialInnovation: '金融革新',
    goldTrade: '黄金商路',
    infrastructureFocus: '大兴土木',    // 比“基础设施”更生动
    marketExpertise: '商贾优势',
    mercantileTradition: '重商主义',
    miningExpertise: '矿业专精',
    navalCommerce: '海路通商',
    peacefulTrade: '互市通商',
    tradeProtection: '贸易壁垒',        // 或“保护主义”
    tradingCompany: '特许商号',         // 对应东印度公司
    tradingStyle: '贸易风格',
    transaharaTrade: '穿越沙海',        // 跨撒哈拉贸易的雅称

    // --- 文化、宗教与科技 ---
    artisticPatronage: '文艺庇护',      // 对应文艺复兴时期的 Patronage
    astronomyAdvanced: '观星造诣',      // 比“天文学精研”更古雅
    cradle: '文明摇篮',
    craftExcellence: '巧夺天工',        // 形容工艺
    culturalHegemony: '文化霸权',
    engineeringAdvanced: '工程卓越',
    explorationBonus: '探索加成',
    explorerSpirit: '探险精神',
    floatingGardens: '水上圃田',        // 也就是“奇南帕”，避免与巴比伦“空中花园”混淆
    ideologicalExport: '思潮输出',
    industrialPioneer: '工业先驱',
    islamicLearning: '伊斯兰治学',
    missionaryZeal: '传教热忱',
    monumentBuilding: '奇观建造',       // 游戏玩家通俗语
    orthodoxCenter: '正教中心',
    orthodoxFaith: '东正信仰',
    philosophyCenter: '哲思圣地',
    religiousFervor: '狂热信仰',
    religiousFocus: '宗教核心',
    religiousMission: '神圣使命',
    religiousSyncretism: '三教合流',    // 意译 Syncretism，或“信仰融合”
    religiousTolerance: '宗教宽容',
    riverCivilization: '大河文明',
    roadNetwork: '驰道网络',            // “道路”太普通，古称“驰道”或“驿路”
    scientificAdvancement: '科学昌明',
    seafaringMastery: '纵横四海',       // 航海精通的雅称
    sunWorship: '太阳崇拜',
    vastTerritory: '疆域辽阔',
    writingInventor: '文字始祖',
};

const TRADE_STYLE_LABELS = {
    aggressive: '激进型',
    merchant: '商人型',
    maritime: '海洋型',
    monopolistic: '垄断型',
    capitalist: '资本型',
};

const formatCulturalTraitValue = (trait, value) => {
    if (typeof value === 'boolean') return '';
    if (trait === 'tradingStyle' && typeof value === 'string') {
        const styleLabel = TRADE_STYLE_LABELS[value] || value;
        return ` (${styleLabel})`;
    }
    if (typeof value === 'number') {
        return ` (${(value * 100).toFixed(0)}%)`;
    }
    if (value != null && value !== '') {
        return ` (${value})`;
    }
    return '';
};

export const DiplomacyTab = ({
    nations = [],
    epoch = 0,
    market = {},
    resources = {},
    daysElapsed = 0,
    onDiplomaticAction,
    tradeRoutes = { routes: [] },
    onTradeRouteAction,
    playerInstallmentPayment = null,
    jobsAvailable = {},
    popStructure = {},
    taxPolicies = {},
}) => {
    const [selectedNationId, setSelectedNationId] = useState(null);
    const [tradeAmount, setTradeAmount] = useState(10);
    // State for provoke modal
    const [showProvokeModal, setShowProvokeModal] = useState(false);
    const [provokeTargetId, setProvokeTargetId] = useState(null);
    // State for declare war confirmation modal
    const [showDeclareWarModal, setShowDeclareWarModal] = useState(false);
    // State for trade routes management modal
    const [showTradeRoutesModal, setShowTradeRoutesModal] = useState(false);

    const tradableResources = useMemo(
        () =>
            Object.entries(RESOURCES).filter(
                ([key, def]) =>
                    def.type !== 'virtual' &&
                    key !== 'silver' &&
                    (def.unlockEpoch ?? 0) <= epoch
            ),
        [epoch]
    );

    const visibleNations = useMemo(
        () =>
            nations.filter(
                (nation) =>
                    epoch >= (nation.appearEpoch ?? 0) &&
                    (nation.expireEpoch == null || epoch <= nation.expireEpoch)
            ),
        [nations, epoch]
    );

    useEffect(() => {
        if (!selectedNationId && visibleNations.length > 0) {
            setSelectedNationId(visibleNations[0].id);
        } else if (selectedNationId && !visibleNations.some((n) => n.id === selectedNationId)) {
            setSelectedNationId(visibleNations[0]?.id || null);
        }
    }, [selectedNationId, visibleNations]);

    const selectedNation =
        visibleNations.find((nation) => nation.id === selectedNationId) || visibleNations[0] || null;
    const selectedRelation = selectedNation ? relationInfo(selectedNation.relation, selectedNation.alliedWithPlayer === true) : null;
    const selectedPreferences = useMemo(() => getPreferredResources(selectedNation), [selectedNation]);

    const totalAllies = visibleNations.filter((n) => n.alliedWithPlayer === true).length;
    const totalWars = visibleNations.filter((n) => n.isAtWar).length;

    // 获取商人岗位信息
    const merchantJobLimit = jobsAvailable?.merchant || 0;
    const merchantCount = popStructure?.merchant || 0;
    const currentRouteCount = tradeRoutes.routes.length;
    const activeRouteCount = Math.min(currentRouteCount, merchantCount);

    // 检查是否已存在贸易路线
    const hasTradeRoute = (nationId, resourceKey, type) => {
        if (!tradeRoutes || !tradeRoutes.routes || !Array.isArray(tradeRoutes.routes)) {
            return false;
        }
        return tradeRoutes.routes.some(
            route => route.nationId === nationId && route.resource === resourceKey && route.type === type
        );
    };

    const handleTradeRoute = (resourceKey, type) => {
        if (!selectedNation || !onTradeRouteAction) return;
        const exists = hasTradeRoute(selectedNation.id, resourceKey, type);
        if (exists) {
            // 取消贸易路线
            onTradeRouteAction(selectedNation.id, 'cancel', { resource: resourceKey, type });
        } else {
            // 创建贸易路线
            onTradeRouteAction(selectedNation.id, 'create', { resource: resourceKey, type });
        }
    };

    const handleSimpleAction = (nationId, action, payload) => {
        if (onDiplomaticAction) {
            onDiplomaticAction(nationId, action, payload);
        }
    };

    // Handler for provoke action with target selection
    const handleProvokeWithTarget = () => {
        if (!selectedNation || !provokeTargetId || !onDiplomaticAction) return;
        onDiplomaticAction(selectedNation.id, 'provoke', { targetNationId: provokeTargetId });
        setShowProvokeModal(false);
        setProvokeTargetId(null);
    };

    // Get nations that can be provoked against (other visible nations)
    const provokeTargetNations = useMemo(() => {
        if (!selectedNation) return [];
        return visibleNations.filter(n => n.id !== selectedNation.id);
    }, [visibleNations, selectedNation]);

    // 计算目标国家的正式同盟国
    const targetNationAllies = useMemo(() => {
        if (!selectedNation) return [];
        return visibleNations.filter(n => {
            if (n.id === selectedNation.id) return false;
            // 检查目标国家的正式联盟
            const isAllied = (selectedNation.allies || []).includes(n.id) ||
                (n.allies || []).includes(selectedNation.id);
            return isAllied;
        }).map(ally => ({
            ...ally,
            foreignRelation: selectedNation.foreignRelations?.[ally.id] ?? 50,
        }));
    }, [visibleNations, selectedNation]);

    const getLocalPrice = (resourceKey) => {
        return market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
    };

    const renderPeaceHint = (nation) => {
        if (!nation?.isAtWar) return null;
        if ((nation.warScore || 0) > 0) {
            return '我方占优，可尝试索赔停战。';
        }
        if ((nation.warScore || 0) < 0) {
            return '局势不利，可能需要赔款求和。';
        }
        return '僵持阶段，继续作战或准备谈判。';
    };

    return (
        <div className="space-y-2 font-body">
            {/* 精简的统计信息 - 仅在桌面端显示 */}
            <div className="hidden md:flex gap-2 text-xs font-epic">
                <div className="bg-gray-800/60 px-2 py-1 rounded border border-gray-700">
                    <span className="text-gray-400 font-body">国家:</span>
                    <span className="text-white font-semibold ml-1 font-epic">{visibleNations.length}</span>
                </div>
                <div className="bg-green-900/20 px-2 py-1 rounded border border-green-600/20">
                    <span className="text-gray-400 font-body">盟友:</span>
                    <span className="text-green-300 font-semibold ml-1 font-epic">{totalAllies}</span>
                </div>
                <div className="bg-red-900/20 px-2 py-1 rounded border border-red-600/30">
                    <span className="text-gray-400 font-body">战争:</span>
                    <span className="text-red-300 font-semibold ml-1 font-epic">{totalWars}</span>
                </div>
                <div className="bg-blue-900/20 px-2 py-1 rounded border border-blue-600/20 flex items-center gap-2">
                    <span className="text-gray-400 font-body">贸易路线:</span>
                    <span className={`font-semibold ml-1 font-epic ${activeRouteCount < currentRouteCount ? 'text-yellow-300' : 'text-blue-300'
                        }`}>{activeRouteCount}/{currentRouteCount}</span>
                    <span className="text-gray-500 text-[10px] ml-1 font-body">(上限:{merchantJobLimit})</span>
                    <button
                        onClick={() => setShowTradeRoutesModal(true)}
                        className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] rounded shadow-sm border border-amber-400/50 transition-all active:scale-95"
                    >
                        <Icon name="Settings" size={10} />
                        <span className="font-bold">管理</span>
                    </button>
                </div>
                <div className="bg-amber-900/20 px-2 py-1 rounded border border-amber-600/20">
                    <span className="text-gray-400 font-body">商人在岗:</span>
                    <span className="text-amber-300 font-semibold ml-1 font-epic">{merchantCount}/{merchantJobLimit}</span>
                </div>
            </div>

            {/* Mobile Trade Routes Button - Only visible on mobile */}
            <div className="md:hidden flex items-center justify-between gap-2 bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-700 text-xs">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">贸易路线:</span>
                        <span className={`font-semibold ${activeRouteCount < currentRouteCount ? 'text-yellow-300' : 'text-blue-300'}`}>
                            {activeRouteCount}/{currentRouteCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">商人:</span>
                        <span className="text-amber-300 font-semibold">{merchantCount}/{merchantJobLimit}</span>
                    </div>
                </div>
                <button
                    onClick={() => setShowTradeRoutesModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded shadow-sm border border-amber-400/50 transition-all active:scale-95"
                >
                    <Icon name="Settings" size={14} />
                    <span className="font-bold">贸易路线管理</span>
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 h-[calc(100vh-260px)] md:h-[900px]">
                <div className="glass-ancient rounded-xl border border-ancient-gold/30 flex flex-col overflow-hidden">
                    <div className="px-2 py-1.5 border-b border-gray-700/80 text-[15px] uppercase tracking-wide text-gray-400 font-decorative font-bold">
                        国家列表
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-900 hover:scrollbar-thumb-gray-500">
                        {visibleNations.map((nation, idx) => {
                            if (!nation) return null;
                            const relation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                            const isSelected = nation.id === selectedNation?.id;
                            return (
                                <button
                                    key={nation.id}
                                    onClick={() => setSelectedNationId(nation.id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors border-b border-gray-700/60 focus:outline-none font-body ${isSelected ? 'bg-blue-900/30 border-l-2 border-l-blue-400' : 'hover:bg-gray-800/60'
                                        } ${idx === visibleNations.length - 1 ? 'border-b-0' : ''}`}
                                >
                                    <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-semibold text-white truncate">{nation.name || '未知国家'}</span>
                                            <span className={`px-1 py-0.5 rounded text-[9px] ${relation.bg} ${relation.color} font-epic`}>
                                                {relation.label}
                                            </span>
                                            {nation.isRebelNation && (
                                                <span className="px-1 py-0.5 rounded text-[9px] bg-red-900 text-red-100 font-epic">
                                                    叛乱
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Icon
                                        name={(nation.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                                        size={12}
                                        className={(nation.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                                    />
                                </button>
                            );
                        })}
                        {visibleNations.length === 0 && (
                            <div className="p-3 text-xs text-gray-400 font-body">当前时代暂无可接触的国家。</div>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-2 space-y-2 max-h-[calc(100vh-180px)] md:max-h-[900px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500">
                    {selectedNation ? (
                        <React.Fragment>
                            <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="Globe" size={14} className="text-amber-300" />
                                        <h3 className="text-sm font-bold text-white font-decorative">{selectedNation?.name || '未知国家'}</h3>
                                        {selectedNation?.type && (
                                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 font-epic">
                                                {selectedNation.type}
                                            </span>
                                        )}
                                        {selectedRelation && (
                                            <span className={`px-1.5 py-0.5 text-[9px] rounded ${selectedRelation.bg} ${selectedRelation.color} font-epic`}>
                                                {selectedRelation.label}
                                            </span>
                                        )}
                                    </div>
                                    <Icon
                                        name={(selectedNation?.isAtWar === true) ? 'Swords' : 'ShieldCheck'}
                                        size={14}
                                        className={(selectedNation?.isAtWar === true) ? 'text-red-400' : 'text-green-400'}
                                    />
                                </div>

                                {/* 国家描述 */}
                                {selectedNation?.desc && (
                                    <div className="mb-2 p-2 bg-gray-900/40 rounded border border-gray-700/50">
                                        <p className="text-[11px] text-gray-300 leading-relaxed font-body">
                                            <Icon name="BookOpen" size={10} className="inline mr-1 text-amber-300" />
                                            {selectedNation.desc}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-1 mb-2 text-xs font-body">
                                    <div className="p-2 rounded border border-blue-500/20 bg-blue-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-blue-200 font-body">
                                            <Icon name="Users" size={12} />
                                            人口
                                        </div>
                                        <span className="font-mono text-blue-100 font-semibold font-epic">
                                            {formatStatValue(selectedNation?.population, '')}
                                        </span>
                                    </div>
                                    <div className="p-2 rounded border border-amber-500/20 bg-amber-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-1 text-amber-200 font-body">
                                            <Icon name="Coins" size={12} />
                                            财富
                                        </div>
                                        <span className="font-mono text-amber-100 font-semibold font-epic">
                                            {formatStatValue(selectedNation?.wealth, ' 银')}
                                        </span>
                                    </div>
                                </div>

                                {/* 大致兵力估算 - 关系越好越准确 */}
                                {(() => {
                                    const relation = selectedNation?.relation || 0;
                                    const baseStrength = (selectedNation?.militaryStrength ?? 1.0) * (selectedNation?.population || 100) * (1 + (selectedNation?.aggression || 0.3));
                                    // 关系影响情报准确度：关系越好，误差越小
                                    const accuracyFactor = Math.max(0.1, relation / 100); // 0.1 - 1.0
                                    const errorRange = 1 - accuracyFactor; // 0 - 0.9
                                    // Use stable pseudo-random based on nation id and daysElapsed to avoid flickering
                                    const seedStr = `${selectedNation?.id || 'unknown'}-${Math.floor(daysElapsed / 30)}`;
                                    let seedHash = 0;
                                    for (let i = 0; i < seedStr.length; i++) {
                                        seedHash = ((seedHash << 5) - seedHash) + seedStr.charCodeAt(i);
                                        seedHash |= 0;
                                    }
                                    const stableRandom = ((Math.abs(seedHash) % 1000) / 1000) - 0.5; // Range: -0.5 to 0.5
                                    const estimatedStrength = Math.floor(baseStrength * (1 + stableRandom * errorRange * 2));
                                    const strengthLabel = relation >= 60 ? `约 ${estimatedStrength}` :
                                        relation >= 40 ? `${Math.floor(estimatedStrength * 0.8)} - ${Math.floor(estimatedStrength * 1.2)}` :
                                            relation >= 20 ? '情报不足' : '未知';
                                    return (
                                        <div className="p-2 rounded border border-red-500/20 bg-red-900/10 flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1 text-red-200 font-body">
                                                <Icon name="Swords" size={12} />
                                                军事力量
                                            </div>
                                            <span className={`font-mono font-semibold font-epic ${relation >= 60 ? 'text-green-300' :
                                                relation >= 40 ? 'text-yellow-300' :
                                                    'text-gray-400'
                                                }`}>
                                                {strengthLabel}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* 当前战争状态 */}
                                {selectedNation?.foreignWars && Object.keys(selectedNation.foreignWars).some(
                                    id => selectedNation.foreignWars[id]?.isAtWar
                                ) && (
                                        <div className="p-2 rounded border border-orange-500/20 bg-orange-900/10 mb-2">
                                            <div className="flex items-center gap-1 text-orange-200 font-body mb-1">
                                                <Icon name="Flame" size={12} />
                                                正在与其他国家交战
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.keys(selectedNation.foreignWars)
                                                    .filter(id => selectedNation.foreignWars[id]?.isAtWar)
                                                    .map(enemyId => {
                                                        const enemy = nations.find(n => n.id === enemyId);
                                                        return enemy ? (
                                                            <span key={enemyId} className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-200 text-[10px] font-body">
                                                                ⚔️ {enemy.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                            </div>
                                        </div>
                                    )}

                                <div className="flex gap-1.5 text-xs font-body">
                                    <button
                                        className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-500 rounded text-white flex items-center justify-center gap-1 font-semibold font-body"
                                        onClick={() => handleSimpleAction(selectedNation.id, 'gift')}
                                    >
                                        <Icon name="Gift" size={12} /> 礼物
                                    </button>
                                    <button
                                        className="flex-1 px-2 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-white flex items-center justify-center gap-1 font-semibold font-body"
                                        onClick={() => handleSimpleAction(selectedNation.id, 'demand')}
                                    >
                                        <Icon name="ShieldAlert" size={12} /> 索要
                                    </button>
                                    <button
                                        className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${selectedNation.isAtWar ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'
                                            }`}
                                        onClick={() => {
                                            if (selectedNation?.isAtWar === true) {
                                                // 求和操作直接执行
                                                handleSimpleAction(selectedNation.id, 'peace');
                                            } else {
                                                // 宣战时显示确认模态框
                                                setShowDeclareWarModal(true);
                                            }
                                        }}
                                    >
                                        <Icon name={(selectedNation?.isAtWar === true) ? 'Flag' : 'Swords'} size={12} />
                                        {(selectedNation?.isAtWar === true) ? '求和' : '宣战'}
                                    </button>
                                </div>

                                {/* 挑拨关系按钮 */}
                                <div className="mt-1.5 flex gap-1.5 text-xs font-body">
                                    <button
                                        className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white flex items-center justify-center gap-1 font-semibold font-body"
                                        onClick={() => {
                                            setProvokeTargetId(null);
                                            setShowProvokeModal(true);
                                        }}
                                        title="花费银币离间该国与另一国家的关系"
                                    >
                                        <Icon name="MessageSquareWarning" size={12} /> 挑拨关系
                                    </button>
                                </div>

                                {/* 结盟/解除联盟按钮 */}
                                <div className="mt-1.5 flex gap-1.5 text-xs font-body">
                                    {selectedNation?.alliedWithPlayer === true ? (
                                        <button
                                            className="flex-1 px-2 py-1.5 bg-red-700 hover:bg-red-600 rounded text-white flex items-center justify-center gap-1 font-semibold font-body"
                                            onClick={() => handleSimpleAction(selectedNation.id, 'break_alliance')}
                                            title="解除与该国的同盟关系"
                                        >
                                            <Icon name="UserMinus" size={12} /> 解除同盟
                                        </button>
                                    ) : (
                                        <button
                                            className={`flex-1 px-2 py-1.5 rounded text-white flex items-center justify-center gap-1 font-semibold font-body ${(selectedNation?.relation || 0) >= 60 && !selectedNation?.isAtWar
                                                ? 'bg-emerald-600 hover:bg-emerald-500'
                                                : 'bg-gray-600 cursor-not-allowed'
                                                }`}
                                            onClick={() => handleSimpleAction(selectedNation.id, 'propose_alliance')}
                                            disabled={(selectedNation?.relation || 0) < 60 || selectedNation?.isAtWar}
                                            title={(selectedNation?.relation || 0) < 60
                                                ? `关系需达到60才能请求结盟（当前：${Math.round(selectedNation?.relation || 0)}）`
                                                : selectedNation?.isAtWar
                                                    ? '无法与交战国结盟'
                                                    : '请求与该国建立正式同盟'}
                                        >
                                            <Icon name="Users" size={12} /> 请求结盟
                                        </button>
                                    )}
                                </div>

                                <div className="mt-1 text-[10px] text-gray-400 flex items-center justify-between font-epic">
                                    <span className="flex items-center gap-1">
                                        <Icon name="Coins" size={10} className="text-amber-300" />
                                        礼物成本：{calculateDynamicGiftCost(resources.silver || 0, selectedNation?.wealth || 0)} 银币 | 挑拨成本：300 银币
                                    </span>
                                </div>
                                {selectedPreferences.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1 font-decorative">
                                            <Icon name="Package" size={10} className="text-amber-300" />
                                            偏好资源
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedPreferences.slice(0, 4).map((pref) => (
                                                <span
                                                    key={pref.key}
                                                    className="px-2 py-0.5 rounded-full bg-gray-900/40 border border-amber-500/30 text-[10px] text-amber-100 flex items-center gap-1 font-body"
                                                    title={`倾向度 x${pref.bias.toFixed(1)}`}
                                                >
                                                    <Icon name={pref.icon} size={10} className={pref.color || 'text-amber-200'} />
                                                    <span className="font-body">{pref.name}</span>
                                                    <span className="text-amber-300 font-mono text-[9px] font-epic">x{pref.bias.toFixed(1)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 特殊能力 */}
                                {selectedNation?.specialAbilities && selectedNation.specialAbilities.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1 font-decorative">
                                            <Icon name="Sparkles" size={10} className="text-purple-300" />
                                            国家特色
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedNation.specialAbilities.map((ability, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 rounded-full bg-purple-900/30 border border-purple-500/30 text-[10px] text-purple-200 flex items-center gap-1 font-body"
                                                    title={ability.desc}
                                                >
                                                    <Icon name="Zap" size={10} className="text-purple-300" />
                                                    <span className="font-body">{ability.desc}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 文化特性 */}
                                {/*selectedNation?.culturalTraits && Object.keys(selectedNation.culturalTraits).length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Icon name="Landmark" size={10} className="text-cyan-300" />
                      文化特性
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedNation.culturalTraits).map(([trait, value]) => {
                        const fallbackName = trait.replace(/([A-Z])/g, ' $1').trim();
                        const normalizedName = fallbackName
                          ? fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
                          : trait;
                        const traitLabel = CULTURAL_TRAIT_LABELS[trait] || normalizedName;
                        const traitValueLabel = formatCulturalTraitValue(trait, value);

                        return (
                          <span
                            key={trait}
                            className="px-2 py-0.5 rounded-full bg-cyan-900/30 border border-cyan-500/30 text-[10px] text-cyan-200"
                            title={`${traitLabel}${traitValueLabel}`}
                          >
                            {traitLabel}
                            {traitValueLabel}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )*/}
                            </div>

                            <div className="bg-gray-800/60 p-2 rounded-lg border border-gray-700">
                                {/* Calculate relation-based trade route limits for selected nation */}
                                {(() => {
                                    const nationRelation = selectedNation?.relation || 0;
                                    const isAllyWithNation = selectedNation?.alliedWithPlayer === true;
                                    // Check if open market is active (defeated nation must allow unlimited trade)
                                    const isOpenMarketActive = selectedNation?.openMarketUntil && daysElapsed < selectedNation.openMarketUntil;
                                    const openMarketRemainingDays = isOpenMarketActive ? selectedNation.openMarketUntil - daysElapsed : 0;
                                    // If open market is active, no relation limit; otherwise use normal calculation with alliance bonus
                                    const maxRoutesWithNation = isOpenMarketActive ? 999 : getMaxTradeRoutesForRelation(nationRelation, isAllyWithNation);
                                    const currentRoutesWithNation = getRouteCountWithNation(tradeRoutes.routes, selectedNation?.id);
                                    const canCreateMore = currentRoutesWithNation < maxRoutesWithNation && currentRouteCount < merchantJobLimit;

                                    return (
                                        <React.Fragment>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-xs font-bold text-white flex items-center gap-1 font-decorative">
                                                    <Icon name="Route" size={12} className="text-blue-300" />
                                                    贸易路线管理
                                                </h3>
                                                <div className="text-[10px] text-gray-400 font-body">
                                                    <div className="font-body">创建贸易路线以自动进出口资源</div>
                                                    <div className="mt-0.5 font-epic">
                                                        <span className={activeRouteCount < currentRouteCount ? 'text-yellow-400' : 'text-blue-400'}>
                                                            有效路线: {activeRouteCount}/{currentRouteCount}
                                                        </span>
                                                        <span className="text-gray-500 mx-1">|</span>
                                                        <span className={currentRouteCount >= merchantJobLimit ? 'text-red-400' : 'text-green-400'}>
                                                            商人上限: {merchantJobLimit}
                                                        </span>
                                                        <span className="text-gray-500 mx-1">|</span>
                                                        <span className="text-amber-400">商人在岗: {merchantCount}/{merchantJobLimit}</span>
                                                    </div>
                                                </div>                      </div>

                                            {/* Relation-based trade route limit info */}
                                            <div className={`mb-2 p-2 rounded border ${isOpenMarketActive ? 'bg-green-900/30 border-green-600/30' : 'bg-indigo-900/30 border-indigo-600/30'}`}>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className={`flex items-center gap-1 font-body ${isOpenMarketActive ? 'text-green-300' : 'text-indigo-300'}`}>
                                                        <Icon name={isOpenMarketActive ? 'Store' : 'Heart'} size={10} />
                                                        与 {selectedNation?.name} 的贸易路线
                                                    </span>
                                                    <span className={`font-epic ${isOpenMarketActive ? 'text-green-300' : (currentRoutesWithNation >= maxRoutesWithNation ? 'text-red-300' : 'text-green-300')}`}>
                                                        {isOpenMarketActive ? `${currentRoutesWithNation}/无限制` : `${currentRoutesWithNation}/${maxRoutesWithNation}`}
                                                    </span>
                                                </div>
                                                {isOpenMarketActive ? (
                                                    <div className="text-[9px] text-green-400 mt-1 font-body">
                                                        🏪 开放市场协议生效中！剩余 {Math.ceil(openMarketRemainingDays / 365)} 年 {openMarketRemainingDays % 365} 天
                                                        <span className="text-green-300 ml-1">(贸易路线不受关系限制)</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[9px] text-gray-400 mt-1 font-body">
                                                        {isAllyWithNation ? (
                                                            <span className="text-green-400">🤝 正式盟友 → 最多 {maxRoutesWithNation} 条路线</span>
                                                        ) : (
                                                            <>
                                                                关系值 {Math.round(nationRelation)} → 最多 {maxRoutesWithNation} 条路线
                                                                {maxRoutesWithNation === 0 && <span className="text-red-400 ml-1">(敌对无法贸易)</span>}
                                                                {maxRoutesWithNation === 1 && <span className="text-yellow-400 ml-1">(冷淡)</span>}
                                                                {maxRoutesWithNation === 2 && <span className="text-gray-300 ml-1">(中立)</span>}
                                                                {maxRoutesWithNation === 3 && <span className="text-blue-400 ml-1">(友好)</span>}
                                                                {maxRoutesWithNation === 4 && <span className="text-emerald-400 ml-1">(亲密)</span>}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 警告提示 */}
                                            {activeRouteCount < currentRouteCount && (
                                                <div className="mb-2 p-2 bg-yellow-900/30 border border-yellow-600/30 rounded text-[10px] text-yellow-300 font-body">
                                                    <Icon name="AlertTriangle" size={12} className="inline mr-1" />
                                                    当前有 {currentRouteCount - activeRouteCount} 条贸易路线未激活。需要更多商人在岗才能激活所有路线。
                                                </div>
                                            )}
                                            {currentRouteCount >= merchantJobLimit && (
                                                <div className="mb-2 p-2 bg-red-900/30 border border-red-600/30 rounded text-[10px] text-red-300 font-body">
                                                    <Icon name="AlertCircle" size={12} className="inline mr-1" />
                                                    贸易路线数量已达上限。建造更多贸易站以增加商人岗位上限。
                                                </div>
                                            )}
                                            {currentRoutesWithNation >= maxRoutesWithNation && maxRoutesWithNation > 0 && (
                                                <div className="mb-2 p-2 bg-purple-900/30 border border-purple-600/30 rounded text-[10px] text-purple-300 font-body">
                                                    <Icon name="UserX" size={12} className="inline mr-1" />
                                                    与 {selectedNation?.name} 的贸易路线已达关系上限（{maxRoutesWithNation}条）。提升关系可增加贸易路线数量。
                                                </div>
                                            )}
                                            {maxRoutesWithNation === 0 && (
                                                <div className="mb-2 p-2 bg-red-900/30 border border-red-600/30 rounded text-[10px] text-red-300 font-body">
                                                    <Icon name="Ban" size={12} className="inline mr-1" />
                                                    与 {selectedNation?.name} 关系敌对，无法建立贸易路线。请改善关系至少达到20。
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                {tradableResources.map(([key, res]) => {
                                                    if (!selectedNation) return null;
                                                    const local = getLocalPrice(key);
                                                    const foreign = calculateForeignPrice(key, selectedNation, daysElapsed);
                                                    const diff = foreign - local;
                                                    const tradeStatus = calculateTradeStatus(key, selectedNation, daysElapsed) || {};
                                                    // 限制显示的缺口/盈余数值，避免显示过大的数字
                                                    const rawShortage = Math.floor(tradeStatus.shortageAmount || 0);
                                                    const rawSurplus = Math.floor(tradeStatus.surplusAmount || 0);
                                                    const shortageCapacity = rawShortage > 9999 ? '9999+' : rawShortage;
                                                    const surplusCapacity = rawSurplus > 9999 ? '9999+' : rawSurplus;

                                                    // 检查是否已解锁该资源
                                                    const isUnlocked = (res.unlockEpoch ?? 0) <= epoch;
                                                    if (!isUnlocked) return null;

                                                    // 检查是否处于战争
                                                    const isAtWar = selectedNation?.isAtWar || false;

                                                    // 检查是否已有贸易路线
                                                    const hasExportRoute = hasTradeRoute(selectedNation.id, key, 'export');
                                                    const hasImportRoute = hasTradeRoute(selectedNation.id, key, 'import');

                                                    // Check relation-based trade route limit
                                                    const canCreateNewRoute = !canCreateMore && !hasExportRoute && !hasImportRoute;
                                                    const relationBlocked = currentRoutesWithNation >= maxRoutesWithNation;

                                                    return (
                                                        <div key={key} className="bg-gray-900/40 rounded p-1.5 border border-gray-700/50">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon name={res.icon || 'Box'} size={12} className={res.color || 'text-gray-400'} />
                                                                    <span className="text-xs font-semibold text-white font-body">{res.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[10px] font-epic">
                                                                    {tradeStatus.isShortage && (
                                                                        <span className="text-red-400 font-mono">缺{shortageCapacity}</span>
                                                                    )}
                                                                    {tradeStatus.isSurplus && (
                                                                        <span className="text-green-400 font-mono">余{surplusCapacity}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <div className="flex gap-2 text-gray-400 font-body">
                                                                    <span>本地: <span className="text-white font-mono font-epic">{local.toFixed(1)}</span></span>
                                                                    <span>外国: <span className={`font-mono font-epic ${diff > 0 ? 'text-green-300' : 'text-red-300'}`}>{foreign.toFixed(1)}</span></span>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        className={`px-1.5 py-0.5 rounded text-white flex items-center gap-0.5 font-body ${hasExportRoute
                                                                            ? 'bg-red-600 hover:bg-red-500'
                                                                            : (isAtWar || (relationBlocked && !hasExportRoute))
                                                                                ? 'bg-gray-600 cursor-not-allowed'
                                                                                : 'bg-teal-600 hover:bg-teal-500'
                                                                            }`}
                                                                        onClick={() => handleTradeRoute(key, 'export')}
                                                                        disabled={(isAtWar && !hasExportRoute) || (relationBlocked && !hasExportRoute)}
                                                                        title={isAtWar && !hasExportRoute ? '战争期间无法创建新贸易路线' : (relationBlocked && !hasExportRoute ? '关系限制：已达该国贸易路线上限' : '')}
                                                                    >
                                                                        <Icon name={hasExportRoute ? 'X' : 'ArrowUpRight'} size={10} />
                                                                        {hasExportRoute ? '取消' : '出口'}
                                                                    </button>
                                                                    <button
                                                                        className={`px-1.5 py-0.5 rounded text-white flex items-center gap-0.5 font-body ${hasImportRoute
                                                                            ? 'bg-red-600 hover:bg-red-500'
                                                                            : (isAtWar || (relationBlocked && !hasImportRoute))
                                                                                ? 'bg-gray-600 cursor-not-allowed'
                                                                                : 'bg-purple-600 hover:bg-purple-500'
                                                                            }`}
                                                                        onClick={() => handleTradeRoute(key, 'import')}
                                                                        disabled={(isAtWar && !hasImportRoute) || (relationBlocked && !hasImportRoute)}
                                                                        title={isAtWar && !hasImportRoute ? '战争期间无法创建新贸易路线' : (relationBlocked && !hasImportRoute ? '关系限制：已达该国贸易路线上限' : '')}
                                                                    >
                                                                        <Icon name={hasImportRoute ? 'X' : 'ArrowDownLeft'} size={10} />
                                                                        {hasImportRoute ? '取消' : '进口'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </React.Fragment>
                                    );
                                })()}
                            </div>

                            {selectedNation.peaceTreatyUntil && daysElapsed < selectedNation.peaceTreatyUntil && (
                                <div className="bg-green-900/20 p-2 rounded-lg border border-green-600/30 mb-2">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="HandHeart" size={12} className="text-green-300" />
                                        和平协议
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-body">
                                        剩余天数: <span className="text-green-300 font-semibold font-epic">{selectedNation.peaceTreatyUntil - daysElapsed}</span>
                                    </p>
                                    {selectedNation.installmentPayment && (
                                        <p className="text-[10px] text-gray-300 mt-1 font-body">
                                            分期支付: 每天 <span className="text-yellow-300 font-semibold font-epic">{selectedNation.installmentPayment.amount}</span> 银币
                                            （剩余 <span className="text-white font-semibold font-epic">{selectedNation.installmentPayment.remainingDays}</span> 天）
                                        </p>
                                    )}
                                </div>
                            )}

                            {selectedNation.isAtWar && (
                                <div className="bg-red-900/20 p-2 rounded-lg border border-red-600/30">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="AlertTriangle" size={12} className="text-red-300" />
                                        战争状态
                                    </h3>
                                    <div className="flex items-center justify-between text-[10px] mb-1.5 font-body">
                                        <div className="flex gap-2 text-gray-300 font-body">
                                            <span>分数: <span className="text-red-300 font-semibold font-epic">{selectedNation.warScore?.toFixed(0) || 0}</span></span>
                                            <span>天数: <span className="text-white font-semibold font-epic">{selectedNation.warDuration || 0}</span></span>
                                            <span>损失: <span className="text-white font-semibold font-epic">{selectedNation.enemyLosses || 0}</span></span>
                                            <span>实力: <span className={`font-semibold font-epic ${(selectedNation.militaryStrength ?? 1.0) > 0.7 ? 'text-green-300' : (selectedNation.militaryStrength ?? 1.0) > 0.4 ? 'text-yellow-300' : 'text-red-300'}`}>{Math.floor((selectedNation.militaryStrength ?? 1.0) * 100)}%</span></span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-1.5 font-body">{renderPeaceHint(selectedNation)}</p>
                                    <button
                                        className="w-full px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold font-body"
                                        onClick={() => handleSimpleAction(selectedNation.id, 'peace')}
                                    >
                                        提出和平协议
                                    </button>
                                </div>
                            )}

                            {playerInstallmentPayment && playerInstallmentPayment.nationId === selectedNation.id && (
                                <div className="bg-yellow-900/20 p-2 rounded-lg border border-yellow-600/30 mt-2">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-1 mb-1.5 font-decorative">
                                        <Icon name="Coins" size={12} className="text-yellow-300" />
                                        你的分期支付
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-body">
                                        每天支付: <span className="text-yellow-300 font-semibold font-epic">{playerInstallmentPayment.amount}</span> 银币
                                    </p>
                                    <p className="text-[10px] text-gray-300 mt-1 font-body">
                                        剩余天数: <span className="text-white font-semibold font-epic">{playerInstallmentPayment.remainingDays}</span>
                                    </p>
                                    <p className="text-[10px] text-gray-300 mt-1 font-body">
                                        已支付: <span className="text-green-300 font-semibold font-epic">{playerInstallmentPayment.paidAmount}</span> /
                                        <span className="text-white font-semibold font-epic"> {playerInstallmentPayment.totalAmount}</span> 银币
                                    </p>
                                </div>
                            )}
                        </React.Fragment>
                    ) : (
                        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30 text-sm text-gray-400 font-body">
                            请选择一个国家以查看贸易与谈判选项。
                        </div>
                    )}
                </div>
            </div>

            {/* Provoke Target Selection Modal */}
            <Modal
                isOpen={showProvokeModal}
                onClose={() => {
                    setShowProvokeModal(false);
                    setProvokeTargetId(null);
                }}
                title={`挑拨 ${selectedNation?.name || ''} 的关系`}
                footer={
                    <div className="flex gap-2 justify-end">
                        <button
                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-body"
                            onClick={() => {
                                setShowProvokeModal(false);
                                setProvokeTargetId(null);
                            }}
                        >
                            取消
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded text-white text-sm font-body ${provokeTargetId
                                ? 'bg-indigo-600 hover:bg-indigo-500'
                                : 'bg-gray-500 cursor-not-allowed'
                                }`}
                            onClick={handleProvokeWithTarget}
                            disabled={!provokeTargetId}
                        >
                            确认挑拨 (300银币)
                        </button>
                    </div>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-gray-300 font-body mb-3">
                        选择要离间的目标国家。挑拨成功后，{selectedNation?.name} 与目标国家的关系将会恶化。
                    </p>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {provokeTargetNations.map(nation => {
                            const nationRelation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                            const foreignRelation = selectedNation?.foreignRelations?.[nation.id] ?? 50;
                            // Check if these two AI nations are formally allied
                            const areAllied = (selectedNation?.allies || []).includes(nation.id) ||
                                (nation.allies || []).includes(selectedNation?.id);
                            const foreignRelationInfo = (() => {
                                if (areAllied) return { label: '盟友', color: 'text-green-300' };
                                if (foreignRelation >= 80) return { label: '亲密', color: 'text-emerald-300' };
                                if (foreignRelation >= 60) return { label: '友好', color: 'text-blue-300' };
                                if (foreignRelation >= 40) return { label: '中立', color: 'text-gray-300' };
                                if (foreignRelation >= 20) return { label: '冷淡', color: 'text-yellow-300' };
                                return { label: '敌对', color: 'text-red-300' };
                            })();

                            return (
                                <button
                                    key={nation.id}
                                    onClick={() => setProvokeTargetId(nation.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded border transition-colors ${provokeTargetId === nation.id
                                        ? 'bg-indigo-900/50 border-indigo-500'
                                        : 'bg-gray-800/60 border-gray-700 hover:bg-gray-700/60'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                                        <span className="text-sm text-white font-body">{nation.name}</span>
                                        <span className={`text-[10px] px-1 py-0.5 rounded ${nationRelation.bg} ${nationRelation.color}`}>
                                            与你:{nationRelation.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                        <span className="text-gray-400">两国关系:</span>
                                        <span className={foreignRelationInfo.color}>{foreignRelationInfo.label}</span>
                                        <span className="text-gray-500">({Math.round(foreignRelation)})</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {provokeTargetNations.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4 font-body">
                            没有其他可选择的国家
                        </p>
                    )}
                </div>
            </Modal>

            {/* 宣战确认模态框 */}
            {showDeclareWarModal && selectedNation && (
                <DeclareWarModal
                    targetNation={selectedNation}
                    allies={targetNationAllies}
                    onConfirm={() => {
                        handleSimpleAction(selectedNation.id, 'declare_war');
                        setShowDeclareWarModal(false);
                    }}
                    onCancel={() => setShowDeclareWarModal(false)}
                />
            )}

            {showTradeRoutesModal && (
                <TradeRoutesModal
                    tradeRoutes={tradeRoutes}
                    nations={visibleNations}
                    resources={resources}
                    market={market}
                    taxPolicies={taxPolicies}
                    daysElapsed={daysElapsed}
                    epoch={epoch}
                    onClose={() => setShowTradeRoutesModal(false)}
                    onCancelRoute={(nationId, resource, type) => {
                        if (onTradeRouteAction) {
                            onTradeRouteAction(nationId, 'cancel', { resource, type });
                        }
                    }}
                    onCreateRoute={(nationId, resource, type) => {
                        if (onTradeRouteAction) {
                            onTradeRouteAction(nationId, 'create', { resource, type });
                        }
                    }}
                />
            )}
        </div>
    );
};
