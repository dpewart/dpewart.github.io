/*
Intended to apply adjacency bonuses between components.
*/
import { state } from "./state.js";
import { COMPONENTS } from "./components.js";
import { getOrthogonalNeighbors } from "./reactor.js";
import { UPGRADES } from "./upgrades.js";

/**
 * Calculates sum of all additive neighbor bonuses for a given property (e.g., +0.25).
 * Returns bonus delta (default 0).
 */
export function getAdjacencyBonus(x, y, targetProp) {
    const neighbors = getOrthogonalNeighbors(x, y);
    let bonus = 0;

    for (const n of neighbors) {
        const neighborTile = state.grid[n.y]?.[n.x];
        if (!neighborTile || !neighborTile.component || neighborTile.ghost) continue;

        const comp = COMPONENTS[neighborTile.component];
        if (!comp || !comp.effects) continue;

        for (const effect of comp.effects) {
            if (effect.type === "adjacencyEffect" && effect.target === targetProp) {
                const mult = getComponentUpgradeMultiplier(neighborTile.component, "adjacency_" + targetProp);
                bonus += effect.value * mult;
            }
        }
    }
    return bonus;
}
/*
 * Returns the net multiplier (1.0 + adjacency bonus + upgrade bonus) for a tile.
 */
export function getTileMultiplier(x, y, targetProp) {
    const tile = state.grid[y]?.[x];
    const adjBonus = getAdjacencyBonus(x, y, targetProp);
    if (!tile || !tile.component) return 1 + adjBonus;

    const upgBonus = getComponentUpgradeBonus(tile.component, targetProp);
    return 1 + adjBonus + upgBonus;
}
/**
 * Calculates the total bonus delta for a component stat from purchased upgrades.
 * Formula: sum(effect.value * level)
 * Returns bonus delta (e.g., 0.5 for +50%, 0.0 for none).
 */
export function getComponentUpgradeBonus(componentId, stat) {
    const comp = COMPONENTS[componentId];
    if (!comp) return 0;

    let bonus = 0;
    for (const [upgradeId, level] of Object.entries(state.purchasedUpgrades)) {
        if (level <= 0) continue;
        const upgrade = UPGRADES[upgradeId];
        if (!upgrade) continue;

        // Matches specific component OR full category.
        const matchesComponent = upgrade.targetComponent === componentId;
        const matchesCategory = upgrade.targetCategory && upgrade.targetCategory === comp.category;
        if (!matchesComponent && !matchesCategory) continue;

        const effects = upgrade.effects || (upgrade.effect ? [upgrade.effect] : []);
        for (const eff of effects) {
            if (eff.stat === stat || eff.target === stat) {
                bonus += eff.value * level;
            }
        }
    }
    return bonus;
}
/**
 * Multiplier for component stat from purchased upgrades.
 * Formula: 1.0 + bonus
 */
export function getComponentUpgradeMultiplier(componentId, stat) {
    return 1 + getComponentUpgradeBonus(componentId, stat);
}
/**
 * Returns effective component base stat scaled by global upgrades.
 * E.g., maxDurability, energyOutput, etc.
 */
export function getEffectiveComponentStat(componentId, stat) {
    const comp = COMPONENTS[componentId];
    if (!comp || comp[stat] === undefined) return null;
    const upgBonus = getComponentUpgradeBonus(componentId, stat);
    return comp[stat] * (1 + upgBonus);
}







