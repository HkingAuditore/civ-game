/**
 * Resource to Building Index Module
 * 
 * Pre-builds a mapping from resources to buildings that output them.
 * This eliminates O(R×B) full traversal in price calculations.
 */

import { BUILDINGS, RESOURCES } from '../../config';

// Cached index: { resourceKey: [{ building, outputAmount }] }
let resourceToOutputBuildingsIndex = null;

/**
 * Build the resource -> output buildings index
 * Call this once at game start or when building config changes
 * @returns {Object} The index mapping
 */
export function buildResourceToOutputBuildingsIndex() {
    const index = {};
    
    // Initialize empty arrays for all tradable resources
    Object.keys(RESOURCES).forEach(resKey => {
        index[resKey] = [];
    });
    
    // Build index by scanning all buildings
    BUILDINGS.forEach(building => {
        if (!building.output) return;
        
        Object.entries(building.output).forEach(([resKey, outputAmount]) => {
            if (!outputAmount || outputAmount <= 0) return;
            if (!RESOURCES[resKey]) return;
            
            if (!index[resKey]) {
                index[resKey] = [];
            }
            
            index[resKey].push({
                building,
                outputAmount,
                buildingId: building.id
            });
        });
    });
    
    resourceToOutputBuildingsIndex = index;
    return index;
}

/**
 * Get list of buildings that output a specific resource
 * @param {string} resourceKey - The resource to look up
 * @returns {Array} Array of { building, outputAmount, buildingId }
 */
export function getOutputBuildingsForResource(resourceKey) {
    // Lazy initialization
    if (!resourceToOutputBuildingsIndex) {
        buildResourceToOutputBuildingsIndex();
    }
    
    return resourceToOutputBuildingsIndex[resourceKey] || [];
}

/**
 * Invalidate the cached index (call when building config changes)
 */
export function invalidateResourceBuildingIndex() {
    resourceToOutputBuildingsIndex = null;
}

/**
 * Check if index is built
 * @returns {boolean}
 */
export function isResourceBuildingIndexBuilt() {
    return resourceToOutputBuildingsIndex !== null;
}
