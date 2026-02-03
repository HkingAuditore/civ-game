# AI Economy System - Refactored

## 📖 Overview

This is the refactored AI economy system for the civ-game project. The refactoring addresses code organization issues, data flow confusion, and magic number proliferation identified in the original implementation.

## 🏗️ Architecture

### Directory Structure

```
src/logic/diplomacy/
├── models/
│   └── AIEconomyState.js          # Unified data model
├── config/
│   └── aiEconomyConfig.js         # Centralized configuration
├── calculators/
│   ├── GrowthCalculator.js        # Growth calculations
│   └── ResourceManager.js         # Resource management
├── services/
│   └── AIEconomyService.js        # Main orchestrator
├── migration/
│   └── economyMigration.js        # Legacy data migration
├── debug/
│   └── economyDebugger.js         # Debugging utilities
└── economy/
    └── index.js                   # Export entry point
```

### Module Responsibilities

#### 1. **AIEconomyState** (models/)
- Unified data model for AI nation economy
- Data validation
- Legacy format conversion
- Helper methods (per capita wealth, growth potential)

#### 2. **aiEconomyConfig** (config/)
- Centralized configuration for all parameters
- Growth parameters (rates, penalties, intervals)
- Wealth parameters (caps, growth rates, budget ratios)
- Resource parameters (production, consumption, cycles)
- Difficulty adjustments
- Soft caps

#### 3. **GrowthCalculator** (calculators/)
- Population growth calculation using logistic model
- Wealth growth calculation
- War penalties
- Minimum growth guarantees
- Per capita wealth caps

#### 4. **ResourceManager** (calculators/)
- Resource inventory updates
- Production and consumption calculations
- Long-cycle trends
- Budget management

#### 5. **AIEconomyService** (services/)
- Main entry point for economy updates
- Orchestrates all calculators
- Manages update timing
- Converts between data formats

#### 6. **economyMigration** (migration/)
- Migrates old nation data to new format
- Validates migrated data
- Marks nations as migrated

#### 7. **economyDebugger** (debug/)
- Debug logging
- Growth tracking
- State export

## 🚀 Usage

### Basic Usage

```javascript
import { AIEconomyService } from './logic/diplomacy/economy/index.js';

// Update AI nation economy
const updatedNation = AIEconomyService.update({
    nation: aiNation,
    tick: currentTick,
    epoch: currentEpoch,
    difficulty: 'normal',
    playerPopulation: player.population,
    gameSpeed: 1.0,
});
```

### Migration

```javascript
import { migrateNationEconomy } from './logic/diplomacy/economy/index.js';

// Migrate a single nation
const migratedNation = migrateNationEconomy(oldNation);

// Or migrate all nations
import { migrateAllNations } from './logic/diplomacy/economy/index.js';
const migratedNations = migrateAllNations(oldNations);
```

### Debugging

```javascript
import { EconomyDebugger } from './logic/diplomacy/economy/index.js';

// Enable debugging
EconomyDebugger.enable();

// Log economy state
EconomyDebugger.log(nation, 'Economy updated', { tick: 100 });

// Log growth
const before = { population: 1000, wealth: 10000 };
const after = { population: 1020, wealth: 10200 };
EconomyDebugger.logGrowth(nation, before, after);

// Export state
const state = EconomyDebugger.exportState(nation);
```

### Configuration

```javascript
import { getConfig, getPerCapitaWealthCap } from './logic/diplomacy/economy/index.js';

// Get configuration value
const baseRate = getConfig('growth.baseRate'); // 0.02
const warPenalty = getConfig('growth.warPenalty'); // 0.3

// Get per capita wealth cap for epoch
const cap = getPerCapitaWealthCap(3); // 16000 for Medieval Age
```

## 📊 Data Model

### AIEconomyState

```javascript
{
    // Core Data
    population: 1000,
    wealth: 10000,
    epoch: 2,
    
    // Growth Baseline
    basePopulation: 1000,
    baseWealth: 10000,
    
    // Resource System
    inventory: { food: 500, wood: 300, ... },
    budget: 5000,
    prices: { food: 1.2, wood: 0.8, ... },
    
    // Growth Parameters
    growthRate: 0.02,
    developmentRate: 1.0,
    
    // Timestamps
    lastUpdateTick: 100,
    lastGrowthTick: 100,
    lastEpochUpgradeTick: 50,
    
    // State Flags
    isAtWar: false,
    isVassal: false,
    
    // Traits
    traits: {},
    resourceBias: { food: 1.5, wood: 0.8, ... }
}
```

## 🔧 Configuration Parameters

### Growth Parameters

```javascript
growth: {
    baseRate: 0.02,              // Base growth rate per 10 ticks
    warPenalty: 0.3,             // Growth rate × 0.3 during war
    updateInterval: 10,          // Update every 10 ticks
    minimumGrowth: {             // Minimum growth guarantees
        verySmall: { threshold: 50, minGrowth: 2 },
        small: { threshold: 100, minGrowth: 1 },
        // ...
    }
}
```

### Wealth Parameters

```javascript
wealth: {
    perCapitaCaps: {             // Per capita wealth caps by epoch
        0: 2000,   // Stone Age
        1: 4000,   // Bronze Age
        // ...
    },
    baseGrowthRate: 0.01,
    developmentBonus: 0.005,
    maxGrowthRate: 0.03,
    budgetRatio: 0.5,
    budgetRecoveryRate: 0.02,
}
```

### Resource Parameters

```javascript
resources: {
    baseInventoryTarget: 500,
    baseProductionRate: 5.0,
    baseConsumptionRate: 5.0,
    warConsumptionMultiplier: 1.3,
    minInventoryRatio: 0.2,
    maxInventoryRatio: 3.0,
    cyclePeriodMin: 600,
    cyclePeriodMax: 800,
    trendAmplitude: 0.35,
}
```

## 🎯 Design Principles

### 1. **Clear Responsibility Separation**
- Each module has a single, well-defined purpose
- No overlapping responsibilities
- Clear data flow

### 2. **Single Source of Truth**
- All configuration in one place
- No magic numbers scattered in code
- Centralized data model

### 3. **Testability**
- Pure functions where possible
- Minimal side effects
- Easy to unit test

### 4. **Backward Compatibility**
- Legacy format conversion
- Migration tools
- Gradual transition support

### 5. **Debuggability**
- Comprehensive logging
- State export
- Growth tracking

## 🔄 Migration Strategy

### Phase 1: Data Model (✅ Complete)
- Created AIEconomyState model
- Created configuration file
- Documented data structures

### Phase 2: Core Logic (✅ Complete)
- Created GrowthCalculator
- Created ResourceManager
- Created AIEconomyService

### Phase 3: Integration (🚧 In Progress)
- Integrate into simulation.js
- Maintain backward compatibility
- Test with old saves

### Phase 4: Cleanup (⏳ Pending)
- Remove old code
- Performance optimization
- Complete documentation

## 📝 Notes

### Key Improvements

1. **No More Magic Numbers**: All parameters in config file
2. **Clear Data Flow**: State → Calculator → Service → State
3. **Better Error Handling**: Validation at every step
4. **Easier Testing**: Pure functions, clear interfaces
5. **Better Documentation**: Comprehensive comments and README

### Breaking Changes

None! The new system maintains full backward compatibility through:
- Legacy format conversion in AIEconomyState
- Migration tools for old saves
- Gradual integration strategy

## 🐛 Debugging

### Enable Debug Mode

```javascript
import { EconomyDebugger } from './logic/diplomacy/economy/index.js';
EconomyDebugger.enable();
```

### Debug Output

```
[Economy Debug] Nation Name: Economy updated { population: 1000, wealth: 10000, epoch: 2, tick: 100 }
[Growth] Nation Name: { 
    population: '1000 → 1020 (+20, +2.00%)', 
    wealth: '10000 → 10200 (+200, +2.00%)' 
}
```

## 📚 References

- Planning Document: `docs/AI经济系统重构规划.md`
- Original Implementation: `src/logic/diplomacy/aiEconomy.js`
- Logistic Growth Model: `src/logic/population/logisticGrowth.js`

---

**Last Updated**: 2026-02-03  
**Status**: Phase 1 & 2 Complete, Phase 3 In Progress
