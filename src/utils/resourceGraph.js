// Resource dependency graph generator
// Automatically builds a resource network from BUILDINGS input/output data
// Replaces the manual INDUSTRY_CHAINS approach for the supply chain UI

import { BUILDINGS, RESOURCES } from '../config';
import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from '../config/buildingUpgrades';

// Resources to exclude from the graph (virtual/currency resources)
// science and culture are kept per user requirement
const EXCLUDED_RESOURCES = new Set(['silver', 'maxPop', 'militaryCapacity']);

/**
 * Determine if a resource is a "terminal" resource for downstream BFS.
 * Terminal resources are end-products (consumer goods, military items, special resources)
 * that should NOT be expanded further downstream in the supply chain graph.
 * 
 * @param {string} rk - Resource key
 * @returns {boolean} True if this resource is a downstream terminal
 */
const isDownstreamTerminal = (rk) => {
    const res = RESOURCES[rk];
    if (!res || !res.tags) return false;
    const tags = res.tags;
    // Luxury goods (delicacies, furniture, ale, fine_clothes)
    if (tags.includes('luxury')) return true;
    // Military end-products (swords, firearms, armor, warship, ordnance, etc.)
    if (tags.includes('military')) return true;
    // Consumer goods (medicine)
    if (tags.includes('consumer')) return true;
    // Special resources (science, culture)
    if (tags.includes('special')) return true;
    // High-tech end-products (semiconductors, software, composites) - but not intermediates
    if (tags.includes('high_tech') && !tags.includes('intermediate')) return true;
    // Essential goods (food, cloth, spice, coffee) - all are consumption endpoints
    if (tags.includes('essential')) return true;
    // Raw materials should not appear as downstream products in a supply chain
    // (e.g. wiring should not "produce" food/wood via multi-input buildings)
    if (tags.includes('raw_material') && !tags.includes('manufactured') && !tags.includes('industrial')) return true;
    return false;
};

/**
 * Determine if a resource is a "terminal" resource for upstream BFS.
 * Pure raw materials should not be expanded further upstream.
 * 
 * @param {string} rk - Resource key
 * @returns {boolean} True if this resource is an upstream terminal
 */
const isUpstreamTerminal = (rk) => {
    const res = RESOURCES[rk];
    if (!res || !res.tags) return false;
    const tags = res.tags;
    // Pure raw materials that are NOT processed goods
    // e.g. wood, stone, iron, copper, coal, cotton, oil, uranium, rubber
    // These are the starting points of supply chains with no meaningful upstream
    if (tags.includes('raw_material') && !tags.includes('manufactured') && !tags.includes('intermediate')) return true;
    return false;
};

/**
 * Build the full resource dependency graph from all buildings (including upgrades).
 * 
 * Graph structure:
 * - resourceNodes: Map<resourceKey, { producers: Set<buildingId>, consumers: Set<buildingId> }>
 * - edges: Array<{ from: resourceKey, to: resourceKey, buildings: Array<{ id, name, epoch }> }>
 *   Each edge means: `from` resource is consumed by a building that produces `to` resource
 * - buildingIndex: Map<buildingId, { name, epoch, inputs: string[], outputs: string[] }>
 * 
 * @returns {Object} The full resource dependency graph
 */
export const buildResourceDependencyGraph = () => {
    const resourceNodes = {}; // resourceKey -> { producers: Set, consumers: Set }
    const buildingIndex = {}; // buildingId -> { name, epoch, inputs, outputs, allInputs, allOutputs }

    // Ensure a resource node exists
    const ensureResource = (rk) => {
        if (EXCLUDED_RESOURCES.has(rk)) return false;
        if (!resourceNodes[rk]) {
            resourceNodes[rk] = { producers: new Set(), consumers: new Set() };
        }
        return true;
    };

    // Process a single building configuration (base or upgraded)
    const processConfig = (buildingId, name, epoch, input, output, isUpgrade = false, upgradeLevel = 0) => {
        const inputKeys = Object.keys(input || {}).filter(rk => !EXCLUDED_RESOURCES.has(rk));
        const outputKeys = Object.keys(output || {}).filter(rk => !EXCLUDED_RESOURCES.has(rk));

        if (inputKeys.length === 0 && outputKeys.length === 0) return;

        // Register building if not already
        if (!buildingIndex[buildingId]) {
            buildingIndex[buildingId] = {
                name,
                epoch,
                inputs: new Set(),
                outputs: new Set(),
            };
        }

        const bIdx = buildingIndex[buildingId];

        // Track all resource types across all levels
        inputKeys.forEach(rk => {
            if (ensureResource(rk)) {
                resourceNodes[rk].consumers.add(buildingId);
                bIdx.inputs.add(rk);
            }
        });

        outputKeys.forEach(rk => {
            if (ensureResource(rk)) {
                resourceNodes[rk].producers.add(buildingId);
                bIdx.outputs.add(rk);
            }
        });
    };

    // Process all buildings
    BUILDINGS.forEach(building => {
        // Base level
        processConfig(
            building.id,
            building.name,
            building.epoch || 0,
            building.input,
            building.output
        );

        // Upgraded levels
        const upgrades = BUILDING_UPGRADES[building.id];
        if (upgrades) {
            upgrades.forEach((upgrade, levelIdx) => {
                const config = getBuildingEffectiveConfig(building, levelIdx + 1);
                processConfig(
                    building.id,
                    config.name || building.name,
                    building.epoch || 0,
                    config.input,
                    config.output,
                    true,
                    levelIdx + 1
                );
            });
        }
    });

    // Convert Sets to Arrays for serialization
    Object.values(buildingIndex).forEach(b => {
        b.inputs = [...b.inputs];
        b.outputs = [...b.outputs];
    });

    // Build edges: for each building, create edges from each input resource to each output resource
    const edgeMap = {}; // `${from}->${to}` -> { from, to, buildings: [] }
    Object.entries(buildingIndex).forEach(([buildingId, bInfo]) => {
        bInfo.inputs.forEach(inputRk => {
            bInfo.outputs.forEach(outputRk => {
                if (inputRk === outputRk) return; // Skip self-loops
                const key = `${inputRk}->${outputRk}`;
                if (!edgeMap[key]) {
                    edgeMap[key] = {
                        from: inputRk,
                        to: outputRk,
                        buildings: [],
                    };
                }
                edgeMap[key].buildings.push({
                    id: buildingId,
                    name: bInfo.name,
                    epoch: bInfo.epoch,
                });
            });
        });
    });

    const edges = Object.values(edgeMap);

    return { resourceNodes, edges, buildingIndex };
};

// Cached graph instance (lazy initialization)
let _cachedGraph = null;

/**
 * Get the cached resource dependency graph (builds on first call).
 * @returns {Object} The full resource dependency graph
 */
export const getResourceGraph = () => {
    if (!_cachedGraph) {
        _cachedGraph = buildResourceDependencyGraph();
    }
    return _cachedGraph;
};

/**
 * Invalidate the cached graph (call when buildings config changes at runtime).
 */
export const invalidateResourceGraph = () => {
    _cachedGraph = null;
};

/**
 * Extract a subgraph centered on a specific resource, with configurable depth.
 *
 * @param {string} resourceKey - The resource to center on
 * @param {number} upstreamDepth - How many layers of upstream (inputs) to include (default: 2)
 * @param {number} downstreamDepth - How many layers of downstream (outputs) to include (default: 2)
 * @returns {Object} Subgraph: { nodes, edges, buildingEdges }
 *   - nodes: Array<{ id, type: 'resource', resourceKey, isCurrent }>
 *   - edges: Array<{ from, to, buildings: [...] }>  (resource-to-resource edges with building info)
 */
export const getResourceSubgraph = (resourceKey, upstreamDepth = 2, downstreamDepth = 2) => {
    const graph = getResourceGraph();

    if (!graph.resourceNodes[resourceKey]) {
        // Resource not in graph (excluded or no buildings reference it)
        return { nodes: [], edges: [], buildingEdges: [] };
    }

    // Build adjacency lists for BFS traversal
    // Forward: resource -> [downstream resources]
    // Backward: resource -> [upstream resources]
    const forwardAdj = {}; // rk -> [{ to: rk, edgeIdx }]
    const backwardAdj = {}; // rk -> [{ from: rk, edgeIdx }]

    graph.edges.forEach((edge, idx) => {
        if (!forwardAdj[edge.from]) forwardAdj[edge.from] = [];
        forwardAdj[edge.from].push({ to: edge.to, edgeIdx: idx });

        if (!backwardAdj[edge.to]) backwardAdj[edge.to] = [];
        backwardAdj[edge.to].push({ from: edge.from, edgeIdx: idx });
    });

    // BFS downstream (forward) — stops expanding at terminal consumer/military resources
    const downstreamNodes = new Set([resourceKey]);
    const visitedEdges = new Set();
    let frontier = [resourceKey];

    for (let depth = 0; depth < downstreamDepth && frontier.length > 0; depth++) {
        const nextFrontier = [];
        for (const rk of frontier) {
            (forwardAdj[rk] || []).forEach(({ to, edgeIdx }) => {
                visitedEdges.add(edgeIdx);
                if (!downstreamNodes.has(to)) {
                    downstreamNodes.add(to);
                    // Add the node, but only continue expanding if NOT a terminal
                    // (terminal resources are added but don't produce further downstream exploration)
                    if (!isDownstreamTerminal(to) || to === resourceKey) {
                        nextFrontier.push(to);
                    }
                }
            });
        }
        frontier = nextFrontier;
    }

    // BFS upstream (backward) — stops expanding at raw material terminals
    const upstreamNodes = new Set([resourceKey]);
    frontier = [resourceKey];

    for (let depth = 0; depth < upstreamDepth && frontier.length > 0; depth++) {
        const nextFrontier = [];
        for (const rk of frontier) {
            (backwardAdj[rk] || []).forEach(({ from, edgeIdx }) => {
                visitedEdges.add(edgeIdx);
                if (!upstreamNodes.has(from)) {
                    upstreamNodes.add(from);
                    // Add the node, but only continue expanding if NOT an upstream terminal
                    if (!isUpstreamTerminal(from) || from === resourceKey) {
                        nextFrontier.push(from);
                    }
                }
            });
        }
        frontier = nextFrontier;
    }

    // Combine upstream + downstream
    const allResourceKeys = new Set([...upstreamNodes, ...downstreamNodes]);

    // Build nodes
    const nodes = [...allResourceKeys].map(rk => ({
        id: `res_${rk}`,
        type: 'resource',
        resourceKey: rk,
        data: RESOURCES[rk] || null,
        isCurrent: rk === resourceKey,
    }));

    // Filter edges: only include edges where both endpoints are in the subgraph
    const subEdges = [];
    visitedEdges.forEach(edgeIdx => {
        const edge = graph.edges[edgeIdx];
        if (allResourceKeys.has(edge.from) && allResourceKeys.has(edge.to)) {
            subEdges.push(edge);
        }
    });

    // Also include internal edges within the subgraph that connect included resources
    // (edges not discovered during BFS but both endpoints are in the set)
    graph.edges.forEach((edge, idx) => {
        if (!visitedEdges.has(idx) && allResourceKeys.has(edge.from) && allResourceKeys.has(edge.to)) {
            subEdges.push(edge);
        }
    });

    return { nodes, edges: subEdges };
};

/**
 * Perform layered layout for the subgraph.
 * Handles cycles gracefully using BFS from the current resource as anchor.
 * Upstream resources go to the left, downstream to the right.
 *
 * @param {Object} subgraph - Output from getResourceSubgraph
 * @param {string} currentResourceKey - The centered resource
 * @returns {Object} Layout: { nodes (with column, row), edges, maxCol, maxRow }
 */
export const layoutSubgraph = (subgraph, currentResourceKey) => {
    const { nodes, edges } = subgraph;
    if (!nodes.length) return { nodes: [], edges: [], maxCol: 0, maxRow: 0 };

    // Build node map and adjacency
    const nodeMap = {};
    nodes.forEach(n => {
        nodeMap[n.resourceKey] = { ...n, column: 0, row: 0 };
    });

    const forwardAdj = {}; // rk -> [rk]  (input -> output)
    const backwardAdj = {}; // rk -> [rk]  (output -> input)

    Object.keys(nodeMap).forEach(rk => {
        forwardAdj[rk] = [];
        backwardAdj[rk] = [];
    });

    // Deduplicate edges for adjacency
    const edgeSet = new Set();
    edges.forEach(e => {
        if (nodeMap[e.from] && nodeMap[e.to] && e.from !== e.to) {
            const key = `${e.from}->${e.to}`;
            if (!edgeSet.has(key)) {
                edgeSet.add(key);
                forwardAdj[e.from].push(e.to);
                backwardAdj[e.to].push(e.from);
            }
        }
    });

    // Strategy: BFS from currentResourceKey in both directions.
    // Upstream (backward BFS) gets negative columns, downstream (forward BFS) gets positive.
    // Then shift everything so min column = 0.

    const columnAssign = {}; // rk -> column (can be negative)

    // BFS upstream (backward): current = 0, inputs = -1, their inputs = -2, etc.
    const upVisited = new Set([currentResourceKey]);
    let upFrontier = [currentResourceKey];
    columnAssign[currentResourceKey] = 0;
    let upLevel = 0;

    while (upFrontier.length > 0) {
        upLevel--;
        const nextFrontier = [];
        for (const rk of upFrontier) {
            for (const prev of (backwardAdj[rk] || [])) {
                if (!upVisited.has(prev)) {
                    upVisited.add(prev);
                    columnAssign[prev] = upLevel;
                    nextFrontier.push(prev);
                }
            }
        }
        upFrontier = nextFrontier;
    }

    // BFS downstream (forward): current = 0, outputs = +1, their outputs = +2, etc.
    const downVisited = new Set([currentResourceKey]);
    let downFrontier = [currentResourceKey];
    let downLevel = 0;

    while (downFrontier.length > 0) {
        downLevel++;
        const nextFrontier = [];
        for (const rk of downFrontier) {
            for (const next of (forwardAdj[rk] || [])) {
                if (!downVisited.has(next)) {
                    downVisited.add(next);
                    // Only assign if not already assigned by upstream BFS,
                    // or if downstream gives a strictly higher column
                    if (columnAssign[next] === undefined || downLevel > columnAssign[next]) {
                        columnAssign[next] = downLevel;
                    }
                    nextFrontier.push(next);
                }
            }
        }
        downFrontier = nextFrontier;
    }

    // Handle any remaining unvisited nodes (shouldn't happen, but safety)
    Object.keys(nodeMap).forEach(rk => {
        if (columnAssign[rk] === undefined) {
            columnAssign[rk] = 0;
        }
    });

    // Shift columns so minimum = 0
    const minCol = Math.min(...Object.values(columnAssign));
    Object.keys(columnAssign).forEach(rk => {
        columnAssign[rk] -= minCol;
    });

    // Apply column assignments
    Object.keys(nodeMap).forEach(rk => {
        nodeMap[rk].column = columnAssign[rk];
    });

    // Compact column numbers (remove gaps)
    const usedCols = [...new Set(Object.values(columnAssign))].sort((a, b) => a - b);
    const colRemap = {};
    usedCols.forEach((col, idx) => { colRemap[col] = idx; });
    Object.values(nodeMap).forEach(n => { n.column = colRemap[n.column] ?? n.column; });

    // Assign rows within each column (current resource first, then alphabetical)
    const columnGroups = {};
    Object.values(nodeMap).forEach(n => {
        if (!columnGroups[n.column]) columnGroups[n.column] = [];
        columnGroups[n.column].push(n);
    });

    Object.values(columnGroups).forEach(group => {
        group.sort((a, b) => {
            if (a.isCurrent) return -1;
            if (b.isCurrent) return 1;
            return (a.resourceKey || '').localeCompare(b.resourceKey || '');
        });
        group.forEach((n, idx) => { n.row = idx; });
    });

    const maxCol = Math.max(0, ...Object.values(nodeMap).map(n => n.column));
    const maxRow = Math.max(0, ...Object.values(nodeMap).map(n => n.row));

    // Convert edges to use node IDs, skip back-edges (where from.column >= to.column)
    // to avoid rendering confusing backward arrows
    const layoutEdges = edges
        .filter(e => nodeMap[e.from] && nodeMap[e.to])
        .filter(e => nodeMap[e.from].column < nodeMap[e.to].column) // skip back-edges
        .map(e => ({
            from: `res_${e.from}`,
            to: `res_${e.to}`,
            buildings: e.buildings || [],
        }));

    return {
        nodes: Object.values(nodeMap),
        edges: layoutEdges,
        maxCol,
        maxRow,
    };
};

/**
 * Split a laid-out subgraph into multiple independent chain subgraphs.
 * Each chain is a connected component (undirected) that shares the current resource node.
 * This prevents unrelated supply chains from being forced into a single crowded graph.
 *
 * @param {Object} layoutResult - Output from layoutSubgraph
 * @param {string} currentResourceKey - The centered resource
 * @returns {Array<Object>} Array of { nodes, edges, maxCol, maxRow, chainLabel }
 */
export const splitSubgraphIntoChains = (layoutResult, currentResourceKey) => {
    const { nodes, edges } = layoutResult;
    if (nodes.length <= 1) return [layoutResult];

    const currentNodeId = `res_${currentResourceKey}`;

    // Build undirected adjacency from edges (using node IDs like "res_xxx")
    const adj = {};
    nodes.forEach(n => { adj[n.id] = new Set(); });
    edges.forEach(e => {
        if (adj[e.from]) adj[e.from].add(e.to);
        if (adj[e.to]) adj[e.to].add(e.from);
    });

    // Find connected components excluding the current resource node
    const otherNodes = nodes.filter(n => n.id !== currentNodeId);
    const visited = new Set();
    const components = []; // Array of Set<nodeId>

    for (const node of otherNodes) {
        if (visited.has(node.id)) continue;
        // BFS from this node, excluding currentNodeId as bridge
        const component = new Set();
        const queue = [node.id];
        while (queue.length > 0) {
            const curr = queue.shift();
            if (visited.has(curr) || curr === currentNodeId) continue;
            visited.add(curr);
            component.add(curr);
            (adj[curr] || new Set()).forEach(neighbor => {
                if (!visited.has(neighbor) && neighbor !== currentNodeId) {
                    queue.push(neighbor);
                }
            });
        }
        if (component.size > 0) {
            components.push(component);
        }
    }

    // If only 1 component (or 0), no split needed
    if (components.length <= 1) return [layoutResult];

    // Find the current resource node object
    const currentNode = nodes.find(n => n.id === currentNodeId);

    // Build a chain for each component, each including the current resource node
    const chains = components.map(componentNodeIds => {
        // Include current resource + component nodes
        const chainNodeIds = new Set([currentNodeId, ...componentNodeIds]);
        const chainNodes = nodes.filter(n => chainNodeIds.has(n.id));
        const chainEdges = edges.filter(e => chainNodeIds.has(e.from) && chainNodeIds.has(e.to));

        // Re-compact columns (may have gaps after filtering)
        const usedCols = [...new Set(chainNodes.map(n => n.column))].sort((a, b) => a - b);
        const colRemap = {};
        usedCols.forEach((col, idx) => { colRemap[col] = idx; });

        // Deep clone nodes to avoid mutating the original layout
        const remappedNodes = chainNodes.map(n => ({
            ...n,
            column: colRemap[n.column] ?? n.column,
        }));

        // Re-assign rows within each column
        const columnGroups = {};
        remappedNodes.forEach(n => {
            if (!columnGroups[n.column]) columnGroups[n.column] = [];
            columnGroups[n.column].push(n);
        });
        Object.values(columnGroups).forEach(group => {
            group.sort((a, b) => {
                if (a.isCurrent) return -1;
                if (b.isCurrent) return 1;
                return (a.resourceKey || '').localeCompare(b.resourceKey || '');
            });
            group.forEach((n, idx) => { n.row = idx; });
        });

        const maxCol = Math.max(0, ...remappedNodes.map(n => n.column));
        const maxRow = Math.max(0, ...remappedNodes.map(n => n.row));

        // Generate a label: use the terminal resource name(s) in this chain
        // (resources at max or min column, excluding current)
        const terminalNodes = remappedNodes
            .filter(n => !n.isCurrent && (n.column === 0 || n.column === maxCol))
            .map(n => n.data?.name || n.resourceKey)
            .slice(0, 3);
        const chainLabel = terminalNodes.length > 0
            ? terminalNodes.join(' / ')
            : `链路 ${components.indexOf(componentNodeIds) + 1}`;

        return {
            nodes: remappedNodes,
            edges: chainEdges,
            maxCol,
            maxRow,
            chainLabel,
        };
    });

    // Sort chains: larger chains first
    chains.sort((a, b) => b.nodes.length - a.nodes.length);

    return chains;
};

/**
 * Get simple supply chain data for a resource: which buildings produce it and which consume it,
 * along with the other resources those buildings input/output.
 * 
 * This is the simplified "direct building IO" approach — no BFS, no graph traversal.
 * 
 * @param {string} resourceKey - The resource to query
 * @param {number} epoch - Current epoch for filtering (default: 99 to show all)
 * @returns {Object} { producers: [{id, name, epoch, inputs, outputs}], consumers: [{id, name, epoch, inputs, outputs}] }
 *   - producers: buildings whose output includes this resource
 *   - consumers: buildings whose input includes this resource
 *   - Each entry includes ALL inputs/outputs of that building (for context display)
 */
export const getSimpleSupplyChain = (resourceKey, epoch = 99) => {
    const graph = getResourceGraph();
    const node = graph.resourceNodes[resourceKey];
    if (!node) return { producers: [], consumers: [] };

    const producers = [...node.producers]
        .map(bid => {
            const bInfo = graph.buildingIndex[bid];
            if (!bInfo) return null;
            // Filter by epoch - only show buildings available in current or earlier epochs
            if (bInfo.epoch > epoch) return null;
            const bDef = BUILDINGS.find(b => b.id === bid);
            return {
                id: bid,
                name: bInfo.name,
                epoch: bInfo.epoch,
                inputs: bInfo.inputs, // all resource keys this building consumes
                outputs: bInfo.outputs, // all resource keys this building produces
                bDef, // full building definition for extra info
            };
        }).filter(Boolean);

    const consumers = [...node.consumers]
        .map(bid => {
            const bInfo = graph.buildingIndex[bid];
            if (!bInfo) return null;
            // Filter by epoch - only show buildings available in current or earlier epochs
            if (bInfo.epoch > epoch) return null;
            const bDef = BUILDINGS.find(b => b.id === bid);
            return {
                id: bid,
                name: bInfo.name,
                epoch: bInfo.epoch,
                inputs: bInfo.inputs,
                outputs: bInfo.outputs,
                bDef,
            };
        }).filter(Boolean);

    // Sort: lower epoch first, then alphabetical
    const sorter = (a, b) => (a.epoch - b.epoch) || a.name.localeCompare(b.name);
    producers.sort(sorter);
    consumers.sort(sorter);

    return { producers, consumers };
};

/**
 * Get producers and consumers for a resource (fallback when graph has no data).
 * @param {string} resourceKey
 * @param {number} epoch - Current epoch for filtering
 * @returns {Object} { producers: Building[], consumers: Building[] }
 */
export const getResourceBuildingRelations = (resourceKey, epoch = 99) => {
    const graph = getResourceGraph();
    const node = graph.resourceNodes[resourceKey];

    if (!node) {
        // Fallback: scan BUILDINGS directly
        const available = BUILDINGS.filter(b => (b.epoch || 0) <= epoch);
        return {
            producers: available.filter(b => (b.output?.[resourceKey] || 0) > 0),
            consumers: available.filter(b => (b.input?.[resourceKey] || 0) > 0),
        };
    }

    return {
        producers: [...node.producers].map(id => BUILDINGS.find(b => b.id === id)).filter(Boolean),
        consumers: [...node.consumers].map(id => BUILDINGS.find(b => b.id === id)).filter(Boolean),
    };
};
