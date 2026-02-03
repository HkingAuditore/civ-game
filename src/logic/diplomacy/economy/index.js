/**
 * AI Economy System - Refactored
 * 
 * This is the new modular AI economy system.
 * 
 * Architecture:
 * - models/AIEconomyState: Unified data model
 * - config/aiEconomyConfig: Centralized configuration
 * - calculators/GrowthCalculator: Population and wealth growth
 * - calculators/ResourceManager: Resource inventory management
 * - services/AIEconomyService: Main service orchestrator
 * - migration/economyMigration: Legacy data migration
 * - debug/economyDebugger: Debugging utilities
 */

// Models
export { AIEconomyState } from '../models/AIEconomyState.js';

// Configuration
export { 
    AI_ECONOMY_CONFIG,
    getConfig,
    getPerCapitaWealthCap,
    getMinimumGrowth
} from '../config/aiEconomyConfig.js';

// Calculators
export { GrowthCalculator } from '../calculators/GrowthCalculator.js';
export { ResourceManager } from '../calculators/ResourceManager.js';

// Services
export { AIEconomyService } from '../services/AIEconomyService.js';

// Migration
export { 
    migrateNationEconomy,
    migrateAllNations
} from '../migration/economyMigration.js';

// Debug
export { EconomyDebugger } from '../debug/economyDebugger.js';
