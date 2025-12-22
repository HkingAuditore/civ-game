/**
 * Simulation Constants
 * Contains all constant values used across the simulation system
 */

import { TECHS } from '../../config';

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
    'knight',
    'engineer',
    'navigator',
    'merchant',
    'soldier',
    'scribe',
    'worker',
    'artisan',
    'miner',
    'lumberjack',
    'serf',
    'peasant',
];

// Job migration ratio - percentage of population that can migrate per tick
// Reduced from 0.05 to 0.02 to slow down migration frequency
export const JOB_MIGRATION_RATIO = 0.02;
// Guaranteed migration ratio when source role population is low (below LOW_POP_THRESHOLD)
export const JOB_MIGRATION_LOW_POP_GUARANTEE = 0.2;

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
// Value < 1 means less income difference required
export const UPGRADE_MIGRATION_BONUS = 0.8;

// Migration cooldown per source role (in ticks)
// After migration from a role, that role enters cooldown before another migration can occur
export const MIGRATION_COOLDOWN_TICKS = 5;

// Price calculation constants
export const PRICE_FLOOR = 0.0001;
export const BASE_WAGE_REFERENCE = 1;

// Resources that cannot be traded normally
export const SPECIAL_TRADE_RESOURCES = new Set(['science', 'culture']);

// Merchant trade constants
export const MERCHANT_SAFE_STOCK = 200;
export const MERCHANT_CAPACITY_PER_POP = 5;
export const MERCHANT_CAPACITY_WEALTH_DIVISOR = 100;
export const MERCHANT_LOG_VOLUME_RATIO = 0.05;
export const MERCHANT_LOG_PROFIT_THRESHOLD = 50;

// Peace request cooldown (days, approximately 1 month)
export const PEACE_REQUEST_COOLDOWN_DAYS = 30;

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
// Tier 3: 上层 (official, landowner, capitalist, knight, engineer)
export const STRATUM_TIERS = {
    unemployed: 0, serf: 0,
    peasant: 1, lumberjack: 1, miner: 1,
    worker: 2, artisan: 2, soldier: 2, navigator: 2, scribe: 2, merchant: 2, cleric: 2,
    official: 3, landowner: 3, capitalist: 3, knight: 3, engineer: 3
};

// Wealth requirements for tier promotion (ratio of target stratum's startingWealth)
// 中层需要目标阶层 startingWealth 的 200%，上层需要 300%
export const TIER_PROMOTION_WEALTH_RATIO = {
    0: 0,     // 进入 Tier 0 无财富门槛
    1: 0,     // 进入 Tier 1 无财富门槛
    2: 0.8,   // 进入 Tier 2 需要目标阶层 startingWealth 的 80%
    3: 0.8    // 进入 Tier 3 需要目标阶层 startingWealth 的 80%
};

// Wealth threshold for active tier seeking (multiple of current startingWealth)
// 当财富达到当前阶层 startingWealth 的 2 倍时，会更积极寻求向上流动
export const TIER_SEEK_WEALTH_THRESHOLD = 2.0;

// Bonus attractiveness for higher tier jobs (per tier difference)
// 每提升一级阶层，吸引力额外增加 20%
export const TIER_UPGRADE_ATTRACTIVENESS_BONUS = 0.2;
