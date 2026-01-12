
const applyMigrationToPopStructure = (popStructure, migrationByStratum, population) => {
    // THIS IS THE NEW IMPLEMENTATION TO TEST
    if (!popStructure) return {};
    if (!migrationByStratum) return popStructure;

    const newStructure = { ...popStructure };

    // Simply add the counts. popStructure IS counts.
    Object.entries(migrationByStratum).forEach(([stratum, count]) => {
        if (typeof count === 'number' && count !== 0) {
            const currentCount = newStructure[stratum] || 0;
            const newCount = Math.floor(currentCount + count); // Ensure integer counts
            newStructure[stratum] = Math.max(0, newCount);
        }
    });

    return newStructure;
};

// Test Case
const popStructure = {
    worker: 50,  // ABSOLUTE COUNTS
    peasant: 50  // ABSOLUTE COUNTS
};
const population = 100; // Not strictly needed if popStructure is counts, but passed for API compatibility
const migrationByStratum = {
    worker: 10
};

// Total migrants = 10.
// Old Pop = 100.
// New Pop = 110.
// Expected New Structure: Worker = 60, Peasant = 50.

const newStructure = applyMigrationToPopStructure(popStructure, migrationByStratum, population);

console.log("Original Structure (Counts):", popStructure);
console.log("Migration:", migrationByStratum);
console.log("New Structure (Counts):", newStructure);

const workerCount = newStructure.worker;
const peasantCount = newStructure.peasant;
console.log("Worker Count:", workerCount);
console.log("Peasant Count:", peasantCount);

// Verify validity
if (Math.abs(workerCount - 60) > 0.1) {
    console.error("FAIL: Worker count mismatch! Expected 60, got " + workerCount);
} else {
    console.log("PASS: Worker count correct.");
}

if (Math.abs(peasantCount - 50) > 0.1) {
    console.error("FAIL: Peasant count mismatch! Expected 50, got " + peasantCount);
} else {
    console.log("PASS: Peasant count correct.");
}

// Check if it looks like ratios ( < 1.0 )
if (workerCount < 1.0 && workerCount > 0) {
    console.error("FAIL: Output looks like a RATIO, not a COUNT!");
}
