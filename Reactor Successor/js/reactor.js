/*
Stores and runs reactor logic.
Namely, the grid starts empty, with no components. Durability and radiation are tile-level properties, hence are defined and start here.
*/

import { state } from "./state.js";
import { COMPONENTS } from "./components.js";
import { getEffectiveComponentStat } from "./effects.js";

//Helper functions for creating empty reactor tiles and clearing them wherever that may be.
export function createEmptyTile() {
    return { component: null, durability: null, radiation: 0, ghost: false, };
}

export function clearTile(tile) {
    tile.component = null;
    tile.durability = null;
    tile.radiation = 0;
    tile.ghost = false;
    state.gridChange = true;
}
// Returns an array of valid adjacent { x, y } coordinates (Up, Down, Left, Right)
export function getOrthogonalNeighbors(x, y) {
    const offsets = [
        { x: x, y: y - 1 }, // Up
        { x: x, y: y + 1 }, // Down
        { x: x - 1, y: y }, // Left
        { x: x + 1, y: y }  // Right
    ];
    const height = state.grid.length;
    const width = state.grid[0].length;

    return offsets.filter(n => n.y >= 0 && n.y < height && n.x >= 0 && n.x < width);
}

export function createGrid(width, height) {
    state.grid = [];

    for (let y = 0; y < height; y++) {
        const row = [];

        for (let x = 0; x < width; x++) {
            row.push(createEmptyTile());
        }
        state.grid.push(row);
    }
}
/**
 * Resolves all primary reactors reachable by a smelter:
 * 1. Directly adjacent reactors.
 * 2. Reactors adjacent to an adjacent flux_conduit (strictly 1 hop, non-chaining).
 */
export function getReachableReactors(smelterX, smelterY) {
    const reachable = new Map(); // Key: "x,y" => { x, y, tile }
    const directNeighbors = getOrthogonalNeighbors(smelterX, smelterY);

    for (const n of directNeighbors) {
        const nTile = state.grid[n.y]?.[n.x];
        if (!nTile || !nTile.component || nTile.ghost) continue;

        const comp = COMPONENTS[nTile.component];
        if (!comp) continue;

        // Direct reactor connection
        if (comp.category === "reactor") {
            const existing = reachable.get(`${n.x},${n.y}`);
            if (!existing || 1.0 > existing.efficiency) {
                reachable.set(`${n.x},${n.y}`, { x: n.x, y: n.y, tile: nTile, efficiency: 1.0 });
            }
        }
        // 1-hop reach extension through conduit (no conduit chaining)
        else if (comp.category === "conduit") {
            const eff = comp.transmissionEfficiency ?? 1.0;
            const conduitNeighbors = getOrthogonalNeighbors(n.x, n.y);
            for (const cn of conduitNeighbors) {
                // Ignore the originating smelter and any other conduits
                if (cn.x === smelterX && cn.y === smelterY) continue;
                const cnTile = state.grid[cn.y]?.[cn.x];
                if (!cnTile || !cnTile.component || cnTile.ghost) continue;

                const cnComp = COMPONENTS[cnTile.component];
                if (cnComp && cnComp.category === "reactor") {
                    const existing = reachable.get(`${cn.x},${cn.y}`);
                    if (!existing || eff > existing.efficiency) {
                        reachable.set(`${cn.x},${cn.y}`, { x: cn.x, y: cn.y, tile: cnTile, efficiency: eff });
                    }
                }
            }
        }
    }

    return Array.from(reachable.values());
}

// Checks if the player has sufficient resources for a cost map or flat number.
export function  canAffordCost(cost) {
    if (!cost) return true;
    if (typeof cost === "number") {
        return state.energy >= cost;
    }
    if (cost.energy !== undefined && state.energy < cost.energy) {
        return false;
    }
    if (cost.alloys !== undefined && (state.alloys || 0) < cost.alloys) {
        return false;
    }
    return true;
}
// Deducts resources for a flat number or cost map.
export function deductCost(cost) {
    if (!cost) return;
    if (typeof cost === "number") {
        state.energy -= cost;
        return;
    }
    if (cost.energy !== undefined) {
        state.energy -= cost.energy;
    }
    if (cost.alloys !== undefined) {
        state.alloys = (state.alloys || 0) - cost.alloys;
    }
}
// Refunds resources when selling a component.
export function refundCost(cost, refundRatio = 1) {
    if (!cost) return;
    if (typeof cost === "number") {
        state.energy += cost * refundRatio;
        return;
    }
    if (cost.energy !== undefined) {
        state.energy += cost.energy * refundRatio;
    }
    if (cost.alloys !== undefined) {
        state.alloys = (state.alloys || 0) + (cost.alloys * refundRatio);
    }
}
// Scales a cost by a multiplier (e.g. 1.5x for auto-replace).
export function scaleCost(cost, multiplier) {
    if (typeof cost === "number") {
        return Math.floor(cost * multiplier);
    }
    const scaled = {};
    if (cost.energy !== undefined) scaled.energy = Math.floor(cost.energy * multiplier);
    if (cost.alloys !== undefined) scaled.alloys = Math.floor(cost.alloys * multiplier);
    return scaled;
}

export function placeComponent(x, y) {
    const tile = state.grid[y][x];

    if (!tile || tile.component) {
        return false;
    }

    const component = COMPONENTS[state.selectedComponent];

    if (!component) {return false;}
    // Ghost placement if player cannot afford cost (energy OR alloys)
    if (!canAffordCost(component.cost)) {
        tile.component = component.id;
        tile.durability = null;
        tile.ghost = true;
        state.gridChange = true;
        return true;
    }

    deductCost(component.cost);
    tile.component = component.id;
    tile.durability = getEffectiveComponentStat(component.id, "maxDurability");
    state.gridChange = true;
    return true;
}

export function sellComponent(x, y) {
    const tile = state.grid[y][x];

    if (!tile.component) {
        return false;
    }
    // Ghost cancellation: 0 refund, clear immediately
    if (tile.ghost) {
        clearTile(tile);
        return true;
    }

    const component = COMPONENTS[tile.component];
    const maxDur = getEffectiveComponentStat(component.id, "maxDurability");
    const refundRatio = maxDur ? (tile.durability / maxDur) : 1;

    if (component) {
        refundCost(component.cost, refundRatio);
        clearTile(tile);
        return true;
    }
    return false;
}
/**
 * Adjusts the state.grid 2D array to match target width and height,
 * appending new empty tiles without disturbing existing placed components.
 * Namely for the grid expansion upgrade system.
 */
export function resizeGrid(newWidth, newHeight) {
    // 1. Ensure all existing rows match the new width
    for (let y = 0; y < state.grid.length; y++) {
        while (state.grid[y].length < newWidth) {
            state.grid[y].push(createEmptyTile());
        }
    }
    // 2. If new rows are needed (height increase), add them
    while (state.grid.length < newHeight) {
        const newRow = [];
        for (let x = 0; x < newWidth; x++) {
            newRow.push(createEmptyTile());
        }
        state.grid.push(newRow);
    }

    // 3. Update dimension trackers
    state.gridDimensions.width = newWidth;
    state.gridDimensions.height = newHeight;
}












