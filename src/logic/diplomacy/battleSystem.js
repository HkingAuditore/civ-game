import { UNIT_TYPES, calculateCounterBonus } from '../../config/militaryUnits';
import { getGeneralBonuses, NO_GENERAL_PENALTY, selectPrimaryBattleCorps } from './corpsSystem';
import { getZoneForPosition } from './frontSystem';

const CATEGORY_LABELS = {
    infantry: '步兵',
    cavalry: '骑兵',
    archer: '远程',
    gunpowder: '火器',
    siege: '攻城',
};

const LEGACY_TYPE_TO_ENGAGEMENT = {
    skirmish: 'probe',
    pitched_battle: 'assault',
    siege: 'siege',
};

const ENGAGEMENT_TYPES = {
    probe: {
        name: '试探接敌',
        duration: [5, 15],
        phaseTemplate: ['接敌试探', '局部拉扯', '脱离判定'],
        baseCasualtyRate: 0.012,
        dailyCasualtyRate: 0.003,
        lineImpact: 1.1,
        warScoreImpact: 0.8,
        moraleSwing: 5,
        targetPhaseDays: 3,
    },
    assault: {
        name: '主力决战',
        duration: [15, 120],
        phaseTemplate: ['前锋接敌', '主力相持', '优势扩张', '决胜压迫'],
        baseCasualtyRate: 0.028,
        dailyCasualtyRate: 0.006,
        lineImpact: 1.8,
        warScoreImpact: 1.4,
        moraleSwing: 10,
        targetPhaseDays: 6,
    },
    siege: {
        name: '攻坚围城',
        duration: [50, 300],
        phaseTemplate: ['合围布势', '炮击消耗', '突破攻坚', '守军崩溃'],
        baseCasualtyRate: 0.008,
        dailyCasualtyRate: 0.002,
        lineImpact: 1.2,
        warScoreImpact: 1.7,
        moraleSwing: 6,
        targetPhaseDays: 14,
        needsSiege: true,
    },
};

const BATTLE_PLANS = {
    steady: {
        id: 'steady',
        name: '稳步推进',
        desc: '压低伤亡和补给压力，缓慢积累优势。',
        attack: 1.02,
        defense: 1.05,
        casualtyTaken: 0.88,
        casualtyInflict: 0.96,
        line: 0.9,
        morale: 1.06,
        supply: 0.94,
    },
    shock: {
        id: 'shock',
        name: '集中突击',
        desc: '追求突破和战分，但更吃补给也更容易失血。',
        attack: 1.18,
        defense: 0.92,
        casualtyTaken: 1.18,
        casualtyInflict: 1.16,
        line: 1.28,
        morale: 0.96,
        supply: 1.18,
    },
    hold: {
        id: 'hold',
        name: '固守消耗',
        desc: '用阵地和时间换取稳态，适合拖住敌军。',
        attack: 0.88,
        defense: 1.2,
        casualtyTaken: 0.82,
        casualtyInflict: 0.9,
        line: 0.68,
        morale: 1.14,
        supply: 0.9,
    },
    withdraw: {
        id: 'withdraw',
        name: '有序脱离',
        desc: '优先保存兵力并尽快脱离会战。',
        attack: 0.6,
        defense: 0.84,
        casualtyTaken: 0.76,
        casualtyInflict: 0.64,
        line: 0.32,
        morale: 1.02,
        supply: 0.82,
    },
};

const TACTICS = BATTLE_PLANS;
const BASE_SUPPLY_COST = {
    food: 0.5,
    silver: 0.3,
};

let battleIdCounter = 0;

const randomInt = (min, max) => min + Math.floor(Math.random() * Math.max(1, max - min + 1));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getEngagementType = (engagementType, battleType) => (
    ENGAGEMENT_TYPES[engagementType]
        ? engagementType
        : LEGACY_TYPE_TO_ENGAGEMENT[battleType] || 'assault'
);

const getPlan = (planId) => BATTLE_PLANS[planId] || BATTLE_PLANS.steady;

const getTotalUnits = (units) => (
    Object.values(units || {}).reduce((sum, count) => sum + (count || 0), 0)
);

const cloneUnits = (units = {}) => ({ ...units });

const buildCategoryProfile = (units = {}) => {
    const profile = {
        totals: {
            infantry: 0,
            cavalry: 0,
            ranged: 0,
            gunpowder: 0,
            siege: 0,
        },
        attack: 0,
        defense: 0,
        totalUnits: 0,
    };

    Object.entries(units).forEach(([unitId, count]) => {
        if (!count) return;
        const unit = UNIT_TYPES[unitId];
        if (!unit) return;
        profile.totalUnits += count;
        profile.attack += Number(unit.attack || 0) * count;
        profile.defense += Number(unit.defense || 0) * count;
        if (unit.category === 'infantry') profile.totals.infantry += count;
        if (unit.category === 'cavalry') profile.totals.cavalry += count;
        if (unit.category === 'archer') profile.totals.ranged += count;
        if (unit.category === 'gunpowder') {
            profile.totals.ranged += count;
            profile.totals.gunpowder += count;
        }
        if (unit.category === 'siege') profile.totals.siege += count;
    });

    return profile;
};

const getDominantCategory = (profile = {}) => {
    const entries = Object.entries(profile.totals || {}).filter(([key]) => key !== 'gunpowder');
    if (entries.length === 0) return null;
    const [category, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return count > 0 ? category : null;
};

const buildCounterSummary = (ownProfile, enemyProfile, engagementType, ownCounterData, enemyCounterData) => {
    const ownDominant = getDominantCategory(ownProfile);
    const enemyDominant = getDominantCategory(enemyProfile);
    const ownCounterCount = Number(ownCounterData?.counterCount || 0);
    const enemyCounterCount = Number(enemyCounterData?.counterCount || 0);

    if (engagementType === 'siege' && (ownProfile?.totals?.siege || 0) <= 0) {
        return '我方缺少攻城兵种，这场攻坚主要靠消耗，突破效率会很低。';
    }
    if (engagementType === 'siege' && (enemyProfile?.totals?.siege || 0) <= 0) {
        return '敌方缺乏攻城兵种，更难在围城里完成有效突破。';
    }
    if (!ownDominant && !enemyDominant) return '双方暂未形成明显兵种压制。';
    if (ownCounterCount === enemyCounterCount && ownCounterCount === 0) {
        return `双方都以${CATEGORY_LABELS[ownDominant] || '主力'}为主，暂时没有明显克制链。`;
    }
    if (ownCounterCount > enemyCounterCount) {
        return `我方${CATEGORY_LABELS[ownDominant] || '主力'}更能压制敌方${CATEGORY_LABELS[enemyDominant] || '编组'}。`;
    }
    if (enemyCounterCount > ownCounterCount) {
        return `敌方${CATEGORY_LABELS[enemyDominant] || '主力'}对我方${CATEGORY_LABELS[ownDominant] || '编组'}更有针对性。`;
    }
    return '双方兵种克制大体相互抵消，更多取决于补给和将领。';
};

const getZoneCombatModifiers = (role, linePosition, zone, engagementType) => {
    const attackDepth = role === 'attacker'
        ? Math.max(0, (linePosition - 50) / 50)
        : Math.max(0, (50 - linePosition) / 50);
    const defenseDepth = role === 'attacker'
        ? Math.max(0, (50 - linePosition) / 50)
        : Math.max(0, (linePosition - 50) / 50);

    let attack = 1 - attackDepth * 0.12;
    let defense = 1 - attackDepth * 0.08 + defenseDepth * 0.08;
    let line = 1 - attackDepth * 0.1;

    if (zone?.category === 'capital' && attackDepth > 0) {
        attack *= engagementType === 'siege' ? 0.94 : 0.9;
        defense *= 0.92;
        line *= 0.86;
    }
    if (zone?.category === 'economic' && attackDepth > 0) {
        attack *= 0.97;
        line *= 0.94;
    }
    if (zone?.category === 'capital' && defenseDepth > 0) {
        defense *= 1.12;
    }

    return {
        attack: clamp(attack, 0.78, 1.15),
        defense: clamp(defense, 0.8, 1.18),
        line: clamp(line, 0.72, 1.08),
    };
};

const normalizeSupplyState = (state = {}) => ({
    ratio: clamp(Number(state.ratio ?? 1), 0, 1),
    state: state.state || '稳定',
    hasEnoughSupply: state.hasEnoughSupply !== false,
});

const getSupplyModifiers = (supplyState = {}, plan = BATTLE_PLANS.steady) => {
    const ratio = clamp(Number(supplyState.ratio ?? 1), 0, 1);
    let attack = (0.8 + ratio * 0.2) / Math.max(0.7, Number(plan.supply || 1));
    let defense = (0.84 + ratio * 0.16) / Math.max(0.75, Number(plan.supply || 1));
    let morale = 1;

    if (supplyState.hasEnoughSupply === false) {
        attack *= 0.9;
        defense *= 0.94;
        morale *= 0.94;
    }
    if (supplyState.state === '吃紧') {
        attack *= 0.94;
        defense *= 0.96;
        morale *= 0.97;
    }
    if (supplyState.state === '断裂') {
        attack *= 0.84;
        defense *= 0.88;
        morale *= 0.9;
    }

    return {
        attack: clamp(attack, 0.62, 1.08),
        defense: clamp(defense, 0.66, 1.08),
        morale: clamp(morale, 0.82, 1.02),
    };
};

const buildPhaseSchedule = (engagementTypeId) => {
    const engagement = ENGAGEMENT_TYPES[engagementTypeId] || ENGAGEMENT_TYPES.assault;
    const [minDays, maxDays] = engagement.duration;
    const totalDays = randomInt(minDays, maxDays);
    const phaseCount = Math.max(
        engagement.phaseTemplate.length,
        Math.round(totalDays / engagement.targetPhaseDays)
    );
    const baseDuration = Math.max(2, Math.floor(totalDays / phaseCount));
    let remaining = totalDays;

    const schedule = Array.from({ length: phaseCount }).map((_, index) => {
        const phasesLeft = phaseCount - index;
        const duration = index === phaseCount - 1
            ? remaining
            : Math.max(2, Math.min(remaining - (phasesLeft - 1) * 2, baseDuration + randomInt(-1, 2)));
        remaining -= duration;
        const templateIndex = Math.min(index, engagement.phaseTemplate.length - 1);
        return {
            index,
            label: engagement.phaseTemplate[templateIndex],
            duration,
        };
    });

    return {
        totalDays,
        schedule,
    };
};

const buildFrontSnapshot = (front) => {
    const linePosition = Number(front?.linePosition || 50);
    const zone = getZoneForPosition(linePosition);
    return {
        linePosition,
        zoneName: zone?.name || '边境接触',
        zoneCategory: zone?.category || 'frontier',
    };
};

const buildInitialAnalysis = (battle) => ({
    currentStage: battle.phase || '接敌试探',
    durationBand: `${battle.expectedDuration.min}-${battle.expectedDuration.max}天`,
    counterSummary: '双方正在重新编组，尚未形成明确压制。',
    outcomeSummary: `${battle.engagementName}刚开始，双方正在试探阵形和火力。`,
});

const getFrontLinePosition = (battle, context = {}) => {
    const position = Number(context?.front?.linePosition ?? battle.frontSnapshot?.linePosition ?? 50);
    return clamp(position, 0, 100);
};

const buildBattleContext = (battle, context = {}) => {
    const linePosition = getFrontLinePosition(battle, context);
    const zone = getZoneForPosition(linePosition);
    return {
        linePosition,
        zone,
        supply: {
            attacker: normalizeSupplyState(context?.supply?.attacker),
            defender: normalizeSupplyState(context?.supply?.defender),
        },
    };
};

const calculateSideStrength = ({
    side,
    enemy,
    general,
    role,
    battle,
    battleContext,
}) => {
    const profile = buildCategoryProfile(side.currentUnits);
    const enemyProfile = buildCategoryProfile(enemy.currentUnits);
    const plan = getPlan(battle.battlePlan?.[role]);
    const counterData = calculateCounterBonus(side.currentUnits || {}, enemy.currentUnits || {});
    const generalBonuses = general ? getGeneralBonuses(general) : null;
    const generalAttack = generalBonuses ? (1 + generalBonuses.attackBonus) : NO_GENERAL_PENALTY;
    const generalDefense = generalBonuses ? (1 + generalBonuses.defenseBonus) : NO_GENERAL_PENALTY;
    const supplyMod = getSupplyModifiers(battleContext.supply?.[role], plan);
    const zoneMod = getZoneCombatModifiers(role, battleContext.linePosition, battleContext.zone, battle.engagementType);
    const counterMultiplier = clamp(Number(counterData.multiplier || 1), 0.80, 1.45);
    const siegePenalty = battle.engagementType === 'siege' && (profile.totals.siege || 0) <= 0 ? 0.78 : 1;

    const attackScore = profile.attack
        * plan.attack
        * generalAttack
        * supplyMod.attack
        * zoneMod.attack
        * counterMultiplier
        * siegePenalty;

    const defenseScore = profile.defense
        * plan.defense
        * generalDefense
        * supplyMod.defense
        * zoneMod.defense;

    return {
        profile,
        enemyProfile,
        plan,
        counterData,
        counterMultiplier,
        supplyMod,
        zoneMod,
        attackScore,
        defenseScore,
        morale: Number(side.morale || 100),
        effectiveScore: attackScore * 0.58 + defenseScore * 0.42,
    };
};

const calculatePhaseOutcome = (battle, attackerState, defenderState, battleContext) => {
    const engagement = ENGAGEMENT_TYPES[battle.engagementType] || ENGAGEMENT_TYPES.assault;
    const phaseConfig = battle.phaseSchedule[battle.phaseIndex] || battle.phaseSchedule[battle.phaseSchedule.length - 1];
    const phasePressure = 0.8 + (battle.phaseIndex / Math.max(1, battle.phaseSchedule.length - 1)) * 0.35;

    const attackerScore = Math.max(1, attackerState.effectiveScore * (0.65 + attackerState.morale / 150));
    const defenderScore = Math.max(1, defenderState.effectiveScore * (0.65 + defenderState.morale / 150));
    // 增强随机波动 ±15%
    const randomFactor = 0.85 + Math.random() * 0.30;
    const scoreShare = (attackerScore * randomFactor) / Math.max(1, attackerScore * randomFactor + defenderScore * (2 - randomFactor));
    const advantage = clamp((scoreShare - 0.5) * 2, -1, 1);

    const attackerUnits = Math.max(1, attackerState.profile.totalUnits);
    const defenderUnits = Math.max(1, defenderState.profile.totalUnits);

    // [FIX Bug13] 兵力比修正：当一方兵力远超对方时，弱势方对强势方造成的损失受限
    // ratio > 1 表示攻方人多，ratio < 1 表示守方人多
    const forceRatio = attackerUnits / defenderUnits;
    // 对攻方：如果攻方远多于守方，守方能造成的损伤比例下降
    // 例如 10000 vs 100 时，forceRatio = 100，dampenAttacker ≈ 0.1（大幅降低攻方损失率）
    const dampenAttacker = forceRatio > 1 ? Math.min(1, 1 / Math.sqrt(forceRatio)) : 1;
    // 对守方：如果守方远多于攻方，攻方能造成的损伤比例下降
    const dampenDefender = forceRatio < 1 ? Math.min(1, Math.sqrt(forceRatio)) : 1;

    const attackerLossRate = engagement.baseCasualtyRate
        * phasePressure
        * (1.02 - advantage * 0.3)
        * defenderState.plan.casualtyInflict
        * attackerState.plan.casualtyTaken
        * dampenAttacker; // [FIX Bug13] 兵力优势修正
    const defenderLossRate = engagement.baseCasualtyRate
        * phasePressure
        * (0.98 + advantage * 0.3)
        * attackerState.plan.casualtyInflict
        * defenderState.plan.casualtyTaken
        * dampenDefender; // [FIX Bug13] 兵力优势修正

    // [FIX Bug13] 动态保底战损率：根据兵力比动态调整，避免碾压局下大军团反而损失更大
    // 保底从 0.3% 降到最低 0.05%（兵力碾压10:1时）
    const attackerMinRate = Math.max(0.0005, 0.003 * dampenAttacker);
    const defenderMinRate = Math.max(0.0005, 0.003 * dampenDefender);

    // [FIX Bug13] 伤害上限：一方的绝对伤害不能超过对方兵力的合理比例
    // 防止 "万人大军每阶段自损30人而敌方百人残部也损失30人" 的悖论
    const attackerMaxAbsLoss = Math.max(1, Math.ceil(defenderUnits * 0.5)); // 攻方损失不超过守方兵力的50%
    const defenderMaxAbsLoss = Math.max(1, Math.ceil(attackerUnits * 0.5)); // 守方损失不超过攻方兵力的50%

    const attackerLossTarget = attackerUnits <= 1
        ? 0
        : Math.min(
            attackerMaxAbsLoss,
            // [FIX] 去掉固定保底1人：当守方兵力极少时，攻方损失应接近0
            // 改为：计算结果 < 1 时直接取0，避免"1人守军每阶段必杀1人"
            Math.min(attackerUnits - 1, Math.round(attackerUnits * clamp(attackerLossRate, attackerMinRate, 0.07)))
        );
    const defenderLossTarget = defenderUnits <= 1
        ? 0
        : Math.min(
            defenderMaxAbsLoss,
            // [FIX] 同上
            Math.min(defenderUnits - 1, Math.round(defenderUnits * clamp(defenderLossRate, defenderMinRate, 0.08)))
        );

    const momentumShift = clamp(Math.round(advantage * (engagement.engagementMomentum || 12 || 12)), -10, 10);
    const lineShiftRaw = advantage
        * engagement.lineImpact
        * attackerState.plan.line
        * attackerState.zoneMod.line
        * (battle.engagementType === 'siege' ? 0.75 : 1);
    const lineShift = Number(lineShiftRaw.toFixed(1));
    const warScoreDelta = Math.round(
        advantage * engagement.warScoreImpact * 6
        + (lineShift > 0 ? 1 : lineShift < 0 ? -1 : 0)
    );

    // Morale swing multiplier reduced from 100 to 40 to slow down morale collapse and extend battle duration
    const attackerMoraleShift = Math.round(
        -(attackerLossTarget / attackerUnits) * engagement.moraleSwing * 40 * (2 - attackerState.plan.morale)
        + (advantage > 0 ? 1 : advantage < 0 ? -2 : 0)
    );
    const defenderMoraleShift = Math.round(
        -(defenderLossTarget / defenderUnits) * engagement.moraleSwing * 40 * (2 - defenderState.plan.morale)
        + (advantage < 0 ? 1 : advantage > 0 ? -2 : 0)
    );

    return {
        advantage,
        attackerLossTarget,
        defenderLossTarget,
        momentumShift,
        lineShift,
        warScoreDelta,
        attackerMoraleShift,
        defenderMoraleShift,
        phaseLabel: phaseConfig?.label || battle.phase,
        outcomeSummary: advantage > 0.22
            ? '我方在这一阶段打出了明显优势。'
            : advantage < -0.22
                ? '敌方在这一阶段压住了我方。'
                : '这一阶段双方仍在相持拉扯。',
        counterSummary: buildCounterSummary(
            attackerState.profile,
            defenderState.profile,
            battle.engagementType,
            attackerState.counterData,
            defenderState.counterData
        ),
    };
};

const applyLosses = (units = {}, targetLosses = 0, enemyCounterData = {}) => {
    const nextUnits = cloneUnits(units);
    const losses = {};
    let remaining = Math.max(0, Math.round(targetLosses));
    const entries = Object.entries(nextUnits)
        .map(([unitId, count]) => {
            const unit = UNIT_TYPES[unitId];
            const pressure = Number(enemyCounterData?.counters?.[unit?.category] || 1);
            return {
                unitId,
                count,
                weight: Math.max(1, count * pressure),
            };
        })
        .filter((entry) => entry.count > 0);

    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (remaining <= 0 || totalWeight <= 0) {
        return { nextUnits, losses };
    }

    entries.forEach((entry, index) => {
        if (remaining <= 0) return;
        const raw = index === entries.length - 1
            ? remaining
            : Math.round((entry.weight / totalWeight) * targetLosses);
        const loss = clamp(raw, 0, Math.min(entry.count, remaining));
        if (loss <= 0) return;
        nextUnits[entry.unitId] = Math.max(0, entry.count - loss);
        if (nextUnits[entry.unitId] <= 0) delete nextUnits[entry.unitId];
        losses[entry.unitId] = loss;
        remaining -= loss;
    });

    if (remaining > 0 && entries.length > 0) {
        const fallback = entries.sort((a, b) => b.count - a.count)[0];
        if (fallback) {
            const current = Number(nextUnits[fallback.unitId] || 0);
            const extraLoss = Math.min(current, remaining);
            if (extraLoss > 0) {
                nextUnits[fallback.unitId] = current - extraLoss;
                if (nextUnits[fallback.unitId] <= 0) delete nextUnits[fallback.unitId];
                losses[fallback.unitId] = (losses[fallback.unitId] || 0) + extraLoss;
            }
        }
    }

    return { nextUnits, losses };
};

const mergeLossMaps = (base = {}, add = {}) => {
    const merged = { ...base };
    Object.entries(add || {}).forEach(([unitId, count]) => {
        merged[unitId] = (merged[unitId] || 0) + count;
    });
    return merged;
};

const buildOutcomeSummary = ({
    battle,
    phaseOutcome,
    attackerState,
    defenderState,
    battleContext,
}) => {
    const zoneName = battleContext.zone?.name || '边境接触';
    const ownCounter = phaseOutcome.counterSummary;
    const lineText = phaseOutcome.lineShift > 0.2
        ? '这会把战线继续往敌方方向推。'
        : phaseOutcome.lineShift < -0.2
            ? '这会让敌军继续把战线压回我方。'
            : '这阶段更多是在消耗，战线位移不会太大。';
    return `${battle.engagementName}进入${phaseOutcome.phaseLabel}，战场位于${zoneName}。${ownCounter}${lineText}`;
};

const finalizeBattleResult = (battle, result) => ({
    ...result,
    finalized: true,
    totalRounds: battle.currentRound,
    totalDays: battle.currentRound,
    finalMomentum: battle.momentum,
    attackerSurvivors: cloneUnits(battle.attacker.currentUnits),
    defenderSurvivors: cloneUnits(battle.defender.currentUnits),
    attackerCasualties: { ...battle.attacker.totalCasualties },
    defenderCasualties: { ...battle.defender.totalCasualties },
    totalLineShift: Number((battle.totalLineShift || 0).toFixed(1)),
    totalWarScoreDelta: Math.round(Number(battle.totalWarScoreDelta || 0)),
});

// 追击歼灭：会战结束时根据优势程度对败方施加额外追击损失
const applyPursuitLosses = (battle, winner, reason) => {
    const loserSide = winner === 'attacker' ? 'defender' : 'attacker';
    const winnerSide = winner;
    const loserUnits = getTotalUnits(battle[loserSide].currentUnits);
    const winnerUnits = getTotalUnits(battle[winnerSide].currentUnits);
    if (loserUnits <= 0 || winnerUnits <= 0) return;

    const loserMorale = Number(battle[loserSide].morale || 0);
    const momentum = Number(battle.momentum || 50);
    // 追击强度取决于：胜者兵力优势、败者士气低迷、动量差距
    const forceRatio = winnerUnits / Math.max(1, loserUnits);
    const momentumAdvantage = winner === 'attacker'
        ? Math.max(0, momentum - 50) / 50
        : Math.max(0, 50 - momentum) / 50;
    const moralePenalty = Math.max(0, (40 - loserMorale) / 40); // 败方士气<40时加重

    // 基础追击率：annihilation/morale_collapse才有大追击，withdrawal/timeout追击弱
    let basePursuitRate = 0;
    if (reason === 'annihilation') basePursuitRate = 0.4;
    else if (reason === 'morale_collapse') basePursuitRate = 0.3;
    else if (reason === 'withdrawal') basePursuitRate = 0.05;
    else if (reason === 'timeout') basePursuitRate = 0.08;

    // probe交战追击减弱（小规模冲突不易包围歼灭）
    if (battle.engagementType === 'probe') basePursuitRate *= 0.4;
    // assault交战追击增强
    if (battle.engagementType === 'assault') basePursuitRate *= 1.3;

    const pursuitRate = clamp(
        basePursuitRate * (1 + momentumAdvantage * 0.5 + moralePenalty * 0.5) * Math.min(2, Math.sqrt(forceRatio)),
        0,
        0.45
    );
    const pursuitLossTarget = Math.max(0, Math.round(loserUnits * pursuitRate));
    if (pursuitLossTarget <= 0) return;

    const applied = applyLosses(battle[loserSide].currentUnits, pursuitLossTarget, {});
    battle[loserSide].currentUnits = applied.nextUnits;
    battle[loserSide].totalCasualties = mergeLossMaps(battle[loserSide].totalCasualties, applied.losses);
};

const maybeFinalizeBattle = (battle) => {
    const attackerUnits = getTotalUnits(battle.attacker.currentUnits);
    const defenderUnits = getTotalUnits(battle.defender.currentUnits);
    const attackerInitial = Math.max(1, getTotalUnits(battle.attacker.initialUnits));
    const defenderInitial = Math.max(1, getTotalUnits(battle.defender.initialUnits));

    const attackerCollapseThreshold = 5;
    const defenderCollapseThreshold = 5;

    if (battle.attacker.withdrawRequested && battle.currentRound >= battle.attacker.withdrawRequestedDay + 3) {
        applyPursuitLosses(battle, 'defender', 'withdrawal');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'defender', reason: 'withdrawal' });
        return battle;
    }
    if (battle.defender.withdrawRequested && battle.currentRound >= battle.defender.withdrawRequestedDay + 3) {
        applyPursuitLosses(battle, 'attacker', 'withdrawal');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'attacker', reason: 'withdrawal' });
        return battle;
    }
    if (attackerUnits <= 0 || attackerUnits <= Math.max(1, Math.floor(attackerInitial * 0.05))) {
        applyPursuitLosses(battle, 'defender', 'annihilation');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'defender', reason: 'annihilation' });
        return battle;
    }
    if (defenderUnits <= 0 || defenderUnits <= Math.max(1, Math.floor(defenderInitial * 0.05))) {
        applyPursuitLosses(battle, 'attacker', 'annihilation');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'attacker', reason: 'annihilation' });
        return battle;
    }
    if (battle.attacker.morale <= attackerCollapseThreshold) {
        applyPursuitLosses(battle, 'defender', 'morale_collapse');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'defender', reason: 'morale_collapse' });
        return battle;
    }
    if (battle.defender.morale <= defenderCollapseThreshold) {
        applyPursuitLosses(battle, 'attacker', 'morale_collapse');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, { winner: 'attacker', reason: 'morale_collapse' });
        return battle;
    }
    if (battle.currentRound >= battle.totalDays) {
        const winner = battle.momentum >= 50 ? 'attacker' : 'defender';
        applyPursuitLosses(battle, winner, 'timeout');
        battle.status = 'ended';
        battle.result = finalizeBattleResult(battle, {
            winner,
            reason: 'timeout',
        });
        return battle;
    }
    return battle;
};

// 合并多个兵团的兵力为一个聚合单位表
const mergeCorpsUnits = (corpsList = []) => {
    const merged = {};
    for (const corps of corpsList) {
        for (const [unitId, count] of Object.entries(corps?.units || {})) {
            merged[unitId] = (merged[unitId] || 0) + (count || 0);
        }
    }
    return merged;
};

export const createBattle = ({
    attackerCorps,
    defenderCorps,
    attackerGeneral = null,
    defenderGeneral = null,
    // 多兵团参战支持：传入数组则合并所有兵团兵力
    attackerCorpsList = null,
    defenderCorpsList = null,
    front,
    battleType = 'pitched_battle',
    engagementType = null,
    battlePlan = {},
    epoch = 0,
    currentDay = 0,
}) => {
    // 多兵团模式：合并所有兵团的兵力
    const atkCorpsList = attackerCorpsList || (attackerCorps ? [attackerCorps] : []);
    const defCorpsList = defenderCorpsList || (defenderCorps ? [defenderCorps] : []);
    const primaryAttacker = atkCorpsList[0] || attackerCorps;
    const primaryDefender = defCorpsList[0] || defenderCorps;
    const mergedAttackerUnits = atkCorpsList.length > 1 ? mergeCorpsUnits(atkCorpsList) : cloneUnits(primaryAttacker?.units || {});
    const mergedDefenderUnits = defCorpsList.length > 1 ? mergeCorpsUnits(defCorpsList) : cloneUnits(primaryDefender?.units || {});
    const attackerTotal = getTotalUnits(mergedAttackerUnits);
    const defenderTotal = getTotalUnits(mergedDefenderUnits);
    if (attackerTotal <= 0 || defenderTotal <= 0) return null;

    // 多兵团平均士气
    const avgMorale = (list) => {
        if (list.length === 0) return 100;
        return list.reduce((s, c) => s + Number(c.morale || 100), 0) / list.length;
    };

    const resolvedEngagementType = getEngagementType(engagementType, battleType);
    const engagement = ENGAGEMENT_TYPES[resolvedEngagementType] || ENGAGEMENT_TYPES.assault;
    const { totalDays, schedule } = buildPhaseSchedule(resolvedEngagementType);
    const battlePlanState = {
        attacker: BATTLE_PLANS[battlePlan.attacker] ? battlePlan.attacker : 'steady',
        defender: BATTLE_PLANS[battlePlan.defender] ? battlePlan.defender : 'steady',
    };

    battleIdCounter += 1;
    const battle = {
        id: `battle_${Date.now()}_${battleIdCounter}`,
        frontId: front?.id || null,
        engagementType: resolvedEngagementType,
        engagementName: engagement.name,
        battleType: resolvedEngagementType,
        typeName: engagement.name,
        battlePlan: battlePlanState,
        currentRound: 0,
        totalDays,
        maxRounds: totalDays,
        phaseSchedule: schedule,
        phaseIndex: 0,
        phase: schedule[0]?.label || '接敌试探',
        phaseDayProgress: 0,
        phaseDaysRemaining: schedule[0]?.duration || 0,
        startDay: currentDay,
        epoch,
        status: 'active',
        attacker: {
            corpsId: primaryAttacker?.id || null,
            corpsName: atkCorpsList.length > 1
                ? atkCorpsList.map(c => c.name).join('、')
                : (primaryAttacker?.name || '攻方'),
            corpsIds: atkCorpsList.map(c => c.id).filter(Boolean),
            initialUnits: cloneUnits(mergedAttackerUnits),
            currentUnits: cloneUnits(mergedAttackerUnits),
            generalId: attackerGeneral?.id || primaryAttacker?.generalId || null,
            generalName: attackerGeneral?.name || null,
            morale: Math.round(avgMorale(atkCorpsList)),
            totalCasualties: {},
            plan: battlePlanState.attacker,
            withdrawRequested: false,
            withdrawRequestedDay: null,
        },
        defender: {
            corpsId: primaryDefender?.id || null,
            corpsName: defCorpsList.length > 1
                ? defCorpsList.map(c => c.name).join('、')
                : (primaryDefender?.name || '守方'),
            corpsIds: defCorpsList.map(c => c.id).filter(Boolean),
            initialUnits: cloneUnits(mergedDefenderUnits),
            currentUnits: cloneUnits(mergedDefenderUnits),
            generalId: defenderGeneral?.id || primaryDefender?.generalId || null,
            generalName: defenderGeneral?.name || null,
            morale: Math.round(avgMorale(defCorpsList)),
            totalCasualties: {},
            plan: battlePlanState.defender,
            withdrawRequested: false,
            withdrawRequestedDay: null,
        },
        momentum: 50,
        phaseReports: [],
        roundLog: [],
        totalLineShift: 0,
        totalWarScoreDelta: 0,
        lastResolvedPhaseDay: 0,
        latestPhaseOutcome: null,
        frontSnapshot: buildFrontSnapshot(front),
        expectedDuration: {
            min: engagement.duration[0],
            max: engagement.duration[1],
        },
        analysis: null,
        supplyConsumed: {
            attacker: {},
            defender: {},
        },
        result: null,
    };
    battle.analysis = buildInitialAnalysis(battle);
    return battle;
};

export const ensureBattleDefaults = (battle) => {
    if (!battle || typeof battle !== 'object') return battle;
    const resolvedEngagementType = getEngagementType(battle.engagementType, battle.battleType);
    const engagement = ENGAGEMENT_TYPES[resolvedEngagementType] || ENGAGEMENT_TYPES.assault;
    const totalDays = Number.isFinite(battle.totalDays) ? battle.totalDays : Number(battle.maxRounds || engagement.duration[1]);
    const phaseSchedule = Array.isArray(battle.phaseSchedule) && battle.phaseSchedule.length > 0
        ? battle.phaseSchedule
        : buildPhaseSchedule(resolvedEngagementType).schedule;
    const phaseIndex = clamp(Number(battle.phaseIndex || 0), 0, Math.max(0, phaseSchedule.length - 1));
    const phase = battle.phase || phaseSchedule[phaseIndex]?.label || '接敌试探';
    const battlePlan = {
        attacker: BATTLE_PLANS[battle.battlePlan?.attacker] ? battle.battlePlan.attacker : (BATTLE_PLANS[battle.attacker?.plan] ? battle.attacker.plan : 'steady'),
        defender: BATTLE_PLANS[battle.battlePlan?.defender] ? battle.battlePlan.defender : (BATTLE_PLANS[battle.defender?.plan] ? battle.defender.plan : 'steady'),
    };

    return {
        ...battle,
        engagementType: resolvedEngagementType,
        engagementName: battle.engagementName || engagement.name,
        battleType: battle.battleType || resolvedEngagementType,
        typeName: battle.typeName || engagement.name,
        totalDays,
        maxRounds: totalDays,
        phaseSchedule,
        phaseIndex,
        phase,
        phaseDayProgress: Number(battle.phaseDayProgress || 0),
        phaseDaysRemaining: Number.isFinite(battle.phaseDaysRemaining)
            ? battle.phaseDaysRemaining
            : Math.max(0, Number(phaseSchedule[phaseIndex]?.duration || 0) - Number(battle.phaseDayProgress || 0)),
        battlePlan,
        attacker: {
            ...(battle.attacker || {}),
            plan: battlePlan.attacker,
            currentUnits: cloneUnits(battle.attacker?.currentUnits || battle.attacker?.initialUnits || {}),
            initialUnits: cloneUnits(battle.attacker?.initialUnits || {}),
            totalCasualties: { ...(battle.attacker?.totalCasualties || {}) },
            withdrawRequested: battle.attacker?.withdrawRequested === true,
            withdrawRequestedDay: battle.attacker?.withdrawRequestedDay ?? null,
        },
        defender: {
            ...(battle.defender || {}),
            plan: battlePlan.defender,
            currentUnits: cloneUnits(battle.defender?.currentUnits || battle.defender?.initialUnits || {}),
            initialUnits: cloneUnits(battle.defender?.initialUnits || {}),
            totalCasualties: { ...(battle.defender?.totalCasualties || {}) },
            withdrawRequested: battle.defender?.withdrawRequested === true,
            withdrawRequestedDay: battle.defender?.withdrawRequestedDay ?? null,
        },
        totalLineShift: Number(battle.totalLineShift || 0),
        totalWarScoreDelta: Number(battle.totalWarScoreDelta || 0),
        lastResolvedPhaseDay: Number(battle.lastResolvedPhaseDay || 0),
        latestPhaseOutcome: battle.latestPhaseOutcome || null,
        phaseReports: Array.isArray(battle.phaseReports) ? battle.phaseReports : [],
        roundLog: Array.isArray(battle.roundLog) ? battle.roundLog : [],
        frontSnapshot: battle.frontSnapshot || buildFrontSnapshot(null),
        expectedDuration: battle.expectedDuration || { min: engagement.duration[0], max: engagement.duration[1] },
        analysis: battle.analysis || buildInitialAnalysis({
            ...battle,
            engagementType: resolvedEngagementType,
            engagementName: battle.engagementName || engagement.name,
            phase,
            expectedDuration: { min: engagement.duration[0], max: engagement.duration[1] },
        }),
    };
};

export const selectBattleParticipants = ({ attackerCorps = [], defenderCorps = [], generals = [] }) => {
    const attackerPick = selectPrimaryBattleCorps(attackerCorps, generals);
    const defenderPick = selectPrimaryBattleCorps(defenderCorps, generals);

    return {
        attacker: attackerPick ? {
            ...attackerPick,
            corps: {
                ...attackerPick.corps,
                battleSelectionReason: attackerPick.reason,
            },
        } : null,
        defender: defenderPick ? {
            ...defenderPick,
            corps: {
                ...defenderPick.corps,
                battleSelectionReason: defenderPick.reason,
            },
        } : null,
    };
};

export const processCombatRound = (battle, attackerGeneral = null, defenderGeneral = null, context = {}) => {
    const b = ensureBattleDefaults(battle);
    if (!b || b.status !== 'active') return b;

    b.currentRound += 1;
    b.phaseDayProgress += 1;
    b.phaseDaysRemaining = Math.max(0, Number(b.phaseDaysRemaining || 0) - 1);

    const battleContext = buildBattleContext(b, context);
    const attackerState = calculateSideStrength({
        side: b.attacker,
        enemy: b.defender,
        general: attackerGeneral,
        role: 'attacker',
        battle: b,
        battleContext,
    });
    const defenderState = calculateSideStrength({
        side: b.defender,
        enemy: b.attacker,
        general: defenderGeneral,
        role: 'defender',
        battle: b,
        battleContext,
    });

    // 每日小额伤亡：阶段未结算期间也造成持续战损，让兵力实时变化
    if (b.phaseDaysRemaining > 0) {
        const engagement = ENGAGEMENT_TYPES[b.engagementType] || ENGAGEMENT_TYPES.assault;
        const dailyRate = engagement.dailyCasualtyRate || 0.003;
        const atkUnits = Math.max(1, getTotalUnits(b.attacker.currentUnits));
        const defUnits = Math.max(1, getTotalUnits(b.defender.currentUnits));

        // [FIX] 兵力比修正：与阶段结算保持一致，避免极少数敌军也能造成固定伤亡
        const forceRatio = atkUnits / defUnits;
        const dampenAtk = forceRatio > 1 ? Math.min(1, 1 / Math.sqrt(forceRatio)) : 1;
        const dampenDef = forceRatio < 1 ? Math.min(1, Math.sqrt(forceRatio)) : 1;

        // [FIX] 去掉 Math.max(1) 保底：兵力极少时不应造成固定伤亡
        // 只有当计算结果 >= 1 时才造成伤亡，避免"1人每天必杀1人"的悖论
        const dailyAtkLoss = Math.round(atkUnits * dailyRate * dampenAtk * (0.8 + Math.random() * 0.4));
        const dailyDefLoss = Math.round(defUnits * dailyRate * dampenDef * (0.8 + Math.random() * 0.4));

        if (dailyAtkLoss > 0) {
            const atkApplied = applyLosses(b.attacker.currentUnits, dailyAtkLoss, {});
            b.attacker.currentUnits = atkApplied.nextUnits;
            b.attacker.totalCasualties = mergeLossMaps(b.attacker.totalCasualties, atkApplied.losses);
        }
        if (dailyDefLoss > 0) {
            const defApplied = applyLosses(b.defender.currentUnits, dailyDefLoss, {});
            b.defender.currentUnits = defApplied.nextUnits;
            b.defender.totalCasualties = mergeLossMaps(b.defender.totalCasualties, defApplied.losses);
        }
    }

    if (b.phaseDaysRemaining <= 0) {
        const phaseOutcome = calculatePhaseOutcome(b, attackerState, defenderState, battleContext);
        const attackerApplied = applyLosses(
            b.attacker.currentUnits,
            phaseOutcome.attackerLossTarget,
            defenderState.counterData
        );
        const defenderApplied = applyLosses(
            b.defender.currentUnits,
            phaseOutcome.defenderLossTarget,
            attackerState.counterData
        );

        b.attacker.currentUnits = attackerApplied.nextUnits;
        b.defender.currentUnits = defenderApplied.nextUnits;
        b.attacker.totalCasualties = mergeLossMaps(b.attacker.totalCasualties, attackerApplied.losses);
        b.defender.totalCasualties = mergeLossMaps(b.defender.totalCasualties, defenderApplied.losses);
        b.attacker.morale = clamp(
            Number(b.attacker.morale || 100) + phaseOutcome.attackerMoraleShift * attackerState.supplyMod.morale,
            0,
            100
        );
        b.defender.morale = clamp(
            Number(b.defender.morale || 100) + phaseOutcome.defenderMoraleShift * defenderState.supplyMod.morale,
            0,
            100
        );
        b.momentum = clamp(Number(b.momentum || 50) + phaseOutcome.momentumShift, 0, 100);
        b.totalLineShift = Number((Number(b.totalLineShift || 0) + phaseOutcome.lineShift).toFixed(1));
        b.totalWarScoreDelta = Number(b.totalWarScoreDelta || 0) + phaseOutcome.warScoreDelta;
        b.lastResolvedPhaseDay = b.currentRound;

        const phaseReport = {
            phaseIndex: b.phaseIndex,
            phase: phaseOutcome.phaseLabel,
            endedDay: b.currentRound,
            phaseDays: Number(b.phaseSchedule[b.phaseIndex]?.duration || b.phaseDayProgress),
            lineShift: phaseOutcome.lineShift,
            warScoreDelta: phaseOutcome.warScoreDelta,
            attackerLosses: attackerApplied.losses,
            defenderLosses: defenderApplied.losses,
            attackerMorale: b.attacker.morale,
            defenderMorale: b.defender.morale,
            counterSummary: phaseOutcome.counterSummary,
            outcomeSummary: buildOutcomeSummary({
                battle: b,
                phaseOutcome,
                attackerState,
                defenderState,
                battleContext,
            }),
        };

        b.latestPhaseOutcome = phaseReport;
        b.phaseReports = [...(b.phaseReports || []), phaseReport].slice(-10);
        b.roundLog = [...(b.roundLog || []), {
            round: b.currentRound,
            phase: phaseOutcome.phaseLabel,
            events: [phaseReport.outcomeSummary],
            attackerLosses: attackerApplied.losses,
            defenderLosses: defenderApplied.losses,
        }].slice(-20);

        if (b.phaseIndex < b.phaseSchedule.length - 1) {
            b.phaseIndex += 1;
            b.phase = b.phaseSchedule[b.phaseIndex].label;
            b.phaseDayProgress = 0;
            b.phaseDaysRemaining = b.phaseSchedule[b.phaseIndex].duration;
        }

        b.analysis = {
            currentStage: b.phase,
            durationBand: `${b.expectedDuration.min}-${b.expectedDuration.max}天`,
            counterSummary: phaseReport.counterSummary,
            outcomeSummary: phaseReport.outcomeSummary,
            nextResolutionIn: b.phaseDaysRemaining,
        };
    } else {
        b.analysis = {
            ...(b.analysis || buildInitialAnalysis(b)),
            currentStage: b.phase,
            durationBand: `${b.expectedDuration.min}-${b.expectedDuration.max}天`,
            nextResolutionIn: b.phaseDaysRemaining,
        };
        b.latestPhaseOutcome = null;
    }

    return maybeFinalizeBattle(b);
};

/**
 * 将领自动战术选择（核心自动化）
 * 根据将领特质 + 当前战况自动选择战术，玩家无需操作
 * @param {Object} battle - 当前会战对象
 * @param {'attacker'|'defender'} side - 哪一方
 * @param {Object|null} general - 将领对象
 * @returns {string} 选择的战术 ID
 */
export const autoSelectTactic = (battle, side, general) => {
    const b = battle || {};
    const sideData = b[side] || {};
    const units = getTotalUnits(sideData.currentUnits || {});
    const initialUnits = Math.max(1, getTotalUnits(sideData.initialUnits || {}));
    const morale = Number(sideData.morale || 50);
    const momentum = Number(b.momentum || 50);
    const isAttacker = side === 'attacker';
    const traitIds = general?.traits || [];

    // 特殊情况覆盖：最高优先级
    if (units < initialUnits * 0.2) return 'withdraw';
    if (morale < 25) return 'withdraw';

    // 判断优劣势
    const favorableMomentum = isAttacker ? momentum > 60 : momentum < 40;
    const unfavorableMomentum = isAttacker ? momentum < 40 : momentum > 60;
    const enemyUnits = getTotalUnits(b[isAttacker ? 'defender' : 'attacker']?.currentUnits || {});
    const forceRatio = units / Math.max(1, enemyUnits);
    const forceAdvantage = forceRatio > 1.3;
    const forceDisadvantage = forceRatio < 0.7;
    const enemyMorale = Number(b[isAttacker ? 'defender' : 'attacker']?.morale || 50);
    const moraleEdge = morale > 70 && enemyMorale < 40;

    const isAdvantage = favorableMomentum || forceAdvantage || moraleEdge;
    const isDisadvantage = unfavorableMomentum || forceDisadvantage;

    // 根据将领特质 + 态势选择战术矩阵
    if (traitIds.includes('aggressive')) {
        return isDisadvantage ? 'steady' : 'shock';
    }
    if (traitIds.includes('defensive')) {
        if (isAdvantage) return 'steady';
        return 'hold';
    }
    if (traitIds.includes('swift')) {
        if (isDisadvantage) return 'withdraw';
        return isAdvantage ? 'shock' : 'steady';
    }
    if (traitIds.includes('cunning')) {
        // 诡诈型：根据敌方弱点选
        if (enemyMorale < 35) return 'shock';
        if (isDisadvantage) return 'hold';
        return 'steady';
    }
    if (traitIds.includes('veteran')) {
        return isDisadvantage ? 'hold' : 'steady';
    }
    // 无特质 / 其他情况
    if (!general) {
        return isDisadvantage ? 'withdraw' : isAdvantage ? 'steady' : 'hold';
    }
    return isDisadvantage ? 'hold' : 'steady';
};

export const setTacticOrder = (battle, side, tacticId) => {
    const b = ensureBattleDefaults(battle);
    if (!b || !b[side]) return battle;
    if (tacticId === 'withdraw' || tacticId === 'retreat') {
        b[side].withdrawRequested = true;
        b[side].withdrawRequestedDay = b.currentRound;
        b.battlePlan[side] = 'withdraw';
        b[side].plan = 'withdraw';
        b.analysis = {
            ...(b.analysis || buildInitialAnalysis(b)),
            outcomeSummary: `${side === 'attacker' ? '攻方' : '守方'}已下令有序脱离，将在数日后尝试退出会战。`,
        };
        return b;
    }
    if (!BATTLE_PLANS[tacticId]) return b;
    b.battlePlan[side] = tacticId;
    b[side].plan = tacticId;
    return b;
};

export const processReinforcement = (battle, side, reinforcementUnits, reinforcementCorps = null) => {
    const b = ensureBattleDefaults(battle);
    if (!b || !b[side]) return battle;
    Object.entries(reinforcementUnits || {}).forEach(([unitId, count]) => {
        b[side].currentUnits[unitId] = (b[side].currentUnits[unitId] || 0) + count;
    });
    b[side].morale = Math.min(100, Number(b[side].morale || 0) + 8);
    // Add reinforcement corps to the battle's participant list
    if (reinforcementCorps) {
        const corpsId = reinforcementCorps.id;
        const corpsName = reinforcementCorps.name || corpsId;
        if (corpsId && !b[side].corpsIds?.includes(corpsId)) {
            b[side].corpsIds = [...(b[side].corpsIds || []), corpsId];
            b[side].corpsName = (b[side].corpsName || '') + '、' + corpsName;
        }
    }
    const reinforcementTotal = Object.values(reinforcementUnits || {}).reduce((s, c) => s + (c || 0), 0);
    b.roundLog = [...(b.roundLog || []), {
        round: b.currentRound,
        phase: b.phase,
        events: [`${side === 'attacker' ? '攻方' : '守方'}援军抵达（${reinforcementCorps?.name || '增援'}，${reinforcementTotal}人）。`],
        isReinforcement: true,
    }].slice(-20);
    return b;
};

export const calculateRoundSupplyCost = (battle, side, epoch) => {
    const normalizedBattle = ensureBattleDefaults(battle);
    const totalUnits = getTotalUnits(normalizedBattle?.[side]?.currentUnits || {});
    const plan = getPlan(normalizedBattle?.battlePlan?.[side]);
    const cost = {
        food: Math.ceil(totalUnits * BASE_SUPPLY_COST.food * plan.supply),
        silver: Math.ceil(totalUnits * BASE_SUPPLY_COST.silver * plan.supply),
    };

    if (epoch >= 4) {
        let gunpowderUnits = 0;
        Object.entries(normalizedBattle?.[side]?.currentUnits || {}).forEach(([unitId, count]) => {
            const unit = UNIT_TYPES[unitId];
            if (unit?.category === 'gunpowder') gunpowderUnits += count;
        });
        if (gunpowderUnits > 0) {
            cost.gunpowder = Math.ceil(gunpowderUnits * 0.3 * plan.supply);
        }
    }
    if (epoch >= 5) {
        let firearmUnits = 0;
        Object.entries(normalizedBattle?.[side]?.currentUnits || {}).forEach(([unitId, count]) => {
            const unit = UNIT_TYPES[unitId];
            if (unit?.category === 'gunpowder') firearmUnits += count;
        });
        if (firearmUnits > 0) {
            cost.ammunition = Math.ceil(firearmUnits * 0.4 * plan.supply);
        }
    }

    return cost;
};

export const isBattleActive = (battle) => battle?.status === 'active';

export const getBattleStatusText = (battle) => {
    const normalizedBattle = ensureBattleDefaults(battle);
    if (!normalizedBattle) return '未知';
    if (normalizedBattle.status === 'active') {
        return `${normalizedBattle.phase} · 距下次结算 ${normalizedBattle.phaseDaysRemaining} 天`;
    }
    const reason = normalizedBattle.result?.reason;
    if (reason === 'annihilation') return '全歼';
    if (reason === 'morale_collapse') return '士气崩溃';
    if (reason === 'withdrawal') return '有序脱离';
    if (reason === 'timeout') return '阶段结束';
    return '已结束';
};

export {
    ENGAGEMENT_TYPES,
    BATTLE_PLANS,
    TACTICS,
};
