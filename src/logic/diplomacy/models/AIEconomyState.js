/**
 * AI Economy State Model
 * Unified data model for AI nation economy
 */

export class AIEconomyState {
    constructor(initialData = {}) {
        // === Core Data ===
        this.population = initialData.population || 100;
        this.wealth = initialData.wealth || 1000;
        this.epoch = initialData.epoch || 0;
        
        // === Growth Baseline ===
        this.basePopulation = initialData.basePopulation || this.population;
        this.baseWealth = initialData.baseWealth || this.wealth;
        
        // === Resource System ===
        this.inventory = initialData.inventory || {};
        this.budget = initialData.budget || this.wealth * 0.5;
        this.prices = initialData.prices || {};
        
        // === Growth Parameters ===
        this.growthRate = initialData.growthRate || 0.02;
        this.developmentRate = initialData.developmentRate || 1.0;
        
        // === Timestamps ===
        this.lastUpdateTick = initialData.lastUpdateTick || 0;
        this.lastGrowthTick = initialData.lastGrowthTick || 0;
        this.lastEpochUpgradeTick = initialData.lastEpochUpgradeTick || 0;
        
        // === State Flags ===
        this.isAtWar = initialData.isAtWar || false;
        this.isVassal = initialData.isVassal || false;
        
        // === Traits ===
        this.traits = initialData.traits || {};
        this.resourceBias = initialData.resourceBias || {};
    }
    
    /**
     * Validate data integrity
     */
    validate() {
        const errors = [];
        
        if (!Number.isFinite(this.population) || this.population < 1) {
            errors.push('Invalid population');
        }
        if (!Number.isFinite(this.wealth) || this.wealth < 0) {
            errors.push('Invalid wealth');
        }
        if (!Number.isFinite(this.epoch) || this.epoch < 0) {
            errors.push('Invalid epoch');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Get per capita wealth
     */
    getPerCapitaWealth() {
        return this.wealth / Math.max(1, this.population);
    }
    
    /**
     * Get growth potential (0-1)
     */
    getGrowthPotential() {
        const perCapitaWealth = this.getPerCapitaWealth();
        const targetPerCapita = 2000 * Math.pow(2, this.epoch);
        return Math.min(1, perCapitaWealth / targetPerCapita);
    }
    
    /**
     * Convert to legacy format (compatibility)
     */
    toLegacyFormat() {
        return {
            population: this.population,
            wealth: this.wealth,
            epoch: this.epoch,
            budget: this.budget,
            inventory: { ...this.inventory },
            economyTraits: {
                ownBasePopulation: this.basePopulation,
                ownBaseWealth: this.baseWealth,
                developmentRate: this.developmentRate,
                lastGrowthTick: this.lastGrowthTick,
                resourceBias: { ...this.resourceBias },
            },
            _lastEpochUpgradeTick: this.lastEpochUpgradeTick,
        };
    }
    
    /**
     * Create from legacy format (compatibility)
     */
    static fromLegacyFormat(nation) {
        return new AIEconomyState({
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            budget: nation.budget,
            inventory: nation.inventory,
            basePopulation: nation.economyTraits?.ownBasePopulation,
            baseWealth: nation.economyTraits?.ownBaseWealth,
            developmentRate: nation.economyTraits?.developmentRate,
            lastGrowthTick: nation.economyTraits?.lastGrowthTick,
            lastEpochUpgradeTick: nation._lastEpochUpgradeTick,
            resourceBias: nation.economyTraits?.resourceBias,
            isAtWar: nation.isAtWar,
            isVassal: !!nation.vassalOf,
        });
    }
}
