# AI Economy System - Testing Guide

## 📋 Overview

This guide provides instructions for testing the refactored AI economy system and comparing it with the legacy system.

## 🚀 Quick Start

### Enable the New System

1. Open `src/logic/simulation.js`
2. Find the feature flag (around line 30):
   ```javascript
   const USE_NEW_AI_ECONOMY = false; // TODO: Enable after testing
   ```
3. Change to `true`:
   ```javascript
   const USE_NEW_AI_ECONOMY = true; // Testing new system
   ```
4. Save and restart the game

### Enable Debug Mode

To see detailed economy updates:

```javascript
// In browser console or add to simulation.js
import { EconomyDebugger } from './logic/diplomacy/economy/index.js';
EconomyDebugger.enable();
```

## 🧪 Test Scenarios

### Test 1: Basic Growth

**Objective**: Verify AI nations grow population and wealth correctly

**Steps**:
1. Start a new game
2. Let it run for 100 ticks (10 growth updates)
3. Check AI nation stats

**Expected Results**:
- Population should increase gradually
- Wealth should increase with population
- Growth rate should be reasonable (1-3% per update)

**Verification**:
```javascript
// In browser console
const aiNation = nations.find(n => n.id === 'some_ai_nation');
console.log({
    population: aiNation.population,
    wealth: aiNation.wealth,
    perCapita: aiNation.wealth / aiNation.population,
    epoch: aiNation.epoch
});
```

### Test 2: War Penalty

**Objective**: Verify war reduces growth rate

**Steps**:
1. Start a war with an AI nation
2. Observe growth rate during war
3. Make peace
4. Observe growth rate after peace

**Expected Results**:
- Growth during war should be ~30% of peacetime
- Growth should recover after peace
- Population should not decline rapidly

### Test 3: Resource Management

**Objective**: Verify resource inventory updates correctly

**Steps**:
1. Check AI nation inventory at start
2. Let game run for 50 ticks
3. Check inventory again

**Expected Results**:
- Inventory should fluctuate around target levels
- Specialty resources (bias > 1) should have higher stock
- Scarce resources (bias < 1) should have lower stock

**Verification**:
```javascript
const aiNation = nations.find(n => n.id === 'some_ai_nation');
console.log({
    inventory: aiNation.inventory,
    resourceBias: aiNation.economyTraits?.resourceBias
});
```

### Test 4: Epoch Progression

**Objective**: Verify AI nations advance through epochs

**Steps**:
1. Start game in Stone Age
2. Fast forward 500+ ticks
3. Check AI nation epochs

**Expected Results**:
- AI nations should advance to Bronze Age
- Wealth cap should increase with epoch
- Growth rate should increase with epoch

### Test 5: Vassal Growth

**Objective**: Verify vassals grow correctly

**Steps**:
1. Vassalize an AI nation
2. Observe growth over 100 ticks
3. Compare with independent nations

**Expected Results**:
- Vassals should grow at similar rate to independent nations
- Vassal satisfaction should be calculated correctly
- Tribute should be paid regularly

### Test 6: Save/Load Compatibility

**Objective**: Verify old saves load correctly

**Steps**:
1. Load an old save (before refactoring)
2. Check AI nation data
3. Let game run for 50 ticks
4. Save and reload

**Expected Results**:
- Old saves should load without errors
- Migration should happen automatically
- Data should be preserved correctly
- New saves should work normally

## 📊 Comparison Testing

### Side-by-Side Comparison

To compare new vs legacy system:

1. **Test with Legacy System**:
   - Set `USE_NEW_AI_ECONOMY = false`
   - Start new game
   - Record AI nation stats every 100 ticks
   - Save data to file

2. **Test with New System**:
   - Set `USE_NEW_AI_ECONOMY = true`
   - Start new game (same seed if possible)
   - Record AI nation stats every 100 ticks
   - Save data to file

3. **Compare Results**:
   - Population growth rates
   - Wealth growth rates
   - Resource inventory levels
   - Epoch progression timing

### Data Collection Script

```javascript
// Add to browser console
const collectEconomyData = () => {
    const data = nations
        .filter(n => !n.isPlayer)
        .map(n => ({
            name: n.name,
            population: n.population,
            wealth: n.wealth,
            epoch: n.epoch,
            perCapita: n.wealth / n.population,
            inventory: Object.keys(n.inventory || {}).length,
            isAtWar: n.isAtWar,
            isVassal: !!n.vassalOf
        }));
    
    console.table(data);
    return data;
};

// Run every 100 ticks
setInterval(() => {
    console.log(`=== Tick ${tick} ===`);
    collectEconomyData();
}, 10000); // Adjust timing as needed
```

## 🐛 Known Issues to Watch For

### Issue 1: Double Growth

**Symptom**: AI nations grow too fast
**Cause**: Both systems running simultaneously
**Check**: Verify feature flag is set correctly

### Issue 2: No Growth

**Symptom**: AI nations don't grow at all
**Cause**: Migration failed or data corruption
**Check**: Look for validation errors in console

### Issue 3: Inventory Explosion

**Symptom**: Resource inventory grows infinitely
**Cause**: Production/consumption imbalance
**Check**: Verify inventory caps are working

### Issue 4: Negative Values

**Symptom**: Population or wealth becomes negative
**Cause**: Validation not catching edge cases
**Check**: Look for validation errors

## 📈 Performance Testing

### Metrics to Track

1. **Frame Rate**: Should remain stable
2. **Tick Duration**: Should not increase significantly
3. **Memory Usage**: Should not grow over time
4. **CPU Usage**: Should be similar to legacy system

### Performance Test

```javascript
// Add to browser console
const perfTest = () => {
    const start = performance.now();
    
    // Run 100 ticks
    for (let i = 0; i < 100; i++) {
        // Trigger simulation update
        // (implementation depends on your game loop)
    }
    
    const end = performance.now();
    const duration = end - start;
    const avgPerTick = duration / 100;
    
    console.log({
        totalDuration: `${duration.toFixed(2)}ms`,
        avgPerTick: `${avgPerTick.toFixed(2)}ms`,
        ticksPerSecond: (1000 / avgPerTick).toFixed(2)
    });
};
```

## ✅ Acceptance Criteria

The new system is ready for production when:

- [ ] All test scenarios pass
- [ ] Growth rates match legacy system (±5%)
- [ ] Resource management works correctly
- [ ] Old saves load without errors
- [ ] Performance is equal or better than legacy
- [ ] No console errors or warnings
- [ ] Vassals grow correctly
- [ ] Epoch progression works
- [ ] War penalties apply correctly
- [ ] No memory leaks after 1000+ ticks

## 🔧 Troubleshooting

### Problem: Console Errors

**Solution**: Check browser console for detailed error messages

### Problem: Unexpected Behavior

**Solution**: Enable debug mode and check logs

### Problem: Performance Issues

**Solution**: Profile with browser dev tools

### Problem: Data Corruption

**Solution**: Check validation errors, may need to reset save

## 📝 Reporting Issues

When reporting issues, please include:

1. **System**: New or Legacy (feature flag value)
2. **Scenario**: What you were testing
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Console Logs**: Any errors or warnings
6. **Save File**: If applicable
7. **Steps to Reproduce**: Detailed steps

## 🎯 Next Steps After Testing

1. **If tests pass**:
   - Enable new system by default
   - Monitor for issues
   - Collect player feedback

2. **If tests fail**:
   - Document issues
   - Fix bugs
   - Re-test
   - Repeat until passing

3. **After successful rollout**:
   - Remove legacy code
   - Update documentation
   - Optimize performance

---

**Last Updated**: 2026-02-03  
**Status**: Ready for Testing  
**Feature Flag**: `USE_NEW_AI_ECONOMY` in `simulation.js`
