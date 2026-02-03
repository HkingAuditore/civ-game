/**
 * Economy Debugger
 * Used for debugging AI economy system
 */

export class EconomyDebugger {
    static enabled = false;
    
    static enable() {
        this.enabled = true;
    }
    
    static disable() {
        this.enabled = false;
    }
    
    static log(nation, message, data = {}) {
        if (!this.enabled) return;
        
        console.log(`[Economy Debug] ${nation.name}: ${message}`, {
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            ...data,
        });
    }
    
    static logGrowth(nation, before, after) {
        if (!this.enabled) return;
        
        const popGrowth = after.population - before.population;
        const wealthGrowth = after.wealth - before.wealth;
        const popGrowthRate = (popGrowth / before.population * 100).toFixed(2);
        const wealthGrowthRate = (wealthGrowth / before.wealth * 100).toFixed(2);
        
        console.log(`[Growth] ${nation.name}:`, {
            population: `${before.population} → ${after.population} (+${popGrowth}, +${popGrowthRate}%)`,
            wealth: `${before.wealth} → ${after.wealth} (+${wealthGrowth}, +${wealthGrowthRate}%)`,
        });
    }
    
    static exportState(nation) {
        return {
            name: nation.name,
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            budget: nation.budget,
            inventory: { ...nation.inventory },
            economyTraits: { ...nation.economyTraits },
            timestamp: Date.now(),
        };
    }
}
