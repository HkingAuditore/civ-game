/**
 * Economy Migration Tool
 * Used to migrate old data to the new system
 */

import { AIEconomyState } from '../models/AIEconomyState.js';

export function migrateNationEconomy(nation) {
    // Check if already migrated
    if (nation._economyMigrated) {
        return nation;
    }
    
    // Create new state
    const state = AIEconomyState.fromLegacyFormat(nation);
    
    // Validate
    const validation = state.validate();
    if (!validation.isValid) {
        console.warn(`[Migration] Failed to migrate ${nation.name}:`, validation.errors);
        return nation;
    }
    
    // Convert back to legacy format and mark as migrated
    return {
        ...nation,
        ...state.toLegacyFormat(),
        _economyMigrated: true,
    };
}

export function migrateAllNations(nations) {
    return nations.map(migrateNationEconomy);
}
