/*
 * Persistence engine using localStorage.
 * Handles game state serialization, schema validation, rehydration, and factory reset.
 */

import { state } from "./state.js";
import { COMPONENTS } from "./components.js";
import { createGrid } from "./reactor.js";

export const SAVE_KEY = "reactor_successor_save_v1";
export const CURRENT_SCHEMA_VERSION = 1;

/*
 * Serializes the current active state to localStorage.
 * Returns { success: boolean, timestamp: number }.
 */
export function saveGame() {
    try {
        const compactGrid = [];
        for (let y = 0; y < state.grid.length; y++) {
            for (let x = 0; x < state.grid[y].length; x++) {
                const tile = state.grid[y][x];
                if (tile.component || (tile.radiation && tile.radiation > 0)) {
                    compactGrid.push({
                        x,
                        y,
                        componentId: tile.component,
                        durability: tile.durability !== null ? Number(tile.durability.toFixed(2)) : null,
                        radiation: Number((tile.radiation || 0).toFixed(2)),
                        ghost: Boolean(tile.ghost),
                    });
                }
            }
        }

        const saveData = {
            version: CURRENT_SCHEMA_VERSION,
            timestamp: Date.now(),
            energy: Number(state.energy.toFixed(2)),
            alloys: Number((state.alloys || 0).toFixed(2)),
            unlockedComponents: [...state.unlockedComponents],
            purchasedUpgrades: { ...state.purchasedUpgrades },
            autoReplaceEnabled: state.autoReplaceEnabled,
            autoReplaceUnlocked: { ...state.autoReplaceUnlocked },
            gridDimensions: { ...state.gridDimensions },
            stats: {
                ticks: state.stats.ticks || 0,
                totalEnergyProduced: Number((state.stats.totalEnergyProduced || 0).toFixed(2)),
                totalAlloysProduced: Number((state.stats.totalAlloysProduced || 0).toFixed(2)),
            },
            grid: compactGrid
        };

        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        return { success: true, timestamp: saveData.timestamp };
    } catch (err) {
        console.error("Failed to save game:", err);
        return { success: false, error: err };
    }
}

/*
 * Loads and rehydrates state from localStorage.
 * Returns true if a valid save was loaded, false otherwise.
 */
export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return false;

        // Version & Schema check
        if (!data.version || data.version > CURRENT_SCHEMA_VERSION) {
            console.warn("Save schema version incompatible or unrecognized.");
            return false;
        }

        // Rehydrate scalar and progression state with safe fallbacks
        state.energy = typeof data.energy === "number" ? data.energy : 30;
        state.alloys = typeof data.alloys === "number" ? data.alloys : 0;
        state.unlockedComponents = Array.isArray(data.unlockedComponents) ? data.unlockedComponents : ["basic_reactor"];
        state.purchasedUpgrades = data.purchasedUpgrades && typeof data.purchasedUpgrades === "object"
            ? data.purchasedUpgrades
            : { auto_replace_decay: 0 };
        state.autoReplaceEnabled = Boolean(data.autoReplaceEnabled);
        state.autoReplaceUnlocked = data.autoReplaceUnlocked && typeof data.autoReplaceUnlocked === "object"
            ? data.autoReplaceUnlocked
            : {};
        state.stats = {
            ticks: data.stats?.ticks || 0,
            totalEnergyProduced: data.stats?.totalEnergyProduced || 0,
            totalAlloysProduced: data.stats?.totalAlloysProduced || 0,
        };

        // Rehydrate grid dimensions
        const width = data.gridDimensions?.width || 5;
        const height = data.gridDimensions?.height || 5;
        state.gridDimensions = { width, height };

        // Recreate empty grid of appropriate size
        createGrid(width, height);

        // Rehydrate tiles
        if (Array.isArray(data.grid)) {
            data.grid.forEach(tileEntry => {
                const { x, y, componentId, durability, radiation } = tileEntry;
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    const tile = state.grid[y][x];
                    // Verify component still exists in catalog, and is not null. Will look up durability in the component definition to overwrite old values. (COMPONENTS[componentId].durability
                    if (componentId && COMPONENTS[componentId]) {
                        tile.component = componentId;
                        tile.ghost = Boolean(tileEntry.ghost);
                        // Ghost tile handling: make sure dormant ghosts don't get a durability.
                        if (tile.ghost) {
                            tile.durability = null;
                        } else {
                            tile.durability = (durability !== null && durability !== undefined) ? durability : (COMPONENTS[componentId].durability ?? null);
                        }

                    } else {
                        tile.component = null;
                        tile.durability = null;
                    }
                    tile.radiation = radiation || 0;
                }
            });
        }

        state.gridChange = true;
        return true;
    } catch (err) {
        console.error("Corrupted save file or parse failure:", err);
        return false;
    }
}

/*
 * Wipes the save and restores initial default game state.
 */
export function resetGame() {
    localStorage.removeItem(SAVE_KEY);

    state.energy = 30;
    state.alloys = 0;
    state.energyRate = 0;
    state.alloyRate = 0;
    state.selectedComponent = "basic_reactor";
    state.unlockedComponents = ["basic_reactor"];
    state.purchasedUpgrades = { auto_replace_decay: 0 };
    state.autoReplaceEnabled = false;
    state.autoReplaceUnlocked = {};
    state.gridDimensions = { width: 5, height: 5 };
    state.stats = { ticks: 0, totalEnergyProduced: 0, totalAlloysProduced: 0 };

    createGrid(5, 5);
    state.gridChange = true;
}






