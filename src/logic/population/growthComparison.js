/**
 * Population Growth Model Comparison
 * 
 * This file demonstrates the difference between:
 * 1. Old exponential growth model (unrealistic)
 * 2. New logistic growth model (realistic, resource-constrained)
 */

import {
    calculateCarryingCapacity,
    calculateLogisticGrowth,
    calculateResourceFactor
} from './logisticGrowth';

/**
 * Old exponential growth model (for comparison)
 */
const oldExponentialGrowth = (population, growthRate = 0.025) => {
    return Math.floor(population * (1 + growthRate));
};

/**
 * Run simulation comparison
 */
export const runGrowthComparison = ({
    initialPopulation = 16,
    foodProduction = 50,
    landArea = 100,
    housingCapacity = 10000,
    epoch = 0,
    difficulty = 'normal',
    days = 100
}) => {
    console.log('='.repeat(80));
    console.log('POPULATION GROWTH MODEL COMPARISON');
    console.log('='.repeat(80));
    console.log(`Initial Population: ${initialPopulation}`);
    console.log(`Food Production: ${foodProduction}/tick`);
    console.log(`Land Area: ${landArea}`);
    console.log(`Housing Capacity: ${housingCapacity}`);
    console.log(`Difficulty: ${difficulty}`);
    console.log('='.repeat(80));
    console.log();

    // Calculate carrying capacity
    const carryingCapacity = calculateCarryingCapacity({
        foodProduction,
        foodStorage: foodProduction * 10,
        landArea,
        housingCapacity,
        epoch,
        technology: {
            agriculture: 0,
            medicine: 0,
            infrastructure: 0,
            urbanization: 0
        }
    });

    console.log(`📊 Carrying Capacity: ${carryingCapacity.toLocaleString()}`);
    console.log();

    // Simulation data
    const oldModel = [];
    const newModel = [];
    
    let oldPop = initialPopulation;
    let newPop = initialPopulation;

    // Run simulation
    for (let day = 0; day <= days; day++) {
        // Every 10 ticks (1 day = 10 ticks)
        if (day % 10 === 0) {
            oldModel.push({ day, population: oldPop });
            newModel.push({ day, population: newPop });

            // Print progress
            if (day % 20 === 0) {
                const oldGrowth = day > 0 ? ((oldPop / initialPopulation - 1) * 100).toFixed(1) : '0.0';
                const newGrowth = day > 0 ? ((newPop / initialPopulation - 1) * 100).toFixed(1) : '0.0';
                const capacityRatio = (newPop / carryingCapacity * 100).toFixed(1);
                
                console.log(`Day ${day.toString().padStart(3)}:`);
                console.log(`  Old Model: ${oldPop.toLocaleString().padStart(12)} (+${oldGrowth}%)`);
                console.log(`  New Model: ${newPop.toLocaleString().padStart(12)} (+${newGrowth}%) [${capacityRatio}% of capacity]`);
                console.log();
            }
        }

        // Old model: pure exponential
        oldPop = oldExponentialGrowth(oldPop, 0.025);

        // New model: logistic with resource constraints
        const foodNeeded = newPop * 0.5;
        const resourceFactor = calculateResourceFactor({
            currentPopulation: newPop,
            foodAvailable: foodProduction,
            foodNeeded,
            wealthPerCapita: 10,
            approval: 60,
            isAtWar: false
        });

        const result = calculateLogisticGrowth({
            currentPopulation: newPop,
            carryingCapacity,
            intrinsicGrowthRate: 0.025,
            resourceFactor,
            difficulty,
            isAI: true
        });

        newPop = result.newPopulation;
    }

    console.log('='.repeat(80));
    console.log('FINAL RESULTS');
    console.log('='.repeat(80));
    console.log(`Old Model (Exponential): ${oldPop.toLocaleString()}`);
    console.log(`New Model (Logistic):    ${newPop.toLocaleString()}`);
    console.log(`Carrying Capacity:       ${carryingCapacity.toLocaleString()}`);
    console.log();
    console.log(`Old Model Growth: ${((oldPop / initialPopulation - 1) * 100).toFixed(1)}%`);
    console.log(`New Model Growth: ${((newPop / initialPopulation - 1) * 100).toFixed(1)}%`);
    console.log(`Capacity Utilization: ${(newPop / carryingCapacity * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    return {
        oldModel,
        newModel,
        carryingCapacity,
        finalOldPop: oldPop,
        finalNewPop: newPop
    };
};

/**
 * Demonstrate different scenarios
 */
export const demonstrateScenarios = () => {
    console.log('\n\n');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' SCENARIO 1: Low Food Production (Resource Constrained)'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    runGrowthComparison({
        initialPopulation: 16,
        foodProduction: 20, // Low food
        landArea: 100,
        housingCapacity: 10000,
        epoch: 0,
        difficulty: 'extreme',
        days: 100
    });

    console.log('\n\n');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' SCENARIO 2: High Food Production (Resource Abundant)'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    runGrowthComparison({
        initialPopulation: 16,
        foodProduction: 200, // High food
        landArea: 500,
        housingCapacity: 50000,
        epoch: 2,
        difficulty: 'extreme',
        days: 100
    });

    console.log('\n\n');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' SCENARIO 3: Medium Resources (Balanced)'.padEnd(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    runGrowthComparison({
        initialPopulation: 16,
        foodProduction: 100,
        landArea: 300,
        housingCapacity: 20000,
        epoch: 1,
        difficulty: 'hard',
        days: 100
    });
};

// Run demonstration if executed directly
if (typeof window === 'undefined' && require.main === module) {
    demonstrateScenarios();
}
