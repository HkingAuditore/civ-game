import { RESOURCES, STRATA, BUILDINGS } from '../../config';
import { filterEventEffects } from '../../utils/eventEffectFilter';

// 事件效果允许的建筑类别
export const EVENT_BUILDING_CATEGORIES = ['gather', 'industry', 'civic', 'military', 'all'];

// 外交事件允许的选择器（其余为具体国家 id）
export const DIPLOMACY_SELECTORS = ['random', 'strongest', 'weakest', 'hostile', 'friendly', 'all'];

// 为 LLM 提供的数值建议范围（用于校验与裁剪）
export const AI_EVENT_NUMERIC_LIMITS = {
    approval: { min: -30, max: 30 },
    stability: { min: -20, max: 20 },
    resourcePercent: { min: -0.35, max: 0.35 },
    populationPercent: { min: -0.25, max: 0.25 },
    populationDelta: { min: -200, max: 200 },
    demandMod: { min: -0.6, max: 1.0 },
    nationRelation: { min: -50, max: 50 },
    nationAggression: { min: -0.4, max: 0.4 },
    nationWealth: { min: -500, max: 500 },
    nationMarketVolatility: { min: -0.4, max: 0.4 },
};

const clampNumber = (value, min, max) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return Math.min(max, Math.max(min, value));
};

const toSafeId = (value, fallback = 'ai_event') => {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_\-]+/g, '_')
        .replace(/^_+|_+$/g, '') || fallback;
};

const sanitizeText = (value, fallback = '') => {
    if (typeof value !== 'string') return fallback;
    return value.trim();
};

const getResourceKeys = () => Object.keys(RESOURCES);
const getStratumKeys = () => Object.keys(STRATA);
const getBuildingIds = () => BUILDINGS.map(b => b.id);

const isDiplomacySelectorAllowed = (selector, nationIds = []) => {
    if (!selector) return false;
    if (DIPLOMACY_SELECTORS.includes(selector)) return true;
    return nationIds.includes(selector);
};

const sanitizeNumericMap = (map, allowedKeys, limit) => {
    if (!map || typeof map !== 'object') return undefined;
    const next = {};
    Object.entries(map).forEach(([key, value]) => {
        if (!allowedKeys.includes(key)) return;
        const clamped = clampNumber(value, limit.min, limit.max);
        if (clamped == null) return;
        next[key] = clamped;
    });
    return Object.keys(next).length > 0 ? next : undefined;
};

const sanitizeDiplomacyMap = (map, nationIds, limit, { allowExclude = false } = {}) => {
    if (!map || typeof map !== 'object') return undefined;
    const next = {};

    Object.entries(map).forEach(([selector, value]) => {
        if (allowExclude && selector === 'exclude') {
            if (Array.isArray(value)) {
                next.exclude = value.filter(id => nationIds.includes(id));
            }
            return;
        }

        if (!isDiplomacySelectorAllowed(selector, nationIds)) return;
        const clamped = clampNumber(value, limit.min, limit.max);
        if (clamped == null) return;
        next[selector] = clamped;
    });

    return Object.keys(next).length > 0 ? next : undefined;
};

const sanitizeBuildingProductionMap = (map, allowedTargets, limit) => {
    if (!map || typeof map !== 'object') return undefined;
    const next = {};
    Object.entries(map).forEach(([target, value]) => {
        if (!allowedTargets.includes(target)) return;
        const clamped = clampNumber(value, limit.min, limit.max);
        if (clamped == null) return;
        next[target] = clamped;
    });
    return Object.keys(next).length > 0 ? next : undefined;
};

/**
 * 构建给 LLM 的事件上下文（尽量小而关键）
 */
export const buildAiEventContext = (gameState = {}) => {
    const epoch = gameState.epoch || 0;
    const techsUnlocked = Array.isArray(gameState.techsUnlocked) ? gameState.techsUnlocked : [];

    const nations = Array.isArray(gameState.nations) ? gameState.nations : [];
    const visibleNations = nations.filter(n => n && n.visible !== false && !n.isAnnexed);

    return {
        epoch,
        daysElapsed: gameState.daysElapsed || 0,
        population: gameState.population || 0,
        stability: gameState.stability ?? 0,
        resources: gameState.resources || {},
        classApproval: gameState.classApproval || {},
        classInfluence: gameState.classInfluence || {},
        rulingCoalition: gameState.rulingCoalition || [],
        techsUnlocked,
        nations: visibleNations.map(n => ({
            id: n.id,
            name: n.name,
            relation: n.relation,
            aggression: n.aggression,
            wealth: n.wealth,
            isAtWar: n.isAtWar,
        })),
        reference: getAiEventReference({
            epoch,
            techsUnlocked,
            nations: visibleNations,
        }),
    };
};

/**
 * 提供给提示词的“白名单字典”
 */
export const getAiEventReference = ({ epoch = 0, techsUnlocked = [], nations = [] } = {}) => {
    const resourceKeys = getResourceKeys();
    const stratumKeys = getStratumKeys();
    const buildingIds = getBuildingIds();
    const nationIds = nations.map(n => n.id);

    return {
        epoch,
        techsUnlocked,
        resources: resourceKeys,
        strata: stratumKeys,
        buildings: buildingIds,
        buildingCategories: EVENT_BUILDING_CATEGORIES,
        diplomacySelectors: DIPLOMACY_SELECTORS,
        nationIds,
        numericLimits: AI_EVENT_NUMERIC_LIMITS,
        effectKeys: [
            'resources',
            'resourcePercent',
            'population',
            'populationPercent',
            'maxPop',
            'approval',
            'stability',
            'resourceDemandMod',
            'stratumDemandMod',
            'buildingProductionMod',
            'nationRelation',
            'nationAggression',
            'nationWealth',
            'nationMarketVolatility',
            'triggerWar',
            'triggerPeace',
            'modifyCoalition',
        ],
    };
};

/**
 * 将 LLM 生成的事件裁剪为“当前事件系统可安全执行”的结构
 */
export const normalizeAiEvent = (rawEvent, context = {}) => {
    if (!rawEvent || typeof rawEvent !== 'object') return null;

    const epoch = context.epoch ?? 0;
    const techsUnlocked = Array.isArray(context.techsUnlocked) ? context.techsUnlocked : [];
    const nations = Array.isArray(context.nations) ? context.nations : [];
    const nationIds = nations.map(n => n.id);

    const resourceKeys = getResourceKeys();
    const stratumKeys = getStratumKeys();
    const buildingTargets = [...getBuildingIds(), ...EVENT_BUILDING_CATEGORIES];

    const baseId = toSafeId(rawEvent.id, 'ai_event');
    const eventId = baseId.startsWith('ai_') ? baseId : `ai_${baseId}`;

    const normalizeEffects = (effects) => {
        if (!effects || typeof effects !== 'object') return undefined;

        const next = {};

        const resources = sanitizeNumericMap(
            effects.resources,
            resourceKeys,
            { min: -100000, max: 100000 },
        );
        if (resources) next.resources = resources;

        const resourcePercent = sanitizeNumericMap(
            effects.resourcePercent,
            resourceKeys,
            AI_EVENT_NUMERIC_LIMITS.resourcePercent,
        );
        if (resourcePercent) next.resourcePercent = resourcePercent;

        if (typeof effects.population === 'number') {
            const clamped = clampNumber(
                effects.population,
                AI_EVENT_NUMERIC_LIMITS.populationDelta.min,
                AI_EVENT_NUMERIC_LIMITS.populationDelta.max,
            );
            if (clamped != null) next.population = Math.trunc(clamped);
        }

        if (typeof effects.populationPercent === 'number') {
            const clamped = clampNumber(
                effects.populationPercent,
                AI_EVENT_NUMERIC_LIMITS.populationPercent.min,
                AI_EVENT_NUMERIC_LIMITS.populationPercent.max,
            );
            if (clamped != null) next.populationPercent = clamped;
        }

        if (typeof effects.maxPop === 'number') {
            const clamped = clampNumber(effects.maxPop, -500, 2000);
            if (clamped != null) next.maxPop = Math.trunc(clamped);
        }

        const approval = sanitizeNumericMap(
            effects.approval,
            stratumKeys,
            AI_EVENT_NUMERIC_LIMITS.approval,
        );
        if (approval) next.approval = approval;

        if (typeof effects.stability === 'number') {
            const clamped = clampNumber(
                effects.stability,
                AI_EVENT_NUMERIC_LIMITS.stability.min,
                AI_EVENT_NUMERIC_LIMITS.stability.max,
            );
            if (clamped != null) next.stability = clamped;
        }

        const resourceDemandMod = sanitizeNumericMap(
            effects.resourceDemandMod,
            resourceKeys,
            AI_EVENT_NUMERIC_LIMITS.demandMod,
        );
        if (resourceDemandMod) next.resourceDemandMod = resourceDemandMod;

        const stratumDemandMod = sanitizeNumericMap(
            effects.stratumDemandMod,
            stratumKeys,
            AI_EVENT_NUMERIC_LIMITS.demandMod,
        );
        if (stratumDemandMod) next.stratumDemandMod = stratumDemandMod;

        const buildingProductionMod = sanitizeBuildingProductionMap(
            effects.buildingProductionMod,
            buildingTargets,
            AI_EVENT_NUMERIC_LIMITS.demandMod,
        );
        if (buildingProductionMod) next.buildingProductionMod = buildingProductionMod;

        const nationRelation = sanitizeDiplomacyMap(
            effects.nationRelation,
            nationIds,
            AI_EVENT_NUMERIC_LIMITS.nationRelation,
            { allowExclude: true },
        );
        if (nationRelation) next.nationRelation = nationRelation;

        const nationAggression = sanitizeDiplomacyMap(
            effects.nationAggression,
            nationIds,
            AI_EVENT_NUMERIC_LIMITS.nationAggression,
        );
        if (nationAggression) next.nationAggression = nationAggression;

        const nationWealth = sanitizeDiplomacyMap(
            effects.nationWealth,
            nationIds,
            AI_EVENT_NUMERIC_LIMITS.nationWealth,
        );
        if (nationWealth) next.nationWealth = nationWealth;

        const nationMarketVolatility = sanitizeDiplomacyMap(
            effects.nationMarketVolatility,
            nationIds,
            AI_EVENT_NUMERIC_LIMITS.nationMarketVolatility,
        );
        if (nationMarketVolatility) next.nationMarketVolatility = nationMarketVolatility;

        if (effects.triggerWar && isDiplomacySelectorAllowed(effects.triggerWar, nationIds)) {
            next.triggerWar = effects.triggerWar;
        }

        if (effects.triggerPeace && isDiplomacySelectorAllowed(effects.triggerPeace, nationIds)) {
            next.triggerPeace = effects.triggerPeace;
        }

        if (effects.modifyCoalition && typeof effects.modifyCoalition === 'object') {
            const addToCoalition = stratumKeys.includes(effects.modifyCoalition.addToCoalition)
                ? effects.modifyCoalition.addToCoalition
                : undefined;
            const removeFromCoalition = stratumKeys.includes(effects.modifyCoalition.removeFromCoalition)
                ? effects.modifyCoalition.removeFromCoalition
                : undefined;
            if (addToCoalition || removeFromCoalition) {
                next.modifyCoalition = {
                    ...(addToCoalition ? { addToCoalition } : {}),
                    ...(removeFromCoalition ? { removeFromCoalition } : {}),
                };
            }
        }

        // 结合时代/科技过滤一次，避免未解锁内容进入运行期
        const filtered = filterEventEffects(next, epoch, techsUnlocked);
        return filtered && Object.keys(filtered).length > 0 ? filtered : undefined;
    };

    const normalizeRandomEffects = (randomEffects) => {
        if (!Array.isArray(randomEffects)) return undefined;
        const next = randomEffects
            .map(item => {
                if (!item || typeof item !== 'object') return null;
                const chance = clampNumber(item.chance, 0, 1);
                const effects = normalizeEffects(item.effects);
                if (chance == null || !effects) return null;
                return { chance, effects };
            })
            .filter(Boolean);
        return next.length > 0 ? next : undefined;
    };

    const options = Array.isArray(rawEvent.options) ? rawEvent.options : [];
    const normalizedOptions = options
        .slice(0, 4)
        .map((opt, index) => {
            if (!opt || typeof opt !== 'object') return null;
            const optionId = toSafeId(opt.id, `option_${index + 1}`);
            const effects = normalizeEffects(opt.effects);
            const randomEffects = normalizeRandomEffects(opt.randomEffects);

            return {
                id: optionId,
                text: sanitizeText(opt.text, `选项${index + 1}`),
                description: sanitizeText(opt.description, ''),
                ...(effects ? { effects } : {}),
                ...(randomEffects ? { randomEffects } : {}),
            };
        })
        .filter(Boolean)
        .filter(opt => opt.text);

    if (normalizedOptions.length === 0) return null;

    return {
        id: eventId,
        name: sanitizeText(rawEvent.name, '神秘事件'),
        description: sanitizeText(rawEvent.description, ''),
        icon: sanitizeText(rawEvent.icon, 'Sparkles'),
        isAiGenerated: true,
        options: normalizedOptions,
    };
};

