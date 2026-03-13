export const MIN_RUNTIME_POPULATION = 10;
export const MIN_BOOTSTRAP_POPULATION = 100;

const toFinitePopulation = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.floor(numericValue);
};

export const clampPopulationAtFloor = (value, floor = MIN_RUNTIME_POPULATION) => {
    return Math.max(floor, toFinitePopulation(value));
};

export const clampPopulationNonNegative = (value) => {
    return Math.max(0, toFinitePopulation(value));
};

export const reducePopulationWithFloor = (currentPopulation, loss, floor = MIN_RUNTIME_POPULATION) => {
    return clampPopulationAtFloor(toFinitePopulation(currentPopulation) - toFinitePopulation(loss), floor);
};

export const reducePopulationNonNegative = (currentPopulation, loss) => {
    return clampPopulationNonNegative(toFinitePopulation(currentPopulation) - toFinitePopulation(loss));
};

export const clampBootstrapPopulation = (value) => {
    return clampPopulationAtFloor(value, MIN_BOOTSTRAP_POPULATION);
};
