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
        // [FIX] Don't fall back to this.population - basePopulation should remain a small "seed" value
        // that grows slowly. Falling back to population causes ownBasePopulation inflation which
        // inflates capacityFloor in AIPopulationDynamics, leading to runaway growth.
        // Use a reasonable epoch-scaled default instead.
        const epochBasePopDefault = [20, 40, 80, 160, 300, 500, 800][Math.min(this.epoch, 6)] || 20;
        this.basePopulation = initialData.basePopulation || epochBasePopDefault;
        this.baseWealth = initialData.baseWealth || this.wealth;
        
        // === Resource System ===
        this.inventory = initialData.inventory || {};
        this.budget = initialData.budget || this.wealth * 0.22;
        this.prices = initialData.prices || {};
        
        // === Growth Parameters ===
        this.growthRate = initialData.growthRate || 0.02;
        this.developmentRate = initialData.developmentRate || 1.0;
        
        // === Timestamps ===
        this.lastUpdateTick = initialData.lastUpdateTick || 0;
        // [FIX] 当 lastGrowthTick 为 undefined/null 时使用 -1（哨兵值），
        // AIEconomyService 检测到 -1 时会将其设为 tick - updateInterval，
        // 防止首次 update 时 ticksSinceLastUpdate = tick（可能数千），导致 tickScale 满值运行"补算"逻辑。
        this.lastGrowthTick = (initialData.lastGrowthTick != null && initialData.lastGrowthTick >= 0)
            ? initialData.lastGrowthTick
            : -1;
        this.lastEpochUpgradeTick = initialData.lastEpochUpgradeTick || 0;
        
        // === State Flags ===
        this.isAtWar = initialData.isAtWar || false;
        this.isVassal = initialData.isVassal || false;
        
        // === Traits ===
        this.traits = initialData.traits || {};
        this.resourceBias = initialData.resourceBias || {};
        this.growthRemainders = initialData.growthRemainders || { population: 0, wealth: 0 };
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
                growthRemainders: { ...(this.growthRemainders || { population: 0, wealth: 0 }) },
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
            growthRemainders: nation.economyTraits?.growthRemainders,
            isAtWar: nation.isAtWar,
            isVassal: !!nation.vassalOf,
        });
    }
}
