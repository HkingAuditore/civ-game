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
export const JOB_MIGRATION_RATIO = 0.1;

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
export const FERTILITY_BASE_RATE = 0.0015;
export const FERTILITY_BASELINE_RATE = 0.0005;
export const LOW_POP_THRESHOLD = 20;
export const LOW_POP_GUARANTEE = 0.4;
export const WEALTH_BASELINE = 200;

// Stability calculation constants
export const STABILITY_INERTIA = 0.05;

// War constants
export const MAX_CONCURRENT_WARS = 3;
export const GLOBAL_WAR_COOLDOWN = 30;
