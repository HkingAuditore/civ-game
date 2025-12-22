/**
 * Simulation Web Worker
 * 
 * Offloads the heavy simulateTick computation to a background thread,
 * keeping the main thread responsive for UI rendering.
 * 
 * Communication Protocol:
 * - Main → Worker: { type: 'SIMULATE', payload: gameState }
 * - Worker → Main: { type: 'RESULT', payload: simulationResult }
 * - Worker → Main: { type: 'ERROR', error: errorMessage }
 */

import { simulateTick } from '../logic/simulation';

/**
 * Handle incoming messages from main thread
 */
self.onmessage = function(event) {
    const { type, payload } = event.data;
    
    if (type === 'SIMULATE') {
        try {
            // Execute the simulation
            const result = simulateTick(payload);
            
            // Send the result back to main thread
            self.postMessage({
                type: 'RESULT',
                payload: result
            });
        } catch (error) {
            // Send error back to main thread
            self.postMessage({
                type: 'ERROR',
                error: error.message || 'Unknown simulation error'
            });
        }
    } else if (type === 'PING') {
        // Health check - used to verify worker is responsive
        self.postMessage({ type: 'PONG' });
    }
};

// Signal that worker is ready
self.postMessage({ type: 'READY' });
