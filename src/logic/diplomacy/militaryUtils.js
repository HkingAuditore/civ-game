import { calculateNationBattlePower } from '../../config/militaryUnits';
import { formatNumberShortCN } from '../../utils/numberFormat';

/**
 * Calculates estimated military strength with a simulated "fog of war" accuracy based on relations.
 * @param {Object} nation - The target nation
 * @param {number} epoch - Current game epoch
 * @param {number} daysElapsed - Days elapsed in game
 * @returns {Object} { label: string, colorClass: string }
 */
export const getEstimatedMilitaryStrength = (nation, epoch, daysElapsed) => {
    if (!nation) return { label: '未知', colorClass: 'text-gray-400' };

    // Default relation to 0 if missing
    const relation = nation.relation || 0;

    // Calculate real power
    const realPower = calculateNationBattlePower(nation, epoch);

    // Calculate accuracy based on relation (higher relation = more accurate)
    // Relation 0 => 0.1 accuracy (huge error range)
    // Relation 100 => 1.0 accuracy (no error)
    const accuracyFactor = Math.max(0.1, relation / 100);
    const errorRange = 1 - accuracyFactor;

    // Deterministic random seed based on day/month to prevent flickering values
    // but allowing updates over time
    const seedStr = `${nation.id || 'unknown'}-${Math.floor(daysElapsed / 30)}`;
    let seedHash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seedHash = ((seedHash << 5) - seedHash) + seedStr.charCodeAt(i);
        seedHash |= 0;
    }
    // Normalized random between -0.5 and 0.5
    const stableRandom = ((Math.abs(seedHash) % 1000) / 1000) - 0.5;

    // Apply error
    const estimatedPower = Math.floor(realPower * (1 + stableRandom * errorRange * 0.5));

    const formatPower = (p) => formatNumberShortCN(p, { decimals: 1 });

    // Create label based on relation tiers
    let label = '未知';
    let colorClass = 'text-gray-400';

    if (relation >= 60) {
        label = `约 ${formatPower(estimatedPower)}`;
        colorClass = 'text-green-300';
    } else if (relation >= 40) {
        // Range for neutral
        const min = Math.floor(estimatedPower * 0.8);
        const max = Math.floor(estimatedPower * 1.2);
        label = `${formatPower(min)} - ${formatPower(max)}`;
        colorClass = 'text-yellow-300';
    } else if (relation >= 20) {
        label = '情报不足';
        colorClass = 'text-gray-400';
    }

    return { label, colorClass };
};
