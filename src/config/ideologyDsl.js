const RULE_MOD_TYPES = new Set([
    'building_cost_mod',
    'official_bonus',
    'official_capacity',
    'tax_modifier',
    'cooldown_mod',
    'price_volatility_mod',
    'tech_cost_mod',
    'stratum_output_mod',
    'building_input_mod',
    'unit_attack_mod',
    'unit_defense_mod',
    'recruit_cost_mod',
    'maintenance_cost_mod',
    'corruption_mod',
    'wages_mod',
    'trade_route_mod',
    'resource_price_mod',
    'diplomatic_influence',
]);

const RULE_MOD_ALIASES = {
    official_effect_mod: 'official_bonus',
    official_effect_bonus: 'official_bonus',
    global_tax_mod: 'tax_modifier',
    tax_mod: 'tax_modifier',
    action_cooldown_mod: 'cooldown_mod',
};

const EVENT_ALIASES = {
    on_approval_low: 'on_class_approval_low',
    on_class_low_approval: 'on_class_approval_low',
    on_relation_positive: 'on_relation_improve',
    on_relation_negative: 'on_relation_hostile',
    on_vassal_acquired: 'on_vassal_gain',
    on_vassal_gained: 'on_vassal_gain',
    on_legitimacy_shift: 'on_legitimacy_change',
};

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneEffectMap(effectMap = {}) {
    if (!isPlainObject(effectMap)) return {};
    const cloned = {};
    Object.entries(effectMap).forEach(([key, value]) => {
        if (isPlainObject(value)) {
            cloned[key] = { ...value };
        } else {
            cloned[key] = value;
        }
    });
    return cloned;
}

function toObjectBonus(trigger, issuePrefix) {
    if (isPlainObject(trigger.bonus)) {
        return cloneEffectMap(trigger.bonus);
    }
    if (typeof trigger.bonus === 'number' && trigger.target) {
        return { [trigger.target]: trigger.bonus };
    }
    return null;
}

function normalizeTriggerEffect(trigger, ideologyId, index, issues) {
    if (!isPlainObject(trigger) || !trigger.type) {
        issues.push(`[${ideologyId}] triggerEffects[${index}] 缺少有效 type`);
        return null;
    }

    const normalized = { ...trigger };
    const issuePrefix = `[${ideologyId}] triggerEffects[${index}]`;

    if (normalized.type === 'building_count_bonus') {
        const normalizedBonus = toObjectBonus(normalized, issuePrefix);
        if (normalizedBonus) {
            if (!isPlainObject(normalized.bonus)) {
                issues.push(`${issuePrefix} 使用旧写法 bonus:number + target，已自动转换`);
            }
            normalized.bonus = normalizedBonus;
        }
    }

    if (normalized.type === 'building_specific_bonus') {
        const normalizedBonus = toObjectBonus(normalized, issuePrefix);
        if (normalizedBonus) {
            normalized.bonus = normalizedBonus;
        }
    }

    if (normalized.type === 'unit_count_bonus') {
        const normalizedBonus = toObjectBonus(normalized, issuePrefix);
        if (normalizedBonus) {
            normalized.bonus = normalizedBonus;
        }
    }

    if (normalized.type === 'chain_count_bonus' && !isPlainObject(normalized.perCount) && isPlainObject(normalized.bonus)) {
        const divisor = Number.isFinite(normalized.per) && normalized.per > 0 ? normalized.per : 1;
        normalized.perCount = {};
        Object.entries(normalized.bonus).forEach(([key, value]) => {
            if (typeof value === 'number') {
                normalized.perCount[key] = value / divisor;
            }
        });
        issues.push(`${issuePrefix} 使用旧写法 per + bonus，已自动转换为 perCount`);
    }

    if (normalized.type === 'tech_count_bonus' && !isPlainObject(normalized.perTech) && isPlainObject(normalized.bonus)) {
        const divisor = Number.isFinite(normalized.per) && normalized.per > 0 ? normalized.per : 1;
        normalized.perTech = {};
        Object.entries(normalized.bonus).forEach(([key, value]) => {
            if (typeof value === 'number') {
                normalized.perTech[key] = value / divisor;
            }
        });
        issues.push(`${issuePrefix} 使用旧写法 per + bonus，已自动转换为 perTech`);
    }

    if (normalized.type === 'resource_threshold' && (isPlainObject(normalized.above) || isPlainObject(normalized.below))) {
        // above/below format is fully supported at runtime, no issue needed
    }

    return normalized;
}

function normalizeRuleMod(ruleMod, ideologyId, levelIndex, ruleIndex, issues) {
    if (!isPlainObject(ruleMod) || !ruleMod.type) {
        issues.push(`[${ideologyId}] levels[${levelIndex}].ruleMods[${ruleIndex}] 缺少有效 type`);
        return null;
    }
    const normalizedType = RULE_MOD_ALIASES[ruleMod.type] || ruleMod.type;
    if (normalizedType !== ruleMod.type) {
        issues.push(`[${ideologyId}] levels[${levelIndex}].ruleMods[${ruleIndex}] 使用别名 ${ruleMod.type}，已归一化为 ${normalizedType}`);
    }
    if (!RULE_MOD_TYPES.has(normalizedType)) {
        issues.push(`[${ideologyId}] levels[${levelIndex}].ruleMods[${ruleIndex}] 使用未知 type: ${ruleMod.type}`);
    }
    return { ...ruleMod, type: normalizedType };
}

function normalizeEventDef(eventDef, ideologyId, levelIndex, eventIndex, issues) {
    if (!isPlainObject(eventDef) || !eventDef.event || !eventDef.effect) {
        issues.push(`[${ideologyId}] levels[${levelIndex}].onEvents[${eventIndex}] 缺少有效 event/effect`);
        return null;
    }

    const normalized = {
        ...eventDef,
        effect: cloneEffectMap(eventDef.effect),
    };
    const issuePrefix = `[${ideologyId}] levels[${levelIndex}].onEvents[${eventIndex}]`;
    const normalizedEvent = EVENT_ALIASES[normalized.event] || normalized.event;
    if (normalizedEvent !== normalized.event) {
        issues.push(`${issuePrefix} 使用事件别名 ${normalized.event}，已归一化为 ${normalizedEvent}`);
        normalized.event = normalizedEvent;
    }

    if (normalized.cooldown != null && normalized.cooldownDays == null) {
        normalized.cooldownDays = normalized.cooldown;
        delete normalized.cooldown;
        issues.push(`${issuePrefix} 使用旧字段 cooldown，已归一化为 cooldownDays`);
    }

    if (normalized.effect?.action === 'addBuff' && normalized.effect.durationDays != null && normalized.effect.duration == null) {
        normalized.effect.duration = normalized.effect.durationDays;
        delete normalized.effect.durationDays;
        issues.push(`${issuePrefix} addBuff 使用旧字段 durationDays，已归一化为 duration`);
    }

    if (normalized.effect?.action === 'modifyBonus') {
        if (!normalized.effect.bonusKey && normalized.effect.target) {
            normalized.effect.bonusKey = normalized.effect.target;
            issues.push(`${issuePrefix} modifyBonus 使用旧字段 target，已归一化为 bonusKey`);
        }
        if (normalized.effect.amount == null && normalized.effect.value != null) {
            normalized.effect.amount = normalized.effect.value;
            issues.push(`${issuePrefix} modifyBonus 使用旧字段 value，已归一化为 amount`);
        }
        if (normalized.effect.amount == null && normalized.effect.bonus != null) {
            normalized.effect.amount = normalized.effect.bonus;
            issues.push(`${issuePrefix} modifyBonus 使用旧字段 bonus，已归一化为 amount`);
        }
    }

    return normalized;
}

function normalizeLevel(level, ideologyId, levelIndex, issues) {
    if (!isPlainObject(level)) {
        issues.push(`[${ideologyId}] levels[${levelIndex}] 不是对象`);
        return {};
    }

    const normalized = cloneEffectMap(level);

    if (Array.isArray(level.onEvents)) {
        normalized.onEvents = level.onEvents
            .map((eventDef, eventIndex) => normalizeEventDef(eventDef, ideologyId, levelIndex, eventIndex, issues))
            .filter(Boolean);
    }

    if (Array.isArray(level.converters)) {
        normalized.converters = level.converters
            .filter(Boolean)
            .map((converter) => (isPlainObject(converter) ? { ...converter } : converter));
    }

    if (Array.isArray(level.ruleMods)) {
        normalized.ruleMods = level.ruleMods
            .map((ruleMod, ruleIndex) => normalizeRuleMod(ruleMod, ideologyId, levelIndex, ruleIndex, issues))
            .filter(Boolean);
    }

    if (Array.isArray(level.triggerEffects)) {
        normalized.triggerEffects = level.triggerEffects
            .map((trigger, triggerIndex) => normalizeTriggerEffect(trigger, ideologyId, `${levelIndex}.triggerEffects[${triggerIndex}]`, issues))
            .filter(Boolean);
    }

    return normalized;
}

export function normalizeIdeologyDefinitions(ideologies = []) {
    const issues = [];
    const normalizedIdeologies = ideologies.map((ideology, ideologyIndex) => {
        if (!isPlainObject(ideology) || !ideology.id) {
            issues.push(`[index:${ideologyIndex}] 理念缺少 id`);
            return ideology;
        }

        const normalized = {
            ...ideology,
            effects: {
                ...(ideology.effects || {}),
            },
        };

        const levels = Array.isArray(ideology.effects?.levels)
            ? ideology.effects.levels.map((level, levelIndex) => normalizeLevel(level, ideology.id, levelIndex, issues))
            : [];
        normalized.effects.levels = levels;

        const sharedTriggerEffects = Array.isArray(ideology.effects?.triggerEffects)
            ? ideology.effects.triggerEffects
                .map((trigger, triggerIndex) => normalizeTriggerEffect(trigger, ideology.id, triggerIndex, issues))
                .filter(Boolean)
            : [];

        if (sharedTriggerEffects.length > 0) {
            if (!normalized.effects.levels[0]) {
                normalized.effects.levels[0] = {};
            }
            normalized.effects.levels[0].triggerEffects = [
                ...(normalized.effects.levels[0].triggerEffects || []),
                ...sharedTriggerEffects,
            ];
        }

        normalized.effects.triggerEffects = [];

        return normalized;
    });

    return {
        ideologies: normalizedIdeologies,
        issues,
    };
}

export function normalizeSynergyDefinitions(entries = [], kind = 'synergy') {
    const issues = [];
    const seenIds = new Map();

    const normalizedEntries = entries.map((entry, index) => {
        if (!isPlainObject(entry) || !entry.id) {
            issues.push(`[${kind}:${index}] 缺少 id`);
            return entry;
        }

        const normalized = {
            ...entry,
            effects: cloneEffectMap(entry.effects),
        };

        const previousCount = seenIds.get(normalized.id) || 0;
        if (previousCount > 0) {
            const nextId = `${normalized.id}_${previousCount + 1}`;
            issues.push(`[${kind}:${normalized.id}] 检测到重复 id，已重命名为 ${nextId}`);
            normalized.id = nextId;
        }
        seenIds.set(entry.id, previousCount + 1);

        if (normalized.mechanicEffect && !isPlainObject(normalized.mechanicEffect)) {
            issues.push(`[${kind}:${normalized.id}] mechanicEffect 不是对象，已忽略`);
            delete normalized.mechanicEffect;
        } else if (normalized.mechanicEffect) {
            normalized.mechanicEffect = { ...normalized.mechanicEffect };
        }

        return normalized;
    });

    return {
        entries: normalizedEntries,
        issues,
    };
}

export function reportIdeologyDslIssues(scope, issues = []) {
    if (!Array.isArray(issues) || issues.length === 0) return;

    if (typeof window !== 'undefined') {
        const existing = Array.isArray(window.__IDEOLOGY_DSL_ISSUES) ? window.__IDEOLOGY_DSL_ISSUES : [];
        window.__IDEOLOGY_DSL_ISSUES = [...existing, ...issues.map(issue => `${scope}: ${issue}`)];
    }

    console.error(`[Ideology DSL] ${scope} detected ${issues.length} issue(s)`);
    issues.slice(0, 20).forEach(issue => {
        console.error(`[Ideology DSL] ${scope} ${issue}`);
    });
    if (issues.length > 20) {
        console.error(`[Ideology DSL] ${scope} 其余 ${issues.length - 20} 条已省略`);
    }
}
