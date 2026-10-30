import { state } from "./state.js";
import { COMPONENTS } from "./components.js";
import { resizeGrid,
    canAffordCost,
    deductCost,
} from "./reactor.js";

/**
 * Catalog of systemic upgrades. (e.g. grid expansions, passive multipliers).
 * Repeatable upgrades define baseCost, costMultiplier, and maxLevel.
 */
export const UPGRADES = {
/*
Basic Reactor Upgrades
*/
    reinforced_core: {
        id: "reinforced_core",
        name: "Reinforced Core",
        description: "Increases Basic Reactor max durability (lifetime) by +100% per level.",
        baseCost: { energy: 75 },
        costMultiplier: 4,
        maxLevel: 4,
        requires: {
            totalEnergy: 25
        },
        targetComponent: "basic_reactor",
        type: "component_upgrade",
        effect: {
            stat: "maxDurability",
            value: 1.0 // +100% per level (additive multiplier: 1 + value * level)
        },
        icon: "🛡️"
    },
        enriched_fuel: {
        id: "enriched_fuel",
        name: "Enriched Fuel",
        description: "Increases Basic Reactor energy output by +50% per level.",
        baseCost: { energy: 250 },
        costMultiplier: 3.5,
        maxLevel: 4,
        requires: {
            totalEnergy: 50
        },
        targetComponent: "basic_reactor",
        type: "component_upgrade",
        effect: {
            stat: "energyOutput",
            value: 0.5 // +50% per level (e.g. level 1 = 1.5x, level 2 = 2.0x)
        },
        icon: "⚡"
    },
    overclocked_reaction: {
        id: "overclocked_reaction",
        name: "Overclocked Reaction",
        description: "Overclocks the Basic Reactor: +100% Base Energy Output and +100% Base Radiation Output per level.",
        baseCost: { energy: 150 },
        costMultiplier: 4.5,
        maxLevel: 3,
        requires: {
            totalEnergy: 100
        },
        targetComponent: "basic_reactor",
        type: "component_upgrade",
        effects: [
            { stat: "energyOutput", value: 1.0 },     // +100% Energy per level
            { stat: "radiationOutput", value: 1.0 }   // +100% Radiation per level
        ],
        icon: "☢️"
    },
        auto_replace_basic: {
        id: "auto_replace_basic",
        name: "Auto-Replace: Basic Reactor",
        description: "Automatically replaces burnt-out Basic Reactors upon decay, at +50% cost. Does not remove radiation.",
        baseCost: { energy: 6000 },
        costMultiplier: 1,
        maxLevel: 1,
        requires: {
            totalEnergy: 10000,
            upgrades: ["reinforced_core"]
        },
        targetComponent: "basic_reactor",
        type: "automation",
        icon: "🔄"
    },
/*
Better Reactor Upgrades
*/
zircaloy_cladding: {
    id: "zircaloy_cladding",
    name: "Zircaloy Cladding",
    description: "Increases Better Reactor max durability by +75% per level.",
    baseCost: { energy: 3000 },
    costMultiplier: 2,
    maxLevel: 4,
    requires: {
        totalEnergy: 4500,
        components: ["better_reactor"]
    },
    targetComponent: "better_reactor",
    type: "component_upgrade",
    effect: {
        stat: "maxDurability",
        value: 0.75
    },
    icon: "🛡️"
},
haleu_matrix: {
    id: "haleu_matrix",
    name: "HALEU Matrix",
    description: "Increases Better Reactor energy output by +50% per level.",
    baseCost: { energy: 5000 },
    costMultiplier: 2,
    maxLevel: 4,
    requires: {
        totalEnergy: 7500,
        components: ["better_reactor"]
    },
    targetComponent: "better_reactor",
    type: "component_upgrade",
    effect: {
        stat: "energyOutput",
        value: 0.5
    },
    icon: "⚡"
},
supercritical_overdrive: {
    id: "supercritical_overdrive",
    name: "Supercritical Overdrive",
    description: "Overclocks the Better Reactor: +100% Base Energy Output and +100% Base Radiation Output per level.",
    baseCost: { energy: 8000 },
    costMultiplier: 4.5,
    maxLevel: 3,
    requires: {
        totalEnergy: 12000,
        components: ["better_reactor"]
    },
    targetComponent: "better_reactor",
    type: "component_upgrade",
    effects: [
        { stat: "energyOutput", value: 1.0 },
        { stat: "radiationOutput", value: 1.0 }
    ],
    icon: "☢️"
},
auto_replace_better: {
    id: "auto_replace_better",
    name: "Auto-Replace: Better Reactor",
    description: "Automatically replaces burnt-out Better Reactors upon decay at +50% cost. Does not clear radiation.",
    baseCost: { energy: 30000 },
    costMultiplier: 1,
    maxLevel: 1,
    requires: {
        totalEnergy: 45000,
        upgrades: ["zircaloy_cladding"]
    },
    targetComponent: "better_reactor",
    type: "automation",
    icon: "🔄"
},
/*
Reflector Upgrades
*/
    graphite_density: {
        id: "graphite_density",
        name: "Graphite Density",
        description: "Increases Adjacency Energy bonus of all Reflectors by +10% per level.",
        baseCost: { energy: 250 },
        costMultiplier: 6.0,
        maxLevel: 5,
        requires: { totalEnergy: 300 },
        targetCategory: "reflector",
        type: "category_upgrade",
        effect: {
            stat: "adjacency_energyOutput",
            value: 0.10
        },
        icon: "🪨"
    },
    cadmium_baffling: {
        id: "cadmium_baffling",
        name: "Cadmium Baffling",
        description: "Reduces Reflector neighbor percent radiation penalty by 10% of its base value per level.",
        baseCost: { energy: 400 },
        costMultiplier: 4.0,
        maxLevel: 5,
        requires: { totalEnergy: 600 },
        targetCategory: "reflector",
        type: "category_upgrade",
        effect: {
            stat: "adjacency_radiationOutput",
            value: -0.10
        },
        icon: "🛡️"
    },
    /*
    Sink Upgrades
    */
    carbon_lattice: {
        id: "carbon_lattice",
        name: "Carbon Lattice",
        description: "Increases Radiation Absorption of all Sinks by +20% per level.",
        baseCost: { energy: 150 },
        costMultiplier: 3.5,
        maxLevel: 5,
        requires: { totalEnergy: 200 },
        targetCategory: "sink",
        type: "category_upgrade",
        effect: {
            stat: "radiationOutput",
            value: 0.20
        },
        icon: "🧽"
    },
    induced_draw: {
        id: "induced_draw",
        name: "Induced Draw",
        description: "Sinks absorb more radiation scaling linearly with neighbor radiation (+5% at 0 rad up to +50% at 100 rad).",
        baseCost: { energy: 1200 },
        costMultiplier: 1,
        maxLevel: 1,
        requires: {
            totalEnergy: 1800,
            upgrades: ["carbon_lattice"]
        },
        targetCategory: "sink",
        type: "category_upgrade",
        icon: "🧲"
    },
    radiolytic_conversion: {
        id: "radiolytic_conversion",
        name: "Radiolytic Recapture",
        description: "Recaptures +5% of radiation absorbed by sinks as electrical energy per level.",
        baseCost: { energy: 2500 },
        costMultiplier: 3.0,
        maxLevel: 4, // 5%, 10%, 15%, 20%
        requires: {
            totalEnergy: 3500,
            upgrades: ["induced_draw"]
        },
        targetCategory: "sink",
        type: "category_upgrade",
        icon: "⚡"
    },
    /*
    Overall Grid Upgrades
    */
    expand_width: {
        id: "expand_width",
        name: "Horizontal Expansion",
        description: "Expands the reactor grid width by 1 column (Max 20).",
        baseCost: { energy: 1000 },
        costMultiplier: 3,
        maxLevel: 15, // 5 base width + 15 upgrades = 20 max width
        requires: {
            totalEnergy: 1500
        },
        type: "grid_expansion",
        effect: { widthIncrease: 1 },
        icon: "↔️", // System icon
    },
    expand_height: {
        id: "expand_height",
        name: "Vertical Expansion",
        description: "Expands the reactor grid height by 1 row (Max 20).",
        baseCost: { energy: 2000 },
        costMultiplier: 3,
        maxLevel: 15, // 5 base height + 15 upgrades = 20 max height
        requires: {
            totalEnergy: 3000
        },
        type: "grid_expansion",
        effect: { heightIncrease: 1 },
        icon: "↔️", // System icon
    },
};
// Gets current purchased level for an upgrade ID.
export function getUpgradeLevel(upgradeId) {
    return state.purchasedUpgrades[upgradeId] || 0;
}
/**
 * Calculates current cost for an upgrade based on its current level.
 * Formula: Math.floor(baseCost * (multiplier ^ currentLevel))
 */
export function getUpgradeCost(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return null;

    // One-time static upgrade (cost object)
    if (upgrade.cost) {
        return upgrade.cost;
    }
    // Repeatable upgrade with level multiplier
    const currentLevel = getUpgradeLevel(upgradeId);
    const cost = {};
    if (upgrade.baseCost && upgrade.baseCost.energy !== undefined) {
        const mult = upgrade.costMultiplier || 1;
        cost.energy = Math.floor(upgrade.baseCost.energy * Math.pow(mult, currentLevel));
    }
    return cost;
}
/**
 * Evaluates whether current game state satisfies a declarative requirements object.
 * Supported keys:
 *  - totalEnergy: number (lifetime energy produced)
 *  - components: string[] (component IDs required)
 *  - upgrades: string[] (upgrade IDs required)
 */
export function meetsRequirements(requires, numericMultiplier = 1.0) {//Numeric multiplier added to allow it to be used in the isComponentVisible function at partial requirements.
    if (!requires) return true;

    // Check current energy on hand against milestone
    if (requires.energy !== undefined) {
        if (state.energy < requires.energy * numericMultiplier) {
            return false;
        }
    }

    if (requires.totalEnergy !== undefined) {
        if ((state.stats.totalEnergyProduced || 0) < requires.totalEnergy * numericMultiplier) {
            return false;
        }
    }

    if (requires.components && Array.isArray(requires.components)) {
        for (const compId of requires.components) {
            if (!state.unlockedComponents.includes(compId)) {
                return false;
            }
        }
    }

    if (requires.upgrades) {
        if (Array.isArray(requires.upgrades)) {
            for (const upgId of requires.upgrades) {
                if (getUpgradeLevel(upgId) <= 0) {
                    return false;
                }
            }
        } else if (typeof requires.upgrades === "object") {
            // Can check required level: { expand_width: 3 }
            for (const [upgId, reqLevel] of Object.entries(requires.upgrades)) {
                if (getUpgradeLevel(upgId) < reqLevel) {
                    return false;
                }
            }
        }
    }
    return true;
}
//Checks for component visibility on the component palette. Uses all of meetsRequirements, but at half the numerical value, so you can see the upgrade before you can already completely afford it.
export function isComponentVisible(componentId) {
    const comp = COMPONENTS[componentId];
    if (!comp) return false;

    if (state.unlockedComponents.includes(componentId) || !comp.unlock?.requires) {
        return true;
    }
    // 50% threshold for numeric stats, 100% for categorical
    return meetsRequirements(comp.unlock.requires, 0.5);
}
/**
 * Checks for upgrade visibility in the upgrades panel.
 * Visible if already purchased (level > 0), no requirements, or meets 50% numeric / 100% categorical requirements.
 */
export function isUpgradeVisible(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return false;

    if (getUpgradeLevel(upgradeId) > 0 || !upgrade.requires) {
        return true;
    }
    return meetsRequirements(upgrade.requires, 0.5);
}
/**
 * Checks if a component can be unlocked:
 * Must exist, not already be unlocked, meet requirements, and be affordable.
 */
export function canUnlockComponent(componentId) {
    const comp = COMPONENTS[componentId];
    if (!comp) return false;
    if (state.unlockedComponents.includes(componentId)) return false;

    // If no unlock block is specified, it's available by default
    if (!comp.unlock) return true;

    return meetsRequirements(comp.unlock.requires) && canAffordCost(comp.unlock.cost);
}
//Unlocks a component, deducting cost and updating state.
export function unlockComponent(componentId) {
    const comp = COMPONENTS[componentId];
    if (!canUnlockComponent(componentId)) return false;

    if (comp.unlock && comp.unlock.cost) {
        deductCost(comp.unlock.cost);
    }
    if (!state.unlockedComponents.includes(componentId)) {
        state.unlockedComponents.push(componentId);
    }
    return true;
}
//Checks if an upgrade can be purchased.
export function canPurchaseUpgrade(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return false;

    const currentLevel = getUpgradeLevel(upgradeId);
    if (upgrade.maxLevel !== undefined && currentLevel >= upgrade.maxLevel) {
        return false;
    };
    const currentCost = getUpgradeCost(upgradeId);
    return meetsRequirements(upgrade.requires) && canAffordCost(currentCost);
}
//Purchases an upgrade and applies immediate effects.
export function purchaseUpgrade(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!canPurchaseUpgrade(upgradeId)) return false;

    const cost = getUpgradeCost(upgradeId);
    deductCost(cost);

    const currentLevel = getUpgradeLevel(upgradeId);
    state.purchasedUpgrades[upgradeId] = currentLevel + 1;
    // Auto-replace state update, adds that component to the list of auto-replace candidates.
    if (upgrade.type === "automation" && upgrade.targetComponent) {
        state.autoReplaceUnlocked[upgrade.targetComponent] = true;
        document.getElementById("autoReplaceContainer")?.classList.remove("hidden");
    }
    // Apply immediate upgrade effects if applicable.
    if (upgrade.type === "grid_expansion" && upgrade.effect) {
            const newWidth = Math.min(20, state.gridDimensions.width + (upgrade.effect.widthIncrease || 0));
            const newHeight = Math.min(20, state.gridDimensions.height + (upgrade.effect.heightIncrease || 0));
            
            resizeGrid(newWidth, newHeight);
            state.gridChange = true;
    }
    return true;
}








