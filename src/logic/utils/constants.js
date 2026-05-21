/**
 * Simulation Constants
 * Contains all constant values used across the simulation system
 */

import { TECHS } from '../../config/index.js';

// Tech lookup map for O(1) access by tech ID
export const TECH_MAP = TECHS.reduce((acc, tech) => {
    acc[tech.id] = tech;
    return acc;
}, {});

// Role priority for job allocation
export const ROLE_PRIORITY = [
    'official',
    'cleric',
    'capitalist',
    'landowner',
    'engineer',
    'scientist',
    'navigator',
    'merchant',
    'soldier',
    'scribe',
    'technician',
    'worker',
    'artisan',
    'miner',
    'lumberjack',
    'serf',
    'peasant',
];

// Job migration ratio - percentage of population that can migrate per tick
// Raised from 0.25% to 1.2% so labor can reallocate faster.
export const JOB_MIGRATION_RATIO = 0.012;
// Guaranteed migration ratio when source role population is low (below LOW_POP_THRESHOLD)
export const JOB_MIGRATION_LOW_POP_GUARANTEE = 0.2;
// Limit how fast vacancies can be filled per tick to reduce oscillation
export const VACANCY_FILL_RATIO_PER_TICK = 0.25;
// Tier 0/1 jobs use a higher fill ratio so basic production roles fill faster
// 基础岗位（Tier 0/1）使用更高的填补速率，确保失业者能在 2 tick 内填满空缺
export const VACANCY_FILL_RATIO_TIER01 = 0.75;
// Minimum net income floor for Tier 0/1 roles to prevent them from ranking last
// 当 Tier 0/1 岗位净收入 ≤ 0 时使用此保底值，避免排序到末尾
export const TIER01_MIN_NET_INCOME_FLOOR = 0.01;

// Very small chance for random promotion ("won lottery")
// Allows poor populations to occasionally jump tiers
export const LUCKY_PROMOTION_CHANCE = 0.0001; // 0.01% chance

// ============== Migration Tier Resistance Constants ==============
// These control how difficult it is to migrate between different tiers
// Higher value = more resistance = needs larger income difference to trigger

// Same-tier (horizontal) migration resistance - limits frequent swapping between same-tier roles
// e.g., peasant ↔ lumberjack, worker ↔ artisan
export const SAME_TIER_MIGRATION_RESISTANCE = 1.5;

// Downward migration resistance - makes it harder to move to lower-tier roles
// Only applies to voluntary migration (not layoffs)
export const DOWNGRADE_MIGRATION_RESISTANCE = 2.0;

// Multi-tier downgrade resistance multiplier (per additional tier below)
export const MULTI_TIER_DOWNGRADE_PENALTY = 1.5;

// Upward migration bonus - makes it easier to move to higher-tier roles
// Value < 1 means less income difference required (closer to 1.0 = harder to trigger)
export const UPGRADE_MIGRATION_BONUS = 0.95;

// Migration cooldown per source role (in ticks)
// After migration from a role, that role enters cooldown before another migration can occur
export const MIGRATION_COOLDOWN_TICKS = 5;

// ============== Survival Migration Constants ==============
// When critical resources are in severe shortage, people will be more willing to migrate
// to produce those resources (survival instinct)

// Critical shortage threshold: supply/demand ratio below this triggers survival migration
// 当供需比低于此阈值时，触发生存本能转职
export const CRITICAL_SHORTAGE_THRESHOLD = 0.5;

// Critical resources that trigger survival migration when in shortage
// 触发生存本能的关键资源（基本生存需求）
export const CRITICAL_RESOURCES = ['food', 'cloth'];

// Migration bonus when moving to produce critically short resources
// 转职到生产紧缺资源职业时的门槛降低倍数（0.3 = 原门槛的30%）
export const SHORTAGE_MIGRATION_BONUS = 0.3;

// Emergency migration ratio - higher migration rate during resource crisis
// 资源危机时的紧急转职比例（比正常高5倍）
export const EMERGENCY_MIGRATION_RATIO = JOB_MIGRATION_RATIO * 5;

// Price calculation constants
export const PRICE_FLOOR = 0;
export const BASE_WAGE_REFERENCE = 1;

// Resources that cannot be traded normally
export const SPECIAL_TRADE_RESOURCES = new Set(['science', 'culture']);

// Merchant trade constants
export const MERCHANT_SAFE_STOCK = 200;
export const MERCHANT_CAPACITY_PER_POP = 5;
export const MERCHANT_CAPACITY_WEALTH_DIVISOR = 100;
export const MERCHANT_LOG_VOLUME_RATIO = 0.05;
export const MERCHANT_LOG_PROFIT_THRESHOLD = 50;

// Peace request cooldown per nation (days)
// Increased to prevent spam from individual nations
export const PEACE_REQUEST_COOLDOWN_DAYS = 45;

// Global peace request cooldown (days)
// Prevents multiple nations from requesting peace simultaneously
// When one nation requests peace, others must wait this duration
export const GLOBAL_PEACE_REQUEST_COOLDOWN_DAYS = 30;

// Population growth constants
// Increased to let prosperous empires experience visibly faster birth growth
export const FERTILITY_BASE_RATE = 0.003;
export const FERTILITY_BASELINE_RATE = 0.001;
export const LOW_POP_THRESHOLD = 20;
export const LOW_POP_GUARANTEE = 0.4;
export const WEALTH_BASELINE = 200;

// Stability calculation constants
export const STABILITY_INERTIA = 0.05;

// War constants
export const MAX_CONCURRENT_WARS = 3;
export const GLOBAL_WAR_COOLDOWN = 30;

// ============== Social Mobility Constants ==============
// Stratum tier definitions for social mobility
// Tier 0: 底层 (unemployed, serf)
// Tier 1: 下层 (peasant, lumberjack, miner)
// Tier 2: 中层 (worker, artisan, soldier, navigator, scribe, merchant, cleric)
// Tier 3: 上层 (official, landowner, capitalist, engineer)
export const STRATUM_TIERS = {
    unemployed: 0, serf: 0,
    peasant: 1, lumberjack: 1, miner: 1,
    worker: 1, artisan: 2, soldier: 2, navigator: 2, scribe: 2, merchant: 2, cleric: 2, technician: 2,
    official: 3, landowner: 3, capitalist: 3, engineer: 3, scientist: 3
};

// Wealth requirements for tier promotion (ratio of target stratum's startingWealth)
// 中层需要目标阶层 startingWealth 的 200%，上层需要 300%
export const TIER_PROMOTION_WEALTH_RATIO = {
    0: 0,     // 进入 Tier 0 无财富门槛
    1: 0,     // 进入 Tier 1 无财富门槛
    2: 0.5,   // 进入 Tier 2 需要目标阶层 startingWealth 的 50%
    3: 0.4    // 进入 Tier 3 需要目标阶层 startingWealth 的 40%
};

// Role-specific promotion wealth ratio overrides
// 仅对特定阶层放宽晋升门槛（地主/资本家）
export const ROLE_PROMOTION_WEALTH_RATIO_OVERRIDE = {
    landowner: 0.35,
    capitalist: 0.35,
    soldier: 0 // 军人允许从失业者直接补充，不设财富门槛
};

// Wealth threshold for active tier seeking (multiple of current startingWealth)
// 当财富达到当前阶层 startingWealth 的 2 倍时，会更积极寻求向上流动
export const TIER_SEEK_WEALTH_THRESHOLD = 2.0;

// Bonus attractiveness for higher tier jobs (per tier difference)
// 每提升一级阶层，吸引力额外增加 8%（降低以减缓低层向高层的盲目涌入）
export const TIER_UPGRADE_ATTRACTIVENESS_BONUS = 0.08;

// ============== Subsidy Income Signal Constants ==============
// When a role receives subsidies (negative head tax), boost its potentialIncome signal
// so that the subsidy policy is more visible to the migration decision system.
// 补贴收入信号加成：当角色享受补贴（负人头税）时，额外提升其收入信号
// 使补贴政策对人口迁移决策产生更直接的吸引力
// 说明：自需求 1.1 修复后，补贴金额已按 1.0 倍并入 incomeSignal 主项；
// 该常量保留用于"非补贴"语义场景（例如对正向 taxCostPerCapita 的信号缓和），向后兼容。
export const SUBSIDY_INCOME_SIGNAL_BONUS = 0.5;

// 补贴拉力加速倍率：当某阶层因补贴成为"显著高吸引力候选"时，
// 本次迁移的有效迁移比例使用 JOB_MIGRATION_RATIO * SUBSIDY_PULL_MULTIPLIER。
// 量级介于普通迁移（1×）与紧急迁移（5×）之间，确保补贴政策可见但不爆炸。
// 来源：requirements.md 需求 3.1
export const SUBSIDY_PULL_MULTIPLIER = 2.8;

// 补贴强度阈值：补贴金额（人均日值）相对源角色 potentialIncome 的占比超过此值时，
// 触发同 tier 阻力的线性削减（下限 1.0）。
// 来源：requirements.md 需求 3.3
export const SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD = 0.3;

// "显著高吸引力候选"判定倍率：目标候选 potentialIncome ≥ avgPotentialIncome * 此倍率
// 且存在补贴时，启用补贴拉力加速与单向冷却。
// 来源：requirements.md 需求 3.1
export const SUBSIDY_HIGH_ATTRACTIVENESS_RATIO = 1.5;

// ============== 生存危机迁移强化常量（方案 A：补贴信号危机时放大）==============
// 解决"宁愿饿死也不去种田"问题：当生存物资严重短缺时，
// 必须让"非紧缺生产者（如工匠）"作为迁出源、并大幅降低降级阻力 + 放大补贴信号。

// 危机+紧缺生产+享受补贴 三重叠加时，对该角色的 incomeSignal 额外放大倍率
// 例如：补贴金额 3 银币 + 倍率 4.0 → 信号增量 12（接近工匠工资数量级）
// 仅在迁移决策的信号层放大，不影响实际银币流（保持税收结算语义不变）
export const CRISIS_SUBSIDY_SIGNAL_MULTIPLIER = 4.0;

// 危机时对紧缺资源生产角色的额外吸引力倍率
// 即便该角色 potentialIncome 仅中等水平，也能在危机时被优先选为迁入目标
export const CRITICAL_SHORTAGE_ATTRACTIVENESS_MULTIPLIER = 1.5;

// 危机时降级到紧缺生产角色的阻力上限
// 正常降级阻力 = DOWNGRADE_MIGRATION_RESISTANCE × MULTI_TIER_DOWNGRADE_PENALTY^(n-1) = 2.0+
// 危机时直接 clamp 至此值，让工匠等高 tier 富余角色能下沉到 peasant
export const CRISIS_DOWNGRADE_RESISTANCE_CAP = 1.0;

// 空岗位吸引力加成系数（让空岗位预估收入稍微偏高，吸引人去尝试）
// Vacant role attractiveness bonus - makes estimated income slightly higher to encourage migration
export const VACANT_ROLE_ATTRACTIVENESS_BONUS = 1.2;

// ============== 关键生产者保留锁常量 ==============
// 用途：阻止 peasant 等关键资源生产者在自家岗位仍有空缺时被迁出（升 tier 跑路）。
// 触发条件之一：补贴占收入比超过此阈值时，视为"政策维持"，禁止迁出。
// 经济语义：补贴是政府用来留住该生产者的"工资支柱"，不该反成为升 tier 的燃料。
export const SUBSIDY_DEPENDENCY_LOCK_RATIO = 0.25;

// 关键生产者岗位空缺保留率：只要在岗率低于此值（即仍缺人），即使没触发危机阈值，
// 该角色也禁止作为 sourceCandidate（防止"刚到岗就被升 tier 抽走"的循环）。
// 1.0 表示岗位必须 100% 满员才允许迁出；0.95 留 5% 容差，避免边界震荡。
export const CRITICAL_PRODUCER_RETENTION_FILL_RATE = 0.95;

// ============== Sanity Check（需求 4.6 / E5）==============
// 文件级自检：确保新增 Subsidy 常量为有限正数，避免上游 NaN 污染迁移决策。
// 若任一常量异常，开发模式下 console.warn 而非抛错，保证主循环稳定性（需求 4.4）。
(() => {
    const subsidyConstants = {
        SUBSIDY_INCOME_SIGNAL_BONUS,
        SUBSIDY_PULL_MULTIPLIER,
        SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD,
        SUBSIDY_HIGH_ATTRACTIVENESS_RATIO,
        CRISIS_SUBSIDY_SIGNAL_MULTIPLIER,
        CRITICAL_SHORTAGE_ATTRACTIVENESS_MULTIPLIER,
        CRISIS_DOWNGRADE_RESISTANCE_CAP,
    };
    for (const [name, value] of Object.entries(subsidyConstants)) {
        if (!Number.isFinite(value) || value < 0) {
            console.warn(`[constants] Subsidy constant ${name} is invalid:`, value);
        }
    }
})();
