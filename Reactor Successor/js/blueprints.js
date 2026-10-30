import { state } from "./state.js";
import { getUpgradeLevel } from "./upgrades.js";

export const BASE_BLUEPRINT_SLOTS = 5;

/**
 * Calculates max allowable blueprint slots.
 * Expandable by future upgrades (e.g. blueprint_memory) without structural refactors.
 */
export function getMaxBlueprintSlots() {
    const bonusSlots = (getUpgradeLevel("blueprint_memory") || 0) * 2;
    return BASE_BLUEPRINT_SLOTS + bonusSlots;
}

/**
 * Captures currently placed components on state.grid into a blueprint slot.
 * Returns true if saved, false if grid is empty or slot is invalid.
 */
export function saveBlueprint(slotIndex, customName = null) {
    const maxSlots = getMaxBlueprintSlots();
    if (slotIndex < 0 || slotIndex >= maxSlots) return false;

    const tiles = [];
    let count = 0;

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            // Only capture placed components (live or ghost)
            if (tile && tile.component) {
                tiles.push({
                    x,
                    y,
                    component: tile.component
                });
                count++;
            }
        }
    }

    if (count === 0) return false; // Do not save an empty grid

    if (!Array.isArray(state.blueprints)) {
        state.blueprints = [];
    }

    state.blueprints[slotIndex] = {
        name: customName || `Blueprint ${slotIndex + 1}`,
        width: state.gridDimensions.width,
        height: state.gridDimensions.height,
        savedAt: Date.now(),
        tiles
    };

    return true;
}

/**
 * Stamps a saved blueprint onto the active grid as Ghost Tiles.
 * - Bounds clipping: ignores coordinates larger than current grid dimensions.
 * - Collision handling: only occupies empty tiles (preserves matching and conflicting live components).
 */
export function stampBlueprint(slotIndex) {
    const maxSlots = getMaxBlueprintSlots();
    if (slotIndex < 0 || slotIndex >= maxSlots) return false;

    const bp = state.blueprints?.[slotIndex];
    if (!bp || !Array.isArray(bp.tiles)) return false;

    let stampedCount = 0;

    for (const item of bp.tiles) {
        // Bounds clipping: ignore coordinates outside current grid bounds
        if (item.x >= state.gridDimensions.width || item.y >= state.gridDimensions.height) {
            continue;
        }

        const tile = state.grid[item.y]?.[item.x];
        if (!tile) continue;

        // Collision handling: only occupy empty tiles
        if (!tile.component) {
            tile.component = item.component;
            tile.ghost = true;
            tile.durability = null;
            stampedCount++;
        }
    }

    if (stampedCount > 0) {
        state.gridChange = true;
    }

    return stampedCount > 0;
}

/**
 * Clears a blueprint slot.
 */
export function clearBlueprint(slotIndex) {
    const maxSlots = getMaxBlueprintSlots();
    if (slotIndex >= 0 && slotIndex < maxSlots && state.blueprints) {
        state.blueprints[slotIndex] = null;
    }
}

/**
 * Renames a saved blueprint.
 */
export function renameBlueprint(slotIndex, newName) {
    if (state.blueprints?.[slotIndex] && newName && newName.trim()) {
        state.blueprints[slotIndex].name = newName.trim();
        return true;
    }
    return false;
}

/**
 * Checks if the current grid has any placed components to save.
 */
export function hasPlaceableComponentsOnGrid() {
    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            if (state.grid[y][x]?.component) return true;
        }
    }
    return false;
}

