/**
 * Logic Module Index
 * Central export point for all simulation logic modules
 */

// Utils
export * from './utils';

// Economy
export * from './economy';

// Population
export * from './population';

// Stability
export * from './stability';

// Buildings
export * from './buildings';

// Diplomacy
export * from './diplomacy';

// AI event adapter
export * from './ai/aiEventAdapter';

// Main simulation (for backward compatibility)
export { simulateTick } from './simulation';
