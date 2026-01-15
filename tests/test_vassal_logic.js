
import { calculateEnhancedTribute, requestExpeditionaryForce } from '../src/logic/diplomacy/vassalSystem.js';
import { TRIBUTE_CONFIG, VASSAL_TYPE_CONFIGS } from '../src/config/diplomacy.js';

console.log('--- Testing Vassal Logic ---');

// Mock Vassal
const vassal = {
    id: 'vassal1',
    name: 'Vassalia',
    vassalOf: 'player',
    vassalType: 'tributary',
    wealth: 5000,
    manpower: 2000,
    tributeRate: 0.1,
    autonomy: 50,
};

// 1. Test Tribute (Should not depend on Player Wealth)
console.log('Testing Tribute Calculation...');
const tribute1 = calculateEnhancedTribute(vassal); // implicit playerWealth default
console.log('Tribute (Default Player Wealth):', tribute1.silver);

// Since I removed playerWealth arg from definition, passing it shouldn't matter,
// but logically the calculation inside should rely on vassal.wealth.
// Formula: Base + VassalWealth * Rate
// Base: 100. Rate: 0.08.
// Expected Base: 100 + 5000 * 0.08 = 100 + 400 = 500.
// Multipliers: Size (Large > 3000) = 1.3? Config says: large: 1.3.
// So 500 * 1.3 = 650.
// Autonomy Factor: 1 - (50/200) = 0.75.
// Resistance Factor: 1 (indep 0).
// Tribute Rate: 0.1.
// Final: 650 * 0.75 * 1.0 * 0.1 = 48.75 -> 48.

const expectedBase = TRIBUTE_CONFIG.baseAmount + (vassal.wealth * TRIBUTE_CONFIG.vassalWealthRate);
console.log(`Expected Base Calculation: ${TRIBUTE_CONFIG.baseAmount} + ${vassal.wealth} * ${TRIBUTE_CONFIG.vassalWealthRate} = ${expectedBase}`);

console.log('Actual Result:', tribute1.silver);

// 2. Test Expeditionary Force
console.log('\nTesting Expeditionary Force...');
const forceResult = requestExpeditionaryForce(vassal);
console.log('Request Result:', forceResult);

if (forceResult.success && forceResult.manpower > 0) {
    console.log('PASS: Expeditionary force granted.');
} else {
    console.error('FAIL: Expeditionary force failed.');
}

// 3. Test Protectorate Call (Pay to Call)
// Need to import requestWarParticipation
import { requestWarParticipation } from '../src/logic/diplomacy/vassalSystem.js';

const protectorate = {
    ...vassal,
    vassalType: 'protectorate',
    wealth: 1000,
    relation: 80
};

console.log('\nTesting Call to Arms (Protectorate)...');
const callResult = requestWarParticipation(protectorate, null, 10000); // Player has 10k silver
console.log('Call Result:', callResult);

if (callResult.success && callResult.cost > 0) {
    console.log('PASS: Call to arms successful with cost.');
} else {
    console.error('FAIL: Call to arms failed.');
}

console.log('\n--- Test Complete ---');
